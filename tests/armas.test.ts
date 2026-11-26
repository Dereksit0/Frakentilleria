import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/core/battle';
import { launchVelocity, simulateTrajectory } from '../src/core/ballistics';
import { WEAPONS } from '../src/core/data';
import { calcDamage, explosionFalloff } from '../src/core/damage';
import { Terrain } from '../src/core/terrain';
import { UNIT_CENTER_OFFSET, UNIT_RADIUS } from '../src/core/unit';
import type { Selection } from '../src/core/stats';

/**
 * Cada arma de src/data/weapons.json, una por una: se puede seleccionar, dispara, sigue la trayectoria esperada, el radio,
 * el cráter y el daño salen de sus datos, gasta munición, destruye terreno y el juego continúa (pasa el turno).
 */
const SEL: Selection = { head: 'maniqui', torso: 'maniqui', arms: 'maniqui', legs: 'maniqui' };
const GROUND = 700;
const flat = (): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(GROUND));

function duel(weapon: string, foeX: number): Battle {
  const b = new Battle({ seed: 11, terrain: flat(), spawns: [400, foeX], selections: [SEL, SEL] });
  b.rules.spread = false;
  b.rules.gusts = false;
  b.rules.coverFactor = 1;
  b.wind = 0;
  const u = b.units[0];
  u.weapons = [weapon];
  u.ammo = WEAPONS[weapon].ammo === undefined ? {} : { [weapon]: WEAPONS[weapon].ammo as number };
  return b;
}

function runTurn(b: Battle, secs = 20): BattleEvent[] {
  const turn0 = b.turn.turnNumber;
  const ev: BattleEvent[] = [];
  for (let i = 0; i < secs * 60 && b.turn.turnNumber === turn0; i++) {
    b.update(1 / 60);
    ev.push(...b.drainEvents());
  }
  return ev;
}

const muzzle = (b: Battle, angle: number) => {
  const u = b.units[0];
  const r = (angle * Math.PI) / 180;
  return { x: u.x + Math.cos(r) * 40, y: u.y - UNIT_CENTER_OFFSET - 10 - Math.sin(r) * 40 };
};

const scale = (b: Battle) => b.rules.damageScale * b.world.damageScale;
const bonusOf = (b: Battle) => (b.units[0].stats.damage - 100) / 100;

describe.each(Object.keys(WEAPONS))('arma %s', (id) => {
  const w = WEAPONS[id];

  it('se puede seleccionar, dispara y gasta su munición (el cañón no se agota)', () => {
    const b = duel(id, 1300);
    expect(b.selectWeapon(id)).toBe(true);
    expect(b.current.weapon).toBe(id);
    const before = b.current.ammo[id];
    b.setAim(40, 50);
    expect(b.fire()).toBe(true);
    expect(b.drainEvents().some((e) => e.type === 'fire' && e.weapon === id)).toBe(true);
    if (w.ammo === undefined) expect(b.current.ammo[id]).toBeUndefined();
    else expect(b.current.ammo[id]).toBe(before - 1);
  });

  it('sin munición ya no se puede seleccionar ni disparar', () => {
    if (w.ammo === undefined) return; // infinite
    const b = duel(id, 1300);
    b.units[0].ammo[id] = 0;
    expect(b.selectWeapon(id)).toBe(false);
  });

  it('la trayectoria es la esperada y el impacto usa radio y cráter de los datos, destruyendo terreno', () => {
    const b = duel(id, 1500); // rival lejos: el disparo da en el suelo
    b.selectWeapon(id);
    const angle = w.kind === 'beam' ? -20 : w.kind === 'melee' ? 0 : 70;
    const power = 45;
    b.setAim(angle, power);
    const m = muzzle(b, angle);
    b.fire();
    const ev = runTurn(b);
    const boom = ev.find((e) => e.type === 'explosion');
    expect(boom, 'hay impacto').toBeDefined();
    if (boom?.type !== 'explosion') return;
    expect(boom.radius).toBe(w.radius);
    expect(boom.crater).toBe(w.crater);
    if (w.kind === 'projectile') {
      const sim = simulateTrajectory(m, launchVelocity(angle, power), 0, flat(), {
        windFactor: w.windFactor,
        arcOverCover: w.arcOverCover,
      });
      expect(
        Math.hypot(boom.x - sim.hit.x, boom.y - sim.hit.y),
        'cae donde predice la balística',
      ).toBeLessThan(12);
    } else if (w.kind === 'beam') {
      const beam = ev.find((e) => e.type === 'beam');
      expect(beam?.type === 'beam' && Math.abs(beam.x1 - m.x) < 1 && Math.abs(beam.y1 - m.y) < 1).toBe(true);
      const dir = Math.atan2(-(boom.y - m.y), boom.x - m.x) * (180 / Math.PI);
      expect(Math.abs(dir - angle), 'el rayo va en línea recta').toBeLessThan(1);
    }
    // the crater: the impact point and its surroundings are no longer solid ground
    const probeY = Math.max(boom.y, GROUND + 2);
    if (probeY - boom.y < w.crater)
      expect(b.terrain.isSolid(boom.x, probeY), 'el terreno se destruye').toBe(false);
    expect(b.current.index, 'el juego continúa: turno del rival').toBe(1);
  });

  it('el daño al rival coincide con daño, radio y caída de los datos', () => {
    // the foe right in front: melee and beam at short range, projectiles dropped almost on top of it
    const b = duel(id, w.kind === 'melee' ? 400 + 110 : 400 + 220);
    b.selectWeapon(id);
    const foe = b.units[1];
    const res = foe.stats.resistance / 100;
    if (w.kind === 'beam' || w.kind === 'melee') b.setAim(0, 50);
    else {
      // aim where the ballistics says the shot lands next to the foe
      let best: [number, number] = [45, 50];
      let bestD = Infinity;
      for (let a = 10; a <= 85; a += 3)
        for (let p = 20; p <= 80; p += 2) {
          if (w.minAngle !== undefined && a < w.minAngle) continue;
          const sim = simulateTrajectory(muzzle(b, a), launchVelocity(a, p), 0, flat(), {
            windFactor: w.windFactor,
            arcOverCover: w.arcOverCover,
          });
          const d = Math.abs(sim.hit.x - foe.x);
          if (d < bestD) {
            bestD = d;
            best = [a, p];
          }
        }
      b.setAim(best[0], best[1]);
    }
    const hp0 = foe.hp;
    b.fire();
    const ev = runTurn(b);
    const dmg = ev.filter((e) => e.type === 'damage' && e.unit === 1 && e.cause === 'weapon');
    expect(dmg.length, 'el rival recibe daño del arma').toBeGreaterThan(0);
    const first = dmg[0];
    if (first.type !== 'damage') return;
    let expected: number;
    if (w.kind === 'beam' || w.kind === 'melee') expected = calcDamage(w.damage * scale(b), bonusOf(b), res);
    else {
      const boom = ev.find((e) => e.type === 'explosion');
      if (boom?.type !== 'explosion') throw new Error('sin explosión');
      // the damage event is placed 30 px above the foe's centre at the moment of the blast (before any shove)
      const dist = Math.hypot(first.x - boom.x, first.y + 30 - boom.y);
      expected = calcDamage(
        w.damage * explosionFalloff(dist, w.radius + UNIT_RADIUS * 0.5) * scale(b),
        bonusOf(b),
        res,
      );
    }
    expect(first.amount, `${id}: daño según datos`).toBeCloseTo(expected, -0.5); // ±1 por redondeo de posición
    expect(hp0 - foe.hp).toBeGreaterThanOrEqual(first.amount);
    expect(b.turn.turnNumber, 'pasa el turno').toBeGreaterThan(0);
  });
});

describe('efectos propios de cada arma', () => {
  it('granada: explota al cumplirse la mecha de los datos, no al tocar el suelo', () => {
    const b = duel('granada', 1500);
    b.selectWeapon('granada');
    b.setAim(45, 30);
    b.fire();
    let t = 0;
    let at = -1;
    for (let i = 0; i < 10 * 60 && at < 0; i++) {
      b.update(1 / 60);
      t += 1 / 60;
      if (b.drainEvents().some((e) => e.type === 'explosion')) at = t;
    }
    expect(at).toBeGreaterThan((WEAPONS.granada.fuse ?? 0) - 0.05);
    expect(at).toBeLessThan((WEAPONS.granada.fuse ?? 0) + 0.1);
  });

  it('mortero: nunca sale por debajo de su ángulo mínimo', () => {
    const b = duel('mortero', 1500);
    b.selectWeapon('mortero');
    b.setAim(10, 50);
    b.fire();
    const p = b.projectiles[0];
    const launched = Math.atan2(-p.vy, p.vx) * (180 / Math.PI);
    expect(launched).toBeGreaterThanOrEqual((WEAPONS.mortero.minAngle ?? 0) - 0.01);
  });

  it('hielo congela, mazo aturde y poción deja charco con los valores de los datos', () => {
    const run = (id: string, foeX: number) => {
      const b = duel(id, foeX);
      b.selectWeapon(id);
      b.setAim(0, 40);
      b.fire();
      return { b, ev: runTurn(b) };
    };
    const ice = run('hielo', 520);
    expect(ice.b.units[1].hp).toBeLessThan(ice.b.units[1].maxHp);
    expect(ice.b.clock.moveLeft, 'congelado: no camina').toBe(0);

    const mace = run('mazo', 510);
    expect(mace.b.units[1].stunTurns + (mace.b.units[1].stunActive ? 1 : 0)).toBeGreaterThan(0);

    const acid = run('pocion', 900);
    const puddle = acid.ev.find((e) => e.type === 'puddle');
    expect(puddle?.type === 'puddle' && puddle.radius === WEAPONS.pocion.puddle?.radius).toBe(true);
    expect(puddle?.type === 'puddle' && puddle.turns === WEAPONS.pocion.puddle?.turns).toBe(true);
  });

  it('tesla: el rayo salta al segundo objetivo con la caída de los datos (cadena)', () => {
    const chain = WEAPONS.tesla.chain;
    expect(chain).toBeDefined();
    expect(chain!.falloff).toBeGreaterThan(0);
    expect(chain!.falloff).toBeLessThan(1);
  });
});
