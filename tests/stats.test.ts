import { describe, it, expect } from 'vitest';
import {
  computeStats,
  budgetOf,
  randomSelection,
  weaponsFor,
  abilityFor,
  PARTS,
  BUDGET_LIMIT,
  type Selection,
} from '../src/core/stats';
import { Rng } from '../src/core/rng';

const sel = (head: string, torso: string, arms: string, legs: string): Selection =>
  ({ head, torso, arms, legs }) as Selection;

describe('parts data', () => {
  it('has 5 donors × 4 slots = 20 parts, each costing 5 ± 1', () => {
    expect(PARTS.parts).toHaveLength(20);
    for (const p of PARTS.parts) {
      expect(p.cost).toBeGreaterThanOrEqual(4);
      expect(p.cost).toBeLessThanOrEqual(6);
    }
  });
});

describe('computeStats', () => {
  it('returns base stats equivalents for the neutral mix', () => {
    // 4 x maniqui = mobility only
    const s = computeStats(sel('maniqui', 'maniqui', 'maniqui', 'maniqui'));
    expect(s).toEqual({ hp: 80, mobility: 140, resistance: 0, damage: 100 });
  });
  it('adds donor effects per slot', () => {
    const s = computeStats(sel('armadura', 'refri', 'juguete', 'espantapajaros'));
    expect(s.resistance).toBe(10);
    expect(s.hp).toBe(80 + 10 + 8);
    expect(s.damage).toBe(108);
    expect(s.mobility).toBe(100);
  });
});

describe('budget', () => {
  it('sums costs and flags overspending', () => {
    const cheap = budgetOf(sel('maniqui', 'maniqui', 'maniqui', 'maniqui'));
    expect(cheap.total).toBe(16);
    expect(cheap.over).toBe(false);
    const rich = budgetOf(sel('armadura', 'armadura', 'armadura', 'armadura'));
    expect(rich.total).toBe(24);
    expect(rich.limit).toBe(BUDGET_LIMIT);
    expect(rich.over).toBe(true);
  });
  it('limit itself is allowed', () => {
    expect(budgetOf(sel('armadura', 'armadura', 'refri', 'maniqui')).over).toBe(false); // 6+6+6+4=22
  });
});

describe('weapons and abilities', () => {
  it('arms and torso grant weapons (deduplicated)', () => {
    expect(weaponsFor(sel('armadura', 'armadura', 'armadura', 'armadura'))).toEqual(['mazo', 'bazuca']);
    expect(weaponsFor(sel('juguete', 'maniqui', 'maniqui', 'maniqui'))).toEqual(['bazuca', 'mazo']);
  });
  it('head grants the ability', () => {
    expect(abilityFor(sel('armadura', 'maniqui', 'maniqui', 'maniqui'))).toBe('escudo');
    expect(abilityFor(sel('refri', 'maniqui', 'maniqui', 'maniqui'))).toBe('curar');
  });
});

describe('randomSelection', () => {
  it('is reproducible with a seed and always within budget', () => {
    expect(randomSelection(new Rng(5))).toEqual(randomSelection(new Rng(5)));
    const r = new Rng(99);
    for (let i = 0; i < 100; i++) expect(budgetOf(randomSelection(r)).over).toBe(false);
  });
});
