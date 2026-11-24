import { Battle } from './battle';
import { planShot, type BotLevel } from './bot';
import { MAPS, WORLD } from './data';
import { buildTerrain } from './maps';
import { Rng } from './rng';
import { WALK_SPEED } from './unit';
import type { Rules } from './tuning';
import { randomSelection } from './stats';

export interface WeaponTally {
  damage: number;
  picks: number;
  hits: number;
}
export interface MatchResult {
  seed: number;
  map: string;
  winner: number | null;
  rounds: number;
  turns: number;
  /** Turns in which a weapon was actually fired. */
  shots: number;
  /** Shots that damaged the enemy. */
  hitShots: number;
  /** Player who first damaged the enemy, or null if nobody did. */
  firstBlow: 0 | 1 | null;
  /** True when the winner was at some point at <= 40 % of the rival's health. */
  comeback: boolean;
  /** True when somebody was ever at <= 40 % of the rival's health. */
  hadUnderdog: boolean;
  damage: [number, number];
  byWeapon: Record<string, WeaponTally>;
}
export interface SimOptions {
  levels: readonly [BotLevel, BotLevel];
  /** Fixed map id; default rotates through MAPS by seed. */
  mapId?: string;
  maxSeconds?: number;
  /** Rule overrides for balance sweeps. */
  rules?: Partial<Rules>;
  /** false = play without the map's obstacles and hazards (balance comparisons). */
  hazards?: boolean;
  /** Decoded alpha plane per image-terrain map id (the caller decodes the PNGs). */
  arts?: Record<string, { alpha: Uint8Array; w: number; h: number }>;
}

const DT = 1 / 30;
const COMEBACK_RATIO = 0.4;
const WALK_BURST = 1.2;

/** Plays one full match between two bots. Deterministic for (seed, options). */
export function runMatch(seed: number, opts: SimOptions): MatchResult {
  const rng = new Rng(seed);
  const botRng = new Rng(seed ^ 0x9e3779b9);
  const map = (opts.mapId ? MAPS.find((m) => m.id === opts.mapId) : undefined) ?? MAPS[seed % MAPS.length];
  const terrain = buildTerrain(map, WORLD, opts.arts?.[map.id]);
  if (opts.hazards === false) terrain.hazards = [];
  const b = new Battle({
    seed,
    terrain,
    spawns: map.spawns,
    selections: [randomSelection(rng), randomSelection(rng)],
  });
  Object.assign(b.rules, opts.rules);
  const res: MatchResult = {
    seed,
    map: map.id,
    winner: null,
    rounds: 0,
    turns: 0,
    shots: 0,
    hitShots: 0,
    firstBlow: null,
    comeback: false,
    hadUnderdog: false,
    damage: [0, 0],
    byWeapon: {},
  };
  const underdog = [false, false];
  const last: [string | undefined, string | undefined] = [undefined, undefined];
  const limit = opts.maxSeconds ?? 3000;
  const check = (): void => {
    for (const i of [0, 1] as const) {
      const me = b.units[i];
      const foe = b.units[1 - i];
      if (me.alive && foe.alive && me.hp <= foe.hp * COMEBACK_RATIO) underdog[i] = true;
    }
  };
  const tick = (): void => {
    b.update(DT);
    t += DT;
  };

  let t = 0;
  let lastTurn = -1;
  let fired = false;
  let snap: [number, number] = [0, 0];
  let weapon = '';
  let walked = 0;
  while (b.phase === 'playing' && t < limit) {
    if (b.turn.turnNumber !== lastTurn) {
      lastTurn = b.turn.turnNumber;
      res.turns++;
      fired = false;
      walked = 0;
      check();
    }
    const u = b.current;
    if (!fired && b.clock.phase === 'aim') {
      if (opts.levels[u.index] === 'experto') {
        // Fetch a crate that is within walking reach before shooting.
        const reach = b.clock.moveLeft * WALK_SPEED * (u.stats.mobility / 100);
        const crate = b.crates
          .filter((c) => c.landed && Math.abs(c.x - u.x) <= reach)
          .sort((p, q) => Math.abs(p.x - u.x) - Math.abs(q.x - u.x))[0];
        for (let s = 0; crate && s < 600 && b.clock.canMove() && Math.abs(crate.x - u.x) > 20 && b.crates.includes(crate); s++) {
          b.move(crate.x > u.x ? 1 : -1, DT);
          tick();
        }
      }
      let plan = planShot(b, botRng, opts.levels[u.index], last[u.index]);
      // Reposition a couple of short bursts when nothing reaches from here.
      while (plan.walk !== 0 && walked < 2 && b.phase === 'playing') {
        walked++;
        for (let s = 0; s < WALK_BURST / DT && b.clock.canMove(); s++) {
          b.move(plan.walk, DT);
          tick();
        }
        plan = planShot(b, botRng, opts.levels[u.index], last[u.index]);
      }
      b.selectWeapon(plan.weapon);
      b.setAim(plan.angle, plan.power);
      weapon = plan.weapon;
      last[u.index] = weapon;
      fired = b.fire();
      if (fired) {
        res.shots++;
        (res.byWeapon[weapon] ??= { damage: 0, picks: 0, hits: 0 }).picks++;
      }
    }
    const turnBefore = b.turn.turnNumber;
    tick();
    // The turn that just ended: attribute enemy damage dealt during it to the weapon fired.
    if (b.turn.turnNumber !== turnBefore || b.phase !== 'playing') {
      const owner = (turnBefore - 1) % 2;
      const dealt = b.stats.damage[owner] - snap[owner];
      if (fired && dealt > 0) {
        res.hitShots++;
        const tally = (res.byWeapon[weapon] ??= { damage: 0, picks: 0, hits: 0 });
        tally.damage += dealt;
        tally.hits++;
      }
      if (dealt > 0 && res.firstBlow === null) res.firstBlow = owner as 0 | 1;
      // Damage the other player dealt outside their own turn can only be a lingering puddle.
      const other = 1 - owner;
      const lingering = b.stats.damage[other] - snap[other];
      if (lingering > 0) {
        (res.byWeapon.pocion ??= { damage: 0, picks: 0, hits: 0 }).damage += lingering;
        if (res.firstBlow === null) res.firstBlow = other as 0 | 1;
      }
      snap = [b.stats.damage[0], b.stats.damage[1]];
      check();
    }
  }
  res.winner = b.result?.winner ?? null;
  res.rounds = b.round;
  res.damage = [b.stats.damage[0], b.stats.damage[1]];
  res.hadUnderdog = underdog[0] || underdog[1];
  res.comeback = res.winner !== null && underdog[res.winner];
  return res;
}

export interface Summary {
  matches: number;
  /** Win rate (0..100) of whoever dealt the first damage, over matches that had a first blow and a winner. */
  firstBlowWinPct: number;
  drawPct: number;
  avgRounds: number;
  avgTurns: number;
  avgDamagePerTurn: number;
  /** Percentage of fired shots that damaged the enemy. */
  hitTurnPct: number;
  /** Matches won by someone who was at <= 40 % of the rival's health at some point (of all matches). */
  comebackPct: number;
  weapons: Record<string, { damageShare: number; pickShare: number; hitPct: number }>;
}

export function aggregate(results: MatchResult[]): Summary {
  const n = results.length;
  const decided = results.filter((r) => r.winner !== null && r.firstBlow !== null);
  const firstWins = decided.filter((r) => r.winner === r.firstBlow).length;
  const totalDamage = results.reduce((a, r) => a + r.damage[0] + r.damage[1], 0);
  const shots = results.reduce((a, r) => a + r.shots, 0);
  const turns = results.reduce((a, r) => a + r.turns, 0);
  const tally: Record<string, WeaponTally> = {};
  for (const r of results)
    for (const [id, w] of Object.entries(r.byWeapon)) {
      const t = (tally[id] ??= { damage: 0, picks: 0, hits: 0 });
      t.damage += w.damage;
      t.picks += w.picks;
      t.hits += w.hits;
    }
  const weapons: Summary['weapons'] = {};
  const dmgSum = Object.values(tally).reduce((a, w) => a + w.damage, 0);
  for (const [id, w] of Object.entries(tally))
    weapons[id] = {
      damageShare: dmgSum > 0 ? w.damage / dmgSum : 0,
      pickShare: shots > 0 ? w.picks / shots : 0,
      hitPct: w.picks > 0 ? (100 * w.hits) / w.picks : 0,
    };
  return {
    matches: n,
    firstBlowWinPct: decided.length > 0 ? (100 * firstWins) / decided.length : 0,
    drawPct: (100 * results.filter((r) => r.winner === null).length) / n,
    avgRounds: results.reduce((a, r) => a + r.rounds, 0) / n,
    avgTurns: turns / n,
    avgDamagePerTurn: turns > 0 ? totalDamage / turns : 0,
    hitTurnPct: shots > 0 ? (100 * results.reduce((a, r) => a + r.hitShots, 0)) / shots : 0,
    comebackPct: (100 * results.filter((r) => r.comeback).length) / n,
    weapons,
  };
}
