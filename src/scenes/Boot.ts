import Phaser from 'phaser';
import { MAPS } from '../core/data';
import { C, H, W } from '../ui/theme';
import { Button, txt } from '../ui/widgets';

// Sin estos archivos las escenas no pueden dibujar nada: si fallan se muestra un mensaje en vez de una pantalla negra.
const NECESARIOS = [
  'atlas',
  'atlas-icons',
  'atlas-fx',
  'atlas-badges',
  'atlas-ui',
  'acid-surface',
  'acid-body',
];

/** Carga todos los assets y luego muestra la portada. Un archivo opcional que falte no bloquea el juego. */
export class Boot extends Phaser.Scene {
  private archivoFallido: string | null = null;

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
    // Los archivos opcionales fallan en silencio: las escenas dibujan el arte por código si falta.
    this.load.on('loaderror', (f: Phaser.Loader.File) => {
      console.warn('[assets] missing', f.key, f.src);
      if (NECESARIOS.includes(f.key)) this.archivoFallido ??= f.src;
    });

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

  private mostrarErrorDeCarga(): void {
    this.children.removeAll(true);
    txt(this, W / 2, H / 2 - 120, 'No se pudo cargar el juego', {
      title: true,
      size: 48,
      origin: [0.5, 0.5],
    });
    txt(this, W / 2, H / 2 - 40, 'Falta un archivo. Revisa tu conexión y vuelve a intentarlo.', {
      origin: [0.5, 0.5],
      align: 'center',
      width: W - 200,
    });
    new Button(this, W / 2 - 200, H / 2 + 40, 400, 104, 'Reintentar', {
      kind: 'primary',
      onClick: () => window.location.reload(),
    });
  }

  async create(): Promise<void> {
    if (this.archivoFallido) {
      this.mostrarErrorDeCarga();
      return;
    }
    try {
      await Promise.all([document.fonts.load('32px Bungee'), document.fonts.load('800 32px Nunito')]);
    } catch {
      /* si no cargan las fuentes se usan las del sistema */
    }
    // Solo en desarrollo: ?debug=assets abre la galeria de frames en vez del juego.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === 'assets') {
      const { AssetsDebug } = await import('./AssetsDebug');
      this.scene.add('AssetsDebug', AssetsDebug, true);
      this.scene.stop();
      return;
    }
    this.scene.start('Splash');
  }
}
