/** Pantalla completa (API estándar y con prefijo webkit). Los navegadores solo la permiten desde un gesto del usuario. */
type FsDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsEl = HTMLElement & { webkitRequestFullscreen?: (o?: unknown) => Promise<void> | void };

/** True en Safari de iPhone y iPad, donde la API no existe para elementos normales. */
export function isIOSUserAgent(ua: string, maxTouchPoints = 0): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

export function isIOS(): boolean {
  return isIOSUserAgent(navigator.userAgent, navigator.maxTouchPoints);
}

export function fullscreenSupported(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

/** Hay que llamarla dentro de un gesto del usuario. No lanza errores. */
export async function enterFullscreen(): Promise<boolean> {
  if (!fullscreenSupported() || isFullscreen()) return isFullscreen();
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else await el.webkitRequestFullscreen?.();
  } catch {
    return false;
  }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape');
  } catch {
    /* bloquear la orientación es opcional y muchas veces no se puede */
  }
  return true;
}

async function exitFullscreen(): Promise<void> {
  const d = document as FsDoc;
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else await d.webkitExitFullscreen?.();
  } catch {
    /* ignore */
  }
}

export function toggleFullscreen(): void {
  void (isFullscreen() ? exitFullscreen() : enterFullscreen());
}

/** Llama a fn en cada cambio de pantalla completa (nombres estándar y webkit). Devuelve la función para dejar de escuchar. */
export function onFullscreenChange(fn: () => void): () => void {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
  return () => {
    document.removeEventListener('fullscreenchange', fn);
    document.removeEventListener('webkitfullscreenchange', fn);
  };
}
