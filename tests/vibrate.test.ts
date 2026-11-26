import { afterEach, describe, expect, it, vi } from 'vitest';
import { vibrate } from '../src/ui/settings';

/** On some WebKit builds `'vibrate' in navigator` is true while the value is undefined: that threw and froze the game. */
describe('vibrar al recibir un golpe', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('no lanza si navigator.vibrate existe pero está indefinido (WebKit)', () => {
    vi.stubGlobal('navigator', { vibrate: undefined });
    expect(() => vibrate(40)).not.toThrow();
  });

  it('no lanza si navigator no tiene vibrate (iPhone)', () => {
    vi.stubGlobal('navigator', {});
    expect(() => vibrate(40)).not.toThrow();
  });

  it('usa vibrate cuando existe', () => {
    const spy = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate: spy });
    vibrate(40);
    expect(spy).toHaveBeenCalledWith(40);
  });
});
