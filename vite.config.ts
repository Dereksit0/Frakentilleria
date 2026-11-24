import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  server: { port: 5173 },
  test: {
    include: ['tests/**/*.test.ts'],
    maxWorkers: 2, // sharp lee PNG grandes: con muchos procesos a la vez se queda sin memoria en equipos justos
    testTimeout: 20_000, // algunas pruebas leen PNG del atlas y se pasan de 5 s si la maquina esta ocupada
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
});
