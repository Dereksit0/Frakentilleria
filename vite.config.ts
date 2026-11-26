import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  // One id per build: the service worker versions its cache with it and the error panel shows it.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
});
