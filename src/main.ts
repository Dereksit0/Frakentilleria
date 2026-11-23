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
  scene: [Boot, Splash, Menu, Lab, PassDevice, Battle, Hud, Pause, Result, Tutorial, Settings],
});

// Handy for debugging and for the Playwright end-to-end tests.
(window as unknown as { __game: Phaser.Game }).__game = game;

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
