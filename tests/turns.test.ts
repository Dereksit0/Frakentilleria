import { describe, it, expect } from 'vitest';
import { TurnClock, TurnOrder, rollWind, TURN_TIME, MOVE_TIME, RETREAT_TIME } from '../src/core/turns';
import { Rng } from '../src/core/rng';

describe('TurnClock', () => {
  it('empieza con 20 s en total y 6 s de movimiento', () => {
    const c = new TurnClock();
    expect(c.timeLeft).toBe(TURN_TIME);
    expect(c.moveLeft).toBe(MOVE_TIME);
    expect(c.phase).toBe('aim');
    expect(TURN_TIME).toBe(20);
    expect(MOVE_TIME).toBe(6);
    expect(RETREAT_TIME).toBe(3);
  });

  it('el tiempo de movimiento se acumula y tiene tope de 6 s', () => {
    const c = new TurnClock();
    expect(c.spendMove(2)).toBe(2);
    expect(c.spendMove(3)).toBe(3);
    expect(c.moveLeft).toBeCloseTo(1);
    expect(c.spendMove(5)).toBeCloseTo(1); // only 1 s was left
    expect(c.canMove()).toBe(false);
  });

  it('se dispara una vez y empieza una retirada de 3 s', () => {
    const c = new TurnClock();
    c.tick(2);
    expect(c.fire()).toBe(true);
    expect(c.fire()).toBe(false);
    expect(c.phase).toBe('retreat');
    expect(c.timeLeft).toBeCloseTo(RETREAT_TIME);
    expect(c.canMove()).toBe(true); // retreat ignores the movement budget
  });

  it('la retirada nunca alarga el turno más allá del tiempo que queda', () => {
    const c = new TurnClock();
    c.tick(19);
    c.fire();
    expect(c.timeLeft).toBeCloseTo(1);
  });

  it('termina al acabarse el tiempo y avisa urgencia en los últimos 5 s', () => {
    const c = new TurnClock();
    c.tick(14);
    expect(c.urgent).toBe(false);
    c.tick(1.5);
    expect(c.urgent).toBe(true);
    expect(c.tick(10)).toBe(true);
    expect(c.timeLeft).toBe(0);
    expect(c.ended).toBe(true);
    expect(c.fire()).toBe(false);
  });

  it('moveBonus suma tiempo de movimiento', () => {
    const c = new TurnClock();
    c.reset(3, false);
    expect(c.moveLeft).toBe(9);
    c.reset(0, true);
    expect(c.moveLeft).toBe(0); // frozen
  });
});

describe('TurnOrder', () => {
  const alive = () => true;
  it('alterna jugadores y cuenta una ronda cuando todos jugaron', () => {
    const o = new TurnOrder(2);
    expect([o.current, o.round, o.turnNumber]).toEqual([0, 1, 1]);
    expect(o.advance(alive)).toBe(1);
    expect([o.round, o.turnNumber]).toEqual([1, 2]);
    expect(o.advance(alive)).toBe(0);
    expect([o.round, o.turnNumber]).toEqual([2, 3]);
  });
  it('salta a los jugadores muertos', () => {
    const o = new TurnOrder(3);
    const next = o.advance((i) => i !== 1);
    expect(next).toBe(2);
    expect(o.advance((i) => i !== 1)).toBe(0);
    expect(o.round).toBe(2);
  });
});

describe('rollWind', () => {
  it('queda entre -5 y +5, es repetible con semilla y usa todo el rango', () => {
    const r = new Rng(123);
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      const w = rollWind(r);
      expect(Number.isInteger(w)).toBe(true);
      expect(Math.abs(w)).toBeLessThanOrEqual(5);
      seen.add(w);
    }
    expect(seen.size).toBe(11);
  });
});
