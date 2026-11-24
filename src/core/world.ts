import { EVENTS } from './data';
import type { WeaponDef } from './data';
import type { Projectile } from './battle';
import { Rng } from './rng';
import { TUNING } from './tuning';
import type { Terrain } from './terrain';
import type { Unit } from './unit';

/**
 * Mapas vivos: obstáculos interactivos, peligros por tema y eventos de ronda, todo por datos (`hazards` de maps.json
 * y events.json). Reglas puras, sin dibujar. Todo lo programado se anuncia una ronda antes.
 */

export type HazardDef =
  | { type: 'wall'; x: number; w: number; h: number }
  | { type: 'bridge'; x: number; w: number; y: number }
  | { type: 'barrel'; x: number }
  | { type: 'portal'; a: { x: number; y: number }; b: { x: number; y: number }; radius: number }
  | { type: 'spring'; x: number; w: number; power: number }
  | { type: 'scrap'; x: number; w: number; h: number }
  | { type: 'crane'; everyRounds: number }
  | { type: 'zombie'; everyRounds: number; radius: number }
  | { type: 'tombstone'; everyRounds: number; damage: number }
  | { type: 'fog' }
  | { type: 'conveyor'; x: number; w: number; speed: number }
  | { type: 'ball'; everyRounds: number; speed: number; damage: number }
  | { type: 'fan'; x: number; w: number; y0: number; y1: number; wind: number };

export type WorldEvent =
  | { type: 'hazard-warn'; kind: string; round: number; x: number }
  | { type: 'hazard-fire'; kind: string; round: number; x: number }
  | { type: 'event-warn'; id: string; round: number; xs: number[] }
  | { type: 'event-start'; id: string; round: number }
  | { type: 'event-end'; id: string }
  | { type: 'lightning'; x: number; y: number };

export interface BarrelState {
  id: number;
  x: number;
  y: number;
  alive: boolean;
}
interface Scheduled {
  kind: 'crane' | 'zombie' | 'tombstone' | 'ball';
  round: number;
  x: number;
  dir: 1 | -1;
  def: HazardDef;
}
interface Ball {
  x: number;
  y: number;
  dir: 1 | -1;
  speed: number;
  damage: number;
  hit: Set<number>;
}
interface EventPlan {
  id: string;
  round: number;
  xs: number[];
}

/** Lo que el mundo necesita de la partida. */
export interface WorldHost {
  terrain: Terrain;
  units: Unit[];
  round: number;
  emit(e: WorldEvent): void;
  /** Explosión con las reglas normales (cráter, daño, empuje y reacciones en cadena). */
  blast(
    x: number,
    y: number,
    id: string,
    def: WeaponDef,
    owner: number,
    shot: number,
    nonLethal: boolean,
  ): void;
  /** Daño del entorno; no mata si `nonLethal`. */
  hurt(u: Unit, amount: number, x: number, y: number, nonLethal: boolean): void;
  nextId(): number;
}

const BARREL_WEAPON: WeaponDef = {
  name: 'Barril TNT',
  kind: 'projectile',
  icon: 'wicon_cannon',
  ...TUNING.barrel,
  windFactor: 0,
};
const meteorWeapon = (d: { damage: number; radius: number; crater: number }): WeaponDef => ({
  name: 'Meteorito',
  kind: 'projectile',
  icon: 'wicon_cannon',
  damage: d.damage,
  radius: d.radius,
  crater: d.crater,
  windFactor: 0,
  knockback: 300,
});

const BRIDGE_THICKNESS = 14;
const SCRAP_EXTRA = 1.8;
const BARREL_TRIGGER_MARGIN = 30;
const BALL_RADIUS = 50;
const ZOMBIE_REACH_Y = 140;
const TOMBSTONE_HALF_WIDTH = 70;

const need = (cond: boolean, msg: string, out: string[]): void => {
  if (!cond) out.push(msg);
};

/** Problemas del esquema de los peligros de un mapa en texto legible (vacía = válido). */
export function validateHazards(list: HazardDef[], width: number): string[] {
  const e: string[] = [];
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const span = (h: { x: number; w: number }, tag: string): void =>
    need(
      num(h.x) && num(h.w) && h.x >= 0 && h.w > 0 && h.x + h.w <= width,
      `${tag}: x/w outside the world`,
      e,
    );
  list.forEach((h, i) => {
    const tag = `hazard ${i} (${(h as { type?: string }).type})`;
    switch (h.type) {
      case 'wall':
      case 'scrap':
        span(h, tag);
        need(num(h.h) && h.h > 0, `${tag}: h must be > 0`, e);
        break;
      case 'bridge':
        span(h, tag);
        need(num(h.y) && h.y > 0, `${tag}: y must be > 0`, e);
        break;
      case 'barrel':
        need(num(h.x) && h.x >= 0 && h.x <= width, `${tag}: x outside the world`, e);
        break;
      case 'portal':
        need(num(h.a?.x) && num(h.a?.y) && num(h.b?.x) && num(h.b?.y), `${tag}: needs mouths a and b`, e);
        need(num(h.radius) && h.radius > 0, `${tag}: radius must be > 0`, e);
        break;
      case 'spring':
        span(h, tag);
        need(num(h.power) && h.power > 0, `${tag}: power must be > 0`, e);
        break;
      case 'conveyor':
        span(h, tag);
        need(num(h.speed) && h.speed !== 0, `${tag}: speed must not be 0`, e);
        break;
      case 'fan':
        span(h, tag);
        need(num(h.y0) && num(h.y1) && h.y1 > h.y0, `${tag}: needs y0 < y1`, e);
        need(num(h.wind) && h.wind !== 0, `${tag}: wind must not be 0`, e);
        break;
      case 'crane':
        need(num(h.everyRounds) && h.everyRounds >= 2, `${tag}: everyRounds must be >= 2`, e);
        break;
      case 'zombie':
        need(num(h.everyRounds) && h.everyRounds >= 2, `${tag}: everyRounds must be >= 2`, e);
        need(num(h.radius) && h.radius > 0, `${tag}: radius must be > 0`, e);
        break;
      case 'tombstone':
        need(num(h.everyRounds) && h.everyRounds >= 2, `${tag}: everyRounds must be >= 2`, e);
        need(num(h.damage) && h.damage > 0, `${tag}: damage must be > 0`, e);
        break;
      case 'ball':
        need(num(h.everyRounds) && h.everyRounds >= 2, `${tag}: everyRounds must be >= 2`, e);
        need(
          num(h.speed) && h.speed > 0 && num(h.damage) && h.damage > 0,
          `${tag}: speed and damage must be > 0`,
          e,
        );
        break;
      case 'fog':
        break;
      default:
        e.push(`${tag}: unknown type`);
    }
  });
  return e;
}

export class World {
  barrels: BarrelState[] = [];
  readonly balls: Ball[] = [];
  fog = false;
  gravityScale = 1;
  damageScale = 1;
  windBonus = 0;
  /** Evento de esta ronda (null si no hay) y el anunciado para la siguiente. */
  active: EventPlan | null = null;
  pending: EventPlan | null = null;

  private readonly rng: Rng;
  private readonly hazards: HazardDef[];
  private scheduled: Scheduled[] = [];
  private scraps: { x: number; w: number; top: number; bottom: number }[] = [];
  private lastRound = 0;
  private eventsOn = true;

  constructor(
    private readonly host: WorldHost,
    seed: number,
  ) {
    this.rng = new Rng(seed ^ 0x1b873593);
    this.hazards = host.terrain.hazards;
    for (const h of this.hazards) this.stamp(h);
  }

  setEvents(on: boolean): void {
    this.eventsOn = on;
  }

  private surface(x: number): number {
    return this.host.terrain.surfaceY(x, 0) ?? this.host.terrain.height;
  }

  /** Construye las piezas fijas de un peligro en el terreno y el estado. */
  private stamp(h: HazardDef): void {
    const t = this.host.terrain;
    switch (h.type) {
      case 'wall':
      case 'scrap': {
        const top = Math.round(this.surface(h.x + h.w / 2) - h.h);
        const bottom = Math.round(this.surface(h.x + h.w / 2)) + 2;
        t.fillRect(h.x, top, h.x + h.w, bottom);
        if (h.type === 'scrap') this.scraps.push({ x: h.x, w: h.w, top, bottom });
        break;
      }
      case 'bridge':
        t.fillRect(h.x, h.y, h.x + h.w, h.y + BRIDGE_THICKNESS);
        break;
      case 'barrel':
        this.addBarrel(h.x);
        break;
      case 'fog':
        this.fog = true;
        break;
      default:
        break;
    }
  }

  private addBarrel(x: number): void {
    this.barrels.push({ id: this.host.nextId(), x, y: this.surface(x), alive: true });
  }

  update(dt: number): void {
    for (const u of this.host.units) {
      if (!u.alive || !u.grounded) continue;
      for (const h of this.hazards) {
        if (h.type === 'spring' && !u.sprung && Math.abs(u.x - h.x) <= h.w / 2) {
          u.sprung = true;
          u.grounded = false;
          u.vx = 0;
          u.vy = -h.power;
          u.peakY = u.y;
        } else if (h.type === 'conveyor' && u.x >= h.x && u.x <= h.x + h.w) {
          this.carry(u, h.speed * dt);
        }
      }
    }
    this.rollBalls(dt);
  }

  private carry(u: Unit, dx: number): void {
    const t = this.host.terrain;
    const nx = Math.min(Math.max(u.x + dx, 20), t.width - 20);
    const gy = t.surfaceY(nx, u.y - 12);
    if (gy !== null && gy <= u.y + 4) {
      u.x = nx;
      u.y = gy;
    } else {
      // La banda lo lleva más allá del borde: sigue caminando y cae (nunca se vuelve a apoyar en el mismo lugar).
      u.x = nx;
      u.grounded = false;
      u.vx = 0;
      u.vy = 0;
      u.peakY = u.y;
    }
  }

  private rollBalls(dt: number): void {
    const t = this.host.terrain;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.x += b.dir * b.speed * dt;
      b.y = t.surfaceY(b.x, 0) ?? b.y;
      for (const u of this.host.units) {
        if (!u.alive || b.hit.has(u.index)) continue;
        if (Math.abs(u.x - b.x) < BALL_RADIUS && Math.abs(u.y - b.y) < BALL_RADIUS * 1.5) {
          b.hit.add(u.index);
          this.host.hurt(u, b.damage, u.x, u.y - 100, true);
          if (u.alive) {
            u.vx += b.dir * 140;
            u.vy = -240;
            u.grounded = false;
            u.launched = true;
            u.peakY = u.y;
          }
        }
      }
      if (b.x < -80 || b.x > t.width + 80) this.balls.splice(i, 1);
    }
  }

  /** Viento extra en un punto (ventiladores). */
  windAt(x: number, y: number): number {
    let w = 0;
    for (const h of this.hazards)
      if (h.type === 'fan' && x >= h.x && x <= h.x + h.w && y >= h.y0 && y <= h.y1) w += h.wind;
    return w;
  }

  /** Teletransporta un proyectil que toca la boca de un portal. */
  portal(p: Projectile, dt: number): void {
    if (p.portalCd && p.portalCd > 0) {
      p.portalCd -= dt;
      return;
    }
    for (const h of this.hazards) {
      if (h.type !== 'portal') continue;
      const atA = Math.hypot(p.x - h.a.x, p.y - h.a.y) < h.radius;
      const atB = Math.hypot(p.x - h.b.x, p.y - h.b.y) < h.radius;
      if (atA || atB) {
        const to = atA ? h.b : h.a;
        p.x = to.x;
        p.y = to.y;
        p.portalCd = 0.4;
        return;
      }
    }
  }

  /** Se llama tras cada explosión: los barriles reaccionan y los montones de chatarra se desploman. */
  onBlast(x: number, y: number, radius: number, owner: number, shot: number, crater: number): void {
    this.scrapHit(x, y, crater);
    for (const b of this.barrels)
      if (b.alive && Math.hypot(b.x - x, b.y - 30 - y) <= radius + BARREL_TRIGGER_MARGIN)
        this.triggerBarrel(b, owner, shot);
  }

  triggerBarrel(b: BarrelState, owner: number, shot: number): void {
    if (!b.alive) return;
    b.alive = false;
    this.host.blast(b.x, b.y - 30, 'barril', BARREL_WEAPON, owner, shot, false);
  }

  /** Una explosión dentro de un montón de chatarra cava más que en suelo normal (el montón se hunde). Devuelve píxeles quitados. */
  scrapHit(x: number, y: number, crater: number): number {
    for (const s of this.scraps)
      if (x >= s.x - crater && x <= s.x + s.w + crater && y >= s.top - crater && y <= s.bottom + crater)
        return this.host.terrain.carveCircle(x, y, crater * SCRAP_EXTRA);
    return 0;
  }

  /** Se llama en el primer turno de cada ronda. */
  onRound(round: number): void {
    if (round === this.lastRound) return;
    this.lastRound = round;
    this.host.round = round;

    if (this.active && this.active.round < round) this.endEvent();
    if (this.pending && this.pending.round === round) {
      this.active = this.pending;
      this.pending = null;
      this.applyEvent(true);
    }
    for (const s of this.scheduled.filter((x) => x.round === round)) this.fire(s);
    this.scheduled = this.scheduled.filter((x) => x.round > round);

    // Anuncia lo que pasa la próxima ronda.
    const next = round + 1;
    for (const h of this.hazards) {
      if (h.type !== 'crane' && h.type !== 'zombie' && h.type !== 'tombstone' && h.type !== 'ball') continue;
      if (next < 2 || next % h.everyRounds !== 0) continue;
      const alive = this.host.units.filter((u) => u.alive);
      const target = alive.length ? this.rng.pick(alive) : undefined;
      // La grúa suelta su barril junto al objetivo (nunca encima): es una herramienta, no un golpe gratis.
      const jitter =
        h.type === 'crane'
          ? (this.rng.int(0, 1) === 0 ? -1 : 1) * this.rng.int(140, 240)
          : this.rng.int(-40, 40);
      const x = Math.round(Math.min(1500, Math.max(100, (target?.x ?? 800) + jitter)));
      const dir: 1 | -1 = this.rng.int(0, 1) === 0 ? 1 : -1;
      this.scheduled.push({ kind: h.type, round: next, x, dir, def: h });
      this.host.emit({
        type: 'hazard-warn',
        kind: h.type,
        round: next,
        x: h.type === 'ball' ? (dir === 1 ? 0 : 1600) : x,
      });
    }
    if (
      this.eventsOn &&
      !this.pending &&
      next >= EVENTS.firstRound &&
      (next - EVENTS.firstRound) % EVENTS.everyRounds === 0
    ) {
      const ids = Object.keys(EVENTS.types);
      const id = this.rng.weighted(
        ids,
        ids.map((k) => EVENTS.types[k].weight),
      );
      this.pending = this.plan(id, next);
      this.host.emit({ type: 'event-warn', id, round: next, xs: this.pending.xs });
    }
  }

  private fire(s: Scheduled): void {
    const at = s.kind === 'ball' ? (s.dir === 1 ? 0 : 1600) : s.x;
    this.host.emit({ type: 'hazard-fire', kind: s.kind, round: s.round, x: at });
    const d = s.def;
    switch (s.kind) {
      case 'crane':
        this.addBarrel(s.x);
        break;
      case 'zombie':
        if (d.type === 'zombie')
          for (const u of this.host.units)
            if (
              u.alive &&
              Math.abs(u.x - s.x) <= d.radius &&
              Math.abs(u.y - this.surface(s.x)) <= ZOMBIE_REACH_Y
            )
              u.stunTurns += 1;
        break;
      case 'tombstone':
        if (d.type === 'tombstone')
          for (const u of this.host.units)
            if (u.alive && Math.abs(u.x - s.x) <= TOMBSTONE_HALF_WIDTH)
              this.host.hurt(u, d.damage, u.x, u.y - 100, true);
        break;
      case 'ball':
        if (d.type === 'ball')
          this.balls.push({
            x: s.dir === 1 ? -60 : this.host.terrain.width + 60,
            y: this.surface(s.dir === 1 ? 0 : this.host.terrain.width - 1),
            dir: s.dir,
            speed: d.speed,
            damage: d.damage,
            hit: new Set(),
          });
        break;
    }
  }

  private plan(id: string, round: number): EventPlan {
    const xs: number[] = [];
    if (id === 'meteoritos')
      for (let i = 0; i < (EVENTS.types[id].count ?? 3); i++) xs.push(this.rng.int(150, 1450));
    return { id, round, xs };
  }

  /** Para pruebas: hace que `id` corra en `round` (de inmediato si es la ronda actual o una anterior). */
  forceEvent(id: string, round: number): void {
    const plan = this.plan(id, round);
    if (round <= this.host.round) {
      this.active = plan;
      this.applyEvent(false);
    } else this.pending = plan;
  }

  /** Para pruebas: ejecuta ya los efectos de inicio (rayos, meteoritos) del evento activo. */
  startEventNow(): void {
    this.applyEvent(true);
  }

  private applyEvent(effects: boolean): void {
    const ev = this.active;
    if (!ev) return;
    const d = EVENTS.types[ev.id];
    if (effects) this.host.emit({ type: 'event-start', id: ev.id, round: ev.round });
    switch (ev.id) {
      case 'gravedad':
        this.gravityScale = d.scale ?? 0.5;
        break;
      case 'luna':
        this.damageScale = d.scale ?? 2;
        break;
      case 'rafaga':
        this.windBonus = d.bonus ?? 3;
        break;
      case 'tormenta':
        if (effects) this.lightning(d.damage ?? 20, d.radius ?? 90);
        break;
      case 'meteoritos':
        if (effects)
          for (const x of ev.xs) {
            const def = meteorWeapon({
              damage: d.damage ?? 14,
              radius: d.radius ?? 70,
              crater: d.crater ?? 45,
            });
            this.host.blast(x, this.surface(x) - 4, 'meteoro', def, -1, 0, true);
          }
        break;
    }
  }

  private lightning(damage: number, radius: number): void {
    const t = this.host.terrain;
    let bx = 0;
    let by = t.height;
    for (let x = 0; x < t.width; x += 2) {
      const y = t.surfaceY(x, 0);
      if (y !== null && y < by) {
        by = y;
        bx = x;
      }
    }
    this.host.emit({ type: 'lightning', x: bx, y: by });
    t.carveCircle(bx, by, 30);
    for (const u of this.host.units)
      if (u.alive && Math.abs(u.x - bx) <= radius && Math.abs(u.y - by) <= radius + 80)
        this.host.hurt(u, damage, u.x, u.y - 100, true);
  }

  private endEvent(): void {
    if (this.active) this.host.emit({ type: 'event-end', id: this.active.id });
    this.active = null;
    this.gravityScale = 1;
    this.damageScale = 1;
    this.windBonus = 0;
  }
}
