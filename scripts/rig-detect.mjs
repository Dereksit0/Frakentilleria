// Pixel measurements shared by scripts/rig-anchors.mjs and tests/rig-masks.test.ts.
import sharp from 'sharp';
import fs from 'node:fs';

/** RGBA frames of the atlas as { m: alpha mask, rgb, w, h } by frame name. */
export async function loadFrames(names, root = '.') {
  const atlas = JSON.parse(fs.readFileSync(`${root}/public/assets/atlas.json`, 'utf8'));
  const sheet = await sharp(`${root}/public/assets/atlas.png`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = {};
  for (const name of names) {
    const f = atlas.frames[name].frame;
    const m = new Uint8Array(f.w * f.h);
    const lum = new Uint8Array(f.w * f.h);
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        const i = ((f.y + y) * sheet.info.width + f.x + x) * 4;
        m[y * f.w + x] = sheet.data[i + 3] > 40 ? 1 : 0;
        lum[y * f.w + x] = Math.max(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]);
      }
    out[name] = { m, lum, w: f.w, h: f.h };
  }
  return out;
}

/** Horizontal extent [min, max] of the opaque pixels in rows y0..y1 (inclusive), or null. */
export function rowsExtent({ m, w }, y0, y1) {
  let a = w,
    b = -1;
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) {
        if (x < a) a = x;
        if (x > b) b = x;
      }
  return b < 0 ? null : [a, b];
}

/**
 * Neck stump of a head: centre of the opaque extent of its last `rows` rows. Only meaningful when that extent is a narrow
 * stump (heads whose bottom is the wide body of the head, like the helmet or the pumpkin, return stump: false).
 */
export function headStump(img, bbox, rows = 6, maxWidth = 70) {
  const e = rowsExtent(img, bbox[3] - rows + 1, bbox[3]);
  const width = e[1] - e[0] + 1;
  return { x: (e[0] + e[1]) / 2, y: bbox[3], width, stump: width <= maxWidth };
}

/**
 * Opening of a torso's neck: the dark interior of the collar. Dark pixels are eroded so the ink outline (thin) disappears
 * and the interior (wide) survives; the biggest surviving blob in the top rows gives the centre and top edge.
 * Returns null when the torso has no dark opening (flat tops).
 */
export function torsoOpening(img, bbox, erode = 3) {
  const { m, lum, w, h } = img;
  const top = bbox[1];
  const limit = Math.min(h, top + 50);
  let dark = new Uint8Array(w * h);
  for (let y = top; y < limit; y++)
    for (let x = 0; x < w; x++) if (m[y * w + x] && lum[y * w + x] < 45) dark[y * w + x] = 1;
  for (let k = 0; k < erode; k++) {
    const next = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (dark[i] && dark[i - 1] && dark[i + 1] && dark[i - w] && dark[i + w]) next[i] = 1;
      }
    dark = next;
  }
  const seen = new Uint8Array(w * h);
  let best = null;
  for (let i = 0; i < w * h; i++) {
    if (!dark[i] || seen[i]) continue;
    const b = { area: 0, x0: w, x1: -1, y0: h, y1: -1 };
    const st = [i];
    seen[i] = 1;
    while (st.length) {
      const j = st.pop();
      const x = j % w,
        y = (j / w) | 0;
      b.area++;
      b.x0 = Math.min(b.x0, x);
      b.x1 = Math.max(b.x1, x);
      b.y0 = Math.min(b.y0, y);
      b.y1 = Math.max(b.y1, y);
      for (const k of [j - 1, j + 1, j - w, j + w])
        if (dark[k] && !seen[k]) {
          seen[k] = 1;
          st.push(k);
        }
    }
    if (b.area >= 60 && (!best || b.area > best.area)) best = b;
  }
  if (!best) return null;
  return {
    x: (best.x0 + best.x1) / 2,
    top: best.y0 - erode,
    bottom: best.y1 + erode,
    width: best.x1 - best.x0 + 1 + 2 * erode,
    area: best.area,
  };
}

/** Heads whose bottom is a wide body (helmet, pumpkin) have no stump: their neck is the centre of that body. */
export const NECK_BODY_ROWS = { armadura: [30, 8], espantapajaros: [19, 4] };

/** Horizontal centre of the union of the opaque rows [ya, yb]. */
export function extentCenter(img, ya, yb) {
  const e = rowsExtent(img, ya, yb);
  return e ? (e[0] + e[1]) / 2 : 0;
}

/** Neck x of a head: centre of its stump, or of its lower body when it has no stump. */
export function detectHeadNeckX(img, bbox, donor) {
  const body = NECK_BODY_ROWS[donor];
  return body ? extentCenter(img, bbox[3] - body[0], bbox[3] - body[1]) : headStump(img, bbox).x;
}

/** First opaque row of a piece inside the columns [xa, xb]. */
export function topRowIn(img, xa, xb) {
  for (let y = 0; y < img.h; y++)
    for (let x = Math.max(0, xa); x <= Math.min(img.w - 1, xb); x++) if (img.m[y * img.w + x]) return y;
  return 0;
}

/**
 * Neck of a torso: x = centre of the dark collar opening (or of the rim rows when the collar is flat or light),
 * y = the rim in front of that column (first opaque row within 10 px of x). The head then sinks `neckDepth` px below it.
 */
export function detectTorsoNeck(img, bbox) {
  const o = torsoOpening(img, bbox);
  const x = o && o.width >= 30 ? o.x : extentCenter(img, bbox[1] + 4, bbox[1] + 8);
  return [x, topRowIn(img, Math.round(x) - 10, Math.round(x) + 10)];
}
