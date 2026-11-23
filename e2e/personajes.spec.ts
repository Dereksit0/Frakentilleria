import { test, type Page } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';
import { skipSplash, tap, toPage, waitScene } from './helpers';

/**
 * Visual check of the 5 donors: Lab screenshot per donor, a contact sheet with the 5 pure creatures plus seeded
 * mixes (docs/capturas/personajes/hoja-de-contacto.png) and a combat with two mixed creatures.
 * Projects: pc = 1600x900, movil = 844x390.
 */
type GameWindow = { __game: { scene: { getScene(k: string): unknown } } };
const DONORS = ['armadura', 'espantapajaros', 'maniqui', 'juguete', 'refri'];
type Slot = 'head' | 'torso' | 'arms' | 'legs';

type Sel = Record<Slot, string>;
const OUT = 'docs/capturas/personajes';

function mixes(): Sel[] {
  let s = 20261123;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const out: Sel[] = [
    { head: 'refri', torso: 'espantapajaros', arms: 'juguete', legs: 'maniqui' },
    { head: 'espantapajaros', torso: 'refri', arms: 'maniqui', legs: 'juguete' },
  ];
  while (out.length < 10) {
    const pick = () => DONORS[Math.floor(rnd() * DONORS.length)];
    out.push({ head: pick(), torso: pick(), arms: pick(), legs: pick() });
  }
  return out;
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
  await page.waitForTimeout(250);
}

async function openLab(page: Page, touch: boolean): Promise<void> {
  await page.goto('/');
  await skipSplash(page);
  await tap(page, 800, 490, touch);
  await waitScene(page, 'Lab');
  await page.waitForTimeout(600);
}

async function creatureClip(page: Page) {
  const a = await toPage(page, 340, 110);
  const b = await toPage(page, 790, 640);
  return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
}

test('laboratorio con cada donante y hoja de contacto', async ({ page }, info) => {
  const touch = info.project.name === 'movil';
  const tag = touch ? 'movil' : 'pc';
  await openLab(page, touch);
  for (const d of DONORS) {
    await setLab(page, { head: d, torso: d, arms: d, legs: d });
    await page.screenshot({ path: `${OUT}/${tag}-lab-${d}.png` });
  }
  if (touch) return;
  const clip = await creatureClip(page);
  const combos: Sel[] = [...DONORS.map((d) => ({ head: d, torso: d, arms: d, legs: d })), ...mixes()];
  const tiles: Buffer[] = [];
  for (const c of combos) {
    await setLab(page, c);
    tiles.push(await page.screenshot({ clip }));
  }
  const cols = 5,
    tw = 360,
    th = Math.round((tw * clip.height) / clip.width);
  const rows = Math.ceil(tiles.length / cols);
  const sheet = sharp({
    create: { width: cols * tw, height: rows * th, channels: 3, background: '#2a2540' },
  });
  const input = await Promise.all(
    tiles.map(async (t, i) => ({
      input: await sharp(t).resize(tw, th).png().toBuffer(),
      left: (i % cols) * tw,
      top: Math.floor(i / cols) * th,
    })),
  );
  fs.mkdirSync(OUT, { recursive: true });
  await sheet.composite(input).png().toFile(`${OUT}/hoja-de-contacto.png`);
  fs.writeFileSync(`${OUT}/hoja-de-contacto.json`, JSON.stringify(combos, null, 1));
});

test('combate con dos criaturas mezcladas', async ({ page }, info) => {
  const touch = info.project.name === 'movil';
  const tag = touch ? 'movil' : 'pc';
  const [a, b] = mixes();
  await openLab(page, touch);
  await setLab(page, a);
  await tap(page, 1427, 842, touch); // Listo (J1)
  await waitScene(page, 'PassDevice');
  await page.waitForTimeout(400);
  await tap(page, 1100, 730, touch); // Soy el Jugador 2
  await waitScene(page, 'Lab');
  await page.waitForTimeout(400);
  await setLab(page, b);
  await tap(page, 1427, 842, touch); // A combatir
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/${tag}-combate-mezcla.png` });
});
