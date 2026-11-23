// Renders the three sheet atlases over checker, white, black and magenta (docs/capturas/chroma/atlas-*).
// Usage: node scripts/preview-sheets.mjs
import sharp from 'sharp';
import fs from 'node:fs';

const OUT = 'docs/capturas/chroma';
fs.mkdirSync(OUT, { recursive: true });

function checker(w, h, s = 16) {
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
for (const name of ['atlas-icons', 'atlas-fx', 'atlas-badges']) {
  const png = await sharp(`public/assets/${name}.webp`).png().toBuffer();
  const { width, height } = await sharp(png).metadata();
  for (const [tag, color] of Object.entries(bgs)) {
    const base = color
      ? await sharp({ create: { width, height, channels: 3, background: color } })
          .png()
          .toBuffer()
      : await checker(width, height);
    await sharp(base)
      .composite([{ input: png }])
      .png()
      .toFile(`${OUT}/${name}-${tag}.png`);
  }
}
