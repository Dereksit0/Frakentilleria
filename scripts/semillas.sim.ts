import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { runMatch } from '../src/core/sim';
import { loadMapArts } from '../tests/helpers/mapArt';

/**
 * Corre 300 partidas con semillas fijas (1 a 300) y guarda el resultado exacto de cada una.
 * Sirve para comprobar que una limpieza no cambia el comportamiento: el JSON debe salir idéntico.
 *   SEEDS_OUT   archivo de salida (por defecto docs/auditoria/semillas.json)
 */
const FIRST_SEED = 1;
const MATCHES = 300;

it('simula 300 partidas con semillas fijas', async () => {
  const arts = await loadMapArts();
  const rows = [];
  for (let seed = FIRST_SEED; seed < FIRST_SEED + MATCHES; seed++) {
    const r = runMatch(seed, { levels: ['experto', 'experto'], arts });
    rows.push({
      seed,
      map: r.map,
      winner: r.winner,
      rounds: r.rounds,
      turns: r.turns,
      shots: r.shots,
      hitShots: r.hitShots,
      damage: r.damage,
    });
  }
  writeFileSync(process.env.SEEDS_OUT ?? 'docs/auditoria/semillas.json', JSON.stringify(rows, null, 1));
}, 3_600_000);
