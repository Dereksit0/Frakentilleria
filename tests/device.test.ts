import { describe, it, expect } from 'vitest';
import { detectMobile } from '../src/ui/device';

describe('detectMobile', () => {
  it('narrow windows are mobile', () => {
    expect(detectMobile(900, 500, false)).toBe(true);
    expect(detectMobile(390, 844, false)).toBe(true);
  });
  it('touch with a short side <= 600 is mobile (landscape phones)', () => {
    expect(detectMobile(1200, 600, true)).toBe(true);
    expect(detectMobile(1000, 590, true)).toBe(true);
  });
  it('desktop and large tablets are not mobile', () => {
    expect(detectMobile(1920, 1080, false)).toBe(false);
    expect(detectMobile(1180, 820, true)).toBe(false);
    expect(detectMobile(1200, 600, false)).toBe(false);
  });
});
