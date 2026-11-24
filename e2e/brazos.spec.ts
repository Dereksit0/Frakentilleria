import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { skipSplash, tap, waitScene } from './helpers';

/** Lab captures of the arm sizes. BRAZOS_TAG=antes|despues writes docs/capturas/ronda3/brazos-<tag>-<project>-N.png */
const tag = process.env.BRAZOS_TAG;
type Slot = 'head' | 'torso' | 'arms' | 'legs';
type Sel = Record<Slot, string>;
type GameWindow = { __game: { scene: { getScene(k: string): unknown } } };
const COMBOS: Sel[] = [
  { head: 'espantapajaros', torso: 'maniqui', arms: 'armadura', legs: 'maniqui' },
  { head: 'armadura', torso: 'armadura', arms: 'armadura', legs: 'armadura' },
  { head: 'juguete', torso: 'espantapajaros', arms: 'armadura', legs: 'juguete' },
  { head: 'maniqui', torso: 'refri', arms: 'refri', legs: 'refri' },
];

async function setLab(page: Page, sel: Sel): Promise<void> {
  await page.evaluate((v) => {
    const lab = (window as unknown as GameWindow).__game.scene.getScene('Lab') as {
      sel: unknown;
      refresh(): void;
    };
    lab.sel = { ...v };
    lab.refresh();
  }, sel);
  await page.waitForTimeout(400);
}

test('capturas de los brazos en el Laboratorio', async ({ page }, info) => {
  test.skip(!tag, 'solo con BRAZOS_TAG');
  mkdirSync('docs/capturas/ronda3', { recursive: true });
  await page.goto('/');
  await skipSplash(page);
  await tap(page, 800, 490, info.project.name === 'movil');
  await waitScene(page, 'Lab');
  await page.waitForTimeout(1500);
  for (let i = 0; i < COMBOS.length; i++) {
    await setLab(page, COMBOS[i]);
    await page.screenshot({ path: `docs/capturas/ronda3/brazos-${tag}-${info.project.name}-${i + 1}.png` });
  }
});
