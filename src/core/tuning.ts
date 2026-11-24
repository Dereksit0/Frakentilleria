import tuningJson from '../data/tuning.json';

export interface Tuning {
  /** Neutral aim every turn starts from (angle is measured toward the foe). */
  aim: { angle: number; power: number };
  /** Gusts: random walk of the wind during flight, one step per 1/60 s, bounded by gustMax (wind units). */
  wind: { gustStep: number; gustMax: number };
  /** Share of blast damage that still reaches a creature hidden behind terrain. */
  cover: { blast: number };
  knockback: { scale: number; minHorizontal: number };
  /** Seconds of the arc the aiming preview shows. */
  preview: { seconds: number };
  acidKills: boolean;
  /** Aim error multiplier during a stunned turn. */
  stunSpreadMult: number;
  /** A projectile cannot hurt its own owner (hit or blast) during its first seconds of flight. */
  spawnGrace: { seconds: number };
  /** TODO(balance): provisional; chosen with `npm run simulate` (docs/BALANCE_RONDA3.md). */
  balance: { globalDamageMultiplier: number };
  /** TNT barrel blast. */
  barrel: { damage: number; radius: number; crater: number; knockback: number };
}

export const TUNING = tuningJson as unknown as Tuning;

/** Per-match switches (tests and the simulator turn them off to isolate one rule). */
export interface Rules {
  spread: boolean;
  /** Multiplies every weapon's aim error (balance sweeps). */
  spreadScale: number;
  /** Multiplies every weapon's damage (balance sweeps). */
  damageScale: number;
  gusts: boolean;
  acidKills: boolean;
  /** Round events (storm, meteors, ...) on/off. */
  events: boolean;
  /** Crates favour the creature that is behind. */
  catchUp: boolean;
  knockbackScale: number;
  coverFactor: number;
}
export function defaultRules(): Rules {
  return {
    spread: true,
    spreadScale: 1,
    damageScale: TUNING.balance.globalDamageMultiplier,
    gusts: true,
    acidKills: TUNING.acidKills,
    events: true,
    catchUp: true,
    knockbackScale: TUNING.knockback.scale,
    coverFactor: TUNING.cover.blast,
  };
}
