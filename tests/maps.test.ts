import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { MAPS, WORLD } from '../src/core/data';
import { ACID_START_ROUND, acidLevelY } from '../src/core/acid';
import { UNIT_RADIUS } from '../src/core/unit';
import {
  buildTerrain,
  layerRect,
  pickMapId,
  placeMask,
  surfaceY,
  validateMap,
  type MapDef,
} from '../src/core/maps';

const clone = (m: MapDef): MapDef => JSON.parse(JSON.stringify(m)) as MapDef;

/** Decodes a shipped terrain PNG into its alpha plane (what the scene does with a canvas). */
async function readAlpha(src: string) {
  const { data, info } = await sharp(`public/assets/${src}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return { alpha, w: info.width, h: info.height };
}

describe('maps.json schema', () => {
  it('ships the three maps', () => {
    expect(MAPS.map((m) => m.id).sort()).toEqual(['cementerio', 'fabrica', 'vertedero']);
  });
  it.each(MAPS.map((m) => [m.id, m] as const))('%s is a valid map', (_id, m) => {
    expect(validateMap(m, WORLD)).toEqual([]);
  });
  it.each(MAPS.map((m) => [m.id, m] as const))('%s references files that exist', async (_id, m) => {
    const srcs = m.layers.filter((l) => l.kind === 'image').map((l) => l.src!);
    if (m.terrain.kind === 'image') srcs.push(m.terrain.src!);
    for (const src of srcs) {
      const meta = await sharp(`public/assets/${src}`).metadata(); // throws when the file is missing
      expect(meta.width, src).toBeLessThanOrEqual(2048); // desktop width budget
    }
  });
  it('vertedero has the 4 agreed layers with parallax 0 / 0.15 / 0.4 / terrain', () => {
    const v = MAPS.find((m) => m.id === 'vertedero')!;
    expect(v.layers.map((l) => [l.id, l.parallax])).toEqual([
      ['sky', 0],
      ['far', 0.15],
      ['mid', 0.4],
    ]);
    expect(v.terrain.kind).toBe('image');
  });
  it('rejects broken maps', () => {
    const base = MAPS[0];
    const bad = (mut: (m: MapDef) => void) => {
      const m = clone(base);
      mut(m);
      return validateMap(m, WORLD);
    };
    expect(bad((m) => (m.layers[1].parallax = 1.5)).length).toBeGreaterThan(0);
    expect(bad((m) => (m.layers[2].parallax = 0.05)).length).toBeGreaterThan(0); // nearer layer slower than a far one
    expect(bad((m) => (m.layers[1].depth = m.layers[0].depth)).length).toBeGreaterThan(0);
    expect(bad((m) => (m.spawns = [900, 1000])).length).toBeGreaterThan(0);
    expect(bad((m) => (m.groundY = 2000)).length).toBeGreaterThan(0);
    expect(bad((m) => (m.liquid.startY = 100)).length).toBeGreaterThan(0);
    expect(bad((m) => (m.wind.max = 9)).length).toBeGreaterThan(0);
    expect(bad((m) => (m.terrain.depth = 5)).length).toBeGreaterThan(0);
  });
});

describe('art status', () => {
  it('only the toy factory still has placeholder art, and every placeholder is documented', () => {
    const placeholders = MAPS.flatMap((m) => [
      ...m.layers.filter((l) => l.status === 'placeholder').map((l) => `${m.id}/${l.id}`),
      ...(m.terrain.status === 'placeholder' ? [`${m.id}/terrain`] : []),
    ]);
    expect(placeholders.sort()).toEqual(['fabrica/bg', 'fabrica/terrain']);
  });
  it('rejects an unknown status', () => {
    const m = clone(MAPS[0]);
    (m.layers[0] as { status: string }).status = 'draft';
    expect(validateMap(m, WORLD).length).toBeGreaterThan(0);
  });
});

describe('parallax', () => {
  const w = WORLD;
  it('keeps layer edges covering the world for any pan', () => {
    for (const m of MAPS)
      for (const l of m.layers)
        for (const pan of [-500, -w.maxPan, 0, 77, w.maxPan, 500]) {
          const r = layerRect(l, w, pan);
          expect(r.x, `${m.id}/${l.id} left edge`).toBeLessThanOrEqual(0.0001);
          expect(r.x + r.w, `${m.id}/${l.id} right edge`).toBeGreaterThanOrEqual(w.width - 0.0001);
          expect(r.y + r.h).toBeCloseTo(w.height, 5); // bottom edge always on the world floor
        }
  });
  it('moves far layers less than near layers', () => {
    const v = MAPS.find((m) => m.id === 'vertedero')!;
    const shift = (id: string) => {
      const l = v.layers.find((x) => x.id === id)!;
      return layerRect(l, w, 0).x - layerRect(l, w, 100).x;
    };
    expect(shift('sky')).toBe(0);
    expect(shift('far')).toBeCloseTo(15);
    expect(shift('mid')).toBeCloseTo(40);
  });
});

describe('destructible terrain works with every map', () => {
  it.each(MAPS.map((m) => [m.id, m] as const))(
    '%s: solid ground under both spawns, carving works',
    async (_id, m) => {
      const art = m.terrain.kind === 'image' ? await readAlpha(m.terrain.src!) : undefined;
      const t = buildTerrain(m, WORLD, art);
      expect(t.width).toBe(WORLD.width);
      expect(t.height).toBe(WORLD.height);
      for (const x of m.spawns) {
        const y = surfaceY(t, x);
        expect(y, `spawn x=${x} must stand on ground`).toBeGreaterThan(0);
        expect(Math.abs(y - m.groundY), `spawn x=${x} near groundY`).toBeLessThan(60);
        expect(y).toBeLessThan(m.liquid.startY);
      }
      const before = t.solidCount();
      const x = m.spawns[0];
      const removed = t.carveCircle(x, surfaceY(t, x) + 5, 40);
      expect(removed).toBeGreaterThan(500);
      expect(t.solidCount()).toBe(before - removed);
    },
  );
  it('maps.json groundY agrees with the real median surface of each image terrain', async () => {
    for (const m of MAPS.filter((x) => x.terrain.kind === 'image')) {
      const t = buildTerrain(m, WORLD, await readAlpha(m.terrain.src!));
      const ys: number[] = [];
      for (let x = 0; x < WORLD.width; x += 4) ys.push(surfaceY(t, x));
      ys.sort((a, b) => a - b);
      expect(Math.abs(ys[ys.length >> 1] - m.groundY), m.id).toBeLessThanOrEqual(5);
    }
  });
  it('image terrain requires its decoded art', () => {
    expect(() =>
      buildTerrain(
        MAPS.find((m) => m.terrain.kind === 'image')!,
        WORLD,
      ),
    ).toThrow();
  });
});

describe('placeMask', () => {
  it('anchors the art to the world floor and applies the alpha threshold', () => {
    const world = { width: 4, height: 6, maxPan: 0 };
    const alpha = [255, 10, 200, 0, 255, 255, 255, 255]; // 4x2
    const mask = placeMask(alpha, 4, 2, world);
    expect(Array.from(mask.slice(16, 20))).toEqual([1, 0, 1, 0]); // row 4
    expect(Array.from(mask.slice(20, 24))).toEqual([1, 1, 1, 1]); // row 5
    expect(mask.slice(0, 16).every((v) => v === 0)).toBe(true);
  });
});

describe('pickMapId', () => {
  const ids = MAPS.map((m) => m.id);
  it('is deterministic per seed and always returns a known map', () => {
    for (let s = 0; s < 50; s++) {
      expect(pickMapId(s, ids)).toBe(pickMapId(s, ids));
      expect(ids).toContain(pickMapId(s, ids));
    }
  });
  it('reaches every map across seeds', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) seen.add(pickMapId(s, ids));
    expect(seen.size).toBe(ids.length);
  });
  it('throws without maps', () => {
    expect(() => pickMapId(1, [])).toThrow();
  });
});

describe('spawn points are playable on every map', () => {
  /** TODO(balance): provisional minimum gap between the two players, in world px. */
  const MIN_SPAWN_GAP = 600;
  /** Largest ground height change tolerated across a unit's footprint. */
  const MAX_FOOTPRINT_STEP = 24;

  it.each(MAPS.map((m) => [m.id, m] as const))(
    '%s: both spawns stand on open, solid, dry ground',
    async (_id, m) => {
      const art = m.terrain.kind === 'image' ? await readAlpha(m.terrain.src!) : undefined;
      const t = buildTerrain(m, WORLD, art);
      const half = Math.round(UNIT_RADIUS / 2);
      for (const x of m.spawns) {
        const y = surfaceY(t, x);
        // 1. Solid ground right under the unit's feet.
        expect(y, `x=${x} has no ground`).toBeGreaterThan(0);
        for (let dy = 1; dy <= 8; dy++)
          expect(t.isSolid(x, y + dy), `not solid ${dy}px below the feet at x=${x}`).toBe(true);
        // 2. Walkable footprint: no cliff or prop right beside the spawn.
        for (let dx = -half; dx <= half; dx++)
          expect(Math.abs(surfaceY(t, x + dx) - y), `x=${x + dx} footprint step`).toBeLessThanOrEqual(
            MAX_FOOTPRINT_STEP,
          );
        // 3. Free space above: a whole unit height of empty pixels over the footprint.
        const top = Math.min(y, ...Array.from({ length: 2 * half + 1 }, (_, i) => surfaceY(t, x - half + i)));
        for (let dy = 1; dy <= UNIT_RADIUS * 2; dy++)
          for (let dx = -half; dx <= half; dx++)
            expect(t.isSolid(x + dx, top - dy), `solid pixel ${dy}px over the spawn at x=${x + dx}`).toBe(
              false,
            );
        // 4. Out of the acid: dry when the storm starts and with the surface above the liquid start line.
        expect(y).toBeLessThan(acidLevelY(ACID_START_ROUND, m.liquid.startY));
      }
    },
  );

  it.each(MAPS.map((m) => [m.id, m] as const))(
    '%s: spawns are far apart and mirrored around the centre',
    (_id, m) => {
      const [a, b] = m.spawns;
      expect(b - a).toBeGreaterThanOrEqual(MIN_SPAWN_GAP);
      // Fairness: neither player starts much closer to a world edge.
      expect(Math.abs(a - (WORLD.width - b))).toBeLessThanOrEqual(100);
    },
  );

  it('wind bias stays 0 and every map still flags it as TODO', () => {
    for (const m of MAPS) {
      expect(m.wind.bias, m.id).toBe(0);
      expect(m.todo, m.id).toContain('wind.bias');
    }
  });
});
