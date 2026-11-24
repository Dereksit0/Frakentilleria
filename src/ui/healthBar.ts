import Phaser from 'phaser';
import { settings } from './settings';
import { C } from './theme';
import {
  healthBarViewModel,
  stepBar,
  type BarAnim,
  type HealthBarModel,
  type PlayerId,
} from './model/healthBar';
import { txt } from './widgets';

export interface HealthBarOpts {
  barW: number;
  barH: number;
  player: PlayerId;
  /** Short name drawn next to the chip ("J1"). Omit to hide. */
  name?: string;
  /** Show the colour+shape chip (circle = J1, diamond = J2). */
  chip?: boolean;
}

const CHIP = 40;
const NUM_W = 64;
const SKULL_W = 34;
const GHOST_COLOR = 0xffe14d;

/**
 * Reusable health bar used by the HUD and by the bars floating over each creature.
 * Every game object is created once in the constructor; frames only clear/redraw one Graphics
 * and only while something is animating, pulsing or flashing.
 */
export class HealthBar extends Phaser.GameObjects.Container {
  readonly totalWidth: number;
  private readonly inner: Phaser.GameObjects.Container;
  private readonly chipG: Phaser.GameObjects.Graphics;
  private readonly barG: Phaser.GameObjects.Graphics;
  private readonly skullG: Phaser.GameObjects.Graphics;
  private readonly num: Phaser.GameObjects.Text;
  private readonly nameText?: Phaser.GameObjects.Text;
  private readonly o: HealthBarOpts;
  private readonly barX: number;
  private anim: BarAnim = { shown: 1, ghost: 1, holdMs: 0 };
  private model: HealthBarModel;
  private hp = -1;
  private maxHp = 1;
  private dirty = true;
  private blinkMs = 0;
  private shakeMs = 0;
  private lastLabel = '';

  constructor(scene: Phaser.Scene, x: number, y: number, o: HealthBarOpts) {
    super(scene, x, y);
    this.o = o;
    this.model = healthBarViewModel(1, 1, 1, o.player);
    const chipW = o.chip ? CHIP + 8 : 0;
    this.nameText = o.name
      ? txt(scene, 0, 0, o.name, { title: true, size: 32, origin: [0, 0.5], raw: true, stroke: true })
      : undefined;
    const nameW = this.nameText ? this.nameText.width + 10 : 0;
    this.barX = chipW + nameW;
    this.totalWidth = this.barX + o.barW + 8 + NUM_W + SKULL_W;

    this.inner = scene.add.container(-this.totalWidth / 2, 0);
    this.chipG = scene.add.graphics();
    this.barG = scene.add.graphics();
    this.skullG = scene.add.graphics();
    this.num = txt(scene, this.barX + o.barW + 10, 0, '', {
      title: true,
      size: 32,
      origin: [0, 0.5],
      raw: true,
      stroke: true,
    });
    this.inner.add([this.chipG, this.barG, this.skullG, this.num]);
    if (this.nameText) {
      this.nameText.setPosition(chipW, 0);
      this.inner.add(this.nameText);
    }
    this.drawChip();
    this.drawSkull();
    this.add(this.inner);
    scene.add.existing(this);
  }

  /** Sets the real value; call every frame (cheap when unchanged). */
  setValue(hp: number, maxHp: number): void {
    if (hp === this.hp && maxHp === this.maxHp) return;
    const first = this.hp < 0;
    const prev = first ? hp : this.hp;
    this.hp = hp;
    this.maxHp = maxHp;
    this.model = healthBarViewModel(hp, maxHp, prev, this.o.player);
    if (first) this.anim = { shown: this.model.pct, ghost: this.model.pct, holdMs: 0 };
    if (hp < prev && !settings.reduceEffects) {
      this.blinkMs = 260;
      this.shakeMs = 220;
    }
    this.dirty = true;
  }

  /** Active creature = bigger and fully opaque; the others are a little dimmer. */
  setEmphasis(active: boolean): void {
    this.setScale(active ? 1.15 : 1);
    this.setAlpha(active ? 1 : 0.78);
  }

  tick(dtMs: number): void {
    const a = this.anim;
    const before = a.shown + a.ghost;
    stepBar(a, this.model.pct, this.model.ghostPct, dtMs, settings.reduceEffects);
    const moving = Math.abs(a.shown + a.ghost - before) > 1e-6 || a.ghost > a.shown + 1e-6;
    // Hit feedback (disabled with "Reducir efectos")
    if (this.blinkMs > 0) {
      this.blinkMs -= dtMs;
      this.inner.setAlpha(Math.floor(this.blinkMs / 65) % 2 === 0 ? 1 : 0.35);
      if (this.blinkMs <= 0) this.inner.setAlpha(1);
    }
    if (this.shakeMs > 0) {
      this.shakeMs -= dtMs;
      this.inner.x = -this.totalWidth / 2 + (this.shakeMs > 0 ? Math.sin(this.shakeMs * 0.12) * 6 : 0);
    }
    const pulsing = this.model.pulseMs > 0 && !settings.reduceEffects;
    if (this.dirty || moving || pulsing) {
      this.drawBar(
        pulsing ? 0.78 + 0.22 * Math.sin((this.scene.time.now / this.model.pulseMs) * Math.PI * 2) : 1,
      );
      this.dirty = false;
    }
    if (this.num.text !== this.model.label) this.num.setText(this.model.label);
    if (this.lastLabel !== this.model.state) {
      this.lastLabel = this.model.state;
      this.skullG.setVisible(this.model.showSkull);
      this.drawChip();
    }
  }

  private drawChip(): void {
    const g = this.chipG;
    g.clear();
    if (!this.o.chip) return;
    const cx = CHIP / 2;
    g.fillStyle(this.model.playerColor, 1).lineStyle(4, C.ink, 1);
    if (this.model.shape === 'circle') {
      g.fillCircle(cx, 0, 16).strokeCircle(cx, 0, 16);
    } else {
      const p = [
        new Phaser.Geom.Point(cx, -20),
        new Phaser.Geom.Point(cx + 20, 0),
        new Phaser.Geom.Point(cx, 20),
        new Phaser.Geom.Point(cx - 20, 0),
      ];
      g.fillPoints(p, true).strokePoints(p, true);
    }
  }

  private drawSkull(): void {
    const g = this.skullG;
    const cx = this.barX + this.o.barW + 8 + NUM_W + SKULL_W / 2;
    g.lineStyle(3, C.ink, 1).fillStyle(C.bone, 1);
    g.fillCircle(cx, -3, 13).strokeCircle(cx, -3, 13);
    g.fillRect(cx - 7, 6, 14, 10).strokeRect(cx - 7, 6, 14, 10);
    g.fillStyle(C.ink, 1)
      .fillCircle(cx - 5, -4, 3.5)
      .fillCircle(cx + 5, -4, 3.5);
    g.fillTriangle(cx, 0, cx - 2.5, 5, cx + 2.5, 5);
    g.setVisible(false);
  }

  private drawBar(pulseAlpha: number): void {
    const { barW: w, barH: h } = this.o;
    const g = this.barG;
    const m = this.model;
    const x0 = this.barX;
    const top = -h / 2;
    const bw = 4; // ink outline
    g.clear();
    g.fillStyle(C.ink, 1).fillRoundedRect(x0, top, w, h, 7);
    g.fillStyle(C.coal, 1).fillRoundedRect(x0 + bw, top + bw, w - 2 * bw, h - 2 * bw, 4);
    const iw = w - 2 * bw;
    const ih = h - 2 * bw;
    const ix = x0 + bw;
    const iy = top + bw;
    const ghostW = Math.max(0, (this.anim.ghost - this.anim.shown) * iw);
    const fillW = Math.max(0, this.anim.shown * iw);
    if (ghostW > 0.5) {
      g.fillStyle(GHOST_COLOR, 1).fillRect(ix + fillW, iy, ghostW, ih);
      g.fillStyle(C.ink, 1).fillRect(ix + fillW - 1.5, iy, 3, ih); // divider keeps fill and ghost distinguishable
    }
    if (fillW > 0.5) {
      g.fillStyle(m.fillColor, pulseAlpha).fillRect(ix, iy, fillW, ih);
      if (m.stripes) {
        // Diagonal ink stripes: low health is readable without colour.
        g.lineStyle(4, C.ink, 0.55);
        for (let sx = ix - ih; sx < ix + fillW; sx += 14) {
          const x1 = Math.max(ix, sx);
          const x2 = Math.min(ix + fillW, sx + ih);
          if (x2 <= x1) continue;
          const y1 = sx < ix ? iy + ih - (x1 - sx) : iy + ih;
          const y2 = iy + ih - (x2 - sx);
          g.lineBetween(x1, y1, x2, y2);
        }
      }
    }
    // Segment marks every 20 hp
    g.lineStyle(2, C.ink, 0.85);
    for (const t of m.ticks) g.lineBetween(ix + t * iw, iy, ix + t * iw, iy + ih);
  }
}
