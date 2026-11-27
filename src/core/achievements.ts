import achievementsJson from '../data/achievements.json';

/** Reglas de los logros, cola y tiempos del aviso. Sin Phaser: las escenas solo dibujan lo que esto decide. */
export interface AchievementDef {
  id: string;
  /** Frame de la insignia en el atlas (ach-*). */
  art: string;
  name: string;
  desc: string;
}
export const ACHIEVEMENT_DEFS = achievementsJson.items as AchievementDef[];

/** Lo que se sabe mientras la partida sigue en juego. */
export interface LiveSnapshot {
  /** Daño total hecho a rivales hasta ahora (de los dos jugadores). */
  damageDealt: number;
  /** Different weapons fired so far. */
  weaponsUsed: number;
  /** Rondas completas jugadas desde que empezó el ácido. */
  acidRoundsSurvived: number;
}

/** Lo que se sabe cuando termina la partida. */
export interface EndSnapshot {
  winner: number | null;
  /** Victorias acumuladas en este dispositivo, contando esta partida. */
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

/** Logros nuevos que desbloquea la partida en curso. */
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

/** Logros nuevos que desbloquea la partida terminada. */
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

/** Tiempo total que un aviso se queda en pantalla (ms). */
export const ACHIEVEMENT_MS = 3000;
const IN_MS = 350;
const OUT_MS = 450;

/** Cola de avisos: sale uno a la vez y los demás esperan; un id se muestra una sola vez por cola. */
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
  /** 0 = arriba, fuera de la pantalla; 1 = en su lugar. */
  slide: number;
  alpha: number;
}

/** Entra desde arriba, se sostiene y se desvanece. Con efectos reducidos no se mueve, solo se desvanece. */
export function toastPose(t: number, reduced: boolean): ToastPose {
  const tt = Math.max(0, Math.min(ACHIEVEMENT_MS, t));
  const fadeOut = tt > ACHIEVEMENT_MS - OUT_MS ? (ACHIEVEMENT_MS - tt) / OUT_MS : 1;
  if (reduced) return { slide: 1, alpha: Math.min(tt / IN_MS, 1, fadeOut) };
  const slideIn = 1 - (1 - Math.min(tt / IN_MS, 1)) ** 3;
  const slide = tt > ACHIEVEMENT_MS - OUT_MS ? fadeOut : slideIn;
  return { slide, alpha: Math.min(1, fadeOut) };
}
