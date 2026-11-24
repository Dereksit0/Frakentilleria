import { GRAVITY } from './ballistics';
import { WEAPONS } from './data';
import { abilityFor, computeStats, weaponsFor, type Selection, type Stats } from './stats';
import type { Terrain } from './terrain';

/** The infinite base weapon every creature owns. */
export const BASE_WEAPON = 'canon';
export const WALK_SPEED = 150; // px/s at 100% mobility
export const JUMP_SPEED = 420;
/** Hit circle centre sits this far above the feet. */
export const UNIT_CENTER_OFFSET = 60;
export const UNIT_RADIUS = 48;
/**
 * Half width of the solid body of a creature (px). Derived from the assembled rig: the torso is ≈ 150 px wide and creatures are drawn
 * at scale 0.34, so ≈ 51 px of body, 26 px per side. The hit circle (UNIT_RADIUS) is bigger on purpose: it is for shots, this is for walking.
 */
export const BODY_HALF_WIDTH = 26;
/** Closest two creatures can stand (centre to centre). */
export const BODY_GAP = BODY_HALF_WIDTH * 2;

/**
 * Pure horizontal move against the other creature's body: returns where `x` ends up when it wants to go to `desiredX`.
 * A creature on the left (`moverIsLeft`) never ends beyond `otherX − BODY_GAP`, one on the right never before `otherX + BODY_GAP`,
 * however big the step is (no tunnelling). Moving away is always free; when already overlapped it cannot advance further.
 */
export function resolveHorizontalMove(
  x: number,
  otherX: number,
  desiredX: number,
  moverIsLeft: boolean,
): number {
  if (moverIsLeft) {
    if (desiredX <= x) return desiredX;
    return Math.min(desiredX, Math.max(x, otherX - BODY_GAP));
  }
  if (desiredX >= x) return desiredX;
  return Math.max(desiredX, Math.min(x, otherX + BODY_GAP));
}

/** Pushes two overlapped (or crossed) creatures back to their own sides, symmetrically around their midpoint. */
export function separateBodies(leftX: number, rightX: number): [number, number] {
  if (leftX < rightX && rightX - leftX >= BODY_GAP) return [leftX, rightX];
  const mid = (leftX + rightX) / 2;
  return [mid - BODY_GAP / 2, mid + BODY_GAP / 2];
}
const WORLD_MARGIN = 20;
/** A launched creature this far past a side edge is gone. */
const OUT_OF_WORLD = 40;

export interface Unit {
  index: number;
  /** Side of the arena it started on: −1 left, +1 right. The order of the two creatures never changes. */
  side: -1 | 1;
  selection: Selection;
  stats: Stats;
  x: number;
  /** Feet position (first solid pixel row when standing). */
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  alive: boolean;
  grounded: boolean;
  /** Highest point (smallest y) reached since leaving the ground. */
  peakY: number;
  weapons: string[];
  weapon: string;
  aimAngle: number;
  aimPower: number;
  ability: string | undefined;
  abilityUsed: boolean;
  shield: number;
  damageBoost: number;
  moveBonus: number;
  frozenTurns: number;
  /** Pixels walked this turn (feeds the aim dispersion). */
  moved: number;
  /** Remaining shots per limited weapon (the infinite cannon has no entry). */
  ammo: Record<string, number>;
  /** Stun turns still pending (set by a hit). */
  stunTurns: number;
  /** True during the turn in which the stun applies. */
  stunActive: boolean;
  /** Thrown by an explosion: may leave the world sideways and die (void). */
  launched: boolean;
  /** Already bounced by a spring this turn. */
  sprung: boolean;
}

export interface StepResult {
  landed: boolean;
  fallDistance: number;
  fellOut: boolean;
}

export function createUnit(index: number, selection: Selection, x: number, y: number): Unit {
  const stats = computeStats(selection);
  const weapons = [BASE_WEAPON, ...weaponsFor(selection).filter((id) => id !== BASE_WEAPON)];
  return {
    index,
    side: index === 0 ? -1 : 1,
    selection,
    stats,
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 1,
    hp: stats.hp,
    maxHp: stats.hp,
    alive: true,
    grounded: true,
    peakY: y,
    weapons,
    weapon: weapons[0],
    aimAngle: 45,
    aimPower: 60,
    ability: abilityFor(selection),
    abilityUsed: false,
    shield: 0,
    damageBoost: 0,
    moveBonus: 0,
    frozenTurns: 0,
    moved: 0,
    ammo: Object.fromEntries(
      weapons.filter((id) => WEAPONS[id].ammo !== undefined).map((id) => [id, WEAPONS[id].ammo as number]),
    ),
    stunTurns: 0,
    stunActive: false,
    launched: false,
    sprung: false,
  };
}

export function jumpUnit(u: Unit, speed = JUMP_SPEED, forward = 90): boolean {
  if (!u.grounded || !u.alive) return false;
  u.grounded = false;
  u.vy = -speed;
  u.vx = u.facing * forward;
  u.peakY = u.y;
  return true;
}

function startFalling(u: Unit): void {
  u.grounded = false;
  u.vx = 0;
  u.vy = 0;
  u.peakY = u.y;
}

function walk(u: Unit, terrain: Terrain, dx: number, other: Unit | null): void {
  let nx = Math.min(Math.max(u.x + dx, WORLD_MARGIN), terrain.width - WORLD_MARGIN);
  if (other) nx = resolveHorizontalMove(u.x, other.x, nx, u.side < 0);
  const climb = 3 + Math.abs(dx) * 1.6;
  const fromY = Math.floor(u.y - climb);
  const gy = terrain.surfaceY(nx, fromY);
  if (gy !== null && gy === fromY) return; // wall too steep to climb
  u.x = nx;
  if (gy !== null && gy <= u.y + 4) {
    u.y = gy;
  } else {
    startFalling(u);
  }
}

/**
 * Advances one creature by dt seconds. `dir` is the walking input (only used when grounded).
 * Pure with respect to the terrain; mutates the unit.
 */
export function stepUnit(
  u: Unit,
  terrain: Terrain,
  dt: number,
  dir: -1 | 0 | 1,
  gravityScale = 1,
  other: Unit | null = null,
): StepResult {
  const res: StepResult = { landed: false, fallDistance: 0, fellOut: false };
  if (!u.alive) return res;

  if (u.grounded) {
    if (dir !== 0) {
      u.facing = dir;
      walk(u, terrain, dir * WALK_SPEED * (u.stats.mobility / 100) * dt, other);
    }
    if (u.grounded && !terrain.isSolid(u.x, u.y) && !terrain.isSolid(u.x, u.y + 1)) startFalling(u);
    if (u.grounded) return res;
  }

  // Airborne
  u.vy += GRAVITY * gravityScale * dt;
  let nx = u.x + u.vx * dt;
  if (other) {
    const blocked = resolveHorizontalMove(u.x, other.x, nx, u.side < 0);
    if (blocked !== nx) u.vx = 0; // stopped against the rival: the push does not carry on
    nx = blocked;
  }
  const side = u.vx >= 0 ? 14 : -14;
  if (u.vx !== 0 && terrain.isSolid(nx + side, u.y - 30)) u.vx = 0;
  else if (u.launched) {
    u.x = nx;
    if (nx < -OUT_OF_WORLD || nx > terrain.width + OUT_OF_WORLD) res.fellOut = true;
  } else u.x = Math.min(Math.max(nx, WORLD_MARGIN), terrain.width - WORLD_MARGIN);
  const ny = u.y + u.vy * dt;
  u.peakY = Math.min(u.peakY, u.y, ny);
  if (ny >= u.y) {
    const gy = terrain.surfaceY(u.x, u.y);
    if (gy !== null && gy <= ny) {
      u.y = gy;
      u.vx = 0;
      u.vy = 0;
      u.grounded = true;
      u.launched = false;
      res.landed = true;
      res.fallDistance = gy - u.peakY;
      u.peakY = gy;
      return res;
    }
  }
  u.y = ny;
  if (u.y > terrain.height + 100) res.fellOut = true;
  return res;
}
