import { beforeAll, describe, expect, it } from 'vitest';
import { loadMapArts } from './helpers/mapArt';
import { aggregate, runMatch } from '../src/core/sim';
import { Battle } from '../src/core/battle';
import { MAPS, WEAPONS, WORLD } from '../src/core/data';
import { planShot } from '../src/core/bot';
import { buildTerrain } from '../src/core/maps';
import { Rng } from '../src/core/rng';
import { randomSelection } from '../src/core/stats';

function freshBattle(seed: number): Battle {
  const rng = new Rng(seed);
  const map = MAPS.find((m) => m.terrain.kind === 'procedural') ?? MAPS[0];
  return new Battle({
    seed,
    terrain: buildTerrain(map, WORLD),
    spawns: map.spawns,
    selections: [randomSelection(rng), randomSelection(rng)],
  });
}

describe('planeación del bot', () => {
  it('devuelve un arma que tiene, con puntería dentro de los rangos legales', () => {
    for (const level of ['novato', 'experto'] as const) {
      const b = freshBattle(5);
      const plan = planShot(b, new Rng(1), level);
      expect(b.current.weapons).toContain(plan.weapon);
      expect(plan.angle).toBeGreaterThanOrEqual(0);
      expect(plan.angle).toBeLessThan(360);
      expect(plan.power).toBeGreaterThanOrEqual(10);
      expect(plan.power).toBeLessThanOrEqual(100);
      expect(WEAPONS[plan.weapon]).toBeDefined();
    }
  });

  it('con la misma semilla sale lo mismo', () => {
    const a = planShot(freshBattle(9), new Rng(3), 'experto');
    const b = planShot(freshBattle(9), new Rng(3), 'experto');
    expect(a).toEqual(b);
  });
});

let arts: Awaited<ReturnType<typeof loadMapArts>>;
beforeAll(async () => {
  arts = await loadMapArts();
});

describe('simulación de partidas', () => {
  it('la misma semilla da el mismo resultado', () => {
    const o = { levels: ['experto', 'experto'] as const, arts };
    expect(runMatch(11, o)).toEqual(runMatch(11, o));
  });

  it('registra el primer golpe, el daño por arma y los disparos', () => {
    const r = runMatch(21, { levels: ['experto', 'experto'], arts });
    expect([0, 1, null]).toContain(r.firstBlow);
    expect([0, 1, null]).toContain(r.winner);
    expect(r.turns).toBeGreaterThan(0);
    expect(r.shots).toBeGreaterThan(0);
    const total = Object.values(r.byWeapon).reduce((a, w) => a + w.damage, 0);
    expect(total).toBe(r.damage[0] + r.damage[1]);
  });

  it('junta el porcentaje de victorias de quien golpea primero, los empates y las rondas', () => {
    const results = Array.from({ length: 6 }, (_, i) =>
      runMatch(100 + i, { levels: ['experto', 'experto'], arts }),
    );
    const s = aggregate(results);
    expect(s.matches).toBe(6);
    expect(s.firstBlowWinPct).toBeGreaterThanOrEqual(0);
    expect(s.firstBlowWinPct).toBeLessThanOrEqual(100);
    expect(s.drawPct).toBeGreaterThanOrEqual(0);
    expect(s.avgRounds).toBeGreaterThan(1);
    const share = Object.values(s.weapons).reduce((a, w) => a + w.damageShare, 0);
    expect(share).toBeCloseTo(1, 5);
  });

  it('los expertos aciertan más seguido que los novatos', () => {
    const pct = (lv: 'novato' | 'experto') =>
      aggregate(Array.from({ length: 12 }, (_, i) => runMatch(300 + i, { levels: [lv, lv], arts })))
        .hitTurnPct;
    expect(pct('experto')).toBeGreaterThan(pct('novato'));
  });
});
