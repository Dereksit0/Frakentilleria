import { describe, it, expect } from 'vitest';
import {
  healthBarViewModel,
  HEALTH_SEGMENT,
  LOW_HEALTH,
  CRITICAL_HEALTH,
  stepBar,
  type BarAnim,
} from '../src/ui/model/healthBar';
import { C } from '../src/ui/theme';

describe('healthBarViewModel', () => {
  it('reports percentage, number and player colour + shape', () => {
    const j1 = healthBarViewModel(60, 80, 60, 0);
    expect(j1.pct).toBeCloseTo(0.75);
    expect(j1.label).toBe('60');
    expect(j1.fillColor).toBe(C.p1);
    expect(j1.shape).toBe('circle');
    const j2 = healthBarViewModel(60, 80, 60, 1);
    expect(j2.fillColor).toBe(C.p2);
    expect(j2.shape).toBe('diamond');
  });

  it('places a thin segment mark every 20 hp (never at 0 or full)', () => {
    expect(HEALTH_SEGMENT).toBe(20);
    expect(healthBarViewModel(80, 80, 80, 0).ticks).toEqual([0.25, 0.5, 0.75]);
    const t = healthBarViewModel(88, 88, 88, 0).ticks;
    expect(t).toHaveLength(4);
    expect(t[0]).toBeCloseTo(20 / 88);
    expect(healthBarViewModel(10, 10, 10, 0).ticks).toEqual([]);
  });

  it('classifies normal / low / critical / dead', () => {
    expect(LOW_HEALTH).toBe(0.25);
    expect(CRITICAL_HEALTH).toBe(0.1);
    expect(healthBarViewModel(23, 88, 23, 0).state).toBe('normal'); // 26 %
    expect(healthBarViewModel(22, 88, 22, 0).state).toBe('low'); // exactly 25 %
    expect(healthBarViewModel(9, 88, 9, 0).state).toBe('low');
    expect(healthBarViewModel(8, 88, 8, 0).state).toBe('critical');
    expect(healthBarViewModel(0, 88, 8, 0).state).toBe('dead');
  });

  it('low health: alarm colour AND stripes AND skull AND pulse (never colour only)', () => {
    const low = healthBarViewModel(15, 80, 15, 1);
    expect(low.fillColor).toBe(C.alarm);
    expect(low.stripes).toBe(true);
    expect(low.showSkull).toBe(true);
    expect(low.pulseMs).toBeGreaterThan(0);
    const crit = healthBarViewModel(5, 80, 5, 1);
    expect(crit.pulseMs).toBeLessThan(low.pulseMs); // faster pulse
    const ok = healthBarViewModel(70, 80, 70, 1);
    expect(ok.stripes).toBe(false);
    expect(ok.showSkull).toBe(false);
    expect(ok.pulseMs).toBe(0);
  });

  it('ghost bar spans from the new value up to the previous one after damage', () => {
    const m = healthBarViewModel(30, 80, 60, 0);
    expect(m.pct).toBeCloseTo(0.375);
    expect(m.ghostPct).toBeCloseTo(0.75);
    expect(m.lostHp).toBe(30);
  });

  it('no ghost on healing or when nothing changed', () => {
    expect(healthBarViewModel(70, 80, 50, 0).ghostPct).toBeCloseTo(70 / 80);
    expect(healthBarViewModel(70, 80, 50, 0).lostHp).toBe(0);
    expect(healthBarViewModel(70, 80, 70, 0).ghostPct).toBeCloseTo(70 / 80);
  });

  it('flags heavy hits (>= 25 % of max hp in one go)', () => {
    expect(healthBarViewModel(60, 80, 80, 0).heavyHit).toBe(true); // 20 of 80
    expect(healthBarViewModel(70, 80, 80, 0).heavyHit).toBe(false);
  });

  it('clamps nonsense input', () => {
    const m = healthBarViewModel(-5, 80, 200, 0);
    expect(m.pct).toBe(0);
    expect(m.ghostPct).toBe(1);
    expect(healthBarViewModel(5, 0, 5, 0).pct).toBe(0);
    expect(healthBarViewModel(500, 80, 500, 0).pct).toBe(1);
  });
});

describe('stepBar (animation of the displayed value + ghost)', () => {
  const start = (v: number): BarAnim => ({ shown: v, ghost: v, holdMs: 0 });

  it('moves the bar to the target in about 300 ms', () => {
    const a = start(0.75);
    let t = 0;
    while (Math.abs(a.shown - 0.375) > 1e-3 && t < 2000) {
      stepBar(a, 0.375, 0.75, 16, false);
      t += 16;
    }
    expect(t).toBeGreaterThanOrEqual(250);
    expect(t).toBeLessThanOrEqual(400);
  });

  it('keeps the ghost for ~500 ms and then drains it', () => {
    const a = start(0.75);
    stepBar(a, 0.375, 0.75, 16, false); // damage lands
    expect(a.ghost).toBeCloseTo(0.75);
    for (let t = 16; t < 450; t += 16) stepBar(a, 0.375, 0.375, 16, false);
    expect(a.ghost).toBeCloseTo(0.75); // still held
    for (let t = 0; t < 1000; t += 16) stepBar(a, 0.375, 0.375, 16, false);
    expect(a.ghost).toBeCloseTo(0.375, 2);
  });

  it('with reduced effects the bar jumps and there is no ghost', () => {
    const a = start(0.75);
    stepBar(a, 0.375, 0.75, 16, true);
    expect(a.shown).toBeCloseTo(0.375);
    expect(a.ghost).toBeCloseTo(0.375);
  });

  it('healing raises the bar immediately without a ghost', () => {
    const a = start(0.4);
    stepBar(a, 0.9, 0.9, 16, false);
    expect(a.ghost).toBeGreaterThanOrEqual(a.shown);
    for (let t = 0; t < 600; t += 16) stepBar(a, 0.9, 0.9, 16, false);
    expect(a.shown).toBeCloseTo(0.9, 2);
    expect(a.ghost).toBeCloseTo(0.9, 2);
  });
});
