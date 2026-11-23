import { describe, it, expect } from 'vitest';
import { launchVelocity, simulateTrajectory, GRAVITY, MAX_SPEED } from '../src/core/ballistics';
import { Terrain } from '../src/core/terrain';

const flat = () => Terrain.fromHeights(1600, 900, new Array(1600).fill(700));

describe('launchVelocity', () => {
  it('0° goes right, 90° goes up (screen y negative)', () => {
    const r = launchVelocity(0, 100);
    expect(r.vx).toBeCloseTo(MAX_SPEED);
    expect(r.vy).toBeCloseTo(0);
    const u = launchVelocity(90, 100);
    expect(u.vx).toBeCloseTo(0);
    expect(u.vy).toBeCloseTo(-MAX_SPEED);
  });
  it('power scales speed linearly and 180° goes left', () => {
    const h = launchVelocity(0, 50);
    expect(h.vx).toBeCloseTo(MAX_SPEED / 2);
    expect(launchVelocity(180, 100).vx).toBeCloseTo(-MAX_SPEED);
  });
});

describe('simulateTrajectory', () => {
  it('matches the analytic range without wind at 45°', () => {
    const v = launchVelocity(45, 60);
    const speed = MAX_SPEED * 0.6;
    const range = (speed * speed) / GRAVITY;
    const t = flat();
    const res = simulateTrajectory({ x: 100, y: 699 }, v, 0, t);
    expect(res.hit.type).toBe('terrain');
    expect(res.hit.x - 100).toBeGreaterThan(range * 0.95);
    expect(res.hit.x - 100).toBeLessThan(range * 1.05);
  });

  it('positive wind pushes the shot right, negative pushes left', () => {
    const v = launchVelocity(60, 60);
    const t = flat();
    const none = simulateTrajectory({ x: 800, y: 699 }, v, 0, t).hit.x;
    const right = simulateTrajectory({ x: 800, y: 699 }, v, 5, t).hit.x;
    const left = simulateTrajectory({ x: 800, y: 699 }, v, -5, t).hit.x;
    expect(right).toBeGreaterThan(none);
    expect(left).toBeLessThan(none);
  });

  it('windFactor 0 ignores wind', () => {
    const v = launchVelocity(60, 60);
    const t = flat();
    const a = simulateTrajectory({ x: 800, y: 699 }, v, 5, t, { windFactor: 0 }).hit.x;
    const b = simulateTrajectory({ x: 800, y: 699 }, v, 0, t).hit.x;
    expect(a).toBeCloseTo(b, 5);
  });

  it('reports a void hit when leaving the world sideways or below', () => {
    const t = Terrain.fromHeights(1600, 900, new Array(1600).fill(1000));
    const res = simulateTrajectory({ x: 800, y: 500 }, launchVelocity(10, 100), 0, t);
    expect(res.hit.type).toBe('void');
  });

  it('hits terrain in a wall in front of it', () => {
    const t = flat();
    t.carveCircle(0, 0, 0);
    const h = new Array(1600).fill(700);
    for (let x = 900; x < 1000; x++) h[x] = 300;
    const wall = Terrain.fromHeights(1600, 900, h);
    const res = simulateTrajectory({ x: 500, y: 650 }, launchVelocity(5, 100), 0, wall);
    expect(res.hit.type).toBe('terrain');
    expect(res.hit.x).toBeGreaterThanOrEqual(890);
    expect(res.hit.x).toBeLessThan(1000);
  });

  it('returns sampled points for preview', () => {
    const res = simulateTrajectory({ x: 100, y: 699 }, launchVelocity(45, 60), 0, flat());
    expect(res.points.length).toBeGreaterThan(5);
  });
});
