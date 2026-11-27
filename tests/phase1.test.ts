import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/core/battle';
import { aimSpread, neutralAim } from '../src/core/aim';
import { TUNING } from '../src/core/tuning';
import { WEAPONS } from '../src/core/data';
import { Terrain } from '../src/core/terrain';
import type { Selection } from '../src/core/stats';

const sel = (arms: string, torso: string, head = 'maniqui'): Selection => ({
  head,
  torso,
  arms,
  legs: 'maniqui',
});
const flat = (y = 700): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(y));
function make(
  opts: { terrain?: Terrain; spawns?: [number, number]; seed?: number; a?: Selection; b?: Selection } = {},
): Battle {
  return new Battle({
    seed: opts.seed ?? 3,
    terrain: opts.terrain ?? flat(),
    spawns: opts.spawns ?? [300, 1300],
    selections: [opts.a ?? sel('armadura', 'armadura'), opts.b ?? sel('maniqui', 'maniqui')],
  });
}
const run = (b: Battle, secs: number): BattleEvent[] => {
  const ev: BattleEvent[] = [];
  for (let i = 0; i < Math.round(secs * 60); i++) {
    b.update(1 / 60);
    ev.push(...b.drainEvents());
  }
  return ev;
};
const explosions = (ev: BattleEvent[]) =>
  ev.filter((e): e is Extract<BattleEvent, { type: 'explosion' }> => e.type === 'explosion');

describe('1b puntería neutra', () => {
  it('cada turno empieza con el ángulo y la potencia neutros, mirando al rival', () => {
    const b = make();
    b.setAim(80, 95);
    b.forceEndTurn(); // juega J2
    expect(b.current.index).toBe(1);
    expect(b.current.aimAngle).toBeCloseTo(180 - TUNING.aim.angle, 5);
    expect(b.current.aimPower).toBe(TUNING.aim.power);
    b.forceEndTurn(); // vuelve J1
    expect(b.current.aimAngle).toBeCloseTo(TUNING.aim.angle, 5);
    expect(b.current.aimPower).toBe(TUNING.aim.power);
  });

  it('neutralAim refleja el ángulo para una criatura que está a la derecha', () => {
    expect(neutralAim(1).angle).toBe(TUNING.aim.angle);
    expect(neutralAim(-1).angle).toBe(180 - TUNING.aim.angle);
  });
});

describe('1a ráfagas de viento', () => {
  it('el viento es fijo en el turno; las ráfagas cambian poco a poco durante el vuelo y no se salen del límite', () => {
    const b = make();
    expect(b.windNow).toBe(b.wind);
    b.selectWeapon('mazo');
    b.setAim(90, 100);
    b.selectWeapon(b.current.weapons.find((w) => WEAPONS[w].kind === 'projectile') ?? b.current.weapons[0]);
    b.fire();
    const seen: number[] = [];
    for (let i = 0; i < 120; i++) {
      b.update(1 / 60);
      seen.push(b.windNow - b.wind);
    }
    expect(Math.max(...seen.map(Math.abs))).toBeLessThanOrEqual(TUNING.wind.gustMax + 1e-9);
    expect(new Set(seen.map((x) => x.toFixed(3))).size).toBeGreaterThan(1);
    // Gradual: nunca salta más de un paso de ráfaga entre cuadros.
    for (let i = 1; i < seen.length; i++)
      expect(Math.abs(seen[i] - seen[i - 1])).toBeLessThanOrEqual(TUNING.wind.gustStep + 1e-9);
  });

  it('las ráfagas son iguales con la misma semilla y se reinician al cambiar de turno', () => {
    const trace = (seed: number): number[] => {
      const b = make({ seed });
      b.setAim(80, 100);
      b.fire();
      const out: number[] = [];
      for (let i = 0; i < 90; i++) {
        b.update(1 / 60);
        out.push(b.windNow);
      }
      return out;
    };
    expect(trace(5)).toEqual(trace(5));
    const b = make();
    b.setAim(80, 100);
    b.fire();
    run(b, 6);
    expect(b.windNow).toBe(b.wind);
  });
});

describe('1c dispersión', () => {
  it('crece con la potencia y con lo que se caminó en el turno, según el arma', () => {
    const w = 'bazuca';
    expect(aimSpread(w, 100, 0)).toBeGreaterThan(aimSpread(w, 30, 0));
    expect(aimSpread(w, 60, 400)).toBeGreaterThan(aimSpread(w, 60, 0));
    expect(aimSpread(w, 60, 0)).toBeGreaterThan(0);
  });

  it('toda arma de proyectil declara una dispersión; el cuerpo a cuerpo no', () => {
    for (const [id, def] of Object.entries(WEAPONS)) {
      if (def.kind === 'melee') continue;
      expect(def.spread, id).toBeDefined();
      expect(def.spread!.base).toBeGreaterThanOrEqual(0);
    }
    expect(aimSpread('mazo', 100, 500)).toBe(0);
  });

  it('la misma puntería cae en lugares distintos con otras semillas, y igual si se apaga la dispersión', () => {
    const landing = (seed: number, off = false): number => {
      const b = make({ seed });
      if (off) {
        b.rules.spread = false;
        b.rules.gusts = false;
      }
      b.wind = 0;
      b.selectWeapon('bazuca');
      b.setAim(40, 90);
      b.fire();
      return explosions(run(b, 6))[0].x;
    };
    const xs = new Set([1, 2, 3, 4, 5, 6].map((s) => Math.round(landing(s))));
    expect(xs.size).toBeGreaterThan(2);
    expect(landing(1, true)).toBe(landing(2, true));
  });

  it('caminar antes de disparar abre la dispersión', () => {
    const spreadOf = (walk: boolean): number => {
      const xs: number[] = [];
      for (let seed = 1; seed <= 24; seed++) {
        const b = make({ seed, terrain: flat() });
        b.wind = 0;
        b.selectWeapon('bazuca');
        if (walk) {
          b.units[0].x = 300;
          b.move(1, 3);
          b.units[0].x = 300; // se conserva la geometría: lo que importa es la distancia caminada
          b.units[0].moved = 450;
        }
        b.setAim(40, 90);
        b.fire();
        xs.push(explosions(run(b, 6))[0].x);
      }
      const mean = xs.reduce((a, x) => a + x, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
    };
    expect(spreadOf(true)).toBeGreaterThan(spreadOf(false));
  });
});

describe('1d empuje y bordes mortales', () => {
  it('una explosión junto a una criatura la lanza lejos del estallido', () => {
    const b = make({ spawns: [300, 600] });
    b.rules.spread = false;
    b.wind = 0;
    const foe = b.units[1];
    const x0 = foe.x;
    b.selectWeapon('bazuca');
    b.setAim(0, 55);
    b.fire();
    run(b, 1.5);
    expect(foe.x).toBeGreaterThan(x0 + 5);
  });

  it('una criatura lanzada más allá del borde del mundo muere al instante (vacío)', () => {
    const b = make({ spawns: [300, 1560] });
    b.rules.spread = false;
    const foe = b.units[1];
    foe.hp = 1000;
    foe.maxHp = 1000;
    foe.vx = 900;
    foe.vy = -300;
    foe.grounded = false;
    foe.launched = true;
    foe.peakY = foe.y;
    const ev = run(b, 2);
    expect(foe.alive).toBe(false);
    expect(ev.some((e) => e.type === 'death' && e.unit === 1 && e.cause === 'void')).toBe(true);
  });

  it('una criatura que toca el ácido muere de inmediato, sin importar su vida', () => {
    const t = flat(700);
    const b = make({ terrain: t, spawns: [300, 1300] });
    b.rules.spread = false;
    const foe = b.units[1];
    foe.hp = 500;
    foe.maxHp = 500;
    b.units[0].y = 600; // se queda sobre el ácido
    b.acidLevelOverride = 650; // el ácido sobre los pies del rival
    b.forceEndTurn();
    const ev = run(b, 0.2);
    expect(foe.alive).toBe(false);
    expect(ev.some((e) => e.type === 'death' && e.unit === 1 && e.cause === 'acid')).toBe(true);
  });
});

describe('1e caída del daño y cráteres', () => {
  it('el daño baja con la distancia al centro de la explosión', () => {
    const hurt = (gap: number): number => {
      const b = make({ spawns: [300, 600] });
      b.rules.spread = false;
      const foe = b.units[1];
      foe.x = 600;
      b.wind = 0;
      b.selectWeapon('bazuca');
      // Apunta directo a un punto `gap` px delante del rival.
      b.units[0].x = 600 - gap - 100;
      b.setAim(0, 100);
      b.fire();
      run(b, 2);
      return foe.maxHp - foe.hp;
    };
    expect(hurt(0)).toBeGreaterThanOrEqual(hurt(40));
  });

  it('el mismo tiro no cae en el mismo lugar después de abrir un cráter', () => {
    const b = make();
    b.rules.spread = false;
    b.rules.gusts = false;
    b.wind = 0;
    const shoot = (): number => {
      b.selectWeapon('bazuca');
      b.setAim(35, 70);
      b.units[b.current.index].x = b.current.index === 0 ? 300 : 1300;
      b.fire();
      return explosions(run(b, 5))[0].x;
    };
    const first = shoot();
    while (b.current.index !== 0) b.forceEndTurn();
    b.wind = 0;
    const second = shoot();
    expect(Math.abs(first - second)).toBeGreaterThan(1);
  });
});

describe('1f cobertura', () => {
  function moundWorld(): { b: Battle } {
    const heights = new Array<number>(1600).fill(700);
    for (let x = 700; x < 900; x++) heights[x] = 700 - 260 * Math.sin(((x - 700) / 200) * Math.PI); // una loma entre los dos
    const b = make({ terrain: Terrain.fromHeights(1600, 900, heights), spawns: [300, 1100] });
    b.rules.spread = false;
    b.wind = 0;
    return { b };
  }

  it('un tiro tenso lo frena el montículo: la criatura de atrás no recibe nada', () => {
    const { b } = moundWorld();
    const foe = b.units[1];
    b.selectWeapon('bazuca');
    b.setAim(8, 60);
    b.fire();
    run(b, 5);
    expect(foe.hp).toBe(foe.maxHp);
  });

  it('un arco alto pasa el montículo y alcanza a la criatura de atrás', () => {
    const { b } = moundWorld();
    const foe = b.units[1];
    b.selectWeapon('bazuca');
    let best = 0;
    for (let p = 60; p <= 100; p += 2) {
      const c = moundWorld().b;
      c.selectWeapon('bazuca');
      c.setAim(70, p);
      c.fire();
      run(c, 8);
      best = Math.max(best, c.units[1].maxHp - c.units[1].hp);
    }
    expect(best).toBeGreaterThan(0);
    expect(foe.hp).toBe(foe.maxHp);
  });

  it('el terreno entre la explosión y la criatura reduce el daño', () => {
    const open = make({ spawns: [300, 380] });
    open.rules.spread = false;
    const walled = (() => {
      const heights = new Array<number>(1600).fill(700);
      for (let x = 330; x < 350; x++) heights[x] = 380;
      const b = make({ terrain: Terrain.fromHeights(1600, 900, heights), spawns: [300, 380] });
      b.rules.spread = false;
      return b;
    })();
    for (const b of [open, walled]) {
      b.wind = 0;
      b.selectWeapon('bazuca');
      b.units[0].x = 300;
      b.setAim(25, 100);
      b.fire();
      run(b, 4);
    }
    const loss = (b: Battle): number => b.units[1].maxHp - b.units[1].hp;
    expect(loss(walled)).toBeLessThanOrEqual(loss(open));
  });
});

describe('vista previa', () => {
  it('muestra solo un tramo corto del arco', () => {
    expect(TUNING.preview.seconds).toBeGreaterThan(0);
    expect(TUNING.preview.seconds).toBeLessThan(1);
  });
});
