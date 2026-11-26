import { expect, test, type Page } from '@playwright/test';
import { mutateCore, openBattle, sceneValue } from './helpers';

/**
 * The aiming line: drawn in every map (except the Cementerio fog, a map rule), above the nameplates, updated with angle
 * and power, cleared when the shot leaves. The screenshot is checked for the volt colour of the line around the muzzle.
 */
const MAPS = ['vertedero', 'cementerio', 'fabrica'];
const commands = (page: Page) => sceneValue<number>(page, 'Battle', '(s) => s.aimG.commandBuffer.length');
const snapshot = (page: Page) =>
  sceneValue<string>(page, 'Battle', '(s) => JSON.stringify(s.aimG.commandBuffer)');

/** Share of pure line-yellow pixels (#FFE14D ± tolerance) in a box around the muzzle of the current creature. */
async function voltAroundMuzzle(page: Page): Promise<number> {
  // the box in canvas pixels, through the Battle camera (centred and possibly zoomed to fill a wide screen)
  const box = await sceneValue<{ x: number; y: number; k: number; gw: number }>(
    page,
    'Battle',
    `(s) => { const c = s.cameras.main, u = s.core.current;
      return { x: (u.x - 60 - c.worldView.x) * c.zoom, y: (u.y - 330 - c.worldView.y) * c.zoom, k: c.zoom, gw: s.scale.gameSize.width }; }`,
  );
  const png = await page.screenshot();
  return page.evaluate(
    async ([b64, bx, by, zoom, gw]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const r = document.querySelector('#game canvas')!.getBoundingClientRect();
      const px = img.width / window.innerWidth; // screenshot pixels per CSS pixel
      const k = (r.width / gw) * px; // screenshot pixels per canvas pixel
      const x0 = Math.max(0, Math.round(r.left * px + bx * k));
      const y0 = Math.max(0, Math.round(r.top * px + by * k));
      const w = Math.round(380 * zoom * k);
      const h = Math.round(300 * zoom * k);
      const d = ctx.getImageData(x0, y0, w, h).data;
      let hit = 0;
      for (let i = 0; i < d.length; i += 4)
        if (Math.abs(d[i] - 255) < 18 && Math.abs(d[i + 1] - 225) < 18 && Math.abs(d[i + 2] - 77) < 26) hit++;
      return hit / (w * h);
    },
    [png.toString('base64'), box.x, box.y, box.k, box.gw] as const,
  );
}

for (const [index, map] of MAPS.entries()) {
  test(`trayectoria en ${map}`, async ({ page }, info) => {
    test.setTimeout(180_000);
    const touch = info.project.name !== 'pc';
    await openBattle(page, touch, index);
    expect(await sceneValue<string>(page, 'Battle', '(s) => s.map.id')).toBe(map);
    // face the open sky, wind calm, so the line is fully on screen
    await mutateCore(page, '(c) => { c.wind = 0; c.setAim(c.current.x < 800 ? 50 : 130, 55); }');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `docs/capturas/trayectoria/${info.project.name}-${map}.png` });
    if (map === 'cementerio') {
      // map rule: the fog hides the aiming preview (docs/BALANCE_FASE3.md)
      expect(await commands(page)).toBe(0);
      return;
    }
    expect(await commands(page), 'se dibuja').toBeGreaterThan(10);
    expect(await voltAroundMuzzle(page), 'se ve en pantalla').toBeGreaterThan(0.004);

    // follows angle, power and wind (polled: a slow software-GL frame can take longer than a fixed wait)
    const changes = async (mutation: string, what: string): Promise<void> => {
      const before = await snapshot(page);
      await mutateCore(page, mutation);
      await expect.poll(() => snapshot(page), { timeout: 10_000, message: what }).not.toBe(before);
    };
    await changes(
      '(c) => c.setAim(c.current.aimAngle + (c.current.x < 800 ? 12 : -12), c.current.aimPower)',
      'cambia con el ángulo',
    );
    await changes('(c) => c.setAim(c.current.aimAngle, c.current.aimPower + 20)', 'cambia con la potencia');
    await changes('(c) => { c.wind = 5; }', 'cambia con el viento');

    // cleared when the shot leaves
    await mutateCore(page, '(c) => c.fire()');
    await expect.poll(() => commands(page), { timeout: 10_000, message: 'se borra al disparar' }).toBe(0);
  });
}
