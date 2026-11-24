import Phaser from 'phaser';
import { H, W } from './theme';
import { atlasRef } from './atlasRefs';

/** Altura de la línea de cresta dentro de acid-surface (las burbujas sobresalen por arriba). */
const CREST = 12;
const BODY_HALF = 128; // acid-body está espejado en vertical: su segunda mitad continúa la última fila de la superficie
const MAX_RAIN = 10;

/**
 * Ácido que sube: una superficie TileSprite sin costura (cresta y burbujas) y un cuerpo TileSprite que rellena hasta el
 * fondo, más rayas de lluvia, una corona de salpicadura y el aviso de que el ácido viene.
 * Con `reduce` ("Reducir efectos") no hay lluvia y las ondas casi no se mueven.
 */
export class AcidLayer {
  private surface: Phaser.GameObjects.TileSprite;
  private body: Phaser.GameObjects.TileSprite;
  private scroll = 0;
  private rain = 0;
  private level = H;

  constructor(
    private scene: Phaser.Scene,
    private depth: number,
  ) {
    const sh = scene.textures.get('acid-surface').getSourceImage().height;
    this.surface = scene.add
      .tileSprite(0, 0, W, sh, 'acid-surface')
      .setOrigin(0, 0)
      .setDepth(depth)
      .setAlpha(0.92);
    this.body = scene.add.tileSprite(0, 0, W, H, 'acid-body').setOrigin(0, 0).setDepth(depth).setAlpha(0.92);
    this.body.tilePositionY = BODY_HALF;
    this.setVisible(false);
  }

  private setVisible(v: boolean): void {
    this.surface.setVisible(v);
    this.body.setVisible(v);
  }

  /** Nivel actual del ácido (y de la línea de cresta). */
  get y(): number {
    return this.level;
  }

  update(level: number, dtSeconds: number, reduce: boolean): void {
    this.level = level;
    const on = level < H - 1;
    this.setVisible(on);
    if (!on) return;
    this.scroll += dtSeconds * (reduce ? 3 : 22);
    const top = level - CREST;
    this.surface.setY(top);
    this.surface.tilePositionX = this.scroll;
    const bodyTop = top + this.surface.height - 1;
    this.body.setY(bodyTop);
    this.body.setSize(W, Math.max(1, H - bodyTop + 4));
    this.body.tilePositionX = this.scroll;
  }

  /** Una raya de lluvia ácida (con tope). */
  dropRain(x: number, fromY: number): void {
    if (this.rain >= MAX_RAIN) return;
    this.rain++;
    const img = this.scene.add
      .image(x, fromY, ...atlasRef('fx-acid-streaks'))
      .setDepth(this.depth + 1)
      .setAlpha(0.85);
    this.scene.tweens.add({
      targets: img,
      y: Math.max(fromY + 60, this.level),
      alpha: 0.2,
      duration: 650,
      ease: 'Quad.easeIn',
      onComplete: () => {
        img.destroy();
        this.rain--;
        this.crown(x, 0.6);
      },
    });
  }

  /** Corona de salpicadura en la superficie (algo cayó o una raya la tocó). */
  crown(x: number, scale = 1): void {
    if (this.level >= H - 1) return;
    const c = this.scene.add
      .image(x, this.level + 6, ...atlasRef('fx-acid-splash-crown'))
      .setDepth(this.depth + 1)
      .setScale(0.3 * scale);
    this.scene.tweens.add({
      targets: c,
      scale,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => c.destroy(),
    });
  }

  /** Aviso de la ronda anterior a que el ácido empiece a subir. */
  warn(): void {
    const tri = this.scene.add
      .image(W / 2 - 56, 330, ...atlasRef('ui-warning-acid'))
      .setDepth(this.depth + 20);
    const arrow = this.scene.add
      .image(W / 2 + 56, 330, ...atlasRef('ui-acid-rising-arrow'))
      .setDepth(this.depth + 20);
    this.scene.tweens.add({
      targets: [tri, arrow],
      y: 312,
      yoyo: true,
      repeat: 2,
      duration: 380,
      onComplete: () => {
        tri.destroy();
        arrow.destroy();
      },
    });
  }
}
