import rigJson from '../data/rig.json';
import { DONOR_IDS, PARTS, type Slot } from './data';
import type { Selection } from './stats';

/**
 * Armado de la criatura sin Phaser: dónde va cada pieza, en qué capa y cómo gira el brazo delantero.
 *
 * Espacio de la criatura: origen en el centro de los pies sobre el suelo, x a la derecha, y hacia ABAJO (la cabeza queda en y negativa).
 * Cada ancla es un píxel dentro del marco de su pieza (ver src/data/rig.json y scripts/rig-anchors.mjs).
 *
 *   piernas (atrás)  hipTop = torso.hip, hundido `overlap.hip` px en el torso para que no se vea un hueco
 *   torso (raíz)
 *   cabeza (arriba)  head.neck = torso.neck, hundido `overlap.neck` px
 *   brazo (adelante) arm.shoulder = torso.shoulderFront; gira sobre ese pivote para apuntar
 *   brazo trasero (delante del torso, detrás del delantero) en torso.shoulderBack, solo visual
 */
type Pt = readonly [number, number];
type Box = readonly [number, number, number, number];

interface RigPieces {
  head: {
    bbox: Box;
    neck: Pt;
    /** px que se hunde la base de la cabeza bajo el ancla del cuello del torso */ neckDepth?: number;
  };
  torso: {
    bbox: Box;
    neck: Pt;
    hip: Pt;
    shoulderFront: Pt;
    shoulderBack: Pt;
    /** último recurso: desplazamiento manual (px) del centro de la cadera respecto a las piernas */ hipOffsetX?: number;
  };
  arms: {
    bbox: Box;
    shoulder: Pt;
    muzzle: Pt;
    /** Tamaño del arte del brazo respecto al torso (la regla: largo hombro-boquilla entre 0,9 y 1,1 veces la altura del torso). Por defecto 1. */
    armScale?: number;
    /** Dirección de reposo del brazo trasero de este donante (grados), en lugar de backArm.restDeg. */
    backRestDeg?: number;
  };
  legs: { bbox: Box; hipTop: Pt; ground: Pt; hipSpacing: number; split: number };
}
/** Segundo brazo solo visual (ángulos en grados, 0 = derecha, 90 = arriba). */
interface BackArmData {
  /** Dirección en que cuelga el brazo en reposo (hacia abajo y un poco hacia afuera). */
  restDeg: number;
  /** Tamaño del brazo trasero respecto al delantero. */
  scale: number;
  /** Se suma a la puntería del brazo delantero mientras apunta. */
  followOffsetDeg: number;
  /** Oscurecimiento del arte (0.85 = 85 % de brillo). */
  tint: number;
  /** Vaivén al caminar, rad (contrario al brazo delantero). */
  walkSwing: number;
  /** Sacudida al recibir un golpe, rad. */
  hurtShake: number;
}
export interface RigData {
  overlap: { neck: number; hip: number };
  backArm: BackArmData;
  manual?: Record<string, Pt | number>;
  pieces: Record<string, RigPieces>;
}

/** Área que el Laboratorio reserva para una criatura a escala 1 (px). */
export const LAB_FRAME = { width: 560, height: 480 } as const;

const REQUIRED: Record<Slot, string[]> = {
  head: ['neck'],
  torso: ['neck', 'hip', 'shoulderFront', 'shoulderBack'],
  arms: ['shoulder', 'muzzle'],
  legs: ['hipTop', 'ground'],
};

const isPt = (p: unknown): p is Pt =>
  Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v));

/** Falla con un mensaje claro (donante.ranura.ancla) si falta un ancla o cae fuera de su marco. */
export function validateRig(data: RigData, donors: readonly string[] = DONOR_IDS): void {
  if (!data?.overlap || !(data.overlap.neck >= 0) || !(data.overlap.hip >= 0))
    throw new Error('rig.json: falta "overlap" (neck, hip)');
  const ba = data.backArm as Partial<BackArmData> | undefined;
  for (const k of ['restDeg', 'scale', 'followOffsetDeg', 'tint', 'walkSwing', 'hurtShake'] as const)
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

/** Aplica las correcciones a mano (claves "donante.ranura.ancla") sobre las detectadas y valida. */
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
  /** Posición en el mundo del pivote de la pieza (píxel de origen). */
  x: number;
  y: number;
  /** Pivote dentro del marco, px (0,0 = arriba a la izquierda salvo en los brazos). */
  originX: number;
  originY: number;
  /** Tamaño uniforme de la pieza (los brazos se normalizan con `armScale`). */
  scale: number;
  /** Tamaño del marco, px. */
  w: number;
  h: number;
  /** Caja del cuerpo opaco dentro del marco, [x0, y0, x1, y1] px; la vista recorta el marco a ella (quita restos de la extracción). */
  bbox: Box;
  /** Orden de dibujo: menor = más atrás. */
  layer: number;
  rotation: number;
}

export interface SolvedRig {
  legs: Placement;
  torso: Placement;
  head: Placement;
  /** Brazo delantero, con pivote en el hombro delantero del torso. */
  arm: Placement;
  /** Segundo brazo (solo visual), pivote en el hombro trasero, dibujado detrás del torso. */
  armBack: Placement;
  /** Puntos de cadera de cada pierna en el mundo (para caminar), separados `hipSpacing`. */
  hipL: Pt;
  hipR: Pt;
  /** Columna (en el marco de las piernas) que separa la pierna izquierda de la derecha. */
  legSplit: number;
  /** Límites opacos de la criatura armada [x0, y0, x1, y1] (con el brazo en reposo). */
  bounds: [number, number, number, number];
  /** De los pies a lo alto de la cabeza, px. Define la altura de la barra de vida y la caja de colisión de la vista. */
  height: number;
  headTop: number;
  feet: Pt;
  /** Vector hombro a mano del arte del brazo (ya escalado) en reposo, px. */
  armVec: Pt;
  /** Lo mismo para el brazo trasero (también escalado por backArm.scale). */
  armBackVec: Pt;
  /** Dirección de reposo del brazo trasero de este donante, grados. */
  backRestDeg: number;
  /** Pivotes útiles para animar (mundo). */
  neck: Pt;
  hip: Pt;
}

const LAYER = { legs: 0, torso: 2, armBack: 3, arm: 4, head: 5 } as const;

function frame(slot: Slot): { w: number; h: number } {
  const [w, h] = PARTS.boxes[slot];
  return { w, h };
}

/** Arma una criatura: el torso es la raíz, las piernas quedan detrás, la cabeza encima y el brazo gira en el hombro. */
export function solveRig(sel: Selection, rig: RigData = RIG): SolvedRig {
  const pH = rig.pieces[sel.head]?.head;
  const pT = rig.pieces[sel.torso]?.torso;
  const pA = rig.pieces[sel.arms]?.arms;
  const pL = rig.pieces[sel.legs]?.legs;
  if (!pH || !pT || !pA || !pL)
    throw new Error(`rig: selección con donante sin anclajes (${JSON.stringify(sel)})`);

  // Piernas: el punto de suelo va en el origen.
  const legs: Placement = {
    ...frame('legs'),
    x: -pL.ground[0],
    y: -(pL.ground[1] + 1),
    originX: 0,
    originY: 0,
    scale: 1,
    bbox: pL.bbox,
    layer: LAYER.legs,
    rotation: 0,
  };
  const hipWorld: Pt = [pL.hipTop[0] - pL.ground[0], pL.hipTop[1] - pL.ground[1] - 1]; // parte alta de las piernas
  // La cadera del torso queda `overlap.hip` bajo lo alto de las piernas, así las piernas suben por detrás del torso.
  const torsoHip: Pt = [hipWorld[0], hipWorld[1] + rig.overlap.hip];
  const torso: Placement = {
    ...frame('torso'),
    x: torsoHip[0] - pT.hip[0] - (pT.hipOffsetX ?? 0),
    y: torsoHip[1] - pT.hip[1],
    originX: 0,
    originY: 0,
    scale: 1,
    bbox: pT.bbox,
    layer: LAYER.torso,
    rotation: 0,
  };
  // Cabeza: su cuello sobre el cuello del torso, hundida `overlap.neck` en el torso.
  const neck: Pt = [torso.x + pT.neck[0], torso.y + pT.neck[1] + (pH.neckDepth ?? rig.overlap.neck)];
  const head: Placement = {
    ...frame('head'),
    x: neck[0] - pH.neck[0],
    y: neck[1] - pH.neck[1],
    originX: 0,
    originY: 0,
    scale: 1,
    bbox: pH.bbox,
    layer: LAYER.head,
    rotation: 0,
  };
  // Brazos: el pivote es el hombro del propio brazo, puesto en el ancla del hombro del torso.
  const armScale = pA.armScale ?? 1;
  const mkArm = (sh: Pt, layer: number, scale: number): Placement => ({
    ...frame('arms'),
    x: torso.x + sh[0],
    y: torso.y + sh[1],
    originX: pA.shoulder[0],
    originY: pA.shoulder[1],
    scale,
    bbox: pA.bbox,
    layer,
    rotation: 0,
  });
  const arm = mkArm(pT.shoulderFront, LAYER.arm, armScale);
  const backScale = armScale * rig.backArm.scale;
  const armBack = mkArm(pT.shoulderBack, LAYER.armBack, backScale);
  const backRestDeg = pA.backRestDeg ?? rig.backArm.restDeg;

  const hang = rotatedBox(armBack, restRotation(r0(pA.muzzle, pA.shoulder), backRestDeg));
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
    armVec: [(pA.muzzle[0] - pA.shoulder[0]) * armScale, (pA.muzzle[1] - pA.shoulder[1]) * armScale],
    armBackVec: [(pA.muzzle[0] - pA.shoulder[0]) * backScale, (pA.muzzle[1] - pA.shoulder[1]) * backScale],
    backRestDeg,
    bounds,
    height: -top,
    headTop: top,
    feet: [0, 0],
    neck,
    hip: torsoHip,
  };
}

/** Caja en el mundo de los píxeles opacos de una pieza en reposo. */
export function worldBox(p: Placement): [number, number, number, number] {
  const k = p.scale;
  const ox = p.x - p.originX * k;
  const oy = p.y - p.originY * k;
  return [ox + p.bbox[0] * k, oy + p.bbox[1] * k, ox + (p.bbox[2] + 1) * k, oy + (p.bbox[3] + 1) * k];
}

export interface ArmPose {
  /** Rotación (rad) de la imagen del brazo alrededor de su pivote del hombro. */
  rotation: number;
  /** Posición de la mano o boquilla en el espacio de la criatura (mirando a la derecha, antes del espejo de la vista). */
  muzzle: [number, number];
}

/** Ángulo de puntería local: la vista voltea la criatura al mirar a la izquierda, así que se mide desde el lado al que mira. */
export const localAim = (aimDeg: number, facing: 1 | -1): number => (facing > 0 ? aimDeg : 180 - aimDeg);

/**
 * Rotación que deja el eje hombro-punta del brazo exactamente sobre `aimDeg` (0 = derecha, 90 = arriba) y la posición
 * resultante de la boquilla. El arte no está dibujado perfectamente horizontal, por eso se resta su ángulo de reposo.
 */
export function armPose(r: SolvedRig, aimDeg: number): ArmPose {
  const [vx, vy] = r.armVec;
  const rotation = -(aimDeg * Math.PI) / 180 - Math.atan2(vy, vx);
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  return { rotation, muzzle: [r.arm.x + vx * c - vy * s, r.arm.y + vx * s + vy * c] };
}

const r0 = (muzzle: Pt, shoulder: Pt): Pt => [muzzle[0] - shoulder[0], muzzle[1] - shoulder[1]];

/** Rotación de imagen que hace que un brazo cuyo arte apunta a `vec` apunte hacia `deg` (0 = derecha, 90 = arriba). */
function restRotation(vec: Pt, deg: number): number {
  return -(deg * Math.PI) / 180 - Math.atan2(vec[1], vec[0]);
}

/** Caja en el mundo de una pieza girada alrededor de su pivote. */
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
    const dx = (px - p.originX) * p.scale;
    const dy = (py - p.originY) * p.scale;
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
 * Rotación de imagen del brazo trasero. `mode` mezcla entre colgar (0) y seguir la puntería del delantero (1);
 * `extra` (rad) la suman las animaciones (vaivén al caminar, sacudida, victoria).
 */
export function backArmRotation(
  r: SolvedRig,
  aimDeg: number,
  mode: number,
  extra: number,
  rig: RigData = RIG,
): number {
  const b = rig.backArm;
  const rest = r.backRestDeg;
  const dir = rest + (aimDeg + b.followOffsetDeg - rest) * mode;
  return restRotation(r.armVec, dir) + extra;
}
