import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

// The repo-root .env is the single source of truth for local development. Vite's default
// envDir is this app's own folder, which would silently ignore the root file — that is why
// editing PORT/VIEWER_DEV_PORT in the root .env previously had no effect here.
const repoRoot = resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const port = Number(env.VIEWER_DEV_PORT || process.env.VIEWER_DEV_PORT || 5173);

  return {
    envDir: repoRoot,
    base: env.VITE_APP_BASE || process.env.VITE_APP_BASE || '/v/',
    server: {
      // Internal port only. The developer never opens this directly: the API proxies
      // /v/* here so the whole app is reachable at http://localhost:3000.
      port,
      // Bind IPv4 loopback explicitly. Vite's default ("localhost") can resolve to ::1
      // only, which the API's IPv4 proxy target then cannot reach.
      host: '127.0.0.1',
      // Fail loudly instead of silently drifting to another port when the port is taken.
      strictPort: true,
      // The page is served from :3000, so the HMR websocket has to be told to reach this
      // dev server explicitly instead of assuming it lives on the page's origin.
      hmr: { host: '127.0.0.1', clientPort: port },
    },
    build: {
      outDir: 'dist',
    },
  };
});
