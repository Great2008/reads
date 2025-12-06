import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Use the standard React plugin to process JSX files
  plugins: [react()], 
  // Base path must be / for Vercel
  base: '/',
  // Define build output directory as 'dist' (Vercel default)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  // Proxy API requests to backend during development
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
});
