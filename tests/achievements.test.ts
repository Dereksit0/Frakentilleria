import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENT_DEFS,
  ACHIEVEMENT_MS,
  AchievementQueue,
  checkEnd,
  checkLive,
  toastPose,
  type EndSnapshot,
  type LiveSnapshot,
} from '../src/core/achievements';

const live = (o: Partial<LiveSnapshot> = {}): LiveSnapshot => ({ damageDealt: 0, weaponsUsed: 1, acidRoundsSurvived: 0, ...o });
const end = (o: Partial<EndSnapshot> = {}): EndSnapshot => ({
  winner: 0,
  wins: 1,
  hpLeft: [50, 0],
  maxHp: [88, 88],
  comeback: [false, false],
  deathCause: 'weapon',
  ownsAllCosmetics: false,
  cosmeticsExist: true,
  ...o,
});

describe('los 8 logros (datos)', () => {
  it('son 8, con id, arte ach-*, nombre y descripción', () => {
    expect(ACHIEVEMENT_DEFS).toHaveLength(8);
    expect(new Set(ACHIEVEMENT_DEFS.map((a) => a.id)).size).toBe(8);
    for (const a of ACHIEVEMENT_DEFS) {
      expect(a.art).toMatch(/^ach-/);
      expect(a.name.length).toBeGreaterThan(2);
      expect(a.desc.length).toBeGreaterThan(5);
    }
  });
});

describe('logros durante el combate (checkLive)', () => {
  it('primer golpe: al hacer el primer daño a un rival', () => {
    expect(checkLive(live(), [])).toEqual([]);
    expect(checkLive(live({ damageDealt: 7 }), [])).toContain('primer-golpe');
  });
  it('usar 5 armas distintas en una partida', () => {
    expect(checkLive(live({ weaponsUsed: 4 }), [])).not.toContain('arsenal');
    expect(checkLive(live({ weaponsUsed: 5 }), [])).toContain('arsenal');
  });
  it('sobrevivir 2 rondas de ácido', () => {
    expect(checkLive(live({ acidRoundsSurvived: 1 }), [])).not.toContain('superviviente');
    expect(checkLive(live({ acidRoundsSurvived: 2 }), [])).toContain('superviviente');
  });
  it('no repite los ya desbloqueados', () => {
    expect(checkLive(live({ damageDealt: 7 }), ['primer-golpe'])).not.toContain('primer-golpe');
  });
});

describe('logros al terminar la partida (checkEnd)', () => {
  it('tres victorias acumuladas', () => {
    expect(checkEnd(end({ wins: 2 }), [])).not.toContain('tres-victorias');
    expect(checkEnd(end({ wins: 3 }), [])).toContain('tres-victorias');
  });
  it('partida sin recibir daño: gana con toda la vida', () => {
    expect(checkEnd(end({ hpLeft: [88, 0] }), [])).toContain('sin-dano');
    expect(checkEnd(end({ hpLeft: [87, 0] }), [])).not.toContain('sin-dano');
    expect(checkEnd(end({ winner: null, hpLeft: [88, 88] }), [])).not.toContain('sin-dano');
  });
  it('muerte por ácido del rival', () => {
    expect(checkEnd(end({ deathCause: 'acid' }), [])).toContain('muerte-acida');
    expect(checkEnd(end({ deathCause: 'weapon' }), [])).not.toContain('muerte-acida');
    expect(checkEnd(end({ winner: null, deathCause: 'acid' }), [])).not.toContain('muerte-acida');
  });
  it('remontada: gana quien llegó a ir perdiendo', () => {
    expect(checkEnd(end({ comeback: [true, false] }), [])).toContain('remontada');
    expect(checkEnd(end({ winner: 1, comeback: [true, false] }), [])).not.toContain('remontada');
  });
  it('coleccionista: bloqueado sin cosméticos y solo con todos reunidos', () => {
    expect(checkEnd(end({ cosmeticsExist: false, ownsAllCosmetics: true }), [])).not.toContain('coleccionista');
    expect(checkEnd(end({ ownsAllCosmetics: false }), [])).not.toContain('coleccionista');
    expect(checkEnd(end({ ownsAllCosmetics: true }), [])).toContain('coleccionista');
  });
  it('un empate no da logros de victoria', () => {
    const r = checkEnd(end({ winner: null, wins: 9, hpLeft: [88, 88] }), []);
    expect(r).not.toContain('tres-victorias');
    expect(r).not.toContain('sin-dano');
  });
});

describe('cola y temporizador del aviso', () => {
  it('dura unos 3 s y encola varios sin repetirlos', () => {
    expect(ACHIEVEMENT_MS).toBeGreaterThanOrEqual(2800);
    expect(ACHIEVEMENT_MS).toBeLessThanOrEqual(3200);
    const q = new AchievementQueue();
    expect(q.current).toBeNull();
    q.push('primer-golpe');
    q.push('arsenal');
    q.push('primer-golpe'); // duplicate ignored
    expect(q.current?.id).toBe('primer-golpe');
    expect(q.pending).toBe(1);
    q.update(ACHIEVEMENT_MS - 1);
    expect(q.current?.id).toBe('primer-golpe');
    q.update(2);
    expect(q.current?.id).toBe('arsenal');
    expect(q.current?.t).toBeLessThan(5);
    q.update(ACHIEVEMENT_MS + 1);
    expect(q.current).toBeNull();
  });
  it('el tiempo sobrante pasa al siguiente aviso', () => {
    const q = new AchievementQueue();
    q.push('a');
    q.push('b');
    q.update(ACHIEVEMENT_MS + 500);
    expect(q.current?.id).toBe('b');
    expect(q.current?.t).toBeCloseTo(500, 5);
  });
  it('un id que ya salió no vuelve a encolarse mientras dure la sesión de la cola', () => {
    const q = new AchievementQueue();
    q.push('a');
    q.update(ACHIEVEMENT_MS + 1);
    q.push('a');
    expect(q.current).toBeNull();
  });
});

describe('pose del aviso: baja, se mantiene y se desvanece', () => {
  it('entra desde arriba, se queda y sale', () => {
    expect(toastPose(0, false).slide).toBeCloseTo(0, 2);
    expect(toastPose(500, false).slide).toBe(1);
    expect(toastPose(ACHIEVEMENT_MS / 2, false).alpha).toBe(1);
    expect(toastPose(ACHIEVEMENT_MS, false).alpha).toBeCloseTo(0, 2);
    expect(toastPose(ACHIEVEMENT_MS, false).slide).toBeLessThan(1);
  });
  it('con "Reducir efectos" solo se desvanece (sin desplazamiento)', () => {
    for (const t of [0, 200, 1500, ACHIEVEMENT_MS - 100]) expect(toastPose(t, true).slide).toBe(1);
    expect(toastPose(0, true).alpha).toBeCloseTo(0, 2);
    expect(toastPose(1500, true).alpha).toBe(1);
    expect(toastPose(ACHIEVEMENT_MS, true).alpha).toBeCloseTo(0, 2);
  });
});
