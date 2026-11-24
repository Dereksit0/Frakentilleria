import Phaser from 'phaser';
import { pushBackHandler } from './backNav';
import { fullscreenSupported, isIOS } from './fullscreen';
import { addFullscreenButton } from './fullscreenButton';
import { installMode, type InstallMode } from './model/mobile';
import { C, H, INK_W, S, W } from './theme';
import { isStandalone } from './viewport';
import { Button, panel, txt, veil } from './widgets';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}
let deferred: InstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
  });
}

export function currentInstallMode(): InstallMode {
  return installMode({
    standalone: isStandalone(),
    fullscreenApi: fullscreenSupported(),
    iosSafari: isIOS(),
    promptAvailable: deferred !== null,
  });
}

/**
 * "Instalar / Pantalla completa" button: the Fullscreen API when it exists, the browser install prompt on Android Chrome,
 * and a three-step guide (Compartir, Añadir a pantalla de inicio, Abrelo desde el icono) on iPhone Safari.
 * Returns null when the game is already installed or nothing applies.
 */
export function addInstallButton(scene: Phaser.Scene, x: number, y: number, w: number): Button | null {
  const mode = currentInstallMode();
  if (mode === 'hidden') return null;
  if (mode === 'fullscreen') return addFullscreenButton(scene, x, y, w);
  return new Button(scene, x, y, w, 104, 'Instalar', {
    onClick: () => {
      if (mode === 'prompt' && deferred) {
        const p = deferred;
        deferred = null;
        void p.prompt();
      } else openInstallSteps(scene);
    },
  });
}

/** Draws the iOS share glyph (box with an up arrow) so it never depends on a font. */
function shareIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  g.lineStyle(6, C.bone, 1);
  g.beginPath();
  g.moveTo(cx - 18, cy - 4);
  g.lineTo(cx - 18, cy + 26);
  g.lineTo(cx + 18, cy + 26);
  g.lineTo(cx + 18, cy - 4);
  g.strokePath();
  g.lineBetween(cx, cy + 12, cx, cy - 26);
  g.lineBetween(cx, cy - 26, cx - 11, cy - 15);
  g.lineBetween(cx, cy - 26, cx + 11, cy - 15);
}

/** Plus inside a rounded square (the "Añadir a pantalla de inicio" glyph). */
function plusIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  g.lineStyle(6, C.bone, 1).strokeRoundedRect(cx - 24, cy - 24, 48, 48, 10);
  g.lineBetween(cx - 12, cy, cx + 12, cy);
  g.lineBetween(cx, cy - 12, cx, cy + 12);
}

/** App-icon square with a small bolt, for the third step. */
function appIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  g.fillStyle(C.storm, 1).fillRoundedRect(cx - 26, cy - 26, 52, 52, 12);
  g.lineStyle(INK_W, C.bone, 1).strokeRoundedRect(cx - 26, cy - 26, 52, 52, 12);
  g.fillStyle(C.volt, 1).fillTriangle(cx - 6, cy - 16, cx + 12, cy - 2, cx - 2, cy - 2);
  g.fillTriangle(cx + 6, cy + 16, cx - 12, cy + 2, cx + 2, cy + 2);
}

function openInstallSteps(scene: Phaser.Scene): () => void {
  const depth = 220;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const v = veil(scene, 0.85).setDepth(depth);
  objs.push(v);
  const pw = 1200;
  const ph = 640;
  const px = W / 2 - pw / 2;
  const py = H / 2 - ph / 2;
  objs.push(panel(scene, px, py, pw, ph, C.coal, 20).setDepth(depth + 1));
  objs.push(
    txt(scene, W / 2, py + 56, 'Instala el juego en tu iPhone', {
      title: true,
      size: 40,
      origin: [0.5, 0.5],
      raw: true,
    }).setDepth(depth + 2),
  );
  const g = scene.add.graphics().setDepth(depth + 2);
  objs.push(g);
  const steps: [string, (g: Phaser.GameObjects.Graphics, x: number, y: number) => void][] = [
    ['1. Toca Compartir', shareIcon],
    ['2. Añadir a pantalla de inicio', plusIcon],
    ['3. Ábrelo desde el ícono', appIcon],
  ];
  steps.forEach(([label, icon], i) => {
    const cy = py + 170 + i * 120;
    icon(g, px + 110, cy);
    objs.push(
      txt(scene, px + 190, cy, label, { size: 36, origin: [0, 0.5], color: S.bone }).setDepth(depth + 2),
    );
  });
  let closed = false;
  let pop = () => undefined as void;
  const close = () => {
    if (closed) return;
    closed = true;
    pop();
    objs.forEach((o) => o.destroy());
  };
  const ok = new Button(scene, W / 2 - 170, py + ph - 130, 340, 104, 'Entendido', {
    kind: 'primary',
    title: true,
    size: 32,
    onClick: close,
  });
  ok.setDepth(depth + 2);
  objs.push(ok);
  v.on('pointerdown', () => undefined);
  pop = pushBackHandler(close);
  scene.input.keyboard?.once('keydown-ESC', close);
  return close;
}
