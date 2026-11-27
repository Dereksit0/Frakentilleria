import type { Battle } from './battle';
import { simulateTrajectory, launchVelocity } from './ballistics';
import { WEAPONS, type WeaponDef } from './data';
import { explosionFalloff } from './damage';
import type { Rng } from './rng';
import { UNIT_CENTER_OFFSET, UNIT_RADIUS, type Unit } from './unit';

/** novato: arma al azar y mala puntería. experto: prueba todas las armas y elige la de mayor daño esperado. */
export type BotLevel = 'novato' | 'experto';

export interface BotPlan {
  weapon: string;
  angle: number;
  power: number;
  /** Caminar primero hacia el rival (-1 izquierda, 1 derecha, 0 quieto) cuando ningún arma llega desde aquí. */
  walk: -1 | 0 | 1;
  /** Daño esperado del plan (sin bonos); 0 si nada alcanza. */
  score: number;
}

/** Fracción del daño de un arma por debajo de la cual el bot prefiere reposicionarse que disparar. */
const REPOSITION_BELOW = 0.35;
/** Bono del experto por un arma que no acaba de usar (varía el arsenal). TODO(balance): provisional. */
const VARIETY_BONUS = 0.12;
/** Error de puntería del novato: grados y fracción de potencia. */
/** Lo que vale un efecto de estado para el experto, en puntos de daño. TODO(balance): provisional. */
const FREEZE_VALUE = 9;
const STUN_VALUE = 6;
const NOVICE_ANGLE_ERR = 9;
const NOVICE_POWER_ERR = 0.16;

interface Candidate {
  weapon: string;
  angle: number;
  power: number;
  score: number;
}

const toDeg = (r: number): number => (r * 180) / Math.PI;

function muzzle(u: Unit, angle: number): { x: number; y: number } {
  const r = (angle * Math.PI) / 180;
  return { x: u.x + Math.cos(r) * 40, y: u.y - UNIT_CENTER_OFFSET - 10 - Math.sin(r) * 40 };
}

/** Daño esperado de un tiro en arco: qué tan cerca pasa la trayectoria del centro del rival. */
function arcScore(b: Battle, u: Unit, foe: Unit, w: WeaponDef, angle: number, power: number): number {
  const m = muzzle(u, angle);
  const { points, hit } = simulateTrajectory(m, launchVelocity(angle, power), b.wind, b.terrain, {
    dt: 1 / 60,
    sampleEvery: 2,
    windFactor: w.windFactor,
    maxT: 8,
    arcOverCover: w.arcOverCover,
  });
  const fx = foe.x;
  const fy = foe.y - UNIT_CENTER_OFFSET;
  let best = Infinity;
  const stop = w.kind === 'grenade' ? hit.type === 'terrain' : true;
  for (const p of points) {
    const d = Math.hypot(p.x - fx, p.y - fy);
    if (d < best) best = d;
    if (d < UNIT_RADIUS && w.kind !== 'grenade') break;
  }
  // Las granadas explotan donde caen (mecha): se juzga el punto de caída y no el mayor acercamiento.
  const dist = stop && w.kind === 'grenade' ? Math.hypot(hit.x - fx, hit.y - fy) : best;
  // No dispararse a sí mismo: caer junto al tirador no vale nada.
  if (Math.hypot(hit.x - u.x, hit.y - (u.y - UNIT_CENTER_OFFSET)) < w.radius * 0.8 && hit.t > 0.2) return 0;
  let value = w.damage * explosionFalloff(dist, w.radius + UNIT_RADIUS * 0.5);
  // Un charco sigue quemando: se cuenta parte de lo que le hará a quien esté cerca del impacto.
  if (w.puddle && Math.abs(hit.x - fx) < w.puddle.radius) value += w.puddle.damage * w.puddle.turns * 0.6;
  if (w.freezeTurns && value > 0)
    value += FREEZE_VALUE * w.freezeTurns * explosionFalloff(dist, w.radius + UNIT_RADIUS * 0.5);
  return value;
}

function bestArc(b: Battle, u: Unit, foe: Unit, id: string, w: WeaponDef): Candidate {
  const dir = foe.x >= u.x ? 1 : -1;
  const toAngle = (a: number): number => (dir === 1 ? a : 180 - a);
  let best: Candidate = { weapon: id, angle: toAngle(45), power: 60, score: 0 };
  const minA = Math.max(15, w.minAngle ?? 0);
  for (let a = minA; a <= 85; a += 7)
    for (let p = 30; p <= 100; p += 10) {
      const s = arcScore(b, u, foe, w, toAngle(a), p);
      if (s > best.score) best = { weapon: id, angle: toAngle(a), power: p, score: s };
    }
  const a0 = best.angle;
  const p0 = best.power;
  for (let da = -4; da <= 4; da += 2)
    for (let dp = -6; dp <= 6; dp += 3) {
      const power = Math.min(100, Math.max(10, p0 + dp));
      const s = arcScore(b, u, foe, w, a0 + da, power);
      if (s > best.score) best = { weapon: id, angle: a0 + da, power, score: s };
    }
  return best;
}

function candidate(b: Battle, u: Unit, foe: Unit, id: string): Candidate {
  const w = WEAPONS[id];
  const cx = foe.x;
  const cy = foe.y - UNIT_CENTER_OFFSET;
  if (w.kind === 'beam') {
    const m = muzzle(u, 0);
    const dx = cx - u.x;
    const dy = cy - m.y;
    const dist = Math.hypot(dx, dy);
    const angle = (toDeg(Math.atan2(-dy, dx)) + 360) % 360;
    const reach = (w.range ?? 700) - UNIT_RADIUS * 0.5;
    return { weapon: id, angle, power: 100, score: dist <= reach ? w.damage * (w.chain ? 1.1 : 1) : 0 };
  }
  if (w.kind === 'melee') {
    const sign = foe.x >= u.x ? 1 : -1;
    const dist = Math.hypot(cx - (u.x + sign * 70), cy - (u.y - 20));
    const angle = sign === 1 ? 30 : 150;
    return {
      weapon: id,
      angle,
      power: 60,
      score:
        (w.damage + (w.stunTurns ? STUN_VALUE : 0)) * explosionFalloff(dist, w.radius + UNIT_RADIUS * 0.5),
    };
  }
  return bestArc(b, u, foe, id, w);
}

/**
 * Elige arma, puntería y si conviene reposicionarse para la unidad actual de `b`.
 * No modifica la partida; todo el azar sale de `rng`.
 */
export function planShot(b: Battle, rng: Rng, level: BotLevel, lastWeapon?: string): BotPlan {
  const u = b.current;
  const foe = b.units.find((x) => x.index !== u.index && x.alive) ?? b.units[1 - u.index];
  const dir: 1 | -1 = foe.x >= u.x ? 1 : -1;
  let pool = u.weapons.filter((id) => b.hasAmmo(u, id));
  if (level === 'novato') pool = [rng.pick(pool)];
  const cands = pool.map((id) => candidate(b, u, foe, id));

  let chosen = cands[0];
  if (level === 'experto') {
    let bestVal = -Infinity;
    for (const c of cands) {
      // Daño esperado absoluto: un arma débil no gana solo por acertar más seguido.
      const val = c.score * (1 + (c.weapon !== lastWeapon ? VARIETY_BONUS : 0) + rng.next() * 0.04);
      if (val > bestVal) {
        bestVal = val;
        chosen = c;
      }
    }
  }

  const w = WEAPONS[chosen.weapon];
  const walk: -1 | 0 | 1 =
    chosen.score < Math.max(w.damage, 10) * REPOSITION_BELOW && b.clock.moveLeft > 0.2 ? dir : 0;

  let angle = chosen.angle;
  let power = chosen.power;
  if (level === 'novato') {
    angle += (rng.next() * 2 - 1) * NOVICE_ANGLE_ERR;
    power *= 1 + (rng.next() * 2 - 1) * NOVICE_POWER_ERR;
  }
  return {
    weapon: chosen.weapon,
    angle: ((angle % 360) + 360) % 360,
    power: Math.min(100, Math.max(10, power)),
    walk,
    score: chosen.score,
  };
}
