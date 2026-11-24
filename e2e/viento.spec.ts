import { expect, test } from '@playwright/test';
import { mutateCore, sceneValue, skipSplash, tap, waitScene } from './helpers';

/** Strong wind to the left and to the right: ambient particles, wind sock and arrows (captures in docs/capturas/ronda3). */
test('viento fuerte a la izquierda y a la derecha se ve en partículas, manga y flechas', async ({
  page,
}, info) => {
  const touch = info.project.name === 'movil';
  await page.goto('/');
  await skipSplash(page);
  await tap(page, 800, 490, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'PassDevice');
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1500);

  await mutateCore(page, '(c) => { c.wind = 0; c.gust = 0; }');
  await page.waitForTimeout(600);
  expect(await sceneValue<number>(page, 'Battle', '(s) => s.windFx.alive')).toBe(0);

  for (const [name, w] of [
    ['derecha', 5],
    ['izquierda', -5],
  ] as const) {
    await mutateCore(page, `(c) => { c.wind = ${w}; c.gust = 0; }`);
    await sceneValue(page, 'Hud', `(s) => s.windNotice(${w})`);
    await page.waitForTimeout(700);
    expect(await sceneValue<number>(page, 'Battle', '(s) => s.windFx.alive')).toBe(60);
    if (info.project.name === 'pc')
      await page.screenshot({ path: `docs/capturas/ronda3/viento-${name}.png` });
  }
  // the particle budget never exceeds 60
  expect(await sceneValue<number>(page, 'Battle', '(s) => s.windFx.alive')).toBeLessThanOrEqual(60);
});
