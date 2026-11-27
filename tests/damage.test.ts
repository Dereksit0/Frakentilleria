import { describe, it, expect } from 'vitest';
import { calcDamage, explosionFalloff, fallDamage, FALL_SAFE_DISTANCE } from '../src/core/damage';

describe('calcDamage = base × (1 + bonus) × (1 − resistance)', () => {
  it('da el daño base si no hay modificadores', () => {
    expect(calcDamage(30, 0, 0)).toBe(30);
  });
  it('aplica el bono de daño', () => {
    expect(calcDamage(30, 0.08, 0)).toBe(32); // 32.4 -> 32
  });
  it('aplica la resistencia', () => {
    expect(calcDamage(40, 0, 0.1)).toBe(36);
  });
  it('combina las dos cosas', () => {
    expect(calcDamage(30, 0.5, 0.5)).toBe(23); // 22.5 -> 23
  });
  it('nunca es negativo y la resistencia tiene tope de 90 %', () => {
    expect(calcDamage(30, 0, 2)).toBe(3);
    expect(calcDamage(-5, 0, 0)).toBe(0);
  });
});

describe('explosionFalloff', () => {
  it('vale 1 en el centro y 0 fuera del radio', () => {
    expect(explosionFalloff(0, 80)).toBe(1);
    expect(explosionFalloff(80, 80)).toBe(0);
    expect(explosionFalloff(120, 80)).toBe(0);
  });
  it('baja de forma continua pero dentro del radio conserva un mínimo', () => {
    const a = explosionFalloff(10, 80);
    const b = explosionFalloff(60, 80);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThanOrEqual(0.3);
  });
});

describe('fallDamage', () => {
  it('es cero hasta la distancia segura', () => {
    expect(fallDamage(FALL_SAFE_DISTANCE, 0)).toBe(0);
    expect(fallDamage(10, 0)).toBe(0);
  });
  it('crece con la distancia y la resistencia lo reduce', () => {
    const d = fallDamage(FALL_SAFE_DISTANCE + 100, 0);
    expect(d).toBeGreaterThan(0);
    expect(fallDamage(FALL_SAFE_DISTANCE + 200, 0)).toBeGreaterThan(d);
    expect(fallDamage(FALL_SAFE_DISTANCE + 100, 0.5)).toBeLessThan(d);
  });
});
