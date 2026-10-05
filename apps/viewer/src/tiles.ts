/**
 * WebSocket tile client for the secure viewer.
 *
 * The server slices the per-viewer watermarked page into fixed-size tiles and only
 * sends the region the viewer is actually showing. This module opens the stream,
 * requests viewports, and hands decoded bitmaps to the renderer.
 *
 * Frame layout from the server: [4-byte BE header length][header JSON][webp bytes].
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface TileHeader {
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

export interface PageGeometry {
  page: number;
  pageWidth: number;
  pageHeight: number;
  cols: number;
  rows: number;
  tileSize: number;
}

export interface ViewportRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class TileStream {
  private ws: WebSocket | null = null;

  onPage?: (geo: PageGeometry) => void;
  onTile?: (header: TileHeader, bitmap: ImageBitmap) => void;
  onDone?: (page: number, sent: number) => void;
  onError?: (code: string, message: string) => void;
  onClose?: () => void;

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(linkToken: string, sessionToken: string): void {
    // http -> ws, https -> wss
    const base = API_URL.replace(/^http/, 'ws');
    const url =
      `${base}/v1/viewer/${encodeURIComponent(linkToken)}/stream` +
      `?st=${encodeURIComponent(sessionToken)}`;

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (ev) => void this.handleMessage(ev);
    ws.onerror = () => this.onError?.('NETWORK', 'Tile stream connection failed');
    ws.onclose = () => this.onClose?.();
    this.ws = ws;
  }

  /** Ask for a page. Omit `rect` for the whole page (used on first load). */
  requestPage(page: number, rect?: ViewportRect): void {
    if (!this.connected) return;
    this.ws!.send(JSON.stringify({ type: 'viewport', page, ...(rect ? { rect } : {}) }));
  }

  close(): void {
    try {
      this.ws?.close();
    } catch {
      /* already closed */
    }
    this.ws = null;
  }

  private async handleMessage(ev: MessageEvent): Promise<void> {
    if (typeof ev.data === 'string') {
      let msg: { type?: string; [k: string]: unknown };
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case 'page':
          this.onPage?.(msg as unknown as PageGeometry);
          break;
        case 'done':
          this.onDone?.(msg.page as number, msg.sent as number);
          break;
        case 'error':
          this.onError?.(msg.code as string, msg.message as string);
          break;
        default:
          break; // 'hello'
      }
      return;
    }

    const buf = ev.data as ArrayBuffer;
    if (!buf || buf.byteLength < 4) return;

    const view = new DataView(buf);
    const headerLength = view.getUint32(0, false);
    if (headerLength <= 0 || 4 + headerLength > buf.byteLength) return;

    const header = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buf, 4, headerLength)),
    ) as TileHeader;
    const bytes = new Uint8Array(buf, 4 + headerLength);

    try {
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
      this.onTile?.(header, bitmap);
    } catch {
      // A single unreadable tile should not kill the whole view.
      this.onError?.('BAD_TILE', `Tile ${header.page}:${header.col}-${header.row} could not be decoded`);
    }
  }
}
