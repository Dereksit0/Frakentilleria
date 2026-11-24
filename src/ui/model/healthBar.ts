import { C } from '../theme';

/** Modelo de las barras de vida (HUD y barras flotantes) sin Phaser, con pruebas unitarias. */
export const HEALTH_SEGMENT = 20; // una marca fina cada 20 de vida
export const LOW_HEALTH = 0.25;
export const CRITICAL_HEALTH = 0.1;
export const HEAVY_HIT = 0.25; // fracción de la vida máxima que se pierde en un golpe
const BAR_TAU_MS = 50; // constante de tiempo: la barra se asienta en unos 300 ms
const GHOST_HOLD_MS = 500;
const GHOST_DRAIN_MS = 300;

type BarState = 'normal' | 'low' | 'critical' | 'dead';
export type PlayerId = 0 | 1;

export interface HealthBarModel {
  /** Relleno actual de 0 a 1. */
  pct: number;
  /** Dónde empieza el segmento fantasma (>= pct): el valor antes del último daño. */
  ghostPct: number;
  /** Marcas de segmento como fracción de la barra (cada 20 de vida, ninguna en 0 ni en 100 %). */
  ticks: number[];
  state: BarState;
  fillColor: number;
  playerColor: number;
  shape: 'circle' | 'diamond';
  label: string;
  stripes: boolean;
  showSkull: boolean;
  /** Periodo del pulso en ms (0 = sin pulso). */
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

/** Estado de animación de una barra: relleno mostrado, fantasma y cuánto falta para que el fantasma se suelte. */
export interface BarAnim {
  shown: number;
  ghost: number;
  holdMs: number;
}

/**
 * Avanza la animación dtMs. `target` = relleno real, `ghostFrom` = valor antes del último daño.
 * Con efectos reducidos no hay suavizado ni fantasma: solo el valor nuevo.
 */
export function stepBar(a: BarAnim, target: number, ghostFrom: number, dtMs: number, reduced: boolean): void {
  if (reduced) {
    a.shown = target;
    a.ghost = target;
    a.holdMs = 0;
    return;
  }
  // Daño nuevo: el fantasma se reinicia desde el valor anterior.
  if (target < a.shown - 1e-6 && ghostFrom > target && a.ghost < ghostFrom) {
    a.ghost = Math.max(a.ghost, ghostFrom);
    a.holdMs = GHOST_HOLD_MS;
  } else if (target < a.shown - 1e-6 && a.holdMs <= 0 && a.ghost <= a.shown) {
    a.ghost = a.shown;
    a.holdMs = GHOST_HOLD_MS;
  }
  // La barra real se mueve con suavizado exponencial (unos 300 ms en asentarse tras un golpe).
  const k = 1 - Math.exp(-dtMs / BAR_TAU_MS);
  a.shown += (target - a.shown) * k;
  if (Math.abs(target - a.shown) < 5e-4) a.shown = target;
  // Fantasma: se sostiene y luego baja hacia la barra real.
  if (a.ghost > a.shown) {
    if (a.holdMs > 0) a.holdMs -= dtMs;
    else a.ghost = Math.max(a.shown, a.ghost - dtMs / GHOST_DRAIN_MS);
  } else {
    a.ghost = a.shown;
    a.holdMs = 0;
  }
}
