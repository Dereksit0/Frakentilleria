import { WEAPONS } from './data';
import { TUNING } from './tuning';

/** Aim every turn starts from, for a creature facing `facing` (1 = right). */
export function neutralAim(facing: 1 | -1): { angle: number; power: number } {
  const a = TUNING.aim.angle;
  return { angle: facing === 1 ? a : 180 - a, power: TUNING.aim.power };
}

/** Half-width (degrees) of the random aim error: grows with power and with the distance walked this turn. */
export function aimSpread(weaponId: string, power: number, movedPx: number): number {
  const s = WEAPONS[weaponId]?.spread;
  if (!s) return 0;
  return s.base + s.perPower * power + s.perMove * movedPx;
}
