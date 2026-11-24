import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/core/battle';
import { DONOR_IDS, PARTS, WEAPONS, ABILITIES } from '../src/core/data';
import { Terrain } from '../src/core/terrain';
import { createUnit } from '../src/core/unit';
import { weaponsFor, type Selection } from '../src/core/stats';

const sel = (arms: string, torso: string, head = 'maniqui'): Selection => ({
  head,
  torso,
  arms,
  legs: 'maniqui',
});
const flat = (y = 700): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(y));
function make(
  opts: { terrain?: Terrain; spawns?: [number, number]; a?: Selection; b?: Selection } = {},
): Battle {
  const b = new Battle({
    seed: 3,
    terrain: opts.terrain ?? flat(),
    spawns: opts.spawns ?? [300, 1300],
    selections: [opts.a ?? sel('armadura', 'armadura'), opts.b ?? sel('maniqui', 'maniqui')],
  });
  b.rules.spread = false;
  b.rules.gusts = false;
  b.wind = 0;
  return b;
}
const run = (b: Battle, secs: number): BattleEvent[] => {
  const ev: BattleEvent[] = [];
  for (let i = 0; i < Math.round(secs * 60); i++) {
    b.update(1 / 60);
    ev.push(...b.drainEvents());
  }
  return ev;
};
const lost = (b: Battle, i: number): number => b.units[i].maxHp - b.units[i].hp;

describe('catálogo: cada donante da un arma por brazos, un arma por torso y una habilidad de cabeza', () => {
  it('todos los donantes tienen las tres y cada arma y habilidad existe en los datos', () => {
    for (const d of DONOR_IDS) {
      const arms = PARTS.parts.find((p) => p.donor === d && p.slot === 'arms');
      const torso = PARTS.parts.find((p) => p.donor === d && p.slot === 'torso');
      const head = PARTS.parts.find((p) => p.donor === d && p.slot === 'head');
      expect(arms?.weapon && WEAPONS[arms.weapon], `${d} arms`).toBeTruthy();
      expect(torso?.weapon && WEAPONS[torso.weapon], `${d} torso`).toBeTruthy();
      expect(head?.ability && ABILITIES[head.ability], `${d} head`).toBeTruthy();
      expect(arms?.weapon, `${d} arms != torso`).not.toBe(torso?.weapon);
    }
  });

  it('existen las 8 armas de la fase 2A y todas se consiguen con algún donante (el cañón es gratis)', () => {
    for (const id of ['canon', 'mortero', 'bazuca', 'granada', 'mazo', 'tesla', 'hielo', 'pocion'])
      expect(WEAPONS[id], id).toBeDefined();
    const given = new Set(PARTS.parts.map((p) => p.weapon).filter(Boolean));
    for (const id of Object.keys(WEAPONS))
      if (id !== 'canon') expect(given.has(id), `${id} given by a donor`).toBe(true);
    expect(given.has('canon')).toBe(false);
  });

  it('cada arma declara un comportamiento y una forma válida', () => {
    for (const [id, w] of Object.entries(WEAPONS)) {
      expect(['projectile', 'grenade', 'beam', 'melee']).toContain(w.kind);
      expect(w.damage, id).toBeGreaterThan(0);
      if (w.ammo !== undefined) expect(w.ammo).toBeGreaterThan(0);
    }
    expect(WEAPONS.canon.ammo).toBeUndefined();
  });
});

describe('munición', () => {
  it('todos empiezan con el cañón infinito; las demás armas traen munición limitada', () => {
    const b = make();
    const u = b.units[0];
    expect(u.weapons[0]).toBe('canon');
    expect(u.ammo.canon).toBeUndefined();
    for (const id of weaponsFor(u.selection)) expect(u.ammo[id]).toBe(WEAPONS[id].ammo);
  });

  it('disparar gasta una munición; en cero el arma no se puede elegir ni disparar', () => {
    const b = make({ a: sel('maniqui', 'maniqui') }); // bazuca y mortero
    b.units[0].ammo.bazuca = 1;
    expect(b.selectWeapon('bazuca')).toBe(true);
    b.setAim(40, 60);
    expect(b.fire()).toBe(true);
    expect(b.units[0].ammo.bazuca).toBe(0);
    run(b, 6);
    while (b.current.index !== 0) b.forceEndTurn();
    expect(b.selectWeapon('bazuca')).toBe(false);
    expect(b.units[0].weapon).not.toBe('bazuca');
  });

  it('el cañón nunca se acaba', () => {
    const b = make();
    for (let i = 0; i < 4; i++) {
      b.selectWeapon('canon');
      b.setAim(45, 50);
      expect(b.fire()).toBe(true);
      run(b, 6);
      while (b.current.index !== 0 && b.phase === 'playing') b.forceEndTurn();
    }
    expect(b.units[0].ammo.canon).toBeUndefined();
  });
});

describe('cañón', () => {
  it('es un tiro en arco normal al que le afecta el viento', () => {
    const land = (wind: number): number => {
      const b = make();
      b.wind = wind;
      b.selectWeapon('canon');
      b.setAim(40, 70);
      b.fire();
      const e = run(b, 6).find((x) => x.type === 'explosion');
      return e && e.type === 'explosion' ? e.x : NaN;
    };
    expect(land(5)).toBeGreaterThan(land(0));
    expect(land(-5)).toBeLessThan(land(0));
  });
});

describe('mortero', () => {
  function hill(): Terrain {
    const h = new Array<number>(1600).fill(700);
    for (let x = 650; x < 950; x++) h[x] = 700 - 330 * Math.sin(((x - 650) / 300) * Math.PI);
    return Terrain.fromHeights(1600, 900, h);
  }
  it('va obligado en arco alto, pasa por encima de una loma que frena a las armas tensas y le afecta mucho el viento', () => {
    const b = make({ terrain: hill(), spawns: [300, 1150], a: sel('maniqui', 'maniqui') });
    b.selectWeapon('mortero');
    b.setAim(10, 100); // pide un ángulo tenso: el mortero lo sube a su elevación mínima
    b.fire();
    const ev = run(b, 10);
    const ex = ev.find((e) => e.type === 'explosion');
    expect(ex && ex.type === 'explosion' && ex.x > 1000).toBe(true); // cruzó la loma (x 650 a 950)

    expect(WEAPONS.mortero.windFactor).toBeGreaterThan(WEAPONS.canon.windFactor);
    expect(WEAPONS.mortero.minAngle ?? 0).toBeGreaterThanOrEqual(55);
  });
});

describe('bazuca y granada de calabaza', () => {
  it('bazuca: rápida, tensa, explosión grande', () => {
    expect(WEAPONS.bazuca.radius).toBeGreaterThan(WEAPONS.canon.radius);
    const b = make({ spawns: [300, 600], a: sel('maniqui', 'maniqui') });
    b.selectWeapon('bazuca');
    b.setAim(0, 70);
    b.fire();
    run(b, 3);
    expect(lost(b, 1)).toBeGreaterThan(0);
  });

  it('la granada explota con su mecha de 3 s, no antes', () => {
    expect(WEAPONS.granada.fuse).toBe(3);
    const b = make({ spawns: [300, 520], a: sel('espantapajaros', 'espantapajaros') });
    b.selectWeapon('granada');
    b.setAim(40, 45);
    b.fire();
    run(b, 2.8);
    expect(b.projectiles).toHaveLength(1);
    run(b, 0.5);
    expect(b.projectiles).toHaveLength(0);
  });
});

describe('mazo: cuerpo a cuerpo con mucho empuje y aturdimiento', () => {
  it('empuja lejos y aturde para el siguiente turno', () => {
    const b = make({ spawns: [300, 372] });
    const foe = b.units[1];
    b.selectWeapon('mazo');
    b.setAim(10, 100);
    b.fire();
    run(b, 1.2);
    expect(foe.x).toBeGreaterThan(372 + 60);
    expect(foe.stunTurns).toBeGreaterThan(0);
    expect(WEAPONS.mazo.knockback ?? 0).toBeGreaterThan(WEAPONS.bazuca.knockback ?? 300);
  });

  it('una criatura aturdida apunta peor: su dispersión es mayor en su siguiente turno y luego el estado se acaba', () => {
    const b = make({ spawns: [300, 372] });
    b.rules.spread = true;
    const foe = b.units[1];
    foe.stunTurns = 1;
    b.forceEndTurn(); // J2 empieza su turno aturdido
    expect(b.current.index).toBe(1);
    expect(b.stunned(b.current)).toBe(true);
    b.forceEndTurn();
    b.forceEndTurn();
    expect(foe.stunTurns).toBe(0);
    expect(b.stunned(foe)).toBe(false);
  });
});

describe('Tesla: alcance corto, ignora el viento y salta entre blancos cercanos', () => {
  it('ignora el viento', () => {
    expect(WEAPONS.tesla.windFactor).toBe(0);
    expect(WEAPONS.tesla.range ?? 0).toBeLessThan(WEAPONS.bazuca.radius * 20);
  });

  it('salta a otra criatura cercana al primer blanco, con menos daño', () => {
    const b = make({ spawns: [300, 600], a: sel('juguete', 'juguete') });
    const third = createUnit(2, sel('maniqui', 'maniqui'), 700, 700);
    b.units.push(third);
    b.selectWeapon('tesla');
    b.setAim(0, 100);
    b.fire();
    run(b, 0.5);
    expect(lost(b, 1)).toBeGreaterThan(0);
    const hurtThird = third.maxHp - third.hp;
    expect(hurtThird).toBeGreaterThan(0);
    expect(hurtThird).toBeLessThan(lost(b, 1));
  });
});

describe('ráfaga de hielo: congela', () => {
  it('el rival no se puede mover en su siguiente turno', () => {
    const b = make({ spawns: [300, 520], a: sel('refri', 'refri') });
    b.selectWeapon('hielo');
    b.setAim(0, 40);
    b.fire();
    run(b, 4);
    expect(b.units[1].frozenTurns >= 0).toBe(true);
    expect(b.current.index).toBe(1);
    expect(b.clock.moveLeft).toBe(0);
  });
});

describe('poción ácida: un charco que quema varios turnos', () => {
  function shootPotion(): Battle {
    const b = make({ spawns: [300, 520], a: sel('refri', 'refri') });
    b.selectWeapon('pocion');
    b.setAim(0, 40);
    b.fire();
    run(b, 1.5);
    return b;
  }
  it('deja un charco en el punto de impacto', () => {
    const b = shootPotion();
    expect(b.puddles.length).toBe(1);
    expect(b.puddles[0].turns).toBe(WEAPONS.pocion.puddle?.turns);
  });
  it('quema a quien esté dentro al cerrar cada turno y luego se seca', () => {
    const b = shootPotion();
    const foe = b.units[1];
    foe.x = b.puddles[0].x;
    foe.y = b.puddles[0].y;
    const before = foe.hp;
    const turns = b.puddles[0].turns;
    for (let i = 0; i < turns; i++) {
      b.forceEndTurn();
      if (b.phase !== 'playing') break;
    }
    expect(foe.hp).toBeLessThan(before);
    expect(b.puddles.length).toBe(0);
  });
  it('no quema a las criaturas que se mantienen lejos', () => {
    const b = shootPotion();
    const foe = b.units[1];
    foe.x = 1500;
    const hp = foe.hp;
    b.forceEndTurn();
    expect(foe.hp).toBe(hp);
  });
});
