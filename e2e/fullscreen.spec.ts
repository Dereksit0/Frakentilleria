import { expect, test } from '@playwright/test';
import { hasText, tap, waitScene } from './helpers';

/** Replaces the Fullscreen API with a counter so the test can check it is requested from a gesture. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __fs: number; __fsOpts: unknown };
    w.__fs = 0;
    // Headless Chromium may report the API as disabled: pretend it is available.
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    Element.prototype.requestFullscreen = function (opts?: FullscreenOptions) {
      w.__fs++;
      w.__fsOpts = opts;
      return Promise.resolve();
    };
  });
});

const count = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __fs: number }).__fs);

test('el primer toque en móvil pide pantalla completa; en PC no', async ({ page }, info) => {
  const touch = info.project.name === 'movil';
  await page.goto('/');
  await waitScene(page, 'Splash');
  await tap(page, 800, 450, touch);
  await waitScene(page, 'Menu');
  expect(await count(page)).toBe(touch ? 1 : 0);
  if (touch) {
    const opts = await page.evaluate(
      () => (window as unknown as { __fsOpts: { navigationUI: string } }).__fsOpts,
    );
    expect(opts.navigationUI).toBe('hide');
  }
});

test('el botón "Pantalla completa" existe en el menú y en ajustes y llama a requestFullscreen', async ({
  page,
}, info) => {
  const touch = info.project.name === 'movil';
  await page.goto('/');
  await waitScene(page, 'Splash');
  await page.keyboard.press('Space');
  await waitScene(page, 'Menu');
  await page.waitForTimeout(500);
  expect(await hasText(page, 'Menu', 'Pantalla completa')).toBe(true);
  const before = await count(page);
  await tap(page, 1312, 822, touch);
  await expect.poll(() => count(page)).toBe(before + 1);

  await tap(page, 800, 740, touch); // Ajustes
  await waitScene(page, 'Settings');
  await page.waitForTimeout(500);
  expect(await hasText(page, 'Settings', 'Pantalla completa')).toBe(true);
  await tap(page, 450, 614, touch);
  await expect.poll(() => count(page)).toBe(before + 2);
});
