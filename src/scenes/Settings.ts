import Phaser from 'phaser';
import { pushBackHandler } from '../ui/backNav';
import { addFullscreenButton } from '../ui/fullscreenButton';
import { fullscreenSupported, isIOS } from '../ui/fullscreen';
import { settings, updateSetting, type SettingsData } from '../ui/settings';
import { C, H, S, W } from '../ui/theme';
import { Button, panel, txt, veil } from '../ui/widgets';

const ROWS: { key: keyof SettingsData; label: string }[] = [
  { key: 'sfx', label: 'Efectos de sonido' },
  { key: 'music', label: 'Música' },
  { key: 'vibration', label: 'Vibración' },
  { key: 'highContrast', label: 'Alto contraste' },
  { key: 'bigText', label: 'Texto grande' },
  { key: 'reduceEffects', label: 'Reducir efectos' },
];

/** Escena superpuesta: los interruptores se guardan en localStorage y se aplican al momento. */
export class Settings extends Phaser.Scene {
  private returnTo = 'Menu';

  constructor() {
    super('Settings');
  }

  init(data: { returnTo?: string }): void {
    this.returnTo = data.returnTo ?? 'Menu';
  }

  create(): void {
    veil(this, 0.85);
    panel(this, 80, 50, W - 160, H - 100, C.coal, 24);
    const logo = this.add.image(190, 108, 'logo');
    logo.setScale(Math.min(240 / logo.width, 1));
    txt(this, W / 2, 110, 'Ajustes', { title: true, size: 48, origin: [0.5, 0.5], stroke: true });

    const make = () => {
      this.children.removeAll(true);
      this.scene.restart({ returnTo: this.returnTo });
    };

    ROWS.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 120 + col * 700;
      const y = 190 + row * 124;
      const on = settings[r.key];
      const b = new Button(this, x, y, 660, 104, `${r.label}: ${on ? 'SÍ' : 'NO'}`, {
        kind: 'secondary',
        onClick: () => {
          updateSetting(r.key, !settings[r.key]);
          make();
        },
      });
      b.setSelected(on);
    });

    if (!addFullscreenButton(this, 120, 562, 660) && !fullscreenSupported() && isIOS()) {
      txt(this, 120, 574, 'Para pantalla completa: Compartir → Añadir a pantalla de inicio', {
        size: 32,
        width: 1300,
        color: S.volt,
      });
    }
    new Button(this, W / 2 - 200, 690, 400, 104, 'Volver', {
      kind: 'primary',
      title: true,
      onClick: () => this.close(),
    });
    this.input.keyboard?.once('keydown-ESC', () => this.close());
    const pop = pushBackHandler(() => this.close());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, pop);
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.returnTo);
  }
}
