/** Detección automática del dispositivo (sin botones): ventana angosta, o puntero táctil con el lado corto de 600 o menos. */
export function detectMobile(w: number, h: number, coarsePointer: boolean): boolean {
  return w <= 900 || (coarsePointer && Math.min(w, h) <= 600);
}

export function isMobile(): boolean {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return detectMobile(window.innerWidth, window.innerHeight, coarse);
}
