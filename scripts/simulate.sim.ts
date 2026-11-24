import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { aggregate, runMatch, type Summary } from '../src/core/sim';
import type { BotLevel } from '../src/core/bot';
import { WEAPONS } from '../src/core/data';
import { loadMapArts } from '../tests/helpers/mapArt';

/**
 * Batch simulation. Environment variables:
 *   SIM_N       matches per level pairing (default 300)
 *   SIM_SEED    first seed (default 1000)
 *   SIM_OUT     markdown file to write (default: print only)
 *   SIM_TITLE   heading of the table
 *   SIM_RULES   JSON with rule overrides, e.g. '{"spreadScale":3}'
 *   SIM_HAZARDS '0' plays without map hazards
 *   SIM_PAIRS   'ee' only expert-expert (fast sweeps); default all three
 * Run with `npm run simulate`.
 */
const pairs: [BotLevel, BotLevel][] = [
  ['experto', 'experto'],
  ['novato', 'novato'],
  ['experto', 'novato'],
];

const f = (n: number, d = 1): string => n.toFixed(d);

function table(label: string, s: Summary): string {
  const rows = Object.entries(s.weapons)
    .sort((a, b) => b[1].damageShare - a[1].damageShare)
    .map(
      ([id, w]) =>
        `| ${WEAPONS[id]?.name ?? id} | ${f(w.damageShare * 100)} % | ${f(w.pickShare * 100)} % | ${f(w.hitPct)} % |`,
    )
    .join('\n');
  return `### ${label}

| Métrica | Valor |
|---|---|
| Partidas | ${s.matches} |
| Gana quien da el primer golpe | ${f(s.firstBlowWinPct)} % |
| Empates | ${f(s.drawPct)} % |
| Rondas medias | ${f(s.avgRounds)} |
| Turnos medios | ${f(s.avgTurns)} |
| Daño medio por turno | ${f(s.avgDamagePerTurn)} |
| Turnos con acierto | ${f(s.hitTurnPct)} % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | ${f(s.comebackPct)} % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
${rows}
`;
}

it('simulate', async () => {
  const n = Number(process.env.SIM_N ?? 300);
  const seed0 = Number(process.env.SIM_SEED ?? 1000);
  const arts = await loadMapArts();
  const rules = process.env.SIM_RULES ? JSON.parse(process.env.SIM_RULES) : {};
  let md = `## ${process.env.SIM_TITLE ?? 'Simulación'}\n\n${n} partidas por emparejamiento, semillas ${seed0}..${seed0 + n - 1}, mapas rotados.\n\n`;
  for (const levels of process.env.SIM_PAIRS === 'ee' ? pairs.slice(0, 1) : pairs) {
    const t0 = Date.now();
    const results = Array.from({ length: n }, (_, i) => runMatch(seed0 + i, { levels, arts, rules, hazards: process.env.SIM_HAZARDS !== '0' }));
    const s = aggregate(results);
    md += table(`${levels[0]} vs ${levels[1]}`, s) + '\n';
    console.log(`${levels.join(' vs ')}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  console.log(md);
  if (process.env.SIM_OUT) writeFileSync(process.env.SIM_OUT, md);
}, 3_600_000);
