export const ACID_START_ROUND = 6;
export const ACID_RISE_PER_ROUND = 40;
/** Daño fijo al cerrar el turno para quien esté en el ácido. TODO(balance): provisional. */
export const ACID_DAMAGE = 15;

/** Altura (y) de la superficie del ácido. Con worldHeight todavía no hay ácido. */
export function acidLevelY(round: number, worldHeight: number): number {
  if (round < ACID_START_ROUND) return worldHeight;
  return Math.max(0, worldHeight - ACID_RISE_PER_ROUND * (round - ACID_START_ROUND + 1));
}

export function acidDamageAt(footY: number, round: number, worldHeight: number): number {
  if (round < ACID_START_ROUND) return 0;
  return footY >= acidLevelY(round, worldHeight) ? ACID_DAMAGE : 0;
}
