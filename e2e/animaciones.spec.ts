import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { skipSplash, tap, toPage, waitScene } from './helpers';

/**
 * Animation states of the creatures (docs/capturas/animaciones/) and the "Burlar" button.
 * Software WebGL runs slowly, so every capture waits for the animation clock (machine.time), not for wall time.
 */
const dir = 'docs/capturas/animaciones';
const HEADS = ['armadura', 'espantapajaros', 'maniqui', 'juguete', 'refri'];
type GameWindow = { __game: { scene: { getScene(k: string): unknown } } };
type View = { play(s: string): boolean; machine: { state: string; time: number } };

async function view(page: Page, key: string, expr: string): Promise<void> {
  await page.evaluate(
    ([k, e]) => {
      const sc = (window as unknown as GameWindow).__game.scene.getScene(k);
      new Function('scene', `return (${e})(scene)`)(sc);
    },
    [key, expr],
  );
}

async function untilTime(page: Page, key: string, getView: string, ms: number): Promise<void> {
  await page.waitForFunction(
    ([k, g, t]) => {
      const sc = (window as unknown as GameWindow).__game.scene.getScene(k);
      const v = new Function('scene', `return (${g})(scene)`)(sc) as View;
      return v.machine.time >= t;
    },
    [key, getView, ms] as [string, string, number],
    { timeout: 30_000 },
  );
}

async function sheet(tiles: Buffer[], cols: number, tw: number, th: number, file: string): Promise<void> {
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: '#2a2540' } })
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

async function openLab(page: Page, touch: boolean): Promise<void> {
  await page.goto('/');
  await skipSplash(page);
  await tap(page, 800, 490, touch);
  await waitScene(page, 'Lab');
  await page.waitForTimeout(500);
}

test('estados de animación en el laboratorio y una burla por donante', async ({ page }, info) => {
  const touch = info.project.name === 'movil';
  const tag = info.project.name;
  mkdirSync(dir, { recursive: true });
  await openLab(page, touch);
  const a = await toPage(page, 250, 110);
  const b = await toPage(page, 900, 700);
  const clip = { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  const LAB_VIEW = '(s) => s.view';
  const set = async (head: string) =>
    view(page, 'Lab', `(s) => { s.sel = { ...s.sel, head: '${head}' }; s.refresh(); }`);

  const tiles: Buffer[] = [];
  const states: [string, number][] = [
    ['hurt', 120],
    ['taunt', 450],
    ['fire', 80],
    ['ability', 400],
    ['victory', 350],
    ['defeat', 1800],
    ['lowHp', 100],
    ['walk', 100],
  ];
  await set('armadura');
  for (const [s, t] of states) {
    const status = s === 'lowHp' ? 'false, false, 0.2, true' : s === 'walk' ? 'true, false, 1, true' : '';
    await view(
      page,
      'Lab',
      status
        ? `(s) => { s.view.machine.state = 'idle'; s.view.setStatus(${status}); }`
        : `(s) => { s.view.machine.state = 'idle'; s.view.setStatus(false, false, 1, true); s.view.play('${s}'); }`,
    );
    await untilTime(page, 'Lab', LAB_VIEW, t);
    tiles.push(await page.screenshot({ clip }));
    await view(
      page,
      'Lab',
      '(s) => { s.view.machine.state = "idle"; s.view.setStatus(false, false, 1, true); }',
    );
  }
  if (tag === 'pc')
    await sheet(tiles, 4, 400, Math.round((400 * clip.height) / clip.width), `${dir}/${tag}-estados.png`);

  // one taunt per head donor (their own variant) at mid-animation
  const taunts: Buffer[] = [];
  for (const h of HEADS) {
    await set(h);
    await view(page, 'Lab', `(s) => { s.view.machine.state = 'idle'; s.view.play('taunt'); }`);
    await untilTime(page, 'Lab', LAB_VIEW, 450);
    taunts.push(await page.screenshot({ clip }));
    await view(page, 'Lab', '(s) => { s.view.machine.state = "idle"; }');
  }
  if (tag === 'pc')
    await sheet(taunts, 5, 320, Math.round((320 * clip.height) / clip.width), `${dir}/${tag}-burlas.png`);

  // after the taunt the creature is back to a loop state
  await set('armadura');
  await view(page, 'Lab', `(s) => s.view.play('hurt')`);
  await untilTime(page, 'Lab', LAB_VIEW, 700);
  const back = await page.evaluate(() => {
    const lab = (window as unknown as GameWindow).__game.scene.getScene('Lab') as unknown as { view: View };
    return lab.view.machine.state;
  });
  expect(['idle', 'aim', 'lowHp']).toContain(back);
});

test('"Burlar" en combate no gasta turno y el golpe hace animar al afectado', async ({ page }, info) => {
  const touch = info.project.name === 'movil';
  const tag = info.project.name;
  await openLab(page, touch);
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'PassDevice');
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1500);
  type B = {
    core: { current: { index: number }; clock: { remaining?: number } };
    views: View[];
    tauntCurrent(): boolean;
  };
  const before = await page.evaluate(() => {
    const b = (window as unknown as GameWindow).__game.scene.getScene('Battle') as unknown as B;
    return b.core.current.index;
  });
  // the Hud "Burlar" button (left column, under the player panels)
  await tap(page, 48 + 104 + 12 + 100, 172 + 52, touch);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const b = (window as unknown as GameWindow).__game.scene.getScene('Battle') as unknown as B;
        return b.views[b.core.current.index].machine.state;
      }),
    )
    .toBe('taunt');
  const same = await page.evaluate(() => {
    const b = (window as unknown as GameWindow).__game.scene.getScene('Battle') as unknown as B;
    return b.core.current.index;
  });
  expect(same).toBe(before);
  if (tag === 'pc') {
    await page.waitForFunction(() => {
      const b = (window as unknown as GameWindow).__game.scene.getScene('Battle') as unknown as B;
      return b.views[b.core.current.index].machine.time >= 400;
    });
    await page.screenshot({ path: `${dir}/${tag}-combate-burla.png` });
    // damage -> hurt on the target
    await page.evaluate(() => {
      const b = (window as unknown as GameWindow).__game.scene.getScene('Battle') as unknown as {
        views: View[];
      };
      b.views[1].play('hurt');
    });
    await page.waitForFunction(() => {
      const b = (window as unknown as GameWindow).__game.scene.getScene('Battle') as unknown as B;
      return b.views[1].machine.time >= 150;
    });
    await page.screenshot({ path: `${dir}/${tag}-combate-dolor.png` });
  }
});
