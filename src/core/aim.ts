import { launchVelocity, simulateTrajectory, type Vec } from './ballistics';
import { WEAPONS } from './data';
import type { Terrain } from './terrain';
import { TUNING } from './tuning';
import { UNIT_CENTER_OFFSET } from './unit';

/** Puntería con la que arranca cada turno. `facing` 1 = mira a la derecha. */
export function neutralAim(facing: 1 | -1): { angle: number; power: number } {
  const a = TUNING.aim.angle;
  return { angle: facing === 1 ? a : 180 - a, power: TUNING.aim.power };
}

/** Error de puntería en grados hacia cada lado: crece con la potencia y con lo que caminó en el turno. */
export function aimSpread(weaponId: string, power: number, movedPx: number): number {
  const s = WEAPONS[weaponId]?.spread;
  if (!s) return 0;
  return s.base + s.perPower * power + s.perMove * movedPx;
}

/** Raises a shot angle so its elevation (above the horizontal, either side) is at least `min` degrees. */
export function liftAngle(angle: number, min: number): number {
  const rad = (angle * Math.PI) / 180;
  const right = Math.cos(rad) >= 0;
  const elevation = (Math.atan2(Math.sin(rad), Math.abs(Math.cos(rad))) * 180) / Math.PI;
  const e = Math.min(90, Math.max(min, elevation));
  return right ? e : 180 - e;
}

/** Distance from the creature's centre to the muzzle, where every shot starts. */
export const MUZZLE_DISTANCE = 40;
/** Straight preview length of the short-range weapons (px). */
const STRAIGHT_REACH: Record<string, number> = { beam: 220, melee: 90 };
const STRAIGHT_STEP = 36;

export interface AimInput {
  /** Feet of the creature. */
  x: number;
  y: number;
  angle: number;
  power: number;
  weapon: string;
  /** Wind felt by the shot right now (base + gust). */
  wind: number;
}

/**
 * Points of the aiming preview, from the muzzle: the real ballistics (wind, power, the mortar's minimum angle and its arc
 * over cover) for thrown weapons, a straight line for the beam and the mace. Same start and angle as `Battle.fire`.
 */
export function aimPreview(a: AimInput, terrain: Terrain): Vec[] {
  const w = WEAPONS[a.weapon];
  const angle = w.minAngle !== undefined ? liftAngle(a.angle, w.minAngle) : a.angle;
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);
  const m = { x: a.x + dx * MUZZLE_DISTANCE, y: a.y - UNIT_CENTER_OFFSET - 10 + dy * MUZZLE_DISTANCE };
  if (w.kind === 'projectile' || w.kind === 'grenade')
    return simulateTrajectory(m, launchVelocity(angle, a.power), a.wind, terrain, {
      windFactor: w.windFactor,
      arcOverCover: w.arcOverCover,
      maxT: TUNING.preview.seconds,
      sampleEvery: 7,
    }).points;
  const pts: Vec[] = [];
  for (let d = 0; d <= (STRAIGHT_REACH[w.kind] ?? 90); d += STRAIGHT_STEP)
    pts.push({ x: m.x + dx * d, y: m.y + dy * d });
  return pts;
}
