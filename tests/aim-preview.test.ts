import { describe, expect, it } from 'vitest';
import { aimPreview, liftAngle } from '../src/core/aim';
import { launchVelocity, simulateTrajectory } from '../src/core/ballistics';
import { WEAPONS } from '../src/core/data';
import { Terrain } from '../src/core/terrain';
import { TUNING } from '../src/core/tuning';
import { UNIT_CENTER_OFFSET } from '../src/core/unit';

const flat = (): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(700));
const base = { x: 400, y: 700, angle: 45, power: 50, weapon: 'canon', wind: 0 };
const preview = (o: Partial<typeof base> = {}) => aimPreview({ ...base, ...o }, flat());

describe('vista previa de la trayectoria (puntos que dibuja la escena)', () => {
  it('empieza en la boca del arma, igual que el disparo real', () => {
    const p = preview();
    const r = (45 * Math.PI) / 180;
    expect(p[0].x).toBeCloseTo(400 + Math.cos(r) * 40);
    expect(p[0].y).toBeCloseTo(700 - UNIT_CENTER_OFFSET - 10 - Math.sin(r) * 40);
  });

  it('un proyectil sigue la balística real durante los segundos de vista previa', () => {
    const p = preview();
    expect(p.length).toBeGreaterThan(4);
    const m = p[0];
    const sim = simulateTrajectory(m, launchVelocity(45, 50), 0, flat(), {
      windFactor: WEAPONS.canon.windFactor,
      maxT: TUNING.preview.seconds,
      sampleEvery: 7,
    });
    expect(p).toEqual(sim.points);
  });

  it('cambia con el ángulo, con la potencia y con el viento', () => {
    const last = (o: Partial<typeof base>) => preview(o).at(-1)!;
    expect(last({ angle: 60 })).not.toEqual(last({}));
    expect(last({ power: 70 }).x).toBeGreaterThan(last({}).x);
    expect(last({ wind: 5 }).x).toBeGreaterThan(last({ wind: 0 }).x);
    expect(last({ wind: -5 }).x).toBeLessThan(last({ wind: 0 }).x);
  });

  it('un arma que ignora el viento no se desvía con él', () => {
    expect(preview({ weapon: 'tesla', wind: 5 })).toEqual(preview({ weapon: 'tesla', wind: 0 }));
  });

  it('el mortero se dibuja con su ángulo mínimo, como sale de verdad', () => {
    const min = WEAPONS.mortero.minAngle!;
    const p = preview({ weapon: 'mortero', angle: 10 });
    const lifted = preview({ weapon: 'mortero', angle: liftAngle(10, min) });
    expect(p).toEqual(lifted);
    const rise = Math.atan2(p[0].y - p[1].y, p[1].x - p[0].x) * (180 / Math.PI);
    expect(rise).toBeGreaterThan(min - 5);
  });

  it('el rayo Tesla y el mazo son una línea recta en la dirección del ángulo', () => {
    for (const weapon of ['tesla', 'mazo']) {
      const p = preview({ weapon, angle: 20 });
      expect(p.length).toBeGreaterThan(1);
      for (let i = 1; i < p.length; i++) {
        const a = Math.atan2(p[0].y - p[i].y, p[i].x - p[0].x) * (180 / Math.PI);
        expect(a, weapon).toBeCloseTo(20, 4);
      }
    }
  });

  it('nunca produce NaN, ni con potencia 0 ni con ángulos extremos', () => {
    for (const weapon of Object.keys(WEAPONS))
      for (const angle of [-90, 0, 90, 180, 270])
        for (const power of [0, 100])
          for (const pt of preview({ weapon, angle, power }))
            expect(Number.isFinite(pt.x) && Number.isFinite(pt.y), `${weapon} ${angle} ${power}`).toBe(true);
  });
});
