import { describe, it, expect } from 'vitest';
import { calcDamage, explosionFalloff, fallDamage, FALL_SAFE_DISTANCE } from '../src/core/damage';

describe('calcDamage = base × (1 + bonus) × (1 − resistance)', () => {
  it('returns base when there are no modifiers', () => {
    expect(calcDamage(30, 0, 0)).toBe(30);
  });
  it('applies the damage bonus', () => {
    expect(calcDamage(30, 0.08, 0)).toBe(32); // 32.4 -> 32
  });
  it('applies resistance', () => {
    expect(calcDamage(40, 0, 0.1)).toBe(36);
  });
  it('combines both', () => {
    expect(calcDamage(30, 0.5, 0.5)).toBe(23); // 22.5 -> 23
  });
  it('never goes negative and caps resistance at 90%', () => {
    expect(calcDamage(30, 0, 2)).toBe(3);
    expect(calcDamage(-5, 0, 0)).toBe(0);
  });
});

describe('explosionFalloff', () => {
  it('is 1 at the centre and 0 outside the radius', () => {
    expect(explosionFalloff(0, 80)).toBe(1);
    expect(explosionFalloff(80, 80)).toBe(0);
    expect(explosionFalloff(120, 80)).toBe(0);
  });
  it('decreases monotonically but keeps a floor inside the radius', () => {
    const a = explosionFalloff(10, 80);
    const b = explosionFalloff(60, 80);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThanOrEqual(0.3);
  });
});

describe('fallDamage', () => {
  it('is zero up to the safe distance', () => {
    expect(fallDamage(FALL_SAFE_DISTANCE, 0)).toBe(0);
    expect(fallDamage(10, 0)).toBe(0);
  });
  it('grows with distance and is reduced by resistance', () => {
    const d = fallDamage(FALL_SAFE_DISTANCE + 100, 0);
    expect(d).toBeGreaterThan(0);
    expect(fallDamage(FALL_SAFE_DISTANCE + 200, 0)).toBeGreaterThan(d);
    expect(fallDamage(FALL_SAFE_DISTANCE + 100, 0.5)).toBeLessThan(d);
  });
});
