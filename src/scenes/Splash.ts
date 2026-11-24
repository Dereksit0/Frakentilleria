import Phaser from 'phaser';
import { isMobile } from '../ui/device';
import { enterFullscreen } from '../ui/fullscreen';
import { H, S, W } from '../ui/theme';
import { settings } from '../ui/settings';
import { txt } from '../ui/widgets';

export function coverImage(scene: Phaser.Scene, key: string): Phaser.GameObjects.Image {
  const img = scene.add.image(W / 2, H / 2, key);
  const s = Math.max(W / img.width, H / img.height);
  return img.setScale(s);
}

export class Splash extends Phaser.Scene {
  constructor() {
    super('Splash');
  }

  create(): void {
    if (this.textures.exists('bg-splash')) coverImage(this, 'bg-splash');
    if (this.textures.exists('logo')) {
      const logo = this.add.image(W / 2, 170, 'logo');
      logo.setScale(Math.min(760 / logo.width, 1));
    }
    const hint = txt(this, W / 2, H - 70, 'Toca para empezar', {
      origin: [0.5, 0.5],
      color: S.bone,
      stroke: true,
    });
    if (!settings.reduceEffects) {
      this.tweens.add({ targets: hint, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
      this.cameras.main.fadeIn(400, 15, 14, 21);
    }
    let done = false;
    const next = () => {
      if (done) return;
      done = true;
      this.scene.start('Menu');
    };
    // Fullscreen needs a user gesture: ask on the first tap, only on phones/tablets, and never insist afterwards.
    this.input.once('pointerup', () => {
      if (isMobile()) void enterFullscreen();
      next();
    });
    this.input.keyboard?.once('keydown', next);
    this.time.delayedCall(2600, next);
  }
}
