import rigJson from '../data/rig.json';
import { DONOR_IDS, PARTS, type Slot } from './data';
import type { Selection } from './stats';

/**
 * Pure creature rig: where every piece goes, in which layer, and how the front arm pivots. No Phaser.
 *
 * Creature space: origin = centre of the feet on the ground, x right, y DOWN (so the head is at negative y).
 * Every anchor is a pixel inside its own piece frame (see src/data/rig.json and scripts/rig-anchors.mjs).
 *
 *   legs  (behind)  hipTop  = torso.hip, sunk `overlap.hip` px into the torso so no gap can show
 *   torso (root)
 *   head  (on top)  head.neck = torso.neck, sunk `overlap.neck` px
 *   arm   (front)   arm.shoulder = torso.shoulderFront; rotates around that pivot to aim
 *   armBack (in front of the torso, behind the front arm) second arm on torso.shoulderBack, visual only
 */
export type Pt = readonly [number, number];
type Box = readonly [number, number, number, number];

export interface RigPieces {
  head: {
    bbox: Box;
    neck: Pt;
    /** px the bottom of the head sinks below the torso neck anchor */ neckDepth?: number;
  };
  torso: { bbox: Box; neck: Pt; hip: Pt; shoulderFront: Pt; shoulderBack: Pt };
  arms: { bbox: Box; shoulder: Pt; muzzle: Pt };
  legs: { bbox: Box; hipTop: Pt; ground: Pt; hipSpacing: number; split: number };
}
/** Visual-only second arm (angles in degrees, 0 = right, 90 = up). */
export interface BackArmData {
  /** Direction the arm hangs in when resting (down and a bit outwards). */
  restDeg: number;
  /** Added to the front arm's aim while aiming. */
  followOffsetDeg: number;
  /** Darkening of the art (0.85 = 85 % brightness). */
  tint: number;
  /** Walk swing, rad (opposite to the front arm). */
  walkSwing: number;
  /** Hurt shake, rad. */
  hurtShake: number;
}
export interface RigData {
  overlap: { neck: number; hip: number };
  backArm: BackArmData;
  manual?: Record<string, Pt>;
  pieces: Record<string, RigPieces>;
}

/** Sized area the Lab reserves for a creature at scale 1 (px). */
export const LAB_FRAME = { width: 560, height: 480 } as const;

const REQUIRED: Record<Slot, string[]> = {
  head: ['neck'],
  torso: ['neck', 'hip', 'shoulderFront', 'shoulderBack'],
  arms: ['shoulder', 'muzzle'],
  legs: ['hipTop', 'ground'],
};

const isPt = (p: unknown): p is Pt =>
  Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v));

/** Fails loudly (naming the donor.slot.anchor) when any anchor is missing or outside its frame. */
export function validateRig(data: RigData, donors: readonly string[] = DONOR_IDS): void {
  if (!data?.overlap || !(data.overlap.neck >= 0) || !(data.overlap.hip >= 0))
    throw new Error('rig.json: falta "overlap" (neck, hip)');
  const ba = data.backArm as Partial<BackArmData> | undefined;
  for (const k of ['restDeg', 'followOffsetDeg', 'tint', 'walkSwing', 'hurtShake'] as const)
    if (typeof ba?.[k] !== 'number') throw new Error(`rig.json: falta "backArm.${k}"`);
  for (const d of donors) {
    const piece = data.pieces?.[d];
    if (!piece) throw new Error(`rig.json: falta el donante "${d}"`);
    for (const slot of Object.keys(REQUIRED) as Slot[]) {
      const s = piece[slot] as unknown as Record<string, unknown> | undefined;
      if (!s) throw new Error(`rig.json: falta la pieza "${d}.${slot}"`);
      if (!Array.isArray(s.bbox) || s.bbox.length !== 4)
        throw new Error(`rig.json: falta "${d}.${slot}.bbox"`);
      const [bw, bh] = PARTS.boxes[slot];
      for (const a of REQUIRED[slot]) {
        const p = s[a];
        if (!isPt(p)) throw new Error(`rig.json: falta el anclaje "${d}.${slot}.${a}"`);
        if (p[0] < 0 || p[1] < 0 || p[0] > bw || p[1] > bh)
          throw new Error(`rig.json: "${d}.${slot}.${a}" cae fuera de la caja ${bw}×${bh}`);
      }
      if (slot === 'legs' && !(typeof s.hipSpacing === 'number' && s.hipSpacing > 0))
        throw new Error(`rig.json: falta "${d}.legs.hipSpacing"`);
      if (slot === 'legs' && typeof s.split !== 'number')
        throw new Error(`rig.json: falta "${d}.legs.split"`);
    }
  }
}

/** Applies the hand calibrations ("donor.slot.anchor" keys) over the detected anchors, then validates. */
export function loadRig(raw: RigData, donors: readonly string[] = DONOR_IDS): RigData {
  const data = JSON.parse(JSON.stringify(raw)) as RigData;
  for (const [key, pt] of Object.entries(data.manual ?? {})) {
    const [d, slot, anchor] = key.split('.');
    const target = data.pieces[d]?.[slot as Slot] as unknown as Record<string, unknown> | undefined;
    if (!target) throw new Error(`rig.json: ajuste manual con clave desconocida "${key}"`);
    target[anchor] = pt;
  }
  validateRig(data, donors);
  return data;
}

export const RIG: RigData = loadRig(rigJson as unknown as RigData);

export interface Placement {
  /** World position of the piece's pivot (origin pixel). */
  x: number;
  y: number;
  /** Pivot inside the frame, px (0,0 = top-left for everything except the arms). */
  originX: number;
  originY: number;
  /** Frame size, px. */
  w: number;
  h: number;
  /** Opaque body box inside the frame, [x0, y0, x1, y1] px; the view crops the frame to it (drops stray leftovers). */
  bbox: Box;
  /** Draw order, low = behind. */
  layer: number;
  rotation: number;
}

export interface SolvedRig {
  legs: Placement;
  torso: Placement;
  head: Placement;
  /** Front arm, pivot on the torso's front shoulder. */
  arm: Placement;
  /** Second arm (visual only), pivot on the torso's back shoulder, drawn behind the torso. */
  armBack: Placement;
  /** World hip points of each leg (for walking), `hipSpacing` apart. */
  hipL: Pt;
  hipR: Pt;
  /** Column (in the legs frame) that separates the left from the right leg. */
  legSplit: number;
  /** Opaque bounds of the assembled creature [x0, y0, x1, y1] (arm at rest included). */
  bounds: [number, number, number, number];
  /** Feet-to-top-of-head, px. Drives the health-bar height and the collision box of the view. */
  height: number;
  headTop: number;
  feet: Pt;
  /** Shoulder→hand vector of the arm art at rest, px. */
  armVec: Pt;
  /** Pivot points handy for animation (world). */
  neck: Pt;
  hip: Pt;
}

export const LAYER = { legs: 0, torso: 2, armBack: 3, arm: 4, head: 5 } as const;

function frame(slot: Slot): { w: number; h: number } {
  const [w, h] = PARTS.boxes[slot];
  return { w, h };
}

/** Assembles a creature: torso is the root, legs hide behind it, head sits on top, the arm pivots on the shoulder. */
export function solveRig(sel: Selection, rig: RigData = RIG): SolvedRig {
  const pH = rig.pieces[sel.head]?.head;
  const pT = rig.pieces[sel.torso]?.torso;
  const pA = rig.pieces[sel.arms]?.arms;
  const pL = rig.pieces[sel.legs]?.legs;
  if (!pH || !pT || !pA || !pL)
    throw new Error(`rig: selección con donante sin anclajes (${JSON.stringify(sel)})`);

  // Legs: ground point on the origin.
  const legs: Placement = {
    ...frame('legs'),
    x: -pL.ground[0],
    y: -(pL.ground[1] + 1),
    originX: 0,
    originY: 0,
    bbox: pL.bbox,
    layer: LAYER.legs,
    rotation: 0,
  };
  const hipWorld: Pt = [pL.hipTop[0] - pL.ground[0], pL.hipTop[1] - pL.ground[1] - 1]; // top of the legs
  // The torso hip sits `overlap.hip` below the top of the legs, so the legs run up behind the torso.
  const torsoHip: Pt = [hipWorld[0], hipWorld[1] + rig.overlap.hip];
  const torso: Placement = {
    ...frame('torso'),
    x: torsoHip[0] - pT.hip[0],
    y: torsoHip[1] - pT.hip[1],
    originX: 0,
    originY: 0,
    bbox: pT.bbox,
    layer: LAYER.torso,
    rotation: 0,
  };
  // Head: its neck on the torso's neck, pushed `overlap.neck` into the torso.
  const neck: Pt = [torso.x + pT.neck[0], torso.y + pT.neck[1] + (pH.neckDepth ?? rig.overlap.neck)];
  const head: Placement = {
    ...frame('head'),
    x: neck[0] - pH.neck[0],
    y: neck[1] - pH.neck[1],
    originX: 0,
    originY: 0,
    bbox: pH.bbox,
    layer: LAYER.head,
    rotation: 0,
  };
  // Arms: pivot = the arm's own shoulder point, placed on the torso's shoulder anchor.
  const mkArm = (sh: Pt, layer: number): Placement => ({
    ...frame('arms'),
    x: torso.x + sh[0],
    y: torso.y + sh[1],
    originX: pA.shoulder[0],
    originY: pA.shoulder[1],
    bbox: pA.bbox,
    layer,
    rotation: 0,
  });
  const arm = mkArm(pT.shoulderFront, LAYER.arm);
  const armBack = mkArm(pT.shoulderBack, LAYER.armBack);

  const hang = rotatedBox(armBack, restRotation(r0(pA.muzzle, pA.shoulder), rig.backArm.restDeg));
  const boxes = [legs, torso, head, arm].map(worldBox).concat([hang]);
  const body = [legs, torso, head].map(worldBox);
  const bounds: [number, number, number, number] = [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
  const top = Math.min(...body.map((b) => b[1]));
  return {
    legs,
    torso,
    head,
    arm,
    armBack,
    hipL: [hipWorld[0] - pL.hipSpacing / 2, hipWorld[1]],
    hipR: [hipWorld[0] + pL.hipSpacing / 2, hipWorld[1]],
    legSplit: pL.split,
    armVec: [pA.muzzle[0] - pA.shoulder[0], pA.muzzle[1] - pA.shoulder[1]],
    bounds,
    height: -top,
    headTop: top,
    feet: [0, 0],
    neck,
    hip: torsoHip,
  };
}

/** World box of the opaque pixels of a piece placed at rest. */
export function worldBox(p: Placement): [number, number, number, number] {
  const ox = p.x - p.originX;
  const oy = p.y - p.originY;
  return [ox + p.bbox[0], oy + p.bbox[1], ox + p.bbox[2] + 1, oy + p.bbox[3] + 1];
}

export interface ArmPose {
  /** Rotation (rad) to apply to the arm image around its shoulder pivot. */
  rotation: number;
  /** World position of the hand / muzzle in creature space (facing right, before the view's mirror). */
  muzzle: [number, number];
}

/** Local aim angle: the view mirrors the creature when it faces left, so aim is measured from the facing side. */
export const localAim = (aimDeg: number, facing: 1 | -1): number => (facing > 0 ? aimDeg : 180 - aimDeg);

/**
 * Rotation that makes the arm's shoulder→tip axis point exactly along `aimDeg` (0 = right, 90 = up), and the resulting
 * muzzle position. The art is not drawn perfectly horizontal, so its rest angle is subtracted.
 */
export function armPose(r: SolvedRig, aimDeg: number): ArmPose {
  const [vx, vy] = r.armVec;
  const rotation = -(aimDeg * Math.PI) / 180 - Math.atan2(vy, vx);
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return { rotation, muzzle: [r.arm.x + vx * c - vy * s, r.arm.y + vx * s + vy * c] };
}

const r0 = (muzzle: Pt, shoulder: Pt): Pt => [muzzle[0] - shoulder[0], muzzle[1] - shoulder[1]];

/** Image rotation that makes an arm whose art points along `vec` point in direction `deg` (0 = right, 90 = up). */
function restRotation(vec: Pt, deg: number): number {
  return -(deg * Math.PI) / 180 - Math.atan2(vec[1], vec[0]);
}

/** World box of a piece rotated around its pivot. */
function rotatedBox(p: Placement, rotation: number): [number, number, number, number] {
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [px, py] of [
    [p.bbox[0], p.bbox[1]],
    [p.bbox[2] + 1, p.bbox[1]],
    [p.bbox[0], p.bbox[3] + 1],
    [p.bbox[2] + 1, p.bbox[3] + 1],
  ]) {
    const dx = px - p.originX;
    const dy = py - p.originY;
    const x = p.x + dx * c - dy * s;
    const y = p.y + dx * s + dy * c;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

/**
 * Image rotation of the back arm. `mode` blends between hanging (0) and following the front arm's aim (1);
 * `extra` (rad) is added by the animations (walk swing, hurt shake, victory).
 */
export function backArmRotation(
  r: SolvedRig,
  aimDeg: number,
  mode: number,
  extra: number,
  rig: RigData = RIG,
): number {
  const b = rig.backArm;
  const dir = b.restDeg + (aimDeg + b.followOffsetDeg - b.restDeg) * mode;
  return restRotation(r.armVec, dir) + extra;
}
