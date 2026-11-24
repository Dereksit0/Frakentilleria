import { describe, expect, it } from 'vitest';
import { MAPS, WORLD } from '../src/core/data';
import { buildTerrain } from '../src/core/maps';
import { resolvePortals, type HazardDef } from '../src/core/world';
import { loadMapArts } from './helpers/mapArt';

type Portal = Extract<HazardDef, { type: 'portal' }>;
const portalsOf = (hz: HazardDef[]): Portal[] => hz.filter((h): h is Portal => h.type === 'portal');
const HEX = /^#[0-9A-Fa-f]{6}$/;

describe('portales: datos del par', () => {
  const withPortals = MAPS.filter((m) => portalsOf(m.hazards ?? []).length > 0);

  it('al menos un mapa tiene portales', () => {
    expect(withPortals.length).toBeGreaterThan(0);
  });

  it('cada par tiene bocas dentro del mundo, óvalo vertical, anclaje al suelo y colores distintos', () => {
    for (const m of withPortals)
      for (const p of portalsOf(m.hazards ?? [])) {
        for (const mouth of [p.a, p.b]) {
          expect(mouth.x, m.id).toBeGreaterThan(p.radius);
          expect(mouth.x, m.id).toBeLessThan(WORLD.width - p.radius);
        }
        expect(p.radius).toBeGreaterThan(0);
        expect(p.ry ?? 0, `${m.id}: óvalo vertical`).toBeGreaterThan(p.radius);
        expect(p.anchor).toBe('ground');
        expect(p.colors?.a).toMatch(HEX);
        expect(p.colors?.b).toMatch(HEX);
        expect(p.colors?.a.toLowerCase()).toBe('#7cff4f');
        expect(p.colors?.b.toLowerCase()).toBe('#ff9a4d');
        expect(Math.abs(p.a.x - p.b.x), `${m.id}: las bocas no se tocan`).toBeGreaterThan(2 * p.radius + 100);
        for (const s of m.spawns)
          for (const mouth of [p.a, p.b])
            expect(Math.abs(mouth.x - s), `${m.id} cerca de un spawn`).toBeGreaterThan(150);
      }
  });
});

describe('portales: posición sobre el terreno', () => {
  it('con la base apoyada en el suelo y sin solapar terreno sólido, en cada mapa que los tenga', async () => {
    const arts = await loadMapArts();
    let checked = 0;
    for (const m of MAPS) {
      if (portalsOf(m.hazards ?? []).length === 0) continue;
      const t = buildTerrain(m, WORLD, arts[m.id]);
      for (const p of portalsOf(t.hazards)) {
        const ry = p.ry ?? p.radius;
        for (const mouth of [p.a, p.b]) {
          const ground = t.surfaceY(mouth.x, 0);
          expect(ground, `${m.id}: hay suelo bajo la boca`).not.toBeNull();
          // base on the ground: the lowest point of the oval touches the surface (±6 px)
          expect(Math.abs(mouth.y + ry - (ground as number)), `${m.id}: base apoyada`).toBeLessThanOrEqual(6);
          // no solid pixel inside the oval (shrunk 8 % so the base can touch)
          let solid = 0;
          for (let dy = -ry; dy <= ry; dy += 4)
            for (let dx = -p.radius; dx <= p.radius; dx += 4) {
              if ((dx / (p.radius * 0.92)) ** 2 + (dy / (ry * 0.92)) ** 2 > 1) continue;
              if (t.isSolid(mouth.x + dx, mouth.y + dy)) solid++;
            }
          expect(solid, `${m.id}: óvalo sobre terreno sólido`).toBe(0);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it('resolvePortals pone la y a partir del suelo y respeta una y explícita', () => {
    const flat = (x: number): number | null => (x < 0 ? null : 700);
    const out = resolvePortals(
      [
        {
          type: 'portal',
          a: { x: 300 } as never,
          b: { x: 900 } as never,
          radius: 44,
          ry: 80,
          anchor: 'ground',
        },
        { type: 'portal', a: { x: 300, y: 500 }, b: { x: 900, y: 400 }, radius: 44 },
      ],
      flat,
    ) as Portal[];
    expect(out[0].a.y).toBe(620);
    expect(out[0].b.y).toBe(620);
    expect(out[1].a.y).toBe(500);
  });
});
