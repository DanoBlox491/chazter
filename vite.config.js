import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * CHAZTER build configuration.
 *
 * `VITE_BASE_PATH` lets the app be deployed under a sub-path such as
 * `/chazter/` (GitHub Pages) while staying `/` in local development.
 */
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Allow the sandbox preview domain (and any *.e2b.app host) to reach the
    // dev server. Vite blocks unknown Host headers by default to prevent DNS
    // rebinding; the tunnel host is trusted infrastructure.
    // The preview tunnel proxies over https; letting Vite infer the HMR
    // endpoint from the page origin keeps both local and tunnelled dev working.
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: mode !== 'production',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown) requires manualChunks to be a function.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
          if (/node_modules\/(react|react-dom|react-router|react-router-dom)/.test(id)) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    css: false,
    include: ['src/**/*.test.{js,jsx}'],
  },
}));
