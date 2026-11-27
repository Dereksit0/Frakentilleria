/** Resistencia máxima de una criatura (evita que el daño baje a cero). */
const MAX_RESISTANCE = 0.9;
/** Las caídas de hasta esta altura en píxeles no hacen daño. TODO(balance): provisional. */
export const FALL_SAFE_DISTANCE = 120;
/** Daño por píxel después de la altura segura. TODO(balance): provisional. */
const FALL_DAMAGE_PER_PX = 0.18;
/** Parte del daño del arma que sigue aplicándose en el borde de la explosión. */
const EXPLOSION_MIN_FALLOFF = 0.3;

/** daño = base × (1 + bono) × (1 − resistencia), redondeado y nunca negativo. */
export function calcDamage(base: number, bonus: number, resistance: number): number {
  const res = Math.min(Math.max(resistance, 0), MAX_RESISTANCE);
  return Math.max(0, Math.round(base * (1 + bonus) * (1 - res)));
}

/** Multiplicador (0 a 1) del daño a `dist` del centro de la explosión. */
export function explosionFalloff(dist: number, radius: number): number {
  if (dist >= radius) return 0;
  return 1 - (1 - EXPLOSION_MIN_FALLOFF) * (Math.max(dist, 0) / radius);
}

export function fallDamage(distancePx: number, resistance: number): number {
  if (distancePx <= FALL_SAFE_DISTANCE) return 0;
  const res = Math.min(Math.max(resistance, 0), MAX_RESISTANCE);
  return Math.round((distancePx - FALL_SAFE_DISTANCE) * FALL_DAMAGE_PER_PX * (1 - res));
}
