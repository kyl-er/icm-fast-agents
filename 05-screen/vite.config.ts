import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps every asset path relative, so dist/ works from any static server or subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: {
    port: 5190,
    strictPort: false,
    // In dev, /api goes to bin/serve. If it is not running the app falls back to public/traces.
    proxy: { '/api': { target: 'http://127.0.0.1:8990', changeOrigin: false } },
  },
});
