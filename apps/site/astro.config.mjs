import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';

// The marketing site is a separate deployment from the app, so it keeps its own dev port
// (SITE_DEV_PORT). The repo-root .env is still the single source of truth for the port and
// for VITE_* build-time vars — Astro's default envDir would be this folder and would
// silently ignore the root file.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

try {
  process.loadEnvFile(`${repoRoot}/.env`);
} catch {
  // No root .env yet (fresh clone) — fall back to the defaults below.
}

export default defineConfig({
  site: 'https://cloakshare.dev',
  integrations: [tailwind(), sitemap()],
  output: 'static',
  vite: {
    envDir: repoRoot,
  },
  server: {
    port: Number(process.env.SITE_DEV_PORT || 4321),
    strictPort: true,
  },
});
