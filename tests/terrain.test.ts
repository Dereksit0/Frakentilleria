import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/core/terrain';

const flat = () => Terrain.fromHeights(200, 100, new Array(200).fill(60));

describe('terreno', () => {
  it('construye suelo sólido bajo la línea de superficie', () => {
    const t = flat();
    expect(t.isSolid(10, 59)).toBe(false);
    expect(t.isSolid(10, 60)).toBe(true);
    expect(t.isSolid(10, 99)).toBe(true);
  });
  it('lo que está fuera de los límites cuenta como vacío', () => {
    const t = flat();
    expect(t.isSolid(-1, 80)).toBe(false);
    expect(t.isSolid(10, 150)).toBe(false);
  });
  it('abre un círculo y dice cuántos píxeles quitó', () => {
    const t = flat();
    const before = t.solidCount();
    const removed = t.carveCircle(100, 60, 20);
    expect(removed).toBeGreaterThan(0);
    expect(t.solidCount()).toBe(before - removed);
    expect(t.isSolid(100, 70)).toBe(false);
    expect(t.isSolid(100, 85)).toBe(true);
    // Más o menos medio círculo de área (solo la mitad de abajo era sólida).
    expect(removed).toBeGreaterThan(Math.PI * 400 * 0.4);
    expect(removed).toBeLessThan(Math.PI * 400 * 0.6);
  });
  it('abrir dos veces no quita los mismos píxeles otra vez', () => {
    const t = flat();
    t.carveCircle(100, 60, 20);
    expect(t.carveCircle(100, 60, 20)).toBe(0);
  });
  it('surfaceY encuentra el primer píxel sólido desde una altura inicial', () => {
    const t = flat();
    expect(t.surfaceY(50, 0)).toBe(60);
    t.carveCircle(50, 60, 15);
    expect(t.surfaceY(50, 0)).toBeGreaterThan(60);
    expect(t.surfaceY(50, 99)).toBe(99);
    expect(t.surfaceY(-5, 0)).toBeNull();
  });
  it('surfaceY da null sobre un hueco sin fondo', () => {
    const t = flat();
    t.carveCircle(50, 80, 60);
    expect(t.surfaceY(50, 0)).toBeNull();
  });
  it('fromMask copia una máscara y el clon es independiente', () => {
    const mask = new Uint8Array(4 * 4).fill(1);
    const t = Terrain.fromMask(4, 4, mask);
    const c = t.clone();
    c.carveCircle(2, 2, 2);
    expect(t.solidCount()).toBe(16);
    expect(c.solidCount()).toBeLessThan(16);
  });
  it('el generador procedural da lo mismo con la misma semilla', () => {
    const a = Terrain.procedural(400, 300, 7, 200, 50);
    const b = Terrain.procedural(400, 300, 7, 200, 50);
    const c = Terrain.procedural(400, 300, 8, 200, 50);
    expect(a.solid).toEqual(b.solid);
    expect(a.solid).not.toEqual(c.solid);
  });
});
