import { describe, expect, it } from 'vitest';
import { MAX_WIND_PARTICLES, windVisual } from '../src/core/windVisual';

describe('windVisual: qué se ve y se siente con cada viento (−5..+5)', () => {
  it('sin viento: nada de partículas, manga caída, sin flechas ni aviso', () => {
    const v = windVisual(0);
    expect(v.particles).toBe(0);
    expect(v.arrows).toBe(0);
    expect(v.direction).toBe(0);
    expect(v.sockLevel).toBe(0);
    expect(v.notice).toBe(false);
    expect(v.streaks).toBe(false);
    expect(v.driftSpeed).toBe(0);
  });

  it('el signo da la dirección y el ángulo (0 = derecha, π = izquierda)', () => {
    for (let w = 1; w <= 5; w++) {
      expect(windVisual(w).direction).toBe(1);
      expect(windVisual(w).angle).toBeCloseTo(0, 6);
      expect(windVisual(-w).direction).toBe(-1);
      expect(windVisual(-w).angle).toBeCloseTo(Math.PI, 6);
    }
  });

  it('una flecha por nivel y el nivel de la manga sube con la fuerza', () => {
    for (let w = 1; w <= 5; w++) {
      expect(windVisual(w).arrows).toBe(w);
      expect(windVisual(-w).arrows).toBe(w);
      expect(windVisual(w).sockLevel).toBe(w);
    }
  });

  it('la cantidad de partículas es proporcional a la fuerza y respeta el tope de 60', () => {
    let prev = -1;
    for (let w = 0; w <= 5; w++) {
      const p = windVisual(w).particles;
      expect(p).toBeGreaterThan(prev);
      expect(p).toBeLessThanOrEqual(MAX_WIND_PARTICLES);
      prev = p;
    }
    expect(MAX_WIND_PARTICLES).toBe(60);
    expect(windVisual(5).particles).toBe(60);
    expect(windVisual(-5).particles).toBe(60);
  });

  it('la velocidad de las partículas y de las nubes es proporcional y con el signo del viento', () => {
    for (let w = -5; w <= 5; w++) {
      expect(Math.sign(windVisual(w).driftSpeed)).toBe(Math.sign(w));
      expect(Math.sign(windVisual(w).cloudShift)).toBe(Math.sign(w));
    }
    expect(windVisual(4).driftSpeed).toBeCloseTo(windVisual(2).driftSpeed * 2, 6);
  });

  it('hay aviso con cualquier viento distinto de cero y rachas visibles desde fuerza 3', () => {
    for (let w = -5; w <= 5; w++) expect(windVisual(w).notice).toBe(w !== 0);
    for (let w = -5; w <= 5; w++) expect(windVisual(w).streaks).toBe(Math.abs(w) >= 3);
  });

  it('es simétrica: −w y +w solo cambian de signo', () => {
    for (let w = 1; w <= 5; w++) {
      const a = windVisual(w);
      const b = windVisual(-w);
      expect(b.particles).toBe(a.particles);
      expect(b.arrows).toBe(a.arrows);
      expect(b.driftSpeed).toBeCloseTo(-a.driftSpeed, 6);
    }
  });

  it('un viento fuera de rango o fraccionario se acota y no devuelve NaN', () => {
    expect(windVisual(9).arrows).toBe(5);
    expect(windVisual(-9).particles).toBe(60);
    expect(windVisual(2.6).arrows).toBe(3);
    for (const w of [Number.NaN, Infinity]) expect(Number.isFinite(windVisual(w).driftSpeed)).toBe(true);
  });

  it('cada mapa tiene sus partículas ambientales', async () => {
    const { WIND_KINDS } = await import('../src/core/windVisual');
    expect(WIND_KINDS.vertedero).toEqual(['paper', 'dust']);
    expect(WIND_KINDS.cementerio).toEqual(['leaf', 'fog']);
    expect(WIND_KINDS.fabrica).toEqual(['fluff', 'confetti']);
  });
});
