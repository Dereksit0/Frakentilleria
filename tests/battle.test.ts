import { CRATES, WEAPONS } from '../src/core/data';
import { describe, it, expect } from 'vitest';
import { Battle } from '../src/core/battle';
import { Terrain } from '../src/core/terrain';
import { calcDamage } from '../src/core/damage';
import type { Selection } from '../src/core/stats';

const P1: Selection = { head: 'maniqui', torso: 'maniqui', arms: 'juguete', legs: 'maniqui' }; // tesla y mazo, daño 108 %
const P2: Selection = { head: 'armadura', torso: 'maniqui', arms: 'maniqui', legs: 'maniqui' }; // escudo, resistencia 10
const P3: Selection = { head: 'refri', torso: 'maniqui', arms: 'maniqui', legs: 'maniqui' };

function make(opts: { seed?: number; ground?: number; a?: Selection; b?: Selection } = {}) {
  const ground = opts.ground ?? 700;
  const terrain = Terrain.fromHeights(1600, 900, new Array(1600).fill(ground));
  return new Battle({
    seed: opts.seed ?? 1,
    terrain,
    spawns: [300, 600],
    selections: [opts.a ?? P1, opts.b ?? P3],
  });
}
const runFor = (b: Battle, secs: number) => {
  for (let i = 0; i < Math.round(secs * 60); i++) b.update(1 / 60);
};

describe('inicio de la partida', () => {
  it('pone a las dos criaturas en el suelo; empieza el jugador 1, ronda 1, viento dentro del rango', () => {
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

  it('con la misma semilla sale lo mismo', () => {
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

describe('flujo de turnos', () => {
  it('caminar gasta los 6 s de movimiento y luego se detiene', () => {
    const b = make();
    const x0 = b.current.x;
    for (let i = 0; i < 60 * 8; i++) b.move(1, 1 / 60);
    // Pide 8 s pero solo hay 6 s de movimiento.
    expect(b.clock.moveLeft).toBeCloseTo(0, 1);
    const walked = b.current.x - x0;
    expect(walked).toBeGreaterThan(300);
    expect(walked).toBeLessThan(6 * 140 * 1.4 + 50);
  });

  it('pasa el turno tras 20 s sin disparar', () => {
    const b = make();
    runFor(b, 20.5);
    expect(b.current.index).toBe(1);
    expect(b.clock.timeLeft).toBeGreaterThan(18);
  });

  it('se dispara una vez por turno y luego 3 s de retirada cierran el turno', () => {
    const b = make();
    b.setAim(0, 100);
    expect(b.fire()).toBe(true);
    expect(b.fire()).toBe(false);
    expect(b.clock.phase).toBe('retreat');
    runFor(b, 3.5);
    expect(b.current.index).toBe(1);
  });
});

describe('armas', () => {
  it('el rayo Tesla golpea al rival en línea por base × bono × (1 − resistencia)', () => {
    const b = make({ b: P2 });
    expect(b.selectWeapon('tesla')).toBe(true);
    b.rules.spread = false;
    b.setAim(0, 100);
    b.fire();
    runFor(b, 0.5);
    const expected = calcDamage(WEAPONS.tesla.damage, 0.08, 0.1);
    expect(b.units[1].maxHp - b.units[1].hp).toBe(expected);
    expect(b.stats.damage[0]).toBe(expected);
    expect(b.stats.bestShot[0]).toBe(expected);
  });

  it('no se puede elegir un arma que la criatura no tiene', () => {
    expect(make().selectWeapon('hielo')).toBe(false);
  });

  it('el mazo golpea a los rivales cercanos y abre el terreno', () => {
    const b = make({ a: { head: 'maniqui', torso: 'maniqui', arms: 'armadura', legs: 'maniqui' } });
    b.units[1].x = 380;
    b.selectWeapon('mazo');
    b.setAim(0, 50);
    const before = b.terrain.solidCount();
    b.fire();
    runFor(b, 0.5);
    expect(b.units[1].hp).toBeLessThan(b.units[1].maxHp);
    expect(b.terrain.solidCount()).toBeLessThan(before);
  });

  it('un proyectil explota en el terreno y abre un cráter', () => {
    const b = make();
    // P1 no tiene arma de proyectil propia: se usa una criatura con bazuca.
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

  it('la habilidad de escudo reduce a la mitad el daño recibido y se usa una vez', () => {
    const b = make({ a: P2, b: P1 }); // el jugador 1 tiene la cabeza de armadura (escudo)
    expect(b.useAbility()).toBe(true);
    expect(b.useAbility()).toBe(false);
    expect(b.units[0].abilityUsed).toBe(true);
    expect(b.units[0].shield).toBe(0.5);
  });

  it('la habilidad de curar devuelve vida hasta el máximo', () => {
    const b = make({ a: P3 });
    b.units[0].hp = 50;
    expect(b.useAbility()).toBe(true);
    expect(b.units[0].hp).toBe(70);
  });
});

describe('fin de la partida', () => {
  it('gana la última criatura en pie', () => {
    const b = make();
    b.units[1].hp = 1;
    b.selectWeapon('tesla');
    b.setAim(0, 100);
    b.fire();
    runFor(b, 1);
    expect(b.phase).toBe('over');
    expect(b.result).toEqual({ winner: 0 });
  });

  it('es empate si las dos caen en el mismo turno (ácido)', () => {
    const b = make({ ground: 850 });
    b.turn.round = 7; // el ácido está en 820 y los pies en 850
    b.units[0].hp = 10;
    b.units[1].hp = 10;
    b.forceEndTurn();
    expect(b.phase).toBe('over');
    expect(b.result).toEqual({ winner: null });
  });

  it('el ácido mata al tocar: si alcanza a las dos a la vez, sobrevive y gana la más sana', () => {
    const b = make({ ground: 850 });
    b.turn.round = 7;
    b.units[1].hp = 10;
    b.forceEndTurn();
    expect(b.units[1].alive).toBe(false);
    expect(b.result).toEqual({ winner: 0 });
  });

  it('con la regla antigua (acidKills = false) el ácido solo lastima a quien está bajo el nivel y puede decidir la partida', () => {
    const b = make({ ground: 850 });
    b.rules.acidKills = false;
    b.turn.round = 7;
    b.units[1].hp = 10;
    b.forceEndTurn();
    expect(b.units[0].hp).toBe(b.units[0].maxHp - 15);
    expect(b.result).toEqual({ winner: 0 });
  });

  it('no hay daño de ácido antes de la ronda 6', () => {
    const b = make({ ground: 850 });
    b.forceEndTurn();
    expect(b.units[0].hp).toBe(b.units[0].maxHp);
  });

  it('caer fuera del mundo mata', () => {
    const b = make();
    for (let y = 600; y < 900; y += 20) b.terrain.carveCircle(600, y, 70);
    runFor(b, 4);
    expect(b.units[1].alive).toBe(false);
    expect(b.phase === 'over' || b.units[1].hp === 0).toBe(true);
  });
});

describe('cajas y estados', () => {
  it('cae una caja cada pocos turnos (crates.json) y cura al recogerla', () => {
    const b = make();
    expect(b.crates).toHaveLength(0);
    for (let i = 0; i < CRATES.everyTurns - 1; i++) b.forceEndTurn();
    expect(b.turn.turnNumber).toBe(CRATES.everyTurns);
    expect(b.crates).toHaveLength(1);
    const crate = b.crates[0];
    crate.type = 'salud';
    b.units[0].hp = 40;
    runFor(b, 6); // paracaídas: 160 px/s
    const c = b.crates[0];
    // Se lleva a la criatura hasta la caja.
    b.units[b.current.index].x = c.x;
    b.units[b.current.index].hp = 40;
    runFor(b, 0.5);
    expect(b.crates.length).toBe(0);
    expect(b.units[b.current.index].hp).toBe(
      Math.min(b.units[b.current.index].maxHp, 40 + CRATES.types.salud.value),
    );
  });

  it('una criatura congelada no camina en su siguiente turno', () => {
    const b = make();
    b.units[1].frozenTurns = 1;
    b.forceEndTurn();
    expect(b.current.index).toBe(1);
    expect(b.clock.moveLeft).toBe(0);
    expect(b.units[1].frozenTurns).toBe(0);
  });

  it('emite eventos que la escena puede vaciar', () => {
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
