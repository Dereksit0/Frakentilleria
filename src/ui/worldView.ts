import Phaser from 'phaser';
import type { Battle as Core } from '../core/battle';
import { EVENTS } from '../core/data';
import type { HazardDef } from '../core/world';

/** Spanish banner texts (max one short line each: the HUD toast shows them in 32 px letters). */
export const HAZARD_WARN: Record<string, string> = {
  crane: 'La grúa soltará un barril TNT',
  zombie: 'Una mano de zombi saldrá del suelo',
  tombstone: 'Caerá una lápida',
  ball: 'Rodará una pelota por la fábrica',
};

/** Banner for a world event, or null when it is not one the player needs to read. */
export function worldBanner(e: { type: string } & Record<string, unknown>): string | null {
  const name = (id: unknown): string => EVENTS.types[String(id)]?.name ?? String(id);
  switch (e.type) {
    case 'event-warn':
      return `Próxima ronda: ${name(e.id)}`;
    case 'event-start':
      return `¡${name(e.id)}!`;
    case 'hazard-warn':
      return `Aviso: ${HAZARD_WARN[String(e.kind)] ?? 'peligro'} (ronda ${String(e.round)})`;
    default:
      return null;
  }
}

/**
 * Draws the living map on top of the terrain: barrels, portals, springs, conveyors, fans, rolling balls,
 * acid puddles and the warning markers. Only shapes and reusable images; nothing is created per frame.
 */
export class WorldView {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly barrels = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly core: Core,
    private readonly hazards: HazardDef[],
    private readonly textureFor: (frame: string) => [string, string],
  ) {
    this.g = scene.add.graphics().setDepth(34);
  }

  draw(time: number): void {
    const g = this.g;
    const w = this.core.world;
    g.clear();
    for (const h of this.hazards) {
      switch (h.type) {
        case 'portal': {
          for (const m of [h.a, h.b]) {
            g.lineStyle(8, 0x0f0e15, 1).strokeCircle(m.x, m.y, h.radius + 4);
            g.lineStyle(6, 0xb583ff, 1).strokeCircle(m.x, m.y, h.radius);
            g.lineStyle(4, 0x7cff4f, 0.9).strokeCircle(m.x, m.y, h.radius * (0.55 + 0.1 * Math.sin(time / 200)));
          }
          break;
        }
        case 'spring': {
          const y = this.core.terrain.surfaceY(h.x, 0) ?? 700;
          g.fillStyle(0x0f0e15, 1).fillRect(h.x - h.w / 2 - 4, y - 18, h.w + 8, 22);
          g.fillStyle(0xffe14d, 1).fillRect(h.x - h.w / 2, y - 14, h.w, 12);
          g.fillStyle(0xff5468, 1).fillTriangle(h.x - 14, y - 14, h.x + 14, y - 14, h.x, y - 34);
          break;
        }
        case 'conveyor': {
          const y = this.core.terrain.surfaceY(h.x + h.w / 2, 0) ?? 700;
          g.fillStyle(0x0f0e15, 1).fillRect(h.x - 3, y - 14, h.w + 6, 18);
          g.fillStyle(0x635478, 1).fillRect(h.x, y - 10, h.w, 10);
          const dir = Math.sign(h.speed);
          for (let x = h.x + 10; x < h.x + h.w - 10; x += 36) {
            const ax = x + ((time / 20) * dir) % 36;
            if (ax > h.x && ax < h.x + h.w - 12)
              g.fillStyle(0xffe14d, 1).fillTriangle(ax, y - 9, ax, y - 1, ax + 10 * dir, y - 5);
          }
          break;
        }
        case 'fan': {
          g.fillStyle(0xffe14d, 0.12).fillRect(h.x, h.y0, h.w, h.y1 - h.y0);
          const dir = Math.sign(h.wind);
          for (let y = h.y0 + 30; y < h.y1; y += 70) {
            const x = h.x + h.w / 2 + dir * (((time / 6) % h.w) - h.w / 2);
            g.fillStyle(0xffe14d, 0.7).fillTriangle(x, y - 10, x, y + 10, x + 22 * dir, y);
          }
          break;
        }
        default:
          break;
      }
    }
    for (const p of this.core.puddles) {
      g.fillStyle(0x0f0e15, 1).fillEllipse(p.x, p.y, p.radius * 2 + 8, 22);
      g.fillStyle(0x7cff4f, 0.85).fillEllipse(p.x, p.y, p.radius * 2, 16);
    }
    for (const b of w.balls) {
      g.fillStyle(0x0f0e15, 1).fillCircle(b.x, b.y - 46, 52);
      g.fillStyle(0xff5468, 1).fillCircle(b.x, b.y - 46, 46);
      g.fillStyle(0xfff4d6, 1).fillCircle(b.x + 12 * b.dir, b.y - 58, 10);
    }
    // Barrels: reusable images keyed by id.
    const live = new Set<number>();
    for (const b of w.barrels) {
      if (!b.alive) continue;
      live.add(b.id);
      let img = this.barrels.get(b.id);
      if (!img) {
        img = this.scene.add.image(b.x, b.y, ...this.textureFor('item_barrel')).setOrigin(0.5, 1).setDepth(34);
        this.barrels.set(b.id, img);
      }
      img.setPosition(b.x, b.y);
    }
    for (const [id, img] of this.barrels)
      if (!live.has(id)) {
        img.destroy();
        this.barrels.delete(id);
      }
  }
}

/** Paints terrain pixels the map's obstacles added (walls, scrap, bridges) on top of the art. */
export function paintStamps(
  ctx: CanvasRenderingContext2D,
  before: Uint8Array,
  after: Uint8Array,
  width: number,
  height: number,
): void {
  ctx.save();
  for (let y = 0; y < height; y++) {
    let run = -1;
    for (let x = 0; x <= width; x++) {
      const i = y * width + x;
      const added = x < width && after[i] === 1 && before[i] === 0;
      if (added && run < 0) run = x;
      if (!added && run >= 0) {
        // Dark outline on the top edge, metal body below.
        const top = y === 0 || after[(y - 1) * width + run] === 0;
        ctx.fillStyle = top ? '#0F0E15' : y % 24 < 2 ? '#3B3452' : '#635478';
        ctx.fillRect(run, y, x - run, 1);
        run = -1;
      }
    }
  }
  ctx.restore();
}
