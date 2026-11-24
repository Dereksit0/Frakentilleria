import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/core/battle';
import { CRATES } from '../src/core/data';
import { Terrain } from '../src/core/terrain';
import type { Selection } from '../src/core/stats';

const sel = (arms: string, torso: string): Selection => ({ head: 'maniqui', torso, arms, legs: 'maniqui' });
function make(seed = 3, spawns: [number, number] = [300, 1300]): Battle {
  const t = Terrain.fromHeights(1600, 900, new Array(1600).fill(700));
  const b = new Battle({
    seed,
    terrain: t,
    spawns,
    selections: [sel('maniqui', 'maniqui'), sel('armadura', 'armadura')],
  });
  b.rules.events = false;
  b.rules.spread = false;
  return b;
}
const run = (b: Battle, secs: number): BattleEvent[] => {
  const ev: BattleEvent[] = [];
  for (let i = 0; i < Math.round(secs * 60); i++) {
    b.update(1 / 60);
    ev.push(...b.drainEvents());
  }
  return ev;
};
const drop = (b: Battle, type: string, unit: number): void => {
  b.crates.push({ id: 900 + b.crates.length, type, x: b.units[unit].x, y: b.units[unit].y, landed: true });
};

describe('catálogo de cajas', () => {
  it('hay cajas de salud, de arma (munición), de utilidad (más tiempo de turno), misteriosa e imitadora', () => {
    const effects = Object.values(CRATES.types).map((c) => c.effect);
    for (const e of ['heal', 'ammo', 'moveTime', 'mystery', 'mimic']) expect(effects, e).toContain(e);
    for (const c of Object.values(CRATES.types)) {
      expect(c.weight).toBeGreaterThan(0);
      expect(c.name).toBeTruthy();
    }
  });

  it('cae en paracaídas: lento y parejo', () => {
    expect(CRATES.fallSpeed).toBeGreaterThan(0);
    expect(CRATES.fallSpeed).toBeLessThanOrEqual(200);
    const b = make();
    b.spawnCrate();
    const c = b.crates[0];
    const y0 = c.y;
    run(b, 1);
    expect(c.y - y0).toBeLessThanOrEqual(CRATES.fallSpeed * 1.05);
    expect(c.y - y0).toBeGreaterThan(CRATES.fallSpeed * 0.8);
  });
});

describe('mystery crate: bonus or trap, never lethal', () => {
  it('both outcomes happen across seeds; a trap leaves at least 1 health', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const b = make(seed);
      b.units[0].hp = 2;
      drop(b, 'misteriosa', 0);
      const ev = run(b, 0.2);
      expect(b.units[0].alive, `seed ${seed}`).toBe(true);
      const pick = ev.find((e) => e.type === 'crate-pick');
      expect(pick).toBeDefined();
      const outcome = ev.find((e) => e.type === 'crate-outcome');
      if (outcome && outcome.type === 'crate-outcome') seen.add(outcome.good ? 'bonus' : 'trap');
    }
    expect([...seen].sort()).toEqual(['bonus', 'trap']);
  });
});

describe('la caja imitadora explota', () => {
  it('blows up on pickup, hurting without killing, and disappears', () => {
    const b = make();
    b.units[0].hp = 3;
    drop(b, 'imitadora', 0);
    const ev = run(b, 0.3);
    expect(ev.some((e) => e.type === 'explosion' && e.weapon === 'imitadora')).toBe(true);
    expect(b.units[0].alive).toBe(true);
    expect(b.units[0].hp).toBeLessThan(3);
    expect(b.crates).toHaveLength(0);
  });
});

describe('remontada: las cajas caen más cerca de quien va perdiendo', () => {
  const nearLoser = (catchUp: boolean): number => {
    let near = 0;
    let total = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const b = make(seed);
      b.rules.catchUp = catchUp;
      b.units[1].hp = Math.round(b.units[1].maxHp * 0.3);
      b.crates = [];
      b.spawnCrate();
      for (const c of b.crates) {
        total++;
        if (Math.abs(c.x - b.units[1].x) <= 300) near++;
      }
    }
    return near / total;
  };

  it('con una diferencia grande las cajas caen junto al que pierde mucho más seguido que por azar', () => {
    const on = nearLoser(true);
    const off = nearLoser(false);
    expect(on).toBeGreaterThan(off + 0.25);
    expect(on).toBeGreaterThan(0.55);
  });

  it('con una partida pareja las cajas siguen cayendo en cualquier lado', () => {
    let near = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const b = make(seed);
      b.crates = [];
      b.spawnCrate();
      if (Math.abs(b.crates[0].x - b.units[1].x) <= 300) near++;
    }
    expect(near / 60).toBeLessThan(0.5);
  });

  it('la diferencia y la atracción salen de los datos', () => {
    expect(CRATES.catchUp.gap).toBeGreaterThan(0);
    expect(CRATES.catchUp.pull).toBeGreaterThan(0);
    expect(CRATES.catchUp.pull).toBeLessThanOrEqual(1);
  });
});

describe('datos del resumen de partida para las recompensas', () => {
  it('marca una remontada cuando una criatura baja a 40 % o menos de la vida del rival', () => {
    const b = make();
    b.units[0].hp = Math.floor(b.units[1].hp * 0.4);
    b.forceEndTurn();
    expect(b.comeback[0]).toBe(true);
    expect(b.comeback[1]).toBe(false);
  });

  it('recuerda las armas disparadas y la causa de la última muerte', () => {
    const b = make();
    b.selectWeapon('canon');
    b.fire();
    expect(b.weaponsUsed.has('canon')).toBe(true);
    b.units[1].hp = 1;
    b.acidLevelOverride = 100;
    b.forceEndTurn();
    expect(b.lastDeathCause).toBe('acid');
  });
});
