import { SLOTS } from './data';
import type { Selection } from './stats';

/** Pantallas del armado de criaturas que tienen acción de "atrás". */
type BackScreen = 'lab1' | 'lab2' | 'pass';
type BackTarget = 'menu' | 'lab1';
export type BackMessageKey = 'discard' | 'cancel-match';

export type BackResult =
  | { kind: 'go'; to: BackTarget; keepDraft: boolean }
  | { kind: 'confirm'; to: BackTarget; keepDraft: boolean; message: BackMessageKey };

export interface BackInput {
  screen: BackScreen;
  /** La criatura en pantalla es distinta de la última confirmada. */
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
 * Decide qué hace "Atrás" (botón, Esc, gesto del navegador o del teléfono).
 *  - Lab J1: vuelve al Menú (pregunta antes si hay cambios sin guardar).
 *  - Lab J2: vuelve al Lab de J1 y conserva la criatura confirmada de J1 y el borrador de J2, así que no hay modal.
 *  - Pasa el dispositivo nunca vuelve a una pantalla de criatura (mostraría la del otro): solo cancela al Menú.
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
