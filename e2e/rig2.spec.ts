import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { skipSplash, tap, waitScene } from './helpers';

/**
 * Lab + battle captures of mixed creatures. RIG2_DIR=docs/capturas/rig/antes2 (or despues2) selects the folder.
 * Add ?debug=rig with RIG2_DEBUG=1.
 */
const dir = process.env.RIG2_DIR;
type Slot = 'head' | 'torso' | 'arms' | 'legs';
type Sel = Record<Slot, string>;
type GameWindow = { __game: { scene: { getScene(k: string): unknown } } };

export const COMBOS: Sel[] = [
  { head: 'armadura', torso: 'espantapajaros', arms: 'maniqui', legs: 'juguete' },
  { head: 'espantapajaros', torso: 'refri', arms: 'armadura', legs: 'maniqui' },
  { head: 'refri', torso: 'maniqui', arms: 'juguete', legs: 'armadura' },
  { head: 'juguete', torso: 'armadura', arms: 'espantapajaros', legs: 'refri' },
  { head: 'maniqui', torso: 'juguete', arms: 'refri', legs: 'espantapajaros' },
  { head: 'espantapajaros', torso: 'espantapajaros', arms: 'armadura', legs: 'armadura' },
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
  await page.waitForTimeout(250);
}

test('capturas del laboratorio y el combate con criaturas mezcladas', async ({ page }, info) => {
  test.skip(!dir, 'solo con RIG2_DIR');
  const tag = info.project.name;
  const touch = tag === 'movil';
  mkdirSync(dir!, { recursive: true });
  await page.goto(process.env.RIG2_DEBUG ? '/?debug=rig' : '/');
  await skipSplash(page);
  await tap(page, 800, 490, touch);
  await waitScene(page, 'Lab');
  await page.waitForTimeout(1500);
  for (let i = 0; i < COMBOS.length; i++) {
    await setLab(page, COMBOS[i]);
    await page.screenshot({ path: `${dir}/${tag}-lab-${i + 1}.png` });
  }
  await setLab(page, COMBOS[0]);
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'PassDevice');
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await setLab(page, COMBOS[2]);
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'Battle');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/${tag}-combate.png` });
});
