import Phaser from 'phaser';
import type { Selection } from '../core/stats';

/**
 * Builds a creature out of 4 atlas frames. Local origin (0,0) = feet centre; y grows downward.
 * Dimensions mirror src/data/parts.json "boxes" so replacing art files keeps the same anchors.
 */
const LEGS_H = 150;
const TORSO_H = 170;
const HEAD_H = 170;
export const CREATURE_HEIGHT = 460; // unscaled

export class CreatureView extends Phaser.GameObjects.Container {
  private legs: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private arm: Phaser.GameObjects.Image;
  private pieces: Phaser.GameObjects.Image[];
  private base: number;
  private facing: 1 | -1 = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, sel: Selection, scale = 0.3) {
    super(scene, x, y);
    this.base = scale;
    const f = (slot: string, donor: string) => `part_${donor}_${slot}`;
    this.legs = scene.add.image(0, 0, 'atlas', f('legs', sel.legs)).setOrigin(0.5, 1);
    this.torso = scene.add.image(0, -(LEGS_H - 20), 'atlas', f('torso', sel.torso)).setOrigin(0.5, 1);
    this.head = scene.add.image(0, -(LEGS_H - 20 + TORSO_H - 12), 'atlas', f('head', sel.head)).setOrigin(0.5, 1);
    this.arm = scene.add
      .image(18, -(LEGS_H - 20 + TORSO_H - 62), 'atlas', f('arms', sel.arms))
      .setOrigin(0.15, 0.38);
    this.pieces = [this.legs, this.torso, this.head, this.arm];
    this.add(this.pieces);
    this.setScale(scale);
    this.setAim(1, -12);
    void HEAD_H;
    scene.add.existing(this);
  }

  /** facing: 1 right, −1 left. angleDeg: absolute aim angle (0 = right, 90 = up, 180 = left). */
  setAim(facing: 1 | -1, angleDeg: number): void {
    this.facing = facing;
    this.setScale(this.base * facing, this.base);
    const rad = (angleDeg * Math.PI) / 180;
    // In local (unflipped) space the arm points right at rotation 0.
    this.arm.setRotation(facing > 0 ? -rad : -(Math.PI - rad));
  }

  /** Gentle idle bob so creatures feel alive. */
  idle(scene: Phaser.Scene, phase = 0): void {
    scene.tweens.add({
      targets: this.torso,
      scaleY: 1.03,
      duration: 900 + phase * 120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: this.head,
      y: this.head.y - 4,
      duration: 900 + phase * 120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  flash(color = 0xffffff): void {
    this.pieces.forEach((i) => i.setTintFill(color));
    this.scene.time.delayedCall(90, () => this.pieces.forEach((i) => i.clearTint()));
  }

  /** Silhouette mode (used by the "pass the device" screen so nobody peeks). */
  setSilhouette(on: boolean, color = 0x4a4466): void {
    this.pieces.forEach((i) => (on ? i.setTintFill(color) : i.clearTint()));
  }

  private grayed = false;
  setGrayed(on: boolean): void {
    this.grayed = on;
    this.pieces.forEach((i) => (on ? i.setTint(0x555566) : i.clearTint()));
  }

  private iced = false;
  setIce(on: boolean): void {
    if (on === this.iced) return;
    this.iced = on;
    this.pieces.forEach((i) => (on ? i.setTint(0x9fd8ff) : this.grayed ? i.setTint(0x555566) : i.clearTint()));
  }

  get facingDir(): 1 | -1 {
    return this.facing;
  }
}
