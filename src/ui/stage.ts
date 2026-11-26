import Phaser from 'phaser';
import { C, H, W } from './theme';

/**
 * Full-screen layout on any aspect ratio. The game runs in Scale.EXPAND: the canvas keeps the 1600x900 design area and
 * grows along the axis the screen has to spare (wider phones, taller tablets), so there are no black bars and nothing is
 * stretched. Every scene keeps laying itself out in design coordinates:
 * - its camera is centred on the design area;
 * - full-screen backdrops (rectangles and images that cover the design area) are grown to cover the whole view;
 * - the Battle camera zooms just enough to fill a wider screen with the battlefield (uniform zoom: proportions and physics
 *   are untouched); on a taller screen it shows more sky instead.
 * The HUD and menus stay inside the design area, so they are never cut.
 */
export interface View {
  /** Visible rectangle in design coordinates. */
  left: number;
  top: number;
  w: number;
  h: number;
  /** Extra canvas pixels on each side of the design area (game-size units). */
  ox: number;
  oy: number;
}

/** Zoom of the Battle camera for a canvas of gw x gh: fill the width on screens wider than 16:9. */
export function battleZoom(gw: number, gh: number): number {
  return gw / gh > W / H ? gw / W : 1;
}

/** `floor`: the view's bottom edge stays on the design floor (y = 900), so a taller screen shows only extra sky above. */
export function viewOf(gw: number, gh: number, zoom = 1, floor = false): View {
  const w = gw / zoom;
  const h = gh / zoom;
  const top = floor ? Math.min((H - h) / 2, H - h) : (H - h) / 2;
  return { left: (W - w) / 2, top, w, h, ox: (gw - W) / 2, oy: (gh - H) / 2 };
}

/** The battlefield has nothing below its floor: Battle keeps the floor at the bottom of the screen. */
const floored = (scene: Phaser.Scene): boolean => scene.scene.key === 'Battle';

const BASE = 'stageBase';
interface Base {
  x: number;
  y: number;
  w: number;
  h: number;
}

function isBackdrop(
  o: Phaser.GameObjects.GameObject,
): o is Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image {
  if (!(o instanceof Phaser.GameObjects.Rectangle) && !(o instanceof Phaser.GameObjects.Image)) return false;
  if (o.getData(BASE)) return true;
  if (o.scrollFactorX !== 1 || o.parentContainer) return false;
  const left = o.x - o.displayOriginX * o.scaleX;
  const top = o.y - o.displayOriginY * o.scaleY;
  return Math.abs(left) < 1 && Math.abs(top) < 1 && o.displayWidth >= W - 1 && o.displayHeight >= H - 1;
}

/** Grows a design-area backdrop to cover the view, centred, keeping its aspect (images) or just its colour (rectangles). */
function cover(o: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image, v: View): void {
  let b = o.getData(BASE) as Base | undefined;
  if (!b) {
    b = { x: o.x, y: o.y, w: o.displayWidth, h: o.displayHeight };
    o.setData(BASE, b);
  }
  if (o instanceof Phaser.GameObjects.Rectangle) {
    o.setOrigin(0).setPosition(v.left, v.top).setSize(v.w, v.h);
    return;
  }
  const f = Math.max(v.w / b.w, v.h / b.h, 1);
  o.setOrigin(0.5)
    .setDisplaySize(b.w * f, b.h * f)
    .setPosition(W / 2, H / 2);
}

export function layoutScene(scene: Phaser.Scene): void {
  const cam = scene.cameras?.main;
  if (!cam) return;
  const { width: gw, height: gh } = scene.scale.gameSize;
  const zoom = scene.scene.key === 'Battle' ? battleZoom(gw, gh) : 1;
  cam.setZoom(zoom);
  const v = viewOf(gw, gh, zoom, floored(scene));
  cam.centerOn(v.left + v.w / 2, v.top + v.h / 2);
  // Battle moves its parallax images every frame: only its plain full-screen rectangles (storm shade) are grown here
  const imagesToo = scene.scene.key !== 'Battle';
  for (const o of scene.children.list)
    if (isBackdrop(o) && (imagesToo || o instanceof Phaser.GameObjects.Rectangle)) cover(o, v);
}

/** Visible rectangle of a scene's main camera, in design coordinates. */
export function sceneView(scene: Phaser.Scene): View {
  const { width: gw, height: gh } = scene.scale.gameSize;
  return viewOf(gw, gh, scene.cameras.main.zoom, floored(scene));
}

/** Pointer position in the scene's design coordinates (camera centring and zoom included). */
export function designPoint(scene: Phaser.Scene, p: { x: number; y: number }): { x: number; y: number } {
  const v = scene.cameras.main.getWorldPoint(p.x, p.y);
  return { x: v.x, y: v.y };
}

/** Lays out every scene when it is created and whenever the canvas changes size. */
export function installStage(game: Phaser.Game): void {
  const hook = (): void => {
    for (const s of game.scene.scenes) {
      s.sys.events.on(Phaser.Scenes.Events.CREATE, () => layoutScene(s));
      // overlays (Pause, Tutorial...) add their veil in create too; anything added later is laid out on resize
    }
  };
  if (game.isRunning)
    hook(); // scenes only exist after READY (isBooted is set earlier)
  else game.events.once(Phaser.Core.Events.READY, hook);
  game.scale.on(Phaser.Scale.Events.RESIZE, () => {
    for (const s of game.scene.getScenes(true)) layoutScene(s);
  });
}

/** Default page colour behind any scene that leaves a gap (never black bars). */
export const STAGE_BG = C.coal;
