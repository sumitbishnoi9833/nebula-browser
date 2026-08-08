import { defineConfig } from 'vite';

export default defineConfig({
  build: { 
    target: 'es2021', 
    minify: 'esbuild', 
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: []
    }
  },
  server: { port: 1420, strictPort: true },
  base: './',
  optimizeDeps: {
    include: ['uuid']
  }
});
