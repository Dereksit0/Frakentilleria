import { expect, test } from '@playwright/test';
import { sceneValue, skipSplash, tap, waitScene } from './helpers';

// Recorre Menú, Laboratorio, Pasa el dispositivo, Combate y Resumen, saca una captura de cada una y exige cero errores en la consola.
// Carpeta de salida: CAPTURAS_DIR (por defecto docs/capturas/pantallas).
const OUT = process.env.CAPTURAS_DIR ?? 'docs/capturas/pantallas';

test('pantallas principales', async ({ page }, info) => {
  const touch = info.project.name !== 'pc';
  const tag = info.project.name;
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  // Safari avisa que no conoce interactive-widget (es de Chrome en Android y aqui es inofensivo); ese es el unico mensaje que se ignora.
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('interactive-widget')) errores.push(m.text());
  });
  const shot = (name: string) => page.screenshot({ path: `${OUT}/${tag}-${name}.png` });

  await page.goto('/');
  await skipSplash(page);
  await shot('menu');
  await tap(page, 800, 490, touch);
  await waitScene(page, 'Lab');
  await page.waitForTimeout(600);
  await shot('laboratorio');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'PassDevice');
  await page.waitForTimeout(500);
  await shot('pasa-el-dispositivo');
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await page.waitForTimeout(400);
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1800);
  await shot('combate');
  await sceneValue(page, 'Battle', '(s) => s.finish(0)');
  await waitScene(page, 'Result', 60_000);
  await page.waitForTimeout(1200);
  await shot('resumen');
  expect(errores, 'errores en la consola').toEqual([]);
});
