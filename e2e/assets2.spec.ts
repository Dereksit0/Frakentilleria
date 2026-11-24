import { test, type Page } from '@playwright/test';
import { sceneValue, skipSplash, tap, waitScene } from './helpers';

/**
 * Second asset delivery: debug gallery, acid storm (?debug=acid), HUD, Pause and Result with the new icons.
 * Screenshots go to docs/capturas/assets/<project>-*.png (pc = 1600x900, movil = 844x390).
 */
const OUT = 'docs/capturas/assets';
type GameWindow = { __game: { loop: { actualFps: number } } };

async function startMatch(page: Page, touch: boolean, url = '/'): Promise<void> {
  await page.goto(url);
  await skipSplash(page);
  await tap(page, 800, 490, touch); // Jugar
  await waitScene(page, 'Lab');
  await page.waitForTimeout(500);
  await tap(page, 1427, 842, touch); // Listo (J1)
  await waitScene(page, 'PassDevice');
  await page.waitForTimeout(400);
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await page.waitForTimeout(400);
  await tap(page, 1427, 842, touch); // A combatir
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1500);
}

test('galería ?debug=assets con todos los atlas', async ({ page }, info) => {
  const missing: string[] = [];
  page.on('console', (m) => m.text().includes('[assets] missing') && missing.push(m.text()));
  await page.goto('/?debug=assets');
  await waitScene(page, 'AssetsDebug');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${info.project.name}-galeria-2.png` });
  if (missing.length) throw new Error(missing.join('\n'));
});

test('tormenta ácida (?debug=acid), HUD, pausa y resumen', async ({ page }, info) => {
  const touch = info.project.name === 'movil';
  const tag = info.project.name;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.text().includes('[assets] missing') && errors.push(m.text()));
  await startMatch(page, touch, '/?debug=acid');
  await page.waitForTimeout(2500); // acid level eases up, rain falls
  await page.screenshot({ path: `${OUT}/${tag}-tormenta-acida.png` });

  const fps = await page.evaluate(async () => {
    let frames = 0;
    const t0 = performance.now();
    await new Promise<void>((res) => {
      const tick = () => {
        frames++;
        if (performance.now() - t0 >= 3000) res();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    return {
      raf: Math.round(((frames * 1000) / (performance.now() - t0)) * 10) / 10,
      phaser: Math.round((window as unknown as GameWindow).__game.loop.actualFps * 10) / 10,
      gpu,
    };
  });
  console.log(`FPS ${tag} tormenta ácida: rAF ${fps.raf}, Phaser ${fps.phaser}, GPU ${fps.gpu}`);

  await sceneValue(page, 'Battle', '(s) => s.requestPause()');
  await waitScene(page, 'Pause');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${tag}-pausa.png` });
  await sceneValue(page, 'Pause', '(s) => s.resume()');
  await page.waitForTimeout(500);
  await sceneValue(page, 'Battle', '(s) => s.finish(0)');
  await waitScene(page, 'Result', 60_000);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${tag}-resumen.png` });
  if (errors.length) throw new Error(errors.join('\n'));
});
