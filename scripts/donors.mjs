// Donor sheet extraction: removes the green background (global key: the pure key green is far from the olive
// claw and the purple patches, and it also clears enclosed holes such as the wind-up key), splits the sheet into its 4 parts by
// connected components and measures the joint anchors of each part.
import sharp from 'sharp';
import { keyColor } from './chroma.mjs';

export const SLOTS = ['head', 'torso', 'arms', 'legs'];
const MARGIN = 4;

export async function loadRaw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

export const toPng = (img) =>
  sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } })
    .png()
    .toBuffer();

/** Which slot a sheet quadrant holds: head top-left, torso top-right, arms bottom-left, legs bottom-right. */
function quadrantSlot(cx, cy, w, h) {
  const right = cx > w / 2;
  const bottom = cy > h / 2;
  return bottom ? (right ? 'legs' : 'arms') : right ? 'torso' : 'head';
}

/** Connected components of non-transparent pixels (8-neighbourhood). Returns bbox, area and centroid per component. */
export function components(img, minArea) {
  const { data, w, h } = img;
  const label = new Int32Array(w * h).fill(-1);
  const out = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] >= 0 || data[s * 4 + 3] < 8) continue;
    const id = out.length;
    const stack = [s];
    label[s] = id;
    let x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0,
      area = 0,
      sx = 0,
      sy = 0;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w,
        y = (i / w) | 0;
      area++;
      sx += x;
      sy += y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (label[j] >= 0 || data[j * 4 + 3] < 8) continue;
          label[j] = id;
          stack.push(j);
        }
    }
    out.push({ id, x0, y0, x1, y1, area, cx: sx / area, cy: sy / area });
  }
  return { label, comps: out.filter((c) => c.area >= minArea) };
}

/**
 * Splits a keyed sheet into 4 parts. Returns { head, torso, arms, legs } as RGBA images cropped with a
 * MARGIN px transparent border. Components below minArea are specks and are dropped.
 */
export function splitSheet(img, minArea = 400) {
  const { w, h } = img;
  const { label, comps } = components(img, minArea);
  const groups = { head: [], torso: [], arms: [], legs: [] };
  for (const c of comps) groups[quadrantSlot(c.cx, c.cy, w, h)].push(c);
  const parts = {};
  for (const slot of SLOTS) {
    const g = groups[slot];
    if (!g.length) throw new Error(`no component found for ${slot}`);
    const keep = new Set(g.map((c) => c.id));
    const x0 = Math.min(...g.map((c) => c.x0)),
      y0 = Math.min(...g.map((c) => c.y0)),
      x1 = Math.max(...g.map((c) => c.x1)),
      y1 = Math.max(...g.map((c) => c.y1));
    const pw = x1 - x0 + 1 + MARGIN * 2,
      ph = y1 - y0 + 1 + MARGIN * 2;
    const data = Buffer.alloc(pw * ph * 4);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * w + x;
        if (!keep.has(label[i])) continue;
        const o = ((y - y0 + MARGIN) * pw + (x - x0 + MARGIN)) * 4;
        data[o] = img.data[i * 4];
        data[o + 1] = img.data[i * 4 + 1];
        data[o + 2] = img.data[i * 4 + 2];
        data[o + 3] = img.data[i * 4 + 3];
      }
    parts[slot] = { data, w: pw, h: ph };
  }
  return parts;
}

/** Keys the green background of a donor sheet (global, hard 50 / soft 110) and splits it. */
export async function extractDonor(file) {
  const img = keyColor(await loadRaw(file), [0, 255, 0], { mode: 'global', hard: 50, soft: 110 });
  cleanGreenFringe(img);
  return { keyed: img, parts: splitSheet(img) };
}

/** Opaque-pixel statistics of an RGBA image. */
function opaqueStats(img, rowsFrac = 0.08, colsFrac = 0.2) {
  const { data, w, h } = img;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const bw = x1 - x0 + 1,
    bh = y1 - y0 + 1;
  const centroid = (xa, xb, ya, yb) => {
    let sx = 0,
      sy = 0,
      n = 0;
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++)
        if (data[(y * w + x) * 4 + 3] > 40) {
          sx += x;
          sy += y;
          n++;
        }
    return n ? [sx / n, sy / n] : [(xa + xb) / 2, (ya + yb) / 2];
  };
  const band = Math.max(2, Math.round(bh * rowsFrac));
  const side = Math.max(2, Math.round(bw * colsFrac));
  return {
    bbox: [x0, y0, x1, y1],
    top: centroid(x0, x1, y0, y0 + band),
    bottom: centroid(x0, x1, y1 - band, y1),
    left: centroid(x0, x0 + side, y0, y1),
    right: centroid(x1 - side, x1, y0, y1),
  };
}

/**
 * Anchor points (px inside the frame) used to assemble a creature:
 *  head:  neck (bottom centre)
 *  torso: neck (top), hip (bottom), shoulder (where the arm pivots)
 *  arms:  shoulder (pivot, left end of the arm), tip (hand / muzzle, right end)
 *  legs:  hip (top centre of the pair), ground (bottom of the feet)
 */
export function measureAnchors(slot, img) {
  const s = opaqueStats(img);
  const [x0, y0, x1, y1] = s.bbox;
  const r = (p) => [Math.round(p[0]), Math.round(p[1])];
  switch (slot) {
    case 'head':
      return { neck: r([s.bottom[0], y1]) };
    case 'torso':
      return {
        neck: r([s.top[0], y0]),
        hip: r([s.bottom[0], y1]),
        shoulder: r([(x0 + x1) / 2 + (x1 - x0) * 0.08, y0 + (y1 - y0) * 0.3]),
      };
    case 'arms':
      return { shoulder: r(s.left), tip: r([x1, s.right[1]]) };
    default:
      return { hip: r([s.top[0], y0]), ground: r([s.bottom[0], y1]) };
  }
}

export { opaqueStats };

/**
 * Removes the last green fringe: opaque pixels within `reach` px of transparency that still lean to green are
 * cleared (the glint near the wind-up key) and the remaining edge pixels get their green capped (despill).
 * Interior pixels (the olive claw is behind a black outline) are never touched. With everywhere=false only the edge
 * rules run (grid sheets contain legitimately green art such as the acid puddle).
 */
export function cleanGreenFringe(img, reach = 3, everywhere = true) {
  const { data, w, h } = img;
  const near = new Uint8Array(w * h);
  let frontier = [];
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] < 8) frontier.push(i);
  const seen = new Uint8Array(w * h);
  frontier.forEach((i) => (seen[i] = 1));
  for (let step = 0; step < reach; step++) {
    const next = [];
    for (const i of frontier) {
      const x = i % w,
        y = (i / w) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const xx = x + dx,
          yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (seen[j]) continue;
        seen[j] = 1;
        near[j] = 1;
        next.push(j);
      }
    }
    frontier = next;
  }
  for (let i = 0; i < w * h; i++) {
    if (
      everywhere &&
      data[i * 4 + 3] > 0 &&
      data[i * 4 + 3] < 250 &&
      data[i * 4 + 1] > Math.max(data[i * 4], data[i * 4 + 2]) + 20
    )
      data[i * 4 + 3] = 0;
    if (
      everywhere &&
      data[i * 4 + 3] > 0 &&
      data[i * 4 + 1] > 170 &&
      data[i * 4 + 1] > data[i * 4] + 25 &&
      data[i * 4 + 1] > data[i * 4 + 2] + 25
    )
      data[i * 4 + 3] = 0;
    if (!near[i] || data[i * 4 + 3] < 8) continue;
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2];
    if (g > r + 40 && g > b + 40 && g > 140) data[i * 4 + 3] = 0;
    else if (g > Math.max(r, b) + 12) data[i * 4 + 1] = Math.max(r, b) + 12;
  }
  return img;
}
