import cosmeticsJson from '../data/cosmetics.json';
import { WEAPONS } from './data';
import type { Rng } from './rng';

/** Patch chest, collection and achievements. Pure rules; the storage is injected (localStorage in the browser). */

export type CosmeticKind = 'parche' | 'sombrero' | 'color';
export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  name: string;
  rarity: 'comun' | 'raro' | 'epico';
  color: string;
}
export const COSMETICS = cosmeticsJson as unknown as {
  items: CosmeticDef[];
  rarityWeights: Record<string, number>;
  chest: { normal: number; win: number };
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What a finished match tells the reward system. */
export interface MatchSummary {
  winner: number | null;
  rounds: number;
  damage: [number, number];
  bestShot: [number, number];
  hpLeft: [number, number];
  /** Was at <= 40 % of the rival's health at some point. */
  comeback: [boolean, boolean];
  deathCause: string | null;
  weaponsUsed: string[];
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
}
interface Progress {
  matches: number;
  wins: number;
  weaponsSeen: string[];
}

const BEST_SHOT_GOAL = 30;
const NARROW_HP = 10;
const FAST_ROUNDS = 6;
const VETERAN_MATCHES = 10;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'primera-victoria', name: 'Primera victoria', desc: 'Gana una partida' },
  { id: 'veterano', name: 'Veterano de chatarra', desc: 'Juega 10 partidas' },
  { id: 'remontada', name: '¡Remontada!', desc: 'Gana tras llegar al 40 % de la vida del rival' },
  { id: 'tiro-certero', name: 'Tiro certero', desc: `Haz ${BEST_SHOT_GOAL} de daño o más con un solo disparo` },
  { id: 'al-limite', name: 'Al límite', desc: `Gana con ${NARROW_HP} de vida o menos` },
  { id: 'relampago', name: 'Relámpago', desc: `Gana en ${FAST_ROUNDS} rondas o menos` },
  { id: 'acido', name: 'Baño ácido', desc: 'Gana viendo al rival caer en el ácido' },
  { id: 'coleccionista', name: 'Arsenal completo', desc: 'Dispara las 8 armas (en cualquier partida)' },
];

/** Picks the items of a chest: new items only, weighted by rarity. A win opens a bigger chest. */
export function rollChest(rng: Rng, owned: readonly string[], won: boolean): string[] {
  const have = new Set(owned);
  const pool = COSMETICS.items.filter((i) => !have.has(i.id));
  const out: string[] = [];
  const count = won ? COSMETICS.chest.win : COSMETICS.chest.normal;
  for (let k = 0; k < count && pool.length > 0; k++) {
    const item = rng.weighted(
      pool,
      pool.map((i) => COSMETICS.rarityWeights[i.rarity] ?? 1),
    );
    out.push(item.id);
    pool.splice(pool.indexOf(item), 1);
  }
  return out;
}

const KEY = 'frankentilleria.collection';
interface Saved {
  owned: string[];
  equipped: Partial<Record<CosmeticKind, string>>;
  achievements: string[];
  progress: Progress;
}
const fresh = (): Saved => ({
  owned: [],
  equipped: {},
  achievements: [],
  progress: { matches: 0, wins: 0, weaponsSeen: [] },
});

/** Owned cosmetics, equipped ones, achievements and counters. Every storage access is guarded. */
export class Collection {
  private state: Saved = fresh();

  constructor(private readonly storage: StorageLike | null) {
    try {
      const raw = storage?.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Saved>;
        this.state = {
          owned: Array.isArray(p.owned) ? p.owned.filter((id) => COSMETICS.items.some((i) => i.id === id)) : [],
          equipped: p.equipped && typeof p.equipped === 'object' ? p.equipped : {},
          achievements: Array.isArray(p.achievements) ? p.achievements : [],
          progress: { ...fresh().progress, ...(p.progress ?? {}) },
        };
      }
    } catch {
      this.state = fresh();
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* private window or blocked storage: keep going in memory */
    }
  }

  owned(): string[] {
    return [...this.state.owned];
  }
  owns(id: string): boolean {
    return this.state.owned.includes(id);
  }
  equipped(): Partial<Record<CosmeticKind, string>> {
    return { ...this.state.equipped };
  }
  achievements(): string[] {
    return [...this.state.achievements];
  }

  unlock(ids: readonly string[]): void {
    for (const id of ids) if (!this.owns(id) && COSMETICS.items.some((i) => i.id === id)) this.state.owned.push(id);
    this.save();
  }

  equip(id: string): boolean {
    const item = COSMETICS.items.find((i) => i.id === id);
    if (!item || !this.owns(id)) return false;
    this.state.equipped[item.kind] = id;
    this.save();
    return true;
  }

  unequip(kind: CosmeticKind): void {
    delete this.state.equipped[kind];
    this.save();
  }

  /** Counts the match, opens the chest and awards new achievements. */
  recordMatch(m: MatchSummary, rng: Rng): { chest: string[]; achievements: string[] } {
    const p = this.state.progress;
    p.matches++;
    if (m.winner !== null) p.wins++;
    for (const w of m.weaponsUsed) if (!p.weaponsSeen.includes(w)) p.weaponsSeen.push(w);

    const w = m.winner;
    const earned: string[] = [];
    const check = (id: string, ok: boolean): void => {
      if (ok && !this.state.achievements.includes(id)) {
        this.state.achievements.push(id);
        earned.push(id);
      }
    };
    check('primera-victoria', w !== null);
    check('veterano', p.matches >= VETERAN_MATCHES);
    check('remontada', w !== null && m.comeback[w]);
    check('tiro-certero', Math.max(m.bestShot[0], m.bestShot[1]) >= BEST_SHOT_GOAL);
    check('al-limite', w !== null && m.hpLeft[w] > 0 && m.hpLeft[w] <= NARROW_HP);
    check('relampago', w !== null && m.rounds <= FAST_ROUNDS);
    check('acido', w !== null && m.deathCause === 'acid');
    check('coleccionista', Object.keys(WEAPONS).every((id) => p.weaponsSeen.includes(id)));

    const chest = rollChest(rng, this.state.owned, w !== null);
    this.state.owned.push(...chest);
    this.save();
    return { chest, achievements: earned };
  }
}

/** The collection of this browser (localStorage can throw in private windows: that is handled inside). */
let shared: Collection | null = null;
export function sharedCollection(): Collection {
  if (!shared) {
    let st: StorageLike | null;
    try {
      st = typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      st = null;
    }
    shared = new Collection(st);
  }
  return shared;
}
