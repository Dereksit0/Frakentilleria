import Phaser from 'phaser';
import { pushBackHandler } from '../ui/backNav';
import { C, H, W } from '../ui/theme';
import { Button, panel, txt, veil } from '../ui/widgets';

/** Pause overlay on top of the battle. */
export class Pause extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    veil(this, 0.78);
    panel(this, W / 2 - 330, 50, 660, H - 100, C.coal, 24);
    txt(this, W / 2, 120, 'Pausa', { title: true, size: 56, origin: [0.5, 0.5], stroke: true });
    const x = W / 2 - 250;
    new Button(this, x, 210, 500, 104, 'Continuar', {
      kind: 'primary',
      title: true,
      onClick: () => this.resume(),
    });
    new Button(this, x, 338, 500, 104, 'Cómo jugar', { onClick: () => this.overlay('Tutorial') });
    new Button(this, x, 466, 500, 104, 'Ajustes', {
      leftIcon: 'hud-settings',
      onClick: () => this.overlay('Settings'),
    });
    new Button(this, x, 594, 500, 104, 'Salir al menú', {
      kind: 'danger',
      leftIcon: 'ui-home',
      onClick: () => {
        this.scene.stop('Hud');
        this.scene.stop('Battle');
        this.scene.stop();
        this.scene.start('Menu');
      },
    });
    this.input.keyboard?.once('keydown-ESC', () => this.resume());
    const pop = pushBackHandler(() => this.resume());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, pop);
  }

  private overlay(key: 'Tutorial' | 'Settings'): void {
    this.scene.pause();
    this.scene.launch(key, { returnTo: 'Pause' });
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume('Battle');
    this.scene.resume('Hud');
  }
}
