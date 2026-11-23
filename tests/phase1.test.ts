import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/core/battle';
import { aimSpread, neutralAim } from '../src/core/aim';
import { TUNING } from '../src/core/tuning';
import { WEAPONS } from '../src/core/data';
import { Terrain } from '../src/core/terrain';
import type { Selection } from '../src/core/stats';

const sel = (arms: string, torso: string, head = 'maniqui'): Selection => ({ head, torso, arms, legs: 'maniqui' });
const flat = (y = 700): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(y));
function make(opts: { terrain?: Terrain; spawns?: [number, number]; seed?: number; a?: Selection; b?: Selection } = {}): Battle {
  return new Battle({
    seed: opts.seed ?? 3,
    terrain: opts.terrain ?? flat(),
    spawns: opts.spawns ?? [300, 1300],
    selections: [opts.a ?? sel('armadura', 'armadura'), opts.b ?? sel('maniqui', 'maniqui')],
  });
}
const run = (b: Battle, secs: number): BattleEvent[] => {
  const ev: BattleEvent[] = [];
  for (let i = 0; i < Math.round(secs * 60); i++) {
    b.update(1 / 60);
    ev.push(...b.drainEvents());
  }
  return ev;
};
const explosions = (ev: BattleEvent[]) => ev.filter((e): e is Extract<BattleEvent, { type: 'explosion' }> => e.type === 'explosion');

describe('1b neutral aim', () => {
  it('each turn starts at the neutral angle and power, facing the foe', () => {
    const b = make();
    b.setAim(80, 95);
    b.forceEndTurn(); // J2 plays
    expect(b.current.index).toBe(1);
    expect(b.current.aimAngle).toBeCloseTo(180 - TUNING.aim.angle, 5);
    expect(b.current.aimPower).toBe(TUNING.aim.power);
    b.forceEndTurn(); // back to J1
    expect(b.current.aimAngle).toBeCloseTo(TUNING.aim.angle, 5);
    expect(b.current.aimPower).toBe(TUNING.aim.power);
  });

  it('neutralAim mirrors the angle for a creature on the right', () => {
    expect(neutralAim(1).angle).toBe(TUNING.aim.angle);
    expect(neutralAim(-1).angle).toBe(180 - TUNING.aim.angle);
  });
});

describe('1a wind gusts', () => {
  it('turn wind is fixed per turn; gusts drift gradually during flight and stay bounded', () => {
    const b = make();
    expect(b.windNow).toBe(b.wind);
    b.selectWeapon('mazo');
    b.setAim(90, 100);
    b.selectWeapon(b.current.weapons.find((w) => WEAPONS[w].kind === 'projectile') ?? b.current.weapons[0]);
    b.fire();
    const seen: number[] = [];
    for (let i = 0; i < 120; i++) {
      b.update(1 / 60);
      seen.push(b.windNow - b.wind);
    }
    expect(Math.max(...seen.map(Math.abs))).toBeLessThanOrEqual(TUNING.wind.gustMax + 1e-9);
    expect(new Set(seen.map((x) => x.toFixed(3))).size).toBeGreaterThan(1);
    // gradual: never jumps more than one gust step between frames
    for (let i = 1; i < seen.length; i++) expect(Math.abs(seen[i] - seen[i - 1])).toBeLessThanOrEqual(TUNING.wind.gustStep + 1e-9);
  });

  it('gusts are deterministic for the same seed and reset when the turn changes', () => {
    const trace = (seed: number): number[] => {
      const b = make({ seed });
      b.setAim(80, 100);
      b.fire();
      const out: number[] = [];
      for (let i = 0; i < 90; i++) {
        b.update(1 / 60);
        out.push(b.windNow);
      }
      return out;
    };
    expect(trace(5)).toEqual(trace(5));
    const b = make();
    b.setAim(80, 100);
    b.fire();
    run(b, 6);
    expect(b.windNow).toBe(b.wind);
  });
});

describe('1c dispersion', () => {
  it('grows with power and with the distance walked this turn, per weapon', () => {
    const w = 'bazuca';
    expect(aimSpread(w, 100, 0)).toBeGreaterThan(aimSpread(w, 30, 0));
    expect(aimSpread(w, 60, 400)).toBeGreaterThan(aimSpread(w, 60, 0));
    expect(aimSpread(w, 60, 0)).toBeGreaterThan(0);
  });

  it('every projectile weapon declares a spread; melee has none', () => {
    for (const [id, def] of Object.entries(WEAPONS)) {
      if (def.kind === 'melee') continue;
      expect(def.spread, id).toBeDefined();
      expect(def.spread!.base).toBeGreaterThanOrEqual(0);
    }
    expect(aimSpread('mazo', 100, 500)).toBe(0);
  });

  it('the same aim lands in different places for different seeds, and identically with spread off', () => {
    const landing = (seed: number, off = false): number => {
      const b = make({ seed });
      if (off) {
        b.rules.spread = false;
        b.rules.gusts = false;
      }
      b.wind = 0;
      b.selectWeapon('bazuca');
      b.setAim(40, 90);
      b.fire();
      return explosions(run(b, 6))[0].x;
    };
    const xs = new Set([1, 2, 3, 4, 5, 6].map((s) => Math.round(landing(s))));
    expect(xs.size).toBeGreaterThan(2);
    expect(landing(1, true)).toBe(landing(2, true));
  });

  it('walking before firing widens the scatter', () => {
    const spreadOf = (walk: boolean): number => {
      const xs: number[] = [];
      for (let seed = 1; seed <= 24; seed++) {
        const b = make({ seed, terrain: flat() });
        b.wind = 0;
        b.selectWeapon('bazuca');
        if (walk) {
          b.units[0].x = 300;
          b.move(1, 3);
          b.units[0].x = 300; // keep the geometry, the walked distance is what matters
          b.units[0].moved = 450;
        }
        b.setAim(40, 90);
        b.fire();
        xs.push(explosions(run(b, 6))[0].x);
      }
      const mean = xs.reduce((a, x) => a + x, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
    };
    expect(spreadOf(true)).toBeGreaterThan(spreadOf(false));
  });
});

describe('1d knockback and lethal edges', () => {
  it('an explosion beside a creature launches it away from the blast', () => {
    const b = make({ spawns: [300, 600] });
    b.rules.spread = false;
    b.wind = 0;
    const foe = b.units[1];
    const x0 = foe.x;
    b.selectWeapon('bazuca');
    b.setAim(0, 55);
    b.fire();
    run(b, 1.5);
    expect(foe.x).toBeGreaterThan(x0 + 5);
  });

  it('a creature thrown beyond the world edge dies immediately (void)', () => {
    const b = make({ spawns: [300, 1560] });
    b.rules.spread = false;
    const foe = b.units[1];
    foe.hp = 1000;
    foe.maxHp = 1000;
    foe.vx = 900;
    foe.vy = -300;
    foe.grounded = false;
    foe.launched = true;
    foe.peakY = foe.y;
    const ev = run(b, 2);
    expect(foe.alive).toBe(false);
    expect(ev.some((e) => e.type === 'death' && e.unit === 1 && e.cause === 'void')).toBe(true);
  });

  it('a creature that touches the acid dies at once, whatever its health', () => {
    const t = flat(700);
    const b = make({ terrain: t, spawns: [300, 1300] });
    b.rules.spread = false;
    const foe = b.units[1];
    foe.hp = 500;
    foe.maxHp = 500;
    b.units[0].y = 600; // stays above the acid
    b.acidLevelOverride = 650; // acid above the foe's feet
    b.forceEndTurn();
    const ev = run(b, 0.2);
    expect(foe.alive).toBe(false);
    expect(ev.some((e) => e.type === 'death' && e.unit === 1 && e.cause === 'acid')).toBe(true);
  });
});

describe('1e damage falloff and craters', () => {
  it('damage falls with distance from the blast centre', () => {
    const hurt = (gap: number): number => {
      const b = make({ spawns: [300, 600] });
      b.rules.spread = false;
      const foe = b.units[1];
      foe.x = 600;
      b.wind = 0;
      b.selectWeapon('bazuca');
      // aim straight at a point `gap` px in front of the foe
      b.units[0].x = 600 - gap - 100;
      b.setAim(0, 100);
      b.fire();
      run(b, 2);
      return foe.maxHp - foe.hp;
    };
    expect(hurt(0)).toBeGreaterThanOrEqual(hurt(40));
  });

  it('the same shot does not land in the same place after it has dug a crater', () => {
    const b = make();
    b.rules.spread = false;
    b.rules.gusts = false;
    b.wind = 0;
    const shoot = (): number => {
      b.selectWeapon('bazuca');
      b.setAim(35, 70);
      b.units[b.current.index].x = b.current.index === 0 ? 300 : 1300;
      b.fire();
      return explosions(run(b, 5))[0].x;
    };
    const first = shoot();
    while (b.current.index !== 0) b.forceEndTurn();
    b.wind = 0;
    const second = shoot();
    expect(Math.abs(first - second)).toBeGreaterThan(1);
  });
});

describe('1f cover', () => {
  function moundWorld(): { b: Battle } {
    const heights = new Array<number>(1600).fill(700);
    for (let x = 700; x < 900; x++) heights[x] = 700 - 260 * Math.sin(((x - 700) / 200) * Math.PI); // a hill between them
    const b = make({ terrain: Terrain.fromHeights(1600, 900, heights), spawns: [300, 1100] });
    b.rules.spread = false;
    b.wind = 0;
    return { b };
  }

  it('a flat shot is stopped by the mound: the creature behind takes nothing', () => {
    const { b } = moundWorld();
    const foe = b.units[1];
    b.selectWeapon('bazuca');
    b.setAim(8, 60);
    b.fire();
    run(b, 5);
    expect(foe.hp).toBe(foe.maxHp);
  });

  it('a high arc clears the mound and reaches the creature behind it', () => {
    const { b } = moundWorld();
    const foe = b.units[1];
    b.selectWeapon('bazuca');
    let best = 0;
    for (let p = 60; p <= 100; p += 2) {
      const c = moundWorld().b;
      c.selectWeapon('bazuca');
      c.setAim(70, p);
      c.fire();
      run(c, 8);
      best = Math.max(best, c.units[1].maxHp - c.units[1].hp);
    }
    expect(best).toBeGreaterThan(0);
    expect(foe.hp).toBe(foe.maxHp);
  });

  it('terrain between the blast and a creature reduces the damage', () => {
    const open = make({ spawns: [300, 380] });
    open.rules.spread = false;
    const walled = (() => {
      const heights = new Array<number>(1600).fill(700);
      for (let x = 330; x < 350; x++) heights[x] = 380;
      const b = make({ terrain: Terrain.fromHeights(1600, 900, heights), spawns: [300, 380] });
      b.rules.spread = false;
      return b;
    })();
    for (const b of [open, walled]) {
      b.wind = 0;
      b.selectWeapon('bazuca');
      b.units[0].x = 300;
      b.setAim(25, 100);
      b.fire();
      run(b, 4);
    }
    const loss = (b: Battle): number => b.units[1].maxHp - b.units[1].hp;
    expect(loss(walled)).toBeLessThanOrEqual(loss(open));
  });
});

describe('preview', () => {
  it('shows only a short stretch of the arc', () => {
    expect(TUNING.preview.seconds).toBeGreaterThan(0);
    expect(TUNING.preview.seconds).toBeLessThan(1);
  });
});
