import { execSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

/**
 * Cache of the installed app: a browser that already has the service worker of build A must load build B on the next
 * opening after a deploy, and only the cache of build B must remain. Rebuilds `dist/` (the preview server serves it).
 */
const build = (page: Page) => page.evaluate(() => (window as unknown as { __build?: string }).__build ?? '');
const controlled = (page: Page) =>
  page.waitForFunction(() => !!navigator.serviceWorker?.controller, undefined, { timeout: 30_000 });
const cacheNames = (page: Page) => page.evaluate(() => caches.keys());

test('tras un despliegue, una instalación anterior carga la versión nueva', async ({ page }, info) => {
  test.skip(info.project.name !== 'pc', 'basta con un navegador: no depende del tamaño de pantalla');
  test.setTimeout(240_000);
  await page.goto('/');
  await controlled(page);
  const a = await build(page);
  expect(a).not.toBe('');
  expect((await cacheNames(page)).some((k) => k === `frankentilleria-v2-${a}`)).toBe(true);

  // deploy: a new build replaces dist/ while the old worker is still installed in this browser
  execSync('npx vite build', { stdio: 'ignore' });

  await page.reload(); // first opening after the deploy
  await expect.poll(() => build(page), { timeout: 30_000, message: 'carga el build nuevo' }).not.toBe(a);
  const b = await build(page);
  await expect
    .poll(() => cacheNames(page), { timeout: 30_000, message: 'solo queda la caché del build nuevo' })
    .toEqual([`frankentilleria-v2-${b}`]);

  // offline: the installed app still opens from the cache of the new build
  await page.waitForTimeout(1500); // let the new worker finish caching the files it served
  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.context().setOffline(true);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __game?: unknown }).__game, undefined, {
    timeout: 30_000,
  });
  expect(await build(page), 'sin conexión abre la versión nueva desde la caché').toBe(b);
  await page.waitForTimeout(1500);
  expect(failed, 'sin conexión no falta ningún archivo (página, código, estilos, fuentes)').toEqual([]);
  await page.context().setOffline(false);
});
