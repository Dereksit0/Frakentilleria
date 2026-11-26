import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/core/battle';
import { WEAPONS } from '../src/core/data';
import { Terrain } from '../src/core/terrain';
import type { Selection } from '../src/core/stats';

/**
 * Regresión del congelamiento al impactar: con CADA arma, un disparo que da al rival produce daño, el turno pasa al
 * rival, no se lanza ninguna excepción y ningún número del estado queda en NaN o Infinity.
 */
const SEL: Selection = { head: 'maniqui', torso: 'maniqui', arms: 'maniqui', legs: 'maniqui' };
const flat = (): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(700));

function duel(weapon: string, gap: number): Battle {
  const b = new Battle({ seed: 7, terrain: flat(), spawns: [500, 500 + gap], selections: [SEL, SEL] });
  b.rules.spread = false;
  b.rules.gusts = false;
  b.wind = 0;
  b.units[0].weapons = [weapon];
  b.units[0].ammo = {};
  return b;
}

/** Every number of the visible state is finite. */
function finiteState(b: Battle): string[] {
  const bad: string[] = [];
  for (const u of b.units)
    for (const k of ['x', 'y', 'vx', 'vy', 'hp'] as const)
      if (!Number.isFinite(u[k])) bad.push(`unidad ${u.index}.${k}=${u[k]}`);
  for (const p of b.projectiles)
    for (const k of ['x', 'y', 'vx', 'vy'] as const)
      if (!Number.isFinite(p[k])) bad.push(`proyectil.${k}=${p[k]}`);
  if (!Number.isFinite(b.wind)) bad.push(`viento=${b.wind}`);
  return bad;
}

function eventNumbers(ev: BattleEvent[]): string[] {
  const bad: string[] = [];
  for (const e of ev)
    for (const [k, v] of Object.entries(e))
      if (typeof v === 'number' && !Number.isFinite(v)) bad.push(`${e.type}.${k}=${v}`);
  return bad;
}

/** Fires once with the given aim and runs until the turn passes (or 20 s of game time). */
function shot(weapon: string, gap: number, angle: number, power: number) {
  const b = duel(weapon, gap);
  expect(b.selectWeapon(weapon), weapon).toBe(true);
  b.setAim(angle, power);
  const turn0 = b.turn.turnNumber;
  const hp0 = b.units[1].hp;
  b.fire();
  const ev: BattleEvent[] = [];
  const nan: string[] = [];
  for (let i = 0; i < 20 * 60 && b.turn.turnNumber === turn0; i++) {
    b.update(1 / 60);
    ev.push(...b.drainEvents());
    nan.push(...finiteState(b));
  }
  return { b, ev, nan, turn0, damage: hp0 - b.units[1].hp };
}

const AIMS: Array<[number, number, number]> = [];
for (const gap of [140, 220, 320])
  for (const angle of [0, 15, 30, 45, 60, 70])
    for (const power of [30, 40, 50, 60, 70]) AIMS.push([gap, angle, power]);

describe('impacto con cada arma: el juego sigue avanzando', () => {
  for (const weapon of Object.keys(WEAPONS)) {
    it(`${weapon}: daña al rival, pasa el turno, sin excepciones ni NaN`, () => {
      let hit: ReturnType<typeof shot> | null = null;
      for (const [gap, angle, power] of AIMS) {
        const r = shot(weapon, gap, angle, power); // throws here if the impact throws
        expect(r.nan, `${weapon} ${gap}px ${angle}° ${power}%`).toEqual([]);
        expect(eventNumbers(r.ev), weapon).toEqual([]);
        expect(r.b.turn.turnNumber, `${weapon}: el turno pasa`).toBeGreaterThan(r.turn0);
        expect(
          r.ev.some((e) => e.type === 'watchdog'),
          `${weapon}: no hizo falta forzar el turno`,
        ).toBe(false);
        if (r.damage > 0) {
          hit = r;
          break;
        }
      }
      expect(hit, `${weapon}: ningún disparo de la rejilla dio al rival`).not.toBeNull();
      const r = hit!;
      expect(r.ev.some((e) => e.type === 'damage' && e.unit === 1)).toBe(true);
      expect(r.b.current.index, 'ahora juega el rival').toBe(1);
      expect(r.b.phase).toBe('playing');
    });
  }
});
