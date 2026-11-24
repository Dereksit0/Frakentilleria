import { describe, it, expect } from 'vitest';
import {
  acidLevelY,
  acidDamageAt,
  ACID_START_ROUND,
  ACID_RISE_PER_ROUND,
  ACID_DAMAGE,
} from '../src/core/acid';

describe('acid storm', () => {
  it('does not exist before round 6', () => {
    expect(ACID_START_ROUND).toBe(6);
    for (let r = 1; r <= 5; r++) expect(acidLevelY(r, 900)).toBe(900);
  });
  it('rises 40 px per round from round 6', () => {
    expect(ACID_RISE_PER_ROUND).toBe(40);
    expect(acidLevelY(6, 900)).toBe(860);
    expect(acidLevelY(7, 900)).toBe(820);
    expect(acidLevelY(10, 900)).toBe(700);
  });
  it('never goes above the top of the world', () => {
    expect(acidLevelY(100, 900)).toBe(0);
  });
  it('damages creatures whose feet are at or below the level', () => {
    expect(acidDamageAt(850, 7, 900)).toBe(ACID_DAMAGE);
    expect(acidDamageAt(800, 7, 900)).toBe(0);
    expect(acidDamageAt(899, 3, 900)).toBe(0);
  });
});
