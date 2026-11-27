import { Rng } from './rng';
import type { HazardDef } from './world';

/** Terreno destructible: un byte por píxel (1 = sólido). Solo datos, sin dibujar. */
export class Terrain {
  /** Peligros del mapa para el que se construyó este terreno (los lee el World de la partida). */
  hazards: HazardDef[] = [];
  private count: number;
  private constructor(
    readonly width: number,
    readonly height: number,
    readonly solid: Uint8Array,
  ) {
    this.count = 0;
    for (let i = 0; i < solid.length; i++) if (solid[i]) this.count++;
  }

  static fromHeights(width: number, height: number, heights: ArrayLike<number>): Terrain {
    const solid = new Uint8Array(width * height);
    for (let x = 0; x < width; x++) {
      const top = Math.max(0, Math.round(heights[x]));
      for (let y = top; y < height; y++) solid[y * width + x] = 1;
    }
    return new Terrain(width, height, solid);
  }

  static fromMask(width: number, height: number, mask: Uint8Array): Terrain {
    return new Terrain(width, height, Uint8Array.from(mask));
  }

  /** Colinas suaves hechas con ondas seno con semilla. */
  static procedural(width: number, height: number, seed: number, base: number, amp: number): Terrain {
    const rng = new Rng(seed);
    const waves = [0, 1, 2].map((i) => ({
      f: (i + 1.5) * 0.0042 + rng.next() * 0.002,
      p: rng.next() * Math.PI * 2,
      a: amp / (i + 1),
    }));
    const heights = new Array<number>(width);
    for (let x = 0; x < width; x++) {
      let y = base;
      for (const w of waves) y += Math.sin(x * w.f * Math.PI * 0.5 + w.p) * w.a;
      heights[x] = y;
    }
    return Terrain.fromHeights(width, height, heights);
  }

  /** Rellena de sólido el rectángulo [x0,x1) x [y0,y1). */
  fillRect(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.height, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.width, Math.ceil(x1)); x++) {
        const i = y * this.width + x;
        if (!this.solid[i]) {
          this.solid[i] = 1;
          this.count++;
        }
      }
  }

  isSolid(x: number, y: number): boolean {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return false;
    return this.solid[yi * this.width + xi] === 1;
  }

  /** Quita un disco de terreno y devuelve cuántos píxeles sólidos se fueron. */
  carveCircle(cx: number, cy: number, r: number): number {
    let removed = 0;
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          const i = y * this.width + x;
          if (this.solid[i]) {
            this.solid[i] = 0;
            removed++;
          }
        }
      }
    }
    this.count -= removed;
    return removed;
  }

  /** Primer píxel sólido desde fromY hacia abajo en la columna x (null si no hay o está fuera). */
  surfaceY(x: number, fromY: number): number | null {
    const xi = Math.floor(x);
    if (xi < 0 || xi >= this.width) return null;
    for (let y = Math.max(0, Math.floor(fromY)); y < this.height; y++) {
      if (this.solid[y * this.width + xi]) return y;
    }
    return null;
  }

  solidCount(): number {
    return this.count;
  }

  clone(): Terrain {
    return new Terrain(this.width, this.height, Uint8Array.from(this.solid));
  }
}
