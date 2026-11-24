import achievementsJson from '../data/achievements.json';

/** Achievement rules, queue and toast timing. Pure: the scenes only draw what this decides. */
export interface AchievementDef {
  id: string;
  /** Atlas frame of the badge (ach-*). */
  art: string;
  name: string;
  desc: string;
}
export const ACHIEVEMENT_DEFS = achievementsJson.items as AchievementDef[];

/** What can be known while the match is running. */
export interface LiveSnapshot {
  /** Total damage dealt to rivals so far (both players). */
  damageDealt: number;
  /** Different weapons fired so far. */
  weaponsUsed: number;
  /** Full rounds played since the acid started. */
  acidRoundsSurvived: number;
}

/** What is known when the match ends. */
export interface EndSnapshot {
  winner: number | null;
  /** Wins accumulated on this device, counting this match. */
  wins: number;
  hpLeft: [number, number];
  maxHp: [number, number];
  comeback: [boolean, boolean];
  deathCause: string | null;
  ownsAllCosmetics: boolean;
  cosmeticsExist: boolean;
}

export const ARSENAL_WEAPONS = 5;
export const SURVIVE_ACID_ROUNDS = 2;
export const WINS_GOAL = 3;

/** New achievements unlocked by the running match. */
export function checkLive(s: LiveSnapshot, unlocked: readonly string[]): string[] {
  const out: string[] = [];
  const add = (id: string, ok: boolean): void => {
    if (ok && !unlocked.includes(id)) out.push(id);
  };
  add('primer-golpe', s.damageDealt > 0);
  add('arsenal', s.weaponsUsed >= ARSENAL_WEAPONS);
  add('superviviente', s.acidRoundsSurvived >= SURVIVE_ACID_ROUNDS);
  return out;
}

/** New achievements unlocked by the finished match. */
export function checkEnd(s: EndSnapshot, unlocked: readonly string[]): string[] {
  const out: string[] = [];
  const add = (id: string, ok: boolean): void => {
    if (ok && !unlocked.includes(id)) out.push(id);
  };
  const w = s.winner;
  add('tres-victorias', w !== null && s.wins >= WINS_GOAL);
  add('sin-dano', w !== null && s.hpLeft[w] >= s.maxHp[w]);
  add('muerte-acida', w !== null && s.deathCause === 'acid');
  add('remontada', w !== null && s.comeback[w]);
  add('coleccionista', s.cosmeticsExist && s.ownsAllCosmetics);
  return out;
}

/** Total time one toast stays on screen (ms). */
export const ACHIEVEMENT_MS = 3000;
const IN_MS = 350;
const OUT_MS = 450;

/** Queue of toasts: one at a time, the rest wait; an id is shown once per queue. */
export class AchievementQueue {
  private readonly items: string[] = [];
  private readonly seen = new Set<string>();
  current: { id: string; t: number } | null = null;

  get pending(): number {
    return this.items.length;
  }

  push(id: string): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    if (!this.current) this.current = { id, t: 0 };
    else this.items.push(id);
  }

  update(dtMs: number): void {
    let left = dtMs;
    while (this.current && left > 0) {
      const room = ACHIEVEMENT_MS - this.current.t;
      if (left < room) {
        this.current.t += left;
        return;
      }
      left -= room;
      const next = this.items.shift();
      this.current = next ? { id: next, t: 0 } : null;
    }
  }
}

export interface ToastPose {
  /** 0 = above the screen, 1 = in place. */
  slide: number;
  alpha: number;
}

/** Slide in from the top, hold, fade out. With reduced effects: no movement, only fade. */
export function toastPose(t: number, reduced: boolean): ToastPose {
  const tt = Math.max(0, Math.min(ACHIEVEMENT_MS, t));
  const fadeOut = tt > ACHIEVEMENT_MS - OUT_MS ? (ACHIEVEMENT_MS - tt) / OUT_MS : 1;
  if (reduced) return { slide: 1, alpha: Math.min(tt / IN_MS, 1, fadeOut) };
  const slideIn = 1 - (1 - Math.min(tt / IN_MS, 1)) ** 3;
  const slide = tt > ACHIEVEMENT_MS - OUT_MS ? fadeOut : slideIn;
  return { slide, alpha: Math.min(1, fadeOut) };
}
