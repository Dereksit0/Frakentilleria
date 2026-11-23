import Phaser from 'phaser';
import { C, FONT_BODY, INK_W, MIN_FONT, S } from './theme';

/**
 * Comic speech bubble: Bone background, Ink outline and text (≈ 17:1 contrast), 32 px logical text minimum.
 * One instance per creature is reused for every line, so nothing is created while playing.
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

  /** Shows `text` for `ms`; call `follow` every frame to keep it above the creature. */
  say(text: string, ms = 1100): void {
    this.label.setText(text);
    const w = this.label.width + 36;
    const h = this.label.height + 18;
    this.bg.clear();
    this.bg.fillStyle(C.bone, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    this.bg.lineStyle(INK_W, C.ink, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    // tail
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

  /** Moves the bubble (kept inside the 1600 px wide screen) and fades it out at the end. */
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
