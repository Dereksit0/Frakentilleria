import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import sharp from 'sharp';
import parts from '../src/data/parts.json';
import rigData from '../src/data/rig.json';
import { armPose, LAB_FRAME, loadRig, RIG, solveRig, validateRig, type Placement } from '../src/core/rig';
import type { Selection } from '../src/core/stats';

const DONORS = Object.keys(parts.donors);
const SLOTS = ['head', 'torso', 'arms', 'legs'] as const;

function* combos(): Generator<Selection> {
  for (const head of DONORS)
    for (const torso of DONORS)
      for (const arms of DONORS) for (const legs of DONORS) yield { head, torso, arms, legs } as Selection;
}

/** World box [x0, y0, x1, y1] of the opaque pixels of a placed piece (rest pose, no rotation). */
function box(p: Placement): [number, number, number, number] {
  return [
    p.x - p.originX + p.bbox[0],
    p.y - p.originY + p.bbox[1],
    p.x - p.originX + p.bbox[2] + 1,
    p.y - p.originY + p.bbox[3] + 1,
  ];
}

describe('validación de anclajes', () => {
  it('los 5 donantes cargan completos', () => {
    expect(() => validateRig(rigData as never, DONORS)).not.toThrow();
  });

  it('un anclaje faltante falla con un mensaje claro', () => {
    const bad = JSON.parse(JSON.stringify(rigData));
    delete bad.pieces.maniqui.torso.shoulderFront;
    expect(() => validateRig(bad, DONORS)).toThrow(/maniqui\.torso\.shoulderFront/);
  });

  it('un donante sin piezas falla con su nombre', () => {
    const bad = JSON.parse(JSON.stringify(rigData));
    delete bad.pieces.refri;
    expect(() => validateRig(bad, DONORS)).toThrow(/refri/);
  });

  it('los ajustes manuales ganan sobre lo detectado', () => {
    const r = loadRig(
      { ...JSON.parse(JSON.stringify(rigData)), manual: { 'armadura.torso.shoulderFront': [11, 22] } },
      DONORS,
    );
    expect(r.pieces.armadura.torso.shoulderFront).toEqual([11, 22]);
  });
});

describe('solveRig: las 625 combinaciones', () => {
  const all = [...combos()];

  it('son 625 y ninguna lanza', () => {
    expect(all).toHaveLength(625);
    for (const sel of all) expect(() => solveRig(sel)).not.toThrow();
  });

  it('(a) torso y piernas se solapan ≥ 4 px en vertical y las piernas van detrás', () => {
    for (const sel of all) {
      const r = solveRig(sel);
      const t = box(r.torso);
      const l = box(r.legs);
      expect(t[3] - l[1], JSON.stringify(sel)).toBeGreaterThanOrEqual(4);
      expect(r.legs.layer).toBeLessThan(r.torso.layer);
    }
  });

  it('(b) cabeza y torso se solapan ≥ 3 px y la cabeza va encima', () => {
    for (const sel of all) {
      const r = solveRig(sel);
      const h = box(r.head);
      const t = box(r.torso);
      expect(h[3] - t[1], JSON.stringify(sel)).toBeGreaterThanOrEqual(3);
      expect(r.head.layer).toBeGreaterThan(r.torso.layer);
    }
  });

  it('(c) el hombro del brazo coincide con el anclaje del torso (error ≤ 1 px) y va delante', () => {
    for (const sel of all) {
      const r = solveRig(sel);
      const a = RIG.pieces[sel.torso].torso.shoulderFront;
      expect(Math.abs(r.arm.x - (r.torso.x + a[0])), JSON.stringify(sel)).toBeLessThanOrEqual(1);
      expect(Math.abs(r.arm.y - (r.torso.y + a[1]))).toBeLessThanOrEqual(1);
      expect(r.arm.layer).toBeGreaterThan(r.torso.layer);
    }
  });

  it('(d) todo es finito y los pies están en y = 0', () => {
    for (const sel of all) {
      const r = solveRig(sel);
      for (const p of [r.head, r.torso, r.arm, r.legs, ...r.bounds, r.height]) {
        for (const v of typeof p === 'number' ? [p] : Object.values(p).flat())
          if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      }
      expect(box(r.legs)[3]).toBeCloseTo(0, 5);
      expect(r.feet).toEqual([0, 0]);
      expect(r.height).toBeGreaterThan(200);
    }
  });

  it('(e) cabe en el encuadre del Laboratorio', () => {
    for (const sel of all) {
      const r = solveRig(sel);
      expect(r.height, JSON.stringify(sel)).toBeLessThanOrEqual(LAB_FRAME.height);
      expect(r.bounds[2] - r.bounds[0]).toBeLessThanOrEqual(LAB_FRAME.width);
    }
  });

  it('las dos piernas se separan por hipSpacing de cada pieza', () => {
    for (const d of DONORS) {
      const r = solveRig({ head: d, torso: d, arms: d, legs: d } as Selection);
      expect(r.hipR[0] - r.hipL[0]).toBe(RIG.pieces[d].legs.hipSpacing);
    }
  });

  it('la altura y la caja salen de las piezas ensambladas', () => {
    const a = solveRig({ head: 'armadura', torso: 'armadura', arms: 'armadura', legs: 'armadura' });
    const b = solveRig({ head: 'maniqui', torso: 'maniqui', arms: 'maniqui', legs: 'juguete' });
    expect(a.height).not.toBe(b.height);
    expect(a.headTop).toBeCloseTo(-a.height, 5);
  });
});

describe('armPose: el brazo apunta y la boquilla sale de la punta', () => {
  it('la punta queda sobre la dirección de apuntado (error < 0.05°) para todos los brazos', () => {
    for (const d of DONORS) {
      const sel = { head: d, torso: d, arms: d, legs: d } as Selection;
      const r = solveRig(sel);
      for (const aim of [-30, 0, 15, 45, 90, 135]) {
        const p = armPose(r, aim);
        const dx = p.muzzle[0] - r.arm.x;
        const dy = p.muzzle[1] - r.arm.y;
        const deg = (Math.atan2(-dy, dx) * 180) / Math.PI;
        expect(Math.abs(deg - aim), `${d} ${aim}`).toBeLessThan(0.05);
      }
    }
  });

  it('la distancia hombro-punta no cambia al rotar', () => {
    const r = solveRig({ head: 'juguete', torso: 'armadura', arms: 'refri', legs: 'maniqui' });
    const d0 = Math.hypot(armPose(r, 0).muzzle[0] - r.arm.x, armPose(r, 0).muzzle[1] - r.arm.y);
    const d1 = Math.hypot(armPose(r, 70).muzzle[0] - r.arm.x, armPose(r, 70).muzzle[1] - r.arm.y);
    expect(d1).toBeCloseTo(d0, 5);
  });
});

describe('sin huecos: el contorno ensamblado es una sola mancha', () => {
  const atlas = JSON.parse(fs.readFileSync('public/assets/atlas.json', 'utf8')) as {
    frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
  };
  const W = 700;
  const H = 700;
  const OX = 350; // creature origin (feet) in the raster
  const OY = 600;

  async function masks(): Promise<Record<string, Uint8Array>> {
    const sheet = await sharp('public/assets/atlas.png')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const out: Record<string, Uint8Array> = {};
    for (const d of DONORS)
      for (const s of SLOTS) {
        const f = atlas.frames[`part_${d}_${s}`].frame;
        const m = new Uint8Array(f.w * f.h);
        for (let y = 0; y < f.h; y++)
          for (let x = 0; x < f.w; x++)
            m[y * f.w + x] = sheet.data[((f.y + y) * sheet.info.width + f.x + x) * 4 + 3] > 40 ? 1 : 0;
        out[`${d}_${s}`] = m;
      }
    return out;
  }

  it('ninguna de las 625 combinaciones deja piezas flotando o con hueco', async () => {
    const M = await masks();
    const bad: string[] = [];
    const grid = new Uint8Array(W * H);
    const seen = new Uint8Array(W * H);
    const stack: number[] = [];
    for (const sel of combos()) {
      grid.fill(0);
      seen.fill(0);
      const r = solveRig(sel);
      for (const [slot, p, donor] of [
        ['legs', r.legs, sel.legs],
        ['torso', r.torso, sel.torso],
        ['head', r.head, sel.head],
        ['arms', r.arm, sel.arms],
      ] as const) {
        const m = M[`${donor}_${slot}`];
        const [bw] = parts.boxes[slot];
        const px = Math.round(p.x - p.originX) + OX;
        const py = Math.round(p.y - p.originY) + OY;
        for (let y = p.bbox[1]; y <= p.bbox[3]; y++)
          for (let x = p.bbox[0]; x <= p.bbox[2]; x++) if (m[y * bw + x]) grid[(py + y) * W + px + x] = 1;
      }
      // pieces smaller than 25 px² are stray antialias dust; any other second blob is a floating piece
      let blobs = 0;
      for (let i = 0; i < W * H; i++) {
        if (!grid[i] || seen[i]) continue;
        let area = 0;
        stack.push(i);
        seen[i] = 1;
        while (stack.length) {
          const j = stack.pop()!;
          area++;
          const x = j % W;
          const y = (j / W) | 0;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, -1],
            [1, -1],
            [-1, 1],
          ]) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const k = yy * W + xx;
            if (grid[k] && !seen[k]) {
              seen[k] = 1;
              stack.push(k);
            }
          }
        }
        if (area > 25) blobs++;
      }
      if (blobs !== 1) bad.push(`${sel.head}/${sel.torso}/${sel.arms}/${sel.legs}:${blobs}`);
    }
    expect(bad).toEqual([]);
  }, 120_000);
});
