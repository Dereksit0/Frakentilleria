import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  COSMETICS,
  Collection,
  rollChest,
  type MatchSummary,
  type StorageLike,
} from '../src/core/rewards';
import { Rng } from '../src/core/rng';

const memory = (): StorageLike & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
};
const broken: StorageLike = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};
const summary = (over: Partial<MatchSummary> = {}): MatchSummary => ({
  winner: 0,
  rounds: 9,
  damage: [40, 30],
  bestShot: [12, 10],
  hpLeft: [50, 0],
  maxHp: [88, 88],
  comeback: [false, false],
  deathCause: 'weapon',
  weaponsUsed: ['canon'],
  ...over,
});

describe('cosmetics data', () => {
  it('has patches, hats and colours with unique ids and names; none changes combat', () => {
    const kinds = new Set(COSMETICS.items.map((i) => i.kind));
    for (const k of ['parche', 'sombrero', 'color']) expect(kinds.has(k as 'parche'), k).toBe(true);
    expect(new Set(COSMETICS.items.map((i) => i.id)).size).toBe(COSMETICS.items.length);
    expect(COSMETICS.items.length).toBeGreaterThanOrEqual(12);
    for (const i of COSMETICS.items) {
      expect(i.name).toBeTruthy();
      expect(Object.keys(i)).not.toContain('stats');
    }
  });
});

describe('patch chest', () => {
  it('gives an item you do not own yet, deterministically', () => {
    const a = rollChest(new Rng(5), [], false);
    const b = rollChest(new Rng(5), [], false);
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
    const owned = [a[0]];
    expect(rollChest(new Rng(5), owned, false)[0]).not.toBe(a[0]);
  });
  it('a win opens a bigger chest', () => {
    expect(rollChest(new Rng(1), [], true).length).toBeGreaterThan(rollChest(new Rng(1), [], false).length);
  });
  it('is empty once everything is collected', () => {
    expect(
      rollChest(
        new Rng(1),
        COSMETICS.items.map((i) => i.id),
        true,
      ),
    ).toEqual([]);
  });
});

describe('collection storage', () => {
  it('persists across instances', () => {
    const st = memory();
    const c = new Collection(st);
    c.unlock(['parche-rayo']);
    expect(new Collection(st).owns('parche-rayo')).toBe(true);
  });

  it('survives blocked storage (private window): works in memory', () => {
    const c = new Collection(broken);
    expect(() => c.unlock(['parche-rayo'])).not.toThrow();
    expect(c.owns('parche-rayo')).toBe(true);
  });

  it('survives corrupt data', () => {
    const st = memory();
    st.setItem('frankentilleria.collection', '{not json');
    expect(new Collection(st).owned()).toEqual([]);
  });

  it('equips only owned items, one per kind', () => {
    const c = new Collection(memory());
    const hats = COSMETICS.items.filter((i) => i.kind === 'sombrero');
    expect(c.equip(hats[0].id)).toBe(false);
    c.unlock([hats[0].id, hats[1].id]);
    expect(c.equip(hats[0].id)).toBe(true);
    expect(c.equip(hats[1].id)).toBe(true);
    expect(c.equipped().sombrero).toBe(hats[1].id);
  });
});

describe('achievements (see tests/achievements.test.ts for the rules)', () => {
  it('there are exactly 8, from data', () => {
    expect(ACHIEVEMENTS).toHaveLength(8);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(8);
  });

  it('recordMatch awards the end-of-match ones through the collection and never twice', () => {
    const c = new Collection(memory());
    const r1 = c.recordMatch(
      summary({ comeback: [true, false], hpLeft: [88, 0], maxHp: [88, 88], deathCause: 'acid' }),
      new Rng(1),
    );
    for (const id of ['remontada', 'sin-dano', 'muerte-acida']) expect(r1.achievements).toContain(id);
    expect(c.achievements()).toEqual(expect.arrayContaining(['remontada', 'sin-dano', 'muerte-acida']));
    const r2 = c.recordMatch(
      summary({ comeback: [true, false], hpLeft: [88, 0], maxHp: [88, 88], deathCause: 'acid' }),
      new Rng(2),
    );
    expect(r2.achievements).toEqual([]);
  });

  it('three accumulated wins unlock tres-victorias; draws do not count', () => {
    const c = new Collection(memory());
    let got: string[] = [];
    for (let i = 0; i < 2; i++)
      got = got.concat(c.recordMatch(summary({ winner: 0 }), new Rng(i)).achievements);
    c.recordMatch(summary({ winner: null }), new Rng(7));
    expect(got).not.toContain('tres-victorias');
    expect(c.recordMatch(summary({ winner: 1 }), new Rng(3)).achievements).toContain('tres-victorias');
  });

  it('live achievements are awarded once and listed as new in this match', () => {
    const c = new Collection(memory());
    c.beginMatch();
    expect(c.checkLive({ damageDealt: 0, weaponsUsed: 1, acidRoundsSurvived: 0 })).toEqual([]);
    expect(c.checkLive({ damageDealt: 5, weaponsUsed: 5, acidRoundsSurvived: 2 }).sort()).toEqual([
      'arsenal',
      'primer-golpe',
      'superviviente',
    ]);
    expect(c.checkLive({ damageDealt: 9, weaponsUsed: 6, acidRoundsSurvived: 3 })).toEqual([]);
    expect(c.matchNew().sort()).toEqual(['arsenal', 'primer-golpe', 'superviviente']);
    c.beginMatch();
    expect(c.matchNew()).toEqual([]);
  });

  it('coleccionista needs every cosmetic', () => {
    const c = new Collection(memory());
    c.unlock(COSMETICS.items.map((i) => i.id));
    expect(c.recordMatch(summary({ winner: null }), new Rng(1)).achievements).toContain('coleccionista');
  });

  it('every match opens a chest and the new items become owned', () => {
    const c = new Collection(memory());
    const r = c.recordMatch(summary(), new Rng(3));
    expect(r.chest.length).toBeGreaterThan(0);
    for (const id of r.chest) expect(c.owns(id)).toBe(true);
  });
});
