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
import {
  randomBytes,
  createPublicKey,
  publicEncrypt,
  createCipheriv,
  constants as cryptoConstants,
} from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '../db/client.js';
import { links, viewerSessions } from '../db/schema.js';
import { createStorage } from './storage.js';
import { getWatermarkedPageOnDemand } from './watermarkRenderer.js';
import { logger } from '../lib/logger.js';
import { sha256, renderWatermarkTemplate, formatDateForWatermark } from '../lib/utils.js';

/** Fixed tile edge in source-image pixels. 512px gives ~20 tiles for a 1600x2263 page,
 *  which keeps a full page comfortably inside the per-minute tile budget. */
const TILE_SIZE = 512;

/** Hard cap on tiles returned for a single viewport request (bounds a hostile client). */
const MAX_TILES_PER_REQUEST = 48;

/** Per-viewer-session budgets. Tunable via env.
 *  Only *newly* requested pages and *cache-miss* tiles are charged, so re-scrolling or
 *  re-visiting a page a viewer has already seen is free, while scraping a document still
 *  costs a bounded number of new tiles per minute. */
const NEW_TILES_PER_MINUTE = Number(process.env.TILE_RATE_LIMIT ?? 60);
const NEW_PAGES_PER_MINUTE = Number(process.env.PAGE_RATE_LIMIT ?? 3);
/**
 * Safety valve on TOTAL viewport requests. Re-requesting a page the viewer has already seen
 * is free (so scrolling is cheap), which would otherwise let a client hammer the same page
 * without limit and exhaust server resources.
 */
const VIEWPORT_REQUESTS_PER_MINUTE = Number(process.env.VIEWPORT_RATE_LIMIT ?? 60);

const WINDOW_MS = 60_000;

interface Budget {
  count: number;
  windowStart: number;
}

interface SessionState {
  /** Pages this viewer has already requested (re-requests are free). */
  seenPages: Set<number>;
  newTiles: Budget;
  newPages: Budget;
  requests: Budget;
}

const sessionState = new Map<string, SessionState>();

// Drop idle sessions so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of sessionState) {
    if (
      now - state.newTiles.windowStart > WINDOW_MS * 2 &&
      now - state.newPages.windowStart > WINDOW_MS * 2
    ) {
      sessionState.delete(key);
    }
  }
}, 60_000).unref();

/** Returns true when the spend is allowed, false when the budget is exhausted. */
function charge(budget: Budget, limit: number): boolean {
  const now = Date.now();
  if (now - budget.windowStart >= WINDOW_MS) {
    budget.count = 0;
    budget.windowStart = now;
  }
  if (budget.count >= limit) return false;
  budget.count += 1;
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
// TRANSPORT ENCRYPTION (hybrid)
// ============================================
// A random AES-256 key is generated for every WebSocket session and handed to the client
// wrapped with RSA-OAEP against a public key the client generates locally, so the session
// key never travels in the clear. Every tile frame is then sealed with AES-256-GCM.
//
// What this does and does not buy:
//  - It protects the page content from a passive observer when the stream is not already
//    protected by TLS (plain ws://, or TLS terminated by an intermediary you do not trust).
//  - It does NOT stop a determined client. The decrypting code is served by this same
//    server, so anyone who can run the viewer can also read the pixels it paints.
//  - Over wss:// it is defence in depth rather than the primary control.

interface TransportCrypto {
  key: Buffer; // 32-byte AES-256 key, fresh per session
  noncePrefix: Buffer; // 4 random bytes, fixed per session
  counter: number; // monotonic; a nonce is never reused within a session
  wrapped: Buffer; // the session key sealed with the client's RSA public key
}

/** Seal one frame: [8-byte BE counter][AES-256-GCM ciphertext || 16-byte tag]. */
function sealFrame(plaintext: Buffer, tc: TransportCrypto): Buffer {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(tc.counter), 0);
  tc.counter += 1;

  const iv = Buffer.concat([tc.noncePrefix, counterBuf]); // 12-byte GCM IV
  const cipher = createCipheriv('aes-256-gcm', tc.key, iv);
  const body = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  return Buffer.concat([counterBuf, body]);
}

/** Wrap the fresh session key with the client's RSA public key. */
function establishTransport(publicKeySpkiBase64: string): TransportCrypto {
  const clientKey = createPublicKey({
    key: Buffer.from(publicKeySpkiBase64, 'base64'),
    format: 'der',
    type: 'spki',
  });

  const key = randomBytes(32);
  const noncePrefix = randomBytes(4);

  const wrapped = publicEncrypt(
    {
      key: clientKey,
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    key,
  );

  // The wrapped key travels back over the socket; only the holder of the private key can
  // unwrap it. Everything after this point is sealed with `key`.
  return { key, noncePrefix, counter: 0, wrapped };
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
  source: Buffer,
): Promise<{ bytes: Buffer; cached: boolean }> {
  const storage = createStorage();
  const tileKey = `watermarked/${linkId}/${sessionId}/tiles/${page}/${col}-${row}.webp`;

  if (await storage.exists(tileKey)) {
    return { bytes: Buffer.from(await storage.download(tileKey)), cached: true };
  }

  // Slice from the watermarked page held in memory by the caller.
  // Reading it once per request instead of once per tile matters: a 1600x2263 page is
  // ~500 KB, and re-reading it for each of ~20 tiles exhausted the file-descriptor limit
  // under concurrent viewport requests (EMFILE: too many open files).
  const left = col * TILE_SIZE;
  const top = row * TILE_SIZE;
  const width = Math.min(TILE_SIZE, pageWidth - left);
  const height = Math.min(TILE_SIZE, pageHeight - top);

  const bytes = await sharp(source)
    .extract({ left, top, width, height })
    .webp({ quality: 82 })
    .toBuffer();

  await storage.upload(tileKey, bytes, 'image/webp');
  return { bytes, cached: false };
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

  // Temporarily paused by the owner — no tiles may be served.
  if (link.disabledAt) {
    ws.send(
      JSON.stringify({
        type: 'error',
        code: 'LINK_DISABLED',
        message: 'This link is temporarily unavailable.',
      }),
    );
    ws.close(4403, 'disabled');
    return;
  }

  const state: SessionState = {
    seenPages: new Set<number>(),
    newTiles: { count: 0, windowStart: Date.now() },
    newPages: { count: 0, windowStart: Date.now() },
    requests: { count: 0, windowStart: Date.now() },
  };
  sessionState.set(session.id, state);

  // Transport encryption state for this socket — null until the client sends its public key.
  let transport: TransportCrypto | null = null;

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
    let msg: {
      type?: string;
      page?: number;
      rect?: { x: number; y: number; w: number; h: number };
      key?: string;
    };
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', code: 'BAD_REQUEST', message: 'Malformed message' }));
      return;
    }

    // Key exchange: the client sends its RSA public key, we answer with the session key
    // wrapped to it. Until this completes, no page content is sent.
    if (msg.type === 'pubkey') {
      if (transport) return; // already established for this socket
      try {
        transport = establishTransport(String(msg.key ?? ''));
        ws.send(
          JSON.stringify({
            type: 'key',
            alg: 'AES-256-GCM',
            wrapped_key: transport.wrapped.toString('base64'),
            nonce_prefix: transport.noncePrefix.toString('base64'),
          }),
        );
        logger.info({ linkId, sessionId: session.id }, 'Tile stream transport key established');
      } catch (err) {
        logger.warn({ err, linkId }, 'Transport key exchange failed');
        ws.send(
          JSON.stringify({
            type: 'error',
            code: 'CRYPTO_ERROR',
            message: 'Could not establish a secure channel',
          }),
        );
        ws.close(4400, 'crypto');
      }
      return;
    }

    if (msg.type !== 'viewport') return;

    if (!transport) {
      ws.send(
        JSON.stringify({
          type: 'error',
          code: 'CRYPTO_REQUIRED',
          message: 'Complete the key exchange before requesting pages',
        }),
      );
      return;
    }
    // Capture into a const: `transport` is a mutable binding captured by this closure, so
    // TypeScript will not keep the narrowing above across the awaits below.
    const tc: TransportCrypto = transport;

    // Safety valve on total requests, independent of the new-page and new-tile budgets.
    if (!charge(state.requests, VIEWPORT_REQUESTS_PER_MINUTE)) {
      ws.send(
        JSON.stringify({
          type: 'error',
          code: 'RATE_LIMITED',
          message: `Too many page requests. Limit is ${VIEWPORT_REQUESTS_PER_MINUTE} per minute.`,
        }),
      );
      return;
    }

    const page = Math.trunc(Number(msg.page));
    if (!Number.isFinite(page) || page < 1 || page > (link.pageCount || 0)) {
      ws.send(JSON.stringify({ type: 'error', code: 'BAD_REQUEST', message: 'Page out of range' }));
      return;
    }

    // Charge only pages this viewer has not opened before, so re-scrolling is free
    // while walking a whole document still costs budget.
    if (!state.seenPages.has(page)) {
      if (!charge(state.newPages, NEW_PAGES_PER_MINUTE)) {
        ws.send(
          JSON.stringify({
            type: 'error',
            code: 'RATE_LIMITED',
            message: `Too many new pages. Limit is ${NEW_PAGES_PER_MINUTE} per minute.`,
          }),
        );
        return;
      }
      state.seenPages.add(page);
    }

    try {
      // Ensure the watermarked page for this viewer exists (generates on first view).
      await getWatermarkedPageOnDemand(linkId, session.id, watermarkText, page);

      const storage = createStorage();
      const sourceKey = `watermarked/${linkId}/${session.id}/page-${page}.webp`;
      // Read the watermarked page ONCE per request and reuse the buffer for every tile.
      const source = Buffer.from(await storage.download(sourceKey));
      const meta = await sharp(source).metadata();
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

          // Charge the budget BEFORE extracting. If we charged afterwards, a rate-limited
          // request would still populate the cache and could then be retried for free,
          // which would defeat the limit entirely.
          const tileKey = `watermarked/${linkId}/${session.id}/tiles/${page}/${col}-${row}.webp`;
          const cached = await storage.exists(tileKey);
          if (!cached && !charge(state.newTiles, NEW_TILES_PER_MINUTE)) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'RATE_LIMITED',
                message: `Tile budget exhausted (${NEW_TILES_PER_MINUTE} new tiles/min). Slow down.`,
              }),
            );
            return;
          }

          const tile = await readTile(
            linkId,
            session.id,
            page,
            col,
            row,
            pageWidth,
            pageHeight,
            source,
          );
          ws.send(
            sealFrame(
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
                tile.bytes,
              ),
              tc,
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
