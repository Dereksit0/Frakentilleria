import Phaser from 'phaser';
import { resolveBack } from '../core/flow';
import { pushBackHandler } from '../ui/backNav';
import { CreatureView } from '../ui/creatureView';
import { openConfirm } from '../ui/modal';
import { resetCreatures, session } from '../ui/session';
import { C, H, S, W } from '../ui/theme';
import { Button, enableKeyboardFocus, fadeIn, goTo, panel, txt } from '../ui/widgets';
import { playerBadge } from './Lab';

/** Screen between J1 and J2 so the second player does not see the first creature. */
export class PassDevice extends Phaser.Scene {
  constructor() {
    super('PassDevice');
  }

  create(): void {
    fadeIn(this);
    this.add.rectangle(0, 0, W, H, C.coal).setOrigin(0);
    txt(this, W / 2, 110, 'Tu criatura está lista', {
      title: true,
      size: 52,
      origin: [0.5, 0.5],
      stroke: true,
    });
    txt(this, W / 2, 210, 'Pasa el dispositivo', {
      title: true,
      size: 64,
      origin: [0.5, 0.5],
      color: S.volt,
    });
    const row = this.add.container(W / 2, 300);
    const label = txt(this, 0, 0, 'al', { size: 40, origin: [0, 0.5] });
    row.add(label);
    playerBadge(this, W / 2 + 10, 262, 2);

    // Hidden silhouette of the J1 creature with a question mark.
    const sel = session.selections[0];
    if (sel) {
      const c = new CreatureView(this, 340, 700, sel, 0.8);
      c.setSilhouette(true, C.night);
      c.setAim(1, 10);
      txt(this, 340, 520, '?', { title: true, size: 96, origin: [0.5, 0.5], color: S.bone });
    }
    panel(this, 620, 400, 900, 190, C.night);
    txt(
      this,
      650,
      420,
      'No mires la pantalla del Jugador 2. La criatura de J1 se muestra tapada hasta que empiece el combate.',
      { size: 34, width: 840 },
    );
    // The only way out of this screen is cancelling to the menu (going back would reveal J1's creature).
    let modal = false;
    const cancel = new Button(this, 48, 6, 260, 104, '‹ Cancelar', { onClick: () => requestBack() });
    const requestBack = () => {
      if (modal) return;
      const r = resolveBack({ screen: 'pass', dirty: false });
      if (r.kind !== 'confirm') return;
      modal = true;
      openConfirm(
        this,
        r.message,
        () => {
          resetCreatures();
          goTo(this, 'Menu');
        },
        () => (modal = false),
      );
    };
    const go = new Button(this, W / 2 + 80, 680, 620, 104, 'Soy el Jugador 2', {
      kind: 'primary',
      title: true,
      onClick: () => goTo(this, 'Lab', { player: 2 }),
    });
    void go;
    const focus = enableKeyboardFocus(this, () => (modal ? [] : [cancel, go]));
    this.input.keyboard?.on('keydown-ENTER', () => {
      if (!modal && !focus.hasFocus()) goTo(this, 'Lab', { player: 2 });
    });
    this.input.keyboard?.on('keydown-ESC', requestBack);
    const pop = pushBackHandler(requestBack);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, pop);
  }
}
