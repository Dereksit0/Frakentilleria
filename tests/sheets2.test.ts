import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import sharp from 'sharp';
import rig from '../src/data/cosmeticRig.json';
import parts from '../src/data/parts.json';

interface Frame {
  frame: { x: number; y: number; w: number; h: number };
  pivot: { x: number; y: number };
  anchorPx: [number, number];
}
const load = (name: string) => {
  const raw = fs.readFileSync(`public/assets/${name}.json`, 'utf8');
  return { raw, json: JSON.parse(raw) as { frames: Record<string, Frame>; meta: { image: string } } };
};
const sq = (ids: string[]) => ids.flatMap((i) => [i, `${i}@2x`]);

const EXPECTED: Record<string, string[]> = {
  'atlas-ui': sq([
    'hud-heart',
    'hud-wind',
    'hud-clock',
    'hud-pause',
    'hud-settings',
    'hud-sound',
    'hud-back',
    'hud-ammo',
    'hud-skull',
    'ui-home',
    'ui-rematch',
    'ui-muted',
    'ui-trophy',
    'ui-star',
    'ui-lock',
    'ui-check',
    'ui-close',
    'ui-help',
    'ach-first-blood',
    'ach-three-wins',
    'ach-flawless',
    'ach-acid-ko',
    'ach-arsenal',
    'ach-comeback',
    'ach-survivor',
    'ach-collector',
    'ach-locked',
  ]).concat(['ui-warning-acid', 'ui-acid-rising-arrow']),
  'atlas-fx': [
    'fx-acid-drop',
    'fx-acid-streaks',
    'fx-acid-bubble',
    'fx-acid-splash-crown',
    'ev-meteor',
    'ev-meteor-small',
    'ev-lightning-vertical',
    'ev-storm-cloud',
    'ev-wind-streaks',
    'ev-low-gravity-feathers',
    'ev-scorch-mark',
    'ev-impact-ring',
    'ev-warning-mark',
    'fx-parachute',
    'fx-signal-flare',
    'fx-confetti',
    'fx-dizzy-stars',
    'fx-sweat-drops',
    'fx-hit-puff',
    'fx-impact-spark',
    'fx-anger-mark',
    'fx-laugh-marks',
    'fx-bubble-speech',
    'fx-bubble-shout',
    'fx-exclamation',
  ],
  'atlas-objects': [
    'obj-tnt-barrel',
    'obj-wall-destructible',
    'obj-spring-pad',
    'obj-fan',
    'obj-portal-blue',
    'obj-bridge',
    'obj-bridge-broken',
    'obj-rope-segment',
    'obj-portal-orange',
    'obj-crane-claw',
    'obj-scrap-pile',
    'obj-zombie-hand',
    'obj-tombstone-falling',
    'obj-fog-bank',
    'obj-conveyor',
    'obj-rolling-ball',
    'obj-toy-blocks',
    'obj-wrecking-ball',
  ],
  'atlas-items': [
    'crate-mimic-closed',
    'crate-mimic-open',
    'crate-utility',
    'crate-weapon',
    'chest-closed',
    'chest-open',
    'hat-top',
    'hat-party',
    'hat-crown',
    'hat-propeller',
    'patch-star',
    'patch-skull',
    'grave-tombstone',
    'grave-tombstone-broken',
    'grave-ghost',
    'part-gear',
    'part-bolt',
    'part-spring',
    'part-straw',
    'part-button',
    'part-patch',
  ],
};

describe.each(Object.entries(EXPECTED))('%s (segunda entrega)', (atlas, names) => {
  const { raw, json } = load(atlas);

  it('contiene cada id, sin duplicados y pesa menos de 1 MB', () => {
    for (const n of names) expect(json.frames[n], n).toBeDefined();
    expect((raw.match(/"frame":\{/g) ?? []).length).toBe(Object.keys(json.frames).length);
    expect(fs.statSync(`public/assets/${json.meta.image}`).size).toBeLessThan(1024 * 1024);
  });

  it('tamaños positivos, ancla dentro del sprite y marcos sin solape', () => {
    const all = Object.entries(json.frames);
    for (const [n, v] of all) {
      expect(v.frame.w, n).toBeGreaterThan(0);
      expect(v.frame.h, n).toBeGreaterThan(0);
      expect(v.anchorPx[0], n).toBeGreaterThanOrEqual(0);
      expect(v.anchorPx[0], n).toBeLessThanOrEqual(v.frame.w);
      expect(v.anchorPx[1], n).toBeGreaterThanOrEqual(0);
      expect(v.anchorPx[1], n).toBeLessThanOrEqual(v.frame.h);
    }
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i][1].frame,
          b = all[j][1].frame;
        expect(
          a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h,
          `${all[i][0]} / ${all[j][0]}`,
        ).toBe(false);
      }
  });

  it('cada sprite tiene alfa y contenido', async () => {
    const { data, info } = await sharp(`public/assets/${json.meta.image}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (const n of names) {
      const f = json.frames[n].frame;
      let clear = 0,
        solid = 0;
      for (let y = f.y; y < f.y + f.h; y++)
        for (let x = f.x; x < f.x + f.w; x++) {
          const a = data[(y * info.width + x) * 4 + 3];
          if (a === 0) clear++;
          else if (a > 200) solid++;
        }
      expect(clear, `${n} sin transparencia`).toBeGreaterThan(0);
      expect(solid, `${n} vacío`).toBeGreaterThan(f.w * f.h * 0.03);
    }
  });
});

describe('ácido', () => {
  it('acid-surface y acid-body existen como archivos independientes', () => {
    expect(fs.existsSync('public/assets/acid-surface.webp')).toBe(true);
    expect(fs.existsSync('public/assets/acid-body.webp')).toBe(true);
    for (const f of ['acid-surface', 'acid-body'])
      expect(fs.statSync(`public/assets/${f}.webp`).size).toBeLessThan(200 * 1024);
  });

  it('acid-surface mide lo mismo en ambos bordes (costura continua) y es transparente arriba', async () => {
    const { data, info } = await sharp('public/assets/acid-surface.webp')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let diff = 0;
    for (let y = 0; y < info.height; y++)
      for (let c = 0; c < 4; c++)
        diff += Math.abs(data[y * info.width * 4 + c] - data[(y * info.width + info.width - 1) * 4 + c]);
    expect(diff / (info.height * 4)).toBeLessThan(4); // mean abs difference per channel (WebP loss only)
    let topClear = 0;
    for (let x = 0; x < info.width; x++) if (data[x * 4 + 3] === 0) topClear++;
    expect(topClear).toBeGreaterThan(info.width * 0.5);
  });

  it('acid-body es opaco y se repite en vertical y horizontal', async () => {
    const { data, info } = await sharp('public/assets/acid-body.webp')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4 * 97) expect(data[i]).toBe(255);
    // x edges equal (mirror) and y edges equal (mirror)
    let dx = 0,
      dy = 0;
    for (let y = 0; y < info.height; y++)
      for (let c = 0; c < 3; c++)
        dx += Math.abs(data[y * info.width * 4 + c] - data[(y * info.width + info.width - 1) * 4 + c]);
    for (let x = 0; x < info.width; x++)
      for (let c = 0; c < 3; c++)
        dy += Math.abs(data[x * 4 + c] - data[((info.height - 1) * info.width + x) * 4 + c]);
    expect(dx / (info.height * 3)).toBeLessThan(4);
    expect(dy / (info.width * 3)).toBeLessThan(4);
  });
});

describe('cosméticos: sombreros y parches', () => {
  const donors = Object.keys(parts.donors);
  it('hay headTop, hatOffset y hatMode para las 5 cabezas, y patchSlot para los 5 torsos', () => {
    for (const d of donors) {
      const h = (rig.heads as Record<string, { headTop: number[]; hatOffset: number[]; hatMode: string }>)[d];
      expect(h.headTop, d).toHaveLength(2);
      expect(h.hatOffset, d).toHaveLength(2);
      expect(['on', 'off']).toContain(h.hatMode);
      const t = (rig.torsos as Record<string, { patchSlot: number[] }>)[d];
      expect(t.patchSlot, d).toHaveLength(2);
    }
  });

  it('cada sombrero tiene hatAnchor y hatScale, cada parche patchScale, y sus frames existen', () => {
    const items = load('atlas-items').json.frames;
    for (const h of Object.values(rig.hats)) {
      expect(h.hatAnchor).toHaveLength(2);
      expect(h.hatScale).toBeGreaterThan(0);
      expect(items[h.frame]).toBeDefined();
    }
    for (const p of Object.values(rig.patches)) {
      expect(p.patchScale).toBeGreaterThan(0);
      expect(items[p.frame]).toBeDefined();
    }
  });
});
