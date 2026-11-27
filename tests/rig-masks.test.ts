import { beforeAll, describe, expect, it } from 'vitest';
import parts from '../src/data/parts.json';
import rigData from '../src/data/rig.json';
import {
  detectHeadNeckX,
  detectTorsoHipX,
  detectTorsoNeck,
  loadFrames,
  rowsExtent,
} from '../scripts/rig-detect.mjs';
import { backArmRotation, RIG, solveRig, type Placement } from '../src/core/rig';
import type { Selection } from '../src/core/stats';

/**
 * Pruebas por pares sobre las máscaras de alfa REALES del atlas (25 pares por relación en vez de las 625 combinaciones).
 * Las coordenadas del mundo salen de solveRig y las máscaras se miden aparte de las anclas.
 */
interface Frame {
  m: Uint8Array;
  lum: Uint8Array;
  w: number;
  h: number;
}
const DONORS = Object.keys(parts.donors);
const SLOTS = ['head', 'torso', 'arms', 'legs'] as const;
let F: Record<string, Frame>;
beforeAll(async () => {
  F = (await loadFrames(DONORS.flatMap((d) => SLOTS.map((s) => `part_${d}_${s}`)))) as Record<string, Frame>;
});

const piece = (donor: string, slot: (typeof SLOTS)[number]) => F[`part_${donor}_${slot}`];
const bboxOf = (donor: string, slot: (typeof SLOTS)[number]) => RIG.pieces[donor][slot].bbox;
const sel = (o: Partial<Selection>): Selection => ({
  head: 'armadura',
  torso: 'armadura',
  arms: 'armadura',
  legs: 'armadura',
  ...o,
});

/** Primera y última fila opaca (y del mundo) de una pieza colocada dentro de las columnas [xa, xb]. */
function rowRange(p: Placement, f: Frame, bbox: readonly number[], xa: number, xb: number): [number, number] {
  let top = Infinity;
  let bottom = -Infinity;
  for (let y = bbox[1]; y <= bbox[3]; y++)
    for (let x = bbox[0]; x <= bbox[2]; x++) {
      const wx = p.x - p.originX + x;
      if (wx < xa || wx > xb || !f.m[y * f.w + x]) continue;
      const wy = p.y - p.originY + y;
      if (wy < top) top = wy;
      if (wy > bottom) bottom = wy;
    }
  return [top, bottom];
}

describe('cabeza × torso (25 pares)', () => {
  for (const head of DONORS)
    for (const torso of DONORS) {
      it(`${head} sobre ${torso}: el cuello coincide y el solape vertical es 4–16 px`, () => {
        const r = solveRig(sel({ head, torso }));
        // Medición aparte sobre las máscaras: centro del muñón (o del cuerpo inferior) y del cuello del torso, en x del mundo.
        const hx = r.head.x + (detectHeadNeckX(piece(head, 'head'), bboxOf(head, 'head'), head) as number);
        const tx = r.torso.x + (detectTorsoNeck(piece(torso, 'torso'), bboxOf(torso, 'torso'))[0] as number);
        expect(Math.abs(hx - tx), 'centro del muñón vs abertura').toBeLessThanOrEqual(2);
        // Traslape vertical de las dos máscaras en la columna del cuello.
        const band: [number, number] = [tx - 10, tx + 10];
        const h = rowRange(r.head, piece(head, 'head'), bboxOf(head, 'head'), ...band);
        const t = rowRange(r.torso, piece(torso, 'torso'), bboxOf(torso, 'torso'), ...band);
        const overlap = h[1] - t[0] + 1;
        expect(overlap, `solape ${overlap}`).toBeGreaterThanOrEqual(4);
        expect(overlap, `solape ${overlap}`).toBeLessThanOrEqual(16);
        expect(r.head.layer).toBeGreaterThan(r.torso.layer);
      });
    }
});

describe('torso × piernas (25 pares)', () => {
  for (const torso of DONORS)
    for (const legs of DONORS) {
      it(`${torso} sobre ${legs}: solape vertical ≥ 4 px, piernas detrás`, () => {
        const r = solveRig(sel({ torso, legs }));
        const nx = r.torso.x + RIG.pieces[torso].torso.hip[0];
        const t = rowRange(r.torso, piece(torso, 'torso'), bboxOf(torso, 'torso'), nx - 12, nx + 12);
        const l = rowRange(r.legs, piece(legs, 'legs'), bboxOf(legs, 'legs'), nx - 40, nx + 40);
        expect(t[1] - l[0] + 1).toBeGreaterThanOrEqual(4);
        expect(r.legs.layer).toBeLessThan(r.torso.layer);
      });
    }
});

/** Centro entre los dos pies de una pieza de piernas, medido en su máscara (aparte de las anclas guardadas). */
function feetCenter(donor: string): number {
  const f = piece(donor, 'legs');
  const bb = bboxOf(donor, 'legs');
  const split = RIG.pieces[donor].legs.split;
  const cen = (from: number, to: number): number => {
    let s = 0;
    let n = 0;
    for (let y = bb[3] - 20; y <= bb[3]; y++)
      for (let x = from; x <= to; x++)
        if (f.m[y * f.w + x]) {
          s += x;
          n++;
        }
    return s / n;
  };
  return (cen(bb[0], split - 1) + cen(split, bb[2])) / 2;
}

describe('torso × piernas: centradas (25 pares)', () => {
  for (const torso of DONORS)
    for (const legs of DONORS) {
      it(`${torso} sobre ${legs}: el centro de los pies coincide con el centro de la base del torso (≤ 2 px)`, () => {
        const r = solveRig(sel({ torso, legs }));
        const legsCenter = r.legs.x + feetCenter(legs);
        const baseCenter =
          r.torso.x + (detectTorsoHipX(piece(torso, 'torso'), bboxOf(torso, 'torso')) as number);
        expect(
          Math.abs(legsCenter - baseCenter),
          `pies ${legsCenter} base ${baseCenter}`,
        ).toBeLessThanOrEqual(2);
        // el traslape vertical se mantiene en 4 px o más
        const nx = baseCenter;
        const t = rowRange(r.torso, piece(torso, 'torso'), bboxOf(torso, 'torso'), nx - 12, nx + 12);
        const l = rowRange(r.legs, piece(legs, 'legs'), bboxOf(legs, 'legs'), nx - 40, nx + 40);
        expect(t[1] - l[0] + 1).toBeGreaterThanOrEqual(4);
      });
    }
});

/** Píxeles opacos compartidos entre la máscara del torso y la de un brazo (girado). */
function sharedPixels(
  torso: string,
  arms: string,
  r: ReturnType<typeof solveRig>,
  arm: Placement,
  rotation: number,
): number {
  const tf = piece(torso, 'torso');
  const af = piece(arms, 'arms');
  const ab = bboxOf(arms, 'arms');
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  let n = 0;
  for (let y = ab[1]; y <= ab[3]; y++)
    for (let x = ab[0]; x <= ab[2]; x++) {
      if (!af.m[y * af.w + x]) continue;
      const dx = (x - arm.originX) * arm.scale;
      const dy = (y - arm.originY) * arm.scale;
      const wx = Math.round(arm.x + dx * c - dy * s) - Math.round(r.torso.x);
      const wy = Math.round(arm.y + dx * s + dy * c) - Math.round(r.torso.y);
      if (wx >= 0 && wy >= 0 && wx < tf.w && wy < tf.h && tf.m[wy * tf.w + wx]) n++;
    }
  return n;
}

describe('torso × brazos (25 pares por lado)', () => {
  for (const torso of DONORS)
    for (const arms of DONORS) {
      it(`${torso} + brazo ${arms}: ambos en su hombro, los dos delante del torso y el delantero encima del trasero`, () => {
        const r = solveRig(sel({ torso, arms }));
        const a = RIG.pieces[torso].torso;
        // el centro de la articulación coincide con el del hueco (1 px o menos) en los dos lados
        expect(Math.abs(r.arm.x - (r.torso.x + a.shoulderFront[0]))).toBeLessThanOrEqual(1);
        expect(Math.abs(r.arm.y - (r.torso.y + a.shoulderFront[1]))).toBeLessThanOrEqual(1);
        expect(Math.abs(r.armBack.x - (r.torso.x + a.shoulderBack[0]))).toBeLessThanOrEqual(1);
        expect(Math.abs(r.armBack.y - (r.torso.y + a.shoulderBack[1]))).toBeLessThanOrEqual(1);
        // los huecos son arte real del torso: los dos pivotes caen sobre píxeles opacos del torso
        const tf = piece(torso, 'torso');
        for (const p of [a.shoulderFront, a.shoulderBack])
          expect(tf.m[p[1] * tf.w + p[0]], `socket ${p}`).toBe(1);
        // las máscaras de los brazos tocan la del torso (el delantero en reposo y el trasero colgando)
        expect(sharedPixels(torso, arms, r, r.arm, 0)).toBeGreaterThan(20);
        const hang = backArmRotation(r, 0, 0, 0);
        expect(sharedPixels(torso, arms, r, r.armBack, hang)).toBeGreaterThan(20);
        // orden de capas: brazo trasero, torso, brazo delantero
        expect(r.armBack.layer).toBeGreaterThan(r.torso.layer);
        expect(r.arm.layer).toBeGreaterThan(r.armBack.layer);
        expect(r.head.layer).toBeGreaterThan(r.arm.layer);
        expect(r.arm.layer).toBeGreaterThan(r.torso.layer);
      });
    }
});

describe('brazo trasero (datos)', () => {
  it('cuelga hacia abajo y un poco hacia afuera en reposo', () => {
    expect(RIG.backArm.restDeg).toBeLessThan(-90);
    expect(RIG.backArm.restDeg).toBeGreaterThan(-135);
  });

  it('al apuntar sigue al delantero con su desfase', () => {
    const r = solveRig(sel({}));
    const follow = backArmRotation(r, 30, 1, 0);
    const front = -(30 * Math.PI) / 180 - Math.atan2(r.armVec[1], r.armVec[0]);
    expect(follow - front).toBeCloseTo(-(RIG.backArm.followOffsetDeg * Math.PI) / 180, 6);
  });

  it('el encuadre incluye el brazo trasero colgando y cabe en el Laboratorio', () => {
    for (const torso of DONORS)
      for (const arms of DONORS) {
        const r = solveRig(sel({ torso, arms }));
        expect(r.bounds[2] - r.bounds[0]).toBeLessThanOrEqual(560);
        expect(r.height).toBeLessThanOrEqual(480);
      }
  });
});

describe('anclajes y datos', () => {
  it('los anclajes guardados coinciden con la medición de los píxeles (salvo ajustes manuales)', () => {
    const manual = (rigData as { manual: Record<string, unknown> }).manual;
    for (const d of DONORS) {
      const hn = RIG.pieces[d].head.neck;
      const dx = detectHeadNeckX(piece(d, 'head'), bboxOf(d, 'head'), d) as number;
      if (!manual[`${d}.head.neck`]) expect(Math.abs(hn[0] - dx), `${d} head`).toBeLessThanOrEqual(1);
      const tn = RIG.pieces[d].torso.neck;
      const [tx, ty] = detectTorsoNeck(piece(d, 'torso'), bboxOf(d, 'torso')) as [number, number];
      if (!manual[`${d}.torso.neck`]) {
        expect(Math.abs(tn[0] - tx), `${d} torso x`).toBeLessThanOrEqual(1);
        expect(Math.abs(tn[1] - ty), `${d} torso y`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('cada cabeza declara su profundidad de cuello y los sombreros no cuentan en el cuello', () => {
    for (const d of DONORS) expect(RIG.pieces[d].head.neckDepth).toBeGreaterThanOrEqual(0);
    // el plumero y el sombrero ensanchan la caja de la cabeza, pero el ancla del cuello no es el centro de la caja
    for (const d of ['armadura', 'espantapajaros']) {
      const bb = RIG.pieces[d].head.bbox;
      const boxCenter = (bb[0] + bb[2]) / 2;
      expect(Math.abs(RIG.pieces[d].head.neck[0] - boxCenter)).toBeGreaterThan(5);
    }
    expect(rowsExtent).toBeTypeOf('function');
  });
});

/** Píxeles del mundo de una máscara de brazo (escalada y girada) que caen sobre una máscara de piernas. */
function armOnLegs(
  arms: string,
  legs: string,
  r: ReturnType<typeof solveRig>,
  arm: Placement,
  rotation: number,
): number {
  const af = piece(arms, 'arms');
  const ab = bboxOf(arms, 'arms');
  const lf = piece(legs, 'legs');
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  let n = 0;
  for (let y = ab[1]; y <= ab[3]; y++)
    for (let x = ab[0]; x <= ab[2]; x++) {
      if (!af.m[y * af.w + x]) continue;
      const dx = (x - arm.originX) * arm.scale;
      const dy = (y - arm.originY) * arm.scale;
      const lx = Math.round(arm.x + dx * c - dy * s - r.legs.x);
      const ly = Math.round(arm.y + dx * s + dy * c - r.legs.y);
      if (lx >= 0 && ly >= 0 && lx < lf.w && ly < lf.h && lf.m[ly * lf.w + lx]) n++;
    }
  return n;
}

describe('brazos normalizados (armScale) y brazo trasero recogido', () => {
  for (const torso of DONORS)
    for (const arms of DONORS) {
      it(`brazo ${arms} en torso ${torso}: largo entre 0,9 y 1,1 veces la altura del torso`, () => {
        const r = solveRig(sel({ torso, arms }));
        const tb = bboxOf(torso, 'torso');
        const torsoH = tb[3] - tb[1] + 1;
        const ratio = Math.hypot(r.armVec[0], r.armVec[1]) / torsoH;
        expect(ratio).toBeGreaterThanOrEqual(0.9);
        expect(ratio).toBeLessThanOrEqual(1.1);
        // el brazo trasero se dibuja al 90 % del delantero
        expect(
          Math.hypot(r.armBackVec[0], r.armBackVec[1]) / Math.hypot(r.armVec[0], r.armVec[1]),
        ).toBeCloseTo(RIG.backArm.scale, 6);
      });
    }

  for (const arms of DONORS)
    for (const legs of DONORS) {
      it(`brazo trasero ${arms} en reposo: la punta queda sobre el suelo y no cruza las piernas ${legs}`, () => {
        const r = solveRig(sel({ torso: 'espantapajaros', arms, legs }));
        const rot = backArmRotation(r, 0, 0, 0);
        const dir = rot + Math.atan2(r.armBackVec[1], r.armBackVec[0]); // es -restDeg en radianes
        void dir;
        const tipX = r.armBack.x + r.armBackVec[0] * Math.cos(rot) - r.armBackVec[1] * Math.sin(rot);
        const tipY = r.armBack.y + r.armBackVec[0] * Math.sin(rot) + r.armBackVec[1] * Math.cos(rot);
        expect(tipY, `punta ${tipX},${tipY}`).toBeLessThan(-6); // sobre el suelo (y = 0)
        expect(
          armOnLegs(arms, legs, r, r.armBack, rot),
          'píxeles del brazo sobre las piernas',
        ).toBeLessThanOrEqual(25);
      });
    }
});
