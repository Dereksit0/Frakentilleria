import { afterEach, describe, expect, it } from 'vitest';
import { Battle, MAX_PROJECTILE_FLIGHT, MAX_SETTLE_WAIT, type BattleEvent } from '../src/core/battle';
import { WEAPONS } from '../src/core/data';
import { Terrain } from '../src/core/terrain';
import type { Selection } from '../src/core/stats';

const SEL: Selection = { head: 'maniqui', torso: 'armadura', arms: 'maniqui', legs: 'maniqui' }; // granada en el brazo? (usa bazuca/torso)
const flat = (): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(700));
const realFuse = WEAPONS.granada.fuse;
afterEach(() => {
  WEAPONS.granada.fuse = realFuse;
});

function duel(): Battle {
  const b = new Battle({ seed: 3, terrain: flat(), spawns: [500, 700], selections: [SEL, SEL] });
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

describe('vigilante de la máquina de turnos', () => {
  it('los tiempos máximos tienen nombre y son razonables', () => {
    expect(MAX_PROJECTILE_FLIGHT).toBeGreaterThan(3);
    expect(MAX_SETTLE_WAIT).toBeGreaterThan(2);
    expect(MAX_PROJECTILE_FLIGHT).toBeLessThanOrEqual(10);
  });

  it('un proyectil que nunca termina se resuelve (con su daño) y el turno avanza igual', () => {
    WEAPONS.granada.fuse = 1e9; // a grenade that would never explode by itself
    const b = duel();
    const foe = b.units[1];
    b.units[0].weapons = ['granada'];
    b.selectWeapon('granada');
    b.setAim(0, 5); // lands almost at the thrower's feet... then rests
    b.fire();
    const turn0 = b.turn.turnNumber;
    // put the resting grenade next to the rival so its pending damage is visible
    const g = b.projectiles[0];
    g.x = foe.x - 30;
    g.y = foe.y - 40;
    g.vx = 0;
    g.vy = 0;
    g.resting = true;
    const hp0 = foe.hp;
    const ev = run(b, MAX_PROJECTILE_FLIGHT + MAX_SETTLE_WAIT + 8);
    expect(b.projectiles.length).toBe(0);
    expect(b.turn.turnNumber, 'el turno avanza').toBeGreaterThan(turn0);
    expect(
      ev.some((e) => e.type === 'watchdog'),
      'queda registrado',
    ).toBe(true);
    expect(foe.hp, 'el daño pendiente se aplica').toBeLessThan(hp0);
  });

  it('una criatura que nunca aterriza no bloquea el cambio de turno', () => {
    const b = duel();
    b.setAim(45, 50);
    b.fire();
    const turn0 = b.turn.turnNumber;
    // the foe hangs in the air forever: gravity cannot reach it
    const foe = b.units[1];
    const freeze = (): void => {
      foe.grounded = false;
      foe.vy = 0;
      foe.y = 300;
    };
    let ev: BattleEvent[] = [];
    for (let i = 0; i < 60 * (MAX_SETTLE_WAIT + 12); i++) {
      freeze();
      b.update(1 / 60);
      ev = ev.concat(b.drainEvents());
    }
    expect(b.turn.turnNumber).toBeGreaterThan(turn0);
    expect(ev.some((e) => e.type === 'watchdog')).toBe(true);
  });

  it('granadas seguidas, disparadas en cuanto empieza cada turno, no suman su vuelo entre turnos', () => {
    // far apart and the grenade lands in the middle: nobody is shoved, so the turn ends on the very frame of the blast
    const b = new Battle({ seed: 3, terrain: flat(), spawns: [150, 1450], selections: [SEL, SEL] });
    b.rules.spread = false;
    b.rules.gusts = false;
    b.wind = 0;
    for (const u of b.units) {
      u.weapons = ['granada'];
      u.ammo = {};
    }
    const ev: BattleEvent[] = [];
    for (let shot = 0; shot < 4 && b.phase === 'playing'; shot++) {
      const turn = b.turn.turnNumber;
      b.selectWeapon('granada');
      b.setAim(b.current.index === 0 ? 45 : 135, 60);
      b.fire();
      for (let i = 0; i < 60 * 12 && b.turn.turnNumber === turn; i++) {
        b.update(1 / 60);
        ev.push(...b.drainEvents());
      }
    }
    expect(ev.some((e) => e.type === 'watchdog')).toBe(false);
  });

  it('en una partida normal el vigilante nunca se dispara', () => {
    const b = duel();
    b.setAim(45, 55);
    b.fire();
    const ev = run(b, 15);
    expect(ev.some((e) => e.type === 'watchdog')).toBe(false);
  });
});
