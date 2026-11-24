// Grid sheets (weapon icons, combat sprites, status badges): background removal with a flood fill from the
// border (closed black outlines protect the green acid / shield art), grid-cell split, size normalisation, anchors
// and packing into three WebP atlases (atlas-icons, atlas-fx, atlas-badges) with their JSON.
import sharp from 'sharp';
import fs from 'node:fs';
import { keyColor } from './chroma.mjs';
import { loadRaw, components, cleanGreenFringe } from './donors.mjs';

const RAW = 'assets/raw';
const MARGIN = 4;

/** Sheet definitions. Ids follow the project naming (lowercase with dashes); `ids` run left-to-right, top-to-bottom. */
export const SHEETS = [
  {
    file: `${RAW}/weapons/iconos-armas-2.png`,
    kind: 'icon',
    cols: 3,
    rows: 2,
    ids: ['mazo-de-justa', 'rafaga-de-hielo', 'granada-de-calabaza', 'mina', 'dinamita', 'ataque-aereo'],
  },
  {
    file: `${RAW}/weapons/iconos-armas-3.png`,
    kind: 'icon',
    cols: 3,
    rows: 2,
    // The 6th cell is an empty purple tile and is ignored.
    ids: ['taladro', 'senuelo', 'gancho', 'cuervos', 'escudo-reflector'],
  },
  {
    file: `${RAW}/fx/efectos-armas-1.png`,
    kind: 'fx',
    cols: 3,
    rows: 3,
    ids: [
      'granada-calabaza',
      'hielo-proyectil',
      'hielo-explosion',
      'rayo-arco',
      'rayo-impacto',
      'acido-charco',
      'mina-armada',
      'dinamita-encendida',
      'misil-ataque-aereo',
    ],
  },
  {
    file: `${RAW}/fx/efectos-armas-2.png`,
    kind: 'fx',
    cols: 3,
    rows: 3,
    ids: [
      'senuelo',
      'gancho-cabeza',
      'cuervo-1',
      'cuervo-2',
      'cuervo-3',
      'mazo-onda',
      'marcador-ataque-aereo',
      'burbuja-escudo',
      'tierra-salpicadura',
    ],
    // Ids whose enclosed key-green hole must become transparent (strict colour distance, limited to that element).
    holes: ['mazo-onda', 'marcador-ataque-aereo'],
  },
  {
    file: `${RAW}/ui/emblemas-estados-eventos.png`,
    kind: 'badge',
    cols: 3,
    rows: 3,
    ids: [
      'congelado',
      'acido',
      'aturdido',
      'escudo',
      'tormenta',
      'meteoritos',
      'gravedad-baja',
      'luna-llena',
      'viento',
    ],
  },
];

/** Logical size (longest side, px) and anchor (fraction of the frame) of each combat sprite. */
export const FX_SPEC = {
  'granada-calabaza': { size: 48, anchor: [0.5, 0.5] },
  'hielo-proyectil': { size: 76, anchor: [0.5, 0.5] },
  'hielo-explosion': { size: 200, anchor: [0.5, 0.5] },
  'rayo-arco': { size: 240, anchor: [0.5, 0.5] },
  'rayo-impacto': { size: 130, anchor: [0.5, 0.5] },
  'acido-charco': { size: 180, anchor: [0.5, 1] },
  'mina-armada': { size: 72, anchor: [0.5, 1] },
  'dinamita-encendida': { size: 72, anchor: [0.5, 1] },
  'misil-ataque-aereo': { size: 96, anchor: [0.5, 0.5] },
  senuelo: { size: 130, anchor: [0.5, 1] },
  'gancho-cabeza': { size: 80, anchor: [0.5, 0.5] },
  'mazo-onda': { size: 180, anchor: [0.5, 0.5] },
  'marcador-ataque-aereo': { size: 160, anchor: [0.5, 0.5] },
  'burbuja-escudo': { size: 190, anchor: [0.5, 0.5] },
  'tierra-salpicadura': { size: 150, anchor: [0.5, 1] },
};
const CROW_WIDTH = 120; // common width of the 3 crow frames before they are put on the shared canvas
export const ICON_SIZES = [128, 256]; // base (1x) and @2x
export const BADGE_SIZES = [64, 128];

/** Elements whose art is legitimately green / turquoise: they never get the pure-green clean-up. */
const GREEN_ART = new Set(['acido-charco', 'acido', 'burbuja-escudo']);

/** Removes leftover green pixels (g clearly above r and b) that survived the flood fill. */
function killPureGreen({ data }) {
  for (let i = 0; i < data.length; i += 4)
    if (data[i + 3] && data[i + 1] > data[i] + 30 && data[i + 1] > data[i + 2] + 30) data[i + 3] = 0;
}

/** Strict key for enclosed holes: every pixel within `dist` of the key colour inside the element becomes transparent. */
function clearHoles(img, bbox, dist = 70) {
  const { data, w } = img;
  const [x0, y0, x1, y1] = bbox;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      if (Math.hypot(data[i], data[i + 1] - 255, data[i + 2]) < dist) data[i + 3] = 0;
    }
}

/** Extracts every element of a sheet as { id, kind, img } (RGBA, MARGIN px of transparent border). */
export async function extractSheet(def) {
  const img = keyColor(await loadRaw(def.file), [0, 255, 0], { mode: 'flood', hard: 50, soft: 110 });
  const { w, h } = img;
  const { label, comps } = components(img, 60);
  const cells = new Map();
  for (const c of comps) {
    const col = Math.min(def.cols - 1, Math.floor((c.cx / w) * def.cols));
    const row = Math.min(def.rows - 1, Math.floor((c.cy / h) * def.rows));
    const k = row * def.cols + col;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(c);
  }
  const out = [];
  for (const [k, g] of [...cells.entries()].sort((a, b) => a[0] - b[0])) {
    const id = def.ids[k];
    if (!id) continue; // empty / ignored cell
    const keep = new Set(g.map((c) => c.id));
    const x0 = Math.min(...g.map((c) => c.x0)),
      y0 = Math.min(...g.map((c) => c.y0)),
      x1 = Math.max(...g.map((c) => c.x1)),
      y1 = Math.max(...g.map((c) => c.y1));
    const holes = def.holes?.includes(id);
    if (holes) clearHoles(img, [x0, y0, x1, y1]);
    const pw = x1 - x0 + 1 + MARGIN * 2,
      ph = y1 - y0 + 1 + MARGIN * 2;
    const data = Buffer.alloc(pw * ph * 4);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (!keep.has(label[i])) continue;
        if (img.data[i * 4 + 3] === 0) continue;
        const o = ((y - y0 + MARGIN) * pw + (x - x0 + MARGIN)) * 4;
        img.data.copy(data, o, i * 4, i * 4 + 4);
      }
    const part = { data, w: pw, h: ph };
    cleanGreenFringe(part, 2, false);
    if (!GREEN_ART.has(id)) killPureGreen(part);
    out.push({ id, kind: def.kind, img: part });
  }
  if (out.length !== def.ids.length)
    throw new Error(`${def.file}: found ${out.length} of ${def.ids.length} elements`);
  return out;
}

const toPng = (img) =>
  sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } })
    .png()
    .toBuffer();
const trimPng = (buf) =>
  sharp(buf)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .png()
    .toBuffer();
const clear = { r: 0, g: 0, b: 0, alpha: 0 };

/** Centroid of the purple patch (the crows' body marker); falls back to the centroid of all opaque pixels. */
function bodyCentre(img) {
  const { data, w, h } = img;
  let sx = 0,
    sy = 0,
    n = 0,
    ax = 0,
    ay = 0,
    an = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 200) continue;
      ax += x;
      ay += y;
      an++;
      if (data[i] > 70 && data[i + 2] > 110 && data[i + 1] < 80 && data[i + 2] > data[i + 1] + 50) {
        sx += x;
        sy += y;
        n++;
      }
    }
  return n > 40 ? [sx / n, sy / n] : [ax / an, ay / an];
}

/**
 * Builds the final frames [{ name, buf, w, h, anchor:[px,py] }] grouped by atlas ('icons' | 'fx' | 'badges').
 * Names: icon-<id> (128) / icon-<id>@2x (256), badge-<id> (64) / badge-<id>@2x (128), fx-<id> (logical size).
 */
export async function buildFrames() {
  const groups = { icons: [], fx: [], badges: [] };
  const crows = [];
  for (const def of SHEETS)
    for (const el of await extractSheet(def)) {
      if (el.kind === 'icon' || el.kind === 'badge') {
        const t = await trimPng(await toPng(el.img));
        const sizes = el.kind === 'icon' ? ICON_SIZES : BADGE_SIZES;
        for (const [i, s] of sizes.entries()) {
          const buf = await sharp(t)
            .resize(s, s, { fit: 'contain', background: clear, kernel: 'lanczos3' })
            .png()
            .toBuffer();
          groups[el.kind === 'icon' ? 'icons' : 'badges'].push({
            name: `${el.kind}-${el.id}${i ? '@2x' : ''}`,
            buf,
            w: s,
            h: s,
            anchor: [s / 2, s / 2],
          });
        }
      } else if (el.id.startsWith('cuervo-')) {
        crows.push(el);
      } else {
        const spec = FX_SPEC[el.id];
        const t = await trimPng(await toPng(el.img));
        const m = await sharp(t).metadata();
        const k = spec.size / Math.max(m.width, m.height);
        const w = Math.max(1, Math.round(m.width * k)),
          h = Math.max(1, Math.round(m.height * k));
        const buf = await sharp(t).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
        groups.fx.push({ name: `fx-${el.id}`, buf, w, h, anchor: [w * spec.anchor[0], h * spec.anchor[1]] });
      }
    }
  // Crows: same scale, body centre (purple patch) on the middle of one shared canvas, so the animation never jumps.
  const trimmedCrows = [];
  for (const el of crows) {
    const t = await trimPng(await toPng(el.img));
    trimmedCrows.push({ id: el.id, buf: t, meta: await sharp(t).metadata() });
  }
  const k = CROW_WIDTH / Math.max(...trimmedCrows.map((c) => c.meta.width));
  const scaled = [];
  for (const c of trimmedCrows) {
    const w = Math.round(c.meta.width * k),
      h = Math.round(c.meta.height * k);
    const buf = await sharp(c.buf).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const [bx, by] = bodyCentre({ data, w: info.width, h: info.height });
    scaled.push({ id: c.id, buf, w, h, bx, by });
  }
  const halfW = Math.ceil(Math.max(...scaled.map((c) => Math.max(c.bx, c.w - c.bx))));
  const halfH = Math.ceil(Math.max(...scaled.map((c) => Math.max(c.by, c.h - c.by))));
  for (const c of scaled) {
    const buf = await sharp({
      create: { width: halfW * 2, height: halfH * 2, channels: 4, background: clear },
    })
      .composite([{ input: c.buf, left: Math.round(halfW - c.bx), top: Math.round(halfH - c.by) }])
      .png()
      .toBuffer();
    groups.fx.push({ name: `fx-${c.id}`, buf, w: halfW * 2, h: halfH * 2, anchor: [halfW, halfH] });
  }
  return groups;
}

/** Packs frames into `<out>/<name>.webp` + `<name>.json` (Phaser JSON hash; `pivot` is the normalised anchor). */
export async function packAtlas(frames, out, name, maxWidth = 1024) {
  const items = [...frames].sort((a, b) => b.h - a.h || a.name.localeCompare(b.name));
  const pad = 2;
  let x = 0,
    y = 0,
    rowH = 0;
  const place = [];
  for (const it of items) {
    if (x + it.w + pad > maxWidth) {
      x = 0;
      y += rowH + pad;
      rowH = 0;
    }
    place.push({ ...it, x, y });
    x += it.w + pad;
    rowH = Math.max(rowH, it.h);
  }
  const H = y + rowH + pad;
  await sharp({ create: { width: maxWidth, height: H, channels: 4, background: clear } })
    .composite(place.map((p) => ({ input: p.buf, left: p.x, top: p.y })))
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toFile(`${out}/${name}.webp`);
  const json = {
    frames: Object.fromEntries(
      place.map((p) => [
        p.name,
        {
          frame: { x: p.x, y: p.y, w: p.w, h: p.h },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: p.w, h: p.h },
          sourceSize: { w: p.w, h: p.h },
          pivot: { x: +(p.anchor[0] / p.w).toFixed(4), y: +(p.anchor[1] / p.h).toFixed(4) },
          anchorPx: [Math.round(p.anchor[0]), Math.round(p.anchor[1])],
        },
      ]),
    ),
    meta: { image: `${name}.webp`, size: { w: maxWidth, h: H }, scale: '1', format: 'RGBA8888' },
  };
  fs.writeFileSync(`${out}/${name}.json`, JSON.stringify(json));
  const kb = (fs.statSync(`${out}/${name}.webp`).size / 1024).toFixed(0);
  console.log(`${name}: ${place.length} frames, ${maxWidth}x${H}, ${kb} KB`);
}

export async function buildSheetAtlases(out = 'public/assets') {
  const g = await buildFrames();
  await packAtlas(g.icons, out, 'atlas-icons');
  await packAtlas(g.fx, out, 'atlas-fx');
  await packAtlas(g.badges, out, 'atlas-badges');
}
