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

describe('datos de las piezas', () => {
  it('has 5 donors × 4 slots = 20 parts, each costing 5 ± 1', () => {
    expect(PARTS.parts).toHaveLength(20);
    for (const p of PARTS.parts) {
      expect(p.cost).toBeGreaterThanOrEqual(4);
      expect(p.cost).toBeLessThanOrEqual(6);
    }
  });
});

describe('computeStats', () => {
  it('da las estadísticas base con la mezcla neutra', () => {
    // 4 maniquíes: solo cambia la movilidad
    const s = computeStats(sel('maniqui', 'maniqui', 'maniqui', 'maniqui'));
    expect(s).toEqual({ hp: 80, mobility: 140, resistance: 0, damage: 100 });
  });
  it('suma los efectos de cada donante por ranura', () => {
    const s = computeStats(sel('armadura', 'refri', 'juguete', 'espantapajaros'));
    expect(s.resistance).toBe(10);
    expect(s.hp).toBe(80 + 10 + 8);
    expect(s.damage).toBe(108);
    expect(s.mobility).toBe(100);
  });
});

describe('presupuesto', () => {
  it('suma los costos y avisa si se pasa', () => {
    const cheap = budgetOf(sel('maniqui', 'maniqui', 'maniqui', 'maniqui'));
    expect(cheap.total).toBe(16);
    expect(cheap.over).toBe(false);
    const rich = budgetOf(sel('armadura', 'armadura', 'armadura', 'armadura'));
    expect(rich.total).toBe(24);
    expect(rich.limit).toBe(BUDGET_LIMIT);
    expect(rich.over).toBe(true);
  });
  it('llegar justo al límite está permitido', () => {
    expect(budgetOf(sel('armadura', 'armadura', 'refri', 'maniqui')).over).toBe(false); // 6+6+6+4=22
  });
});

describe('armas y habilidades', () => {
  it('los brazos y el torso dan armas (sin repetir)', () => {
    expect(weaponsFor(sel('armadura', 'armadura', 'armadura', 'armadura'))).toEqual(['mazo', 'bazuca']);
    expect(weaponsFor(sel('juguete', 'maniqui', 'maniqui', 'maniqui'))).toEqual(['bazuca', 'mortero']);
  });
  it('la cabeza da la habilidad', () => {
    expect(abilityFor(sel('armadura', 'maniqui', 'maniqui', 'maniqui'))).toBe('escudo');
    expect(abilityFor(sel('refri', 'maniqui', 'maniqui', 'maniqui'))).toBe('curar');
  });
});

describe('randomSelection', () => {
  it('se repite con la misma semilla y siempre cabe en el presupuesto', () => {
    expect(randomSelection(new Rng(5))).toEqual(randomSelection(new Rng(5)));
    const r = new Rng(99);
    for (let i = 0; i < 100; i++) expect(budgetOf(randomSelection(r)).over).toBe(false);
  });
});
