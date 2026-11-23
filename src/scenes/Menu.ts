import Phaser from 'phaser';
import { Rng } from '../core/rng';
import { randomSelection } from '../core/stats';
import { startMusic } from '../ui/audio';
import { CreatureView } from '../ui/creatureView';
import { cycleMapChoice, mapChoiceLabel, newMatchSeed, resetCreatures } from '../ui/session';
import { C, H, S, W } from '../ui/theme';
import { Button, fadeIn, goTo, txt } from '../ui/widgets';
import { coverImage } from './Splash';

export class Menu extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    fadeIn(this);
    startMusic(this);
    coverImage(this, 'bg-menu');
    this.add.rectangle(0, 0, W, H, C.ink, 0.45).setOrigin(0);

    const logo = this.add.image(W / 2, 190, 'logo');
    logo.setScale(Math.min(860 / logo.width, 1));
    txt(this, W / 2, 372, 'Ensambla. Dispara. Sobrevive.', { size: 40, origin: [0.5, 0.5], color: S.bone, stroke: true });

    const bw = 460;
    const bx = W / 2 - bw / 2;
    new Button(this, bx, 440, bw, 104, 'Jugar', {
      kind: 'primary',
      title: true,
      size: 40,
      onClick: () => {
        newMatchSeed();
        resetCreatures();
        goTo(this, 'Lab', { player: 1 });
      },
    });
    new Button(this, bx, 564, bw, 104, 'Cómo jugar', { onClick: () => this.openOverlay('Tutorial') });
    new Button(this, bx, 688, bw, 104, 'Ajustes', { onClick: () => this.openOverlay('Settings') });

    const mapBtn = new Button(this, 48, 770, 480, 104, '', { onClick: () => undefined });
    const refresh = () => mapBtn.setLabel(`Mapa: ${mapChoiceLabel()}`);
    mapBtn.setOnClick(() => {
      cycleMapChoice();
      refresh();
    });
    refresh();

    txt(this, W - 48, H - 24, 'v0.1 · Equipo FrankenTillería', { origin: [1, 1], stroke: true });

    // Two decorative creatures facing each other.
    const rng = new Rng(7);
    const a = new CreatureView(this, 250, 700, randomSelection(rng), 0.62);
    const b = new CreatureView(this, W - 250, 700, randomSelection(rng), 0.62);
    a.setAim(1, 20);
    b.setAim(-1, 160);
    a.idle(this, 0);
    b.idle(this, 2);
  }

  private openOverlay(key: 'Tutorial' | 'Settings'): void {
    this.scene.pause();
    this.scene.launch(key, { returnTo: 'Menu' });
  }
}
