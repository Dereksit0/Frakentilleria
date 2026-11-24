import { SLOTS } from './data';
import type { Selection } from './stats';

/** Screens that have a "back" action in the creature-building flow. */
type BackScreen = 'lab1' | 'lab2' | 'pass';
type BackTarget = 'menu' | 'lab1';
export type BackMessageKey = 'discard' | 'cancel-match';

export type BackResult =
  | { kind: 'go'; to: BackTarget; keepDraft: boolean }
  | { kind: 'confirm'; to: BackTarget; keepDraft: boolean; message: BackMessageKey };

export interface BackInput {
  screen: BackScreen;
  /** The creature on screen differs from the last confirmed one. */
  dirty: boolean;
}

export const BACK_MESSAGES: Record<
  BackMessageKey,
  { title: string; body: string; stay: string; leave: string }
> = {
  discard: { title: '¿Salir?', body: 'Perderás los cambios', stay: 'Quedarme', leave: 'Salir' },
  'cancel-match': {
    title: '¿Cancelar la partida?',
    body: 'Se perderán las criaturas armadas',
    stay: 'Quedarme',
    leave: 'Salir',
  },
};

export function selectionsEqual(a: Selection | null, b: Selection | null): boolean {
  if (!a || !b) return a === b;
  return SLOTS.every((s) => a[s] === b[s]);
}

/**
 * Decides what "Atrás" (button, Esc, browser/phone back gesture) does.
 *  - Lab J1 → Menu (asks first if there are unsaved changes).
 *  - Lab J2 → Lab J1, keeping J1's confirmed creature and J2's draft: nothing is lost, so no modal.
 *  - Pass-the-device never goes back to a creature screen (it would reveal hidden info): it only cancels to the Menu.
 */
export function resolveBack(input: BackInput): BackResult {
  switch (input.screen) {
    case 'lab1':
      return input.dirty
        ? { kind: 'confirm', to: 'menu', keepDraft: false, message: 'discard' }
        : { kind: 'go', to: 'menu', keepDraft: false };
    case 'lab2':
      return { kind: 'go', to: 'lab1', keepDraft: true };
    case 'pass':
      return { kind: 'confirm', to: 'menu', keepDraft: false, message: 'cancel-match' };
  }
}
