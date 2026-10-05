/**
 * WebSocket tile server for the secure viewer.
 *
 * Instead of handing the client a whole page image, the viewer requests only the
 * region it is actually showing. The server slices that region out of the
 * **per-viewer watermarked** page and streams the tiles back. Tiles are cached per
 * (link, viewer session, page) so repeated viewports are cheap.
 *
 * Security properties:
 * - Every tile comes from the watermarked page, so the viewer identity is baked into
 *   the pixels. A screenshot still carries attribution.
 * - Only the requested viewport is served, and requests are rate limited per session,
 *   so bulk-scraping a document costs far more requests than a human reader generates.
 * - The client is never given a clean page URL.
 *
 * NOTE: this raises the cost of automated scraping. It does not — and cannot — prevent a
 * determined user from reassembling what their own browser displays, nor OS-level
 * screenshots. Attribution via the burned-in watermark is the durable defence.
 */
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '../db/client.js';
import { links, viewerSessions } from '../db/schema.js';
import { createStorage } from './storage.js';
import { getWatermarkedPageOnDemand } from './watermarkRenderer.js';
import { logger } from '../lib/logger.js';
import { sha256, renderWatermarkTemplate, formatDateForWatermark } from '../lib/utils.js';

/** Fixed tile edge in source-image pixels. */
const TILE_SIZE = 256;

/** Hard cap on tiles returned for a single viewport request (bounds a hostile client). */
const MAX_TILES_PER_REQUEST = 48;

/** Per-viewer-session budgets. Tunable via env. */
const TILES_PER_MINUTE = Number(process.env.TILE_RATE_LIMIT ?? 60);
const PAGES_PER_MINUTE = Number(process.env.PAGE_RATE_LIMIT ?? 3);

const WINDOW_MS = 60_000;

interface SessionState {
  tiles: { count: number; windowStart: number };
  pages: { count: number; windowStart: number };
}

const sessionState = new Map<string, SessionState>();

// Drop idle sessions so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of sessionState) {
    if (
      now - state.tiles.windowStart > WINDOW_MS * 2 &&
      now - state.pages.windowStart > WINDOW_MS * 2
    ) {
      sessionState.delete(key);
    }
  }
}, 60_000).unref();

function take(state: SessionState, bucket: 'tiles' | 'pages', limit: number): boolean {
  const now = Date.now();
  const w = state[bucket];
  if (now - w.windowStart >= WINDOW_MS) {
    w.count = 0;
    w.windowStart = now;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}

// ============================================
// BINARY FRAME ENCODING
// ============================================
// [4-byte big-endian header length][header JSON (utf8)][image bytes]

interface TileHeader {
  page: number;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  pageWidth: number;
  pageHeight: number;
}

function encodeTileFrame(header: TileHeader, bytes: Buffer): Buffer {
  const headerBuf = Buffer.from(JSON.stringify(header), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(headerBuf.length, 0);
  return Buffer.concat([len, headerBuf, bytes]);
}

// ============================================
// TILE EXTRACTION
// ============================================

async function readTile(
  linkId: string,
  sessionId: string,
  page: number,
  col: number,
  row: number,
  pageWidth: number,
  pageHeight: number,
): Promise<Buffer> {
  const storage = createStorage();
  const tileKey = `watermarked/${linkId}/${sessionId}/tiles/${page}/${col}-${row}.webp`;

  if (await storage.exists(tileKey)) {
    return Buffer.from(await storage.download(tileKey));
  }

  // The per-viewer watermarked page is the only source we ever slice from.
  const sourceKey = `watermarked/${linkId}/${sessionId}/page-${page}.webp`;
  const source = Buffer.from(await storage.download(sourceKey));

  const left = col * TILE_SIZE;
  const top = row * TILE_SIZE;
  const width = Math.min(TILE_SIZE, pageWidth - left);
  const height = Math.min(TILE_SIZE, pageHeight - top);

  const bytes = await sharp(source)
    .extract({ left, top, width, height })
    .webp({ quality: 82 })
    .toBuffer();

  await storage.upload(tileKey, bytes, 'image/webp');
  return bytes;
}

// ============================================
// CONNECTION HANDLING
// ============================================

async function handleConnection(ws: WebSocket, sessionToken: string, linkId: string) {
  const session = await db
    .select()
    .from(viewerSessions)
    .where(eq(viewerSessions.token, sha256(sessionToken)))
    .get();

  if (!session || new Date(session.expiresAt) < new Date() || session.linkId !== linkId) {
    ws.send(JSON.stringify({ type: 'error', code: 'UNAUTHORIZED', message: 'Session invalid or expired' }));
    ws.close(4401, 'unauthorized');
    return;
  }

  const link = await db.select().from(links).where(eq(links.id, linkId)).get();
  if (!link) {
    ws.send(JSON.stringify({ type: 'error', code: 'NOT_FOUND', message: 'Link not found' }));
    ws.close(4404, 'not found');
    return;
  }

  const state: SessionState = {
    tiles: { count: 0, windowStart: Date.now() },
    pages: { count: 0, windowStart: Date.now() },
  };
  sessionState.set(session.id, state);

  const sessionShortId = sessionToken.slice(0, 6);
  const watermarkText = renderWatermarkTemplate(
    link.watermarkTemplate || '{{email}} · {{date}} · {{session_id}}',
    {
      email: session.viewerEmail,
      date: formatDateForWatermark(),
      session_id: sessionShortId,
    },
  );

  logger.info({ linkId, sessionId: session.id, email: session.viewerEmail }, 'Tile stream connected');

  ws.send(
    JSON.stringify({
      type: 'hello',
      pageCount: link.pageCount || 0,
      tileSize: TILE_SIZE,
      watermark: link.watermarkEnabled,
    }),
  );

  ws.on('message', async (raw) => {
    let msg: { type?: string; page?: number; rect?: { x: number; y: number; w: number; h: number } };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', code: 'BAD_REQUEST', message: 'Malformed message' }));
      return;
    }

    if (msg.type !== 'viewport') return;

    const page = Math.trunc(Number(msg.page));
    if (!Number.isFinite(page) || page < 1 || page > (link.pageCount || 0)) {
      ws.send(JSON.stringify({ type: 'error', code: 'BAD_REQUEST', message: 'Page out of range' }));
      return;
    }

    if (!take(state, 'pages', PAGES_PER_MINUTE)) {
      ws.send(
        JSON.stringify({
          type: 'error',
          code: 'RATE_LIMITED',
          message: `Too many page requests. Limit is ${PAGES_PER_MINUTE} per minute.`,
        }),
      );
      return;
    }

    try {
      // Ensure the watermarked page for this viewer exists (generates on first view).
      await getWatermarkedPageOnDemand(linkId, session.id, watermarkText, page);

      const storage = createStorage();
      const sourceKey = `watermarked/${linkId}/${session.id}/page-${page}.webp`;
      const meta = await sharp(Buffer.from(await storage.download(sourceKey))).metadata();
      const pageWidth = meta.width ?? 0;
      const pageHeight = meta.height ?? 0;
      if (!pageWidth || !pageHeight) {
        ws.send(JSON.stringify({ type: 'error', code: 'INTERNAL_ERROR', message: 'Page metadata unavailable' }));
        return;
      }

      const cols = Math.ceil(pageWidth / TILE_SIZE);
      const rows = Math.ceil(pageHeight / TILE_SIZE);

      // Which tiles intersect the requested viewport (default: the whole page).
      const rect = msg.rect ?? { x: 0, y: 0, w: pageWidth, h: pageHeight };
      const colStart = Math.max(0, Math.floor(rect.x / TILE_SIZE));
      const colEnd = Math.min(cols - 1, Math.floor((rect.x + rect.w - 1) / TILE_SIZE));
      const rowStart = Math.max(0, Math.floor(rect.y / TILE_SIZE));
      const rowEnd = Math.min(rows - 1, Math.floor((rect.y + rect.h - 1) / TILE_SIZE));

      ws.send(JSON.stringify({ type: 'page', page, pageWidth, pageHeight, cols, rows, tileSize: TILE_SIZE }));

      let sent = 0;
      for (let row = rowStart; row <= rowEnd; row++) {
        for (let col = colStart; col <= colEnd; col++) {
          if (sent >= MAX_TILES_PER_REQUEST) break;
          if (!take(state, 'tiles', TILES_PER_MINUTE)) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'RATE_LIMITED',
                message: `Tile budget exhausted (${TILES_PER_MINUTE}/min). Slow down.`,
              }),
            );
            return;
          }
          const bytes = await readTile(linkId, session.id, page, col, row, pageWidth, pageHeight);
          ws.send(
            encodeTileFrame(
              {
                page,
                col,
                row,
                x: col * TILE_SIZE,
                y: row * TILE_SIZE,
                w: Math.min(TILE_SIZE, pageWidth - col * TILE_SIZE),
                h: Math.min(TILE_SIZE, pageHeight - row * TILE_SIZE),
                cols,
                rows,
                pageWidth,
                pageHeight,
              },
              bytes,
            ),
          );
          sent++;
        }
      }

      ws.send(JSON.stringify({ type: 'done', page, sent }));
    } catch (err) {
      logger.error({ err, linkId, page }, 'Tile request failed');
      ws.send(
        JSON.stringify({
          type: 'error',
          code: 'INTERNAL_ERROR',
          message: 'Could not prepare this page securely.',
        }),
      );
    }
  });

  ws.on('close', () => logger.info({ linkId, sessionId: session.id }, 'Tile stream closed'));
  ws.on('error', (err) => logger.warn({ err, linkId }, 'Tile stream error'));
}

/**
 * Attach the tile WebSocket endpoint to the HTTP server.
 * Route: /v1/viewer/:linkId/stream?st=<viewer session token>
 */
export function attachTileServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    let url: URL;
    try {
      url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    } catch {
      socket.destroy();
      return;
    }

    const match = url.pathname.match(/^\/v1\/viewer\/([^/]+)\/stream$/);
    if (!match) {
      // Not ours — close cleanly rather than leaving the socket hanging.
      socket.destroy();
      return;
    }

    const linkId = decodeURIComponent(match[1]);
    const sessionToken = url.searchParams.get('st') || '';
    if (!sessionToken) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      void handleConnection(ws, sessionToken, linkId);
    });
  });

  logger.info('Tile WebSocket server attached at /v1/viewer/:linkId/stream');
}
