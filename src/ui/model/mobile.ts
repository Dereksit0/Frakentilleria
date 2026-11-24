/** Utilidades para teléfonos y tabletas: qué ofrecer para instalar, cómo ajustar el canvas y cuándo dejar que la página haga scroll. */

export interface InstallEnv {
  /** Ya corre como app instalada (display-mode standalone o fullscreen, o navigator.standalone de iOS). */
  standalone: boolean;
  /** Existe la API de pantalla completa por elemento (Android, iPad, escritorio); false en Safari de iPhone. */
  fullscreenApi: boolean;
  /** Safari de iPhone o iPad. */
  iosSafari: boolean;
  /** Chrome disparó `beforeinstallprompt` (Android) y se puede mostrar el aviso. */
  promptAvailable: boolean;
}

export type InstallMode = 'hidden' | 'ios-steps' | 'prompt' | 'fullscreen';

/** Qué acción hace el botón "Instalar / Pantalla completa" (hidden = sin botón). */
export function installMode(e: InstallEnv): InstallMode {
  if (e.standalone) return 'hidden';
  if (e.promptAvailable) return 'prompt';
  if (e.fullscreenApi) return 'fullscreen';
  if (e.iosSafari) return 'ios-steps';
  return 'hidden';
}

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** FIT: la caja 16:9 más grande que cabe en el área visible menos los márgenes seguros. */
export function fitScale(
  vw: number,
  vh: number,
  insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 },
  W = 1600,
  H = 900,
): { scale: number; width: number; height: number } {
  const aw = Math.max(1, vw - insets.left - insets.right);
  const ah = Math.max(1, vh - insets.top - insets.bottom);
  const scale = Math.min(aw / W, ah / H);
  return { scale, width: W * scale, height: H * scale };
}

/** Escenas donde la página puede hacer un poco de scroll para que Safari esconda sus barras (nunca en combate). */
const SCROLLABLE = new Set(['Menu', 'Lab']);
export function needsScrollStrip(o: { standalone: boolean; mobile: boolean; scene: string }): boolean {
  return !o.standalone && o.mobile && SCROLLABLE.has(o.scene);
}
