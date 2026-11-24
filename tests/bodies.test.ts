import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle';
import { MAPS, WORLD } from '../src/core/data';
import { buildTerrain } from '../src/core/maps';
import { Terrain } from '../src/core/terrain';
import { BODY_GAP, resolveHorizontalMove, separateBodies } from '../src/core/unit';
import type { Selection } from '../src/core/stats';

const SEL: Selection = { head: 'maniqui', torso: 'maniqui', arms: 'armadura', legs: 'maniqui' };
const flat = (): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(700));
function duel(a: number, b: number): Battle {
  const bt = new Battle({ seed: 3, terrain: flat(), spawns: [a, b], selections: [SEL, SEL] });
  bt.rules.spread = false;
  bt.rules.gusts = false;
  bt.wind = 0;
  return bt;
}

describe('resolveHorizontalMove (pura)', () => {
  it('recorta el movimiento contra el cuerpo del rival por ambos lados', () => {
    // mover on the left walks right
    expect(resolveHorizontalMove(100, 300, 500, true)).toBe(300 - BODY_GAP);
    // mover on the right walks left
    expect(resolveHorizontalMove(500, 300, 100, false)).toBe(300 + BODY_GAP);
  });
  it('no recorta si el camino está libre ni si se aleja', () => {
    expect(resolveHorizontalMove(100, 500, 200, true)).toBe(200);
    expect(resolveHorizontalMove(300, 500, 100, true)).toBe(100);
    expect(resolveHorizontalMove(500, 300, 900, false)).toBe(900);
  });
  it('si ya está pegado no avanza más, pero puede retroceder', () => {
    const x = 300 - BODY_GAP;
    expect(resolveHorizontalMove(x, 300, x + 50, true)).toBe(x);
    expect(resolveHorizontalMove(x, 300, x - 50, true)).toBe(x - 50);
  });
  it('si ya están superpuestos solo puede alejarse', () => {
    expect(resolveHorizontalMove(290, 300, 295, true)).toBe(290);
    expect(resolveHorizontalMove(290, 300, 250, true)).toBe(250);
  });
  it('un desplazamiento enorme (efecto túnel) también se recorta', () => {
    expect(resolveHorizontalMove(100, 300, 5000, true)).toBe(300 - BODY_GAP);
    expect(resolveHorizontalMove(900, 300, -5000, false)).toBe(300 + BODY_GAP);
  });
  it('separateBodies deja a cada uno en su lado original, de forma determinista', () => {
    const [l, r] = separateBodies(500, 510);
    expect(r - l).toBeGreaterThanOrEqual(BODY_GAP);
    expect(l).toBeLessThan(r);
    expect(separateBodies(500, 510)).toEqual([l, r]);
    expect(separateBodies(100, 400)).toEqual([100, 400]);
    // identical positions: the left one keeps the left side
    const [a, b] = separateBodies(500, 500);
    expect(a).toBeLessThan(b);
  });
});

describe('cuerpos sólidos en el combate', () => {
  it('no atraviesa al enemigo caminando hacia él', () => {
    const b = duel(500, 800);
    for (let i = 0; i < 600 && b.clock.canMove(); i++) {
      b.move(1, 1 / 60);
      b.update(1 / 60);
    }
    expect(b.units[0].x).toBeLessThanOrEqual(b.units[1].x - BODY_GAP + 1e-6);
    expect(b.units[0].x).toBeGreaterThan(600);
  });

  it('no lo atraviesa con dt grande', () => {
    const b = duel(500, 700);
    for (let i = 0; i < 20; i++) {
      b.move(1, 0.5);
      b.update(0.5);
    }
    expect(b.units[0].x).toBeLessThanOrEqual(b.units[1].x - BODY_GAP + 1e-6);
    expect(b.units[0].x).toBeLessThan(b.units[1].x);
  });

  it('el jugador de la derecha tampoco lo atraviesa', () => {
    const b = duel(500, 800);
    b.forceEndTurn();
    for (let i = 0; i < 600 && b.clock.canMove(); i++) {
      b.move(-1, 1 / 60);
      b.update(1 / 60);
    }
    expect(b.units[1].x).toBeGreaterThanOrEqual(b.units[0].x + BODY_GAP - 1e-6);
  });

  it('el knockback se detiene en el cuerpo del rival', () => {
    const b = duel(500, 620);
    // fling the right creature towards the left one, fast and long
    const u = b.units[1];
    u.vx = -3000;
    u.vy = -200;
    u.grounded = false;
    u.launched = true;
    for (let i = 0; i < 120; i++) b.update(1 / 60);
    expect(b.units[1].x).toBeGreaterThanOrEqual(b.units[0].x + BODY_GAP - 1e-6);
  });

  it('no quedan superpuestos al empezar el turno', () => {
    const b = duel(500, 800);
    b.units[0].x = 640;
    b.units[1].x = 650; // overlapped by some effect
    b.forceEndTurn();
    const [l, r] = b.units;
    expect(r.x - l.x).toBeGreaterThanOrEqual(BODY_GAP - 1e-6);
    expect(l.x).toBeLessThan(r.x);
  });

  it('al crear la partida unos spawns demasiado juntos se separan', () => {
    const b = duel(700, 710);
    expect(b.units[1].x - b.units[0].x).toBeGreaterThanOrEqual(BODY_GAP - 1e-6);
    expect(b.units[0].x).toBeLessThan(b.units[1].x);
  });

  it('caminar contra el rival pegado no gasta el tiempo de movimiento', () => {
    const b = duel(500, 500 + BODY_GAP);
    const before = b.clock.moveLeft;
    for (let i = 0; i < 30; i++) b.move(1, 1 / 60);
    expect(b.clock.moveLeft).toBeCloseTo(before, 6);
  });
});

describe('simulación con el bot: el orden se conserva', () => {
  it('300 partidas con semillas fijas: nunca se invierte el orden ni se superponen', async () => {
    const { runMatch } = await import('../src/core/sim');
    const { loadMapArts } = await import('./helpers/mapArt');
    const arts = await loadMapArts();
    let bad = 0;
    let stuck = 0;
    for (let s = 0; s < 300; s++) {
      const r = runMatch(5000 + s, {
        levels: ['experto', 'experto'],
        arts,
        observe: (b) => {
          const [l, rr] = b.units;
          if (l.alive && rr.alive && (l.x >= rr.x || rr.x - l.x < BODY_GAP - 0.01)) bad++;
        },
      });
      if (r.turns >= 120) stuck++;
    }
    expect(bad).toBe(0);
    expect(stuck).toBe(0);
    expect(MAPS.length).toBeGreaterThan(0);
    expect(WORLD.width).toBe(1600);
    expect(buildTerrain).toBeTypeOf('function');
  }, 600_000);
});
