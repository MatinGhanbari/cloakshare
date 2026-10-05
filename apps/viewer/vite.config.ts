import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_APP_BASE || '/v/',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
