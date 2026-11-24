import { WEAPONS } from './data';
import { TUNING } from './tuning';

/** Puntería con la que arranca cada turno. `facing` 1 = mira a la derecha. */
export function neutralAim(facing: 1 | -1): { angle: number; power: number } {
  const a = TUNING.aim.angle;
  return { angle: facing === 1 ? a : 180 - a, power: TUNING.aim.power };
}

/** Error de puntería en grados hacia cada lado: crece con la potencia y con lo que caminó en el turno. */
export function aimSpread(weaponId: string, power: number, movedPx: number): number {
  const s = WEAPONS[weaponId]?.spread;
  if (!s) return 0;
  return s.base + s.perPower * power + s.perMove * movedPx;
}
