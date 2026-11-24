import cosmeticsJson from '../data/cosmetics.json';
import { ACHIEVEMENT_DEFS, checkEnd, checkLive, type LiveSnapshot } from './achievements';
import type { Rng } from './rng';

/** Cofre de remiendos, colección y logros. Reglas puras: el almacenamiento se inyecta (localStorage en el navegador). */

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

/** Lo que le cuenta al sistema de recompensas una partida terminada. */
export interface MatchSummary {
  winner: number | null;
  rounds: number;
  damage: [number, number];
  bestShot: [number, number];
  hpLeft: [number, number];
  /** Vida completa de cada criatura (para "sin recibir daño"). */
  maxHp?: [number, number];
  /** Llegó a tener 40 % o menos de la vida del rival en algún momento. */
  comeback: [boolean, boolean];
  deathCause: string | null;
  weaponsUsed: string[];
}

export type { AchievementDef } from './achievements';
export const ACHIEVEMENTS = ACHIEVEMENT_DEFS;
interface Progress {
  matches: number;
  wins: number;
  weaponsSeen: string[];
}

/** Elige lo que trae un cofre: solo objetos nuevos, con más peso a los comunes. Ganar abre un cofre más grande. */
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

/** Cosméticos que se tienen, los equipados, logros y contadores. Cada acceso al almacenamiento está protegido. */
export class Collection {
  private state: Saved = fresh();

  constructor(private readonly storage: StorageLike | null) {
    try {
      const raw = storage?.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Saved>;
        this.state = {
          owned: Array.isArray(p.owned)
            ? p.owned.filter((id) => COSMETICS.items.some((i) => i.id === id))
            : [],
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
      /* ventana privada o almacenamiento bloqueado: se sigue en memoria */
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
    for (const id of ids)
      if (!this.owns(id) && COSMETICS.items.some((i) => i.id === id)) this.state.owned.push(id);
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

  /** Cuenta la partida, abre el cofre y da los logros nuevos. */
  recordMatch(m: MatchSummary, rng: Rng): { chest: string[]; achievements: string[] } {
    const p = this.state.progress;
    p.matches++;
    if (m.winner !== null) p.wins++;
    for (const w of m.weaponsUsed) if (!p.weaponsSeen.includes(w)) p.weaponsSeen.push(w);

    const w = m.winner;
    const chest = rollChest(rng, this.state.owned, w !== null);
    this.state.owned.push(...chest);
    const earned = checkEnd(
      {
        winner: w,
        wins: p.wins,
        hpLeft: m.hpLeft,
        maxHp: m.maxHp ?? [Infinity, Infinity],
        comeback: m.comeback,
        deathCause: m.deathCause,
        ownsAllCosmetics: COSMETICS.items.every((i) => this.state.owned.includes(i.id)),
        cosmeticsExist: COSMETICS.items.length > 0,
      },
      this.state.achievements,
    );
    this.award(earned);
    this.save();
    return { chest, achievements: earned };
  }

  /** Logros ganados desde `beginMatch` (los de en vivo y los del resumen final). */
  private matchNewIds: string[] = [];
  beginMatch(): void {
    this.matchNewIds = [];
  }
  matchNew(): string[] {
    return [...this.matchNewIds];
  }
  private award(ids: readonly string[]): string[] {
    const fresh: string[] = [];
    for (const id of ids)
      if (ACHIEVEMENT_DEFS.some((d) => d.id === id) && !this.state.achievements.includes(id)) {
        this.state.achievements.push(id);
        this.matchNewIds.push(id);
        fresh.push(id);
      }
    return fresh;
  }

  /** Da lo que desbloqueó la partida en curso y devuelve solo los ids nuevos (para mostrar el aviso). */
  checkLive(s: LiveSnapshot): string[] {
    const fresh = this.award(checkLive(s, this.state.achievements));
    if (fresh.length) this.save();
    return fresh;
  }
}

/** La colección de este navegador (localStorage puede fallar en ventanas privadas y se maneja adentro). */
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
