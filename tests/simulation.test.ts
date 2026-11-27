import { describe, it, expect } from 'vitest';
import { Battle } from '../src/core/battle';
import { MAPS, WORLD } from '../src/core/data';
import { buildTerrain } from '../src/core/maps';
import { Rng } from '../src/core/rng';
import { randomSelection } from '../src/core/stats';

/** Un bot mínimo que apunta más o menos al rival con ruido: basta para probar que las partidas siempre terminan. */
function playMatch(seed: number): { rounds: number; winner: number | null; turns: number; seconds: number } {
  const rng = new Rng(seed);
  const map = MAPS.find((m) => m.terrain.kind === 'procedural');
  if (!map) throw new Error('needs a procedural map');
  const b = new Battle({
    seed,
    terrain: buildTerrain(map, WORLD),
    spawns: map.spawns,
    selections: [randomSelection(rng), randomSelection(rng)],
  });
  let t = 0;
  let turns = 0;
  let lastTurn = -1;
  while (b.phase === 'playing' && t < 3000) {
    if (b.turn.turnNumber !== lastTurn) {
      lastTurn = b.turn.turnNumber;
      turns++;
      const u = b.current;
      const foe = b.units[1 - u.index];
      b.selectWeapon(rng.pick(u.weapons));
      const dx = foe.x - u.x;
      const base = dx >= 0 ? 0 : 180;
      const angle = base + (dx >= 0 ? 1 : -1) * rng.int(20, 70);
      b.setAim(angle, rng.int(35, 100));
      b.fire();
    }
    b.update(1 / 30);
    t += 1 / 30;
  }
  return { rounds: b.round, winner: b.result?.winner ?? null, turns, seconds: t };
}

describe('partidas completas sin pantalla', () => {
  it('toda partida simulada termina (victoria o empate) mucho antes de que el ácido inunde el mundo', () => {
    const results = Array.from({ length: 40 }, (_, i) => playMatch(1000 + i));
    for (const r of results) {
      expect(r.seconds).toBeLessThan(3000);
      expect([0, 1, null]).toContain(r.winner);
    }
    const avgRounds = results.reduce((a, r) => a + r.rounds, 0) / results.length;
    // Meta de diseño (rúbrica): ni muy corta ni muy larga.
    expect(avgRounds).toBeGreaterThan(2);
    expect(avgRounds).toBeLessThan(25);
  });

  it('same seed => same match', () => {
    expect(playMatch(77)).toEqual(playMatch(77));
  });
});
