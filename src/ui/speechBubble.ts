import Phaser from 'phaser';
import { C, FONT_BODY, INK_W, MIN_FONT, S } from './theme';

/**
 * Globo de cómic: fondo Hueso, contorno y texto Tinta (contraste cercano a 17:1), texto de 32 px lógicos como mínimo.
 * Se reutiliza una instancia por criatura para cada frase, así no se crea nada durante la partida.
 */
export class SpeechBubble extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private left = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, '', { fontFamily: FONT_BODY, fontStyle: '800', fontSize: `${MIN_FONT}px`, color: S.ink })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.setDepth(depth).setVisible(false);
    scene.add.existing(this);
  }

  /** Muestra `text` durante `ms`; hay que llamar a `follow` en cada cuadro para que siga sobre la criatura. */
  say(text: string, ms = 1100): void {
    this.label.setText(text);
    const w = this.label.width + 36;
    const h = this.label.height + 18;
    this.bg.clear();
    this.bg.fillStyle(C.bone, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    this.bg.lineStyle(INK_W, C.ink, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    // cola
    this.bg.fillStyle(C.bone, 1).fillTriangle(-10, h / 2 - 2, 10, h / 2 - 2, 0, h / 2 + 16);
    this.bg
      .lineStyle(INK_W, C.ink, 1)
      .lineBetween(-10, h / 2 - 2, 0, h / 2 + 16)
      .lineBetween(10, h / 2 - 2, 0, h / 2 + 16);
    this.left = ms;
    this.setVisible(true).setAlpha(1);
  }

  get showing(): boolean {
    return this.left > 0;
  }

  /** Mueve el globo (dentro de los 1600 px de ancho) y lo desvanece al final. */
  follow(x: number, y: number, dtMs: number, maxX = 1600): void {
    if (this.left <= 0) return;
    this.left -= dtMs;
    if (this.left <= 0) {
      this.setVisible(false);
      return;
    }
    const half = this.label.width / 2 + 24;
    this.setPosition(Phaser.Math.Clamp(x, half + 8, maxX - half - 8), Math.max(y, 70));
    this.setAlpha(Math.min(1, this.left / 200));
  }
}
