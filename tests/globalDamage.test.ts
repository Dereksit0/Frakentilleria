import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle';
import { Terrain } from '../src/core/terrain';
import { defaultRules, TUNING } from '../src/core/tuning';
import type { Selection } from '../src/core/stats';

const SHOOTER: Selection = { head: 'maniqui', torso: 'maniqui', arms: 'armadura', legs: 'maniqui' }; // mazo
const flat = (): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(700));

function hit(scale: number | undefined): number {
  const b = new Battle({ seed: 3, terrain: flat(), spawns: [600, 700], selections: [SHOOTER, SHOOTER] });
  b.rules.spread = false;
  b.rules.gusts = false;
  b.wind = 0;
  if (scale !== undefined) b.rules.damageScale = scale;
  b.selectWeapon('mazo');
  b.setAim(0, 50);
  b.fire();
  for (let i = 0; i < 60; i++) b.update(1 / 60);
  return b.units[1].maxHp - b.units[1].hp;
}

describe('multiplicador global de daño (balance.globalDamageMultiplier)', () => {
  it('vive en datos y es la regla por defecto', () => {
    expect(TUNING.balance.globalDamageMultiplier).toBeGreaterThan(0);
    expect(defaultRules().damageScale).toBe(TUNING.balance.globalDamageMultiplier);
  });

  it('escala el daño de las armas de forma proporcional', () => {
    const one = hit(1);
    const two = hit(2);
    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThanOrEqual(one * 2 - 1);
    expect(two).toBeLessThanOrEqual(one * 2 + 1);
  });

  it('el valor por defecto aplica el multiplicador de los datos', () => {
    const def = hit(undefined);
    const base = hit(1);
    expect(def).toBeGreaterThanOrEqual(Math.floor(base * TUNING.balance.globalDamageMultiplier) - 1);
  });

  it('la caída y el ácido no usan el multiplicador', () => {
    // fall damage and the acid come from their own formulas: scaling the weapons must not change them
    const a = new Battle({ seed: 1, terrain: flat(), spawns: [300, 1300], selections: [SHOOTER, SHOOTER] });
    const b = new Battle({ seed: 1, terrain: flat(), spawns: [300, 1300], selections: [SHOOTER, SHOOTER] });
    a.rules.damageScale = 1;
    b.rules.damageScale = 3;
    for (const x of [a, b]) {
      x.units[0].y -= 300; // drop from 300 px
      for (let i = 0; i < 120; i++) x.update(1 / 60);
    }
    expect(a.units[0].maxHp - a.units[0].hp).toBe(b.units[0].maxHp - b.units[0].hp);
  });
});
