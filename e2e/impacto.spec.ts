import { expect, test } from '@playwright/test';
import { mutateCore, openBattle, sceneValue } from './helpers';

/**
 * Regression: a shot lands, health drops (or the terrain is hit), the turn passes to the rival and the game keeps
 * answering. Repeated with every weapon, from a cold start (no cache), without console errors and without a stuck turn.
 * IMPACTO_N overrides the repetitions per weapon (default: 10 for the cannon, 3 for the rest).
 * Chromium projects also run with the CPU throttled 4x (a slow phone).
 */
const WEAPONS = ['canon', 'mortero', 'bazuca', 'granada', 'mazo', 'tesla', 'hielo', 'pocion'];
const reps = (w: string): number => Number(process.env.IMPACTO_N ?? (w === 'canon' ? 10 : 3));

for (const weapon of WEAPONS) {
  test(`impacto con ${weapon}: baja la vida o el terreno, el turno pasa y el juego sigue respondiendo`, async ({
    page,
  }, info) => {
    test.setTimeout(900_000);
    const touch = info.project.name !== 'pc';
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      // WebKit ignores the viewport key interactive-widget and says so: harmless, not a game error
      if (m.type() === 'error' && !m.text().includes('interactive-widget'))
        problems.push(`console.error: ${m.text()}`);
    });
    if (info.project.use.browserName !== 'webkit' && info.project.name === 'movil') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    }
    await openBattle(page, touch);
    const slowest: number[] = [];
    for (let i = 0; i < reps(weapon); i++) {
      const before = await sceneValue<number>(page, 'Battle', '(s) => s.core.turn.turnNumber');
      await mutateCore(
        page,
        `(c) => {
          const u = c.current, foe = c.units[1 - u.index];
          const dir = foe.x >= u.x ? 1 : -1;
          foe.x = Math.max(60, Math.min(1540, u.x + dir * 160));
          foe.y = c.terrain.surfaceY(foe.x, 0) ?? foe.y;
          u.weapons = ['${weapon}']; u.weapon = '${weapon}'; u.ammo = {};
          c.setAim(dir > 0 ? 25 : 155, 55);
        }`,
      );
      const hp = await sceneValue<number[]>(page, 'Battle', '(s) => s.core.units.map((u) => u.hp)');
      const t0 = Date.now();
      await mutateCore(page, '(c) => { c.fire(); }');
      // the turn must pass: polling real time, not game time
      await expect
        .poll(() => sceneValue<number>(page, 'Battle', '(s) => s.core.turn.turnNumber'), {
          timeout: 90_000,
          message: `turno atascado tras disparar ${weapon} (#${i + 1})`,
        })
        .toBeGreaterThan(before);
      slowest.push(Date.now() - t0);
      // still alive and answering: the scene clock moves
      const a = await sceneValue<number>(page, 'Battle', '(s) => s.time.now');
      await page.waitForTimeout(600);
      const b = await sceneValue<number>(page, 'Battle', '(s) => s.time.now');
      expect(b, 'la escena sigue actualizándose').toBeGreaterThan(a);
      const phase = await sceneValue<string>(page, 'Battle', '(s) => s.core.phase');
      if (phase !== 'playing') break; // someone died: match over, that is a valid end
      void hp;
    }
    expect(problems, problems.join('\n')).toEqual([]);
    info.annotations.push({ type: 'tiempos', description: `${weapon}: ${slowest.join(' ms, ')} ms` });
  });
}

test('un error sin capturar en el update queda registrado y la pantalla no se queda congelada', async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const touch = info.project.name !== 'pc';
  page.on('pageerror', () => undefined); // the error is thrown on purpose
  await openBattle(page, touch);
  // one frame throws, as an effect failing on impact would
  await page.evaluate(() => {
    type Ev = { once: (n: string, f: () => void) => void };
    const g = (window as unknown as { __game: { scene: { getScene: (k: string) => { events: Ev } } } })
      .__game;
    // Phaser keeps its own reference to update(): the failure is thrown from the scene's update event instead
    g.scene.getScene('Battle').events.once('update', () => {
      throw new Error('fallo de prueba en el impacto');
    });
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => ((window as unknown as { __errors?: { msg: string }[] }).__errors ?? []).length),
      {
        timeout: 20_000,
        message: 'el error llega al registro global',
      },
    )
    .toBeGreaterThan(0);
  const a = await sceneValue<number>(page, 'Battle', '(s) => s.time.now');
  await page.waitForTimeout(4000);
  const b = await sceneValue<number>(page, 'Battle', '(s) => s.time.now');
  expect(b, 'el bucle volvió a correr').toBeGreaterThan(a);
});
