import { acidDamageAt } from './acid';
import { GRAVITY, WIND_ACCEL, launchVelocity } from './ballistics';
import { ABILITIES, CRATES, WEAPONS, type WeaponDef } from './data';
import { calcDamage, explosionFalloff, fallDamage } from './damage';
import { Rng } from './rng';
import type { Selection } from './stats';
import type { Terrain } from './terrain';
import { TurnClock, TurnOrder, rollWind } from './turns';
import { UNIT_CENTER_OFFSET, UNIT_RADIUS, createUnit, jumpUnit, stepUnit, type Unit } from './unit';

export type DamageCause = 'weapon' | 'fall' | 'acid' | 'void';

export type BattleEvent =
  | { type: 'turn-start'; unit: number; round: number; wind: number }
  | { type: 'fire'; unit: number; weapon: string; x: number; y: number; angle: number }
  | { type: 'beam'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'explosion'; x: number; y: number; radius: number; crater: number; weapon: string }
  | { type: 'damage'; unit: number; amount: number; x: number; y: number; cause: DamageCause }
  | { type: 'death'; unit: number; cause: DamageCause }
  | { type: 'heal'; unit: number; amount: number }
  | { type: 'ability'; unit: number; ability: string }
  | { type: 'crate-spawn'; id: number; crate: string }
  | { type: 'crate-pick'; unit: number; crate: string }
  | { type: 'land'; unit: number; distance: number }
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
const CRATE_FALL_SPEED = 400;
const CRATE_PICKUP_RADIUS = UNIT_RADIUS + 30;
const MIN_POWER = 10;

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
  wind = 0;
  phase: 'playing' | 'over' = 'playing';
  result: { winner: number | null } | null = null;

  private readonly rng: Rng;
  private events: BattleEvent[] = [];
  private movedThisFrame = new Set<number>();
  private nextId = 1;
  private shotTotals = new Map<number, number>();

  constructor(cfg: BattleConfig) {
    this.rng = new Rng(cfg.seed);
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
    this.startTurn();
  }

  get current(): Unit {
    return this.units[this.turn.current];
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
    if (!u.weapons.includes(id)) return false;
    u.weapon = id;
    return true;
  }

  move(dir: -1 | 0 | 1, dt: number): void {
    const u = this.current;
    if (this.phase !== 'playing' || !u.alive) return;
    if (!u.grounded) return;
    const granted = dir === 0 ? 0 : this.clock.spendMove(dt);
    if (granted <= 0) return;
    this.movedThisFrame.add(u.index);
    this.handleStep(u, stepUnit(u, this.terrain, granted, dir));
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
    if (!this.clock.fire()) return false;
    const w = WEAPONS[u.weapon];
    const bonus = (u.stats.damage - 100) / 100 + u.damageBoost;
    u.damageBoost = 0;
    const shot = this.nextId++;
    const rad = (u.aimAngle * Math.PI) / 180;
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
        this.explode(u.x + (dx >= 0 ? 1 : -1) * 70, u.y - 20, u.weapon, w, u.index, shot, bonus, w.knockback);
        break;
      default: {
        const v = launchVelocity(u.aimAngle, u.aimPower);
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
      this.handleStep(u, stepUnit(u, this.terrain, dt, 0));
    }
    this.movedThisFrame.clear();

    let t = dt;
    while (t > 1e-9) {
      const h = Math.min(SUBSTEP, t);
      this.stepProjectiles(h);
      t -= h;
    }
    this.stepCrates(dt);
    this.checkPickups();

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
          p.vx += this.wind * WIND_ACCEL * w.windFactor * dt;
          p.vy += GRAVITY * dt;
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
        p.vx += this.wind * WIND_ACCEL * w.windFactor * dt;
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (this.terrain.isSolid(p.x, p.y)) exploded = true;
        else if (this.hitsUnit(p)) exploded = true;
      }

      if (!exploded && (p.x < 0 || p.x >= this.terrain.width || p.y >= this.terrain.height)) gone = true;
      if (exploded) this.explode(p.x, p.y, p.weapon, w, p.owner, p.shot, p.bonus, w.knockback);
      else if (!gone) keep.push(p);
    }
    this.projectiles = keep;
  }

  private hitsUnit(p: Projectile): boolean {
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.index === p.owner && p.age < 0.4) continue;
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
        const amount = calcDamage(w.damage, bonus, target.stats.resistance / 100);
        this.damage(target, amount, 'weapon', x, y, u.index, shot, true);
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

  private explode(
    x: number,
    y: number,
    weaponId: string,
    w: WeaponDef,
    owner: number,
    shot: number,
    bonus: number,
    knockback = 300,
  ): void {
    this.events.push({ type: 'explosion', x, y, radius: w.radius, crater: w.crater, weapon: weaponId });
    this.terrain.carveCircle(x, y, w.crater);
    for (const u of this.units) {
      if (!u.alive) continue;
      const cx = u.x;
      const cy = u.y - UNIT_CENTER_OFFSET;
      const dist = Math.hypot(cx - x, cy - y);
      const f = explosionFalloff(dist, w.radius + UNIT_RADIUS * 0.5);
      if (f <= 0) continue;
      const amount = calcDamage(w.damage * f, bonus, u.stats.resistance / 100);
      this.damage(u, amount, 'weapon', cx, cy - 30, owner, shot, u.index !== owner);
      if (u.alive) {
        const len = dist < 1 ? 1 : dist;
        const nx = dist < 1 ? 0 : (cx - x) / len;
        const ny = dist < 1 ? -1 : (cy - y) / len;
        u.vx += nx * knockback * f;
        u.vy += (ny * knockback - 140) * f;
        u.grounded = false;
        u.peakY = u.y;
        if (w.freezeTurns) u.frozenTurns += w.freezeTurns;
      }
    }
  }

  /** Applies final damage (after resistance); shield halves further. `credit` = enemy hit counts for stats. */
  private damage(u: Unit, raw: number, cause: DamageCause, x: number, y: number, owner: number, shot: number, credit: boolean): void {
    const amount = Math.round(raw * (1 - u.shield));
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
      this.events.push({ type: 'death', unit: u.index, cause });
    }
  }

  private heal(u: Unit, amount: number): void {
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amount);
    if (u.hp > before) this.events.push({ type: 'heal', unit: u.index, amount: u.hp - before });
  }

  // ---------- crates ----------

  private spawnCrate(): void {
    const types = Object.keys(CRATES.types);
    const type = this.rng.weighted(
      types,
      types.map((t) => CRATES.types[t].weight),
    );
    for (let i = 0; i < 30; i++) {
      const x = this.rng.int(100, this.terrain.width - 100);
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
      const ny = c.y + CRATE_FALL_SPEED * dt;
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
      }
      this.crates = this.crates.filter((x) => x !== c);
      this.events.push({ type: 'crate-pick', unit: u.index, crate: c.type });
    }
  }

  // ---------- turns ----------

  private endTurn(): void {
    for (const u of this.units) {
      if (!u.alive) continue;
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
    this.wind = rollWind(this.rng);
    u.shield = 0;
    const frozen = u.frozenTurns > 0;
    if (frozen) u.frozenTurns--;
    this.clock.reset(u.moveBonus, frozen);
    u.moveBonus = 0;
    if (this.turn.turnNumber % CRATES.everyTurns === 0) this.spawnCrate();
    this.events.push({ type: 'turn-start', unit: u.index, round: this.turn.round, wind: this.wind });
  }
}
