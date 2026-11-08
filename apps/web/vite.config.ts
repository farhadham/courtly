import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    // Must run before react(): it generates the route tree the app imports.
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // `@courtly/contracts` is a linked CommonJS workspace package. Vite's
  // CommonJS transform only covers `node_modules` by default, so the real
  // `packages/contracts/dist` path is included explicitly; otherwise its named
  // runtime exports (the Zod schemas) look missing to Rollup.
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages[\\/]contracts/],
    },
  },
  optimizeDeps: {
    include: ['@courtly/contracts'],
  },
  server: {
    port: 3000,
    proxy: {
      // Mirrors the nginx rule used in Docker: /api/* -> api:3001/*
      // 127.0.0.1 is explicit: on Windows `localhost` can resolve to ::1,
      // which would miss an API listening on IPv4.
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
