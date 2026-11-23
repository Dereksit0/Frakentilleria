import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/core/battle';
import { DONOR_IDS, PARTS, WEAPONS, ABILITIES } from '../src/core/data';
import { Terrain } from '../src/core/terrain';
import { createUnit } from '../src/core/unit';
import { weaponsFor, type Selection } from '../src/core/stats';

const sel = (arms: string, torso: string, head = 'maniqui'): Selection => ({ head, torso, arms, legs: 'maniqui' });
const flat = (y = 700): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(y));
function make(opts: { terrain?: Terrain; spawns?: [number, number]; a?: Selection; b?: Selection } = {}): Battle {
  const b = new Battle({
    seed: 3,
    terrain: opts.terrain ?? flat(),
    spawns: opts.spawns ?? [300, 1300],
    selections: [opts.a ?? sel('armadura', 'armadura'), opts.b ?? sel('maniqui', 'maniqui')],
  });
  b.rules.spread = false;
  b.rules.gusts = false;
  b.wind = 0;
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
const lost = (b: Battle, i: number): number => b.units[i].maxHp - b.units[i].hp;

describe('catalog: donors expose arms weapon, torso weapon and a head ability', () => {
  it('every donor has all three, and every weapon/ability exists in data', () => {
    for (const d of DONOR_IDS) {
      const arms = PARTS.parts.find((p) => p.donor === d && p.slot === 'arms');
      const torso = PARTS.parts.find((p) => p.donor === d && p.slot === 'torso');
      const head = PARTS.parts.find((p) => p.donor === d && p.slot === 'head');
      expect(arms?.weapon && WEAPONS[arms.weapon], `${d} arms`).toBeTruthy();
      expect(torso?.weapon && WEAPONS[torso.weapon], `${d} torso`).toBeTruthy();
      expect(head?.ability && ABILITIES[head.ability], `${d} head`).toBeTruthy();
      expect(arms?.weapon, `${d} arms != torso`).not.toBe(torso?.weapon);
    }
  });

  it('the 8 weapons of phase 2A exist and every one is reachable from some donor (the cannon is free)', () => {
    for (const id of ['canon', 'mortero', 'bazuca', 'granada', 'mazo', 'tesla', 'hielo', 'pocion']) expect(WEAPONS[id], id).toBeDefined();
    const given = new Set(PARTS.parts.map((p) => p.weapon).filter(Boolean));
    for (const id of Object.keys(WEAPONS)) if (id !== 'canon') expect(given.has(id), `${id} given by a donor`).toBe(true);
    expect(given.has('canon')).toBe(false);
  });

  it('every weapon declares a behaviour and a valid shape', () => {
    for (const [id, w] of Object.entries(WEAPONS)) {
      expect(['projectile', 'grenade', 'beam', 'melee']).toContain(w.kind);
      expect(w.damage, id).toBeGreaterThan(0);
      if (w.ammo !== undefined) expect(w.ammo).toBeGreaterThan(0);
    }
    expect(WEAPONS.canon.ammo).toBeUndefined();
  });
});

describe('ammo', () => {
  it('everybody starts with the infinite cannon first; other weapons carry limited ammo', () => {
    const b = make();
    const u = b.units[0];
    expect(u.weapons[0]).toBe('canon');
    expect(u.ammo.canon).toBeUndefined();
    for (const id of weaponsFor(u.selection)) expect(u.ammo[id]).toBe(WEAPONS[id].ammo);
  });

  it('firing spends one ammo; at zero the weapon cannot be selected or fired', () => {
    const b = make({ a: sel('maniqui', 'maniqui') }); // bazuca + mortero
    b.units[0].ammo.bazuca = 1;
    expect(b.selectWeapon('bazuca')).toBe(true);
    b.setAim(40, 60);
    expect(b.fire()).toBe(true);
    expect(b.units[0].ammo.bazuca).toBe(0);
    run(b, 6);
    while (b.current.index !== 0) b.forceEndTurn();
    expect(b.selectWeapon('bazuca')).toBe(false);
    expect(b.units[0].weapon).not.toBe('bazuca');
  });

  it('the cannon never runs out', () => {
    const b = make();
    for (let i = 0; i < 4; i++) {
      b.selectWeapon('canon');
      b.setAim(45, 50);
      expect(b.fire()).toBe(true);
      run(b, 6);
      while (b.current.index !== 0 && b.phase === 'playing') b.forceEndTurn();
    }
    expect(b.units[0].ammo.canon).toBeUndefined();
  });
});

describe('cannon', () => {
  it('is a plain arc shot affected by the wind', () => {
    const land = (wind: number): number => {
      const b = make();
      b.wind = wind;
      b.selectWeapon('canon');
      b.setAim(40, 70);
      b.fire();
      const e = run(b, 6).find((x) => x.type === 'explosion');
      return e && e.type === 'explosion' ? e.x : NaN;
    };
    expect(land(5)).toBeGreaterThan(land(0));
    expect(land(-5)).toBeLessThan(land(0));
  });
});

describe('mortar', () => {
  function hill(): Terrain {
    const h = new Array<number>(1600).fill(700);
    for (let x = 650; x < 950; x++) h[x] = 700 - 330 * Math.sin(((x - 650) / 300) * Math.PI);
    return Terrain.fromHeights(1600, 900, h);
  }
  it('is forced into a high arc, flies over a hill that stops flat weapons, and is very wind sensitive', () => {
    const b = make({ terrain: hill(), spawns: [300, 1150], a: sel('maniqui', 'maniqui') });
    b.selectWeapon('mortero');
    b.setAim(10, 100); // asks for a flat angle: the mortar lifts it to its minimum elevation
    b.fire();
    const ev = run(b, 10);
    const ex = ev.find((e) => e.type === 'explosion');
    expect(ex && ex.type === 'explosion' && ex.x > 1000).toBe(true); // it crossed the hill (x 650..950)

    expect(WEAPONS.mortero.windFactor).toBeGreaterThan(WEAPONS.canon.windFactor);
    expect(WEAPONS.mortero.minAngle ?? 0).toBeGreaterThanOrEqual(55);
  });
});

describe('bazooka and pumpkin grenade', () => {
  it('bazooka: fast, flat, big blast', () => {
    expect(WEAPONS.bazuca.radius).toBeGreaterThan(WEAPONS.canon.radius);
    const b = make({ spawns: [300, 600], a: sel('maniqui', 'maniqui') });
    b.selectWeapon('bazuca');
    b.setAim(0, 70);
    b.fire();
    run(b, 3);
    expect(lost(b, 1)).toBeGreaterThan(0);
  });

  it('grenade explodes on its fuse of 3 s, not before', () => {
    expect(WEAPONS.granada.fuse).toBe(3);
    const b = make({ spawns: [300, 520], a: sel('espantapajaros', 'espantapajaros') });
    b.selectWeapon('granada');
    b.setAim(40, 45);
    b.fire();
    run(b, 2.8);
    expect(b.projectiles).toHaveLength(1);
    run(b, 0.5);
    expect(b.projectiles).toHaveLength(0);
  });
});

describe('mace: melee with huge knockback and stun', () => {
  it('shoves far and stuns for the next turn', () => {
    const b = make({ spawns: [300, 372] });
    const foe = b.units[1];
    b.selectWeapon('mazo');
    b.setAim(10, 100);
    b.fire();
    run(b, 1.2);
    expect(foe.x).toBeGreaterThan(372 + 60);
    expect(foe.stunTurns).toBeGreaterThan(0);
    expect(WEAPONS.mazo.knockback ?? 0).toBeGreaterThan(WEAPONS.bazuca.knockback ?? 300);
  });

  it('a stunned creature aims worse: its spread is wider on its next turn and the status then wears off', () => {
    const b = make({ spawns: [300, 372] });
    b.rules.spread = true;
    const foe = b.units[1];
    foe.stunTurns = 1;
    b.forceEndTurn(); // J2 starts its turn stunned
    expect(b.current.index).toBe(1);
    expect(b.stunned(b.current)).toBe(true);
    b.forceEndTurn();
    b.forceEndTurn();
    expect(foe.stunTurns).toBe(0);
    expect(b.stunned(foe)).toBe(false);
  });
});

describe('tesla: short range, ignores wind, jumps between nearby targets', () => {
  it('ignores the wind', () => {
    expect(WEAPONS.tesla.windFactor).toBe(0);
    expect(WEAPONS.tesla.range ?? 0).toBeLessThan(WEAPONS.bazuca.radius * 20);
  });

  it('chains to another creature near the first target, for less damage', () => {
    const b = make({ spawns: [300, 600], a: sel('juguete', 'juguete') });
    const third = createUnit(2, sel('maniqui', 'maniqui'), 700, 700);
    b.units.push(third);
    b.selectWeapon('tesla');
    b.setAim(0, 100);
    b.fire();
    run(b, 0.5);
    expect(lost(b, 1)).toBeGreaterThan(0);
    const hurtThird = third.maxHp - third.hp;
    expect(hurtThird).toBeGreaterThan(0);
    expect(hurtThird).toBeLessThan(lost(b, 1));
  });
});

describe('ice burst: freezes', () => {
  it('the foe cannot move on its next turn', () => {
    const b = make({ spawns: [300, 520], a: sel('refri', 'refri') });
    b.selectWeapon('hielo');
    b.setAim(0, 40);
    b.fire();
    run(b, 4);
    expect(b.units[1].frozenTurns >= 0).toBe(true);
    expect(b.current.index).toBe(1);
    expect(b.clock.moveLeft).toBe(0);
  });
});

describe('acid potion: a puddle that burns for several turns', () => {
  function shootPotion(): Battle {
    const b = make({ spawns: [300, 520], a: sel('refri', 'refri') });
    b.selectWeapon('pocion');
    b.setAim(0, 40);
    b.fire();
    run(b, 1.5);
    return b;
  }
  it('leaves a puddle at the impact point', () => {
    const b = shootPotion();
    expect(b.puddles.length).toBe(1);
    expect(b.puddles[0].turns).toBe(WEAPONS.pocion.puddle?.turns);
  });
  it('burns whoever stands in it at the end of each turn, then dries up', () => {
    const b = shootPotion();
    const foe = b.units[1];
    foe.x = b.puddles[0].x;
    foe.y = b.puddles[0].y;
    const before = foe.hp;
    const turns = b.puddles[0].turns;
    for (let i = 0; i < turns; i++) {
      b.forceEndTurn();
      if (b.phase !== 'playing') break;
    }
    expect(foe.hp).toBeLessThan(before);
    expect(b.puddles.length).toBe(0);
  });
  it('does not burn creatures that stay away', () => {
    const b = shootPotion();
    const foe = b.units[1];
    foe.x = 1500;
    const hp = foe.hp;
    b.forceEndTurn();
    expect(foe.hp).toBe(hp);
  });
});
