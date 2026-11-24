import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import mapsJson from '../src/data/maps.json' with { type: 'json' };
import type { MapDef, WorldDef } from '../src/core/maps';
import { skipSplash, tap, waitScene } from './helpers';

// Playwright loads this file as plain ESM, so the JSON is imported directly instead of through src/core/data.ts.
const MAPS = (mapsJson as unknown as { maps: MapDef[] }).maps;
const WORLD = (mapsJson as unknown as { world: WorldDef }).world;

/**
 * Captures the map selector and the combat scene on every map, checks that parallax moves the layers by the amounts
 * maps.json promises, and measures the frame rate. Screenshots go to docs/capturas/<project>-<map>-*.png.
 * Projects (see playwright.config.ts): pc = 1600x900, movil = 844x390.
 */

type GameWindow = { __game: { scene: { getScene(k: string): unknown }; loop: { actualFps: number } } };

/** Menu -> pick map n (n+1 taps on the cycle button: random, then the maps in order) -> Lab x2 -> Battle. */
async function startBattleOnMap(
  page: Page,
  index: number,
  touch: boolean,
  shotPrefix: string,
): Promise<void> {
  await page.goto('/');
  await skipSplash(page);
  for (let i = 0; i <= index; i++) await tap(page, 288, 822, touch); // "Mapa: ..." button
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${shotPrefix}-selector.png` });
  await tap(page, 800, 490, touch); // Jugar
  await waitScene(page, 'Lab');
  await page.waitForTimeout(600);
  await tap(page, 1200, 380, touch); // a donor for the head
  await tap(page, 1200, 842, touch); // Al azar
  await tap(page, 1427, 842, touch); // Listo (J1)
  await waitScene(page, 'PassDevice');
  await page.waitForTimeout(400);
  await tap(page, 1100, 730, touch); // Soy el Jugador 2
  await waitScene(page, 'Lab');
  await page.waitForTimeout(400);
  await tap(page, 1427, 842, touch); // A combatir
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1800);
}

const battle = (page: Page, fn: string, arg?: unknown): Promise<unknown> =>
  page.evaluate(
    ([f, a]) => {
      const s = (window as unknown as GameWindow).__game.scene.getScene('Battle');
      return new Function('s', 'a', `return (${f})(s, a)`)(s, a);
    },
    [fn, arg] as [string, unknown],
  );

async function layerXs(page: Page, camX: number): Promise<Record<string, number>> {
  return (await battle(
    page,
    `(s, cam) => { s.camX = cam; s.applyParallax(); const o = {}; for (const l of s.layers) o[l.def.id] = l.img.x; return o; }`,
    camX,
  )) as Record<string, number>;
}

async function measureFps(
  page: Page,
  ms = 3000,
): Promise<{ raf: number; phaser: number; software: boolean }> {
  return page.evaluate(async (dur) => {
    let frames = 0;
    const t0 = performance.now();
    await new Promise<void>((res) => {
      const tick = () => {
        frames++;
        if (performance.now() - t0 >= dur) res();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const raf = (frames * 1000) / (performance.now() - t0);
    const phaser = (window as unknown as GameWindow).__game.loop.actualFps;
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    return {
      raf: Math.round(raf * 10) / 10,
      phaser: Math.round(phaser * 10) / 10,
      software: /swiftshader|llvmpipe|software/i.test(gpu),
    };
  }, ms);
}

async function changedFraction(a: Buffer, b: Buffer): Promise<number> {
  const [ra, rb] = await Promise.all([sharp(a).raw().toBuffer(), sharp(b).raw().toBuffer()]);
  let diff = 0;
  for (let i = 0; i < ra.length; i += 3)
    if (Math.abs(ra[i] - rb[i]) + Math.abs(ra[i + 1] - rb[i + 1]) + Math.abs(ra[i + 2] - rb[i + 2]) > 24)
      diff++;
  return diff / (ra.length / 3);
}

test.describe('mapas en combate', () => {
  MAPS.forEach((map, index) => {
    test(`${map.id}: selector, combate, parallax y fps`, async ({ page }, info) => {
      const touch = info.project.name === 'movil';
      const prefix = `docs/capturas/${info.project.name}-${map.id}`;
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'warning' && m.text().includes('[assets] missing')) errors.push(m.text());
      });

      await startBattleOnMap(page, index, touch, prefix);
      expect(await battle(page, '(s) => s.map.id')).toBe(map.id);

      // Neutral camera first: the capture other people will look at.
      const center = await layerXs(page, 0);
      await page.screenshot({ path: `${prefix}-combate.png` });

      // Parallax: panning the camera from -maxPan to +maxPan must move each layer by 2 * maxPan * parallax.
      const left = await layerXs(page, -WORLD.maxPan);
      const shotLeft = await page.screenshot({ path: `${prefix}-parallax-izq.png` });
      const right = await layerXs(page, WORLD.maxPan);
      const shotRight = await page.screenshot({ path: `${prefix}-parallax-der.png` });
      for (const l of map.layers) {
        expect(l.id in left, `${map.id}/${l.id} is drawn`).toBe(true);
        expect(left[l.id] - right[l.id], `${map.id}/${l.id} shift`).toBeCloseTo(
          2 * WORLD.maxPan * l.parallax,
          3,
        );
        expect(center[l.id], `${map.id}/${l.id} edge covers the screen`).toBeLessThanOrEqual(0.001);
      }
      // Something visible actually changes between both extremes whenever a layer moves.
      const moving = map.layers.some((l) => l.parallax > 0);
      const changed = await changedFraction(shotLeft, shotRight);
      if (moving) expect(changed, 'pixels that changed with the pan').toBeGreaterThan(0.002);
      else expect(changed).toBeLessThan(0.05); // only animated hazards (belt, fan, portal) may change
      await layerXs(page, 0);

      // Frame rate with the match running.
      const fps = await measureFps(page);
      console.log(
        `FPS ${info.project.name} ${map.id}: rAF ${fps.raf}, Phaser ${fps.phaser}${fps.software ? ' (software WebGL: not representative)' : ''}`,
      );
      // 60 fps can only be judged on a real GPU; software rendering (SwiftShader) is far slower even for the menu.
      if (!fps.software) expect(fps.raf, 'frames per second').toBeGreaterThanOrEqual(55);
      else
        test.info().annotations.push({
          type: 'fps-no-verificable',
          description: `${fps.raf} fps con WebGL por software`,
        });
      expect(errors, 'page errors / missing assets').toEqual([]);
    });
  });
});
