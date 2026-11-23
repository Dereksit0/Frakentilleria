import { GRAVITY } from './ballistics';
import { abilityFor, computeStats, weaponsFor, type Selection, type Stats } from './stats';
import type { Terrain } from './terrain';

export const WALK_SPEED = 150; // px/s at 100% mobility
export const JUMP_SPEED = 420;
/** Hit circle centre sits this far above the feet. */
export const UNIT_CENTER_OFFSET = 60;
export const UNIT_RADIUS = 48;
const WORLD_MARGIN = 20;

export interface Unit {
  index: number;
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
}

export interface StepResult {
  landed: boolean;
  fallDistance: number;
  fellOut: boolean;
}

export function createUnit(index: number, selection: Selection, x: number, y: number): Unit {
  const stats = computeStats(selection);
  const weapons = weaponsFor(selection);
  return {
    index,
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

function walk(u: Unit, terrain: Terrain, dx: number): void {
  const nx = Math.min(Math.max(u.x + dx, WORLD_MARGIN), terrain.width - WORLD_MARGIN);
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
export function stepUnit(u: Unit, terrain: Terrain, dt: number, dir: -1 | 0 | 1): StepResult {
  const res: StepResult = { landed: false, fallDistance: 0, fellOut: false };
  if (!u.alive) return res;

  if (u.grounded) {
    if (dir !== 0) {
      u.facing = dir;
      walk(u, terrain, dir * WALK_SPEED * (u.stats.mobility / 100) * dt);
    }
    if (u.grounded && !terrain.isSolid(u.x, u.y) && !terrain.isSolid(u.x, u.y + 1)) startFalling(u);
    if (u.grounded) return res;
  }

  // Airborne
  u.vy += GRAVITY * dt;
  const nx = u.x + u.vx * dt;
  const side = u.vx >= 0 ? 14 : -14;
  if (u.vx !== 0 && terrain.isSolid(nx + side, u.y - 30)) u.vx = 0;
  else u.x = Math.min(Math.max(nx, WORLD_MARGIN), terrain.width - WORLD_MARGIN);
  const ny = u.y + u.vy * dt;
  u.peakY = Math.min(u.peakY, u.y, ny);
  if (ny >= u.y) {
    const gy = terrain.surfaceY(u.x, u.y);
    if (gy !== null && gy <= ny) {
      u.y = gy;
      u.vx = 0;
      u.vy = 0;
      u.grounded = true;
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
