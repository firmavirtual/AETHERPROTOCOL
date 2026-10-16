import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  assetsInclude: ['**/*.glb'],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 3000,
  },
  server: {
    port: 3000,
    open: true,
  },
});
