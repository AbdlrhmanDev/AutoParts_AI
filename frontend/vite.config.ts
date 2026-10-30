import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api is proxied to the backend so the browser never needs CORS or API keys.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@xyflow/react') || id.includes('@dagrejs/dagre')) return 'agent-graph';
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    // A stale preview should not take the whole dev stack down; Vite selects the next free port.
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        // Preserve the browser-facing Host (5173). The API's same-origin guard
        // compares it with Origin; rewriting Host to 8787 rejects every browser
        // mutation even though /api is same-origin from the browser's view.
        changeOrigin: false,
      },
    },
  },
});
