/** Pure helpers for phones and tablets: what to offer to install, how to fit the canvas, when to allow page scroll. */

export interface InstallEnv {
  /** Already running as an installed app (display-mode: standalone | fullscreen, or iOS navigator.standalone). */
  standalone: boolean;
  /** The element Fullscreen API exists (Android, iPad, desktop); false on iPhone Safari. */
  fullscreenApi: boolean;
  /** iPhone / iPad Safari. */
  iosSafari: boolean;
  /** Chrome fired `beforeinstallprompt` (Android) and the prompt can be shown. */
  promptAvailable: boolean;
}

export type InstallMode = 'hidden' | 'ios-steps' | 'prompt' | 'fullscreen';

/** Which action the "Instalar / Pantalla completa" button performs (hidden = no button). */
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

/** FIT: biggest 16:9 box that fits the visible viewport minus the safe-area insets. */
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

/** Scenes where the document may scroll a little so Safari can collapse its bars (never during combat). */
const SCROLLABLE = new Set(['Menu', 'Lab']);
export function needsScrollStrip(o: { standalone: boolean; mobile: boolean; scene: string }): boolean {
  return !o.standalone && o.mobile && SCROLLABLE.has(o.scene);
}
