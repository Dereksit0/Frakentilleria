import { describe, expect, it } from 'vitest';
import { Battle, type BattleEvent } from '../src/core/battle';
import { WEAPONS } from '../src/core/data';
import { Terrain } from '../src/core/terrain';
import { TUNING } from '../src/core/tuning';
import { UNIT_RADIUS } from '../src/core/unit';
import type { Selection } from '../src/core/stats';

/** Los brazos de Armadura traen el Mazo de justa. */
const MACE: Selection = { head: 'maniqui', torso: 'maniqui', arms: 'armadura', legs: 'maniqui' };
const flat = (): Terrain => Terrain.fromHeights(1600, 900, new Array(1600).fill(700));

function duel(gap: number, firstX = 600): Battle {
  const b = new Battle({
    seed: 3,
    terrain: flat(),
    spawns: [firstX, firstX + gap],
    selections: [MACE, MACE],
  });
  b.rules.spread = false;
  b.rules.gusts = false;
  b.wind = 0;
  return b;
}
const lost = (b: Battle, i: number): number => b.units[i].maxHp - b.units[i].hp;
function strike(b: Battle, angle: number): BattleEvent[] {
  b.selectWeapon('mazo');
  b.setAim(angle, 50);
  b.fire();
  const ev = b.drainEvents();
  for (let i = 0; i < 90; i++) b.update(1 / 60);
  return ev.concat(b.drainEvents());
}

describe('Mazo de justa: golpe delante del atacante', () => {
  it('un rival adyacente en el arco recibe daño y empuje, y el atacante no', () => {
    const b = duel(100);
    const x0 = b.units[1].x;
    strike(b, 0);
    expect(lost(b, 1)).toBeGreaterThan(0);
    expect(b.units[1].x).toBeGreaterThan(x0); // empujado lejos del atacante
    expect(lost(b, 0)).toBe(0);
    expect(b.units[0].launched).toBe(false);
  });

  it('el atacante no recibe daño ni empuje ni aturdimiento aunque esté pegado al rival', () => {
    for (const gap of [60, 80, 100, 130]) {
      const b = duel(gap);
      const x0 = b.units[0].x;
      strike(b, 0);
      expect(lost(b, 0), `gap ${gap}`).toBe(0);
      expect(b.units[0].x, `gap ${gap}`).toBeCloseTo(x0, 5);
      expect(b.units[0].stunTurns, `gap ${gap}`).toBe(0);
    }
  });

  it('un rival fuera del alcance no recibe nada', () => {
    const reach = WEAPONS.mazo.range! + UNIT_RADIUS * 0.5;
    const b = duel(Math.round(reach) + 40);
    strike(b, 0);
    expect(lost(b, 1)).toBe(0);
    expect(lost(b, 0)).toBe(0);
  });

  it('un rival justo dentro del alcance sí recibe daño', () => {
    const reach = WEAPONS.mazo.range! + UNIT_RADIUS * 0.5;
    const b = duel(Math.round(reach) - 10);
    strike(b, 0);
    expect(lost(b, 1)).toBeGreaterThan(0);
  });

  it('un rival detrás del atacante no recibe nada (apuntando al lado contrario)', () => {
    const b = duel(100);
    strike(b, 180); // golpea hacia el lado contrario al rival
    expect(lost(b, 1)).toBe(0);
    expect(lost(b, 0)).toBe(0);
  });

  it('apuntar arriba o abajo cambia el arco', () => {
    const level = duel(100);
    strike(level, 0);
    expect(lost(level, 1)).toBeGreaterThan(0);
    const up = duel(100);
    strike(up, 90); // hacia arriba: un rival al lado queda fuera del arco
    expect(lost(up, 1)).toBe(0);
    const down = duel(100);
    strike(down, -90);
    expect(lost(down, 1)).toBe(0);
  });

  it('un rival ligeramente más arriba entra en el arco si se apunta hacia él', () => {
    const b = duel(100);
    b.units[1].y -= 40; // parado en un escalón pequeño
    strike(b, 15);
    expect(lost(b, 1)).toBeGreaterThan(0);
  });

  it('funciona a ambos lados: J1 volteado a la izquierda y J2 a la derecha', () => {
    // J1 a la derecha de J2, golpeando hacia la izquierda.
    const left = duel(100);
    left.units[0].x = 700;
    left.units[1].x = 600;
    strike(left, 180);
    expect(lost(left, 1)).toBeGreaterThan(0);
    expect(left.units[1].x).toBeLessThan(600); // empujado a la izquierda, lejos del atacante
    expect(lost(left, 0)).toBe(0);
    // J2 (a la derecha) golpeando a J1 hacia la izquierda.
    const right = duel(100);
    right.forceEndTurn();
    strike(right, 180);
    expect(lost(right, 0)).toBeGreaterThan(0);
    expect(lost(right, 1)).toBe(0);
  });

  it('el alcance y el arco viven en datos', () => {
    expect(WEAPONS.mazo.range).toBeGreaterThan(0);
    expect((WEAPONS.mazo as { arc?: number }).arc).toBeGreaterThan(0);
  });
});

describe('autocolisión de los proyectiles al aparecer', () => {
  it('la gracia de salida está en datos', () => {
    expect(TUNING.spawnGrace.seconds).toBeGreaterThan(0);
  });

  it('un proyectil disparado contra el suelo pegado al dueño no lo daña al salir', () => {
    const SHOOTER: Selection = { head: 'maniqui', torso: 'armadura', arms: 'maniqui', legs: 'maniqui' }; // bazuca (torso Armadura)
    const b = new Battle({ seed: 3, terrain: flat(), spawns: [300, 1300], selections: [SHOOTER, SHOOTER] });
    b.rules.spread = false;
    b.rules.gusts = false;
    b.wind = 0;
    b.selectWeapon('bazuca');
    b.setAim(-80, 50); // directo al suelo, a los pies
    b.fire();
    for (let i = 0; i < 240; i++) b.update(1 / 60);
    const hurtByOwnShot = b.units[0].maxHp - b.units[0].hp;
    // El tiro explotó en el terreno dentro del margen de gracia: el dueño no recibe nada.
    expect(hurtByOwnShot).toBe(0);
  });
});

describe('ningún arma daña a su dueño con el rival fuera de alcance', () => {
  const ALL = Object.keys(WEAPONS);
  for (const id of ALL) {
    it(`${id}: apuntando al rival lejano el dueño no recibe daño al disparar`, () => {
      const owner: Selection = { head: 'maniqui', torso: 'maniqui', arms: 'maniqui', legs: 'maniqui' };
      const b = new Battle({ seed: 5, terrain: flat(), spawns: [200, 1450], selections: [owner, owner] });
      b.rules.spread = false;
      b.rules.gusts = false;
      b.wind = 0;
      b.units[0].weapons = [id];
      b.units[0].ammo = {};
      expect(b.selectWeapon(id), id).toBe(true);
      b.setAim(40, 70);
      b.fire();
      // Solo importan los primeros instantes: salida, boquilla y el primer rebote.
      for (let i = 0; i < 40; i++) b.update(1 / 60);
      expect(b.units[0].maxHp - b.units[0].hp, id).toBe(0);
      expect(b.units[0].stunTurns, id).toBe(0);
    });
  }
});
