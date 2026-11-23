import { describe, it, expect } from 'vitest';
import { Battle } from '../src/core/battle';
import { Terrain } from '../src/core/terrain';
import { calcDamage } from '../src/core/damage';
import type { Selection } from '../src/core/stats';

const P1: Selection = { head: 'maniqui', torso: 'maniqui', arms: 'juguete', legs: 'maniqui' }; // tesla + mazo, dmg 108%
const P2: Selection = { head: 'armadura', torso: 'maniqui', arms: 'maniqui', legs: 'maniqui' }; // escudo, res 10
const P3: Selection = { head: 'refri', torso: 'maniqui', arms: 'maniqui', legs: 'maniqui' };

function make(opts: { seed?: number; ground?: number; a?: Selection; b?: Selection } = {}) {
  const ground = opts.ground ?? 700;
  const terrain = Terrain.fromHeights(1600, 900, new Array(1600).fill(ground));
  return new Battle({ seed: opts.seed ?? 1, terrain, spawns: [300, 600], selections: [opts.a ?? P1, opts.b ?? P3] });
}
const runFor = (b: Battle, secs: number) => {
  for (let i = 0; i < Math.round(secs * 60); i++) b.update(1 / 60);
};

describe('Battle setup', () => {
  it('places both units on the ground; player 1 starts, round 1, wind in range', () => {
    const b = make();
    expect(b.units).toHaveLength(2);
    expect(b.units[0].y).toBe(700);
    expect(b.units[1].x).toBe(600);
    expect(b.current.index).toBe(0);
    expect(b.round).toBe(1);
    expect(Math.abs(b.wind)).toBeLessThanOrEqual(5);
    expect(b.phase).toBe('playing');
    expect(b.units[0].facing).toBe(1);
    expect(b.units[1].facing).toBe(-1);
  });

  it('is deterministic for a seed', () => {
    const winds = (seed: number) => {
      const b = make({ seed });
      const w = [b.wind];
      for (let i = 0; i < 6; i++) {
        b.forceEndTurn();
        w.push(b.wind);
      }
      return w;
    };
    expect(winds(5)).toEqual(winds(5));
    expect(winds(5)).not.toEqual(winds(6));
  });
});

describe('Battle turn flow', () => {
  it('movement consumes the 6 s budget and then stops', () => {
    const b = make();
    const x0 = b.current.x;
    for (let i = 0; i < 60 * 8; i++) b.move(1, 1 / 60);
    // 8 s requested but only 6 s of movement allowed
    expect(b.clock.moveLeft).toBeCloseTo(0, 1);
    const walked = b.current.x - x0;
    expect(walked).toBeGreaterThan(300);
    expect(walked).toBeLessThan(6 * 140 * 1.4 + 50);
  });

  it('passes the turn after 20 s without firing', () => {
    const b = make();
    runFor(b, 20.5);
    expect(b.current.index).toBe(1);
    expect(b.clock.timeLeft).toBeGreaterThan(18);
  });

  it('firing is allowed once per turn, then a retreat of 3 s ends the turn', () => {
    const b = make();
    b.setAim(0, 100);
    expect(b.fire()).toBe(true);
    expect(b.fire()).toBe(false);
    expect(b.clock.phase).toBe('retreat');
    runFor(b, 3.5);
    expect(b.current.index).toBe(1);
  });
});

describe('Battle weapons', () => {
  it('tesla beam hits the enemy in line for base × bonus × (1 − res)', () => {
    const b = make({ b: P2 });
    expect(b.selectWeapon('tesla')).toBe(true);
    b.setAim(0, 100);
    b.fire();
    runFor(b, 0.5);
    const expected = calcDamage(20, 0.08, 0.1);
    expect(b.units[1].maxHp - b.units[1].hp).toBe(expected);
    expect(b.stats.damage[0]).toBe(expected);
    expect(b.stats.bestShot[0]).toBe(expected);
  });

  it('cannot select a weapon the creature does not have', () => {
    expect(make().selectWeapon('hielo')).toBe(false);
  });

  it('mazo hits adjacent enemies and carves terrain', () => {
    const b = make();
    b.units[1].x = 380;
    b.selectWeapon('mazo');
    b.setAim(0, 50);
    const before = b.terrain.solidCount();
    b.fire();
    runFor(b, 0.5);
    expect(b.units[1].hp).toBeLessThan(b.units[1].maxHp);
    expect(b.terrain.solidCount()).toBeLessThan(before);
  });

  it('a projectile explodes on terrain, carving a crater', () => {
    const b = make();
    // P1 has no projectile weapon of its own: use a bazooka creature
    const c = make({ a: { head: 'maniqui', torso: 'armadura', arms: 'maniqui', legs: 'maniqui' } });
    expect(c.selectWeapon('bazuca')).toBe(true);
    c.setAim(45, 50);
    const before = c.terrain.solidCount();
    c.fire();
    expect(c.projectiles.length).toBe(1);
    runFor(c, 4);
    expect(c.projectiles.length).toBe(0);
    expect(c.terrain.solidCount()).toBeLessThan(before);
    expect(b.units.length).toBe(2);
  });

  it('shield ability halves incoming damage and can be used once', () => {
    const b = make({ a: P2, b: P1 }); // player 1 has the armour head (escudo)
    expect(b.useAbility()).toBe(true);
    expect(b.useAbility()).toBe(false);
    expect(b.units[0].abilityUsed).toBe(true);
    expect(b.units[0].shield).toBe(0.5);
  });

  it('heal ability restores hp up to max', () => {
    const b = make({ a: P3 });
    b.units[0].hp = 50;
    expect(b.useAbility()).toBe(true);
    expect(b.units[0].hp).toBe(70);
  });
});

describe('Battle end conditions', () => {
  it('last creature standing wins', () => {
    const b = make();
    b.units[1].hp = 1;
    b.selectWeapon('tesla');
    b.setAim(0, 100);
    b.fire();
    runFor(b, 1);
    expect(b.phase).toBe('over');
    expect(b.result).toEqual({ winner: 0 });
  });

  it('draws when both fall in the same turn (acid)', () => {
    const b = make({ ground: 850 });
    b.turn.round = 7; // acid level 820, feet at 850
    b.units[0].hp = 10;
    b.units[1].hp = 10;
    b.forceEndTurn();
    expect(b.phase).toBe('over');
    expect(b.result).toEqual({ winner: null });
  });

  it('acid hurts only those below the level and can decide the match', () => {
    const b = make({ ground: 850 });
    b.turn.round = 7;
    b.units[1].hp = 10;
    b.forceEndTurn();
    expect(b.units[0].hp).toBe(b.units[0].maxHp - 15);
    expect(b.result).toEqual({ winner: 0 });
  });

  it('no acid damage before round 6', () => {
    const b = make({ ground: 850 });
    b.forceEndTurn();
    expect(b.units[0].hp).toBe(b.units[0].maxHp);
  });

  it('falling out of the world kills', () => {
    const b = make();
    for (let y = 600; y < 900; y += 20) b.terrain.carveCircle(600, y, 70);
    runFor(b, 4);
    expect(b.units[1].alive).toBe(false);
    expect(b.phase === 'over' || b.units[1].hp === 0).toBe(true);
  });
});

describe('crates and status', () => {
  it('a crate drops every 4 turns and heals on pickup', () => {
    const b = make();
    expect(b.crates).toHaveLength(0);
    for (let i = 0; i < 3; i++) b.forceEndTurn(); // now turn 4 starts
    expect(b.turn.turnNumber).toBe(4);
    expect(b.crates).toHaveLength(1);
    const crate = b.crates[0];
    crate.type = 'salud';
    b.units[0].hp = 40;
    runFor(b, 3);
    const c = b.crates[0];
    // move unit to crate
    b.units[b.current.index].x = c.x;
    b.units[b.current.index].hp = 40;
    runFor(b, 0.5);
    expect(b.crates.length).toBe(0);
    expect(b.units[b.current.index].hp).toBe(65);
  });

  it('frozen creatures cannot walk on their next turn', () => {
    const b = make();
    b.units[1].frozenTurns = 1;
    b.forceEndTurn();
    expect(b.current.index).toBe(1);
    expect(b.clock.moveLeft).toBe(0);
    expect(b.units[1].frozenTurns).toBe(0);
  });

  it('emits events that the scene can drain', () => {
    const b = make();
    b.selectWeapon('tesla');
    b.setAim(0, 100);
    b.fire();
    runFor(b, 0.5);
    const evs = b.drainEvents();
    expect(evs.some((e) => e.type === 'beam')).toBe(true);
    expect(evs.some((e) => e.type === 'damage')).toBe(true);
    expect(b.drainEvents()).toEqual([]);
  });
});
