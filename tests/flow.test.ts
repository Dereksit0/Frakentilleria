import { describe, it, expect } from 'vitest';
import { resolveBack, selectionsEqual, BACK_MESSAGES } from '../src/core/flow';
import type { Selection } from '../src/core/stats';

const a: Selection = { head: 'armadura', torso: 'refri', arms: 'maniqui', legs: 'juguete' };

describe('selectionsEqual', () => {
  it('compares the four slots', () => {
    expect(selectionsEqual(a, { ...a })).toBe(true);
    expect(selectionsEqual(a, { ...a, legs: 'refri' })).toBe(false);
    expect(selectionsEqual(null, a)).toBe(false);
    expect(selectionsEqual(null, null)).toBe(true);
  });
});

describe('resolveBack (Atrás / Esc / botón del navegador)', () => {
  it('Lab J1 without changes goes straight to the menu', () => {
    expect(resolveBack({ screen: 'lab1', dirty: false })).toEqual({ kind: 'go', to: 'menu', keepDraft: false });
  });
  it('Lab J1 with changes asks before discarding', () => {
    expect(resolveBack({ screen: 'lab1', dirty: true })).toEqual({
      kind: 'confirm',
      to: 'menu',
      keepDraft: false,
      message: 'discard',
    });
  });
  it('Lab J2 returns to Lab J1 keeping the draft (nothing is lost, so no modal even when dirty)', () => {
    const clean = resolveBack({ screen: 'lab2', dirty: false });
    const dirty = resolveBack({ screen: 'lab2', dirty: true });
    expect(clean).toEqual({ kind: 'go', to: 'lab1', keepDraft: true });
    expect(dirty).toEqual({ kind: 'go', to: 'lab1', keepDraft: true });
  });
  it('the pass-the-device screen can only cancel to the menu, always with confirmation', () => {
    for (const dirty of [true, false]) {
      expect(resolveBack({ screen: 'pass', dirty })).toEqual({
        kind: 'confirm',
        to: 'menu',
        keepDraft: false,
        message: 'cancel-match',
      });
    }
  });
  it('never routes pass -> lab1 (would reveal the hidden creature)', () => {
    expect(resolveBack({ screen: 'pass', dirty: false }).to).toBe('menu');
  });
  it('has Spanish copy with the two buttons', () => {
    expect(BACK_MESSAGES.discard).toEqual({
      title: '¿Salir?',
      body: 'Perderás los cambios',
      stay: 'Quedarme',
      leave: 'Salir',
    });
    expect(BACK_MESSAGES['cancel-match'].stay).toBe('Quedarme');
    expect(BACK_MESSAGES['cancel-match'].leave).toBe('Salir');
  });
});
