import Phaser from 'phaser';
import { ACHIEVEMENTS, COSMETICS, sharedCollection, type CosmeticDef } from '../core/rewards';
import { pushBackHandler } from '../ui/backNav';
import { C, H, S, W } from '../ui/theme';
import { Button, fadeIn, goTo, panel, txt } from '../ui/widgets';

const CELL = 104;
const GAP = 16;
const KIND_LABEL: Record<CosmeticDef['kind'], string> = {
  parche: 'Parches',
  sombrero: 'Sombreros',
  color: 'Colores',
};

/** Marker drawn by code for a cosmetic (no art yet: see docs/ASSETS_TODO.md). Shape tells the kind, not only the colour. */
export function drawMarker(
  g: Phaser.GameObjects.Graphics,
  item: CosmeticDef,
  x: number,
  y: number,
  size: number,
  owned: boolean,
): void {
  const col = owned ? Phaser.Display.Color.HexStringToColor(item.color).color : 0x4a4560;
  const r = size / 2;
  g.fillStyle(0x0f0e15, 1);
  if (item.kind === 'parche') {
    g.fillRoundedRect(x - r, y - r, size, size, 12);
    g.fillStyle(col, 1).fillRoundedRect(x - r + 6, y - r + 6, size - 12, size - 12, 8);
    g.lineStyle(3, 0x0f0e15, 0.7);
    g.strokeRect(x - r + 14, y - r + 14, size - 28, size - 28); // stitches
  } else if (item.kind === 'sombrero') {
    g.fillTriangle(x - r, y + r - 4, x + r, y + r - 4, x, y - r);
    g.fillStyle(col, 1).fillTriangle(x - r + 8, y + r - 12, x + r - 8, y + r - 12, x, y - r + 12);
  } else {
    g.fillCircle(x, y, r);
    g.fillStyle(col, 1).fillCircle(x, y, r - 7);
  }
}

/** Collection: patches, hats and colours won in chests (no combat effect) and the 8 achievements. */
export class Coleccion extends Phaser.Scene {
  constructor() {
    super('Coleccion');
  }

  create(): void {
    fadeIn(this);
    const pop = pushBackHandler(() => goTo(this, 'Menu'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, pop);
    this.input.keyboard?.on('keydown-ESC', () => goTo(this, 'Menu'));
    this.add.rectangle(0, 0, W, H, C.coal).setOrigin(0);
    this.add.rectangle(0, 0, W, H, C.storm, 0.3).setOrigin(0);

    const col = sharedCollection();
    txt(this, W / 2, 56, 'Colección de remiendos', {
      title: true,
      size: 56,
      origin: [0.5, 0.5],
      color: S.volt,
      stroke: true,
    });
    txt(this, W / 2, 112, `${col.owned().length} de ${COSMETICS.items.length} · Toca uno para ponértelo`, {
      size: 32,
      origin: [0.5, 0.5],
    });

    const g = this.add.graphics();
    const info = txt(this, 48, 776, '', { size: 32, width: 1180 });
    const kinds = ['parche', 'sombrero', 'color'] as const;
    const draw = (): void => {
      g.clear();
      const eq = col.equipped();
      kinds.forEach((kind, row) => {
        const y = 140 + row * 140;
        txt(this, 48, y - 4, KIND_LABEL[kind], { size: 32, color: S.volt });
        COSMETICS.items
          .filter((i) => i.kind === kind)
          .forEach((item, k) => {
            const x = 360 + k * (CELL + GAP);
            const owned = col.owns(item.id);
            const on = eq[kind] === item.id;
            g.fillStyle(on ? 0xffe14d : 0x2e2a47, 1).fillRoundedRect(x, y, CELL, CELL, 12);
            drawMarker(g, item, x + CELL / 2, y + CELL / 2, CELL - 24, owned);
          });
      });
    };
    kinds.forEach((kind, row) => {
      const y = 140 + row * 140;
      COSMETICS.items
        .filter((i) => i.kind === kind)
        .forEach((item, k) => {
          const x = 360 + k * (CELL + GAP);
          const hit = this.add.zone(x, y, CELL, CELL).setOrigin(0).setInteractive();
          hit.on('pointerup', () => {
            if (!col.owns(item.id)) {
              info.setText(`${item.name}: aún no lo tienes (se gana en el cofre al terminar una partida)`);
              return;
            }
            if (col.equipped()[kind] === item.id) {
              col.unequip(kind);
              info.setText(`${item.name}: guardado`);
            } else {
              col.equip(item.id);
              info.setText(`${item.name}: equipado`);
            }
            draw();
          });
        });
    });
    draw();

    // Achievements: two columns of four; tap one to read how to get it.
    panel(this, 40, 548, W - 80, 208, C.night);
    const mine = new Set(col.achievements());
    ACHIEVEMENTS.forEach((a, i) => {
      const x = 64 + Math.floor(i / 4) * 770;
      const y = 560 + (i % 4) * 46;
      const done = mine.has(a.id);
      const t = txt(this, x, y, `${done ? '✓' : '·'} ${a.name}`, { size: 32, color: done ? S.volt : S.bone });
      t.setInteractive({ useHandCursor: true }).on('pointerup', () => info.setText(`${a.name}: ${a.desc}`));
    });

    new Button(this, W - 348, H - 120, 300, 104, 'Volver', {
      kind: 'primary',
      title: true,
      onClick: () => goTo(this, 'Menu'),
    });
  }
}
