import { describe, it, expect } from 'vitest';
import { isIOSUserAgent } from '../src/ui/fullscreen';

describe('isIOSUserAgent', () => {
  it('detecta Safari de iPhone y iPad', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIOSUserAgent('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')).toBe(true);
  });
  it('detecta un iPadOS que se presenta como Mac pero tiene pantalla táctil', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIOSUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
  });
  it('da falso en Android y en escritorio', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/120')).toBe(false);
    expect(isIOSUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe(false);
  });
});
