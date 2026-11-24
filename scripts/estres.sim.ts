import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { runMatch } from '../src/core/sim';
import { WORLD } from '../src/core/data';
import type { BotLevel } from '../src/core/bot';
import { loadMapArts } from '../tests/helpers/mapArt';

/**
 * Prueba de estrés: partidas entre bots con semillas al azar. En cada paso revisa que no haya NaN, que las criaturas
 * vivas sigan dentro del mapa y que ninguna partida se quede atascada. Variables:
 *   STRESS_N     cantidad de partidas (por defecto 1000)
 *   STRESS_OUT   archivo JSON donde dejar el resumen
 */
const N = Number(process.env.STRESS_N ?? 1000);
const LEVELS: BotLevel[] = ['novato', 'experto'];
const MARGIN_X = 120;

it('mil partidas con semillas al azar no dan errores, NaN ni turnos atascados', async () => {
  const arts = await loadMapArts();
  const problemas: string[] = [];
  let rounds = 0;
  let turns = 0;
  let draws = 0;
  let seconds = 0;
  for (let i = 0; i < N; i++) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const levels: [BotLevel, BotLevel] = [LEVELS[seed % 2], LEVELS[(seed >> 1) % 2]];
    try {
      const r = runMatch(seed, {
        levels,
        arts,
        inspect: (b) => {
          for (const u of b.units) {
            const ok = [u.x, u.y, u.vx, u.vy, u.hp].every(Number.isFinite);
            if (!ok) problemas.push(`semilla ${seed}: valor no finito en la criatura ${u.index}`);
            if (u.alive && (u.x < -MARGIN_X || u.x > WORLD.width + MARGIN_X || u.y > WORLD.height + 400))
              problemas.push(`semilla ${seed}: criatura ${u.index} fuera del mapa (${u.x | 0}, ${u.y | 0})`);
          }
        },
      });
      if (r.timedOut) problemas.push(`semilla ${seed}: partida atascada (${r.turns} turnos)`);
      if (![r.rounds, r.turns, r.damage[0], r.damage[1]].every(Number.isFinite))
        problemas.push(`semilla ${seed}: resultado con NaN`);
      rounds += r.rounds;
      turns += r.turns;
      seconds += r.seconds;
      if (r.winner === null) draws++;
    } catch (e) {
      problemas.push(`semilla ${seed}: excepción ${(e as Error).message}`);
    }
  }
  const resumen = {
    partidas: N,
    rondasMedias: rounds / N,
    turnosMedios: turns / N,
    segundosMediosDeBot: seconds / N,
    empates: draws,
    problemas: problemas.slice(0, 20),
  };
  if (process.env.STRESS_OUT) writeFileSync(process.env.STRESS_OUT, JSON.stringify(resumen, null, 1));
  console.log(JSON.stringify(resumen));
  expect(problemas.slice(0, 10)).toEqual([]);
}, 3_600_000);
