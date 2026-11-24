import Phaser from 'phaser';
import { settings } from './settings';
import { FONT_TITLE, S } from './theme';

export const MAX_FLOATING = 12;

export type FloatKind = 'damage' | 'heavy' | 'heal' | 'acid' | 'fall';

const STYLE: Record<FloatKind, { color: string; size: number }> = {
  damage: { color: S.alarmSoft, size: 40 },
  heavy: { color: S.alarmSoft, size: 64 },
  heal: { color: S.acid, size: 44 },
  acid: { color: S.acid, size: 40 },
  fall: { color: S.volt, size: 40 },
};

/** Pool of at most 12 reusable texts: when all are busy the oldest one is recycled. */
export class FloatingNumbers {
  private readonly pool: Phaser.GameObjects.Text[] = [];
  private readonly tweens: (Phaser.Tweens.Tween | null)[] = [];
  private next = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    depth = 80,
  ) {
    for (let i = 0; i < MAX_FLOATING; i++) {
      const t = scene.add
        .text(0, 0, '', {
          fontFamily: FONT_TITLE,
          fontSize: '40px',
          color: S.bone,
          stroke: S.ink,
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth(depth)
        .setVisible(false);
      this.pool.push(t);
      this.tweens.push(null);
    }
  }

  /** Number of numbers currently on screen (for tests / debug). */
  get active(): number {
    return this.pool.filter((t) => t.visible).length;
  }

  show(x: number, y: number, text: string, kind: FloatKind): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX_FLOATING;
    const t = this.pool[i];
    this.tweens[i]?.stop();
    const st = STYLE[kind];
    t.setText(text)
      .setColor(st.color)
      .setFontSize(st.size)
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(kind === 'heavy' ? 1.3 : 1)
      .setVisible(true);
    const reduced = settings.reduceEffects;
    this.tweens[i] = this.scene.tweens.add({
      targets: t,
      y: y - (reduced ? 24 : 100),
      scale: kind === 'heavy' && !reduced ? { from: 1.5, to: 1 } : t.scale,
      alpha: { from: 1, to: 0 },
      duration: reduced ? 700 : 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => t.setVisible(false),
    });
  }
}
