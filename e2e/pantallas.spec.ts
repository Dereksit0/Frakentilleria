import { test } from '@playwright/test';
import { sceneValue, skipSplash, tap, waitScene } from './helpers';

// Captura las pantallas principales. Carpeta de salida: CAPTURAS_DIR (por defecto docs/capturas/pantallas).
const OUT = process.env.CAPTURAS_DIR ?? 'docs/capturas/pantallas';

test('pantallas principales', async ({ page }, info) => {
  const touch = info.project.name === 'movil';
  const tag = info.project.name;
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
});
