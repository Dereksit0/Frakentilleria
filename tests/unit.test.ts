import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/core/terrain';
import { createUnit, stepUnit, WALK_SPEED, jumpUnit } from '../src/core/unit';
import { computeStats, type Selection } from '../src/core/stats';

const sel: Selection = { head: 'maniqui', torso: 'maniqui', arms: 'maniqui', legs: 'maniqui' };
const mk = (x: number, y: number) => createUnit(0, sel, x, y);
const flat = (h = 700) => Terrain.fromHeights(1600, 900, new Array(1600).fill(h));
const run = (u: ReturnType<typeof mk>, t: Terrain, dir: -1 | 0 | 1, secs: number) => {
  const evs: ReturnType<typeof stepUnit>[] = [];
  for (let i = 0; i < Math.round(secs * 60); i++) evs.push(stepUnit(u, t, 1 / 60, dir));
  return evs;
};

describe('createUnit', () => {
  it('saca la vida y las estadísticas de la selección', () => {
    const u = mk(100, 700);
    expect(u.maxHp).toBe(80);
    expect(u.hp).toBe(80);
    expect(u.stats).toEqual(computeStats(sel));
    expect(u.weapons.length).toBeGreaterThan(0);
  });
});

describe('stepUnit', () => {
  it('se queda quieta en suelo plano', () => {
    const u = mk(200, 700);
    run(u, flat(), 0, 1);
    expect([u.x, u.y]).toEqual([200, 700]);
    expect(u.grounded).toBe(true);
  });

  it('walks at WALK_SPEED scaled by mobility', () => {
    const u = mk(200, 700);
    run(u, flat(), 1, 1);
    expect(u.x - 200).toBeCloseTo((WALK_SPEED * 140) / 100, 0);
    expect(u.facing).toBe(1);
    run(u, flat(), -1, 0.5);
    expect(u.facing).toBe(-1);
  });

  it('sube pendientes suaves y las paredes la detienen', () => {
    const h = new Array(1600).fill(700);
    for (let x = 300; x < 1600; x++) h[x] = 700 - (x - 300) * 0.5; // 26° slope
    const slope = Terrain.fromHeights(1600, 900, h);
    const u = mk(250, 700);
    run(u, slope, 1, 1.2);
    expect(u.x).toBeGreaterThan(330);
    expect(u.y).toBeLessThan(700);
    const w = new Array(1600).fill(700);
    for (let x = 400; x < 1600; x++) w[x] = 500;
    const wall = Terrain.fromHeights(1600, 900, w);
    const v = mk(350, 700);
    run(v, wall, 1, 2);
    expect(v.x).toBeLessThan(400);
  });

  it('cae de un borde, aterriza y reporta la distancia de caída', () => {
    const h = new Array(1600).fill(500);
    for (let x = 300; x < 1600; x++) h[x] = 800;
    const t = Terrain.fromHeights(1600, 900, h);
    const u = mk(290, 500);
    const evs = run(u, t, 1, 2.5);
    const landed = evs.find((e) => e.landed);
    expect(landed).toBeDefined();
    expect(landed!.fallDistance).toBeGreaterThan(250);
    expect(u.y).toBe(800);
    expect(u.grounded).toBe(true);
  });

  it('una caída corta reporta poca distancia (sin daño)', () => {
    const h = new Array(1600).fill(700);
    for (let x = 300; x < 1600; x++) h[x] = 740;
    const t = Terrain.fromHeights(1600, 900, h);
    const u = mk(290, 700);
    const evs = run(u, t, 1, 1);
    const landed = evs.find((e) => e.landed);
    expect(landed!.fallDistance).toBeLessThan(60);
  });

  it('cae fuera del mundo por un hueco', () => {
    const t = flat();
    t.carveCircle(400, 700, 150);
    t.carveCircle(400, 850, 150);
    const u = mk(400, 700);
    // dig the whole column
    for (let y = 700; y < 900; y += 20) t.carveCircle(400, y, 60);
    const evs = run(u, t, 0, 4);
    expect(evs.some((e) => e.fellOut)).toBe(true);
  });

  it('el salto deja el suelo y vuelve a aterrizar', () => {
    const u = mk(500, 700);
    const t = flat();
    expect(jumpUnit(u)).toBe(true);
    expect(u.grounded).toBe(false);
    const evs = run(u, t, 0, 2);
    expect(evs.some((e) => e.landed)).toBe(true);
    expect(u.grounded).toBe(true);
    expect(jumpUnit(Object.assign(mk(1, 1), { grounded: false }))).toBe(false);
  });

  it('se queda dentro del mundo en horizontal', () => {
    const u = mk(30, 700);
    run(u, flat(), -1, 2);
    expect(u.x).toBeGreaterThanOrEqual(20);
  });
});
