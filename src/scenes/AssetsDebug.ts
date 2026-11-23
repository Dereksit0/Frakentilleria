import Phaser from 'phaser';
import { C, H, W } from '../ui/theme';
import { atlasOf, type AtlasKey } from '../ui/atlasRefs';

const SHEETS: AtlasKey[] = ['atlas-icons', 'atlas-fx', 'atlas-badges'];
const CELL_W = 156;
const CELL_H = 132;
const BOX = 84; // max drawn size of a sprite inside its cell

/**
 * Debug gallery (`?debug=assets`): every icon, combat sprite and badge with its id and anchor point
 * (red cross), to check that nothing is cropped or shifted. Only the @1x frames are drawn.
 */
export class AssetsDebug extends Phaser.Scene {
  constructor() {
    super('AssetsDebug');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(C.ink);
    const g = this.add.graphics();
    const ids: string[] = [];
    for (const key of SHEETS)
      for (const name of this.textures.get(key).getFrameNames()) if (!name.endsWith('@2x')) ids.push(name);
    const cols = Math.floor(W / CELL_W);
    ids.forEach((id, i) => {
      const x = (i % cols) * CELL_W + CELL_W / 2 + (W - cols * CELL_W) / 2;
      const y = Math.floor(i / cols) * CELL_H + 8;
      g.lineStyle(1, 0x3b3452, 1).strokeRect(x - CELL_W / 2 + 2, y, CELL_W - 4, CELL_H - 4);
      const key = atlasOf(id);
      const frame = this.textures.get(key).get(id);
      const sc = Math.min(1, BOX / Math.max(frame.width, frame.height));
      // Draw with the frame's own pivot as origin so the anchor lands on the cross.
      const cx = x;
      const cy = y + 14 + BOX / 2;
      const img = this.add.image(cx, cy, key, id).setScale(sc);
      g.lineStyle(2, 0xff5468, 1);
      const ax = cx + (frame.pivotX - 0.5) * frame.width * sc;
      const ay = cy + (frame.pivotY - 0.5) * frame.height * sc;
      g.lineBetween(ax - 8, ay, ax + 8, ay).lineBetween(ax, ay - 8, ax, ay + 8);
      g.lineStyle(1, 0x7cff4f, 0.6).strokeRect(
        cx - (frame.width * sc) / 2,
        cy - (frame.height * sc) / 2,
        frame.width * sc,
        frame.height * sc,
      );
      this.add
        .text(x, y + CELL_H - 20, `${id.replace(/^(icon|fx|badge)-/, '')}\n${frame.width}×${frame.height}`, {
          fontFamily: 'Nunito, sans-serif',
          fontSize: '11px',
          color: '#f4efe1',
          align: 'center',
        })
        .setOrigin(0.5, 1);
      void img;
    });
    this.add.text(8, H - 18, `${ids.length} frames · cruz roja = anclaje · caja verde = tamaño`, {
      fontSize: '12px',
      color: '#a99be0',
    });
  }
}
