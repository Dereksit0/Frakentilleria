import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/core/terrain';

const flat = () => Terrain.fromHeights(200, 100, new Array(200).fill(60));

describe('Terrain', () => {
  it('builds solid ground below the surface line', () => {
    const t = flat();
    expect(t.isSolid(10, 59)).toBe(false);
    expect(t.isSolid(10, 60)).toBe(true);
    expect(t.isSolid(10, 99)).toBe(true);
  });
  it('treats out of bounds as empty', () => {
    const t = flat();
    expect(t.isSolid(-1, 80)).toBe(false);
    expect(t.isSolid(10, 150)).toBe(false);
  });
  it('carves a circle and reports removed pixels', () => {
    const t = flat();
    const before = t.solidCount();
    const removed = t.carveCircle(100, 60, 20);
    expect(removed).toBeGreaterThan(0);
    expect(t.solidCount()).toBe(before - removed);
    expect(t.isSolid(100, 70)).toBe(false);
    expect(t.isSolid(100, 85)).toBe(true);
    // roughly half a circle of area (only the lower half was solid)
    expect(removed).toBeGreaterThan(Math.PI * 400 * 0.4);
    expect(removed).toBeLessThan(Math.PI * 400 * 0.6);
  });
  it('carving twice does not remove the same pixels again', () => {
    const t = flat();
    t.carveCircle(100, 60, 20);
    expect(t.carveCircle(100, 60, 20)).toBe(0);
  });
  it('surfaceY finds the first solid pixel from a start height', () => {
    const t = flat();
    expect(t.surfaceY(50, 0)).toBe(60);
    t.carveCircle(50, 60, 15);
    expect(t.surfaceY(50, 0)).toBeGreaterThan(60);
    expect(t.surfaceY(50, 99)).toBe(99);
    expect(t.surfaceY(-5, 0)).toBeNull();
  });
  it('surfaceY returns null over a bottomless hole', () => {
    const t = flat();
    t.carveCircle(50, 80, 60);
    expect(t.surfaceY(50, 0)).toBeNull();
  });
  it('fromMask copies a mask and clones independently', () => {
    const mask = new Uint8Array(4 * 4).fill(1);
    const t = Terrain.fromMask(4, 4, mask);
    const c = t.clone();
    c.carveCircle(2, 2, 2);
    expect(t.solidCount()).toBe(16);
    expect(c.solidCount()).toBeLessThan(16);
  });
  it('procedural generator is deterministic for a seed', () => {
    const a = Terrain.procedural(400, 300, 7, 200, 50);
    const b = Terrain.procedural(400, 300, 7, 200, 50);
    const c = Terrain.procedural(400, 300, 8, 200, 50);
    expect(a.solid).toEqual(b.solid);
    expect(a.solid).not.toEqual(c.solid);
  });
});
