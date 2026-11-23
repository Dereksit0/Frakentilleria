// Preview of the extracted donor parts over checker, white and black (docs/capturas/chroma/donantes-*.png).
// Usage: node scripts/preview-donors.mjs
import sharp from 'sharp';
import fs from 'node:fs';
import { extractDonor, toPng, SLOTS } from './donors.mjs';
import { haloCount } from './chroma.mjs';

const OUT = 'docs/capturas/chroma';
fs.mkdirSync(OUT, { recursive: true });
const DONORS = ['juguete', 'maniqui', 'espantapajaros', 'refrigerador'];
const S = 627;

function checker(w, h, s = 24) {
  const b = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = (((x / s) | 0) + ((y / s) | 0)) % 2 ? 235 : 150;
      const i = (y * w + x) * 4;
      b[i] = b[i + 1] = b[i + 2] = c;
      b[i + 3] = 255;
    }
  return sharp(b, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

const bgs = {
  checker: null,
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  magenta: { r: 255, g: 0, b: 255 },
};
for (const d of DONORS) {
  const { parts } = await extractDonor(`assets/raw/characters/donante-${d}-parts.png`);
  const items = [];
  for (const [i, slot] of SLOTS.entries()) {
    const p = parts[slot];
    console.log(d, slot, `${p.w}x${p.h}`, 'halo-edge px', haloCount(p, [0, 255, 0]));
    const scale = Math.min(1, (S - 20) / Math.max(p.w, p.h));
    const buf = await sharp(await toPng(p))
      .resize(Math.round(p.w * scale), Math.round(p.h * scale))
      .png()
      .toBuffer();
    items.push({ input: buf, left: (i % 2) * S + 10, top: ((i / 2) | 0) * S + 10 });
  }
  for (const [tag, color] of Object.entries(bgs)) {
    const base = color
      ? await sharp({ create: { width: S * 2, height: S * 2, channels: 3, background: color } })
          .png()
          .toBuffer()
      : await checker(S * 2, S * 2);
    await sharp(base).composite(items).png().toFile(`${OUT}/donante-${d}-${tag}.png`);
  }
}
