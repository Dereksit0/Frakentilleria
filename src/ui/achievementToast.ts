import Phaser from 'phaser';
import { ACHIEVEMENT_DEFS, AchievementQueue, toastPose } from '../core/achievements';
import { sfx } from './audio';
import { settings } from './settings';
import { C, FONT_BODY, FONT_TITLE, INK_W, S, W } from './theme';

const SPARKS = 10;
const CONFETTI = 18;
const TARGET_Y = 118;

/**
 * "¡Logro desbloqueado!" banner: slides down from the top with the badge, a glow ring, sparkles and confetti, ~3 s, and
 * queues when several unlock together. It never takes input (not interactive), so it cannot block the combat.
 * Timing and queueing live in src/core/achievements.ts; this class only draws. "Reducir efectos": fade only.
 */
export class AchievementToast {
  private readonly queue = new AchievementQueue();
  private readonly box: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private readonly badge: Phaser.GameObjects.Image;
  private readonly burst: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Text;
  private readonly name: Phaser.GameObjects.Text;
  private readonly desc: Phaser.GameObjects.Text;
  private readonly sparks: Phaser.GameObjects.Image[] = [];
  private readonly confetti: Phaser.GameObjects.Image[] = [];
  private shownId: string | null = null;

  constructor(scene: Phaser.Scene, depth = 300) {
    const bw = 940;
    const bh = 170;
    this.box = scene.add
      .container(W / 2, -bh)
      .setDepth(depth)
      .setVisible(false);
    this.bg = scene.add.graphics();
    this.bg.fillStyle(C.ink, 0.96).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 18);
    this.bg.lineStyle(INK_W + 2, C.volt, 1).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 18);
    this.burst = scene.add
      .image(-bw / 2 + 110, 0, 'atlas-fx', 'fx-confetti')
      .setScale(1.1)
      .setAlpha(0);
    this.ring = scene.add.graphics();
    this.badge = scene.add.image(-bw / 2 + 110, 0, 'atlas-ui', 'ach-first-blood');
    this.head = scene.add
      .text(-bw / 2 + 200, -52, '¡Logro desbloqueado!', {
        fontFamily: FONT_TITLE,
        fontSize: '32px',
        color: S.volt,
      })
      .setOrigin(0, 0.5);
    this.name = scene.add
      .text(-bw / 2 + 200, -4, '', { fontFamily: FONT_TITLE, fontSize: '40px', color: S.bone })
      .setOrigin(0, 0.5);
    this.desc = scene.add
      .text(-bw / 2 + 200, 48, '', {
        fontFamily: FONT_BODY,
        fontStyle: '800',
        fontSize: '32px',
        color: S.bone,
        wordWrap: { width: bw - 230 },
      })
      .setOrigin(0, 0.5);
    this.box.add([this.bg, this.burst, this.ring, this.badge, this.head, this.name, this.desc]);
    for (let i = 0; i < SPARKS; i++) {
      const s = scene.add.image(0, 0, 'atlas', 'dot').setTint(C.volt).setScale(0.9).setVisible(false);
      this.sparks.push(s);
      this.box.add(s);
    }
    const colors = [C.volt, C.p1, C.p2, C.acid, 0xb06bff];
    for (let i = 0; i < CONFETTI; i++) {
      const c = scene.add
        .image(0, 0, 'atlas', 'dot')
        .setTint(colors[i % colors.length])
        .setScale(0.8, 0.5)
        .setVisible(false);
      this.confetti.push(c);
      this.box.add(c);
    }
  }

  /** Queues the toast of an achievement id (shown once). */
  show(id: string): void {
    this.queue.push(id);
  }

  get active(): boolean {
    return this.queue.current !== null;
  }

  /** The id being shown right now (for tests). */
  get currentId(): string | null {
    return this.queue.current?.id ?? null;
  }

  update(dtMs: number): void {
    this.queue.update(dtMs);
    const cur = this.queue.current;
    if (!cur) {
      if (this.box.visible) this.box.setVisible(false);
      this.shownId = null;
      return;
    }
    if (cur.id !== this.shownId) this.start(cur.id);
    const reduced = settings.reduceEffects;
    const pose = toastPose(cur.t, reduced);
    this.box.setVisible(true).setAlpha(pose.alpha);
    this.box.y = Phaser.Math.Linear(-190, TARGET_Y, pose.slide);
    // glow ring around the badge and a burst of confetti behind it
    this.ring.clear();
    if (!reduced) {
      const p = Math.min(1, cur.t / 900);
      this.ring.lineStyle(8, C.volt, 1 - p).strokeCircle(this.badge.x, 0, 50 + p * 70);
      this.ring.lineStyle(4, C.bone, (1 - p) * 0.8).strokeCircle(this.badge.x, 0, 40 + p * 40);
      this.burst.setAlpha(Math.max(0, 0.9 - cur.t / 700));
      const t = cur.t / 1000;
      this.sparks.forEach((s, i) => {
        const a = (i / SPARKS) * Math.PI * 2 + t * 2.2;
        const r = 62 + Math.sin(t * 6 + i) * 8;
        s.setVisible(true)
          .setPosition(this.badge.x + Math.cos(a) * r, Math.sin(a) * r)
          .setAlpha(0.5 + 0.5 * Math.sin(t * 9 + i * 1.7));
      });
      this.confetti.forEach((c, i) => {
        const fall = ((t * 0.9 + i * 0.37) % 1.4) / 1.4;
        c.setVisible(cur.t < 2400)
          .setPosition(-470 + ((i * 53) % 940), -110 + fall * 230)
          .setRotation(t * 5 + i);
      });
    } else {
      this.burst.setAlpha(0);
      for (const s of this.sparks) s.setVisible(false);
      for (const c of this.confetti) c.setVisible(false);
    }
  }

  private start(id: string): void {
    this.shownId = id;
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === id);
    if (!def) return;
    this.badge.setFrame(def.art);
    this.name.setText(def.name);
    this.desc.setText(def.desc);
    sfx('achievement');
  }
}
