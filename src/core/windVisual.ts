/** Pure description of how the wind looks and feels (particles, wind sock, arrows, notice). No Phaser. */

/** Ambient particles may never exceed this many alive at once (the whole combat budget is 150). */
export const MAX_WIND_PARTICLES = 60;
const MAX_WIND = 5;

/** Ambient particle kinds per map id. */
export const WIND_KINDS: Record<string, readonly ['paper' | 'leaf' | 'fluff', 'dust' | 'fog' | 'confetti']> =
  {
    vertedero: ['paper', 'dust'],
    cementerio: ['leaf', 'fog'],
    fabrica: ['fluff', 'confetti'],
  };

export interface WindVisual {
  /** −1 left, 0 none, +1 right. */
  direction: -1 | 0 | 1;
  /** Radians: 0 = towards the right, π = towards the left. */
  angle: number;
  /** Ambient particles alive (≤ 60), proportional to strength. */
  particles: number;
  /** px/s of the ambient particles, signed. */
  driftSpeed: number;
  /** Wind sock inflation level 0..5. */
  sockLevel: number;
  /** One arrow per level (never colour alone). */
  arrows: number;
  /** Show the 1.2 s notice at the start of the turn. */
  notice: boolean;
  /** Visible gust streaks crossing the screen (strong wind). */
  streaks: boolean;
  /** px the far layers (clouds) lean towards the wind, signed. */
  cloudShift: number;
}

export function windVisual(wind: number): WindVisual {
  const w = Number.isFinite(wind) ? Math.max(-MAX_WIND, Math.min(MAX_WIND, wind)) : 0;
  const level = Math.round(Math.abs(w));
  const direction = (w > 0 ? 1 : w < 0 ? -1 : 0) as -1 | 0 | 1;
  return {
    direction,
    angle: direction < 0 ? Math.PI : 0,
    particles: Math.round((Math.abs(w) / MAX_WIND) * MAX_WIND_PARTICLES),
    driftSpeed: w * 70,
    sockLevel: level,
    arrows: level,
    notice: level > 0,
    streaks: level >= 3,
    cloudShift: w * 8,
  };
}
