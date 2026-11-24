import { expect, test, type Page } from '@playwright/test';
import { core, mutateCore, skipSplash, tap, waitScene } from './helpers';

/** The Mazo de justa hits a nearby rival and never its own wielder (PC and mobile). */
type GameWindow = { __game: { scene: { getScene(k: string): unknown } } };

async function openBattleWithMace(page: Page, touch: boolean): Promise<void> {
  await page.goto('/');
  await skipSplash(page);
  await tap(page, 800, 490, touch);
  await waitScene(page, 'Lab');
  await page.evaluate(() => {
    const lab = (window as unknown as GameWindow).__game.scene.getScene('Lab') as {
      sel: unknown;
      refresh(): void;
    };
    lab.sel = { head: 'maniqui', torso: 'maniqui', arms: 'armadura', legs: 'maniqui' };
    lab.refresh();
  });
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'PassDevice');
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1200);
}

test('el Mazo golpea al rival cercano y no al que lo usa', async ({ page }, info) => {
  const touch = info.project.name === 'movil';
  await openBattleWithMace(page, touch);
  await mutateCore(
    page,
    `(c) => { const a = c.units[0], b = c.units[1]; b.x = a.x + 100; b.y = a.y; c.selectWeapon('mazo'); c.setAim(0, 50); }`,
  );
  const before = await core<{ a: number; b: number; ax: number }>(
    page,
    '(c) => ({ a: c.units[0].hp, b: c.units[1].hp, ax: c.units[0].x })',
  );
  await mutateCore(page, '(c) => { c.fire(); }');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `docs/capturas/ronda3/${info.project.name}-mazo-golpe.png` });
  await expect
    .poll(() => core<number>(page, '(c) => c.units[1].hp'), { timeout: 20_000 })
    .toBeLessThan(before.b);
  const after = await core<{ a: number; ax: number; stun: number }>(
    page,
    '(c) => ({ a: c.units[0].hp, ax: c.units[0].x, stun: c.units[0].stunTurns })',
  );
  expect(after.a).toBe(before.a);
  expect(Math.abs(after.ax - before.ax)).toBeLessThan(1);
  expect(after.stun).toBe(0);
});
