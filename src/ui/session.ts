import { MAPS } from '../core/data';
import { pickMapId } from '../core/maps';
import { newSeed } from '../core/rng';
import type { Selection } from '../core/stats';

/** Datos que sobreviven entre escenas (criaturas elegidas, mapa y semilla de la partida). */
export const session: {
  selections: [Selection | null, Selection | null];
  /** Criatura que se edita por jugador (se conserva al volver de J2 a J1). */
  drafts: [Selection | null, Selection | null];
  /** -1 = mapa al azar (lo decide la semilla de la partida). */
  mapChoice: number;
  seed: number;
} = {
  selections: [null, null],
  drafts: [null, null],
  mapChoice: -1,
  seed: 1,
};

/** Olvida todas las criaturas (juego nuevo desde el menú o "Cambiar criaturas"). */
export function resetCreatures(): void {
  session.selections = [null, null];
  session.drafts = [null, null];
}

export function newMatchSeed(): void {
  session.seed = newSeed();
}

export function currentMap() {
  if (session.mapChoice >= 0) return MAPS[session.mapChoice];
  const id = pickMapId(
    session.seed,
    MAPS.map((m) => m.id),
  );
  return MAPS.find((m) => m.id === id) ?? MAPS[0];
}

export function mapChoiceLabel(): string {
  return session.mapChoice < 0 ? 'Aleatorio' : MAPS[session.mapChoice].name;
}

export function cycleMapChoice(): void {
  session.mapChoice = session.mapChoice + 1 >= MAPS.length ? -1 : session.mapChoice + 1;
}
