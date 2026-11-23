import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import anchorData from '../src/data/anchors.json';
import parts from '../src/data/parts.json';

const SLOTS = ['head', 'torso', 'arms', 'legs'] as const;
const atlas = JSON.parse(fs.readFileSync('public/assets/atlas.json', 'utf8')) as {
  frames: Record<string, unknown>;
};
const donors = Object.keys(parts.donors);
const A = anchorData.anchors as Record<string, Record<string, Record<string, number[]>>>;

describe('donantes', () => {
  it('hay 5 donantes con 4 piezas cada uno en el atlas', () => {
    expect(donors).toHaveLength(5);
    for (const d of donors)
      for (const s of SLOTS) expect(atlas.frames[`part_${d}_${s}`], `${d}/${s}`).toBeDefined();
  });

  it('cada donante tiene anclajes válidos dentro de su caja', () => {
    const need = {
      head: ['neck'],
      torso: ['neck', 'hip', 'shoulder'],
      arms: ['shoulder', 'tip'],
      legs: ['hip', 'ground'],
    };
    for (const d of donors)
      for (const s of SLOTS) {
        const [bw, bh] = parts.boxes[s];
        for (const k of need[s]) {
          const p = A[d][s][k];
          expect(p, `${d}/${s}/${k}`).toHaveLength(2);
          expect(p[0]).toBeGreaterThanOrEqual(0);
          expect(p[0]).toBeLessThanOrEqual(bw);
          expect(p[1]).toBeGreaterThanOrEqual(0);
          expect(p[1]).toBeLessThanOrEqual(bh);
        }
      }
  });

  it('cada donante tiene ícono de lista y hoja original', () => {
    for (const d of donors) expect(atlas.frames[`icon_${d}`], d).toBeDefined();
    for (const f of ['armadura', 'juguete', 'maniqui', 'espantapajaros', 'refrigerador'])
      expect(fs.existsSync(`assets/raw/characters/donante-${f}-parts.png`), f).toBe(true);
  });
});
