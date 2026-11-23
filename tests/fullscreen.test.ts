import { describe, it, expect } from 'vitest';
import { isIOSUserAgent } from '../src/ui/fullscreen';

describe('isIOSUserAgent', () => {
  it('detects iPhone and iPad Safari', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIOSUserAgent('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')).toBe(true);
  });
  it('detects iPadOS that reports as a Mac but has touch', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIOSUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
  });
  it('is false for Android and desktop', () => {
    expect(isIOSUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/120')).toBe(false);
    expect(isIOSUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe(false);
  });
});
