import { expect, test } from '@playwright/test';
import { hasText, skipSplash, tap, waitScene } from './helpers';

/**
 * Phones and tablets in any browser: viewport fit, safe areas, scroll strip in Menu/Lab only, install flow.
 * Runs on pc, movil (Chromium Pixel 7), iphone and ipad (WebKit). What it cannot prove (real Safari bar collapse,
 * the install flow itself) is listed in docs/PRUEBA_MOVIL.md.
 */
type W = { __installMode?: () => string };

test('viewport, scroll solo en Menu/Lab, instalación y sin scroll en combate', async ({ page }, info) => {
  const touch = info.project.name !== 'pc';
  await page.goto('/');
  // meta viewport per spec
  const meta = await page.locator('meta[name=viewport]').getAttribute('content');
  expect(meta).toContain('viewport-fit=cover');
  expect(meta).toContain('interactive-widget=resizes-content');
  expect(await page.locator('meta[name=apple-mobile-web-app-capable]').getAttribute('content')).toBe('yes');
  expect(await page.locator('meta[name=apple-mobile-web-app-status-bar-style]').getAttribute('content')).toBe(
    'black-translucent',
  );
  await skipSplash(page);

  // the game box follows the visible viewport and the canvas keeps 16:9 inside it
  const fit = await page.evaluate(() => {
    const g = document.getElementById('game')!.getBoundingClientRect();
    const c = document.querySelector('canvas')!.getBoundingClientRect();
    const vv = window.visualViewport!;
    return { gw: g.width, gh: g.height, cw: c.width, ch: c.height, vw: vv.width, vh: vv.height };
  });
  expect(fit.gh).toBeLessThanOrEqual(fit.vh + 1);
  expect(fit.gw).toBeLessThanOrEqual(fit.vw + 1);
  expect(Math.abs(fit.cw / fit.ch - 16 / 9)).toBeLessThan(0.03);
  expect(fit.cw).toBeLessThanOrEqual(fit.gw + 1);
  expect(fit.ch).toBeLessThanOrEqual(fit.gh + 1);

  // install button
  const mode = await page.evaluate(() => (window as unknown as W).__installMode?.() ?? 'none');
  if (mode === 'ios-steps') {
    await tap(page, 1312, 822, touch);
    await expect.poll(() => hasText(page, 'Menu', 'Toca Compartir')).toBe(true);
    await page.keyboard.press('Escape');
  } else if (mode === 'fullscreen') {
    expect(await hasText(page, 'Menu', 'Pantalla completa')).toBe(true);
  }

  // scroll strip only on touch devices, only in the browser, only in Menu/Lab
  if (touch) {
    await expect
      .poll(() => page.evaluate(() => document.body.classList.contains('scroll-on')), { timeout: 5000 })
      .toBe(true);
    const tall = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
    expect(tall).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 60));
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('scrolled'))).toBe(true);
  } else {
    expect(await page.evaluate(() => document.body.classList.contains('scroll-on'))).toBe(false);
  }

  // combat never scrolls
  await tap(page, 800, 490, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'PassDevice');
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'Battle');
  await expect
    .poll(() => page.evaluate(() => document.body.classList.contains('scroll-on')), { timeout: 5000 })
    .toBe(false);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const ta = await page.evaluate(() => getComputedStyle(document.querySelector('canvas')!).touchAction);
  expect(ta).toBe('none');
  await page.screenshot({ path: `docs/capturas/ronda3/safari-${info.project.name}-combate.png` });
});
