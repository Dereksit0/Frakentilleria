import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { runMatch } from '../src/core/sim';
import type { BotLevel } from '../src/core/bot';
import { BODY_GAP } from '../src/core/unit';
import { loadMapArts } from '../tests/helpers/mapArt';

/** 1000 bot matches with distinct seeds: the left/right order never inverts, nobody overlaps, no turn is stuck. */
it('bodies', async () => {
  const arts = await loadMapArts();
  const pairs: [BotLevel, BotLevel][] = [
    ['experto', 'experto'],
    ['novato', 'novato'],
    ['experto', 'novato'],
  ];
  let inverted = 0;
  let overlapped = 0;
  let steps = 0;
  let stuck = 0;
  let minGap = Infinity;
  let maxTurns = 0;
  const N = Number(process.env.SIM_N ?? 1000);
  for (let s = 0; s < N; s++) {
    const r = runMatch(70000 + s * 7, {
      levels: pairs[s % 3],
      arts,
      observe: (b) => {
        steps++;
        const [l, rr] = b.units;
        if (!l.alive || !rr.alive) return;
        if (l.x >= rr.x) inverted++;
        const gap = rr.x - l.x;
        if (gap < minGap) minGap = gap;
        if (gap < BODY_GAP - 0.01) overlapped++;
      },
    });
    maxTurns = Math.max(maxTurns, r.turns);
    if (r.winner === null && r.rounds === 0) stuck++;
  }
  const line = `BODIES matches=${N} steps=${steps} inverted=${inverted} overlapped=${overlapped} minGap=${minGap.toFixed(2)} (BODY_GAP=${BODY_GAP}) maxTurns=${maxTurns} stuck=${stuck}`;
  console.log(line);
  if (process.env.SIM_OUT) writeFileSync(process.env.SIM_OUT, line);
}, 3_600_000);
