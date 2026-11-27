import { describe, it, expect } from 'vitest';
import { detectMobile } from '../src/ui/device';

describe('detectMobile', () => {
  it('las ventanas angostas son móvil', () => {
    expect(detectMobile(900, 500, false)).toBe(true);
    expect(detectMobile(390, 844, false)).toBe(true);
  });
  it('táctil con lado corto de 600 o menos es móvil (teléfonos en horizontal)', () => {
    expect(detectMobile(1200, 600, true)).toBe(true);
    expect(detectMobile(1000, 590, true)).toBe(true);
  });
  it('el escritorio y las tabletas grandes no son móvil', () => {
    expect(detectMobile(1920, 1080, false)).toBe(false);
    expect(detectMobile(1180, 820, true)).toBe(false);
    expect(detectMobile(1200, 600, false)).toBe(false);
  });
});
