import { test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { skipSplash, tap, toPage, waitScene } from './helpers';

/**
 * Contact sheets: 25 head x torso combinations zoomed on the neck, and 25 torso x arms combinations with both arms
 * at rest and aiming. RIG_DIR=docs/capturas/rig selects the output folder.
 */
const dir = process.env.RIG_DIR;
const DONORS = ['armadura', 'espantapajaros', 'maniqui', 'juguete', 'refri'];
type GameWindow = { __game: { scene: { getScene(k: string): unknown } } };

async function set(page: Page, sel: Record<string, string>, aiming: boolean): Promise<void> {
  await page.evaluate(
    ([v, a]) => {
      const lab = (window as unknown as GameWindow).__game.scene.getScene('Lab') as {
        sel: unknown;
        refresh(): void;
        view: {
          setStatus(m: boolean, a: boolean, h: number, alive: boolean): void;
          setAim(f: 1 | -1, d: number): void;
        };
      };
      lab.sel = { ...(v as object) };
      lab.refresh();
      lab.view.setStatus(false, a as boolean, 1, true);
      lab.view.setAim(1, a ? 25 : 15);
    },
    [sel, aiming] as const,
  );
  await page.waitForTimeout(350);
}

async function sheet(tiles: Buffer[], cols: number, tw: number, th: number, file: string): Promise<void> {
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: '#2a2540' } })
    .composite(
      await Promise.all(
        tiles.map(async (t, i) => ({
          input: await sharp(t).resize(tw, th, { fit: 'fill' }).png().toBuffer(),
          left: (i % cols) * tw,
          top: Math.floor(i / cols) * th,
        })),
      ),
    )
    .png()
    .toFile(file);
}

test('hojas de contacto: cuello (25) y brazos (25 en reposo y apuntando)', async ({ page }, info) => {
  test.skip(!dir || info.project.name !== 'pc', 'solo PC con RIG_DIR');
  mkdirSync(dir!, { recursive: true });
  await page.goto(process.env.RIG_DEBUG ? '/?debug=rig' : '/');
  await skipSplash(page);
  await tap(page, 800, 490, false);
  await waitScene(page, 'Lab');
  await page.waitForTimeout(1500);
  const a = await toPage(page, 250, 120);
  const b = await toPage(page, 900, 700);
  const full = { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };

  // neck: 25 head x torso, zoomed on the neck (clip centred on the solved neck point)
  const necks: Buffer[] = [];
  for (const head of DONORS)
    for (const torso of DONORS) {
      await set(page, { head, torso, arms: 'armadura', legs: 'armadura' }, false);
      const n = await page.evaluate(() => {
        const lab = (window as unknown as GameWindow).__game.scene.getScene('Lab') as {
          view: { x: number; y: number; scaleX: number; solved: { neck: [number, number] } };
        };
        return {
          x: lab.view.x + lab.view.solved.neck[0] * lab.view.scaleX,
          y: lab.view.y + lab.view.solved.neck[1] * lab.view.scaleX,
        };
      });
      const c = await toPage(page, n.x, n.y);
      const s = (await toPage(page, n.x + 90, n.y)).x - c.x;
      necks.push(
        await page.screenshot({ clip: { x: c.x - s, y: c.y - s * 0.9, width: s * 2, height: s * 1.5 } }),
      );
    }
  await sheet(necks, 5, 300, 225, `${dir}/hoja-cuello-25.png`);

  // arms: 25 torso x arms, resting and aiming, whole creature
  for (const aiming of [false, true]) {
    const tiles: Buffer[] = [];
    for (const torso of DONORS)
      for (const arms of DONORS) {
        await set(page, { head: 'maniqui', torso, arms, legs: 'armadura' }, aiming);
        tiles.push(await page.screenshot({ clip: full }));
      }
    await sheet(
      tiles,
      5,
      360,
      Math.round((360 * full.height) / full.width),
      `${dir}/hoja-brazos-25-${aiming ? 'apuntando' : 'reposo'}.png`,
    );
  }
});
