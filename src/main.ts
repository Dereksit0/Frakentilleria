import '@fontsource/bungee/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Splash } from './scenes/Splash';
import { Menu } from './scenes/Menu';
import { Lab } from './scenes/Lab';
import { PassDevice } from './scenes/PassDevice';
import { Battle } from './scenes/Battle';
import { Hud } from './scenes/Hud';
import { Pause } from './scenes/Pause';
import { Result } from './scenes/Result';
import { Tutorial } from './scenes/Tutorial';
import { Settings } from './scenes/Settings';
import { RigDebug } from './scenes/RigDebug';
import { Coleccion } from './scenes/Coleccion';
import { installBackNavigation } from './ui/backNav';
import { installViewport } from './ui/viewport';
import { BUILD_ID, installDebugLog, installLoopHeartbeat } from './ui/debugLog';
import { currentInstallMode } from './ui/install';
import { onFullscreenChange } from './ui/fullscreen';
import { W, H, C } from './ui/theme';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: C.ink,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  dom: { createContainer: true },
  render: { antialias: true, roundPixels: false },
  fps: { target: 60 },
  scene: [
    Boot,
    Splash,
    Menu,
    Lab,
    PassDevice,
    Battle,
    Hud,
    Pause,
    Result,
    Tutorial,
    Settings,
    RigDebug,
    Coleccion,
  ],
});

installBackNavigation();
installViewport(game);
installDebugLog(game);
installLoopHeartbeat(game);
(window as unknown as { __installMode: typeof currentInstallMode }).__installMode = currentInstallMode;
onFullscreenChange(() => game.scale.refresh());
window.addEventListener('resize', () => game.scale.refresh());

// ?debug=fps shows a small live frame-rate counter (and exposes it for tests).
if (new URLSearchParams(location.search).get('debug') === 'fps') {
  const el = document.createElement('div');
  el.id = 'fps';
  el.style.cssText =
    'position:fixed;left:6px;bottom:6px;z-index:20;padding:2px 8px;background:#0F0E15;color:#7CFF4F;font:700 16px monospace;border-radius:6px;pointer-events:none';
  document.body.appendChild(el);
  // worst frame (ms) since the last read: the number that shows a hitch on impact
  let lastStep = performance.now();
  let worst = 0;
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    const now = performance.now();
    worst = Math.max(worst, now - lastStep);
    lastStep = now;
  });
  setInterval(() => {
    const f = Math.round(game.loop.actualFps);
    el.textContent = `${f} fps · peor ${Math.round(worst)} ms`;
    (window as unknown as { __fps: number; __worstFrame: number }).__fps = f;
    (window as unknown as { __worstFrame: number }).__worstFrame = Math.round(worst);
    worst = 0;
  }, 500);
}

// ?debug=rig: anchors/boxes overlay on every creature, and F2 opens the rig calibrator.
if (new URLSearchParams(location.search).get('debug') === 'rig') {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F2') return;
    e.preventDefault();
    for (const sc of game.scene.getScenes(true)) game.scene.stop(sc.scene.key);
    game.scene.start('RigDebug');
  });
}

// Handy for debugging and for the Playwright end-to-end tests.
(window as unknown as { __game: Phaser.Game }).__game = game;
(window as unknown as { __build: string }).__build = BUILD_ID;

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

// Auto-pause the match when the tab loses focus.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  const battle = game.scene.getScene('Battle');
  if (battle && game.scene.isActive('Battle')) {
    (battle as Battle).requestPause();
  }
});
