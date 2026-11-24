import Phaser from 'phaser';
import { unlockAudio } from './audio';
import { isMobile } from './device';
import { needsScrollStrip } from './model/mobile';

/** True si el juego corre como app instalada (ícono en la pantalla de inicio, PWA) y no dentro del navegador. */
export function isStandalone(): boolean {
  const mm = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
  return (
    mm('(display-mode: standalone)') ||
    mm('(display-mode: fullscreen)') ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Ajustes para teléfono y tableta: tamaño visible real (visualViewport, para seguir las barras de Safari que se esconden),
 * la franja de scroll del Menú y el Laboratorio, sin zoom, menú contextual ni jalar para recargar, desbloqueo de audio
 * en el primer toque y pérdida del contexto WebGL. El canvas es siempre de 1600x900 lógicos, así que la densidad de
 * píxeles nunca lo hace más pesado (tope efectivo de DPR).
 */
export function installViewport(game: Phaser.Game): void {
  const root = document.documentElement;
  const refit = () => {
    const vv = window.visualViewport;
    root.style.setProperty('--vvh', `${Math.round(vv?.height ?? window.innerHeight)}px`);
    root.style.setProperty('--vvw', `${Math.round(vv?.width ?? window.innerWidth)}px`);
    game.scale.refresh();
  };
  refit();
  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', () => setTimeout(refit, 250));
  window.visualViewport?.addEventListener('resize', refit);
  window.visualViewport?.addEventListener('scroll', refit);

  // Franja de scroll (solo Menú y Laboratorio, solo en el navegador): deja que Safari esconda sus barras.
  const apply = (on: boolean) => {
    if (document.body.classList.contains('scroll-on') === on) return;
    document.body.classList.toggle('scroll-on', on);
    if (!on) window.scrollTo(0, 0);
    refit();
  };
  window.addEventListener(
    'scroll',
    () => {
      if (window.scrollY > 8) document.body.classList.add('scrolled');
      // El canvas es fijo pero Phaser mide los punteros con el scroll de la página: se mantienen sincronizados sus límites.
      game.scale.updateBounds();
    },
    { passive: true },
  );
  setInterval(() => {
    const active = game.scene.getScenes(true).map((s) => s.scene.key);
    const scene =
      active.includes('Battle') || active.includes('Hud')
        ? 'Battle'
        : (active.find((k) => k === 'Menu' || k === 'Lab') ?? 'other');
    apply(
      needsScrollStrip({
        standalone: isStandalone(),
        mobile: isMobile() || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches),
        scene,
      }),
    );
  }, 400);

  // Sin menú contextual, sin zoom con pellizco ni doble toque, sin jalar para recargar.
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  for (const t of ['gesturestart', 'gesturechange', 'gestureend'])
    document.addEventListener(t, (e) => e.preventDefault());
  let lastTouch = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouch < 350) e.preventDefault();
      lastTouch = now;
    },
    { passive: false },
  );

  // iOS solo inicia el audio tras un gesto del usuario.
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('touchend', unlock);
    window.removeEventListener('pointerup', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('touchend', unlock, { passive: true });
  window.addEventListener('pointerup', unlock);
  window.addEventListener('keydown', unlock);

  // Pérdida del contexto WebGL (pestañas de iOS en segundo plano, poca memoria): se permite restaurar y luego se recarga para empezar limpio.
  const canvas = game.canvas;
  canvas?.addEventListener('webglcontextlost', (e) => e.preventDefault());
  canvas?.addEventListener('webglcontextrestored', () => location.reload());
}
