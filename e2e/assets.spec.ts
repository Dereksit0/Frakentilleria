import { test } from '@playwright/test';
import { mutateCore, skipSplash, tap, waitScene } from './helpers';

/**
 * Captures for the weapon icons / effect sprites / status badges: the debug gallery (?debug=assets),
 * the Lab with the new weapon icons and a combat with the weapon selector and the frozen + shield badges.
 * Screenshots go to docs/capturas/assets/<project>-*.png (pc = 1600x900, movil = 844x390).
 */
const OUT = 'docs/capturas/assets';
type GameWindow = { __game: { scene: { getScene(k: string): unknown } } };

test('galería ?debug=assets', async ({ page }, info) => {
  const errors: string[] = [];
  page.on(
    'console',
    (m) => m.type() === 'warning' && m.text().includes('[assets] missing') && errors.push(m.text()),
  );
  await page.goto('/?debug=assets');
  await waitScene(page, 'AssetsDebug');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${info.project.name}-galeria.png` });
  if (errors.length) throw new Error(errors.join('\n'));
});

test('laboratorio y selector de armas con los íconos nuevos', async ({ page }, info) => {
  const touch = info.project.name === 'movil';
  const tag = info.project.name;
  await page.goto('/');
  await skipSplash(page);
  await tap(page, 800, 490, touch); // Jugar
  await waitScene(page, 'Lab');
  await page.waitForTimeout(600);
  // arms = refri (ráfaga de hielo), torso = espantapájaros (granada de calabaza); head = armadura (mazo no, solo habilidad)
  await page.evaluate(() => {
    const lab = (window as unknown as GameWindow).__game.scene.getScene('Lab') as {
      sel: unknown;
      refresh(): void;
    };
    lab.sel = { head: 'armadura', torso: 'espantapajaros', arms: 'armadura', legs: 'maniqui' };
    lab.refresh();
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${tag}-laboratorio-armas.png` });
  await tap(page, 1427, 842, touch); // Listo (J1)
  await waitScene(page, 'PassDevice');
  await page.waitForTimeout(400);
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await page.waitForTimeout(400);
  await tap(page, 1427, 842, touch); // A combatir
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${tag}-selector-armas.png` });
  await mutateCore(
    page,
    '(c) => { c.units[1].frozenTurns = 1; c.units[1].shield = 1; c.units[0].shield = 1; }',
  );
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${tag}-insignias-estado.png` });
});
