import { expect, test, type Page } from '@playwright/test';
import mapsJson from '../src/data/maps.json' with { type: 'json' };
import { skipSplash, tap, waitScene } from './helpers';

/**
 * Captures for the gameplay phases (docs/capturas/jugabilidad/): one obstacle per map, every weapon in flight and
 * a round event with its banner. Run with --project=pc (the captures are the same on mobile).
 */
const MAPS = (mapsJson as unknown as { maps: { id: string }[] }).maps;
type GameWindow = { __game: { scene: { getScene(k: string): unknown } } };
const OUT = 'docs/capturas/jugabilidad';

async function startBattleOnMap(page: Page, index: number): Promise<void> {
  await page.goto('/');
  await skipSplash(page);
  for (let i = 0; i <= index; i++) await tap(page, 288, 822);
  await tap(page, 800, 490); // Jugar
  await waitScene(page, 'Lab');
  await page.waitForTimeout(600);
  await tap(page, 1200, 380);
  await tap(page, 1200, 842); // Al azar
  await tap(page, 1427, 842); // Listo
  await waitScene(page, 'PassDevice');
  await page.waitForTimeout(400);
  await tap(page, 1100, 730);
  await waitScene(page, 'Lab');
  await page.waitForTimeout(400);
  await tap(page, 1427, 842);
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1500);
}

const battle = <T>(page: Page, code: string): Promise<T> =>
  page.evaluate((c) => {
    const s = (window as unknown as GameWindow).__game.scene.getScene('Battle');
    return new Function('s', `return (${c})(s)`)(s);
  }, code) as Promise<T>;

test.describe('capturas de jugabilidad', () => {
  MAPS.forEach((m, index) => {
    test(`obstáculos de ${m.id}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'pc', 'solo en PC');
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await startBattleOnMap(page, index);
      const hz = await battle<number>(page, '(s) => s.terrain.hazards.length');
      expect(hz).toBeGreaterThan(0);
      await page.screenshot({ path: `${OUT}/mapa-${m.id}.png` });
      expect(errors).toEqual([]);
    });
  });

  test('armas en vuelo y evento con banner', async ({ page }, info) => {
    test.skip(info.project.name !== 'pc', 'solo en PC');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await startBattleOnMap(page, 0);
    // Give the current creature every weapon with plenty of ammo, then shoot each one and capture it.
    const ids = await battle<string[]>(page, '(s) => Object.keys(s.core.units[0].ammo).length ? [] : []');
    void ids;
    const all = ['canon', 'mortero', 'bazuca', 'granada', 'mazo', 'tesla', 'hielo', 'pocion'];
    for (const id of all) {
      await battle(
        page,
        `(s) => { const c = s.core; const u = c.current; for (const w of ${JSON.stringify(all)}) { if (!u.weapons.includes(w)) u.weapons.push(w); if (w !== 'canon') u.ammo[w] = 9; } c.rules.spread = false; c.selectWeapon('${id}'); c.setAim(u.facing === 1 ? 50 : 130, 70); c.fire(); return true; }`,
      );
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${OUT}/arma-${id}.png` });
      await battle(
        page,
        '(s) => { const c = s.core; for (let i = 0; i < 600 && (c.projectiles.length || c.clock.phase !== "aim"); i++) c.update(1/30); c.forceEndTurn(); return true; }',
      );
      await page.waitForTimeout(300);
    }
    // A storm announced and started on a fresh match: banner + lightning.
    await startBattleOnMap(page, 0);
    await battle(page, '(s) => { s.core.world.forceEvent("tormenta", s.core.round + 1); s.core.forceEndTurn(); s.core.forceEndTurn(); return true; }');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/evento-tormenta.png` });
    expect(errors).toEqual([]);
  });
});
