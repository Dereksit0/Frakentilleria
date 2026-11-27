import { describe, expect, it } from 'vitest';
import parts from '../src/data/parts.json';
import {
  AnimMachine,
  ambientState,
  ANIM_DURATION,
  ANIM_STATES,
  fxOnEnter,
  newPose,
  periodicFx,
  pickLine,
  poseAt,
  TAUNTS,
  type AnimState,
} from '../src/ui/model/anim';

const calm = { moving: false, aiming: false, hpRatio: 1, alive: true };

describe('máquina de estados de animación', () => {
  it('arranca en idle', () => {
    expect(new AnimMachine().state).toBe('idle');
  });

  it('el estado ambiente sale de movimiento, apuntado y vida', () => {
    expect(ambientState(calm)).toBe('idle');
    expect(ambientState({ ...calm, moving: true })).toBe('walk');
    expect(ambientState({ ...calm, aiming: true })).toBe('aim');
    expect(ambientState({ ...calm, hpRatio: 0.25 })).toBe('lowHp');
    expect(ambientState({ ...calm, hpRatio: 0.25, moving: true })).toBe('walk');
    expect(ambientState({ ...calm, alive: false })).toBe('idle');
  });

  it('hurt interrumpe idle, walk, aim y lowHp', () => {
    for (const amb of [
      calm,
      { ...calm, moving: true },
      { ...calm, aiming: true },
      { ...calm, hpRatio: 0.1 },
    ]) {
      const m = new AnimMachine();
      m.update(16, amb);
      expect(m.request('hurt')).toBe(true);
      expect(m.state).toBe('hurt');
    }
  });

  it('hurt interrumpe una burla pero una burla no interrumpe hurt', () => {
    const m = new AnimMachine();
    m.request('taunt');
    expect(m.request('hurt')).toBe(true);
    expect(m.request('taunt')).toBe(false);
    expect(m.state).toBe('hurt');
  });

  it('defeat no se interrumpe, ni con el tiempo', () => {
    const m = new AnimMachine();
    expect(m.request('defeat')).toBe(true);
    for (const s of ANIM_STATES.filter((x) => x !== 'defeat')) expect(m.request(s), s).toBe(false);
    m.update(60_000, calm);
    expect(m.state).toBe('defeat');
    expect(m.request('idle')).toBe(false);
  });

  it('victory solo la interrumpe defeat', () => {
    const m = new AnimMachine();
    m.request('victory');
    for (const s of ['hurt', 'taunt', 'fire', 'ability', 'walk'] as AnimState[])
      expect(m.request(s), s).toBe(false);
    expect(m.request('defeat')).toBe(true);
  });

  it('los estados con duración vuelven al ambiente al terminar', () => {
    const m = new AnimMachine();
    m.request('hurt');
    m.update(ANIM_DURATION.hurt - 1, calm);
    expect(m.state).toBe('hurt');
    m.update(2, calm);
    expect(m.state).toBe('idle');
    m.request('taunt');
    m.update(ANIM_DURATION.taunt + 1, { ...calm, moving: true });
    expect(m.state).toBe('walk');
    m.request('fire');
    m.update(ANIM_DURATION.fire + 1, { ...calm, hpRatio: 0.2 });
    expect(m.state).toBe('lowHp');
  });

  it('el estado ambiente se actualiza solo mientras no hay animación con prioridad', () => {
    const m = new AnimMachine();
    m.update(10, { ...calm, moving: true });
    expect(m.state).toBe('walk');
    m.update(10, calm);
    expect(m.state).toBe('idle');
    m.request('fire');
    m.update(10, { ...calm, moving: true });
    expect(m.state).toBe('fire');
  });

  it('la burla dura 1 s (no gasta turno)', () => {
    expect(ANIM_DURATION.taunt).toBe(1000);
  });

  it('un mismo estado con duración se puede reiniciar (golpes seguidos)', () => {
    const m = new AnimMachine();
    m.request('hurt');
    m.update(300, calm);
    expect(m.request('hurt')).toBe(true);
    expect(m.time).toBe(0);
  });
});

describe('poses procedurales', () => {
  const p = newPose();

  it('idle respira unos pocos píxeles', () => {
    let min = 99;
    let max = -99;
    for (let t = 0; t < 4000; t += 20) {
      poseAt(p, 'idle', t, 'armadura', false);
      min = Math.min(min, p.bodyDy);
      max = Math.max(max, p.bodyDy);
    }
    expect(max - min).toBeGreaterThan(1);
    expect(max - min).toBeLessThanOrEqual(6);
  });

  it('devuelve el mismo objeto (sin crear uno por cuadro)', () => {
    expect(poseAt(p, 'walk', 100, 'maniqui', false)).toBe(p);
  });

  it('todas las poses son finitas en todos los estados y variantes', () => {
    const invalidas: string[] = [];
    for (const d of Object.keys(parts.donors))
      for (const s of ANIM_STATES)
        for (const reduced of [false, true])
          for (let t = 0; t <= 4000; t += 37) {
            poseAt(p, s, t, d, reduced);
            for (const [campo, v] of Object.entries(p))
              if (!Number.isFinite(v as number)) invalidas.push(d + ' ' + s + ' ' + t + ' ' + campo);
          }
    expect(invalidas).toEqual([]);
  });

  it('hurt: se arquea hacia atrás, sacude y destella', () => {
    poseAt(p, 'hurt', 90, 'armadura', false);
    expect(p.upperRot).toBeLessThan(-0.05);
    expect(p.flash).toBeGreaterThan(0.5);
    let shake = 0;
    for (let t = 0; t < 300; t += 10) {
      poseAt(p, 'hurt', t, 'armadura', false);
      shake = Math.max(shake, Math.abs(p.bodyDx));
    }
    expect(shake).toBeGreaterThan(2);
  });

  it('hurt con "Reducir efectos": sin sacudida ni destello, pero sí cambia la pose', () => {
    let shake = 0;
    let flash = 0;
    let arch = 0;
    for (let t = 0; t < ANIM_DURATION.hurt; t += 10) {
      poseAt(p, 'hurt', t, 'armadura', true);
      shake = Math.max(shake, Math.abs(p.bodyDx));
      flash = Math.max(flash, p.flash);
      arch = Math.min(arch, p.upperRot);
    }
    expect(shake).toBe(0);
    expect(flash).toBe(0);
    expect(arch).toBeLessThan(-0.02);
  });

  it('con "Reducir efectos" ninguna animación sacude ni destella', () => {
    for (const d of Object.keys(parts.donors))
      for (const s of ANIM_STATES)
        for (let t = 0; t <= 2500; t += 25) {
          poseAt(p, s, t, d, true);
          expect(p.flash, `${d} ${s}`).toBe(0);
          if (s !== 'defeat') expect(Math.abs(p.bodyDx), `${d} ${s} ${t}`).toBeLessThanOrEqual(2);
        }
  });

  it('las poses con duración terminan en la pose neutra', () => {
    for (const s of ['fire', 'hurt', 'taunt', 'ability'] as AnimState[])
      for (const d of Object.keys(parts.donors)) {
        poseAt(p, s, ANIM_DURATION[s], d, false);
        expect(Math.abs(p.bodyDx), `${s} ${d}`).toBeLessThan(0.5);
        expect(Math.abs(p.upperRot), `${s} ${d}`).toBeLessThan(0.03);
        expect(p.squashY).toBeCloseTo(1, 1);
        expect(p.flash).toBe(0);
      }
  });

  it('fire: retroceso y estiramiento', () => {
    poseAt(p, 'fire', 70, 'armadura', false);
    expect(p.bodyDx).toBeLessThan(-2);
    expect(Math.abs(p.squashX - 1)).toBeGreaterThan(0.02);
  });

  it('walk: las piernas se alternan', () => {
    poseAt(p, 'walk', 120, 'armadura', false);
    expect(Math.sign(p.legLRot)).toBe(-Math.sign(p.legRRot));
    expect(Math.abs(p.legLRot)).toBeGreaterThan(0.1);
  });

  it('victory: salta con los brazos arriba', () => {
    let up = 0;
    let armUp = 0;
    for (let t = 0; t < 1200; t += 20) {
      poseAt(p, 'victory', t, 'armadura', false);
      up = Math.min(up, p.bodyDy);
      armUp = Math.min(armUp, p.armRot);
    }
    expect(up).toBeLessThan(-20);
    expect(armUp).toBeLessThan(-0.8);
  });

  it('defeat: la cabeza rueda y el brazo sale volando, y el final es estable', () => {
    poseAt(p, 'defeat', 200, 'armadura', false);
    const early = { hx: p.headDx, ax: p.armDx };
    poseAt(p, 'defeat', ANIM_DURATION.defeat, 'armadura', false);
    const end = { hx: p.headDx, hy: p.headDy, ax: p.armDx, hr: p.headRot };
    expect(Math.abs(end.hx)).toBeGreaterThan(Math.abs(early.hx));
    expect(Math.abs(end.ax)).toBeGreaterThan(20);
    expect(Math.abs(end.hr)).toBeGreaterThan(1);
    poseAt(p, 'defeat', ANIM_DURATION.defeat + 5000, 'armadura', false);
    expect(p.headDx).toBeCloseTo(end.hx, 5);
    expect(p.headDy).toBeCloseTo(end.hy, 5);
  });

  it('lowHp: se encoge un poco y respira más rápido que idle', () => {
    poseAt(p, 'lowHp', 0, 'armadura', false);
    expect(p.squashY).toBeLessThan(1);
    const swing = (s: AnimState) => {
      let a = 99;
      let b = -99;
      for (let t = 0; t < 2000; t += 10) {
        poseAt(p, s, t, 'armadura', false);
        a = Math.min(a, p.torsoScaleY);
        b = Math.max(b, p.torsoScaleY);
      }
      return b - a;
    };
    expect(swing('lowHp')).toBeGreaterThan(swing('idle'));
  });

  it('cada donante de cabeza tiene su burla distinta', () => {
    const snap = (d: string) => {
      poseAt(p, 'taunt', 400, d, false);
      return JSON.stringify(p);
    };
    const set = new Set(Object.keys(parts.donors).map(snap));
    expect(set.size).toBe(5);
  });

  it('juguete baila con pitidos (cambia de compás) y el refrigerador enciende luz azul', () => {
    poseAt(p, 'taunt', 0, 'juguete', false);
    const a = p.beat;
    poseAt(p, 'taunt', 700, 'juguete', false);
    expect(p.beat).toBeGreaterThan(a);
    poseAt(p, 'taunt', 500, 'refri', false);
    expect(p.glow).toBeGreaterThan(0.5);
  });
});

describe('burlas y textos', () => {
  it('cada donante define su variante de burla con frases cortas', () => {
    for (const d of Object.keys(parts.donors)) {
      expect(TAUNTS[d], d).toBeDefined();
      expect(TAUNTS[d].name.length).toBeGreaterThan(2);
    }
  });

  it('pickLine rota de forma determinista y las frases son cortas', () => {
    expect(pickLine('hurt', 0)).toBe('¡Auch!');
    expect(pickLine('hurt', 1)).toBe('¡Eso dolió!');
    expect(pickLine('hurt', 2)).toBe('¡Mis tornillos!');
    expect(pickLine('hurt', 3)).toBe('¡Auch!');
    expect(pickLine('taunt', 0)).toBe('¡Tomaaa!');
    for (const k of ['hurt', 'taunt'] as const)
      for (let i = 0; i < 6; i++) expect(pickLine(k, i).length).toBeLessThanOrEqual(16);
  });

  it('fxOnEnter y periodicFx describen los efectos sin asignar memoria nueva', () => {
    expect(fxOnEnter('hurt', 'armadura')).toContain('stars');
    expect(fxOnEnter('victory', 'armadura')).toContain('confetti');
    expect(fxOnEnter('defeat', 'armadura')).toContain('smoke');
    expect(fxOnEnter('hurt', 'armadura')).toBe(fxOnEnter('hurt', 'armadura'));
    expect(periodicFx('walk', 0, 300)).toBe('dust');
    expect(periodicFx('lowHp', 0, 1300)).toBe('sweat');
    expect(periodicFx('idle', 0, 5000)).toBeNull();
  });
});
