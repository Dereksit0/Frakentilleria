import Phaser from 'phaser';
import { ACHIEVEMENTS, COSMETICS, sharedCollection, type CosmeticDef } from '../core/rewards';
import { atlasRef, loadLazyAtlases } from '../ui/atlasRefs';
import { designPoint, viewOf } from '../ui/stage';
import { pushBackHandler } from '../ui/backNav';
import { C, H, S, W } from '../ui/theme';
import { Button, fadeIn, goTo, txt } from '../ui/widgets';

const KIND_LABEL: Record<CosmeticDef['kind'], string> = {
  parche: 'Parches',
  sombrero: 'Sombreros',
  color: 'Colores',
};
const MARGIN = 48;
const GAP = 16;
/** Header and bottom bar (info line + Volver) heights: the band between them scrolls. */
const HEADER = 150;
const FOOTER = 150;
const ICON = 96;
const DRAG_SLOP = 12;

/**
 * Collection: cosmetics won in chests (no combat effect) and the 8 achievements as badges.
 * Every card shows its real art; an item without art shows its name and a lock, never a placeholder shape.
 */
export class Coleccion extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container;
  /** Scrollable band in design coordinates; it grows with a taller screen (see ui/stage.ts). */
  private viewTop = HEADER;
  private viewBottom = H - FOOTER;
  private scrollY = 0;
  private maxScroll = 0;

  constructor() {
    super('Coleccion');
  }

  preload(): void {
    loadLazyAtlases(this); // hats and patches live in atlas-items
  }

  create(): void {
    fadeIn(this);
    this.scrollY = 0;
    const { width: gw, height: gh } = this.scale.gameSize;
    const v = viewOf(gw, gh);
    this.viewTop = v.top + HEADER;
    this.viewBottom = v.top + v.h - FOOTER;
    const relayout = (): void => void this.scene.restart();
    this.scale.on(Phaser.Scale.Events.RESIZE, relayout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, relayout),
    );
    const pop = pushBackHandler(() => goTo(this, 'Menu'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, pop);
    this.input.keyboard?.on('keydown-ESC', () => goTo(this, 'Menu'));
    this.add.rectangle(0, 0, W, H, C.coal).setOrigin(0);
    this.add.rectangle(0, 0, W, H, C.storm, 0.3).setOrigin(0);

    const col = sharedCollection();
    const mine = new Set(col.achievements());
    txt(this, W / 2, v.top + 50, 'Colección de remiendos', {
      title: true,
      size: 56,
      origin: [0.5, 0.5],
      color: S.volt,
      stroke: true,
    });
    txt(
      this,
      W / 2,
      v.top + 108,
      `Cosméticos: ${col.owned().length} de ${COSMETICS.items.length} · Logros: ${mine.size} de ${ACHIEVEMENTS.length}`,
      { size: 32, origin: [0.5, 0.5] },
    );

    this.content = this.add.container(0, this.viewTop);
    const maskShape = this.make
      .graphics({}, false)
      .fillRect(v.left, this.viewTop, v.w, this.viewBottom - this.viewTop);
    this.content.setMask(maskShape.createGeometryMask());

    // bottom bar: never scrolls
    this.add.rectangle(v.left, this.viewBottom, v.w, FOOTER, C.coal).setOrigin(0);
    const info = txt(this, MARGIN, this.viewBottom + 20, 'Toca un cosmético que tengas para ponértelo', {
      size: 32,
      width: W - MARGIN * 2 - 340,
    });
    new Button(this, W - 348, this.viewBottom + FOOTER - 124, 300, 104, 'Volver', {
      kind: 'primary',
      title: true,
      onClick: () => goTo(this, 'Menu'),
    });

    let y = 0;
    y = this.cosmeticSections(y, info);
    y = this.achievementSection(y + 24, mine);
    this.maxScroll = Math.max(0, y + 24 - (this.viewBottom - this.viewTop));
    this.installScroll();
  }

  // ------------------------------------------------------------ cosmetics

  private cosmeticSections(top: number, info: Phaser.GameObjects.Text): number {
    const col = sharedCollection();
    const perRow = 6;
    const cardW = Math.floor((W - MARGIN * 2 - GAP * (perRow - 1)) / perRow);
    let y = top;
    const redraws: (() => void)[] = [];
    for (const kind of ['parche', 'sombrero', 'color'] as const) {
      const items = COSMETICS.items.filter((i) => i.kind === kind);
      const owned = items.filter((i) => col.owns(i.id)).length;
      this.content.add(
        txt(this, MARGIN, y, `${KIND_LABEL[kind]} · ${owned} de ${items.length}`, {
          size: 34,
          color: S.volt,
          title: true,
        }),
      );
      y += 56;
      let rowH = 0;
      items.forEach((item, k) => {
        const x = MARGIN + (k % perRow) * (cardW + GAP);
        const cy = y + Math.floor(k / perRow) * (rowH + GAP);
        const card = this.cosmeticCard(item, x, cy, cardW, info, () => redraws.forEach((r) => r()));
        redraws.push(card.redraw);
        rowH = Math.max(rowH, card.h);
      });
      y += Math.ceil(items.length / perRow) * (rowH + GAP) + 16;
    }
    return y;
  }

  private cosmeticCard(
    item: CosmeticDef,
    x: number,
    y: number,
    w: number,
    info: Phaser.GameObjects.Text,
    redrawAll: () => void,
  ): { h: number; redraw: () => void } {
    const col = sharedCollection();
    const owned = col.owns(item.id);
    const bg = this.add.graphics();
    this.content.add(bg);
    const cx = x + w / 2;
    const iconY = y + 16 + ICON / 2;
    if (item.kind === 'color') {
      // a colour's preview is the colour itself, painted as a swatch on a patch of fabric
      const sw = this.add.graphics();
      sw.fillStyle(C.ink, 1).fillRoundedRect(cx - ICON / 2, iconY - ICON / 2, ICON, ICON, 18);
      sw.fillStyle(Phaser.Display.Color.HexStringToColor(item.color).color, owned ? 1 : 0.35);
      sw.fillRoundedRect(cx - ICON / 2 + 6, iconY - ICON / 2 + 6, ICON - 12, ICON - 12, 14);
      this.content.add(sw);
    } else if (item.art) {
      const img = this.add.image(cx, iconY, ...atlasRef(item.art));
      img.setScale(ICON / Math.max(img.width, img.height));
      if (!owned) img.setTint(0x4a4560).setAlpha(0.8);
      this.content.add(img);
    }
    // no art: name + lock (owned or not), never a stand-in shape
    if (!item.art && item.kind !== 'color') this.lock(cx, iconY, ICON * 0.7, true);
    else if (!owned) this.lock(x + w - 34, y + 34, 44, false);

    const name = txt(this, cx, y + 24 + ICON, item.name, {
      size: 32,
      origin: [0.5, 0],
      align: 'center',
      width: w - 20,
      color: owned ? S.bone : S.steel,
    });
    this.content.add(name);
    const h = Math.max(200, name.y + name.height + 14 - y);

    const redraw = (): void => {
      const on = col.equipped()[item.kind] === item.id;
      bg.clear();
      bg.fillStyle(on ? C.volt : owned ? C.night : C.locked, 1).fillRoundedRect(x, y, w, h, 14);
      bg.lineStyle(4, on ? 0xffe14d : C.ink, 1).strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 14);
      name.setColor(on ? S.ink : owned ? S.bone : S.steel);
    };
    redraw();

    const hit = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    this.content.add(hit);
    hit.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.wasDrag(p)) return;
      if (!owned) {
        info.setText(`${item.name}: bloqueado. Se gana en el cofre al terminar una partida.`);
        return;
      }
      if (col.equipped()[item.kind] === item.id) {
        col.unequip(item.kind);
        info.setText(`${item.name}: guardado`);
      } else {
        col.equip(item.id);
        info.setText(`${item.name}: equipado`);
      }
      redrawAll();
    });
    return { h, redraw };
  }

  private lock(x: number, y: number, size: number, big: boolean): void {
    if (big) {
      const disc = this.add.circle(x, y, size * 0.62, C.ink, 0.85);
      this.content.add(disc);
    }
    const img = this.add.image(x, y, ...atlasRef('ui-lock'));
    img.setScale(size / Math.max(img.width, img.height));
    this.content.add(img);
  }

  // ------------------------------------------------------------ achievements

  private achievementSection(top: number, mine: Set<string>): number {
    this.content.add(
      txt(this, MARGIN, top, `Logros · ${mine.size} de ${ACHIEVEMENTS.length}`, {
        size: 34,
        color: S.volt,
        title: true,
      }),
    );
    const y0 = top + 56;
    const perRow = 2;
    const cardW = Math.floor((W - MARGIN * 2 - GAP * (perRow - 1)) / perRow);
    let y = y0;
    for (let i = 0; i < ACHIEVEMENTS.length; i += perRow) {
      let rowH = 0;
      ACHIEVEMENTS.slice(i, i + perRow).forEach((a, k) => {
        const h = this.achievementCard(a, mine.has(a.id), MARGIN + k * (cardW + GAP), y, cardW);
        rowH = Math.max(rowH, h);
      });
      y += rowH + GAP;
    }
    return y;
  }

  private achievementCard(
    a: (typeof ACHIEVEMENTS)[number],
    done: boolean,
    x: number,
    y: number,
    w: number,
  ): number {
    const bg = this.add.graphics();
    this.content.add(bg);
    const badge = 120;
    const img = this.add.image(
      x + 20 + badge / 2,
      y + 20 + badge / 2,
      ...atlasRef(done ? a.art : 'ach-locked'),
    );
    img.setScale(badge / Math.max(img.width, img.height));
    this.content.add(img);
    const tx = x + 40 + badge;
    const tw = w - (tx - x) - 20;
    const name = txt(this, tx, y + 16, a.name, {
      title: true,
      size: 34,
      color: done ? S.volt : S.bone,
      width: tw,
    });
    const desc = txt(this, tx, name.y + name.height + 4, a.desc, { size: 32, width: tw });
    const state = txt(
      this,
      tx,
      desc.y + desc.height + 6,
      done ? '✓ Desbloqueado' : 'Bloqueado · cúmplelo para ganarlo',
      { size: 32, color: done ? S.volt : S.steel, width: tw },
    );
    this.content.add([name, desc, state]);
    const h = Math.max(badge + 40, state.y + state.height + 16 - y);
    bg.fillStyle(done ? C.night : C.locked, 1).fillRoundedRect(x, y, w, h, 16);
    bg.lineStyle(4, done ? C.volt : C.ink, 1).strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 16);
    if (!done) img.setAlpha(0.9);
    return h;
  }

  // ------------------------------------------------------------ scroll

  private dragStart: { y: number; scroll: number } | null = null;
  private dragged = 0;

  private wasDrag(p: Phaser.Input.Pointer): boolean {
    return Math.abs(p.y - p.downY) > DRAG_SLOP || this.dragged > DRAG_SLOP;
  }

  private setScroll(v: number): void {
    this.scrollY = Phaser.Math.Clamp(v, 0, this.maxScroll);
    this.content.y = this.viewTop - this.scrollY;
  }

  private installScroll(): void {
    if (this.maxScroll <= 0) return;
    const inView = (y: number) => y >= this.viewTop && y <= this.viewBottom;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!inView(designPoint(this, p).y)) return;
      this.dragStart = { y: p.y, scroll: this.scrollY };
      this.dragged = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || !p.isDown) return;
      const dy = p.y - this.dragStart.y;
      this.dragged = Math.max(this.dragged, Math.abs(dy));
      if (this.dragged > DRAG_SLOP) this.setScroll(this.dragStart.scroll - dy);
    });
    this.input.on('pointerup', () => (this.dragStart = null));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.setScroll(this.scrollY + dy),
    );
    this.input.keyboard?.on('keydown-DOWN', () => this.setScroll(this.scrollY + 120));
    this.input.keyboard?.on('keydown-UP', () => this.setScroll(this.scrollY - 120));
    // scroll hint: a thin bar on the right edge
    const track = this.add.graphics();
    const viewH = this.viewBottom - this.viewTop;
    const draw = (): void => {
      const thumb = Math.max(60, (viewH * viewH) / (viewH + this.maxScroll));
      const ty = this.viewTop + (this.scrollY / this.maxScroll) * (viewH - thumb);
      track.clear();
      track.fillStyle(C.ink, 0.6).fillRoundedRect(W - 20, this.viewTop, 10, viewH, 5);
      track.fillStyle(C.volt, 0.9).fillRoundedRect(W - 20, ty, 10, thumb, 5);
    };
    draw();
    this.events.on(Phaser.Scenes.Events.UPDATE, draw);
  }
}
