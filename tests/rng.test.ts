import { describe, it, expect } from 'vitest';
import { Rng } from '../src/core/rng';

describe('Rng (seeded)', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('differs between seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('next() stays in [0,1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() is inclusive on both ends and covers the range', () => {
    const r = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(-5, 5));
    expect(Math.min(...seen)).toBe(-5);
    expect(Math.max(...seen)).toBe(5);
    expect(seen.size).toBe(11);
  });

  it('pick() returns an element and weighted() respects zero weights', () => {
    const r = new Rng(9);
    expect(['a', 'b']).toContain(r.pick(['a', 'b']));
    for (let i = 0; i < 50; i++) expect(r.weighted(['x', 'y'], [0, 1])).toBe('y');
  });
});
