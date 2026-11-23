import { DONOR_IDS, SLOTS } from './data';
import type { Selection } from './stats';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols, no I/O/0/1

function checksum(head: string): string {
  let h = 7;
  for (const ch of head) h = (h * 31 + ALPHA.indexOf(ch) + 1) & 0xfffff;
  let out = '';
  for (let j = 0; j < 4; j++) out += ALPHA[(h >> (5 * j)) & 31];
  return out;
}

/** 8-char creature code: 4 obfuscated donor symbols + 4 checksum symbols. */
export function encodeDna(sel: Selection): string {
  const digits = SLOTS.map((s) => DONOR_IDS.indexOf(sel[s]));
  const n = digits.reduce((a, d) => a * 5 + d, 0);
  let head = '';
  digits.forEach((d, i) => {
    head += ALPHA[d + 5 * ((n * 7 + i * 3) % 6)];
  });
  return head + checksum(head);
}

export function decodeDna(code: string): Selection | null {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(c)) return null;
  const head = c.slice(0, 4);
  if (checksum(head) !== c.slice(4)) return null;
  const sel = {} as Selection;
  for (let i = 0; i < 4; i++) {
    const idx = ALPHA.indexOf(head[i]);
    if (idx < 0) return null;
    sel[SLOTS[i]] = DONOR_IDS[idx % 5];
  }
  return sel;
}
