/** Maximum resistance a creature can reach (keeps damage from dropping to zero). */
const MAX_RESISTANCE = 0.9;
/** Falls up to this many pixels are free. TODO(balance): provisional value. */
export const FALL_SAFE_DISTANCE = 120;
/** Damage per pixel beyond the safe distance. TODO(balance): provisional value. */
const FALL_DAMAGE_PER_PX = 0.18;
/** Share of the weapon damage still applied at the very edge of an explosion. */
const EXPLOSION_MIN_FALLOFF = 0.3;

/** damage = base × (1 + bonus) × (1 − resistance); rounded, never negative. */
export function calcDamage(base: number, bonus: number, resistance: number): number {
  const res = Math.min(Math.max(resistance, 0), MAX_RESISTANCE);
  return Math.max(0, Math.round(base * (1 + bonus) * (1 - res)));
}

/** Multiplier (0..1) for damage at `dist` from the blast centre. */
export function explosionFalloff(dist: number, radius: number): number {
  if (dist >= radius) return 0;
  return 1 - (1 - EXPLOSION_MIN_FALLOFF) * (Math.max(dist, 0) / radius);
}

export function fallDamage(distancePx: number, resistance: number): number {
  if (distancePx <= FALL_SAFE_DISTANCE) return 0;
  const res = Math.min(Math.max(resistance, 0), MAX_RESISTANCE);
  return Math.round((distancePx - FALL_SAFE_DISTANCE) * FALL_DAMAGE_PER_PX * (1 - res));
}
