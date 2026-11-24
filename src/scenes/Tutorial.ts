import Phaser from 'phaser';
import { pushBackHandler } from '../ui/backNav';
import { CreatureView } from '../ui/creatureView';
import { C, S, W } from '../ui/theme';
import { Button, panel, txt, veil } from '../ui/widgets';

const STEPS = [
  {
    title: 'Arma tu criatura',
    body: 'En el laboratorio eliges cabeza, torso, brazos y piernas de 5 donantes distintos.',
  },
  {
    title: 'Cuida tu presupuesto',
    body: 'Cada pieza cuesta puntos. Si te pasas del límite no puedes empezar.',
  },
  {
    title: 'Apunta y dispara',
    body: 'Arrastra en cualquier zona libre para apuntar. Ajusta la potencia y pulsa ¡Fuego!',
  },
  { title: 'Mira el viento', body: 'El viento empuja tus proyectiles. Cambia cada turno, de −5 a +5.' },
  {
    title: 'Sobrevive a la tormenta',
    body: 'Desde la ronda 6 el ácido sube. Quédate en terreno alto y gana al rival.',
  },
];

/** 5-step tutorial shown as an overlay (from the menu, the pause screen or the battle help button). */
export class Tutorial extends Phaser.Scene {
  private returnTo = 'Menu';
  private step = 0;

  constructor() {
    super('Tutorial');
  }

  init(data: { returnTo?: string }): void {
    this.returnTo = data.returnTo ?? 'Menu';
    this.step = 0;
  }

  create(): void {
    this.render();
    this.input.keyboard?.on('keydown-ESC', () => this.close());
    const pop = pushBackHandler(() => this.close());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, pop);
    this.input.keyboard?.on('keydown-ENTER', () => this.next());
  }

  private render(): void {
    this.children.removeAll(true);
    veil(this, 0.85);
    const cardX = 250;
    const cardW = W - 500;
    panel(this, cardX, 40, cardW, 690, C.bone, 24);
    const s = STEPS[this.step];
    const cx = W / 2;

    // Illustration (drawn from atlas frames / code)
    const g = this.add.graphics();
    g.fillStyle(C.night, 1).fillRoundedRect(cardX + 60, 70, cardW - 120, 270, 16);
    this.illustration(this.step, cx, 205);

    txt(this, cx, 380, `${this.step + 1}. ${s.title}`, {
      title: true,
      size: 40,
      color: S.ink,
      origin: [0.5, 0.5],
    });
    txt(this, cx, 420, s.body, {
      size: 34,
      color: S.ink,
      origin: [0.5, 0],
      align: 'center',
      width: cardW - 120,
    });

    // Progress pills: the current one is wider (shape + colour).
    let px = cx - (STEPS.length * 44) / 2;
    for (let i = 0; i < STEPS.length; i++) {
      const cur = i === this.step;
      const w = cur ? 56 : 28;
      this.add
        .rectangle(px, 680, w, 14, cur ? C.storm : C.disabled)
        .setOrigin(0, 0.5)
        .setStrokeStyle(2, C.ink);
      px += w + 16;
    }

    const last = this.step === STEPS.length - 1;
    new Button(this, cardX, 760, 260, 104, 'Saltar', { onClick: () => this.close() });
    new Button(this, cardX + cardW - 420, 760, 420, 104, last ? '¡A jugar!' : 'Siguiente', {
      kind: 'primary',
      title: true,
      onClick: () => this.next(),
    });
    if (this.step > 0)
      new Button(this, cardX + 300, 760, 260, 104, 'Atrás', {
        onClick: () => {
          this.step--;
          this.render();
        },
      });
  }

  private illustration(step: number, x: number, y: number): void {
    const t = (str: string, dx: number, dy: number, color: string = S.bone) =>
      txt(this, x + dx, y + dy, str, { origin: [0.5, 0.5], color, title: true, size: 40 });
    switch (step) {
      case 0: {
        const c = new CreatureView(
          this,
          x,
          y + 120,
          { head: 'armadura', torso: 'refri', arms: 'juguete', legs: 'maniqui' },
          0.45,
        );
        c.setAim(1, 20);
        break;
      }
      case 1:
        t('18 / 22 puntos', 0, -30);
        this.add.rectangle(x, y + 40, 600, 36, C.ink).setStrokeStyle(4, C.bone);
        this.add.rectangle(x - 300 + 2, y + 40, 480, 28, C.acid).setOrigin(0, 0.5);
        break;
      case 2: {
        const g = this.add.graphics();
        g.fillStyle(C.bone, 1);
        for (let i = 0; i < 14; i++) {
          const u = i / 13;
          g.fillCircle(x - 280 + u * 560, y + 70 - Math.sin(u * Math.PI) * 140, 8);
        }
        this.add.image(x + 300, y + 60, 'atlas', 'fx_rocket').setScale(0.7);
        t('¡Fuego!', -250, 80, S.alarmSoft);
        break;
      }
      case 3:
        this.add.image(x, y - 10, 'atlas', 'fx_cloud').setScale(0.8);
        t('Viento  → 3', 0, 90, S.volt);
        break;
      default:
        this.add.image(x, y, 'atlas', 'fx_splash').setScale(0.9);
        t('Ronda 6', 0, 100, S.acid);
    }
  }

  private next(): void {
    if (this.step >= STEPS.length - 1) {
      this.close();
      return;
    }
    this.step++;
    this.render();
  }

  private close(): void {
    this.scene.stop();
    this.scene.resume(this.returnTo);
    if (this.returnTo === 'Battle') this.scene.resume('Hud');
  }
}
