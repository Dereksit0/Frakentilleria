import Phaser from 'phaser';
import { fullscreenSupported, isFullscreen, onFullscreenChange, toggleFullscreen } from './fullscreen';
import { Button } from './widgets';

/**
 * "Pantalla completa: SÍ/NO" toggle. Returns null when the browser has no Fullscreen API
 * (e.g. iPhone Safari), so the caller can show the "Añadir a pantalla de inicio" hint instead.
 */
export function addFullscreenButton(scene: Phaser.Scene, x: number, y: number, w: number): Button | null {
  if (!fullscreenSupported()) return null;
  const label = () => `Pantalla completa: ${isFullscreen() ? 'SÍ' : 'NO'}`;
  const btn = new Button(scene, x, y, w, 104, label(), { onClick: () => toggleFullscreen() });
  btn.setSelected(isFullscreen());
  // Corner brackets icon (drawn, so it never depends on a font glyph).
  const g = scene.add.graphics();
  g.lineStyle(5, 0xf4efe1, 1);
  const ix = 26;
  const iy = 52;
  const s = 14;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    g.lineBetween(ix + sx * s, iy + sy * s, ix + sx * s, iy + sy * (s - 9));
    g.lineBetween(ix + sx * s, iy + sy * s, ix + sx * (s - 9), iy + sy * s);
  }
  btn.add(g);
  const off = onFullscreenChange(() => {
    // Not re-forced after the player leaves fullscreen: just show the state again.
    if (!btn.scene) return;
    btn.setLabel(label());
    btn.setSelected(isFullscreen());
  });
  btn.once(Phaser.GameObjects.Events.DESTROY, off);
  return btn;
}
