import { test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { skipSplash, tap, toPage, waitScene } from './helpers';

/**
 * Captures of the creature rig (assembly). RIG_DIR=docs/capturas/rig/antes (or despues) selects the folder.
 * Worst cases = combinations that showed the shoulder or hip failures with the old assembly, then 60 seeded combos.
 * RIG_DEBUG=1 turns on ?debug=rig (anchors, boxes, ground line).
 */
const dir = process.env.RIG_DIR;
const debug = process.env.RIG_DEBUG ? '/?debug=rig' : '/';
const DONORS = ['armadura', 'espantapajaros', 'maniqui', 'juguete', 'refri'];
type Slot = 'head' | 'torso' | 'arms' | 'legs';
type Sel = Record<Slot, string>;
type GameWindow = { __game: { scene: { getScene(k: string): unknown } } };

export const WORST: Sel[] = [
  { head: 'espantapajaros', torso: 'maniqui', arms: 'armadura', legs: 'juguete' }, // cannon on the chest + spring gap (reported)
  { head: 'espantapajaros', torso: 'maniqui', arms: 'armadura', legs: 'armadura' }, // boots gap (reported)
  { head: 'refri', torso: 'juguete', arms: 'espantapajaros', legs: 'armadura' },
  { head: 'maniqui', torso: 'armadura', arms: 'juguete', legs: 'refri' },
  { head: 'armadura', torso: 'espantapajaros', arms: 'refri', legs: 'juguete' },
  { head: 'juguete', torso: 'refri', arms: 'maniqui', legs: 'espantapajaros' },
];

function seeded(n: number): Sel[] {
  let s = 20261123;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const pick = () => DONORS[Math.floor(rnd() * DONORS.length)];
  return Array.from({ length: n }, () => ({ head: pick(), torso: pick(), arms: pick(), legs: pick() }));
}

async function setLab(page: Page, sel: Sel): Promise<void> {
  await page.evaluate((v) => {
    const lab = (window as unknown as GameWindow).__game.scene.getScene('Lab') as {
      sel: unknown;
      refresh(): void;
    };
    lab.sel = { ...v };
    lab.refresh();
  }, sel);
  await page.waitForTimeout(120);
}

async function sheet(tiles: Buffer[], cols: number, tw: number, th: number, file: string): Promise<void> {
  const rows = Math.ceil(tiles.length / cols);
  const out = sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: '#2a2540' } });
  await out
    .composite(
      await Promise.all(
        tiles.map(async (t, i) => ({
          input: await sharp(t).resize(tw, th, { fit: 'contain', background: '#2a2540' }).png().toBuffer(),
          left: (i % cols) * tw,
          top: Math.floor(i / cols) * th,
        })),
      ),
    )
    .png()
    .toFile(file);
}

test('capturas del ensamble de la criatura', async ({ page }, info) => {
  test.skip(!dir, 'solo con RIG_DIR');
  const tag = info.project.name;
  mkdirSync(dir!, { recursive: true });
  await page.goto(debug);
  await skipSplash(page);
  await tap(page, 800, 490, tag === 'movil');
  await waitScene(page, 'Lab');
  await page.waitForTimeout(700);
  const a = await toPage(page, 300, 120);
  const b = await toPage(page, 830, 700);
  const clip = { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  const shots: Buffer[] = [];
  for (let i = 0; i < WORST.length; i++) {
    await setLab(page, WORST[i]);
    await page.waitForTimeout(250);
    shots.push(await page.screenshot({ clip }));
    if (i < 2) await page.screenshot({ path: `${dir}/${tag}-lab-caso${i + 1}.png` });
  }
  if (tag === 'movil') return;
  await sheet(shots, 3, 480, Math.round((480 * clip.height) / clip.width), `${dir}/${tag}-peores-casos.png`);
  const tiles: Buffer[] = [];
  for (const c of seeded(60)) {
    await setLab(page, c);
    tiles.push(await page.screenshot({ clip }));
  }
  await sheet(
    tiles,
    10,
    240,
    Math.round((240 * clip.height) / clip.width),
    `${dir}/${tag}-hoja-60-combinaciones.png`,
  );
});
