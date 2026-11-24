import Phaser from 'phaser';
import { atlasRef } from './atlasRefs';
import { txt } from './widgets';
import { S } from './theme';
import { settings } from './settings';
import defeatParts from '../data/defeatParts.json';

/** At most this many effect objects exist at once (stars, puffs, bubbles, falling pieces). */
export const MAX_FX = 12;

/** Pain / taunt / defeat decorations drawn over the creatures. Text is Spanish, drawn by the game (bubbles ship empty). */
export class PainFx {
  private active = 0;

  constructor(
    private scene: Phaser.Scene,
    private depth = 62,
  ) {}

  /** Runs `build`, which returns the objects to fade out; skips silently when the cap would be exceeded. */
  private spawn(build: () => Phaser.GameObjects.GameObject[], ms: number, rise = 24, count = 1): void {
    if (this.active + count > MAX_FX) return;
    const objs = build();
    this.active += objs.length;
    this.scene.tweens.add({
      targets: objs,
      y: `-=${rise}`,
      alpha: { from: 1, to: 0 },
      duration: ms,
      ease: 'Quad.easeOut',
      onComplete: () => {
        objs.forEach((o) => o.destroy());
        this.active -= objs.length;
      },
    });
  }

  private img(frame: string, x: number, y: number, scale = 1): Phaser.GameObjects.Image {
    return this.scene.add
      .image(x, y, ...atlasRef(frame))
      .setDepth(this.depth)
      .setScale(scale);
  }

  /** Hit reaction above a creature's body centre. */
  hurt(x: number, y: number, heavy: boolean): void {
    if (settings.reduceEffects) return;
    this.spawn(
      () => [this.img('fx-hit-puff', x - 18, y), this.img('fx-impact-spark', x + 22, y - 14, 0.9)],
      420,
      10,
      2,
    );
    if (heavy) {
      this.spawn(() => [this.img('fx-dizzy-stars', x, y - 54)], 800, 8);
      this.spawn(() => [this.img('fx-sweat-drops', x + 34, y - 30, 0.8)], 700, 14);
      this.bubble('¡Eso dolió!', x, y - 120, 'fx-bubble-shout');
    }
  }

  /** Taunt: laughing marks and a short speech bubble ("¡Tomaaa!" after a hit, "¡Jajaja!" otherwise). */
  taunt(x: number, y: number, text: string): void {
    if (!settings.reduceEffects) this.spawn(() => [this.img('fx-laugh-marks', x + 40, y - 6, 0.9)], 900, 10);
    this.bubble(text, x, y - 70, 'fx-bubble-speech');
  }

  /** Speech bubble sized to its text (proportional scale of the empty bubble; text 32 px, ink on cream). */
  bubble(text: string, x: number, y: number, frame: 'fx-bubble-speech' | 'fx-bubble-shout'): void {
    this.spawn(
      () => {
        const label = txt(this.scene, x, y, text, {
          size: 32,
          color: S.ink,
          origin: [0.5, 0.5],
          title: true,
        });
        label.setDepth(this.depth + 2);
        const b = this.img(frame, x, y + 6, 1).setDepth(this.depth + 1);
        b.setScale(Math.max(0.8, (label.width + 56) / (b.width * 0.82)));
        return [b, label];
      },
      1100,
      16,
      2,
    );
  }

  /** Defeat: the ghost rises and two loose pieces (per head donor) drop from the creature. */
  defeat(x: number, y: number, donor: string): void {
    this.spawn(() => [this.img('grave-ghost', x, y - 40, 0.8).setAlpha(0.85)], 1600, 140);
    if (settings.reduceEffects) return;
    const pieces = (defeatParts as unknown as Record<string, string[]>)[donor] ?? defeatParts.armadura;
    pieces.forEach((f, i) => {
      if (this.active >= MAX_FX) return;
      const p = this.img(f, x + (i ? 24 : -24), y - 60);
      this.active++;
      this.scene.tweens.add({
        targets: p,
        y: y + 6,
        angle: i ? 200 : -200,
        duration: 520,
        ease: 'Bounce.easeOut',
        onComplete: () =>
          this.scene.tweens.add({
            targets: p,
            alpha: 0,
            delay: 900,
            duration: 400,
            onComplete: () => {
              p.destroy();
              this.active--;
            },
          }),
      });
    });
  }
}
