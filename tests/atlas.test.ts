import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

interface Frame {
  frame: { x: number; y: number; w: number; h: number };
  pivot: { x: number; y: number };
  anchorPx: [number, number];
}
interface Atlas {
  frames: Record<string, Frame>;
  meta: { image: string };
}

const ASSETS = 'public/assets';
const ATLAS_SHEETS = ['atlas-icons', 'atlas-fx', 'atlas-badges', 'atlas-ui', 'atlas-items'];
const cargar = (nombre: string): Atlas => JSON.parse(fs.readFileSync(`${ASSETS}/${nombre}.json`, 'utf8'));

function archivosDe(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? archivosDe(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

describe.each(ATLAS_SHEETS)('%s', (nombre) => {
  const atlas = cargar(nombre);
  const frames = Object.entries(atlas.frames);

  it('su imagen existe y pesa menos de 1 MB', () => {
    const imagen = `${ASSETS}/${atlas.meta.image}`;
    expect(fs.existsSync(imagen)).toBe(true);
    expect(fs.statSync(imagen).size).toBeLessThan(1024 * 1024);
  });

  it('los marcos tienen tamaño positivo, no se solapan y el ancla cae dentro del sprite', () => {
    for (const [id, f] of frames) {
      expect(f.frame.w, id).toBeGreaterThan(0);
      expect(f.frame.h, id).toBeGreaterThan(0);
      expect(f.anchorPx[0], id).toBeGreaterThanOrEqual(0);
      expect(f.anchorPx[0], id).toBeLessThanOrEqual(f.frame.w);
      expect(f.anchorPx[1], id).toBeGreaterThanOrEqual(0);
      expect(f.anchorPx[1], id).toBeLessThanOrEqual(f.frame.h);
    }
    for (let i = 0; i < frames.length; i++)
      for (let j = i + 1; j < frames.length; j++) {
        const a = frames[i][1].frame;
        const b = frames[j][1].frame;
        const seSolapan = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(seSolapan, `${frames[i][0]} con ${frames[j][0]}`).toBe(false);
      }
  });

  it('cada sprite tiene transparencia y contenido', async () => {
    const { data, info } = await sharp(`${ASSETS}/${atlas.meta.image}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (const [id, f] of frames) {
      let vacios = 0;
      let solidos = 0;
      for (let y = f.frame.y; y < f.frame.y + f.frame.h; y++)
        for (let x = f.frame.x; x < f.frame.x + f.frame.w; x++) {
          const alfa = data[(y * info.width + x) * 4 + 3];
          if (alfa === 0) vacios++;
          else if (alfa > 200) solidos++;
        }
      expect(vacios, `${id} sin transparencia`).toBeGreaterThan(0);
      expect(solidos, `${id} vacío`).toBeGreaterThan(f.frame.w * f.frame.h * 0.03);
    }
  });
});

describe('ids usados por el código', () => {
  it('todo frame con prefijo de atlas que nombra el código existe', () => {
    const existentes = new Set([...ATLAS_SHEETS, 'atlas'].flatMap((n) => Object.keys(cargar(n).frames)));
    const patron = /['"`]((?:icon|fx|badge|hud|ui|ach|ev|hat|patch|grave|part)-[a-z0-9-]+)['"`]/g;
    const faltan: string[] = [];
    // "crate-spawn" y similares son nombres de evento, no frames: por eso el patrón no incluye crate ni chest.
    const carpetas = ['src/scenes', 'src/ui', 'src/data'];
    for (const archivo of carpetas.flatMap(archivosDe).filter((f) => /\.(ts|json)$/.test(f))) {
      const texto = fs.readFileSync(archivo, 'utf8');
      for (const m of texto.matchAll(patron)) if (!existentes.has(m[1])) faltan.push(`${archivo}: ${m[1]}`);
    }
    expect(faltan).toEqual([]);
  });

  it('los íconos de arma se exportan a 128 y 256 px y las insignias a 64 y 128 px', () => {
    const iconos = cargar('atlas-icons').frames;
    for (const id of Object.keys(iconos).filter((n) => !n.endsWith('@2x'))) {
      expect(iconos[id].frame.w).toBe(128);
      expect(iconos[`${id}@2x`].frame.w).toBe(256);
    }
    const insignias = cargar('atlas-badges').frames;
    for (const id of Object.keys(insignias).filter((n) => !n.endsWith('@2x'))) {
      expect(insignias[id].frame.w).toBe(64);
      expect(insignias[`${id}@2x`].frame.w).toBe(128);
    }
  });
});

describe('ácido', () => {
  it('acid-surface y acid-body existen y pesan poco', () => {
    for (const f of ['acid-surface', 'acid-body']) {
      expect(fs.existsSync(`${ASSETS}/${f}.webp`)).toBe(true);
      expect(fs.statSync(`${ASSETS}/${f}.webp`).size).toBeLessThan(200 * 1024);
    }
  });

  it('acid-surface mide lo mismo en ambos bordes (sin costura) y es transparente arriba', async () => {
    const { data, info } = await sharp(`${ASSETS}/acid-surface.webp`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let dif = 0;
    for (let y = 0; y < info.height; y++)
      for (let c = 0; c < 4; c++)
        dif += Math.abs(data[y * info.width * 4 + c] - data[(y * info.width + info.width - 1) * 4 + c]);
    expect(dif / (info.height * 4)).toBeLessThan(4); // solo la pérdida de WebP
    let transparentes = 0;
    for (let x = 0; x < info.width; x++) if (data[x * 4 + 3] === 0) transparentes++;
    expect(transparentes).toBeGreaterThan(info.width * 0.5);
  });

  it('acid-body es opaco y repite bien en vertical y horizontal', async () => {
    const { data, info } = await sharp(`${ASSETS}/acid-body.webp`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4 * 97) expect(data[i]).toBe(255);
    let difX = 0;
    let difY = 0;
    for (let y = 0; y < info.height; y++)
      for (let c = 0; c < 3; c++)
        difX += Math.abs(data[y * info.width * 4 + c] - data[(y * info.width + info.width - 1) * 4 + c]);
    for (let x = 0; x < info.width; x++)
      for (let c = 0; c < 3; c++)
        difY += Math.abs(data[x * 4 + c] - data[((info.height - 1) * info.width + x) * 4 + c]);
    expect(difX / (info.height * 3)).toBeLessThan(4);
    expect(difY / (info.width * 3)).toBeLessThan(4);
  });
});
