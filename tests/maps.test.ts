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

/** Decodifica un PNG de terreno del juego a su plano de alfa (lo mismo que hace la escena con un canvas). */
async function readAlpha(src: string) {
  const { data, info } = await sharp(`public/assets/${src}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  return { alpha, w: info.width, h: info.height };
}

describe('esquema de maps.json', () => {
  it('trae los tres mapas', () => {
    expect(MAPS.map((m) => m.id).sort()).toEqual(['cementerio', 'fabrica', 'vertedero']);
  });
  it.each(MAPS.map((m) => [m.id, m] as const))('%s is a valid map', (_id, m) => {
    expect(validateMap(m, WORLD)).toEqual([]);
  });
  it.each(MAPS.map((m) => [m.id, m] as const))('%s references files that exist', async (_id, m) => {
    const srcs = m.layers.filter((l) => l.kind === 'image').map((l) => l.src!);
    if (m.terrain.kind === 'image') srcs.push(m.terrain.src!);
    for (const src of srcs) {
      const meta = await sharp(`public/assets/${src}`).metadata(); // falla si el archivo no existe
      expect(meta.width, src).toBeLessThanOrEqual(2048); // tope de ancho para escritorio
    }
  });
  it('vertedero tiene las 4 capas acordadas con paralaje 0, 0.15, 0.4 y terreno', () => {
    const v = MAPS.find((m) => m.id === 'vertedero')!;
    expect(v.layers.map((l) => [l.id, l.parallax])).toEqual([
      ['sky', 0],
      ['far', 0.15],
      ['mid', 0.4],
    ]);
    expect(v.terrain.kind).toBe('image');
  });
  it('rechaza mapas rotos', () => {
    const base = MAPS[0];
    const bad = (mut: (m: MapDef) => void) => {
      const m = clone(base);
      mut(m);
      return validateMap(m, WORLD);
    };
    expect(bad((m) => (m.layers[1].parallax = 1.5)).length).toBeGreaterThan(0);
    expect(bad((m) => (m.layers[2].parallax = 0.05)).length).toBeGreaterThan(0); // una capa cercana más lenta que una lejana
    expect(bad((m) => (m.layers[1].depth = m.layers[0].depth)).length).toBeGreaterThan(0);
    expect(bad((m) => (m.spawns = [900, 1000])).length).toBeGreaterThan(0);
    expect(bad((m) => (m.groundY = 2000)).length).toBeGreaterThan(0);
    expect(bad((m) => (m.liquid.startY = 100)).length).toBeGreaterThan(0);
    expect(bad((m) => (m.wind.max = 9)).length).toBeGreaterThan(0);
    expect(bad((m) => (m.terrain.depth = 5)).length).toBeGreaterThan(0);
  });
});

describe('estado del arte', () => {
  it('solo la fábrica de juguetes sigue con arte provisional y cada provisional está documentado', () => {
    const placeholders = MAPS.flatMap((m) => [
      ...m.layers.filter((l) => l.status === 'placeholder').map((l) => `${m.id}/${l.id}`),
      ...(m.terrain.status === 'placeholder' ? [`${m.id}/terrain`] : []),
    ]);
    expect(placeholders.sort()).toEqual(['fabrica/bg', 'fabrica/terrain']);
  });
  it('rechaza un estado desconocido', () => {
    const m = clone(MAPS[0]);
    (m.layers[0] as { status: string }).status = 'draft';
    expect(validateMap(m, WORLD).length).toBeGreaterThan(0);
  });
});

describe('paralaje', () => {
  const w = WORLD;
  it('los bordes de las capas cubren el mundo con cualquier desplazamiento', () => {
    for (const m of MAPS)
      for (const l of m.layers)
        for (const pan of [-500, -w.maxPan, 0, 77, w.maxPan, 500]) {
          const r = layerRect(l, w, pan);
          expect(r.x, `${m.id}/${l.id} left edge`).toBeLessThanOrEqual(0.0001);
          expect(r.x + r.w, `${m.id}/${l.id} right edge`).toBeGreaterThanOrEqual(w.width - 0.0001);
          expect(r.y + r.h).toBeCloseTo(w.height, 5); // el borde inferior siempre queda en el piso del mundo
        }
  });
  it('las capas lejanas se mueven menos que las cercanas', () => {
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

describe('el terreno destructible funciona con todos los mapas', () => {
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
  it('groundY de maps.json coincide con la superficie mediana real de cada terreno de imagen', async () => {
    for (const m of MAPS.filter((x) => x.terrain.kind === 'image')) {
      const t = buildTerrain(m, WORLD, await readAlpha(m.terrain.src!));
      const ys: number[] = [];
      for (let x = 0; x < WORLD.width; x += 4) ys.push(surfaceY(t, x));
      ys.sort((a, b) => a - b);
      expect(Math.abs(ys[ys.length >> 1] - m.groundY), m.id).toBeLessThanOrEqual(5);
    }
  });
  it('el terreno de imagen necesita su arte decodificado', () => {
    expect(() =>
      buildTerrain(
        MAPS.find((m) => m.terrain.kind === 'image')!,
        WORLD,
      ),
    ).toThrow();
  });
});

describe('placeMask', () => {
  it('pega el arte al piso del mundo y aplica el umbral de alfa', () => {
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
  it('da lo mismo con la misma semilla y siempre devuelve un mapa conocido', () => {
    for (let s = 0; s < 50; s++) {
      expect(pickMapId(s, ids)).toBe(pickMapId(s, ids));
      expect(ids).toContain(pickMapId(s, ids));
    }
  });
  it('con distintas semillas se llega a todos los mapas', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) seen.add(pickMapId(s, ids));
    expect(seen.size).toBe(ids.length);
  });
  it('lanza error si no hay mapas', () => {
    expect(() => pickMapId(1, [])).toThrow();
  });
});

describe('los puntos de salida son jugables en todos los mapas', () => {
  /** TODO(balance): distancia mínima provisional entre los dos jugadores, en px del mundo. */
  const MIN_SPAWN_GAP = 600;
  /** Mayor cambio de altura del suelo que se tolera en la huella de una criatura. */
  const MAX_FOOTPRINT_STEP = 24;

  it.each(MAPS.map((m) => [m.id, m] as const))(
    '%s: both spawns stand on open, solid, dry ground',
    async (_id, m) => {
      const art = m.terrain.kind === 'image' ? await readAlpha(m.terrain.src!) : undefined;
      const t = buildTerrain(m, WORLD, art);
      const half = Math.round(UNIT_RADIUS / 2);
      for (const x of m.spawns) {
        const y = surfaceY(t, x);
        // 1. Suelo sólido justo bajo los pies.
        expect(y, `x=${x} has no ground`).toBeGreaterThan(0);
        for (let dy = 1; dy <= 8; dy++)
          expect(t.isSolid(x, y + dy), `not solid ${dy}px below the feet at x=${x}`).toBe(true);
        // 2. Huella transitable: sin acantilado ni objeto junto al punto de salida.
        for (let dx = -half; dx <= half; dx++)
          expect(Math.abs(surfaceY(t, x + dx) - y), `x=${x + dx} footprint step`).toBeLessThanOrEqual(
            MAX_FOOTPRINT_STEP,
          );
        // 3. Espacio libre arriba: la altura de una criatura entera sin píxeles sólidos sobre la huella.
        const top = Math.min(y, ...Array.from({ length: 2 * half + 1 }, (_, i) => surfaceY(t, x - half + i)));
        for (let dy = 1; dy <= UNIT_RADIUS * 2; dy++)
          for (let dx = -half; dx <= half; dx++)
            expect(t.isSolid(x + dx, top - dy), `solid pixel ${dy}px over the spawn at x=${x + dx}`).toBe(
              false,
            );
        // 4. Fuera del ácido: seco cuando empieza la tormenta y con la superficie sobre la línea del líquido.
        expect(y).toBeLessThan(acidLevelY(ACID_START_ROUND, m.liquid.startY));
      }
    },
  );

  it.each(MAPS.map((m) => [m.id, m] as const))(
    '%s: spawns are far apart and mirrored around the centre',
    (_id, m) => {
      const [a, b] = m.spawns;
      expect(b - a).toBeGreaterThanOrEqual(MIN_SPAWN_GAP);
      // Justicia: ningún jugador empieza mucho más cerca de un borde del mundo.
      expect(Math.abs(a - (WORLD.width - b))).toBeLessThanOrEqual(100);
    },
  );

  it('el sesgo de viento sigue en 0 y cada mapa lo marca como TODO', () => {
    for (const m of MAPS) {
      expect(m.wind.bias, m.id).toBe(0);
      expect(m.todo, m.id).toContain('wind.bias');
    }
  });
});
