import Phaser from 'phaser';
import { MAPS } from '../core/data';
import { C, H, S, W } from '../ui/theme';
import { txt } from '../ui/widgets';
import { AssetsDebug } from './AssetsDebug';

/** Loads every asset, then shows the splash. Missing optional files never block the game. */
export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const bar = this.add.graphics();
    const label = txt(this, W / 2, H / 2 - 60, 'Cargando…', { title: true, size: 40, origin: [0.5, 0.5] });
    this.load.on('progress', (p: number) => {
      bar.clear();
      bar.fillStyle(C.ink, 1).fillRoundedRect(W / 2 - 300, H / 2, 600, 36, 18);
      bar.fillStyle(C.acid, 1).fillRoundedRect(W / 2 - 296, H / 2 + 4, 592 * p, 28, 14);
      label.setText(`Cargando… ${Math.round(p * 100)}%`);
    });
    // Optional files (e.g. art that does not exist yet) fail silently; scenes fall back to code-made art.
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('[assets] missing', f.key, f.src));

    this.load.setPath('assets/');
    this.load.atlas('atlas', 'atlas.png', 'atlas.json');
    this.load.atlas('atlas-icons', 'atlas-icons.webp', 'atlas-icons.json');
    this.load.atlas('atlas-fx', 'atlas-fx.webp', 'atlas-fx.json');
    this.load.atlas('atlas-badges', 'atlas-badges.webp', 'atlas-badges.json');
    this.load.atlas('atlas-ui', 'atlas-ui.webp', 'atlas-ui.json');
    this.load.image('acid-surface', 'acid-surface.webp');
    this.load.image('acid-body', 'acid-body.webp');
    this.load.image('logo', 'logo.png');
    this.load.image('bg-menu', 'screens/menu-bg-laboratorio.webp');
    this.load.image('bg-splash', 'screens/splashscreen.webp');
    this.load.image('bg-cover', 'screens/portada-key-art.webp');
    this.load.audio('music1', 'audio/music-1.mp3');

    for (const m of MAPS) {
      for (const l of m.layers)
        if (l.kind === 'image' && l.src) this.load.image(`layer:${m.id}:${l.id}`, l.src);
      if (m.terrain.kind === 'image' && m.terrain.src) this.load.image(`terrain:${m.id}`, m.terrain.src);
    }
  }

  async create(): Promise<void> {
    try {
      await Promise.all([document.fonts.load('32px Bungee'), document.fonts.load('800 32px Nunito')]);
    } catch {
      /* fonts fall back to system faces */
    }
    // `?debug=assets` opens the asset gallery instead of the game (ids, sizes and anchors of every sprite).
    if (new URLSearchParams(window.location.search).get('debug') === 'assets') {
      this.scene.add('AssetsDebug', AssetsDebug, true);
      this.scene.stop();
      return;
    }
    this.scene.start('Splash');
    void S;
  }
}
