import { GRAVITY } from './ballistics';
import { WEAPONS } from './data';
import { abilityFor, computeStats, weaponsFor, type Selection, type Stats } from './stats';
import type { Terrain } from './terrain';

/** El arma base infinita que toda criatura tiene. */
export const BASE_WEAPON = 'canon';
export const WALK_SPEED = 150; // px/s con 100 % de movilidad
const JUMP_SPEED = 420;
/** El centro del círculo de golpe queda a esta altura sobre los pies. */
export const UNIT_CENTER_OFFSET = 60;
export const UNIT_RADIUS = 48;
/**
 * Medio ancho del cuerpo sólido de una criatura (px). Sale del ensamble: el torso mide unos 150 px y las criaturas se dibujan
 * a escala 0.34, o sea unos 51 px de cuerpo, 26 por lado. El círculo de golpe (UNIT_RADIUS) es más grande a propósito: sirve para los tiros, esto para caminar.
 */
export const BODY_HALF_WIDTH = 26;
/** Lo más cerca que pueden estar dos criaturas (de centro a centro). */
export const BODY_GAP = BODY_HALF_WIDTH * 2;

/**
 * Movimiento horizontal contra el cuerpo de la otra criatura: devuelve dónde queda `x` cuando quiere ir a `desiredX`.
 * Una criatura a la izquierda (`moverIsLeft`) nunca queda más allá de `otherX − BODY_GAP` y una a la derecha nunca antes de `otherX + BODY_GAP`,
 * sin importar lo grande del paso (no hay túnel). Alejarse siempre es gratis; si ya están encimadas no puede avanzar más.
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

/** Devuelve a su lado a dos criaturas encimadas (o cruzadas), de forma simétrica alrededor del punto medio. */
export function separateBodies(leftX: number, rightX: number): [number, number] {
  if (leftX < rightX && rightX - leftX >= BODY_GAP) return [leftX, rightX];
  const mid = (leftX + rightX) / 2;
  return [mid - BODY_GAP / 2, mid + BODY_GAP / 2];
}
const WORLD_MARGIN = 20;
/** Una criatura lanzada que pasa tanto del borde lateral se da por perdida. */
const OUT_OF_WORLD = 40;

export interface Unit {
  index: number;
  /** Lado de la arena donde empezó: -1 izquierda, +1 derecha. El orden de las dos criaturas nunca cambia. */
  side: -1 | 1;
  selection: Selection;
  stats: Stats;
  x: number;
  /** Posición de los pies (primera fila sólida al estar de pie). */
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  alive: boolean;
  grounded: boolean;
  /** Punto más alto (y más chica) desde que dejó el suelo. */
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
  /** Píxeles caminados en el turno (alimentan la dispersión de la puntería). */
  moved: number;
  /** Disparos que quedan por arma limitada (el cañón infinito no aparece). */
  ammo: Record<string, number>;
  /** Turnos de aturdimiento pendientes (los pone un golpe). */
  stunTurns: number;
  /** True durante el turno en que aplica el aturdimiento. */
  stunActive: boolean;
  /** Lanzada por una explosión: puede salir por un lado y morir (vacío). */
  launched: boolean;
  /** Ya rebotó en un resorte este turno. */
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
  if (gy !== null && gy === fromY) return; // pared demasiado empinada para subir
  u.x = nx;
  if (gy !== null && gy <= u.y + 4) {
    u.y = gy;
  } else {
    startFalling(u);
  }
}

/**
 * Avanza una criatura dt segundos. `dir` es la entrada de caminar (solo cuenta si está en el suelo).
 * No toca el terreno; modifica la unidad.
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

  // En el aire
  u.vy += GRAVITY * gravityScale * dt;
  let nx = u.x + u.vx * dt;
  if (other) {
    const blocked = resolveHorizontalMove(u.x, other.x, nx, u.side < 0);
    if (blocked !== nx) u.vx = 0; // se detuvo contra el rival: el empuje no sigue
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
