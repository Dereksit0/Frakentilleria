import Phaser from 'phaser';
import { MAX_WIND_PARTICLES, WIND_KINDS, windVisual } from '../core/windVisual';
import { settings } from './settings';
import { C, H, W } from './theme';

type Kind = 'paper' | 'leaf' | 'fluff' | 'dust' | 'fog' | 'confetti';

interface Mote {
  img: Phaser.GameObjects.Image;
  kind: Kind;
  speed: number;
  phase: number;
  freq: number;
  spin: number;
}

/** Generador mínimo y determinista: las partículas de ambiente nunca tocan los generadores del juego. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

const PALETTE: Record<Kind, number[]> = {
  paper: [0xf4efe1, 0xd9cfb5],
  dust: [0xb9a27a, 0x9a8a6a],
  leaf: [0xc9a23b, 0x8a5a22, 0x6d8a2b],
  fog: [0xc8bff0, 0xa99be0],
  fluff: [0xffffff, 0xf4efe1],
  confetti: [C.volt, C.p1, C.p2, C.acid],
};

/**
 * Viento ambiente: una reserva de máximo 60 sprites reutilizables (papeles y polvo en el Vertedero, hojas y niebla en el
 * Cementerio, pelusa y confeti en la Fábrica), más rayas de ráfaga y un destello en el borde. La velocidad y la dirección
 * siguen al viento y la cantidad es proporcional a su fuerza. Después del constructor no se crea nada.
 * "Reducir efectos" no muestra nada de esto.
 */
export class WindFx {
  private readonly motes: Mote[] = [];
  private readonly streak: Phaser.GameObjects.Image;
  private readonly edge: Phaser.GameObjects.Rectangle;
  private streakT = 0;
  private nextStreak = 1.2;
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    mapId: string,
    depth = 36,
  ) {
    const kinds = WIND_KINDS[mapId] ?? WIND_KINDS.vertedero;
    const rnd = lcg(mapId.length * 7919 + 13);
    for (let i = 0; i < MAX_WIND_PARTICLES; i++) {
      const kind = (i % 3 === 0 ? kinds[1] : kinds[0]) as Kind;
      const img = scene.add
        .image(rnd() * W, rnd() * H * 0.8, 'atlas', 'dot')
        .setDepth(depth)
        .setVisible(false);
      const pal = PALETTE[kind];
      img.setTint(pal[Math.floor(rnd() * pal.length)]);
      const scale: Record<Kind, [number, number, number]> = {
        paper: [2.2, 1.4, 0.8],
        dust: [0.5, 0.5, 0.5],
        leaf: [1.6, 0.9, 0.9],
        fog: [7, 4, 0.13],
        fluff: [0.7, 0.7, 0.85],
        confetti: [0.9, 0.5, 0.95],
      };
      const [sx, sy, a] = scale[kind];
      img.setScale(sx, sy).setAlpha(a);
      this.motes.push({
        img,
        kind,
        speed: 0.55 + rnd() * 0.9,
        phase: rnd() * 6.28,
        freq: 0.8 + rnd() * 1.6,
        spin: (rnd() - 0.5) * 4,
      });
    }
    this.streak = scene.add
      .image(-300, 300, 'atlas-fx', 'ev-wind-streaks')
      .setDepth(depth + 1)
      .setAlpha(0)
      .setScale(1.6);
    this.edge = scene.add
      .rectangle(0, 0, 90, H, 0xffffff, 0)
      .setOrigin(0)
      .setDepth(depth + 30)
      .setScrollFactor(0);
  }

  /** Partículas vivas ahora (para pruebas y la revisión de rendimiento). */
  get alive(): number {
    return this.motes.filter((m) => m.img.visible).length;
  }

  update(dt: number, wind: number): void {
    this.time += dt;
    const v = windVisual(wind);
    const n = settings.reduceEffects ? 0 : v.particles;
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      const on = i < n;
      if (m.img.visible !== on) m.img.setVisible(on);
      if (!on) continue;
      const img = m.img;
      const fall = m.kind === 'leaf' ? 14 : m.kind === 'confetti' ? 20 : m.kind === 'fog' ? 0 : 4;
      img.x += v.driftSpeed * m.speed * dt;
      img.y += (Math.sin(this.time * m.freq + m.phase) * 22 + fall) * dt;
      if (m.kind !== 'fog' && m.kind !== 'dust') img.rotation += m.spin * dt;
      if (img.x > W + 60) {
        img.x = -60;
        img.y = ((Math.sin(m.phase * 99) + 1) / 2) * H * 0.8;
      } else if (img.x < -60) {
        img.x = W + 60;
        img.y = ((Math.sin(m.phase * 99) + 1) / 2) * H * 0.8;
      }
      if (img.y > H * 0.85) img.y = 20;
    }
    // rayas de ráfaga que cruzan la pantalla con viento fuerte
    if (v.streaks && !settings.reduceEffects) {
      this.nextStreak -= dt;
      if (this.nextStreak <= 0 && this.streakT <= 0) {
        this.streakT = 1.4;
        this.nextStreak = 2.2 + (Math.sin(this.time * 3.1) + 1);
        this.streak.setFlipX(v.direction < 0);
        this.streak.y = 160 + ((Math.sin(this.time * 7.7) + 1) / 2) * 300;
      }
    }
    if (this.streakT > 0) {
      this.streakT -= dt;
      const p = 1 - Math.max(0, this.streakT) / 1.4;
      const dir = v.direction || 1;
      this.streak.x = dir > 0 ? -200 + p * (W + 400) : W + 200 - p * (W + 400);
      this.streak.setAlpha(Math.sin(Math.PI * p) * 0.6);
    } else if (this.streak.alpha !== 0) {
      this.streak.setAlpha(0);
    }
  }

  /** Destello en el borde de la pantalla de donde sopla el viento (ráfaga fuerte en vuelo). */
  gustFlash(direction: number): void {
    if (settings.reduceEffects) return;
    const left = direction > 0;
    this.edge
      .setPosition(left ? 0 : W - 90, 0)
      .setFillStyle(0xffffff, 0.28)
      .setAlpha(1);
    this.scene.tweens.killTweensOf(this.edge);
    this.scene.tweens.add({ targets: this.edge, alpha: 0, duration: 380, ease: 'Cubic.easeOut' });
  }
}
