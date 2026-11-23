import { MAPS } from '../core/data';
import { pickMapId } from '../core/maps';
import { newSeed } from '../core/rng';
import type { Selection } from '../core/stats';

/** Data that survives between scenes (creatures chosen, map choice, match seed). */
export const session: {
  selections: [Selection | null, Selection | null];
  /** Creature being edited per player (kept when going back from J2 to J1). */
  drafts: [Selection | null, Selection | null];
  /** -1 = random map (decided by the match seed). */
  mapChoice: number;
  seed: number;
} = {
  selections: [null, null],
  drafts: [null, null],
  mapChoice: -1,
  seed: 1,
};

/** Forgets every creature (new game from the menu, or "Cambiar criaturas"). */
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
