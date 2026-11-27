import { expect, test } from '@playwright/test';
import { core, mutateCore, skipSplash, tap, toPage, waitScene } from './helpers';

test.describe('partida completa', () => {
  test('laboratorio -> combate -> resumen -> revancha', async ({ page }, info) => {
    const touch = info.project.name === 'movil';
    const name = info.project.name;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await skipSplash(page);
    await page.screenshot({ path: `shots/${name}-01-menu.png` });

    await tap(page, 800, 490, touch); // Jugar
    await waitScene(page, 'Lab');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `shots/${name}-02-lab.png` });

    await tap(page, 1200, 380, touch); // a donor for the head
    await tap(page, 1200, 842, touch); // Al azar
    await tap(page, 1427, 842, touch); // Listo (J1)
    await waitScene(page, 'PassDevice');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `shots/${name}-03-pasa.png` });
    await tap(page, 1100, 730, touch); // Soy el Jugador 2
    await waitScene(page, 'Lab');
    await page.waitForTimeout(500);
    await tap(page, 1427, 842, touch); // ¡A combatir!
    await waitScene(page, 'Battle');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `shots/${name}-04-combate.png` });

    // Real input: aim by dragging/tapping on a free zone, then press Fire
    const before = await core<number>(page, '(c) => c.current.aimAngle');
    if (touch) {
      await tap(page, 700, 150, true);
    } else {
      const p = await toPage(page, 700, 150);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + 5, p.y - 5);
      await page.mouse.up();
    }
    const after = await core<number>(page, '(c) => c.current.aimAngle');
    expect(after).not.toBe(before);
    await tap(page, 1460, 842, touch); // ¡Fuego!
    await expect.poll(() => core<string>(page, '(c) => c.clock.phase')).toBe('retreat');

    // Para acortar: J1 queda con 1 de vida junto a J2 y J2 le dispara. La criatura de J2 sale al azar y el tiro
    // tiene dispersión, así que si falla se repite en el siguiente turno de J2.
    for (let intento = 0; intento < 5; intento++) {
      await expect.poll(() => core<number>(page, '(c) => c.current.index'), { timeout: 60_000 }).toBe(1);
      await mutateCore(
        page,
        '(c) => { c.units[0].hp = 1; c.units[0].x = c.units[1].x - 70; c.units[0].y = c.units[1].y; }',
      );
      const foe = await core<{ x: number; y: number }>(
        page,
        '(c) => ({ x: c.units[0].x, y: c.units[0].y - 70 })',
      );
      await tap(page, foe.x, foe.y, touch); // apunta directo al rival
      await tap(page, 1460, 842, touch);
      const terminada = await page
        .waitForFunction(
          () =>
            (
              window as unknown as { __game: { scene: { isActive(k: string): boolean } } }
            ).__game.scene.isActive('Result'),
          undefined,
          { timeout: 25_000 },
        )
        .then(() => true)
        .catch(() => false);
      if (terminada) break;
    }
    await waitScene(page, 'Result', 30_000);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `shots/${name}-05-resumen.png` });

    await tap(page, 360, 792, touch); // Revancha
    await waitScene(page, 'Battle');
    expect(await core<number>(page, '(c) => c.round')).toBe(1);
    expect(errors).toEqual([]);
  });

  test('ajustes y tutorial se abren desde el menu', async ({ page }, info) => {
    const touch = info.project.name === 'movil';
    const name = info.project.name;
    await page.goto('/');
    await skipSplash(page);
    await tap(page, 800, 740, touch); // Ajustes
    await waitScene(page, 'Settings');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `shots/${name}-06-ajustes.png` });
    await tap(page, 800, 742, touch); // Volver
    await waitScene(page, 'Menu');
    await tap(page, 800, 616, touch); // Cómo jugar
    await waitScene(page, 'Tutorial');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `shots/${name}-07-tutorial.png` });
  });
});

test('aviso de orientación en móvil vertical', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('#rotate')).toBeVisible();
  await page.screenshot({ path: 'shots/movil-00-vertical.png' });
  await ctx.close();
});
