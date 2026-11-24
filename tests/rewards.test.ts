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
  comeback: [false, false],
  deathCause: 'weapon',
  weaponsUsed: ['canon'],
  ...over,
});

describe('datos de cosméticos', () => {
  it('hay parches, sombreros y colores con ids y nombres únicos; ninguno cambia el combate', () => {
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

describe('cofre de remiendos', () => {
  it('gives an item you do not own yet, deterministically', () => {
    const a = rollChest(new Rng(5), [], false);
    const b = rollChest(new Rng(5), [], false);
    expect(a).toEqual(b);
    expect(a).toHaveLength(1);
    const owned = [a[0]];
    expect(rollChest(new Rng(5), owned, false)[0]).not.toBe(a[0]);
  });
  it('ganar abre un cofre más grande', () => {
    expect(rollChest(new Rng(1), [], true).length).toBeGreaterThan(rollChest(new Rng(1), [], false).length);
  });
  it('queda vacío cuando ya se juntó todo', () => {
    expect(
      rollChest(
        new Rng(1),
        COSMETICS.items.map((i) => i.id),
        true,
      ),
    ).toEqual([]);
  });
});

describe('almacenamiento de la colección', () => {
  it('se conserva entre instancias', () => {
    const st = memory();
    const c = new Collection(st);
    c.unlock(['parche-rayo']);
    expect(new Collection(st).owns('parche-rayo')).toBe(true);
  });

  it('aguanta el almacenamiento bloqueado (ventana privada): funciona en memoria', () => {
    const c = new Collection(broken);
    expect(() => c.unlock(['parche-rayo'])).not.toThrow();
    expect(c.owns('parche-rayo')).toBe(true);
  });

  it('aguanta datos corruptos', () => {
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

describe('logros', () => {
  it('hay exactamente 8 simples', () => {
    expect(ACHIEVEMENTS).toHaveLength(8);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(8);
  });

  const cases: [string, Partial<MatchSummary>][] = [
    ['primera-victoria', {}],
    ['remontada', { comeback: [true, false] }],
    ['tiro-certero', { bestShot: [31, 5] }],
    ['al-limite', { hpLeft: [8, 0] }],
    ['relampago', { rounds: 5 }],
    ['acido', { deathCause: 'acid' }],
  ];
  for (const [id, over] of cases)
    it(`unlocks ${id}`, () => {
      const c = new Collection(memory());
      const r = c.recordMatch(summary(over), new Rng(1));
      expect(r.achievements).toContain(id);
    });

  it('no desbloquea los condicionales en una partida normal', () => {
    const r = new Collection(memory()).recordMatch(summary(), new Rng(1));
    for (const id of ['remontada', 'tiro-certero', 'al-limite', 'relampago', 'acido'])
      expect(r.achievements).not.toContain(id);
  });

  it('veterano tras 10 partidas y coleccionista tras usar las 8 armas; nunca se dan dos veces', () => {
    const c = new Collection(memory());
    let got: string[] = [];
    for (let i = 0; i < 10; i++)
      got = got.concat(c.recordMatch(summary({ winner: null }), new Rng(i)).achievements);
    expect(got).toContain('veterano');
    expect(got.filter((x) => x === 'veterano')).toHaveLength(1);
    const all = ['canon', 'mortero', 'bazuca', 'granada', 'mazo', 'tesla', 'hielo', 'pocion'];
    const r = c.recordMatch(summary({ weaponsUsed: all }), new Rng(1));
    expect(r.achievements).toContain('coleccionista');
    expect(c.recordMatch(summary({ weaponsUsed: all }), new Rng(2)).achievements).not.toContain(
      'coleccionista',
    );
  });

  it('cada partida abre un cofre y los objetos nuevos pasan a ser tuyos', () => {
    const c = new Collection(memory());
    const r = c.recordMatch(summary(), new Rng(3));
    expect(r.chest.length).toBeGreaterThan(0);
    for (const id of r.chest) expect(c.owns(id)).toBe(true);
  });
});
