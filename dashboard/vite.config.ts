import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'recharts';
          }
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/react/')
          ) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/crm/modules': {
        target: 'http://127.0.0.1:3024',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/crm\/modules/, ''),
      },
      '/api/telegram-bots': {
        target: 'http://127.0.0.1:3021',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/telegram-bots/, ''),
      },
      '/api/crm/backup-files': {
        target: 'http://127.0.0.1:3020',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/crm\/backup-files/, ''),
      },
      '/api/crm/updates': {
        target: 'http://127.0.0.1:3023',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/crm\/updates/, ''),
      },
      '/api/crm/post-device': {
        target: 'http://127.0.0.1:3022',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/crm\/post-device/, ''),
      },
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
