import { describe, it, expect } from 'vitest';
import { encodeDna, decodeDna } from '../src/core/dna';
import type { Selection } from '../src/core/stats';

const s: Selection = { head: 'juguete', torso: 'refri', arms: 'armadura', legs: 'espantapajaros' };

describe('ADN code', () => {
  it('is 8 chars, uppercase alphanumeric', () => {
    expect(encodeDna(s)).toMatch(/^[A-Z0-9]{8}$/);
  });
  it('round-trips', () => {
    expect(decodeDna(encodeDna(s))).toEqual(s);
  });
  it('accepts lowercase and surrounding spaces', () => {
    expect(decodeDna('  ' + encodeDna(s).toLowerCase() + ' ')).toEqual(s);
  });
  it('rejects wrong length, bad chars and bad checksum', () => {
    expect(decodeDna('ABC12')).toBeNull();
    expect(decodeDna('')).toBeNull();
    expect(decodeDna('!!!!!!!!')).toBeNull();
    const code = encodeDna(s);
    const tampered = code.slice(0, 7) + (code[7] === 'A' ? 'B' : 'A');
    expect(decodeDna(tampered)).toBeNull();
  });
  it('round-trips all 625 combinations', () => {
    const d = ['armadura', 'espantapajaros', 'maniqui', 'juguete', 'refri'];
    for (const a of d)
      for (const b of d)
        for (const c of d)
          for (const e of d) {
            const x = { head: a, torso: b, arms: c, legs: e } as Selection;
            expect(decodeDna(encodeDna(x))).toEqual(x);
          }
  });
});
