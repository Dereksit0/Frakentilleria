// Renders every keyed asset over a checkerboard and over a bright contrasting colour so halos are visible.
// Usage: node scripts/preview-chroma.mjs [outDir]   (default docs/capturas/chroma)
import sharp from 'sharp';
import fs from 'node:fs';
import { keyMagenta, keyGreen, keyCementerioFar, haloCount } from './chroma.mjs';

const OUT = process.argv[2] ?? 'docs/capturas/chroma';
fs.mkdirSync(OUT, { recursive: true });
const JOBS = [
  ['assets/raw/maps/cementerio/cementerio-terrain.png', keyMagenta, [255, 0, 255], 'cementerio-terrain'],
  ['assets/raw/maps/cementerio/cementerio-far.png', keyCementerioFar, [0, 255, 0], 'cementerio-far'],
  ['assets/raw/maps/vertedero/vertedero-mid.png', keyGreen, [0, 255, 0], 'vertedero-mid'],
];

function checker(w, h, s = 24) {
  const b = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = ((x / s) | 0) + ((y / s) | 0);
      const c = v % 2 ? 235 : 150;
      b.fill(0, 0, 0);
      const i = (y * w + x) * 4;
      b[i] = b[i + 1] = b[i + 2] = c;
      b[i + 3] = 255;
    }
  return sharp(b, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

for (const [file, key, bg, name] of JOBS) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const img = key({ data, w: info.width, h: info.height });
  const keyed = await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } })
    .png()
    .toBuffer();
  const transparent = (() => {
    let n = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] === 0) n++;
    return ((n / (img.w * img.h)) * 100).toFixed(1);
  })();
  console.log(`${name}: transparent ${transparent}%, halo-edge pixels ${haloCount(img, bg)}`);
  const cb = await checker(img.w, img.h);
  await sharp(cb)
    .composite([{ input: keyed }])
    .png()
    .toFile(`${OUT}/${name}-checker.png`);
  // Opposite colour of the key (strongest contrast for residual tint), plain white and plain black.
  const opp = { r: 255 - bg[0], g: 255 - bg[1], b: 255 - bg[2] };
  for (const [tag, color] of [
    ['contrast', opp],
    ['white', { r: 255, g: 255, b: 255 }],
    ['black', { r: 0, g: 0, b: 0 }],
  ])
    await sharp({ create: { width: img.w, height: img.h, channels: 3, background: color } })
      .composite([{ input: keyed }])
      .png()
      .toFile(`${OUT}/${name}-${tag}.png`);
}
