import Phaser from 'phaser';
import { C, H, W } from '../ui/theme';
import { atlasOf, loadItemsAtlas, type AtlasKey } from '../ui/atlasRefs';

const SHEETS: AtlasKey[] = ['atlas-icons', 'atlas-fx', 'atlas-badges', 'atlas-ui', 'atlas-items'];
const CELL_W = 100;
const CELL_H = 86;
const BOX = 52; // tamaño máximo con el que se dibuja un sprite dentro de su celda

/**
 * Galería de depuración (`?debug=assets`, solo en desarrollo): cada ícono, sprite, insignia y pieza con su id, tamaño y
 * ancla (cruz roja), para ver que nada esté recortado ni movido. Solo se dibujan los frames @1x.
 */
export class AssetsDebug extends Phaser.Scene {
  constructor() {
    super('AssetsDebug');
  }

  preload(): void {
    loadItemsAtlas(this);
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
      const y = Math.floor(i / cols) * CELL_H + 4;
      g.lineStyle(1, 0x3b3452, 1).strokeRect(x - CELL_W / 2 + 2, y, CELL_W - 4, CELL_H - 4);
      const key = atlasOf(id);
      const frame = this.textures.get(key).get(id);
      const sc = Math.min(1, BOX / Math.max(frame.width, frame.height));
      const cx = x;
      const cy = y + 4 + BOX / 2;
      this.add.image(cx, cy, key, id).setOrigin(0.5).setScale(sc);
      g.lineStyle(1, 0x7cff4f, 0.6).strokeRect(
        cx - (frame.width * sc) / 2,
        cy - (frame.height * sc) / 2,
        frame.width * sc,
        frame.height * sc,
      );
      // Ancla: el pivote normalizado del frame, dibujado sobre el sprite escalado.
      const ax = cx + (frame.pivotX - 0.5) * frame.width * sc;
      const ay = cy + (frame.pivotY - 0.5) * frame.height * sc;
      g.lineStyle(2, 0xff5468, 1)
        .lineBetween(ax - 6, ay, ax + 6, ay)
        .lineBetween(ax, ay - 6, ax, ay + 6);
      this.add
        .text(x, y + CELL_H - 8, `${id.replace(/^(icon|fx|badge)-/, '')}\n${frame.width}×${frame.height}`, {
          fontFamily: 'Nunito, sans-serif',
          fontSize: '9px',
          color: '#f4efe1',
          align: 'center',
        })
        .setOrigin(0.5, 1);
    });
    this.add.text(8, H - 16, `${ids.length} frames · cruz roja = anclaje · caja verde = tamaño`, {
      fontSize: '11px',
      color: '#a99be0',
    });
  }
}
