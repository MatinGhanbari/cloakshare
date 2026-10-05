# CloakShare — Secure Document & Video Sharing API

Open-source API and embeddable viewer for sharing documents and videos with watermarks, email gates, expiry, and per-page analytics.

[![MIT License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![GitHub Stars](https://img.shields.io/github/stars/cloakshare/cloakshare?style=flat&color=orange)](https://github.com/cloakshare/cloakshare/stargazers) [![Tests](https://img.shields.io/github/actions/workflow/status/cloakshare/cloakshare/ci.yml?label=tests)](https://github.com/cloakshare/cloakshare/actions) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

---

## What CloakShare Does

**Secure document sharing** — Turn any PDF, DOCX, PPTX, or image into a tracked, watermarked link. Know who viewed it, which pages they read, and how long they spent.

**Secure video sharing** — Share MP4, MOV, and WebM videos with dynamic watermarks, email gates, and engagement analytics. HLS adaptive streaming for large files.

**Embeddable document viewer** — Drop a secure viewer into any web app with one line of code. Watermarks, email gates, and password protection built in. No iframe, no external redirect. Works in React, Vue, Svelte, Angular, and vanilla HTML.

**Document analytics API** — Per-page view tracking, time-on-page, scroll depth, viewer email, device, location. Webhooks for real-time notifications on 8 event types with HMAC-SHA256 signed payloads.

**Open-source alternative to DocSend** — Self-host with Docker (MIT license) or use the managed cloud API. No per-user pricing. Free tier available.

---

## Quick Start

### API

```bash
# Create a secure link
curl -X POST https://api.cloakshare.dev/v1/links \
  -H "Authorization: Bearer ck_live_your_api_key" \
  -F file=@pitch-deck.pdf \
  -F require_email=true \
  -F watermark=true \
  -F expires_in=7d

# Response:
# {
#   "data": {
#     "id": "lnk_xK9mP2",
#     "secure_url": "https://view.cloakshare.dev/s/xK9mP2",
#     "status": "processing",
#     "file_type": "pdf"
#   }
# }
```

Get your free API key at [cloakshare.dev](https://cloakshare.dev).

### Embeddable Viewer

```bash
npm install @cloakshare/viewer
```

```html
<script src="https://unpkg.com/@cloakshare/viewer"></script>

<!-- Free — PDF & images, no API key needed -->
<cloak-viewer src="/deck.pdf" watermark="Confidential" email-gate></cloak-viewer>

<!-- With API key — adds Office docs, video, server-side analytics -->
<cloak-viewer src="/proposal.docx" api-key="ck_live_..." watermark="{{email}}"></cloak-viewer>
```

### React

```bash
npm install @cloakshare/react
```

```jsx
import { CloakViewer } from '@cloakshare/react';

function App() {
  return (
    <CloakViewer
      src="/pitch-deck.pdf"
      watermark="Confidential · {{email}}"
      emailGate
      onView={(e) => console.log('Viewed page:', e.page)}
    />
  );
}
```

### Node.js SDK

```bash
npm install @cloakshare/sdk
```

```typescript
import CloakShare from '@cloakshare/sdk';

const cloakshare = new CloakShare('ck_live_your_api_key');

const link = await cloakshare.links.create({
  file: './pitch-deck.pdf',
  requireEmail: true,
  watermark: true,
  expiresIn: '7d',
});

console.log(link.secure_url);
// → https://view.cloakshare.dev/s/xK9mP2
```

### Python

```bash
pip install cloakshare
```

```python
import cloakshare

client = cloakshare.Client("ck_live_your_api_key")

link = client.links.create(
    file="./pitch-deck.pdf",
    require_email=True,
    watermark=True,
    expires_in="7d",
)

print(link.secure_url)
# → https://view.cloakshare.dev/s/xK9mP2
```

### Go

```bash
go get github.com/cloakshare/cloakshare-go
```

```go
client := cloakshare.NewClient("ck_live_your_api_key")

link, _ := client.Links.Create(&cloakshare.LinkParams{
    File:         "./pitch-deck.pdf",
    RequireEmail: true,
    Watermark:    true,
    ExpiresIn:    "7d",
})

fmt.Println(link.SecureURL)
// → https://view.cloakshare.dev/s/xK9mP2
```

---

## Features

### Secure delivery

- **Dynamic watermarks** — Text overlay on every page with template variables: `{{email}}`, `{{date}}`, `{{session_id}}`. Composited **server-side into the page pixels**, so it survives a screenshot and is not removable via DevTools. Tile spacing is derived from the measured text size, so a long identity never overlaps and obscures the document.
- **Tiled secure viewer** — Pages are never sent as whole images. The viewer requests only the region it is displaying over a WebSocket, and the server slices those tiles out of the per-viewer watermarked page. Fixed 512px tiles, cached per viewer session, with per-session budgets that charge only *new* pages and *cache-miss* tiles — so re-reading is free while scraping a document costs far more requests than a human generates.
- **Encrypted transport** — The tile stream uses hybrid encryption. The client generates an ephemeral RSA-2048 key pair locally, the server returns a fresh random AES-256 session key wrapped to that public key, and every tile frame is sealed with AES-256-GCM under it (monotonic nonce, replay-protected, geometry hidden along with the image). Useful where the socket is not already protected by TLS or TLS is terminated by an intermediary you do not trust.
- **Fail-closed watermarking** — If a watermarked page cannot be produced, the request fails instead of falling back to clean pages. The security control never disables itself.
- **Print and download blocking** — Canvas-based rendering prevents easy copy/paste, printing, and downloading. The client is never handed a page URL.

### Access control

- **Viewer groups and credentials** — Build named groups of authorized viewers (e.g. a course cohort) where each member signs in with a **student ID (username) and national ID (password)**. National IDs are stored only as bcrypt hashes and are never returned by the API. A whole class list can be imported by pasting `studentId,nationalId[,name]` lines.
- **Per-link access control** — Switch any link between public (email-gated) and restricted to a specific group, from the link detail page or the API. On a restricted link the credential's student ID becomes the identity burned into the watermark.
- **Email gate** — Require viewers to identify themselves before accessing a public link. Verified server-side.
- **Password protection** — Lock documents behind a shared password. Server-side verification. Available on Starter plan and above.
- **Disable / enable** — Temporarily pause a link and resume it later without revoking it. A disabled link keeps its status and expiry, and is refused on every content path — metadata, verification, page images and the tile stream — including for sessions that were already issued.
- **Link expiry** — Set documents to expire after a duration (1 hour to 1 year) or on a specific date.
- **View limits** — Limit the number of times a link can be viewed. Webhook fired when limit reached.

### Viewer experience

- **Zoom** — Buttons, `Ctrl`/`Cmd` + wheel and keyboard shortcuts, 0.5×–4× on top of fit-to-width.
- **Per-page loading state** — A spinner covers the page area until its tiles arrive, so paging to an unloaded page never shows a blank canvas.
- **Adjacent-page preload** — The previous and next pages are fetched ahead of time, so paging back and forth is instant.

### Platform

- **Per-page analytics** — Track which pages were viewed, time on each page, scroll depth, and total engagement. Available on Starter plan and above.
- **Webhooks** — Real-time HTTP notifications with HMAC-SHA256 signatures. 8 events: `link.created`, `link.viewed`, `link.expired`, `link.revoked`, `link.ready`, `link.render_failed`, `link.max_views_reached`, `link.password_failed`.
- **Dashboard upload** — Drag-and-drop upload with progress, expiry and view limits, straight from the dashboard — the same flow the API accepts.
- **Video support** — MP4, MOV, WebM with HLS adaptive streaming, watermark overlay, and engagement heatmaps. Available on Growth plan and above. Requires FFmpeg.
- **Office document support** — DOCX, PPTX, XLSX rendered securely via server-side conversion. Available on Starter plan and above. Requires LibreOffice.
- **Embeddable viewer** — Web Component (`<cloak-viewer>`) that works in React, Vue, Svelte, Angular, and vanilla HTML. Free for PDF and images, no API key required.
- **Self-hostable** — Run CloakShare on your own infrastructure with Docker. MIT license. SQLite database, any S3-compatible storage.
- **REST API** — Full API for creating links, uploading files, checking analytics, managing webhooks, teams, viewer groups, and custom domains.
- **Node.js SDK** — `@cloakshare/sdk` with TypeScript types, automatic retries, and pagination helpers. Zero external dependencies.

### What this does and does not prevent

Being explicit, because the difference matters:

| Attack | Covered |
|---|---|
| Right-click / save image / download | ✅ The client only ever receives tiles, never a page URL |
| Automated scraping | 🟡 Bounded by per-session budgets and the tile protocol |
| Network eavesdropping on a plain `ws://` socket | ✅ AES-256-GCM transport encryption |
| Screenshot (OS capture, DevTools, screen recording) | ❌ Cannot be blocked from a browser |
| A determined client | ❌ The decrypting and compositing code runs in their browser |

The durable defence is **attribution**: the viewer's identity is burned into the pixels of every page they see, so a leak can be traced back to the account that leaked it. Treat the other measures as cost-raising, not prevention.

### Supported File Types

```
Documents:  PDF · DOCX · PPTX · XLSX · ODP · ODS · ODT · CSV
Video:      MP4 · MOV · WebM · MKV · AVI
Images:     PNG · JPG · WebP · GIF · BMP · SVG
```

One API, every format. CloakShare detects the file type and handles rendering and conversion automatically.

---

## Use Cases

### Fundraising and Investor Relations
Share pitch decks with investors and track which slides they read. Know if they forwarded your deck. Watermark each viewer's email on every page.

### Sales Proposals and Pricing
Send proposals that expire after 7 days. Get notified the moment a prospect opens your pricing page. See which sections they spent the most time on.

### Training and Education
Distribute course materials that cannot be easily downloaded or reshared. Create a **viewer group** per
course and import the class list — each student signs in with their student ID and national ID, so the
student ID is burned into the watermark on every page they open and any leak is traceable to them.
Pause a link between terms with disable/enable, and track completion and engagement per page.

### Legal and Compliance
Share contracts and NDAs with email-verified access. Audit trail of who viewed what, when, and from where. Password protection for sensitive documents.

### Real Estate
Share property documents, inspection reports, and appraisals with buyers. Each viewer sees their own watermarked copy. Links expire after the transaction closes.

### Healthcare
Share patient documents securely with access controls. Email-verified viewing, link expiry, and audit logs for compliance.

---

## CloakShare vs Alternatives

| Feature | CloakShare | DocSend | Papermark | PandaDoc |
|---------|-----------|---------|-----------|----------|
| Open source | MIT | No | AGPL | No |
| Self-hostable | Yes | No | Yes | No |
| API-first | Yes | Limited | Limited | Yes |
| Embeddable viewer | Yes | No | No | No |
| npm package | Yes | No | No | No |
| Dynamic watermarks | Yes | Yes | Yes | No |
| Watermark burned into pixels (survives screenshots) | Yes | Yes | Yes | No |
| Tiled viewer (no whole-page images sent) | Yes | No | No | No |
| Encrypted viewer transport | Yes | No | No | No |
| Per-viewer credentials (student ID / national ID) | Yes | No | No | No |
| Viewer groups | Yes | No | Yes | No |
| Disable / re-enable a link | Yes | Yes | Yes | Yes |
| Video support | Yes | Yes | No | No |
| Per-page analytics | Yes | Yes | Yes | Yes |
| Webhooks with HMAC | Yes | Yes | Yes | Yes |
| SDKs | Node.js, Python, Go | None | None | None |
| Teams and RBAC | Yes | Yes | Yes | Yes |
| Free tier | Yes | No | Yes | No |
| Starting price | Free / $29/mo | $45/user/mo | $59/mo | $35/user/mo |

---

## Tech Stack

- **Runtime:** Node.js + [Hono](https://hono.dev) (lightweight web framework)
- **Database:** SQLite via [Turso](https://turso.tech) (cloud) or local SQLite (self-hosted)
- **ORM:** [Drizzle](https://orm.drizzle.team)
- **Storage:** Cloudflare R2 / any S3-compatible (MinIO, AWS S3, Backblaze B2)
- **PDF rendering:** Poppler (`pdftoppm`) + Sharp
- **Office conversion:** LibreOffice headless
- **Video:** FFmpeg HLS transcoding (adaptive bitrate: 720p + 1080p)
- **Viewer:** Custom canvas-based renderer with Shadow DOM Web Component
- **Tile stream:** WebSocket (`ws`) serving 512px tiles sliced from the per-viewer watermarked page
- **Transport encryption:** Web Crypto on the client, Node `crypto` on the server — RSA-2048 OAEP key
  wrap + AES-256-GCM payloads
- **Dashboard:** React + Tailwind CSS
- **Marketing site:** [Astro](https://astro.build)
- **Monorepo:** pnpm workspaces + [Turborepo](https://turbo.build)

---

## Self-Hosting

```bash
git clone https://github.com/cloakshare/cloakshare.git
cd cloakshare
cp .env.example .env
# Edit .env: set SESSION_SECRET, JWT_SECRET, CLOAK_SIGNING_SECRET
docker compose up -d
```

Open `http://localhost:3000` — that's it. CloakShare runs on a single server with 1GB RAM.

The self-hosted version includes PDF rendering, office document conversion, video transcoding, email gates, viewer groups, watermarks, the tiled and encrypted secure viewer, webhooks, analytics, teams, and link disable/enable.

**Works with:** MinIO, AWS S3, Backblaze B2, Cloudflare R2, or any S3-compatible storage provider.

**Behind a reverse proxy:** the viewer uses a WebSocket, so the proxy must pass upgrade headers:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

Also note that the tile stream uses the Web Crypto API, which requires a **secure context** — serve the
viewer over HTTPS in production (localhost counts as secure for local development).

Full configuration guide: [Self-Hosting Guide](https://docs.cloakshare.dev/self-hosting)

---

## API Reference

```
POST   /v1/links                    Create a secure link (multipart file upload)
POST   /v1/links/upload-url         Get presigned upload URL (large files)
POST   /v1/links/bulk               Create multiple links at once
GET    /v1/links                    List your links (paginated, includes file name + state)
GET    /v1/links/:id                Get link details
GET    /v1/links/:id/analytics      Get per-page view analytics
GET    /v1/links/:id/progress       SSE stream for rendering progress
PATCH  /v1/links/:id/access         Restrict a link to a viewer group, or make it public
PATCH  /v1/links/:id/state          Temporarily disable / re-enable a link
DELETE /v1/links/:id                Revoke a link (permanent)

GET    /v1/groups                          List viewer groups
POST   /v1/groups                          Create a viewer group
PATCH  /v1/groups/:id                      Rename a group
DELETE /v1/groups/:id                      Delete a group
GET    /v1/groups/:id/credentials          List a group's authorized viewers
POST   /v1/groups/:id/credentials          Add one viewer (student ID + national ID)
POST   /v1/groups/:id/credentials/bulk     Bulk import (JSON array or pasted text block)
DELETE /v1/groups/:id/credentials/:credId  Remove a viewer

POST   /v1/webhooks                 Create a webhook endpoint
GET    /v1/webhooks                 List webhooks
GET    /v1/webhooks/:id             Get webhook details + delivery history
DELETE /v1/webhooks/:id             Delete a webhook

GET    /v1/viewer/:token            Get viewer metadata (gate type, group name)
POST   /v1/viewer/:token/verify     Verify access — email, or student ID + national ID
GET    /v1/viewer/:token/page/:num  Get a rendered page image (with watermark)
POST   /v1/viewer/:token/track      Track viewing engagement
WS     /v1/viewer/:token/stream     Encrypted tile stream for the secure viewer

GET    /v1/notifications/stream     SSE real-time view notifications
DELETE /v1/viewers/:email           GDPR data deletion
```

### Tile stream

The hosted viewer does not fetch page images. It opens `WS /v1/viewer/:token/stream?st=<session token>`
and requests viewports.

```
client → { type: "pubkey", key: "<base64 SPKI of an ephemeral RSA-2048 public key>" }
server → { type: "key", alg: "AES-256-GCM", wrapped_key: "<base64>", nonce_prefix: "<base64>" }
client → { type: "viewport", page: 1, rect: { x, y, w, h } }   // rect optional; omit for the whole page
server → { type: "page", page, pageWidth, pageHeight, cols, rows, tileSize }
server → binary frames: [8-byte BE counter][AES-256-GCM ciphertext || 16-byte tag]
server → { type: "done", page, sent }
```

Each sealed frame decrypts to `[4-byte BE header length][header JSON][webp bytes]`. The server refuses
viewport requests until the key exchange completes, and charges per-session budgets
(`TILE_RATE_LIMIT`, default 60 new tiles/min; `PAGE_RATE_LIMIT`, default 3 new pages/min).

Full API documentation: [docs.cloakshare.dev](https://docs.cloakshare.dev)

---

## Pricing

| Plan | Price | Links/mo | Views/mo |
|------|-------|----------|----------|
| Free | $0 | 50 | 500 |
| Starter | $29/mo | 500 | 10,000 |
| Growth | $99/mo | 2,500 | 25,000 |
| Scale | $299/mo | 10,000 | 100,000 |

The `@cloakshare/viewer` npm package is free forever for PDF and image viewing. No API key required.

Annual billing: 20% off. [See full pricing](https://cloakshare.dev/pricing)

---

## Project Structure

```
cloakshare/
├── apps/
│   ├── api/          # Hono API server
│   │   └── src/
│   │       ├── routes/groups.ts          # viewer groups & credentials
│   │       ├── services/watermarkRenderer.ts  # per-viewer watermark compositing
│   │       └── services/tileServer.ts    # encrypted WebSocket tile stream
│   ├── site/         # Astro marketing site
│   ├── web/          # React dashboard (Links, Upload, Groups, Link detail)
│   └── viewer/       # Secure document/video viewer
│       └── src/tiles.ts  # tile client + transport key exchange & decryption
├── packages/
│   ├── shared/       # Shared types, constants, config
│   ├── sdk-node/     # @cloakshare/sdk (Node.js SDK)
│   ├── sdk-python/   # Python SDK
│   ├── sdk-go/       # Go SDK
│   ├── viewer-core/  # @cloakshare/viewer (Web Component)
│   └── react/        # @cloakshare/react (React wrapper)
├── docker-compose.yml
├── .env.example
└── turbo.json
```

### Rendering dependencies

PDF rendering shells out to Poppler (`pdftoppm`, `pdfinfo`), Office conversion to LibreOffice, and
video transcoding to FFmpeg. The Docker image bundles all three; a local install needs them on `PATH`
or the corresponding request fails at render time (e.g. `spawn pdfinfo ENOENT`).

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/cloakshare/cloakshare.git
cd cloakshare
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` starts the API plus the dashboard and viewer dev servers. Everything is reachable
through a **single origin at `http://localhost:3000`** — the API proxies `/dashboard` and `/v`
to the Vite dev servers, so there is no need to open `:5173`/`:5174` yourself. The ports are
configured in the root `.env` (`PORT`, `DASHBOARD_DEV_PORT`, `VIEWER_DEV_PORT`).

The marketing site (`apps/site`) is a separate deployment and runs on its own port
(`SITE_DEV_PORT`, default `4321`).

Good first issues are labeled [`good first issue`](https://github.com/cloakshare/cloakshare/labels/good%20first%20issue).

---

## Links

- [Website](https://cloakshare.dev)
- [Documentation](https://docs.cloakshare.dev)
- [API Reference](https://docs.cloakshare.dev/api)
- [npm: @cloakshare/viewer](https://www.npmjs.com/package/@cloakshare/viewer)
- [npm: @cloakshare/react](https://www.npmjs.com/package/@cloakshare/react)
- [npm: @cloakshare/sdk](https://www.npmjs.com/package/@cloakshare/sdk)
- [Discord](https://discord.gg/cloakshare)
- [Twitter](https://twitter.com/cloakshare)

---

## License

MIT — use CloakShare however you want. Free forever for self-hosting.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=cloakshare/cloakshare&type=Date)](https://star-history.com/#cloakshare/cloakshare&Date)

---

## Also By Us

- **[AuditKit](https://github.com/AuditKitDev/auditkit)** — Open-source tamper-proof audit logging for B2B SaaS. SHA-256 hash chaining, Merkle proofs, SOC 2 exports. AGPLv3.
- **[SiteCrawlIQ](https://github.com/AuditKitDev/sitecrawliq)** — AI-powered SEO + GEO/AEO audit platform. Tracks AI citations across ChatGPT, Perplexity, Claude, and Gemini.
