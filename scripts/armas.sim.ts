import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import type { Battle } from '../src/core/battle';
import type { BotLevel } from '../src/core/bot';
import { MAPS, WEAPONS } from '../src/core/data';
import { runMatch } from '../src/core/sim';
import { loadMapArts } from '../tests/helpers/mapArt';

/**
 * Bot matches where both bots may only use ONE weapon (unlimited ammo), so every weapon is exercised, including the ones
 * the bot hardly ever picks (Mazo, Tesla). Reports, per weapon: shots, hit rate, damage per hit, matches that never ended,
 * turns that had to be forced and any non-finite number in the state.
 */
it('armas', async () => {
  const arts = await loadMapArts();
  const N = Number(process.env.SIM_N ?? 60); // matches per weapon
  const pairs: [BotLevel, BotLevel][] = [
    ['experto', 'experto'],
    ['novato', 'experto'],
  ];
  const rows: string[] = [];
  for (const id of Object.keys(WEAPONS)) {
    let shots = 0;
    let hits = 0;
    let damage = 0;
    let unfinished = 0;
    let nan = 0;
    let forced = 0;
    let turns = 0;
    for (let s = 0; s < N; s++) {
      let armed = false;
      let last: Battle | null = null;
      const r = runMatch(91000 + s * 13, {
        levels: pairs[s % 2],
        mapId: MAPS[s % MAPS.length].id,
        arts,
        observe: (b: Battle) => {
          if (!armed) {
            armed = true;
            for (const u of b.units) {
              u.weapons = [id];
              u.weapon = id;
              u.ammo = {};
            }
          }
          for (const u of b.units) if (![u.x, u.y, u.vx, u.vy, u.hp].every(Number.isFinite)) nan++;
          for (const e of b.drainEvents()) if (e.type === 'watchdog') forced++; // the simulation never reads them
          last = b;
        },
      });
      const t = r.byWeapon[id];
      shots += t?.picks ?? 0;
      hits += t?.hits ?? 0;
      damage += t?.damage ?? 0;
      turns += r.turns;
      if ((last as Battle | null)?.phase === 'playing') unfinished++; // time limit reached, nobody won
    }
    rows.push(
      `${id.padEnd(8)} partidas=${N} disparos=${shots} aciertos=${hits} (${((100 * hits) / Math.max(1, shots)).toFixed(1)} %) daño/acierto=${(damage / Math.max(1, hits)).toFixed(1)} turnos/partida=${(turns / N).toFixed(1)} sin terminar=${unfinished} forzados=${forced} NaN=${nan}`,
    );
  }
  const out = `ARMAS (bots con una sola arma, munición infinita)\n${rows.join('\n')}\n`;
  if (process.env.SIM_OUT) writeFileSync(process.env.SIM_OUT, out);
  console.log(out);
});
