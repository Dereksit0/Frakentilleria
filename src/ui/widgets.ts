import Phaser from 'phaser';
import { BTN, C, FONT_BODY, FONT_TITLE, INK_W, RADIUS, S } from './theme';
import { fs, settings } from './settings';
import { sfx } from './audio';
import { atlasRef } from './atlasRefs';

export type BtnKind = 'primary' | 'secondary' | 'danger' | 'ability' | 'tab';

export interface ButtonOpts {
  kind?: BtnKind;
  title?: boolean; // Bungee instead of Nunito
  size?: number;
  onClick?: () => void;
  /** Called when a disabled button is pressed (to explain why). */
  onBlocked?: () => void;
  silent?: boolean;
  /** Frame id of a ready-made icon tile (atlas-ui): it replaces the drawn button and the label. */
  icon?: string;
  /** Frame id of a small icon drawn at the left of the label inside the normal button. */
  leftIcon?: string;
}

const KIND_COLORS: Record<BtnKind, { fill: number; text: string }> = {
  primary: { fill: C.volt, text: S.ink },
  secondary: { fill: C.storm, text: S.bone },
  danger: { fill: C.alarm, text: S.ink },
  ability: { fill: 0x3fc8c0, text: S.ink },
  tab: { fill: C.storm, text: S.bone },
};

export interface TextOpts {
  size?: number;
  color?: string;
  title?: boolean;
  align?: 'left' | 'center' | 'right';
  stroke?: boolean;
  origin?: [number, number];
  width?: number;
  raw?: boolean; // ignore the "Texto grande" scaling
}

/** Text helper: body font = Nunito ExtraBold, title font = Bungee; never smaller than 32 px. */
export function txt(scene: Phaser.Scene, x: number, y: number, str: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const size = o.raw ? Math.max(32, o.size ?? 32) : fs(o.size ?? 32);
  const t = scene.add.text(x, y, str, {
    fontFamily: o.title ? FONT_TITLE : FONT_BODY,
    fontStyle: o.title ? 'normal' : '800',
    fontSize: `${size}px`,
    color: o.color ?? S.bone,
    align: o.align ?? 'left',
    wordWrap: o.width ? { width: o.width } : undefined,
    stroke: o.stroke ? S.ink : undefined,
    strokeThickness: o.stroke ? 8 : 0,
  });
  const org = o.origin ?? [0, 0];
  t.setOrigin(org[0], org[1]);
  return t;
}

/** Touch-sized button with normal / pressed / disabled / selected states. Origin = top-left. */
export class Button extends Phaser.GameObjects.Container {
  readonly w: number;
  readonly h: number;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private kind: BtnKind;
  private enabled = true;
  private selected = false;
  private down = false;
  private opts: ButtonOpts;
  private customFill: number | null = null;
  private customText: string | null = null;
  private focused = false;
  private iconImg?: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, opts: ButtonOpts = {}) {
    super(scene, x, y);
    this.w = w;
    this.h = Math.max(h, 0);
    this.h = h;
    this.opts = opts;
    this.kind = opts.kind ?? 'secondary';
    this.bg = scene.add.graphics();
    this.label = txt(scene, w / 2, h / 2, label, {
      size: opts.size ?? 32,
      title: opts.title ?? false,
      origin: [0.5, 0.5],
      align: 'center',
      width: w - 16,
    });
    this.add([this.bg, this.label]);
    if (opts.icon) {
      this.iconImg = scene.add.image(w / 2, h / 2, ...atlasRef(opts.icon)).setDisplaySize(w, h);
      this.label.setVisible(false);
      this.add(this.iconImg);
    } else if (opts.leftIcon) {
      const px = Math.min(h - 28, 64);
      this.iconImg = scene.add.image(18 + px / 2, h / 2, ...atlasRef(opts.leftIcon));
      this.iconImg.setScale(px / this.iconImg.width);
      this.label.x += (px + 18) / 2;
      this.add(this.iconImg);
    }
    this.setSize(w, h);
    // Containers add their origin (w/2, h/2) to the hit-test point, so offset the area to cover [0,w]x[0,h].
    this.setInteractive(new Phaser.Geom.Rectangle(w / 2, h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';
    this.on('pointerdown', () => {
      this.down = true;
      this.redraw();
    });
    this.on('pointerout', () => {
      this.down = false;
      this.redraw();
    });
    this.on('pointerup', () => {
      const was = this.down;
      this.down = false;
      this.redraw();
      if (was) this.activate();
    });
    scene.add.existing(this);
    this.redraw();
  }

  /** Runs the click action (also used by keyboard activation). */
  activate(): void {
    if (!this.enabled) {
      if (!this.opts.silent) sfx('error');
      this.opts.onBlocked?.();
      return;
    }
    if (!this.opts.silent) sfx('click');
    this.opts.onClick?.();
  }

  setFocused(v: boolean): this {
    this.focused = v;
    this.redraw();
    return this;
  }

  setEnabled(v: boolean): this {
    this.enabled = v;
    this.redraw();
    return this;
  }
  setSelected(v: boolean): this {
    this.selected = v;
    this.redraw();
    return this;
  }
  setLabel(s: string): this {
    this.label.setText(s);
    return this;
  }
  setOnClick(fn: () => void): this {
    this.opts.onClick = fn;
    return this;
  }
  /** Overrides colours (used e.g. for "Habilidad usada" or the player badge colours). */
  setColors(fill: number | null, text: string | null): this {
    this.customFill = fill;
    this.customText = text;
    this.redraw();
    return this;
  }
  get isEnabled(): boolean {
    return this.enabled;
  }

  private redraw(): void {
    const base = KIND_COLORS[this.kind];
    let fill = base.fill;
    let text = base.text;
    if (this.selected) {
      fill = C.volt;
      text = S.ink;
    }
    if (this.customFill !== null) fill = this.customFill;
    if (this.customText !== null) text = this.customText;
    if (!this.enabled) {
      fill = C.disabled;
      text = S.bone;
    }
    const g = this.bg;
    g.clear();
    if (this.opts.icon) {
      const k = this.down && this.enabled ? 0.94 : 1;
      this.iconImg?.setDisplaySize(this.w * k, this.h * k).setAlpha(this.enabled ? 1 : 0.45);
      if (this.focused) g.lineStyle(6, C.volt, 1).strokeRoundedRect(-4, -4, this.w + 8, this.h + 8, RADIUS + 4);
      return;
    }
    const off = this.down && this.enabled ? 4 : 0;
    const shadow = this.enabled ? 6 - off : 0;
    const border = settings.highContrast ? C.bone : C.ink;
    const bw = settings.highContrast ? INK_W + 2 : INK_W;
    if (shadow > 0) {
      g.fillStyle(C.ink, 1);
      g.fillRoundedRect(0, off + shadow, this.w, this.h, RADIUS);
    }
    g.fillStyle(fill, 1);
    g.fillRoundedRect(0, off, this.w, this.h, RADIUS);
    g.lineStyle(bw, this.selected && !this.enabled ? C.volt : border, 1);
    g.strokeRoundedRect(bw / 2, off + bw / 2, this.w - bw, this.h - bw, RADIUS);
    if (this.focused) {
      // Visible keyboard focus: ink halo + volt ring outside the button.
      g.lineStyle(10, C.ink, 1).strokeRoundedRect(-7, -7, this.w + 14, this.h + 14, RADIUS + 5);
      g.lineStyle(5, C.volt, 1).strokeRoundedRect(-7, -7, this.w + 14, this.h + 14, RADIUS + 5);
    }
    this.label.setColor(text);
    this.label.setY(this.h / 2 + off);
    this.setAlpha(1);
  }
}

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number = C.night,
  radius = 16,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(INK_W, C.ink, 1);
  g.strokeRoundedRect(x + INK_W / 2, y + INK_W / 2, w - INK_W, h - INK_W, radius);
  return g;
}

/** Standard 104 px "back"/pause style square button. */
export function squareButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void): Button {
  return new Button(scene, x, y, BTN, BTN, label, { kind: 'secondary', title: true, size: 40, onClick });
}

/** Full-screen translucent veil used by overlay scenes (Pause, Tutorial...). */
export function veil(scene: Phaser.Scene, alpha = 0.72): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(0, 0, 1600, 900, C.ink, alpha).setOrigin(0);
  r.setInteractive(); // swallow clicks below
  return r;
}

export function fadeIn(scene: Phaser.Scene, ms = 250): void {
  if (settings.reduceEffects) return;
  scene.cameras.main.fadeIn(ms, 15, 14, 21);
}

export function goTo(scene: Phaser.Scene, key: string, data?: object, ms = 220): void {
  if (settings.reduceEffects) {
    scene.scene.start(key, data);
    return;
  }
  scene.cameras.main.fadeOut(ms, 15, 14, 21);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}

/**
 * Keyboard focus for a group of buttons: Tab / Shift+Tab move the visible ring, Enter / Space activate it.
 * Returns helpers so the scene can know whether a button currently holds the focus.
 */
export function enableKeyboardFocus(scene: Phaser.Scene, buttons: () => Button[]): { hasFocus: () => boolean; clear: () => void } {
  let index = -1;
  const kb = scene.input.keyboard;
  const apply = () => buttons().forEach((b, i) => b.setFocused(i === index));
  kb?.addCapture('TAB');
  kb?.on('keydown-TAB', (e: KeyboardEvent) => {
    const list = buttons().filter((b) => b.visible);
    if (!list.length) return;
    const cur = index >= 0 ? buttons()[index] : null;
    let pos = cur ? list.indexOf(cur) : -1;
    pos = (pos + (e.shiftKey ? -1 : 1) + list.length) % list.length;
    index = buttons().indexOf(list[pos]);
    apply();
  });
  const act = () => {
    if (index >= 0) buttons()[index]?.activate();
  };
  kb?.on('keydown-ENTER', act);
  kb?.on('keydown-SPACE', act);
  return {
    hasFocus: () => index >= 0,
    clear: () => {
      index = -1;
      apply();
    },
  };
}
