import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { port: 5180, host: '127.0.0.1', watch: { ignored: ['**/qa/**', '**/ref/**', '**/dist/**'] } },
  preview: { port: 5181, host: '127.0.0.1' },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 1500, rollupOptions: { input: { main: 'index.html', admin: 'admin.html' } } },
});
