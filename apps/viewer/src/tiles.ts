/**
 * WebSocket tile client for the secure viewer.
 *
 * The server slices the per-viewer watermarked page into fixed-size tiles and only
 * sends the region the viewer is actually showing.
 *
 * Transport encryption (hybrid):
 *  1. On connect the client generates an ephemeral RSA-OAEP key pair locally and sends
 *     the public half to the server.
 *  2. The server answers with a fresh random AES-256 session key, wrapped to that public
 *     key, plus a per-session nonce prefix.
 *  3. Every tile frame is sealed with AES-256-GCM under that session key.
 *
 * What this does and does not buy: it hides the page content from a passive observer when
 * the socket is not already protected by TLS. It does NOT stop a determined client — the
 * code below runs in their browser, so anyone running the viewer can read the pixels it
 * paints. Over wss:// this is defence in depth, not the primary control.
 *
 * Sealed frame layout: [8-byte BE counter][AES-256-GCM ciphertext || 16-byte tag]
 * Plaintext inside:    [4-byte BE header length][header JSON][webp bytes]
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

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export class TileStream {
  private ws: WebSocket | null = null;
  private privateKey: CryptoKey | null = null;
  private aesKey: CryptoKey | null = null;
  private noncePrefix: Uint8Array | null = null;
  private lastCounter = -1;

  onReady?: () => void;
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
    ws.onopen = () => void this.beginHandshake();
    ws.onmessage = (ev) => void this.handleMessage(ev);
    ws.onerror = () => this.onError?.('NETWORK', 'Tile stream connection failed');
    ws.onclose = () => this.onClose?.();
    this.ws = ws;
  }

  /** Ask for a page. Omit `rect` for the whole page (used on first load). */
  requestPage(page: number, rect?: ViewportRect): void {
    if (!this.connected || !this.aesKey) return;
    this.ws!.send(JSON.stringify({ type: 'viewport', page, ...(rect ? { rect } : {}) }));
  }

  close(): void {
    try {
      this.ws?.close();
    } catch {
      /* already closed */
    }
    this.ws = null;
    this.aesKey = null;
    this.privateKey = null;
    this.noncePrefix = null;
    this.lastCounter = -1;
  }

  // ── Key exchange ──────────────────────────────────────────────────────────

  private async beginHandshake(): Promise<void> {
    try {
      if (!globalThis.crypto?.subtle) {
        this.onError?.(
          'CRYPTO_UNAVAILABLE',
          'Web Crypto is unavailable — the viewer needs a secure context (HTTPS or localhost).',
        );
        return;
      }

      const pair = (await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt'],
      )) as CryptoKeyPair;

      this.privateKey = pair.privateKey;
      const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
      this.ws?.send(JSON.stringify({ type: 'pubkey', key: toBase64(spki) }));
    } catch (err) {
      this.onError?.('CRYPTO_ERROR', `Key generation failed: ${(err as Error).message}`);
    }
  }

  /** Unwrap the session key the server sent us. */
  private async acceptSessionKey(msg: { wrapped_key?: string; nonce_prefix?: string }): Promise<void> {
    try {
      if (!this.privateKey || !msg.wrapped_key || !msg.nonce_prefix) {
        throw new Error('incomplete key material');
      }

      const rawKey = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        this.privateKey,
        fromBase64(msg.wrapped_key) as unknown as ArrayBuffer,
      );

      this.aesKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, [
        'decrypt',
      ]);
      this.noncePrefix = fromBase64(msg.nonce_prefix);
      this.lastCounter = -1;

      // The private key has done its job; drop it.
      this.privateKey = null;

      this.onReady?.();
    } catch (err) {
      this.onError?.('CRYPTO_ERROR', `Could not establish the session key: ${(err as Error).message}`);
      this.ws?.close(4400, 'crypto');
    }
  }

  // ── Frame handling ────────────────────────────────────────────────────────

  private async handleMessage(ev: MessageEvent): Promise<void> {
    if (typeof ev.data === 'string') {
      let msg: { type?: string; [k: string]: unknown };
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case 'key':
          await this.acceptSessionKey(msg as { wrapped_key?: string; nonce_prefix?: string });
          break;
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

    await this.handleSealedFrame(ev.data as ArrayBuffer);
  }

  private async handleSealedFrame(buf: ArrayBuffer): Promise<void> {
    if (!this.aesKey || !this.noncePrefix) return; // not ready yet
    if (!buf || buf.byteLength < 8 + 16) return;

    const view = new DataView(buf);
    const counter = Number(view.getBigUint64(0, false));

    // The server's counter is monotonic per session; refuse replays and reordering.
    if (counter <= this.lastCounter) {
      this.onError?.('BAD_FRAME', 'Out-of-order or replayed tile frame');
      return;
    }
    this.lastCounter = counter;

    const iv = new Uint8Array(12);
    iv.set(this.noncePrefix, 0);
    new DataView(iv.buffer).setBigUint64(4, BigInt(counter), false);

    let plaintext: ArrayBuffer;
    try {
      plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.aesKey,
        buf.slice(8),
      );
    } catch {
      // A failed tag means the frame was tampered with or the key is wrong.
      this.onError?.('DECRYPT_FAILED', 'A tile failed authentication and was discarded');
      return;
    }

    if (plaintext.byteLength < 4) return;

    const headerLength = new DataView(plaintext).getUint32(0, false);
    if (headerLength <= 0 || 4 + headerLength > plaintext.byteLength) return;

    const header = JSON.parse(
      new TextDecoder().decode(new Uint8Array(plaintext, 4, headerLength)),
    ) as TileHeader;
    const bytes = new Uint8Array(plaintext, 4 + headerLength);

    try {
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
      this.onTile?.(header, bitmap);
    } catch {
      this.onError?.('BAD_TILE', `Tile ${header.page}:${header.col}-${header.row} could not be decoded`);
    }
  }
}
