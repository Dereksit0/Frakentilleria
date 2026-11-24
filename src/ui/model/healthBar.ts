import { C } from '../theme';

/** Pure view-model for health bars (HUD + floating bars). No Phaser here, fully unit-tested. */
export const HEALTH_SEGMENT = 20; // thin mark every 20 hp
export const LOW_HEALTH = 0.25;
export const CRITICAL_HEALTH = 0.1;
export const HEAVY_HIT = 0.25; // share of max hp lost in one hit
export const BAR_TAU_MS = 50; // time constant: the bar settles in ~300 ms
export const GHOST_HOLD_MS = 500;
export const GHOST_DRAIN_MS = 300;

export type BarState = 'normal' | 'low' | 'critical' | 'dead';
export type PlayerId = 0 | 1;

export interface HealthBarModel {
  /** Current fill 0..1. */
  pct: number;
  /** Where the ghost segment starts (>= pct): the value before the latest damage. */
  ghostPct: number;
  /** Segment marks as fractions of the bar (every 20 hp, none at 0 or 100 %). */
  ticks: number[];
  state: BarState;
  fillColor: number;
  playerColor: number;
  shape: 'circle' | 'diamond';
  label: string;
  stripes: boolean;
  showSkull: boolean;
  /** Pulse period in ms (0 = no pulse). */
  pulseMs: number;
  lostHp: number;
  heavyHit: boolean;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function healthBarViewModel(
  hp: number,
  maxHp: number,
  prevHp: number,
  playerId: PlayerId,
): HealthBarModel {
  const safeMax = maxHp > 0 ? maxHp : 1;
  const cur = Math.min(Math.max(hp, 0), safeMax);
  const pct = maxHp > 0 ? clamp01(cur / safeMax) : 0;
  const prev = clamp01(prevHp / safeMax);
  const ghostPct = Math.max(pct, prev);
  const ticks: number[] = [];
  for (let v = HEALTH_SEGMENT; v < safeMax; v += HEALTH_SEGMENT) ticks.push(v / safeMax);

  let state: BarState = 'normal';
  if (cur <= 0) state = 'dead';
  else if (pct <= CRITICAL_HEALTH) state = 'critical';
  else if (pct <= LOW_HEALTH) state = 'low';

  const playerColor = playerId === 0 ? C.p1 : C.p2;
  const warn = state === 'low' || state === 'critical';
  const lost = Math.max(0, prevHp - hp);
  return {
    pct,
    ghostPct,
    ticks,
    state,
    fillColor: warn ? C.alarm : playerColor,
    playerColor,
    shape: playerId === 0 ? 'circle' : 'diamond',
    label: String(Math.round(cur)),
    stripes: warn,
    showSkull: warn,
    pulseMs: state === 'low' ? 1200 : state === 'critical' ? 600 : 0,
    lostHp: lost,
    heavyHit: lost / safeMax >= HEAVY_HIT,
  };
}

/** Animation state of one bar: displayed fill + ghost + how long the ghost is still held. */
export interface BarAnim {
  shown: number;
  ghost: number;
  holdMs: number;
}

/**
 * Advances the animation by dtMs. `target` = real fill, `ghostFrom` = value before the latest damage.
 * Reduced effects: no easing and no ghost, just the new value.
 */
export function stepBar(a: BarAnim, target: number, ghostFrom: number, dtMs: number, reduced: boolean): void {
  if (reduced) {
    a.shown = target;
    a.ghost = target;
    a.holdMs = 0;
    return;
  }
  // New damage: restart the ghost hold from the previous value.
  if (target < a.shown - 1e-6 && ghostFrom > target && a.ghost < ghostFrom) {
    a.ghost = Math.max(a.ghost, ghostFrom);
    a.holdMs = GHOST_HOLD_MS;
  } else if (target < a.shown - 1e-6 && a.holdMs <= 0 && a.ghost <= a.shown) {
    a.ghost = a.shown;
    a.holdMs = GHOST_HOLD_MS;
  }
  // Move the real bar with exponential easing (~300 ms to settle after a hit).
  const k = 1 - Math.exp(-dtMs / BAR_TAU_MS);
  a.shown += (target - a.shown) * k;
  if (Math.abs(target - a.shown) < 5e-4) a.shown = target;
  // Ghost: hold, then drain towards the real bar.
  if (a.ghost > a.shown) {
    if (a.holdMs > 0) a.holdMs -= dtMs;
    else a.ghost = Math.max(a.shown, a.ghost - dtMs / GHOST_DRAIN_MS);
  } else {
    a.ghost = a.shown;
    a.holdMs = 0;
  }
}
