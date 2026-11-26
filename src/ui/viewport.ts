import Phaser from 'phaser';
import { unlockAudio } from './audio';
import { logError } from './debugLog';
import { isMobile } from './device';
import { needsScrollStrip } from './model/mobile';

/** True when the game runs as an installed app (home-screen icon, PWA) instead of inside the browser UI. */
export function isStandalone(): boolean {
  const mm = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
  return (
    mm('(display-mode: standalone)') ||
    mm('(display-mode: fullscreen)') ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Phone/tablet plumbing: real visible size (visualViewport, so Safari's collapsing bars are followed), the scroll strip of
 * Menu/Lab, no zoom/context menu/pull-to-refresh, audio unlock on the first touch and WebGL context loss.
 * The canvas is always 1600x900 logical, so the device pixel ratio never makes it heavier (effective DPR cap).
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

  // Scroll strip (Menu and Lab only, browser mode only): lets Safari collapse its address/tab bars.
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
      // The canvas is fixed but Phaser measures pointers with the page scroll: keep its cached bounds in sync.
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

  // No context menu, no pinch zoom, no double-tap zoom, no pull-to-refresh.
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

  // iOS only starts audio after a user gesture.
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('touchend', unlock);
    window.removeEventListener('pointerup', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('touchend', unlock, { passive: true });
  window.addEventListener('pointerup', unlock);
  window.addEventListener('keydown', unlock);

  // WebGL context loss (iOS background tabs, memory pressure): allow restore, then reload for a clean state.
  const canvas = game.canvas;
  canvas?.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    logError('se perdió el contexto WebGL', 'webglcontextlost');
  });
  // Coming back to the installed app (page cache / background): refit and drop the time spent away so nothing jumps.
  const resume = () => {
    if (document.hidden) return;
    game.loop.resetDelta();
    refit();
  };
  window.addEventListener('pageshow', resume);
  document.addEventListener('visibilitychange', resume);
  canvas?.addEventListener('webglcontextrestored', () => location.reload());
}
