import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { core, mutateCore, skipSplash, tap, waitScene } from './helpers';

/**
 * Captures the Lab and battle health UI in the four states we compare in docs/MEJORAS_UI.md.
 * SHOT_DIR=docs/capturas/mejoras/antes (or despues) selects the output folder.
 */
const dir = process.env.SHOT_DIR ?? 'shots/mejoras';

test('capturas de laboratorio y vida en combate', async ({ page }, info) => {
  test.skip(!process.env.SHOT_DIR, 'solo con SHOT_DIR');
  const name = info.project.name;
  const touch = name === 'movil';
  mkdirSync(dir, { recursive: true });
  const shot = async (n: string) => {
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${dir}/${name}-${n}.png` });
  };
  await page.goto('/');
  await skipSplash(page);
  await tap(page, 800, 490, touch);
  await waitScene(page, 'Lab');
  await shot('01-laboratorio');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'PassDevice');
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1500);
  await shot('02-combate-vida-llena');

  // recent damage: drop J2 by 30 and capture while the ghost bar is still draining
  await mutateCore(page, '(c) => { c.units[1].hp -= 30; }');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${name}-03-dano-reciente.png` });

  // low health (<= 25 %) for J1 and the other creature active
  await mutateCore(page, '(c) => { c.units[0].hp = 14; c.units[1].hp = 40; }');
  await shot('04-vida-baja');
  await mutateCore(page, '(c) => { c.forceEndTurn(); }');
  await core<number>(page, '(c) => c.current.index');
  await shot('05-turno-del-rival');
});
