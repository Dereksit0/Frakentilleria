import { expect, test } from '@playwright/test';
import { hasText, sceneValue, skipSplash, tap, waitScene } from './helpers';

/** The vortex portals of the Fábrica de juguetes stand on the ground, above the terrain (captures in docs/capturas/ronda3). */
test('el portal de la Fábrica se ve encima del terreno, con la base en el suelo', async ({ page }, info) => {
  const touch = info.project.name === 'movil';
  await page.goto('/');
  await skipSplash(page);
  // pick the Fábrica map with the Menu selector
  for (let i = 0; i < 6 && !(await hasText(page, 'Menu', 'Fábrica')); i++) {
    await tap(page, 288, 822, touch);
    await page.waitForTimeout(250);
  }
  expect(await hasText(page, 'Menu', 'Fábrica')).toBe(true);
  await tap(page, 800, 490, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'PassDevice');
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1500);
  expect(await sceneValue<string>(page, 'Battle', '(s) => s.map.id')).toBe('fabrica');
  const mouths = await sceneValue<{ x: number; y: number; ry: number }[]>(
    page,
    'Battle',
    '(s) => s.terrain.hazards.filter((h) => h.type === "portal").flatMap((h) => [{ x: h.a.x, y: h.a.y, ry: h.ry }, { x: h.b.x, y: h.b.y, ry: h.ry }])',
  );
  expect(mouths.length).toBe(2);
  // the base of every mouth is on the terrain surface
  for (const m of mouths) {
    const ground = await sceneValue<number>(page, 'Battle', `(s) => s.terrain.surfaceY(${m.x}, 0)`);
    expect(Math.abs(m.y + m.ry - ground)).toBeLessThanOrEqual(6);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `docs/capturas/ronda3/portal-fabrica-${info.project.name}.png` });
});
