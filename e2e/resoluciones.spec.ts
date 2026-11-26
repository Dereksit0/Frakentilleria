import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { sceneValue, skipSplash, tap, waitScene } from './helpers';

/**
 * Every screen at every target resolution: the canvas fills the viewport (no bars), nothing overflows, and buttons and
 * texts keep a usable size. Screenshots go to docs/capturas/resoluciones/, measures to medidas.json next to them.
 * Portrait phones and tablets show the "Gira tu dispositivo" notice (the game is landscape): it is captured as is, and the
 * screens are also captured with the notice hidden to check their layout.
 */
const SIZES: [number, number][] = [
  [360, 640],
  [390, 844],
  [844, 390],
  [768, 1024],
  [1024, 768],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
];
const OUT = 'docs/capturas/resoluciones';
const results: Record<string, unknown>[] = [];

interface Measure {
  coverW: number;
  coverH: number;
  overflowX: boolean;
  minButton: number;
  minText: number;
  rotateNotice: boolean;
}

async function measure(page: Page, key: string): Promise<Measure> {
  return page.evaluate((k) => {
    type Obj = {
      type: string;
      visible: boolean;
      active: boolean;
      list?: Obj[];
      h?: number;
      w?: number;
      style?: { fontSize: string };
    };
    const g = (
      window as unknown as {
        __game: {
          scale: { gameSize: { width: number } };
          scene: { getScene(k: string): { children: { list: Obj[] }; cameras: { main: { zoom: number } } } };
        };
      }
    ).__game;
    const c = document.querySelector('#game canvas')!.getBoundingClientRect();
    const css = (c.width / g.scale.gameSize.width) * g.scene.getScene(k).cameras.main.zoom;
    let minButton = Infinity;
    let minText = Infinity;
    const walk = (list: Obj[]): void => {
      for (const o of list) {
        if (!o.visible || !o.active) continue;
        // widgets.Button: a container with its own w, h, label and kind
        if (o.type === 'Container' && 'label' in o && 'kind' in o && (o.w ?? 0) > 0 && (o.h ?? 0) > 0)
          minButton = Math.min(minButton, Math.min(o.h ?? 0, o.w ?? 0) * css);
        if (o.type === 'Text' && o.style) minText = Math.min(minText, parseFloat(o.style.fontSize) * css);
        if (o.list) walk(o.list);
      }
    };
    walk(g.scene.getScene(k).children.list);
    const rotate = document.getElementById('rotate')!;
    return {
      coverW: c.width / window.innerWidth,
      coverH: c.height / window.innerHeight,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      minButton: Math.round(minButton * 10) / 10,
      minText: Math.round(minText * 10) / 10,
      rotateNotice: getComputedStyle(rotate).display !== 'none',
    };
  }, key);
}

for (const [w, h] of SIZES) {
  const portrait = h > w;
  const touch = Math.min(w, h) <= 1024;
  test.describe(`${w}x${h}`, () => {
    test.use({
      viewport: { width: w, height: h },
      hasTouch: touch,
      isMobile: touch && Math.max(w, h) <= 1024,
    });

    test(`pantallas en ${w}x${h}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'pc', 'una sola pasada con su propio tamaño de pantalla');
      test.setTimeout(240_000);
      mkdirSync(OUT, { recursive: true });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const tag = `${w}x${h}`;
      await page.goto('/');
      if (portrait) {
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${OUT}/${tag}-aviso-girar.png` });
        await page.addStyleTag({ content: '#rotate{display:none!important}' });
      }
      await skipSplash(page);
      const shot = async (key: string, name: string): Promise<void> => {
        await waitScene(page, key);
        // the camera fade-in runs in game time: on a slow software-GL frame it can outlast a fixed wait
        await page.waitForFunction(
          (k) =>
            !(
              window as unknown as {
                __game: {
                  scene: {
                    getScene(k: string): { cameras: { main: { fadeEffect: { isRunning: boolean } } } };
                  };
                };
              }
            ).__game.scene.getScene(k).cameras.main.fadeEffect.isRunning,
          key,
          { timeout: 20_000 },
        );
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
        const m = await measure(page, key);
        results.push({ size: tag, screen: name, ...m });
        expect(m.overflowX, `${tag} ${name}: desborde horizontal`).toBe(false);
        expect(m.coverW, `${tag} ${name}: el lienzo llena el ancho`).toBeGreaterThan(0.99);
        expect(m.coverH, `${tag} ${name}: el lienzo llena el alto`).toBeGreaterThan(0.99);
      };
      await shot('Menu', 'menu');
      await tap(page, 800, 490, touch);
      await shot('Lab', 'laboratorio');
      await tap(page, 1427, 842, touch);
      await shot('PassDevice', 'pasa-dispositivo');
      // "al [Jugador 2]": the word ends before the badge starts, and the pair is centred on the screen
      const row = await sceneValue<{
        textRight: number;
        badgeLeft: number;
        badgeRight: number;
        textLeft: number;
      }>(
        page,
        'PassDevice',
        `(s) => { const t = s.children.list.find((o) => o.type === 'Text' && o.text === 'al');
          const b = s.children.list.find((o) => o.type === 'Container' && o.getData && o.getData('width'));
          return { textLeft: t.x, textRight: t.x + t.width, badgeLeft: b.x, badgeRight: b.x + b.getData('width') }; }`,
      );
      expect(row.textRight, `${tag}: "al" no queda bajo la etiqueta`).toBeLessThan(row.badgeLeft);
      expect(Math.abs((row.textLeft + row.badgeRight) / 2 - 800), `${tag}: fila centrada`).toBeLessThan(2);
      await tap(page, 1100, 730, touch);
      await waitScene(page, 'Lab');
      await tap(page, 1427, 842, touch);
      await waitScene(page, 'Battle');
      await page.waitForTimeout(1500);
      await shot('Battle', 'combate');
      await sceneValue(page, 'Battle', '(s) => s.finish(0)');
      await shot('Result', 'resumen');
      await page.goto('/');
      if (portrait) await page.addStyleTag({ content: '#rotate{display:none!important}' });
      await skipSplash(page);
      await tap(page, 1382, 100, touch); // "Colección"
      await shot('Coleccion', 'coleccion');
      // scrolled to the end: the achievement badges, with Volver still on screen
      await sceneValue(page, 'Coleccion', '(s) => s.setScroll(s.maxScroll)');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${tag}-coleccion-logros.png` });
      const back = await sceneValue<{ top: number; bottom: number; viewTop: number; viewBottom: number }>(
        page,
        'Coleccion',
        `(s) => { const b = s.children.list.find((o) => o.type === 'Container' && o.label && o.label.text === 'Volver');
          const c = s.cameras.main.worldView; return { top: b.y, bottom: b.y + b.h, viewTop: c.y, viewBottom: c.y + c.height }; }`,
      );
      expect(back.top, `${tag}: Volver visible`).toBeGreaterThanOrEqual(back.viewTop);
      expect(back.bottom, `${tag}: Volver visible`).toBeLessThanOrEqual(back.viewBottom + 1);
      expect(errors).toEqual([]);
    });
  });
}

test.afterAll(() => {
  if (results.length) {
    const prev = (() => {
      try {
        return JSON.parse(readFileSync(`${OUT}/medidas.json`, 'utf8')) as Record<string, unknown>[];
      } catch {
        return [];
      }
    })();
    const keyOf = (r: Record<string, unknown>) => `${r.size}/${r.screen}`;
    const merged = new Map(prev.map((r) => [keyOf(r), r]));
    for (const r of results) merged.set(keyOf(r), r);
    writeFileSync(`${OUT}/medidas.json`, JSON.stringify([...merged.values()], null, 1));
  }
});
