import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { proxy } from 'hono/proxy';
import { randomBytes } from 'crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { AppError, errorResponse } from './lib/errors.js';
import { initSentry, captureRequestError } from './lib/sentry.js';
import type { Variables } from './lib/types.js';

// Initialize Sentry before anything else
initSentry();

// Middleware
import { apiVersionHeader, unknownVersionHandler } from './middleware/versioning.js';
import { orgResolver } from './middleware/orgResolver.js';
import { rateLimitByIp } from './middleware/rateLimit.js';

// Routes
import health from './routes/health.js';
import auth from './routes/auth.js';
import linksRouter from './routes/links.js';
import viewsRouter from './routes/views.js';
import webhooksRouter from './routes/webhooks.js';
import billingRouter from './routes/billing.js';
import domainsRouter from './routes/domains.js';
import gdprRouter from './routes/gdpr.js';
import embedRouter from './routes/embed.js';
import teamsRouter from './routes/teams.js';
import groupsRouter from './routes/groups.js';
import auditRouter from './routes/audit.js';
import notificationsRouter from './routes/notifications.js';
import demoRouter from './routes/demo.js';
import docsRouter from './routes/docs.js';

// Workers
import { startRenderWorker, stopRenderWorker } from './workers/renderer.js';
import { startWebhookWorker, stopWebhookWorker } from './workers/webhooks.js';
import { startAuditRetentionWorker, stopAuditRetentionWorker } from './workers/auditRetention.js';
import { startWatermarkCleaner, stopWatermarkCleaner } from './workers/watermarkCleaner.js';
import { startBackupWorker, stopBackupWorker } from './workers/backup.js';

// Secure viewer tile stream (WebSocket)
import { attachTileServer } from './services/tileServer.js';
import type { Server as HttpServer } from 'node:http';

const app = new Hono<{ Variables: Variables }>();

// ============================================
// GLOBAL MIDDLEWARE
// ============================================

// Compression
app.use('*', compress());

// CORS — viewer endpoints allow any origin (token auth, not cookies)
app.use('/v1/viewer/*', cors({
  origin: config.isDev
    ? '*'
    : config.embedAllowedOrigins.includes('*')
      ? '*'
      : config.embedAllowedOrigins,
  allowHeaders: ['Content-Type', 'X-Session-Token', 'X-Request-Id'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

app.use('/v1/time', cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
}));

// CORS — default for all other routes
// Note: with `credentials: true` the wildcard origin is invalid per the CORS spec —
// browsers reject `Access-Control-Allow-Origin: *` combined with
// `Access-Control-Allow-Credentials: true`. So in dev we reflect the request origin.
app.use('*', cors({
  origin: config.isDev
    ? (origin: string) => origin || '*'
    : [config.apiUrl, ...config.corsOrigins],
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Token', 'X-Org-Id', 'X-Request-Id'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// Global security headers
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-DNS-Prefetch-Control', 'off');
  c.header('X-Download-Options', 'noopen');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (config.isProd) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Request correlation ID + logging
app.use('*', async (c, next) => {
  const requestId = c.req.header('X-Request-Id') || randomBytes(8).toString('hex');
  c.header('X-Request-Id', requestId);

  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info({
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms,
  }, `${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});

// Security headers for viewer routes. The viewer SPA is served under /v (the app mount) and
// /s (the public share links the API generates, e.g. /s/<linkId>), so both need the same hardening.
const viewerSecurityHeaders = async (c: Context, next: () => Promise<void>) => {
  await next();
  c.header('Permissions-Policy', 'display-capture=()');
  c.header('X-Frame-Options', 'DENY');
  // SPA-friendly CSP: allow the app's own bundled scripts/styles (served from /v on the
  // same origin) and block framing. The restrictive 'script-src none' from the old
  // server-rendered viewer would break the Vite SPA, so we scope it to 'self'.
  // In development the page is served from :3000 while the Vite dev server (and therefore
  // the HMR websocket) lives on another port, so connect-src is widened for localhost.
  c.header(
    'Content-Security-Policy',
    config.isProd
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'"
      : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'",
  );
};
app.use('/v/s/*', viewerSecurityHeaders);
app.use('/s/*', viewerSecurityHeaders);

app.use('/embed/*', async (c, next) => {
  await next();
  c.header('Permissions-Policy', 'display-capture=()');
});

// API version header on all responses
app.use('*', apiVersionHeader);

// Org resolution for authenticated API routes
app.use('/v1/*', orgResolver);

// ============================================
// RATE LIMITING — AUTH ENDPOINTS
// ============================================

// Strict IP-based rate limiting for auth to prevent brute-force
app.use('/v1/auth/login', rateLimitByIp({ max: 10, window: 60 }));
app.use('/v1/auth/register', rateLimitByIp({ max: 5, window: 60 }));

// Rate limiting for viewer endpoints (embedded <cloak-viewer> component)
app.use('/v1/viewer/:token', rateLimitByIp({ max: 100, window: 60 }));
app.use('/v1/viewer/:token/page/*', rateLimitByIp({ max: 100, window: 60 }));
app.use('/v1/viewer/:token/sign-segment', rateLimitByIp({ max: 60, window: 60 }));
app.use('/v1/viewer/:token/track', rateLimitByIp({ max: 60, window: 60 }));
app.use('/v1/time', rateLimitByIp({ max: 30, window: 60 }));

// ============================================
// ROUTES
// ============================================

// Health check
app.route('/', health);

// Auth (registration, login, API keys)
app.route('/v1/auth', auth);

// Links (CRUD + analytics)
app.route('/', linksRouter);

// Viewer endpoints (metadata, verify, track)
app.route('/', viewsRouter);

// Webhooks
app.route('/', webhooksRouter);

// Billing (Stripe)
app.route('/', billingRouter);

// Custom domains
app.route('/', domainsRouter);

// GDPR data deletion
app.route('/', gdprRouter);

// Embedded viewer
app.route('/', embedRouter);

// Teams & org management
app.route('/', teamsRouter);

// Viewer groups & credentials (restricted link access)
app.route('/', groupsRouter);

// Audit log
app.route('/', auditRouter);

// Notifications
app.route('/', notificationsRouter);

// Demo (marketing site live demo)
app.route('/', demoRouter);

// API docs (OpenAPI spec + Scalar reference)
app.route('/', docsRouter);

// Internal file serving for local storage mode
if (config.storage.provider === 'local') {
  app.get('/internal/files/*', async (c) => {
    const key = c.req.path.replace('/internal/files/', '');
    // Block path traversal attempts
    if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Invalid path' } }, 403);
    }
    try {
      const { createStorage } = await import('./services/storage.js');
      const storage = createStorage();
      const data = await storage.download(key);
      const ext = key.split('.').pop()?.toLowerCase();
      const contentType = ext === 'webp' ? 'image/webp'
        : ext === 'png' ? 'image/png'
        : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'm3u8' ? 'application/vnd.apple.mpegurl'
        : ext === 'ts' ? 'video/mp2t'
        : 'application/octet-stream';
      return new Response(new Uint8Array(data), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=300',
        },
      });
    } catch {
      return c.json({ error: { code: 'NOT_FOUND', message: 'File not found' } }, 404);
    }
  });
}

// Unknown API versions — catch /v{N}/* where N != 1
app.all('/v:version{[0-9]+}/*', (c) => {
  const version = c.req.param('version');
  if (version !== '1') {
    return unknownVersionHandler(c);
  }
  // Fall through to 404 for valid version prefix but unknown endpoint
  return c.json(
    { data: null, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
    404,
  );
});

// ============================================
// ERROR HANDLING
// ============================================

app.onError((err, c) => {
  if (err instanceof AppError) {
    return errorResponse(c, err);
  }

  const requestId = c.res.headers.get('X-Request-Id') || undefined;
  captureRequestError(err, {
    method: c.req.method,
    path: c.req.path,
    requestId,
  });
  logger.error({ err }, 'Unhandled error');
  return c.json(
    { data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    { data: null, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } },
    404,
  );
});

// ============================================
// DEV GATEWAY — one origin (:3000) for the whole app
// In development the dashboard and viewer are served by their own Vite dev servers so HMR
// works. Instead of making the developer open two extra ports, the API proxies /dashboard/*
// and /v/* to those servers: http://localhost:3000 is the only URL that ever needs to be
// opened. Disabled in production, where the built SPAs are served from apps/api/public.
// Registered before the static handlers so it takes precedence in development.
// ============================================
if (config.devProxy) {
  const upstreams: Array<{
    prefix: string;
    port: number;
    packageName: string;
    // Optional path rewrite applied before proxying. The public share links live at /s/<id>,
    // but the viewer Vite server serves everything under its /v base, so /s/<id> -> /v/s/<id>.
    rewritePath?: (path: string) => string;
  }> = [
    { prefix: '/dashboard', port: config.devServers.dashboardPort, packageName: '@cloak/web' },
    { prefix: '/v', port: config.devServers.viewerPort, packageName: '@cloak/viewer' },
    {
      prefix: '/s',
      port: config.devServers.viewerPort,
      packageName: '@cloak/viewer',
      rewritePath: (p) => `/v${p}`,
    },
  ];

  for (const { prefix, port, packageName, rewritePath } of upstreams) {
    const forward = async (c: Context) => {
      const target = new URL(c.req.url);
      target.protocol = 'http:';
      target.hostname = '127.0.0.1';
      target.port = String(port);
      if (rewritePath) target.pathname = rewritePath(target.pathname);

      try {
        return await proxy(target.toString(), { raw: c.req.raw });
      } catch {
        // The Vite dev server is not running (e.g. the API was started on its own).
        // Say so explicitly rather than returning an empty page.
        logger.warn({ packageName, port }, `Dev proxy target unreachable: ${packageName} on port ${port}`);
        return c.html(
          `<!doctype html><html><body style="font-family:system-ui;padding:2rem;max-width:40rem">` +
            `<h1>${packageName} dev server is not running</h1>` +
            `<p>Nothing is listening on <code>127.0.0.1:${port}</code>.</p>` +
            `<p>Start the full stack with <code>pnpm dev</code> (or <code>pnpm --filter ${packageName} dev</code>), ` +
            `then reload this page.</p></body></html>`,
          503,
        );
      }
    };

    app.all(prefix, forward);
    app.all(`${prefix}/*`, forward);
  }
}

// ============================================
// STATIC FRONTEND HOSTING (dashboard + viewer)
// Served from the same origin so there are no cross-origin calls. At image build time the
// built dashboard/viewer are copied into apps/api/public/{dashboard,viewer}. Paths resolve
// relative to this module file, so they work regardless of the process CWD.
// ============================================
const staticRoot = (sub: string) =>
  fileURLToPath(new URL(`../public/${sub}`, import.meta.url));

let dashboardIndex = '';
let viewerIndex = '';
try {
  dashboardIndex = readFileSync(fileURLToPath(new URL('../public/dashboard/index.html', import.meta.url)), 'utf-8');
} catch {
  dashboardIndex = '';
}
try {
  viewerIndex = readFileSync(fileURLToPath(new URL('../public/viewer/index.html', import.meta.url)), 'utf-8');
} catch {
  viewerIndex = '';
}

// Root → dashboard
app.get('/', (c) => c.redirect('/dashboard/', 302));

// Dashboard SPA (Vite base /dashboard/). Only registered when a build is present, so the
// dev gateway (or the 404 handler) takes over cleanly instead of serveStatic logging
// "root path not found" on every start.
if (dashboardIndex) {
  app.use('/dashboard/*', serveStatic({
    root: staticRoot('dashboard'),
    rewriteRequestPath: (p) => p.replace(/^\/dashboard/, '') || '/',
  }));
  app.get('/dashboard/*', (c) => c.html(dashboardIndex));
  app.get('/dashboard', (c) => c.redirect('/dashboard/', 302));
} else if (!config.devProxy) {
  logger.warn('No dashboard build found in apps/api/public/dashboard — run `pnpm build` or set DEV_PROXY=true.');
}

// Viewer SPA (Vite base /v/). Served at /v (the app mount) and at /s (the public share links
// the API generates — `${viewerUrl}/s/<linkId>`). The SPA reads the id from the trailing
// /s/<id> segment, so both mounts resolve to the same view. Bundled assets are referenced from
// /v (the Vite base), which the /v/* handler below serves.
if (viewerIndex) {
  app.use('/v/*', serveStatic({
    root: staticRoot('viewer'),
    rewriteRequestPath: (p) => p.replace(/^\/v/, '') || '/',
  }));
  app.get('/v/*', (c) => c.html(viewerIndex));
  app.get('/v', (c) => c.redirect('/v/', 302));

  // Public share route: /s/<linkId>
  app.get('/s/*', (c) => c.html(viewerIndex));
} else if (!config.devProxy) {
  logger.warn('No viewer build found in apps/api/public/viewer — run `pnpm build` or set DEV_PROXY=true.');
}

// ============================================
// START SERVER
// ============================================

if (!process.env.VITEST) {
  const port = config.port;

  logger.info({
    port,
    mode: config.mode,
    storage: config.storage.provider,
    database: config.database.provider,
  }, `Cloak API starting on port ${port}`);

  const server = serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    logger.info(`Cloak API listening on http://localhost:${info.port}`);

    // Start background workers
    startRenderWorker();
    startWebhookWorker();
    startAuditRetentionWorker();
    startWatermarkCleaner();
    startBackupWorker();
  });

  // Attach the WebSocket tile stream the secure viewer uses instead of whole-page images.
  attachTileServer(server as unknown as HttpServer);

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down gracefully...');
    stopRenderWorker();
    stopWebhookWorker();
    stopAuditRetentionWorker();
    stopWatermarkCleaner();
    stopBackupWorker();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    // Force exit after 10s if graceful shutdown stalls
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;
