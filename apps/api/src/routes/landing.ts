import { Hono } from 'hono';
import type { Variables } from '../lib/types.js';

const landingRouter = new Hono<{ Variables: Variables }>();

/**
 * The landing page, served at "/" instead of the old redirect to the dashboard.
 *
 * It lives in this module rather than in apps/api/public because that directory is assembled at
 * build time by scripts/assemble-api-public.mjs and is never committed, so a page placed there
 * would not survive a build. Everything here is one file with no build step, no font download
 * and no external request: the API already has to answer "/" anyway.
 *
 * The three totals come from GET /v1/public/stats and are the deployment's real numbers. They
 * are rendered as a skeleton first and fall back to the word "unavailable" if the request
 * fails, so the page never shows a made-up figure.
 */
const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Scrinium - secure document and video sharing</title>
<meta name="description" content="Open-source API and embeddable viewer for sharing documents and videos with watermarked pixels, verified access, expiry and per-page analytics.">
<style>
:root {
  --bg: #0a0c10;
  --surface: #101319;
  --border: #1e2430;
  --border-soft: #171c26;
  --text: #e9edf2;
  --muted: #8d97a6;
  --accent: #00ff88;
  --accent-ink: #04160e;
  --radius: 12px;
  /*
   * The wordmark only. A serif against the sans body and the mono labels gives the brand its own
   * voice, and these faces already ship with macOS and Windows, so nothing is downloaded.
   */
  --font-brand: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif;
}

/* Light palette. The media query covers the first visit and the no-script case; the
   [data-theme='light'] block is what the header toggle sets. */
@media (prefers-color-scheme: light) {
  :root:not([data-theme='dark']) {
    --bg: #f7f9fa;
    --surface: #ffffff;
    --border: #dde4ea;
    --border-soft: #eaeff3;
    --text: #0d1218;
    --muted: #5c6673;
    --accent: #00803f;
    --accent-ink: #ffffff;
  }
}

:root[data-theme='light'] {
  --bg: #f7f9fa;
  --surface: #ffffff;
  --border: #dde4ea;
  --border-soft: #eaeff3;
  --text: #0d1218;
  --muted: #5c6673;
  --accent: #00803f;
  --accent-ink: #ffffff;
}

* { box-sizing: border-box; }

/*
 * A theme switch repaints every surface in the same frame, which reads as a flash. Transitioning
 * the colour properties only (never layout) lets the change settle instead. Elements with their
 * own transition, such as the buttons and the rays, keep theirs: a more specific rule replaces it.
 */
*,
*::before,
*::after {
  transition: background-color 260ms ease, border-color 260ms ease, color 260ms ease;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  margin: 0;
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-weight: 600;
}

h1 {
  font-size: clamp(2rem, 4.6vw, 3.125rem);
  letter-spacing: -0.03em;
  max-width: 30ch;
}

h2 { font-size: clamp(1.375rem, 2.6vw, 1.875rem); }

h3 { font-size: 0.9375rem; letter-spacing: 0; }

p { margin: 0; }

a { color: inherit; }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

.wrap {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 24px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

/* ---- Header ---- */

.site-head {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 64px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-soft);
}

.head-inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 24px;
}

.brand {
  font-family: var(--font-brand);
  font-size: 1.3125rem;
  font-weight: 600;
  letter-spacing: -0.012em;
  text-decoration: none;
  margin-right: auto;
}

.site-nav {
  display: flex;
  gap: 22px;
  font-size: 0.875rem;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Two classes, not one: .btn sets padding, and it is defined further down the sheet, so a
   single-class .theme-toggle would lose the cascade and squeeze the icon to nothing. */
.btn.theme-toggle {
  width: 40px;
  padding: 0;
  cursor: pointer;
}

.btn.theme-toggle svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* The disc is a single path interpolated between Lucide's Sun circle and Moon crescent by the
   script at the end of the body. The rays are a separate group that grows in as it opens up. */
.theme-rays {
  opacity: 0;
  transform-box: view-box;
  transform-origin: 50% 50%;
  transform: scale(0.55);
  transition: transform 380ms cubic-bezier(0.34, 1.35, 0.5, 1), opacity 220ms ease;
}

:root[data-theme='light'] .theme-rays {
  opacity: 1;
  transform: scale(1);
}

.site-nav a {
  color: var(--muted);
  text-decoration: none;
  transition: color 140ms ease;
}

.site-nav a:hover { color: var(--text); }

/* ---- Buttons ---- */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 18px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-ink);
}

.btn-primary:hover { filter: brightness(0.92); }

.btn-ghost {
  border-color: var(--border);
  color: var(--text);
}

.btn-ghost:hover { border-color: var(--muted); }

/* ---- Hero ---- */

.hero {
  padding: clamp(64px, 11vh, 112px) 0 56px;
}

.eyebrow {
  font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--accent);
  margin-bottom: 20px;
}

.lede {
  margin-top: 20px;
  max-width: 60ch;
  font-size: 1.0625rem;
  color: var(--muted);
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 32px;
}

/* ---- Stats ---- */

.stats {
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
  padding: 28px 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.stat { display: flex; flex-direction: column; gap: 4px; }

.stat-value {
  font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 1.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.stat-value.is-loading {
  display: inline-block;
  width: 3.5ch;
  height: 0.8em;
  border-radius: 4px;
  background: var(--border);
  color: transparent;
}

.stat-value.is-error {
  font-size: 1rem;
  font-weight: 400;
  color: var(--muted);
}

.stat-label {
  font-size: 0.8125rem;
  color: var(--muted);
}

/* ---- Sections ---- */

.section {
  padding: 72px 0;
  scroll-margin-top: 80px;
}

.section + .section { border-top: 1px solid var(--border-soft); }

.section-lede {
  margin-top: 14px;
  max-width: 68ch;
  color: var(--muted);
}

/* ---- Pipeline ---- */

.flow {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  align-items: stretch;
  gap: 10px;
  margin: 36px 0 0;
}

.flow-step {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 18px;
}

.flow-step h3 { margin-bottom: 6px; }

.flow-step p {
  font-size: 0.875rem;
  color: var(--muted);
}

.flow-arrow {
  align-self: center;
  color: var(--muted);
  font-size: 1rem;
}

.arch-notes {
  list-style: none;
  margin: 32px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 10px 32px;
}

.arch-notes li {
  font-size: 0.875rem;
  color: var(--muted);
  padding-left: 16px;
  position: relative;
}

.arch-notes li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.62em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--border);
}

.arch-notes strong { color: var(--text); font-weight: 500; }

/* ---- Feature groups ---- */

.groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 40px 48px;
  margin-top: 40px;
}

.group h3 {
  font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--muted);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-soft);
}

.group ul {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group li { font-size: 0.875rem; }

.item-name {
  color: var(--text);
  font-weight: 500;
}

.item-desc { color: var(--muted); }

.formats {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--border-soft);
  font-size: 0.8125rem;
  color: var(--muted);
}

.formats span { color: var(--text); }

/* ---- Callout ---- */

.callout {
  margin-top: 40px;
  border: 1px solid var(--border);
  border-left: 2px solid var(--accent);
  border-radius: var(--radius);
  background: var(--surface);
  padding: 22px 24px;
}

.callout h3 { margin-bottom: 8px; }

.callout p {
  font-size: 0.875rem;
  color: var(--muted);
  max-width: 78ch;
}

/* ---- Footer ---- */

.site-foot {
  border-top: 1px solid var(--border-soft);
  padding: 44px 0;
}

.foot-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.foot-title {
  font-family: var(--font-brand);
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.012em;
  margin-bottom: 6px;
}

.foot-note { font-size: 0.8125rem; color: var(--muted); }

@media (max-width: 900px) {
  .flow { grid-template-columns: 1fr; }
  .flow-arrow { transform: rotate(90deg); justify-self: start; }
}

@media (max-width: 720px) {
  .site-nav { display: none; }
  .stats-grid { grid-template-columns: 1fr; gap: 20px; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  * { transition: none !important; }
}
</style>
<script>
/* Resolved before the body paints, so a stored choice never flashes the wrong palette. The
   toggle itself is wired at the end of the body, once the icon it animates exists. */
(function () {
  var saved = null;
  try { saved = localStorage.getItem('scrinium-theme'); } catch (e) { /* storage blocked */ }
  if (saved !== 'dark' && saved !== 'light') {
    saved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', saved);
})();
</script>
</head>
<body>

<header class="site-head">
  <div class="wrap head-inner">
    <a class="brand" href="/">Scrinium</a>
    <nav class="site-nav">
      <a href="#architecture">Architecture</a>
      <a href="#features">Features</a>
      <a href="#protections">Protections</a>
    </nav>
    <div class="head-actions">
      <button type="button" class="btn btn-ghost theme-toggle" id="theme-toggle" aria-label="Switch theme">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path class="theme-morph" d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>
          <g class="theme-rays">
            <path d="M12 2v2"/>
            <path d="M12 20v2"/>
            <path d="m4.93 4.93 1.41 1.41"/>
            <path d="m17.66 17.66 1.41 1.41"/>
            <path d="M2 12h2"/>
            <path d="M20 12h2"/>
            <path d="m6.34 17.66-1.41 1.41"/>
            <path d="m19.07 4.93-1.41 1.41"/>
          </g>
        </svg>
      </button>
      <a class="btn btn-primary" href="/dashboard/">Open dashboard</a>
    </div>
  </div>
</header>

<main>

  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">Secure document and video sharing</p>
      <h1>Share documents that stay traceable to the viewer.</h1>
      <p class="lede">Every page carries the viewer's identity in its pixels. Pages stream as tiles, watermarked server-side, after access is verified.</p>
      <div class="cta-row">
        <a class="btn btn-primary" href="/dashboard/">Open dashboard</a>
        <a class="btn btn-ghost" href="/docs">API reference</a>
      </div>
    </div>
  </section>

  <section class="stats" id="stats" aria-label="Deployment totals">
    <div class="wrap stats-grid">
      <div class="stat">
        <span class="stat-value is-loading" data-stat="documents"></span>
        <span class="stat-label">Documents uploaded</span>
      </div>
      <div class="stat">
        <span class="stat-value is-loading" data-stat="views"></span>
        <span class="stat-label">View sessions</span>
      </div>
      <div class="stat">
        <span class="stat-value is-loading" data-stat="viewers"></span>
        <span class="stat-label">Identified viewers</span>
      </div>
    </div>
  </section>

  <section class="section" id="architecture">
    <div class="wrap">
      <h2>How it is put together</h2>
      <p class="section-lede">One Hono API serves the dashboard, the viewer and the public links from a single origin. Rendering and protection happen on the server, and the browser only ever receives tiles.</p>

      <div class="flow">
        <div class="flow-step">
          <h3>Upload</h3>
          <p>A document or video arrives through the dashboard or the API, with expiry, view limits and an optional gate attached to the link.</p>
        </div>
        <div class="flow-arrow" aria-hidden="true">&rarr;</div>
        <div class="flow-step">
          <h3>Render and watermark</h3>
          <p>Poppler, LibreOffice or FFmpeg produce the pages, and the viewer's identity is composited into the pixels before anything is stored.</p>
        </div>
        <div class="flow-arrow" aria-hidden="true">&rarr;</div>
        <div class="flow-step">
          <h3>Stream as tiles</h3>
          <p>The tile server slices 512px tiles out of the watermarked page and seals every frame with AES-256-GCM.</p>
        </div>
        <div class="flow-arrow" aria-hidden="true">&rarr;</div>
        <div class="flow-step">
          <h3>View on canvas</h3>
          <p>The browser decrypts and paints to a canvas. It is never handed a page URL, and nothing is written to the DOM as text.</p>
        </div>
      </div>

      <ul class="arch-notes">
        <li><strong>Monorepo</strong> on pnpm workspaces and Turborepo: apps/api (Hono), apps/web (React dashboard), apps/viewer (canvas viewer), apps/site (Astro).</li>
        <li><strong>Single origin</strong>: the API serves the dashboard at /dashboard, the viewer at /v, and public links at /s/&lt;id&gt;.</li>
        <li><strong>Data</strong>: PostgreSQL through Drizzle. <strong>Storage</strong>: any S3-compatible bucket such as R2, MinIO, B2 or S3.</li>
        <li><strong>Rendering</strong>: Poppler and Sharp for PDF and images, LibreOffice for Office formats, FFmpeg for HLS video.</li>
        <li><strong>Published packages</strong>: @cloakshare/viewer (Web Component), @cloakshare/react, and Node.js, Python and Go SDKs.</li>
        <li><strong>Background workers</strong>: rendering, webhooks, audit retention, watermark cleanup and backups, started with the server.</li>
      </ul>
    </div>
  </section>

  <section class="section" id="features">
    <div class="wrap">
      <h2>Features</h2>

      <div class="groups">

        <div class="group">
          <h3>Secure delivery</h3>
          <ul>
            <li><span class="item-name">Dynamic watermarks</span> <span class="item-desc">- email, date and session ID composited into the page pixels on the server, so they survive a screenshot.</span></li>
            <li><span class="item-name">Tiled viewer</span> <span class="item-desc">- pages are never sent whole. The viewer requests only the 512px region it is displaying.</span></li>
            <li><span class="item-name">Encrypted tile stream</span> <span class="item-desc">- RSA-2048 key wrap with AES-256-GCM frames, monotonic nonce and replay protection.</span></li>
            <li><span class="item-name">Fail-closed watermarking</span> <span class="item-desc">- if a watermarked page cannot be produced the request fails, rather than serving a clean page.</span></li>
            <li><span class="item-name">Canvas rendering</span> <span class="item-desc">- no DOM text, no page URL, and no download path handed to the browser.</span></li>
          </ul>
        </div>

        <div class="group">
          <h3>Access control</h3>
          <ul>
            <li><span class="item-name">Email gate</span> <span class="item-desc">- viewers identify themselves before a link opens, verified server-side.</span></li>
            <li><span class="item-name">Password protection</span> <span class="item-desc">- a shared password on top of the link, verified server-side.</span></li>
            <li><span class="item-name">Viewer groups</span> <span class="item-desc">- named cohorts where each member signs in with a student ID and national ID.</span></li>
            <li><span class="item-name">Per-link access</span> <span class="item-desc">- switch any link between public and restricted to one group.</span></li>
            <li><span class="item-name">Expiry</span> <span class="item-desc">- from one hour to one year, or on a fixed date.</span></li>
            <li><span class="item-name">View limits</span> <span class="item-desc">- cap the number of view sessions, with a webhook when the cap is reached.</span></li>
            <li><span class="item-name">Disable and re-enable</span> <span class="item-desc">- pause a link without revoking it, and resume with its expiry intact.</span></li>
          </ul>
        </div>

        <div class="group">
          <h3>Viewer</h3>
          <ul>
            <li><span class="item-name">Zoom</span> <span class="item-desc">- buttons, Ctrl or Cmd with the wheel, and keyboard shortcuts, from 0.5x to 4x.</span></li>
            <li><span class="item-name">Keyboard navigation</span> <span class="item-desc">- arrow keys plus Home and End, with a page field that accepts a number.</span></li>
            <li><span class="item-name">Fast paging</span> <span class="item-desc">- a per-page loading state and two pages of preload, so turning a page is instant.</span></li>
            <li><span class="item-name">Video player</span> <span class="item-desc">- HLS adaptive streaming with a watermark overlay, quality switch and fullscreen.</span></li>
            <li><span class="item-name">Themes</span> <span class="item-desc">- light and dark, following the operating system by default.</span></li>
            <li><span class="item-name">Capture guards</span> <span class="item-desc">- right-click, drag and text selection are blocked, print is hidden, and a blur layer covers the page when the window loses focus.</span></li>
          </ul>
        </div>

        <div class="group">
          <h3>Platform</h3>
          <ul>
            <li><span class="item-name">Per-page analytics</span> <span class="item-desc">- pages read, time on each page, scroll depth, completion rate, device and location.</span></li>
            <li><span class="item-name">Webhooks</span> <span class="item-desc">- eight events with HMAC-SHA256 signed payloads.</span></li>
            <li><span class="item-name">Dashboard upload</span> <span class="item-desc">- drag and drop with progress, expiry and view limits.</span></li>
            <li><span class="item-name">Office and video support</span> <span class="item-desc">- DOCX, PPTX and XLSX through LibreOffice, MP4, MOV and WebM through FFmpeg.</span></li>
            <li><span class="item-name">Embeddable viewer</span> <span class="item-desc">- a Web Component that drops into React, Vue, Svelte, Angular or plain HTML.</span></li>
            <li><span class="item-name">SDKs</span> <span class="item-desc">- Node.js, Python and Go, plus a React wrapper.</span></li>
            <li><span class="item-name">REST API</span> <span class="item-desc">- full link, group, webhook and analytics API with an OpenAPI document and a reference at /docs.</span></li>
            <li><span class="item-name">Teams and roles</span> <span class="item-desc">- organisations, members, invites and per-team ownership of links.</span></li>
            <li><span class="item-name">Custom domains</span> <span class="item-desc">- serve shared links from your own hostname.</span></li>
            <li><span class="item-name">Audit log</span> <span class="item-desc">- a record of access and administrative events, with retention cleanup.</span></li>
            <li><span class="item-name">Real-time notifications</span> <span class="item-desc">- an SSE stream and dashboard notifications the moment a link is opened.</span></li>
            <li><span class="item-name">GDPR deletion</span> <span class="item-desc">- erase everything held about one viewer by email.</span></li>
            <li><span class="item-name">Self-hosting</span> <span class="item-desc">- Docker, MIT License, and a single server with 1 GB of RAM.</span></li>
          </ul>
        </div>

      </div>

      <p class="formats">
        <span>Supported formats</span> - Documents: PDF, DOCX, PPTX, XLSX, ODP, ODS, ODT, CSV. Video: MP4, MOV, WebM, MKV, AVI. Images: PNG, JPG, WebP, GIF, BMP, SVG.
      </p>
    </div>
  </section>

  <section class="section" id="protections">
    <div class="wrap">
      <p class="eyebrow">Content protection</p>
      <h2>What stops a download or a reshare</h2>
      <p class="section-lede">The browser is never given the file. This is the full chain, from the request to the pixels.</p>

      <div class="groups">

        <div class="group">
          <h3>Delivery</h3>
          <ul>
            <li><span class="item-name">No whole pages</span> <span class="item-desc">- the viewer asks for the region it is showing over a WebSocket, and the server slices those tiles out of the watermarked page.</span></li>
            <li><span class="item-name">No page URL</span> <span class="item-desc">- the client never receives a page image URL, the source file, or a download link. Downloads are blocked per link by default.</span></li>
            <li><span class="item-name">Per-session budgets</span> <span class="item-desc">- 60 new tiles and 3 new pages per minute, and re-reading already-loaded pages is free. Scraping a document costs far more requests than reading it.</span></li>
            <li><span class="item-name">Encrypted frames</span> <span class="item-desc">- every tile is sealed with AES-256-GCM under a session key wrapped to an RSA-2048 key generated in the browser. Page geometry is encrypted with the pixels.</span></li>
            <li><span class="item-name">Fail closed</span> <span class="item-desc">- if the watermarked page cannot be produced, the request fails instead of falling back to clean pages.</span></li>
            <li><span class="item-name">Signed video segments</span> <span class="item-desc">- HLS segments are served through short-lived signed URLs.</span></li>
          </ul>
        </div>

        <div class="group">
          <h3>Identity and access</h3>
          <ul>
            <li><span class="item-name">Attribution in the pixels</span> <span class="item-desc">- the viewer's identity is composited server-side, so it survives a screenshot and cannot be removed with DevTools.</span></li>
            <li><span class="item-name">Server-side verification</span> <span class="item-desc">- email, password and group credentials are checked before any page data is served.</span></li>
            <li><span class="item-name">Hashed credentials</span> <span class="item-desc">- group national IDs are stored as bcrypt hashes and are never returned by the API.</span></li>
            <li><span class="item-name">Enforced lifecycle</span> <span class="item-desc">- expiry, view limits and disable are checked on every content path, including for sessions that were already issued.</span></li>
          </ul>
        </div>

        <div class="group">
          <h3>Browser hardening</h3>
          <ul>
            <li><span class="item-name">Screen capture API blocked</span> <span class="item-desc">- viewer routes send Permissions-Policy: display-capture=(), which refuses getDisplayMedia.</span></li>
            <li><span class="item-name">No framing</span> <span class="item-desc">- viewer routes send X-Frame-Options: DENY and a Content-Security-Policy with frame-ancestors 'none'.</span></li>
            <li><span class="item-name">No right-click or drag</span> <span class="item-desc">- the context menu and dragstart are cancelled and text selection is disabled on the canvas.</span></li>
            <li><span class="item-name">No printing</span> <span class="item-desc">- print styles hide the page instead of laying it out.</span></li>
            <li><span class="item-name">Capture guards</span> <span class="item-desc">- PrintScreen, a hidden tab and a fullscreen exit are detected, and a blur layer covers the page while the window is not being looked at.</span></li>
            <li><span class="item-name">Rate limiting</span> <span class="item-desc">- viewer endpoints are limited by IP.</span></li>
          </ul>
        </div>

        <div class="group">
          <h3>Accountability</h3>
          <ul>
            <li><span class="item-name">Audit log</span> <span class="item-desc">- access and administrative events are recorded for later review.</span></li>
            <li><span class="item-name">Webhook alerts</span> <span class="item-desc">- your systems are notified on creation, first view, expiry, revocation, view-limit and password failures.</span></li>
            <li><span class="item-name">Per-viewer analytics</span> <span class="item-desc">- who opened a link, from where, which pages they read and for how long.</span></li>
          </ul>
        </div>

      </div>

      <div class="callout">
        <h3>What this cannot do</h3>
        <p>An operating system screenshot, a screen recording, or a determined client cannot be blocked from a browser, because the code that decrypts and paints the page runs on the viewer's own machine. The durable defence is attribution: the viewer's identity is in the pixels of every page they see, so a leak can be traced back to the session that leaked it. Treat the rest of this list as cost-raising, not prevention.</p>
      </div>
    </div>
  </section>

</main>

<footer class="site-foot">
  <div class="wrap foot-inner">
    <div>
      <p class="foot-title">Scrinium</p>
      <p class="foot-note">Open-source secure document and video sharing. MIT License.</p>
    </div>
    <div class="cta-row" style="margin-top:0">
      <a class="btn btn-primary" href="/dashboard/">Open dashboard</a>
      <a class="btn btn-ghost" href="/docs">API reference</a>
    </div>
  </div>
</footer>

<script>
/*
 * Theme toggle, and the morph between Lucide's Sun and Moon.
 *
 * morphicons is a build-time dependency of the dashboard and is not reachable from this page, so
 * the two icons are interpolated here instead: both paths are sampled with the browser's own
 * getPointAtLength, the loops are aligned, and the morph lerps between the two point lists. The
 * path data below is Lucide 1.52's Sun circle and Moon, unchanged.
 */
(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var KEY = 'scrinium-theme';
  var SUN = 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8Z';
  var MOON = 'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401';
  var SAMPLES = 96;
  var DURATION = 380;

  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  var path = document.querySelector('.theme-morph');
  if (!btn || !path) return;

  function sample(d) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
    var probe = document.createElementNS(NS, 'path');
    probe.setAttribute('d', d);
    svg.appendChild(probe);
    document.body.appendChild(svg);
    var total = probe.getTotalLength();
    var points = [];
    for (var i = 0; i < SAMPLES; i++) {
      var point = probe.getPointAtLength((i / SAMPLES) * total);
      points.push([point.x, point.y]);
    }
    document.body.removeChild(svg);
    return points;
  }

  function signedArea(points) {
    var sum = 0;
    for (var i = 0; i < points.length; i++) {
      var a = points[i];
      var b = points[(i + 1) % points.length];
      sum += a[0] * b[1] - b[0] * a[1];
    }
    return sum;
  }

  /* Two closed loops only morph cleanly when they run the same way and start in the same place.
     Match the winding, then rotate the second loop so it begins nearest the first. */
  function align(a, b) {
    var loop = signedArea(a) * signedArea(b) < 0 ? b.slice().reverse() : b.slice();
    var best = 0;
    var bestDistance = Infinity;
    for (var i = 0; i < loop.length; i++) {
      var dx = loop[i][0] - a[0][0];
      var dy = loop[i][1] - a[0][1];
      var distance = dx * dx + dy * dy;
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    }
    return loop.slice(best).concat(loop.slice(0, best));
  }

  var sun = sample(SUN);
  var moon = align(sun, sample(MOON));
  var value = 0;
  var frame = 0;

  function draw(t) {
    var d = '';
    for (var i = 0; i < SAMPLES; i++) {
      var x = moon[i][0] + (sun[i][0] - moon[i][0]) * t;
      var y = moon[i][1] + (sun[i][1] - moon[i][1]) * t;
      d += (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
    }
    path.setAttribute('d', d + 'Z');
    value = t;
  }

  function animateTo(target) {
    cancelAnimationFrame(frame);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(target);
      return;
    }
    var from = value;
    var start = performance.now();
    function step(now) {
      var progress = Math.min(1, (now - start) / DURATION);
      /* easeOutCubic: quartic was so front-loaded that the morph was over before it registered. */
      draw(from + (target - from) * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }

  function theme() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function relabel() {
    var next = theme() === 'dark' ? 'light' : 'dark';
    btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    btn.setAttribute('title', 'Switch to ' + next + ' theme');
  }

  draw(theme() === 'light' ? 1 : 0);
  relabel();

  btn.addEventListener('click', function () {
    var next = theme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* storage blocked */ }
    relabel();
    animateTo(next === 'light' ? 1 : 0);
  });
})();
</script>

<script>
(function () {
  var slots = document.querySelectorAll('[data-stat]');

  function setStat(name, value) {
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].getAttribute('data-stat') !== name) continue;
      slots[i].textContent = value.toLocaleString('en-US');
      slots[i].classList.remove('is-loading');
    }
  }

  fetch('/v1/public/stats', { headers: { accept: 'application/json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('stats request failed');
      return res.json();
    })
    .then(function (body) {
      var data = (body && body.data) || {};
      setStat('documents', Number(data.documents) || 0);
      setStat('views', Number(data.views) || 0);
      setStat('viewers', Number(data.viewers) || 0);
    })
    .catch(function () {
      for (var i = 0; i < slots.length; i++) {
        slots[i].textContent = 'unavailable';
        slots[i].classList.remove('is-loading');
        slots[i].classList.add('is-error');
      }
    });
})();
</script>

</body>
</html>`;

landingRouter.get('/', (c) => c.html(LANDING_HTML));

export default landingRouter;
