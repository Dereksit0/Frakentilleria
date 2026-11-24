import { acidDamageAt, acidLevelY } from './acid';
import { aimSpread, neutralAim } from './aim';
import { GRAVITY, WIND_ACCEL, launchVelocity } from './ballistics';
import { ABILITIES, CRATES, WEAPONS, type WeaponDef } from './data';
import { calcDamage, explosionFalloff, fallDamage } from './damage';
import { Rng } from './rng';
import type { Selection } from './stats';
import type { Terrain } from './terrain';
import { TurnClock, TurnOrder, rollWind } from './turns';
import { TUNING, defaultRules, type Rules } from './tuning';
import { World, type WorldEvent } from './world';
import { BASE_WEAPON, UNIT_CENTER_OFFSET, UNIT_RADIUS, createUnit, jumpUnit, stepUnit, type Unit } from './unit';

export type DamageCause = 'weapon' | 'fall' | 'acid' | 'void' | 'puddle' | 'hazard';

export type BattleEvent =
  | { type: 'turn-start'; unit: number; round: number; wind: number }
  | { type: 'fire'; unit: number; weapon: string; x: number; y: number; angle: number }
  | { type: 'beam'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'explosion'; x: number; y: number; radius: number; crater: number; weapon: string }
  | { type: 'damage'; unit: number; amount: number; x: number; y: number; cause: DamageCause }
  | { type: 'death'; unit: number; cause: DamageCause }
  | { type: 'heal'; unit: number; amount: number }
  | { type: 'ability'; unit: number; ability: string }
  | { type: 'puddle'; x: number; y: number; radius: number; turns: number }
  | { type: 'crate-spawn'; id: number; crate: string }
  | { type: 'crate-pick'; unit: number; crate: string }
  | { type: 'land'; unit: number; distance: number }
  | { type: 'crate-outcome'; unit: number; good: boolean; what: string }
  | WorldEvent
  | { type: 'over'; winner: number | null };

export interface Projectile {
  id: number;
  weapon: string;
  owner: number;
  shot: number;
  bonus: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  resting: boolean;
  /** Seconds before this shot may use a portal again. */
  portalCd?: number;
}
export interface Puddle {
  id: number;
  x: number;
  y: number;
  radius: number;
  turns: number;
  damage: number;
  owner: number;
}
export interface Crate {
  id: number;
  type: string;
  x: number;
  y: number;
  landed: boolean;
}
export interface BattleConfig {
  seed: number;
  terrain: Terrain;
  spawns: [number, number];
  selections: [Selection, Selection];
}
export interface BattleStats {
  damage: [number, number];
  bestShot: [number, number];
}

const SUBSTEP = 1 / 120;
const CRATE_PICKUP_RADIUS = UNIT_RADIUS + 30;
const MIN_POWER = 10;
/** Gusts change in fixed steps so the result does not depend on the frame rate. */
const GUST_TICK = 1 / 60;

/** Raises a shot angle so its elevation (above the horizontal, either side) is at least `min` degrees. */
function liftAngle(angle: number, min: number): number {
  const rad = (angle * Math.PI) / 180;
  const right = Math.cos(rad) >= 0;
  const elevation = (Math.atan2(Math.sin(rad), Math.abs(Math.cos(rad))) * 180) / Math.PI;
  const e = Math.min(90, Math.max(min, elevation));
  return right ? e : 180 - e;
}

/**
 * Authoritative match simulation. No rendering and no Phaser: scenes feed it input,
 * call update(dt) every frame and draw its state + drained events.
 */
export class Battle {
  readonly terrain: Terrain;
  readonly units: Unit[];
  readonly turn: TurnOrder;
  readonly clock = new TurnClock();
  readonly stats: BattleStats = { damage: [0, 0], bestShot: [0, 0] };
  projectiles: Projectile[] = [];
  crates: Crate[] = [];
  puddles: Puddle[] = [];
  /** Obstacles, hazards and round events of the map. */
  readonly world: World;
  /** Per player: was at <= 40 % of the rival health at some turn end (feeds rewards). */
  comeback: [boolean, boolean] = [false, false];
  /** Every weapon id fired this match (feeds the achievements). */
  weaponsUsed = new Set<string>();
  /** Cause of the most recent death (null while nobody died). */
  lastDeathCause: DamageCause | null = null;
  /** Wind rolled for the turn (shown in the HUD). */
  wind = 0;
  /** Gust offset added to `wind` while a shot is in flight; back to 0 every turn. */
  gust = 0;
  rules: Rules = defaultRules();
  /** Test hook: forces the acid surface to this y. */
  acidLevelOverride: number | undefined;
  phase: 'playing' | 'over' = 'playing';
  result: { winner: number | null } | null = null;

  private readonly rng: Rng;
  /** Separate streams so aim error and gusts never shift the wind/crate sequence. */
  private readonly spreadRng: Rng;
  private readonly gustRng: Rng;
  private gustClock = 0;
  /** While true every damage instance leaves at least 1 health (environment, events). */
  private nonLethal = false;
  private events: BattleEvent[] = [];
  private movedThisFrame = new Set<number>();
  private nextId = 1;
  private shotTotals = new Map<number, number>();

  constructor(cfg: BattleConfig) {
    this.rng = new Rng(cfg.seed);
    this.spreadRng = new Rng(cfg.seed ^ 0x5bd1e995);
    this.gustRng = new Rng(cfg.seed ^ 0x27d4eb2f);
    this.terrain = cfg.terrain;
    this.units = cfg.selections.map((sel, i) => {
      const x = cfg.spawns[i];
      const y = cfg.terrain.surfaceY(x, 0) ?? cfg.terrain.height - 200;
      const u = createUnit(i, sel, x, y);
      u.facing = i === 0 ? 1 : -1;
      u.aimAngle = i === 0 ? 45 : 135;
      return u;
    });
    this.turn = new TurnOrder(this.units.length);
    this.world = new World(
      {
        terrain: this.terrain,
        units: this.units,
        round: 1,
        emit: (e) => this.events.push(e),
        blast: (x, y, id, def, owner, shot, nonLethal) => {
          const prev = this.nonLethal;
          this.nonLethal = nonLethal;
          this.explode(x, y, id, def, owner, shot, 0, def.knockback, 1);
          this.nonLethal = prev;
        },
        hurt: (u, amount, x, y, nonLethal) => {
          const prev = this.nonLethal;
          this.nonLethal = nonLethal;
          this.damage(u, amount, 'hazard', x, y, -1, 0, false);
          this.nonLethal = prev;
        },
        nextId: () => this.nextId++,
      },
      cfg.seed,
    );
    this.startTurn();
  }

  get current(): Unit {
    return this.units[this.turn.current];
  }
  /** Wind that acts on projectiles right now. */
  get windNow(): number {
    return this.wind + this.gust + this.world.windBonus;
  }
  get round(): number {
    return this.turn.round;
  }

  drainEvents(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ---------- input ----------

  setAim(angle: number, power: number): void {
    const u = this.current;
    u.aimAngle = ((angle % 360) + 360) % 360;
    u.aimPower = Math.min(100, Math.max(MIN_POWER, power));
    const c = Math.cos((u.aimAngle * Math.PI) / 180);
    if (Math.abs(c) > 0.05) u.facing = c >= 0 ? 1 : -1;
  }

  selectWeapon(id: string): boolean {
    const u = this.current;
    if (!u.weapons.includes(id) || !this.hasAmmo(u, id)) return false;
    u.weapon = id;
    return true;
  }

  hasAmmo(u: Unit, id: string): boolean {
    return u.ammo[id] === undefined || u.ammo[id] > 0;
  }

  stunned(u: Unit): boolean {
    return u.stunActive;
  }

  move(dir: -1 | 0 | 1, dt: number): void {
    const u = this.current;
    if (this.phase !== 'playing' || !u.alive) return;
    if (!u.grounded) return;
    const granted = dir === 0 ? 0 : this.clock.spendMove(dt);
    if (granted <= 0) return;
    this.movedThisFrame.add(u.index);
    const x0 = u.x;
    this.handleStep(u, stepUnit(u, this.terrain, granted, dir, this.world.gravityScale));
    if (u.grounded) u.moved += Math.abs(u.x - x0);
  }

  jump(): boolean {
    const u = this.current;
    if (this.phase !== 'playing' || !this.clock.canMove()) return false;
    return jumpUnit(u);
  }

  useAbility(): boolean {
    const u = this.current;
    if (this.phase !== 'playing' || !u.alive || !u.ability || u.abilityUsed) return false;
    if (this.clock.phase !== 'aim' || this.clock.ended) return false;
    const def = ABILITIES[u.ability];
    if (!def) return false;
    u.abilityUsed = true;
    switch (def.effect) {
      case 'shield':
        u.shield = def.value;
        break;
      case 'leap':
        u.grounded = false;
        u.vy = -def.value;
        u.vx = u.facing * 180;
        u.peakY = u.y;
        break;
      case 'moveTime':
        this.clock.addMove(def.value);
        break;
      case 'damageBoost':
        u.damageBoost += def.value;
        break;
      case 'heal':
        this.heal(u, def.value);
        break;
    }
    this.events.push({ type: 'ability', unit: u.index, ability: u.ability });
    return true;
  }

  fire(): boolean {
    const u = this.current;
    if (this.phase !== 'playing' || !u.alive) return false;
    if (!this.hasAmmo(u, u.weapon)) return false;
    if (!this.clock.fire()) return false;
    if (u.ammo[u.weapon] !== undefined) u.ammo[u.weapon]--;
    this.weaponsUsed.add(u.weapon);
    const w = WEAPONS[u.weapon];
    const bonus = (u.stats.damage - 100) / 100 + u.damageBoost;
    u.damageBoost = 0;
    const shot = this.nextId++;
    const err = this.rules.spread
      ? (this.spreadRng.next() * 2 - 1) * aimSpread(u.weapon, u.aimPower, u.moved) * this.rules.spreadScale * (u.stunActive ? TUNING.stunSpreadMult : 1)
      : 0;
    let shotAngle = u.aimAngle + err;
    if (w.minAngle !== undefined) shotAngle = liftAngle(shotAngle, w.minAngle);
    const rad = (shotAngle * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = -Math.sin(rad);
    const cx = u.x;
    const cy = u.y - UNIT_CENTER_OFFSET - 10;
    const mx = cx + dx * 40;
    const my = cy + dy * 40;
    this.events.push({ type: 'fire', unit: u.index, weapon: u.weapon, x: mx, y: my, angle: u.aimAngle });
    switch (w.kind) {
      case 'beam':
        this.fireBeam(u, w, shot, bonus, mx, my, dx, dy);
        break;
      case 'melee':
        this.meleeStrike(u, w, shotAngle, shot, bonus);
        break;
      default: {
        const v = launchVelocity(shotAngle, u.aimPower);
        this.projectiles.push({
          id: this.nextId++,
          weapon: u.weapon,
          owner: u.index,
          shot,
          bonus,
          x: mx,
          y: my,
          vx: v.vx,
          vy: v.vy,
          age: 0,
          resting: false,
        });
      }
    }
    return true;
  }

  /** Ends the current turn right now (used by tests and the "skip" safety net). */
  forceEndTurn(): void {
    this.endTurn();
  }

  // ---------- simulation ----------

  update(dt: number): void {
    if (this.phase !== 'playing') return;
    this.clock.tick(dt);

    for (const u of this.units) {
      if (!u.alive) continue;
      if (this.movedThisFrame.has(u.index)) continue;
      this.handleStep(u, stepUnit(u, this.terrain, dt, 0, this.world.gravityScale));
    }
    this.movedThisFrame.clear();

    this.world.update(dt);
    this.stepGust(dt);
    let t = dt;
    while (t > 1e-9) {
      const h = Math.min(SUBSTEP, t);
      this.stepProjectiles(h);
      t -= h;
    }
    this.stepCrates(dt);
    this.checkPickups();
    this.checkAcid();

    const settled = this.projectiles.length === 0 && this.units.every((u) => !u.alive || u.grounded);
    const someoneDown = this.units.some((u) => !u.alive);
    if (settled && (this.clock.ended || someoneDown)) this.endTurn();
  }

  private handleStep(u: Unit, r: { landed: boolean; fallDistance: number; fellOut: boolean }): void {
    if (r.landed) {
      const dmg = fallDamage(r.fallDistance, u.stats.resistance / 100);
      this.events.push({ type: 'land', unit: u.index, distance: r.fallDistance });
      if (dmg > 0) this.damage(u, dmg, 'fall', u.x, u.y - 80, -1, 0, false);
    }
    if (r.fellOut && u.alive) {
      u.hp = 0;
      u.alive = false;
      this.lastDeathCause = 'void';
      this.events.push({ type: 'death', unit: u.index, cause: 'void' });
    }
  }

  private stepProjectiles(dt: number): void {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      const w = WEAPONS[p.weapon];
      p.age += dt;
      let exploded = false;
      let gone = false;

      if (w.kind === 'grenade') {
        if (p.resting) {
          if (!this.terrain.isSolid(p.x, p.y + 6)) p.resting = false;
        } else {
          const px = p.x;
          const py = p.y;
          p.vx += (this.windNow + this.world.windAt(p.x, p.y)) * WIND_ACCEL * w.windFactor * dt;
          p.vy += GRAVITY * this.world.gravityScale * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (this.terrain.isSolid(p.x, p.y)) {
            const n = this.surfaceNormal(px, py);
            const vn = p.vx * n.x + p.vy * n.y;
            const bounce = w.bounce ?? 0.5;
            p.vx = (p.vx - 2 * vn * n.x) * bounce;
            p.vy = (p.vy - 2 * vn * n.y) * bounce;
            p.x = px;
            p.y = py;
            if (Math.hypot(p.vx, p.vy) < 60) {
              p.vx = 0;
              p.vy = 0;
              p.resting = true;
            }
          }
        }
        if (p.age >= (w.fuse ?? 2.5)) exploded = true;
      } else {
        p.vx += (this.windNow + this.world.windAt(p.x, p.y)) * WIND_ACCEL * w.windFactor * dt;
        p.vy += GRAVITY * this.world.gravityScale * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        this.world.portal(p, dt);
        if (this.terrain.isSolid(p.x, p.y) && !(w.arcOverCover && p.vy < 0)) exploded = true;
        else if (this.hitsUnit(p)) exploded = true;
      }

      if (!exploded && (p.x < 0 || p.x >= this.terrain.width || p.y >= this.terrain.height)) gone = true;
      if (exploded) this.explode(p.x, p.y, p.weapon, w, p.owner, p.shot, p.bonus, w.knockback, p.vx >= 0 ? 1 : -1, p.age < TUNING.spawnGrace.seconds);
      else if (!gone) keep.push(p);
    }
    this.projectiles = keep;
  }

  private hitsUnit(p: Projectile): boolean {
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.index === p.owner && p.age < TUNING.spawnGrace.seconds) continue;
      if (Math.hypot(u.x - p.x, u.y - UNIT_CENTER_OFFSET - p.y) < UNIT_RADIUS) return true;
    }
    return false;
  }

  private surfaceNormal(x: number, y: number): { x: number; y: number } {
    let nx = 0;
    let ny = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      if (!this.terrain.isSolid(x + dx * 6, y + dy * 6)) {
        nx += dx;
        ny += dy;
      }
    }
    const len = Math.hypot(nx, ny);
    return len < 1e-6 ? { x: 0, y: -1 } : { x: nx / len, y: ny / len };
  }

  private fireBeam(u: Unit, w: WeaponDef, shot: number, bonus: number, mx: number, my: number, dx: number, dy: number): void {
    const range = w.range ?? 700;
    let x = mx;
    let y = my;
    for (let d = 0; d < range; d += 4) {
      x = mx + dx * d;
      y = my + dy * d;
      const target = this.units.find(
        (t) => t.alive && t.index !== u.index && Math.hypot(t.x - x, t.y - UNIT_CENTER_OFFSET - y) < UNIT_RADIUS,
      );
      if (target) {
        const amount = calcDamage(w.damage * this.rules.damageScale * this.world.damageScale, bonus, target.stats.resistance / 100);
        this.damage(target, amount, 'weapon', x, y, u.index, shot, true);
        if (w.chain) this.chainFrom(u, target, w, shot, bonus, amount);
        break;
      }
      if (this.terrain.isSolid(x, y)) {
        this.events.push({ type: 'explosion', x, y, radius: w.radius, crater: w.crater, weapon: 'tesla' });
        this.terrain.carveCircle(x, y, w.crater);
        break;
      }
      if (x < 0 || x >= this.terrain.width || y >= this.terrain.height) break;
    }
    this.events.push({ type: 'beam', x1: mx, y1: my, x2: x, y2: y });
  }

  /** Tesla jump: arcs to the nearest other creatures around the one that was hit, for less each time. */
  private chainFrom(owner: Unit, first: Unit, w: WeaponDef, shot: number, bonus: number, firstAmount: number): void {
    const chain = w.chain;
    if (!chain) return;
    const hit = new Set<number>([owner.index, first.index]);
    let from = first;
    let amount = firstAmount;
    for (let j = 0; j < chain.jumps; j++) {
      let best: Unit | undefined;
      let bestD = chain.radius;
      for (const t of this.units) {
        if (!t.alive || hit.has(t.index)) continue;
        const d = Math.hypot(t.x - from.x, t.y - from.y);
        if (d <= bestD) {
          best = t;
          bestD = d;
        }
      }
      if (!best) return;
      amount = Math.max(1, Math.round(amount * chain.falloff));
      hit.add(best.index);
      this.events.push({ type: 'beam', x1: from.x, y1: from.y - UNIT_CENTER_OFFSET, x2: best.x, y2: best.y - UNIT_CENTER_OFFSET });
      this.damage(best, amount, 'weapon', best.x, best.y - UNIT_CENTER_OFFSET, owner.index, shot, true);
      from = best;
    }
    void bonus;
  }

  private explode(
    x: number,
    y: number,
    weaponId: string,
    w: WeaponDef,
    owner: number,
    shot: number,
    bonus: number,
    knockback = 300,
    pushDir: 1 | -1 = 1,
    spawning = false,
  ): void {
    this.explodeCore(x, y, weaponId, w, owner, shot, bonus, knockback, pushDir, spawning);
    this.world.onBlast(x, y, w.radius, owner, shot, w.crater);
  }

  private explodeCore(
    x: number,
    y: number,
    weaponId: string,
    w: WeaponDef,
    owner: number,
    shot: number,
    bonus: number,
    knockback = 300,
    pushDir: 1 | -1 = 1,
    spawning = false,
  ): void {
    this.events.push({ type: 'explosion', x, y, radius: w.radius, crater: w.crater, weapon: weaponId });
    this.terrain.carveCircle(x, y, w.crater);
    if (w.puddle) {
      const p: Puddle = { id: this.nextId++, x, y: this.terrain.surfaceY(x, y - 4) ?? y, ...w.puddle, owner };
      this.puddles.push(p);
      this.events.push({ type: 'puddle', x: p.x, y: p.y, radius: p.radius, turns: p.turns });
    }
    for (const u of this.units) {
      if (!u.alive) continue;
      // A shot that blows up right after leaving the barrel never hurts (or shoves) its owner.
      if (spawning && u.index === owner) continue;
      const cx = u.x;
      const cy = u.y - UNIT_CENTER_OFFSET;
      const dist = Math.hypot(cx - x, cy - y);
      let f = explosionFalloff(dist, w.radius + UNIT_RADIUS * 0.5);
      if (f <= 0) continue;
      if (this.rules.coverFactor < 1 && this.covered(x, y, cx, cy)) f *= this.rules.coverFactor;
      const amount = calcDamage(w.damage * f * this.rules.damageScale * this.world.damageScale, bonus, u.stats.resistance / 100);
      this.damage(u, amount, 'weapon', cx, cy - 30, owner, shot, u.index !== owner);
      if (u.alive) {
        // Push away from the blast; a blast right on top still shoves along the shot direction.
        let nx = dist < 1 ? 0 : (cx - x) / dist;
        let ny = dist < 1 ? -1 : (cy - y) / dist;
        const minH = TUNING.knockback.minHorizontal;
        if (Math.abs(nx) < minH) {
          nx = pushDir * minH;
          ny = -Math.sqrt(1 - minH * minH);
        }
        const kb = knockback * this.rules.knockbackScale;
        u.vx += nx * kb * f;
        u.vy += (ny * kb - 140) * f;
        u.grounded = false;
        u.launched = true;
        u.peakY = u.y;
        if (w.freezeTurns && u.index !== owner) u.frozenTurns += w.freezeTurns;
        if (w.stunTurns && u.index !== owner) u.stunTurns += w.stunTurns;
      }
    }
  }

  /**
   * Mace swing: a sector in front of the attacker (centred on the aim angle, half-angle `arc`, reach `range` plus half a body).
   * The attacker is excluded by id; targets are shoved away from the attacker, never towards.
   */
  private meleeStrike(u: Unit, w: WeaponDef, angle: number, shot: number, bonus: number): void {
    const rad = (angle * Math.PI) / 180;
    const ax = Math.cos(rad);
    const ay = -Math.sin(rad);
    const reach = (w.range ?? 120) + UNIT_RADIUS * 0.5;
    const half = ((w.arc ?? 55) * Math.PI) / 180;
    const cx = u.x;
    const cy = u.y - UNIT_CENTER_OFFSET;
    const side: 1 | -1 = ax >= 0 ? 1 : -1;
    // visual + terrain: the swing lands where the mace head would be
    const hx = cx + ax * reach * 0.6;
    const hy = u.y - 20 + ay * reach * 0.6;
    this.events.push({ type: 'explosion', x: hx, y: hy, radius: w.radius, crater: w.crater, weapon: 'mazo' });
    this.terrain.carveCircle(hx, hy, w.crater);
    this.world.onBlast(hx, hy, w.radius, u.index, shot, w.crater);
    for (const t of this.units) {
      if (!t.alive || t.index === u.index) continue;
      const tx = t.x - cx;
      const ty = t.y - UNIT_CENTER_OFFSET - cy;
      const dist = Math.hypot(tx, ty);
      if (dist > reach) continue;
      const diff = dist < 1 ? 0 : Math.acos(Math.max(-1, Math.min(1, (tx * ax + ty * ay) / dist)));
      if (diff > half) continue;
      const amount = calcDamage(w.damage * this.rules.damageScale * this.world.damageScale, bonus, t.stats.resistance / 100);
      this.damage(t, amount, 'weapon', t.x, t.y - UNIT_CENTER_OFFSET - 30, u.index, shot, true);
      if (!t.alive) continue;
      // away from the attacker
      let nx = dist < 1 ? side : tx / dist;
      let ny = dist < 1 ? -1 : ty / dist;
      const minH = TUNING.knockback.minHorizontal;
      if (Math.abs(nx) < minH) {
        nx = side * minH;
        ny = -Math.sqrt(1 - minH * minH);
      }
      const kb = (w.knockback ?? 300) * this.rules.knockbackScale;
      t.vx += nx * kb;
      t.vy += ny * kb - 140;
      t.grounded = false;
      t.launched = true;
      t.peakY = t.y;
      if (w.stunTurns) t.stunTurns += w.stunTurns;
    }
  }

  /** Applies final damage (after resistance); shield halves further. `credit` = enemy hit counts for stats. */
  private damage(u: Unit, raw: number, cause: DamageCause, x: number, y: number, owner: number, shot: number, credit: boolean): void {
    let amount = Math.round(raw * (1 - u.shield));
    if (this.nonLethal) amount = Math.min(amount, u.hp - 1);
    if (amount <= 0) return;
    u.hp = Math.max(0, u.hp - amount);
    this.events.push({ type: 'damage', unit: u.index, amount, x, y, cause });
    if (credit && owner >= 0 && owner !== u.index) {
      this.stats.damage[owner as 0 | 1] += amount;
      const total = (this.shotTotals.get(shot) ?? 0) + amount;
      this.shotTotals.set(shot, total);
      this.stats.bestShot[owner as 0 | 1] = Math.max(this.stats.bestShot[owner as 0 | 1], total);
    }
    if (u.hp <= 0 && u.alive) {
      u.alive = false;
      this.lastDeathCause = cause;
      this.events.push({ type: 'death', unit: u.index, cause });
    }
  }

  /** True when solid terrain lies between the blast centre and the creature's centre (cover). */
  private covered(x: number, y: number, cx: number, cy: number): boolean {
    const dist = Math.hypot(cx - x, cy - y);
    for (let d = 8; d < dist - 4; d += 4) {
      const t = d / dist;
      if (this.terrain.isSolid(x + (cx - x) * t, y + (cy - y) * t)) return true;
    }
    return false;
  }

  private stepGust(dt: number): void {
    if (!this.rules.gusts || this.projectiles.length === 0) return;
    this.gustClock += dt;
    while (this.gustClock >= GUST_TICK) {
      this.gustClock -= GUST_TICK;
      const g = this.gust + (this.gustRng.next() * 2 - 1) * TUNING.wind.gustStep;
      this.gust = Math.max(-TUNING.wind.gustMax, Math.min(TUNING.wind.gustMax, g));
    }
  }

  /** Burns everyone standing in a puddle; each puddle loses a turn and dries up at zero. */
  private tickPuddles(): void {
    for (const p of this.puddles) {
      for (const u of this.units) {
        if (!u.alive) continue;
        if (Math.abs(u.x - p.x) <= p.radius && Math.abs(u.y - p.y) <= p.radius) {
          this.damage(u, p.damage, 'puddle', u.x, u.y - 100, p.owner, 0, u.index !== p.owner);
        }
      }
      p.turns--;
    }
    this.puddles = this.puddles.filter((p) => p.turns > 0);
  }

  private trackComeback(): void {
    const [a, b2] = this.units;
    if (!a.alive || !b2.alive) return;
    if (a.hp <= b2.hp * 0.4) this.comeback[0] = true;
    if (b2.hp <= a.hp * 0.4) this.comeback[1] = true;
  }

  private acidLevel(): number {
    return this.acidLevelOverride ?? acidLevelY(this.turn.round, this.terrain.height);
  }

  /** Touching the acid is fatal (rules.acidKills) regardless of health, shield or resistance. */
  private checkAcid(): void {
    if (!this.rules.acidKills) return;
    const level = this.acidLevel();
    if (level >= this.terrain.height) return;
    if (this.units.filter((u) => u.alive).length <= 1) return; // the last one standing has already won
    const inAcid = this.units.filter((u) => u.alive && u.y >= level);
    // If the acid reaches everyone at once, only the weakest dissolves: a tie goes to the healthier creature.
    const victims =
      inAcid.length > 0 && inAcid.length === this.units.filter((u) => u.alive).length && inAcid.length > 1
        ? this.weakest(inAcid)
        : inAcid;
    for (const u of victims) {
      u.hp = 0;
      u.alive = false;
      this.lastDeathCause = 'acid';
      this.events.push({ type: 'death', unit: u.index, cause: 'acid' });
    }
  }

  /** The single creature with the least health, or all of them when tied (a mutual draw). */
  private weakest(us: Unit[]): Unit[] {
    const min = Math.min(...us.map((u) => u.hp));
    const lows = us.filter((u) => u.hp === min);
    return lows.length === 1 ? lows : us;
  }

  private heal(u: Unit, amount: number): void {
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amount);
    if (u.hp > before) this.events.push({ type: 'heal', unit: u.index, amount: u.hp - before });
  }

  // ---------- crates ----------

  /** Drops a crate by parachute; favours the creature that is behind when the gap is big enough. */
  spawnCrate(): void {
    const types = Object.keys(CRATES.types);
    const cu = CRATES.catchUp;
    const [a, b2] = this.units;
    const ra = a.hp / a.maxHp;
    const rb = b2.hp / b2.maxHp;
    const loser = ra < rb ? a : b2;
    const behind = this.rules.catchUp && a.alive && b2.alive && Math.abs(ra - rb) >= cu.gap;
    const aim = behind && this.rng.next() < cu.pull;
    const type = this.rng.weighted(
      types,
      types.map((t) => CRATES.types[t].weight * (behind && cu.favored.includes(t) ? cu.favoredBoost : 1)),
    );
    for (let i = 0; i < 30; i++) {
      const x = aim
        ? Math.min(this.terrain.width - 100, Math.max(100, loser.x + this.rng.int(-cu.spread, cu.spread)))
        : this.rng.int(100, this.terrain.width - 100);
      if (this.terrain.surfaceY(x, 0) === null) continue;
      const crate: Crate = { id: this.nextId++, type, x, y: -50, landed: false };
      this.crates.push(crate);
      this.events.push({ type: 'crate-spawn', id: crate.id, crate: type });
      return;
    }
  }

  private stepCrates(dt: number): void {
    for (const c of this.crates) {
      if (c.landed) {
        if (!this.terrain.isSolid(c.x, c.y)) c.landed = false;
        else continue;
      }
      const ny = c.y + CRATES.fallSpeed * dt;
      const gy = this.terrain.surfaceY(c.x, Math.max(0, c.y));
      if (gy !== null && gy <= ny) {
        c.y = gy;
        c.landed = true;
      } else {
        c.y = ny;
      }
    }
    this.crates = this.crates.filter((c) => c.y < this.terrain.height + 50);
  }

  private checkPickups(): void {
    for (const c of [...this.crates]) {
      const u = this.units.find(
        (x) => x.alive && Math.hypot(x.x - c.x, x.y - UNIT_CENTER_OFFSET - c.y) < CRATE_PICKUP_RADIUS,
      );
      if (!u) continue;
      const def = CRATES.types[c.type];
      switch (def.effect) {
        case 'heal':
          this.heal(u, def.value);
          break;
        case 'shield':
          u.shield = def.value;
          break;
        case 'moveTime':
          if (u.index === this.current.index && this.clock.phase === 'aim') this.clock.addMove(def.value);
          else u.moveBonus += def.value;
          break;
        case 'damageBoost':
          u.damageBoost += def.value;
          break;
        case 'mystery': {
          const m = CRATES.mystery;
          const good = this.rng.next() < m.goodChance;
          let what: string;
          if (good) {
            const pick = this.rng.int(0, 2);
            what = ['heal', 'shield', 'damageBoost'][pick];
            if (pick === 0) this.heal(u, m.heal);
            else if (pick === 1) u.shield = m.shield;
            else u.damageBoost += m.boost;
          } else {
            what = 'trap';
            const prev = this.nonLethal;
            this.nonLethal = true;
            this.damage(u, m.trapDamage, 'hazard', u.x, u.y - 100, -1, 0, false);
            this.nonLethal = prev;
          }
          this.events.push({ type: 'crate-outcome', unit: u.index, good, what });
          break;
        }
        case 'mimic': {
          // The crate was alive: it bites. Never lethal, and the blast also knocks the picker back.
          const prev = this.nonLethal;
          this.nonLethal = true;
          const mimic: WeaponDef = { name: 'Caja imitadora', kind: 'projectile', icon: 'wicon_cannon', damage: def.value, radius: 80, crater: 25, windFactor: 0, knockback: 260 };
          this.crates = this.crates.filter((x) => x !== c);
          this.events.push({ type: 'crate-pick', unit: u.index, crate: c.type });
          this.explode(c.x, c.y - 30, 'imitadora', mimic, -1, 0, 0, mimic.knockback, 1);
          this.nonLethal = prev;
          continue;
        }
        case 'ammo': {
          const limited = Object.keys(u.ammo).sort((a, b) => u.ammo[a] - u.ammo[b]);
          if (limited.length > 0) u.ammo[limited[0]] = Math.min(u.ammo[limited[0]] + def.value, (WEAPONS[limited[0]].ammo ?? 1) * 2);
          break;
        }
      }
      this.crates = this.crates.filter((x) => x !== c);
      this.events.push({ type: 'crate-pick', unit: u.index, crate: c.type });
    }
  }

  // ---------- turns ----------

  private endTurn(): void {
    this.trackComeback();
    this.tickPuddles();
    this.checkAcid();
    for (const u of this.units) {
      if (!u.alive || this.rules.acidKills) continue;
      const dmg = acidDamageAt(u.y, this.turn.round, this.terrain.height);
      if (dmg > 0) {
        const shield = u.shield;
        u.shield = 0; // acid ignores shields
        this.damage(u, dmg, 'acid', u.x, u.y - 100, -1, 0, false);
        u.shield = shield;
      }
    }
    const alive = this.units.filter((u) => u.alive);
    if (alive.length <= 1) {
      this.phase = 'over';
      this.result = { winner: alive.length === 1 ? alive[0].index : null };
      this.events.push({ type: 'over', winner: this.result.winner });
      return;
    }
    this.turn.advance((i) => this.units[i].alive);
    this.startTurn();
  }

  private startTurn(): void {
    const u = this.current;
    this.world.setEvents(this.rules.events);
    this.world.onRound(this.turn.round);
    u.sprung = false;
    this.wind = rollWind(this.rng);
    this.gust = 0;
    this.gustClock = 0;
    u.moved = 0;
    u.stunActive = u.stunTurns > 0;
    if (u.stunActive) u.stunTurns--;
    if (!this.hasAmmo(u, u.weapon)) u.weapon = BASE_WEAPON;
    const foe = this.units.find((x) => x.index !== u.index && x.alive);
    const neutral = neutralAim(foe && foe.x < u.x ? -1 : 1);
    u.aimAngle = neutral.angle;
    u.aimPower = neutral.power;
    u.facing = Math.cos((neutral.angle * Math.PI) / 180) >= 0 ? 1 : -1;
    u.shield = 0;
    const frozen = u.frozenTurns > 0;
    if (frozen) u.frozenTurns--;
    this.clock.reset(u.moveBonus, frozen);
    u.moveBonus = 0;
    if (this.turn.turnNumber % CRATES.everyTurns === 0) this.spawnCrate();
    this.events.push({ type: 'turn-start', unit: u.index, round: this.turn.round, wind: this.wind });
  }
}
