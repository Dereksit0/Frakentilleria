import { defineConfig, devices } from '@playwright/test';

const gl = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };

export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'pc', use: { viewport: { width: 1600, height: 900 }, launchOptions: gl } },
    {
      name: 'movil',
      use: {
        ...devices['Pixel 7 landscape'],
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        isMobile: true,
        launchOptions: gl,
      },
    },
    {
      name: 'iphone',
      testMatch: /(movil-safari|pantallas).spec.ts/,
      use: { ...devices['iPhone 14 landscape'] },
    },
    {
      name: 'ipad',
      testMatch: /(movil-safari|pantallas).spec.ts/,
      use: { ...devices['iPad (gen 7) landscape'] },
    },
  ],
});
