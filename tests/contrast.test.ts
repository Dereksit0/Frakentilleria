import { describe, it, expect } from 'vitest';
import { contrastRatio, luminance } from '../src/core/contrast';
import { CONTRAST_PAIRS } from '../src/ui/theme';

describe('contrast helpers', () => {
  it('black on white is 21:1 and identical colours are 1:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
  });
});

describe('theme accessibility (WCAG 4.5:1)', () => {
  for (const p of CONTRAST_PAIRS) {
    it(`${p.name} >= 4.5`, () => {
      expect(contrastRatio(p.fg, p.bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
