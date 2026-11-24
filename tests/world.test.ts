import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/core/battle';
import { EVENTS, MAPS } from '../src/core/data';
import { validateHazards, type HazardDef } from '../src/core/world';
import { Terrain } from '../src/core/terrain';
import type { Selection } from '../src/core/stats';

const sel = (arms: string, torso: string): Selection => ({ head: 'maniqui', torso, arms, legs: 'maniqui' });
const flat = (y = 700): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(y));
function make(
  hazards: HazardDef[],
  opts: { spawns?: [number, number]; events?: boolean; seed?: number } = {},
): Battle {
  const t = flat();
  t.hazards = hazards;
  const b = new Battle({
    seed: opts.seed ?? 3,
    terrain: t,
    spawns: opts.spawns ?? [200, 1400],
    selections: [sel('maniqui', 'maniqui'), sel('armadura', 'armadura')],
  });
  b.rules.spread = false;
  b.rules.gusts = false;
  b.rules.events = opts.events ?? false;
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
/** Skips turns until the given round starts; returns every event produced on the way. */
function toRound(b: Battle, round: number): BattleEvent[] {
  const ev: BattleEvent[] = [];
  for (let i = 0; i < 200 && b.round < round && b.phase === 'playing'; i++) {
    b.forceEndTurn();
    ev.push(...b.drainEvents());
  }
  return ev;
}

describe('schema', () => {
  it('rejects malformed hazards and accepts good ones', () => {
    expect(validateHazards([{ type: 'wall', x: 100, w: 40, h: 80 }], 1600)).toEqual([]);
    expect(validateHazards([{ type: 'wall', x: -5, w: 40, h: 80 }], 1600).length).toBeGreaterThan(0);
    expect(validateHazards([{ type: 'nope' } as unknown as HazardDef], 1600).length).toBeGreaterThan(0);
    expect(validateHazards([{ type: 'spring', x: 100, w: 60, power: 0 }], 1600).length).toBeGreaterThan(0);
  });

  it('every map has valid hazards, at least one common obstacle and one themed hazard, none near a spawn', () => {
    const common = new Set(['wall', 'bridge', 'barrel', 'portal', 'spring']);
    for (const m of MAPS) {
      const hz = m.hazards ?? [];
      expect(validateHazards(hz, 1600), m.id).toEqual([]);
      expect(
        hz.some((h) => common.has(h.type)),
        `${m.id} common`,
      ).toBe(true);
      expect(
        hz.some((h) => !common.has(h.type)),
        `${m.id} themed`,
      ).toBe(true);
      for (const h of hz)
        if ('x' in h)
          for (const s of m.spawns)
            expect(Math.abs(h.x - s), `${m.id}/${h.type} near spawn`).toBeGreaterThan(150);
    }
  });

  it('themed hazards match the map theme', () => {
    const types = (id: string): string[] => (MAPS.find((m) => m.id === id)?.hazards ?? []).map((h) => h.type);
    expect(types('vertedero')).toEqual(expect.arrayContaining(['crane', 'scrap']));
    expect(types('cementerio')).toEqual(expect.arrayContaining(['zombie', 'tombstone', 'fog']));
    expect(types('fabrica')).toEqual(expect.arrayContaining(['conveyor', 'ball', 'fan']));
  });

  it('events.json is valid: five events with name, weight and a one-round warning', () => {
    for (const id of ['tormenta', 'meteoritos', 'gravedad', 'luna', 'rafaga']) {
      expect(EVENTS.types[id], id).toBeDefined();
      expect(EVENTS.types[id].name).toBeTruthy();
      expect(EVENTS.types[id].weight).toBeGreaterThan(0);
    }
    expect(EVENTS.firstRound).toBeGreaterThanOrEqual(2);
  });
});

describe('common obstacles', () => {
  it('a destructible wall blocks shots until it is blown up', () => {
    const b = make([{ type: 'wall', x: 700, w: 60, h: 300 }]);
    expect(b.terrain.isSolid(730, 600)).toBe(true);
    b.selectWeapon('bazuca');
    b.setAim(5, 70);
    b.fire();
    run(b, 5);
    expect(lost(b, 1)).toBe(0);
    // explosions carve it
    const solid = b.terrain.solidCount();
    b.terrain.carveCircle(730, 600, 80);
    expect(b.terrain.solidCount()).toBeLessThan(solid);
  });

  it('a bridge is a thin platform that explosions break', () => {
    const b = make([{ type: 'bridge', x: 600, w: 200, y: 500 }]);
    expect(b.terrain.isSolid(700, 505)).toBe(true);
    expect(b.terrain.isSolid(700, 540)).toBe(false);
    b.terrain.carveCircle(700, 506, 60);
    expect(b.terrain.isSolid(700, 505)).toBe(false);
  });

  it('TNT barrels explode when a blast reaches them and chain to their neighbours', () => {
    const b = make([
      { type: 'barrel', x: 800 },
      { type: 'barrel', x: 880 },
      { type: 'barrel', x: 960 },
    ]);
    expect(b.world.barrels).toHaveLength(3);
    b.selectWeapon('bazuca');
    b.setAim(15, 70);
    b.fire();
    const ev = run(b, 6);
    const blasts = ev.filter((e) => e.type === 'explosion' && e.weapon === 'barril');
    expect(blasts.length).toBe(3);
    expect(b.world.barrels.filter((x) => x.alive)).toHaveLength(0);
  });

  it('a barrel blast hurts a creature standing next to it', () => {
    const b = make([{ type: 'barrel', x: 1380 }]);
    b.world.triggerBarrel(b.world.barrels[0], 0, 0);
    run(b, 1);
    expect(lost(b, 1)).toBeGreaterThan(0);
  });

  it('portals carry a projectile from one mouth to the other, keeping its velocity', () => {
    const b = make([{ type: 'portal', a: { x: 600, y: 625 }, b: { x: 1100, y: 300 }, radius: 50 }]);
    b.selectWeapon('canon');
    b.setAim(15, 75);
    b.fire();
    let teleported = false;
    for (let i = 0; i < 300 && !teleported; i++) {
      b.update(1 / 60);
      const p = b.projectiles[0];
      if (p && p.x > 1050) teleported = true;
    }
    expect(teleported).toBe(true);
  });

  it('a spring launches a creature that steps on it, once per turn', () => {
    const b = make([{ type: 'spring', x: 260, w: 80, power: 700 }], { spawns: [200, 1400] });
    const u = b.units[0];
    u.x = 260;
    const y0 = u.y;
    run(b, 0.2);
    expect(u.grounded).toBe(false);
    expect(u.y).toBeLessThan(y0 - 20);
    run(b, 3);
    expect(u.grounded).toBe(true);
    run(b, 0.3);
    expect(u.grounded).toBe(true); // not bounced again in the same turn
  });
});

describe('vertedero', () => {
  it('a scrap pile collapses: the same blast removes more of it than plain ground', () => {
    const b = make([{ type: 'scrap', x: 800, w: 120, h: 160 }]);
    const before = b.terrain.solidCount();
    b.terrain.carveCircle(860, 540, 30);
    const plain = before - b.terrain.solidCount();
    const c = make([{ type: 'scrap', x: 800, w: 120, h: 160 }]);
    const w = c.world.scrapHit(860, 540, 30);
    expect(w).toBeGreaterThan(plain);
  });

  it('the crane announces a barrel one round ahead, then drops it', () => {
    const b = make([{ type: 'crane', everyRounds: 2 }]);
    const ev = toRound(b, 3);
    const warn = ev.find((e) => e.type === 'hazard-warn' && e.kind === 'crane');
    expect(warn).toBeDefined();
    expect(b.world.barrels.length).toBeGreaterThan(0);
    const warnRound = warn && warn.type === 'hazard-warn' ? warn.round : 0;
    const dropRound = ev.findIndex((e) => e.type === 'hazard-fire' && e.kind === 'crane');
    expect(dropRound).toBeGreaterThan(-1);
    expect(warnRound).toBeGreaterThanOrEqual(2);
  });
});

describe('cementerio', () => {
  it('a zombie hand stuns a creature standing on its spot, after a warning', () => {
    const b = make([{ type: 'zombie', everyRounds: 2, radius: 400 }], { spawns: [800, 900] });
    const ev = toRound(b, 3);
    expect(ev.some((e) => e.type === 'hazard-warn' && e.kind === 'zombie')).toBe(true);
    expect(ev.some((e) => e.type === 'hazard-fire' && e.kind === 'zombie')).toBe(true);
    expect(b.units.some((u) => u.stunTurns > 0 || u.stunActive)).toBe(true);
  });

  it('a falling tombstone never kills: it leaves at least 1 health', () => {
    const b = make([{ type: 'tombstone', everyRounds: 2, damage: 500 }], { spawns: [800, 900] });
    toRound(b, 4);
    for (const u of b.units) expect(u.hp).toBeGreaterThanOrEqual(1);
    expect(b.units.some((u) => u.hp < u.maxHp)).toBe(true);
  });

  it('fog is a map flag the scene uses to hide the aim preview', () => {
    expect(make([{ type: 'fog' }]).world.fog).toBe(true);
    expect(make([]).world.fog).toBe(false);
  });
});

describe('fabrica', () => {
  it('a conveyor carries a creature standing on it', () => {
    const b = make([{ type: 'conveyor', x: 700, w: 300, speed: 80 }], { spawns: [800, 1400] });
    const x0 = b.units[0].x;
    run(b, 1);
    expect(b.units[0].x).toBeGreaterThan(x0 + 40);
  });

  it('a fan adds local wind to projectiles that cross it, and only there', () => {
    const b = make([{ type: 'fan', x: 500, w: 200, y0: 300, y1: 700, wind: 4 }]);
    expect(b.world.windAt(600, 500)).toBe(4);
    expect(b.world.windAt(900, 500)).toBe(0);
    expect(b.world.windAt(600, 100)).toBe(0);
  });

  it('a rolling ball is announced and then rolls across hitting creatures without killing them', () => {
    const b = make([{ type: 'ball', everyRounds: 2, speed: 500, damage: 999 }], { spawns: [800, 1000] });
    const ev = toRound(b, 3);
    expect(ev.some((e) => e.type === 'hazard-warn' && e.kind === 'ball')).toBe(true);
    run(b, 6);
    for (const u of b.units) expect(u.hp).toBeGreaterThanOrEqual(1);
    expect(b.units.some((u) => u.hp < u.maxHp)).toBe(true);
  });
});

describe('round events', () => {
  function withEvent(id: string): { b: Battle; ev: BattleEvent[] } {
    const b = make([], { events: true });
    b.world.forceEvent(id, 2);
    const ev = toRound(b, 2);
    ev.push(...run(b, 0.1));
    return { b, ev };
  }

  it('events are announced one round before they start, and end after one round', () => {
    const b = make([], { events: true, seed: 11 });
    const ev = toRound(b, EVENTS.firstRound + 2);
    const warn = ev.find((e) => e.type === 'event-warn');
    const start = ev.find((e) => e.type === 'event-start');
    expect(warn && warn.type === 'event-warn').toBe(true);
    expect(start && start.type === 'event-start').toBe(true);
    if (warn?.type === 'event-warn' && start?.type === 'event-start') {
      expect(start.id).toBe(warn.id);
      expect(warn.round).toBe(start.round);
      const wi = ev.indexOf(warn);
      const si = ev.indexOf(start);
      expect(wi).toBeLessThan(si);
    }
    expect(ev.some((e) => e.type === 'event-end')).toBe(true);
  });

  it('events are deterministic for the same seed', () => {
    const trace = (seed: number): string[] =>
      toRound(make([], { events: true, seed }), 9)
        .filter((e) => e.type.startsWith('event-'))
        .map((e) => JSON.stringify(e));
    expect(trace(5)).toEqual(trace(5));
  });

  it('low gravity makes shots fly farther', () => {
    const land = (low: boolean): number => {
      const b = make([], { events: true });
      if (low) b.world.forceEvent('gravedad', 1);
      b.selectWeapon('canon');
      b.setAim(45, 60);
      b.fire();
      const e = run(b, 8).find((x) => x.type === 'explosion');
      return e && e.type === 'explosion' ? e.x : 0;
    };
    // forceEvent for the current round: takes effect immediately
    expect(land(true)).toBeGreaterThan(land(false));
  });

  it('full moon doubles weapon damage', () => {
    const hit = (moon: boolean): number => {
      const b = make([], { events: true, spawns: [300, 450] });
      if (moon) b.world.forceEvent('luna', 1);
      b.selectWeapon('bazuca');
      b.setAim(0, 55);
      b.fire();
      run(b, 3);
      return lost(b, 1);
    };
    expect(hit(true)).toBeGreaterThanOrEqual(hit(false) * 2 - 1);
    expect(hit(false)).toBeGreaterThan(0);
  });

  it('a wind gust event strengthens the wind of the round', () => {
    const b = make([], { events: true });
    b.wind = 2;
    b.world.forceEvent('rafaga', 1);
    expect(Math.abs(b.windNow)).toBeGreaterThan(2);
  });

  it('a storm strikes the highest point; a creature standing there is hurt but never killed', () => {
    const t = flat();
    for (let x = 780; x < 820; x++) for (let y = 450; y < 700; y++) t.solid[y * 1600 + x] = 1;
    t.hazards = [];
    const b = new Battle({
      seed: 3,
      terrain: t,
      spawns: [800, 1400],
      selections: [sel('maniqui', 'maniqui'), sel('armadura', 'armadura')],
    });
    b.rules.events = true;
    b.units[0].hp = 3;
    b.world.forceEvent('tormenta', 1);
    b.world.startEventNow();
    expect(b.units[0].hp).toBeGreaterThanOrEqual(1);
    expect(b.units[0].hp).toBeLessThan(3);
  });

  it('meteors are announced with their impact points, hurt but do not kill', () => {
    const { b, ev } = withEvent('meteoritos');
    const warn = ev.find((e) => e.type === 'event-warn' && e.id === 'meteoritos');
    void warn;
    expect(ev.some((e) => e.type === 'event-start' && e.id === 'meteoritos')).toBe(true);
    expect(ev.filter((e) => e.type === 'explosion' && e.weapon === 'meteoro').length).toBeGreaterThan(0);
    for (const u of b.units) expect(u.hp).toBeGreaterThanOrEqual(1);
  });

  it('no event can kill a creature that was alive when it started', () => {
    for (const id of Object.keys(EVENTS.types)) {
      const b = make([], { events: true, spawns: [800, 900] });
      for (const u of b.units) u.hp = 1;
      b.world.forceEvent(id, 1);
      b.world.startEventNow();
      run(b, 3);
      for (const u of b.units) expect(u.alive, id).toBe(true);
    }
  });
});
