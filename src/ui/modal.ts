import Phaser from 'phaser';
import { BACK_MESSAGES, type BackMessageKey } from '../core/flow';
import { pushBackHandler } from './backNav';
import { C, H, S, W } from './theme';
import { Button, enableKeyboardFocus, panel, txt, veil } from './widgets';

/**
 * Small confirmation dialog ("¿Salir? Perderás los cambios" · Quedarme / Salir).
 * Esc, the browser back button and a tap outside the dialog all mean "Quedarme".
 */
export function openConfirm(
  scene: Phaser.Scene,
  key: BackMessageKey,
  onLeave: () => void,
  onClose?: () => void,
): () => void {
  const m = BACK_MESSAGES[key];
  const objs: Phaser.GameObjects.GameObject[] = [];
  const depth = 200;
  const v = veil(scene, 0.8).setDepth(depth);
  objs.push(v);
  const pw = 820;
  const ph = 380;
  const px = W / 2 - pw / 2;
  const py = H / 2 - ph / 2;
  objs.push(panel(scene, px, py, pw, ph, C.coal, 20).setDepth(depth + 1));
  objs.push(
    txt(scene, W / 2, py + 70, m.title, { title: true, size: 44, origin: [0.5, 0.5], raw: true }).setDepth(
      depth + 2,
    ),
  );
  objs.push(
    txt(scene, W / 2, py + 150, m.body, {
      size: 36,
      origin: [0.5, 0.5],
      color: S.bone,
      align: 'center',
      width: pw - 80,
    }).setDepth(depth + 2),
  );

  let closed = false;
  let pop = () => undefined as void;
  const close = () => {
    if (closed) return;
    closed = true;
    pop();
    objs.forEach((o) => o.destroy());
    onClose?.();
  };
  const stay = new Button(scene, W / 2 - 360, py + ph - 150, 340, 104, m.stay, {
    kind: 'primary',
    title: true,
    size: 32,
    onClick: close,
  });
  const leave = new Button(scene, W / 2 + 20, py + ph - 150, 340, 104, m.leave, {
    kind: 'danger',
    title: true,
    size: 32,
    onClick: () => {
      close();
      onLeave();
    },
  });
  stay.setDepth(depth + 2);
  leave.setDepth(depth + 2);
  objs.push(stay, leave);
  v.on('pointerdown', () => undefined);
  pop = pushBackHandler(close);
  // Keyboard: Tab moves between the two buttons; the safe choice is focused first.
  const focus = enableKeyboardFocus(scene, () => (closed ? [] : [stay, leave]));
  void focus;
  scene.input.keyboard?.once('keydown-ESC', close);
  return close;
}
