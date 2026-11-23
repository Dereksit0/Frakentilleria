import type { Terrain } from './terrain';

export const GRAVITY = 900; // px/s²
export const MAX_SPEED = 1100; // px/s at 100% power
export const WIND_ACCEL = 14; // px/s² per wind unit (wind ranges −5..+5)

export interface Vec {
  x: number;
  y: number;
}
export interface Velocity {
  vx: number;
  vy: number;
}
export interface Hit {
  type: 'terrain' | 'void' | 'timeout';
  x: number;
  y: number;
  t: number;
}

/** angleDeg: 0 = right, 90 = up. power: 0..100. */
export function launchVelocity(angleDeg: number, power: number): Velocity {
  const a = (angleDeg * Math.PI) / 180;
  const speed = (MAX_SPEED * power) / 100;
  return { vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed };
}

export interface SimOptions {
  dt?: number;
  maxT?: number;
  windFactor?: number;
  /** Keep one preview point every N steps. */
  sampleEvery?: number;
}

export function simulateTrajectory(
  start: Vec,
  v: Velocity,
  wind: number,
  terrain: Terrain,
  opts: SimOptions = {},
): { points: Vec[]; hit: Hit } {
  const dt = opts.dt ?? 1 / 120;
  const maxT = opts.maxT ?? 12;
  const wf = opts.windFactor ?? 1;
  const every = opts.sampleEvery ?? 4;
  let { x, y } = start;
  let { vx, vy } = v;
  const points: Vec[] = [{ x, y }];
  let t = 0;
  let step = 0;
  while (t < maxT) {
    vx += wind * WIND_ACCEL * wf * dt;
    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
    t += dt;
    step++;
    if (step % every === 0) points.push({ x, y });
    if (x < 0 || x >= terrain.width || y >= terrain.height) {
      points.push({ x, y });
      return { points, hit: { type: 'void', x, y, t } };
    }
    if (terrain.isSolid(x, y)) {
      points.push({ x, y });
      return { points, hit: { type: 'terrain', x, y, t } };
    }
  }
  return { points, hit: { type: 'timeout', x, y, t } };
}
