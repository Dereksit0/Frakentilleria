import Phaser from 'phaser';
import type { HazardDef } from '../core/world';
import { settings } from './settings';

type Portal = Extract<HazardDef, { type: 'portal' }>;

const FRAMES = 8; // the spiral has 3-fold symmetry, so 8 frames over 120 degrees loop seamlessly
const SCALE = 2; // texture pixels per world pixel
const SPARKS_PER_MOUTH = 10; // 20 per portal pair

interface Palette {
  bg: [string, string];
  arms: [string, string, string];
  rim: number;
  glow: number;
}

/** Colours of the two mouths (entrance A = lime green, exit B = orange); the exact tints come from maps.json. */
function palette(hex: string): Palette {
  const base = Phaser.Display.Color.HexStringToColor(hex);
  const mix = (k: number): string => {
    const c = Phaser.Display.Color.ValueToColor(base.color);
    return `rgb(${Math.round(c.red * k)},${Math.round(c.green * k)},${Math.round(c.blue * k)})`;
  };
  const light = (k: number): string => {
    const c = Phaser.Display.Color.ValueToColor(base.color);
    const f = (v: number): number => Math.min(255, Math.round(v + (255 - v) * k));
    return `rgb(${f(c.red)},${f(c.green)},${f(c.blue)})`;
  };
  return {
    bg: [mix(0.18), mix(0.42)],
    arms: [mix(0.55), hex, light(0.55)],
    rim: base.lighten(35).color,
    glow: base.color,
  };
}

/** Bakes the swirl once: FRAMES frames of a three-arm logarithmic spiral clipped to the oval mouth. */
function ensureTexture(scene: Phaser.Scene, key: string, rx: number, ry: number, pal: Palette): void {
  if (scene.textures.exists(key)) return;
  const w = Math.round(rx * 2 * SCALE);
  const h = Math.round(ry * 2 * SCALE);
  const tex = scene.textures.createCanvas(key, w * FRAMES, h);
  if (!tex) return;
  const ctx = tex.getContext();
  for (let f = 0; f < FRAMES; f++) {
    ctx.save();
    ctx.translate(f * w + w / 2, h / 2);
    ctx.scale(w / 2, h / 2); // unit circle -> the oval
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.clip();
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    bg.addColorStop(0, pal.bg[1]);
    bg.addColorStop(1, pal.bg[0]);
    ctx.fillStyle = bg;
    ctx.fillRect(-1, -1, 2, 2);
    const a0 = (f / FRAMES) * ((Math.PI * 2) / 3);
    ctx.lineCap = 'round';
    for (let layer = 0; layer < 3; layer++) {
      ctx.strokeStyle = pal.arms[layer];
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const r = i / 40;
          const th = a0 + (k * Math.PI * 2) / 3 + r * 4.2 + layer * 0.12;
          const x = Math.cos(th) * r * 1.05;
          const y = Math.sin(th) * r * 1.05;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 0.17 - layer * 0.05;
        ctx.stroke();
      }
    }
    // bright centre
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.45);
    core.addColorStop(0, 'rgba(255,255,230,0.95)');
    core.addColorStop(0.5, 'rgba(255,255,200,0.4)');
    core.addColorStop(1, 'rgba(255,255,200,0)');
    ctx.fillStyle = core;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    tex.add(f, 0, f * w, 0, w, h);
  }
  tex.refresh();
}

interface Spark {
  img: Phaser.GameObjects.Image;
  life: number;
  max: number;
  vx: number;
  vy: number;
}

class Mouth {
  readonly box: Phaser.GameObjects.Container;
  readonly swirl: Phaser.GameObjects.Image;
  readonly rim: Phaser.GameObjects.Graphics;
  readonly flash: Phaser.GameObjects.Graphics;
  readonly sparks: Spark[] = [];

  constructor(
    scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    readonly rx: number,
    readonly ry: number,
    readonly key: string,
    readonly pal: Palette,
    depth: number,
  ) {
    this.box = scene.add.container(x, y).setDepth(depth);
    this.swirl = scene.add.image(0, 0, key, 0).setDisplaySize(rx * 2, ry * 2);
    this.rim = scene.add.graphics();
    this.flash = scene.add.graphics().setAlpha(0);
    this.flash.fillStyle(0xffffff, 1).fillEllipse(0, 0, rx * 2.2, ry * 2.2);
    this.box.add([this.swirl, this.rim, this.flash]);
    for (let i = 0; i < SPARKS_PER_MOUTH; i++) {
      const img = scene.add
        .image(x, y, 'atlas', 'dot')
        .setTint(pal.rim)
        .setDepth(depth + 1)
        .setVisible(false);
      this.sparks.push({ img, life: 0, max: 1, vx: 0, vy: 0 });
    }
  }
}

/**
 * Cartoon sci-fi vortex portals: a vertical oval with a spinning three-arm spiral (baked once, played as 8 frames), a bright
 * centre, a pulsing yellow-green rim, sparks and drops leaving the edge, and an open/close animation that grows from the centre
 * with a flash. Reusable by data: size, anchor and the two tints come from maps.json. Drawn above the terrain (depth 35).
 * Reduced effects: slow spin, no sparks.
 */
export class PortalFx {
  private readonly mouths: Mouth[] = [];
  private readonly arrows: Phaser.GameObjects.Graphics;
  private readonly dirAB: number;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    portal: Portal,
    depth = 35,
  ) {
    const ry = portal.ry ?? portal.radius;
    const rx = portal.radius;
    const colors = portal.colors ?? { a: '#7CFF4F', b: '#FF9A4D' };
    const pa = palette(colors.a);
    const pb = palette(colors.b);
    const ka = `portal-${colors.a}-${rx}x${ry}`;
    const kb = `portal-${colors.b}-${rx}x${ry}`;
    ensureTexture(scene, ka, rx, ry, pa);
    ensureTexture(scene, kb, rx, ry, pb);
    this.mouths.push(new Mouth(scene, portal.a.x, portal.a.y, rx, ry, ka, pa, depth));
    this.mouths.push(new Mouth(scene, portal.b.x, portal.b.y, rx, ry, kb, pb, depth));
    this.arrows = scene.add.graphics().setDepth(depth + 2);
    this.dirAB = Math.sign(portal.b.x - portal.a.x) || 1;
    this.opening();
  }

  /** Grows from the centre with a flash (also used when the map appears). */
  opening(): void {
    for (const m of this.mouths) {
      this.scene.tweens.killTweensOf(m.box);
      m.box.setScale(0.05);
      this.scene.tweens.add({
        targets: m.box,
        scaleX: 1,
        scaleY: 1,
        duration: settings.reduceEffects ? 1 : 650,
        ease: 'Back.easeOut',
      });
      this.scene.tweens.killTweensOf(m.flash);
      m.flash.setAlpha(settings.reduceEffects ? 0 : 1);
      this.scene.tweens.add({ targets: m.flash, alpha: 0, duration: 450, ease: 'Cubic.easeOut' });
    }
  }

  /** Shrinks back into the centre. */
  closing(): void {
    for (const m of this.mouths) {
      this.scene.tweens.killTweensOf(m.box);
      this.scene.tweens.add({
        targets: m.box,
        scaleX: 0.05,
        scaleY: 0.05,
        duration: settings.reduceEffects ? 1 : 450,
        ease: 'Back.easeIn',
      });
    }
  }

  /** `unit` = the creature that is aiming (an arrow shows when it is near a mouth). */
  update(dtMs: number, unit: { x: number; y: number } | null): void {
    const dt = dtMs / 1000;
    this.time += dt;
    const reduced = settings.reduceEffects;
    const spin = reduced ? 3 : 12; // frames per second
    const frame = Math.floor(this.time * spin) % FRAMES;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4.2);
    for (const m of this.mouths) {
      m.swirl.setFrame(frame);
      m.rim.clear();
      m.rim.lineStyle(14, m.pal.glow, 0.18 + 0.18 * pulse).strokeEllipse(0, 0, m.rx * 2 + 10, m.ry * 2 + 10);
      m.rim.lineStyle(10, 0x0f0e15, 1).strokeEllipse(0, 0, m.rx * 2 + 4, m.ry * 2 + 4);
      m.rim.lineStyle(5 + 3 * pulse, m.pal.rim, 1).strokeEllipse(0, 0, m.rx * 2, m.ry * 2);
      // sparks and drops leaving the rim (never more than 10 per mouth)
      for (let i = 0; i < m.sparks.length; i++) {
        const s = m.sparks[i];
        if (reduced) {
          if (s.img.visible) s.img.setVisible(false);
          continue;
        }
        s.life -= dt;
        if (s.life <= 0) {
          const a = Math.random() * Math.PI * 2;
          s.max = s.life = 0.6 + Math.random() * 0.8;
          s.vx = Math.cos(a) * (40 + Math.random() * 60);
          s.vy = Math.sin(a) * (40 + Math.random() * 60) - 20;
          s.img
            .setPosition(m.x + Math.cos(a) * m.rx, m.y + Math.sin(a) * m.ry)
            .setVisible(true)
            .setScale(i % 3 === 0 ? 0.55 : 0.35);
        }
        s.vy += 160 * dt * (this.mouths.indexOf(m) === 0 ? 0.6 : 1); // drops fall a little
        s.img.x += s.vx * dt;
        s.img.y += s.vy * dt;
        s.img.setAlpha(Math.max(0, s.life / s.max));
      }
    }
    // direction arrows (entrance A -> exit B) when the aiming creature is near
    this.arrows.clear();
    if (unit) {
      const near = Math.min(...this.mouths.map((m) => Math.hypot(unit.x - m.x, unit.y - m.y)));
      const k = Math.max(0, Math.min(1, (380 - near) / 160));
      if (k > 0) {
        const [a, b] = this.mouths;
        const bob = reduced ? 0 : Math.sin(this.time * 6) * 4;
        this.arrow(a, -this.dirAB, this.dirAB, k, bob); // before A, pointing into it
        this.arrow(b, this.dirAB, this.dirAB, k, bob); // after B, pointing out of it
      }
    }
  }

  private arrow(m: Mouth, side: number, dir: number, alpha: number, bob: number): void {
    const x = m.x + side * (m.rx + 34) + dir * bob;
    const y = m.y;
    this.arrows
      .fillStyle(0x0f0e15, alpha)
      .fillTriangle(x + dir * 18, y, x - dir * 8, y - 18, x - dir * 8, y + 18);
    this.arrows
      .fillStyle(m.pal.rim, alpha)
      .fillTriangle(x + dir * 12, y, x - dir * 4, y - 11, x - dir * 4, y + 11);
  }

  destroy(): void {
    for (const m of this.mouths) {
      m.box.destroy();
      for (const s of m.sparks) s.img.destroy();
    }
    this.arrows.destroy();
  }
}
