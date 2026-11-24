import { PARTS, WEAPONS, DONOR_IDS, SLOTS, type PartDef, type Slot } from './data';
import type { Rng } from './rng';

export { PARTS };
export type { Slot };
export type DonorId = string;
export type Selection = Record<Slot, DonorId>;

export interface Stats {
  hp: number;
  /** Percent, 100 = normal. */
  mobility: number;
  /** Percent damage reduction. */
  resistance: number;
  /** Percent, 100 = normal. */
  damage: number;
}

export const BUDGET_LIMIT = PARTS.budget;

export function partFor(donor: DonorId, slot: Slot): PartDef {
  const p = PARTS.parts.find((x) => x.donor === donor && x.slot === slot);
  if (!p) throw new Error(`Unknown part ${donor}/${slot}`);
  return p;
}

export function computeStats(sel: Selection): Stats {
  const s: Stats = {
    hp: PARTS.base.hp,
    mobility: PARTS.base.mobility,
    resistance: PARTS.base.resistance,
    damage: PARTS.base.damage,
  };
  for (const slot of SLOTS) {
    const e = partFor(sel[slot], slot).effect;
    s.hp += e.hp ?? 0;
    s.mobility += e.mob ?? 0;
    s.resistance += e.res ?? 0;
    s.damage += e.dmg ?? 0;
  }
  return s;
}

export function budgetOf(sel: Selection): { total: number; limit: number; over: boolean } {
  const total = SLOTS.reduce((a, slot) => a + partFor(sel[slot], slot).cost, 0);
  return { total, limit: BUDGET_LIMIT, over: total > BUDGET_LIMIT };
}

/** Weapons granted by arms then torso, deduplicated, in that order. */
export function weaponsFor(sel: Selection): string[] {
  const out: string[] = [];
  for (const slot of ['arms', 'torso'] as const) {
    const w = partFor(sel[slot], slot).weapon;
    if (w && WEAPONS[w] && !out.includes(w)) out.push(w);
  }
  return out;
}

export function abilityFor(sel: Selection): string | undefined {
  return partFor(sel.head, 'head').ability;
}

/** Random selection that respects the budget (retries with the seeded generator). */
export function randomSelection(rng: Rng): Selection {
  for (let i = 0; i < 200; i++) {
    const sel = {} as Selection;
    for (const slot of SLOTS) sel[slot] = rng.pick(DONOR_IDS);
    if (!budgetOf(sel).over) return sel;
  }
  const cheapest = [...DONOR_IDS].sort((a, b) => partFor(a, 'head').cost - partFor(b, 'head').cost)[0];
  return { head: cheapest, torso: cheapest, arms: cheapest, legs: cheapest };
}
