import { expect, test } from '@playwright/test';
import { mutateCore, sceneValue, skipSplash, tap, waitScene } from './helpers';

/** An achievement unlocks during the combat, the toast appears, queues and never blocks the input. */
test('un logro se desbloquea en combate y el aviso no bloquea el juego', async ({ page }, info) => {
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
  await page.waitForTimeout(1200);

  // first damage of the match + five different weapons: two unlocks at the same time (they queue)
  await mutateCore(
    page,
    '(c) => { c.stats.damage[0] = 6; for (const w of ["canon","mortero","bazuca","granada","mazo"]) c.weaponsUsed.add(w); }',
  );
  await expect
    .poll(() => sceneValue<string | null>(page, 'Hud', '(s) => s.achToast.currentId'), { timeout: 15_000 })
    .toBe('primer-golpe');
  expect(await sceneValue<number>(page, 'Hud', '(s) => s.achToast.queue.pending')).toBe(1);

  // wait until the banner has slid in and the badge is visible, then capture
  await page.waitForFunction(() => {
    const hud = (
      window as unknown as {
        __game: {
          scene: { getScene(k: string): { achToast: { queue: { current: { t: number } | null } } } };
        };
      }
    ).__game.scene.getScene('Hud');
    return (hud.achToast.queue.current?.t ?? 0) > 900;
  });
  await page.screenshot({ path: `docs/capturas/ronda3/logro-${info.project.name}.png` });

  // the combat keeps taking input while the toast is on screen: the "Burlar" button still works
  await tap(page, 48 + 104 + 12 + 100, 172 + 52, touch);
  await expect
    .poll(() => sceneValue<string>(page, 'Battle', '(s) => s.views[s.core.current.index].machine.state'), {
      timeout: 10_000,
    })
    .toBe('taunt');

  // after ~3 s the second one shows
  await expect
    .poll(() => sceneValue<string | null>(page, 'Hud', '(s) => s.achToast.currentId'), { timeout: 30_000 })
    .toBe('arsenal');
});
