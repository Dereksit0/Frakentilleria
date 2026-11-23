/** Automatic device detection (no buttons): narrow window, or touch pointer with a short side <= 600. */
export function detectMobile(w: number, h: number, coarsePointer: boolean): boolean {
  return w <= 900 || (coarsePointer && Math.min(w, h) <= 600);
}

export function isMobile(): boolean {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return detectMobile(window.innerWidth, window.innerHeight, coarse);
}
