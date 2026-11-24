// Acid strip -> two seamless, standalone WebP files used as TileSprites (not packed in an atlas):
//   acid-surface.webp  crest + bubbles + body, mirrored once so the left and right edges are the same column
//                      (a 3x horizontal stack shows no seam). Transparent above the crest outline.
//   acid-body.webp     opaque filler taken from the lower body, mirrored on both axes so it tiles in x and y.
//                      Its second vertical half starts with the strip's last row, so a TileSprite placed right
//                      under the surface (tilePositionY = body.h / 2, same tilePositionX) continues it.
import sharp from 'sharp';
import fs from 'node:fs';
import { keyColor } from './chroma.mjs';
import { loadRaw } from './donors.mjs';

const clear = { r: 0, g: 0, b: 0, alpha: 0 };
const SRC = 'assets/raw/fx/acido-tira.png';
const HALF_W = 1024; // logical width of one copy of the strip
const BODY_H = 128; // height of the body sample (before mirroring)

/** Per-column alpha: 0 above the first dark outline pixel of the crest (bubbles included), 255 below. */
function columnAlpha(img) {
  const { data, w, h } = img;
  for (let x = 0; x < w; x++) {
    let top = h;
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 200 && data[i] < 60 && data[i + 1] < 60 && data[i + 2] < 60) {
        top = y;
        break;
      }
    }
    for (let y = 0; y < top; y++) data[(y * w + x) * 4 + 3] = 0;
  }
}

const mirrorH = async (buf) => {
  const flop = await sharp(buf).flop().png().toBuffer();
  const m = await sharp(buf).metadata();
  return sharp({ create: { width: m.width * 2, height: m.height, channels: 4, background: clear } })
    .composite([
      { input: buf, left: 0, top: 0 },
      { input: flop, left: m.width, top: 0 },
    ])
    .png()
    .toBuffer();
};

export async function buildAcid(out = 'public/assets') {
  const img = keyColor(await loadRaw(SRC), [0, 255, 0], { mode: 'flood', hard: 50, soft: 110 });
  columnAlpha(img);
  const raw = await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } })
    .png()
    .toBuffer();
  const trimmed = await sharp(raw).trim({ background: clear, threshold: 1 }).png().toBuffer();
  const scaled = await sharp(trimmed).resize({ width: HALF_W, kernel: 'lanczos3' }).png().toBuffer();
  const sm = await sharp(scaled).metadata();

  const surface = await mirrorH(scaled);
  await sharp(surface).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(`${out}/acid-surface.webp`);

  // Body: bottom BODY_H rows of the strip, mirrored in x and y.
  const sample = await sharp(scaled)
    .extract({ left: 0, top: sm.height - BODY_H, width: HALF_W, height: BODY_H })
    .removeAlpha()
    .png()
    .toBuffer();
  const row = await mirrorH(sample);
  const flip = await sharp(row).flip().png().toBuffer();
  const body = await sharp({
    create: { width: HALF_W * 2, height: BODY_H * 2, channels: 3, background: '#000' },
  })
    .composite([
      { input: row, left: 0, top: 0 },
      { input: flip, left: 0, top: BODY_H },
    ])
    .png()
    .toBuffer();
  await sharp(body).webp({ quality: 85, effort: 6 }).toFile(`${out}/acid-body.webp`);
  const kb = (f) => (fs.statSync(`${out}/${f}`).size / 1024).toFixed(0);
  console.log(
    `acid-surface: ${HALF_W * 2}x${sm.height}, ${kb('acid-surface.webp')} KB; acid-body: ${HALF_W * 2}x${BODY_H * 2}, ${kb('acid-body.webp')} KB`,
  );
}
