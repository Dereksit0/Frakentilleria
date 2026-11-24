import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import sharp from 'sharp';

interface Frame {
  frame: { x: number; y: number; w: number; h: number };
  pivot: { x: number; y: number };
  anchorPx: [number, number];
}
const load = (name: string) => {
  const raw = fs.readFileSync(`public/assets/${name}.json`, 'utf8');
  return { raw, json: JSON.parse(raw) as { frames: Record<string, Frame>; meta: { image: string } } };
};

const ICONS = [
  'mazo-de-justa',
  'rafaga-de-hielo',
  'granada-de-calabaza',
  'mina',
  'dinamita',
  'ataque-aereo',
  'taladro',
  'senuelo',
  'gancho',
  'cuervos',
  'escudo-reflector',
];
const FX = [
  'granada-calabaza',
  'hielo-proyectil',
  'hielo-explosion',
  'rayo-arco',
  'rayo-impacto',
  'acido-charco',
  'mina-armada',
  'dinamita-encendida',
  'misil-ataque-aereo',
  'senuelo',
  'gancho-cabeza',
  'cuervo-1',
  'cuervo-2',
  'cuervo-3',
  'mazo-onda',
  'marcador-ataque-aereo',
  'burbuja-escudo',
  'tierra-salpicadura',
];
const BADGES = [
  'congelado',
  'acido',
  'aturdido',
  'escudo',
  'tormenta',
  'meteoritos',
  'gravedad-baja',
  'luna-llena',
  'viento',
];

const GROUPS = [
  { atlas: 'atlas-icons', names: ICONS.flatMap((i) => [`icon-${i}`, `icon-${i}@2x`]), sizes: [128, 256] },
  { atlas: 'atlas-fx', names: FX.map((i) => `fx-${i}`), sizes: [] },
  { atlas: 'atlas-badges', names: BADGES.flatMap((i) => [`badge-${i}`, `badge-${i}@2x`]), sizes: [64, 128] },
];

describe.each(GROUPS)('$atlas', ({ atlas, names }) => {
  const { raw, json } = load(atlas);

  it('contiene cada id del listado, sin duplicados ni sobrantes', () => {
    for (const n of names) expect(json.frames[n], n).toBeDefined();
    expect(Object.keys(json.frames).sort()).toEqual([...names].sort());
    // Duplicated JSON keys vanish when parsed, so count them in the raw text.
    expect((raw.match(/"frame":\{/g) ?? []).length).toBe(names.length);
  });

  it('su imagen existe y los marcos no se solapan', () => {
    expect(fs.existsSync(`public/assets/${json.meta.image}`)).toBe(true);
    const f = Object.values(json.frames).map((v) => v.frame);
    for (let i = 0; i < f.length; i++)
      for (let j = i + 1; j < f.length; j++) {
        const a = f[i],
          b = f[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap, `${i} vs ${j}`).toBe(false);
      }
  });

  it('tamaños positivos y anclaje dentro del sprite', () => {
    for (const [n, v] of Object.entries(json.frames)) {
      expect(v.frame.w, n).toBeGreaterThan(0);
      expect(v.frame.h, n).toBeGreaterThan(0);
      expect(v.anchorPx[0], n).toBeGreaterThanOrEqual(0);
      expect(v.anchorPx[0], n).toBeLessThanOrEqual(v.frame.w);
      expect(v.anchorPx[1], n).toBeGreaterThanOrEqual(0);
      expect(v.anchorPx[1], n).toBeLessThanOrEqual(v.frame.h);
      expect(v.pivot.x).toBeGreaterThanOrEqual(0);
      expect(v.pivot.x).toBeLessThanOrEqual(1);
    }
  });

  it('cada sprite tiene transparencia y contenido', async () => {
    const { data, info } = await sharp(`public/assets/${json.meta.image}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (const [n, v] of Object.entries(json.frames)) {
      let clear = 0,
        solid = 0;
      for (let y = v.frame.y; y < v.frame.y + v.frame.h; y++)
        for (let x = v.frame.x; x < v.frame.x + v.frame.w; x++) {
          const a = data[(y * info.width + x) * 4 + 3];
          if (a === 0) clear++;
          else if (a > 200) solid++;
        }
      expect(clear, `${n} sin transparencia`).toBeGreaterThan(0);
      expect(solid, `${n} vacío`).toBeGreaterThan(v.frame.w * v.frame.h * 0.05);
    }
  });
});

describe('tamaños exportados', () => {
  it('íconos a 128 y 256, insignias a 64 y 128', () => {
    const icons = load('atlas-icons').json.frames;
    const badges = load('atlas-badges').json.frames;
    for (const i of ICONS) {
      expect(icons[`icon-${i}`].frame.w).toBe(128);
      expect(icons[`icon-${i}@2x`].frame.w).toBe(256);
    }
    for (const b of BADGES) {
      expect(badges[`badge-${b}`].frame.w).toBe(64);
      expect(badges[`badge-${b}@2x`].frame.w).toBe(128);
    }
  });

  it('los 3 cuervos comparten tamaño y anclaje', () => {
    const fx = load('atlas-fx').json.frames;
    const [a, b, c] = ['fx-cuervo-1', 'fx-cuervo-2', 'fx-cuervo-3'].map((n) => fx[n]);
    expect(b.frame.w).toBe(a.frame.w);
    expect(c.frame.w).toBe(a.frame.w);
    expect(b.frame.h).toBe(a.frame.h);
    expect(c.anchorPx).toEqual(a.anchorPx);
  });

  it('weapons.json referencia íconos que existen en algún atlas', () => {
    const w = JSON.parse(fs.readFileSync('src/data/weapons.json', 'utf8')) as {
      weapons: Record<string, { icon: string }>;
      plannedIcons: Record<string, string>;
    };
    const icons = load('atlas-icons').json.frames;
    const main = JSON.parse(fs.readFileSync('public/assets/atlas.json', 'utf8')) as {
      frames: Record<string, unknown>;
    };
    for (const d of Object.values(w.weapons))
      expect(icons[d.icon] ?? main.frames[d.icon], d.icon).toBeDefined();
    for (const [k, id] of Object.entries(w.plannedIcons))
      if (k !== '_note') expect(icons[id], id).toBeDefined();
  });
});
