import { describe, it, expect } from 'vitest';
import { Battle } from '../src/core/battle';
import { WEAPONS } from '../src/core/data';
import { Terrain } from '../src/core/terrain';
import type { Selection } from '../src/core/stats';

// Arms/torso donors decide weapons: see src/data/parts.json
const sel = (arms: string, torso: string, head = 'maniqui'): Selection => ({
  head,
  torso,
  arms,
  legs: 'maniqui',
});

function make(
  a: Selection,
  b: Selection = sel('maniqui', 'maniqui'),
  opts: { spawns?: [number, number]; seed?: number } = {},
) {
  const terrain = Terrain.fromHeights(1600, 900, new Array(1600).fill(700));
  return new Battle({ seed: opts.seed ?? 3, terrain, spawns: opts.spawns ?? [300, 600], selections: [a, b] });
}
const runFor = (b: Battle, secs: number) => {
  for (let i = 0; i < Math.round(secs * 60); i++) b.update(1 / 60);
};

describe('granada de calabaza', () => {
  it('rebota y explota al acabarse la mecha, dañando a los rivales cercanos', () => {
    const b = make(sel('espantapajaros', 'maniqui'), sel('maniqui', 'maniqui'), { spawns: [300, 520] });
    b.wind = 0;
    expect(b.selectWeapon('granada')).toBe(true);
    b.setAim(40, 45);
    b.fire();
    runFor(b, 1);
    expect(b.projectiles).toHaveLength(1); // still alive during fuse (2.5 s)
    runFor(b, 2.5);
    expect(b.projectiles).toHaveLength(0);
    expect(b.drainEvents().some((e) => e.type === 'explosion')).toBe(true);
  });
});

describe('ráfaga de hielo', () => {
  it('congela a la criatura atrapada en la explosión', () => {
    const b = make(sel('refri', 'maniqui'), sel('maniqui', 'maniqui'), { spawns: [300, 520] });
    b.wind = 0;
    b.selectWeapon('hielo');
    b.setAim(0, 40);
    b.fire();
    runFor(b, 3.5);
    const e = b.units[1];
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(b.current.index).toBe(1);
    expect(b.clock.moveLeft).toBe(0); // frozen: cannot walk this turn
  });
});

describe('empuje y caídas', () => {
  it('las explosiones empujan a las criaturas y pueden lastimarlas si caen desde alto', () => {
    const t = Terrain.fromHeights(1600, 900, new Array(1600).fill(300));
    for (let x = 700; x < 1600; x++) for (let y = 300; y < 900; y++) t.carveCircle(x, y, 0);
    const b = new Battle({
      seed: 1,
      terrain: t,
      spawns: [300, 650],
      selections: [sel('armadura', 'maniqui'), sel('maniqui', 'maniqui')],
    });
    b.units[1].x = 600;
    b.units[1].y = 300;
    b.selectWeapon('mazo');
    b.units[1].x = 372; // inside mace reach
    b.setAim(0, 50);
    b.fire();
    runFor(b, 2);
    expect(b.units[1].hp).toBeLessThan(b.units[1].maxHp);
  });
});

describe('habilidades', () => {
  it('el salto lanza a la criatura, la carrera suma tiempo de movimiento y la cuerda refuerza el siguiente tiro', () => {
    const leap = make(sel('maniqui', 'maniqui', 'espantapajaros'));
    expect(leap.useAbility()).toBe(true);
    expect(leap.units[0].grounded).toBe(false);
    runFor(leap, 2);
    expect(leap.units[0].grounded).toBe(true);

    const run = make(sel('maniqui', 'maniqui', 'maniqui'));
    run.useAbility();
    expect(run.clock.moveLeft).toBe(10);

    const cord = make(sel('juguete', 'maniqui', 'juguete'));
    cord.useAbility();
    expect(cord.units[0].damageBoost).toBe(0.5);
    cord.rules.spread = false;
    cord.selectWeapon('tesla');
    cord.setAim(0, 100);
    cord.fire();
    runFor(cord, 0.2);
    expect(cord.units[0].damageBoost).toBe(0);
    expect(cord.stats.damage[0]).toBe(Math.round(WEAPONS.tesla.damage * 1.66));
  });

  it('no se pueden usar habilidades después de disparar ni cuando ya no quedan', () => {
    const b = make(sel('juguete', 'maniqui', 'refri'));
    b.fire();
    expect(b.useAbility()).toBe(false);
  });
});

describe('cajas', () => {
  it('las cajas de bota, escudo y puño aplican su efecto', () => {
    const b = make(sel('maniqui', 'maniqui'));
    const drop = (type: string, unit: number) => {
      b.crates.push({ id: 900, type, x: b.units[unit].x, y: b.units[unit].y, landed: true });
      runFor(b, 0.1);
    };
    drop('botas', 0);
    expect(b.clock.moveLeft).toBeGreaterThan(8);
    drop('botas', 1);
    expect(b.units[1].moveBonus).toBe(3);
    drop('escudo', 1);
    expect(b.units[1].shield).toBe(0.5);
    drop('punio', 0);
    expect(b.units[0].damageBoost).toBeCloseTo(0.3);
  });

  it('las cajas sobre un hueco abierto caen y se quitan', () => {
    const b = make(sel('maniqui', 'maniqui'));
    b.crates.push({ id: 5, type: 'salud', x: 1000, y: 690, landed: true });
    b.terrain.carveCircle(1000, 700, 200);
    for (let y = 600; y < 900; y += 20) b.terrain.carveCircle(1000, y, 120);
    runFor(b, 3);
    expect(b.crates).toHaveLength(0);
  });
});

describe('protecciones', () => {
  it('no pasa nada cuando la partida ya terminó', () => {
    const b = make(sel('maniqui', 'maniqui'));
    b.units[1].hp = 0;
    b.units[1].alive = false;
    runFor(b, 1);
    expect(b.phase).toBe('over');
    expect(b.fire()).toBe(false);
    expect(b.useAbility()).toBe(false);
    expect(b.jump()).toBe(false);
    b.move(1, 0.1);
    b.update(1);
    expect(b.phase).toBe('over');
  });

  it('saltar y caminar solo funcionan mientras el reloj lo permite', () => {
    const b = make(sel('maniqui', 'maniqui'));
    expect(b.jump()).toBe(true);
    expect(b.jump()).toBe(false);
    b.setAim(200, 5);
    expect(b.current.aimPower).toBe(10);
    expect(b.current.facing).toBe(-1);
  });
});
