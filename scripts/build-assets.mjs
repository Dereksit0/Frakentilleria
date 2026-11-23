// Asset pipeline: reads assets/raw (never modified) and writes optimized, transparent
// assets + a packed atlas into public/assets. Missing donors are generated as placeholders
// with the SAME box sizes and anchors, so real art can replace them by dropping files in.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { keyMagenta as keyMagentaGlobal, keyGreen, keyCementerioFar } from './chroma.mjs';

const RAW = 'assets/raw';
const OUT = 'public/assets';
fs.mkdirSync(OUT, { recursive: true });

async function load(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}
const toSharp = (img) => sharp(img.data, { raw: { width: img.w, height: img.h, channels: 4 } });

/** Flood-fill the background from the image border; bg colour = given RGB, tolerance = euclid dist. */
function floodKey(img, bg, tol) {
  const { data, w, h } = img;
  const seen = new Uint8Array(w * h);
  const near = (i) => {
    const dr = data[i * 4] - bg[0],
      dg = data[i * 4 + 1] - bg[1],
      db = data[i * 4 + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db) < tol;
  };
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (!seen[i] && near(i)) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w,
      y = (i / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  for (let i = 0; i < w * h; i++) if (seen[i]) data[i * 4 + 3] = 0;
  // Fringe clean-up: opaque pixels touching transparency that still look like the background.
  for (let pass = 0; pass < 2; pass++) {
    const kill = [];
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (data[i * 4 + 3] === 0) continue;
        if (data[(i - 1) * 4 + 3] && data[(i + 1) * 4 + 3] && data[(i - w) * 4 + 3] && data[(i + w) * 4 + 3])
          continue;
        const dr = data[i * 4] - bg[0],
          dg = data[i * 4 + 1] - bg[1],
          db = data[i * 4 + 2] - bg[2];
        if (Math.sqrt(dr * dr + dg * dg + db * db) < tol * 2.1) kill.push(i);
      }
    for (const i of kill) data[i * 4 + 3] = 0;
  }
  return img;
}
const keyMagenta = (img) => floodKey(img, [255, 0, 255], 95);

async function crop(img, [x0, y0, x1, y1]) {
  const buf = await toSharp(img)
    .extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 })
    .png()
    .toBuffer();
  return load(buf);
}
async function trimmed(img) {
  return toSharp(img)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .png()
    .toBuffer();
}
/** Fit buffer in a w*h box (contain) and align inside the box. */
async function fitBox(buf, w, h, align = 'bottom') {
  const resized = await sharp(buf).resize(w, h, { fit: 'inside' }).png().toBuffer();
  const m = await sharp(resized).metadata();
  const left = Math.round((w - m.width) / 2);
  const top = align === 'bottom' ? h - m.height : align === 'top' ? 0 : Math.round((h - m.height) / 2);
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

const frames = new Map();

// Part boxes (logical px). Keep in sync with src/data/parts.json "boxes".
const PART_BOX = { head: [170, 170], torso: [210, 170], arms: [230, 150], legs: [160, 150] };
const DONORS = {
  armadura: { color: '#8FA3BF', dark: '#6F829D', accent: '#FF5468' },
  espantapajaros: { color: '#C98B2B', dark: '#8A5A22', accent: '#F2C230' },
  maniqui: { color: '#E58AB4', dark: '#C9709B', accent: '#F4EFE1' },
  juguete: { color: '#3FC8C0', dark: '#2A8E88', accent: '#F2C230' },
  refri: { color: '#DDEFF5', dark: '#9FBFCB', accent: '#5B3FA0' },
};

function placeholderSvg(donor, slot) {
  const [w, h] = PART_BOX[slot];
  const d = DONORS[donor];
  const st = 'stroke="#0F0E15" stroke-width="5" stroke-linejoin="round"';
  let body;
  if (slot === 'head') {
    const shape =
      donor === 'refri'
        ? `<rect x="30" y="20" width="110" height="130" rx="14" fill="${d.color}" ${st}/><rect x="120" y="50" width="8" height="40" fill="${d.dark}"/>`
        : donor === 'espantapajaros'
          ? `<rect x="20" y="64" width="130" height="12" rx="4" fill="${d.accent}" ${st}/><path d="M50 70 L60 18 H110 L120 70 Z" fill="${d.accent}" ${st}/><circle cx="85" cy="105" r="45" fill="${d.color}" ${st}/>`
          : donor === 'juguete'
            ? `<rect x="25" y="35" width="120" height="105" rx="16" fill="${d.color}" ${st}/><path d="M85 35 v-18 m-12 0 h24" stroke="#0F0E15" stroke-width="6" fill="none"/><circle cx="150" cy="80" r="9" fill="${d.accent}" ${st}/>`
            : `<ellipse cx="85" cy="90" rx="52" ry="58" fill="${d.color}" ${st}/>`;
    body = `${shape}<circle cx="65" cy="98" r="13" fill="#F4EFE1" ${st}/><circle cx="105" cy="98" r="13" fill="#F4EFE1" ${st}/><circle cx="68" cy="100" r="5" fill="#0F0E15"/><circle cx="108" cy="100" r="5" fill="#0F0E15"/><rect x="65" y="152" width="40" height="14" fill="#0F0E15"/>`;
  } else if (slot === 'torso') {
    body = `<rect x="35" y="20" width="140" height="140" rx="${donor === 'maniqui' ? 50 : 16}" fill="${d.color}" ${st}/><path d="M55 70 l40 30 M95 70 l-40 30" stroke="${d.accent}" stroke-width="6"/><rect x="62" y="118" width="30" height="24" fill="${d.accent}" ${st}/>`;
  } else if (slot === 'arms') {
    body = `<rect x="8" y="30" width="150" height="46" rx="20" fill="${d.color}" ${st}/><rect x="140" y="22" width="80" height="62" rx="10" fill="${d.dark}" ${st}/><ellipse cx="222" cy="53" rx="6" ry="20" fill="#0F0E15"/><circle cx="34" cy="54" r="26" fill="${d.accent}" ${st}/>`;
  } else {
    const leg = (x) =>
      donor === 'juguete'
        ? `<path d="M${x + 22} 10 l-14 24 l28 18 l-28 18 l28 18 l-14 22" fill="none" stroke="#0F0E15" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/><path d="M${x + 22} 10 l-14 24 l28 18 l-28 18 l28 18 l-14 22" fill="none" stroke="#F2C230" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="${x - 6}" y="124" width="56" height="20" rx="8" fill="${d.color}" ${st}/>`
        : `<rect x="${x}" y="8" width="${donor === 'espantapajaros' ? 22 : 42}" height="118" rx="${donor === 'maniqui' ? 20 : 8}" fill="${d.color}" ${st}/><rect x="${x - 8}" y="120" width="60" height="26" rx="10" fill="${d.dark}" ${st}/>`;
    body = leg(20) + leg(88);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

async function buildParts() {
  const sheet = keyMagenta(await load(`${RAW}/characters/donante-armadura-parts.png`));
  const quads = {
    head: [0, 0, 627, 627],
    torso: [627, 0, 1254, 627],
    arms: [0, 627, 627, 1254],
    legs: [627, 627, 1254, 1254],
  };
  for (const slot of Object.keys(quads)) {
    const c = await crop(sheet, quads[slot]);
    const t = await trimmed(c);
    const [w, h] = PART_BOX[slot];
    frames.set(`part_armadura_${slot}`, await fitBox(t, w, h, slot === 'head' ? 'bottom' : 'center'));
  }
  for (const donor of Object.keys(DONORS).filter((d) => d !== 'armadura')) {
    for (const slot of Object.keys(PART_BOX)) {
      frames.set(
        `part_${donor}_${slot}`,
        await sharp(Buffer.from(placeholderSvg(donor, slot)))
          .png()
          .toBuffer(),
      );
    }
  }
}

async function buildGrid(file, boxes, names, size) {
  const sheet = keyMagenta(await load(file));
  for (let i = 0; i < names.length; i++) {
    const c = await crop(sheet, boxes[i]);
    const t = await trimmed(c);
    frames.set(names[i], size ? await fitBox(t, size[0], size[1], 'center') : t);
  }
}

const svgBuf = (svg) => sharp(Buffer.from(svg)).png().toBuffer();

async function buildSprites() {
  const cols = [
    [70, 470],
    [570, 965],
    [1065, 1465],
  ];
  const rows = [
    [55, 470],
    [545, 955],
  ];
  const wBoxes = [];
  for (const r of rows) for (const c of cols) wBoxes.push([c[0], r[0], c[1], r[1]]);
  await buildGrid(
    `${RAW}/weapons/iconos-armas.png`,
    wBoxes,
    ['wicon_cannon', 'wicon_mortar', 'wicon_rocket', 'wicon_grenade', 'wicon_potion', 'wicon_raygun'],
    [112, 112],
  );
  await buildGrid(
    `${RAW}/fx/proyectiles-explosiones.png`,
    [
      [130, 60, 420, 350],
      [480, 40, 950, 360],
      [1030, 40, 1450, 370],
      [80, 410, 400, 770],
      [450, 390, 1000, 790],
      [1040, 420, 1490, 780],
      [210, 780, 1260, 1000],
    ],
    ['fx_ball', 'fx_rocket', 'fx_mortar', 'fx_smoke', 'fx_explosion', 'fx_splash', 'fx_cloud'],
  );
  await buildGrid(
    `${RAW}/ui/items-cajas-habilidades.png`,
    [
      [20, 100, 400, 480],
      [420, 110, 790, 450],
      [820, 50, 1130, 480],
      [1160, 130, 1500, 440],
      [60, 530, 420, 900],
      [520, 520, 940, 940],
      [1050, 540, 1500, 940],
    ],
    ['item_mystery', 'item_crate', 'item_barrel', 'item_heart', 'item_shield', 'item_boot', 'item_fist'],
  );
  const target = {
    fx_ball: 40,
    fx_rocket: 90,
    fx_mortar: 90,
    fx_smoke: 128,
    fx_explosion: 256,
    fx_splash: 200,
    fx_cloud: 360,
    item_mystery: 96,
    item_crate: 96,
    item_barrel: 96,
    item_heart: 80,
    item_shield: 80,
    item_boot: 80,
    item_fist: 80,
  };
  for (const [k, s] of Object.entries(target)) {
    frames.set(k, await sharp(frames.get(k)).resize(s, s, { fit: 'inside' }).png().toBuffer());
  }
  // Placeholders for weapons without an icon yet (see docs/ASSETS_TODO.md).
  const panel =
    '<rect x="4" y="4" width="104" height="104" rx="14" fill="#5B3FA0" stroke="#0F0E15" stroke-width="5"/>';
  frames.set(
    'wicon_mace',
    await svgBuf(
      `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112">${panel}<path d="M30 86 L72 40" stroke="#0F0E15" stroke-width="12" stroke-linecap="round"/><circle cx="76" cy="36" r="20" fill="#C0C0D0" stroke="#0F0E15" stroke-width="5"/></svg>`,
    ),
  );
  frames.set(
    'wicon_ice',
    await svgBuf(
      `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112">${panel}<path d="M56 16 L70 56 L56 96 L42 56 Z M20 56 L56 44 L92 56 L56 68 Z" fill="#BFF3FF" stroke="#0F0E15" stroke-width="4" stroke-linejoin="round"/></svg>`,
    ),
  );
  frames.set(
    'dot',
    await svgBuf(
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5" fill="#fff"/></svg>',
    ),
  );
}

async function writeAtlas() {
  const items = [];
  for (const [name, buf] of frames) {
    const m = await sharp(buf).metadata();
    items.push({ name, buf, w: m.width, h: m.height });
  }
  items.sort((a, b) => b.h - a.h);
  const W = 2048,
    pad = 2;
  let x = 0,
    y = 0,
    rowH = 0;
  const place = [];
  for (const it of items) {
    if (x + it.w + pad > W) {
      x = 0;
      y += rowH + pad;
      rowH = 0;
    }
    place.push({ ...it, x, y });
    x += it.w + pad;
    rowH = Math.max(rowH, it.h);
  }
  const H = y + rowH + pad;
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(place.map((p) => ({ input: p.buf, left: p.x, top: p.y })))
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/atlas.png`);
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
        },
      ]),
    ),
    meta: { image: 'atlas.png', size: { w: W, h: H }, scale: '1', format: 'RGBA8888' },
  };
  fs.writeFileSync(`${OUT}/atlas.json`, JSON.stringify(json));
  console.log(`atlas: ${place.length} frames, ${W}x${H}`);
}

async function webp(inFile, outName, w, q = 80) {
  await sharp(inFile)
    .resize({ width: w, withoutEnlargement: true })
    .webp({ quality: q })
    .toFile(`${OUT}/${outName}`);
}
async function buildBackgrounds() {
  fs.mkdirSync(`${OUT}/maps`, { recursive: true });
  fs.mkdirSync(`${OUT}/screens`, { recursive: true });
  await webp(`${RAW}/maps/vertedero-sky.png`, 'maps/vertedero-sky.webp', 1600);
  await webp(`${RAW}/screens/menu-bg-laboratorio.png`, 'screens/menu-bg-laboratorio.webp', 1600);
  await webp(`${RAW}/screens/portada-key-art.png`, 'screens/portada-key-art.webp', 1600);
  await webp(`${RAW}/screens/splashscreen.png`, 'screens/splashscreen.webp', 1600);
  const far = keyMagenta(await load(`${RAW}/maps/vertedero-far.png`));
  await toSharp(far).resize({ width: 1600 }).webp({ quality: 82 }).toFile(`${OUT}/maps/vertedero-far.webp`);
  const ter = keyMagenta(await load(`${RAW}/maps/vertedero-terrain.png`));
  const tbuf = await trimmed(ter);
  const tm = await sharp(tbuf).metadata();
  const th = Math.round(tm.height * (1600 / tm.width) * 1.5);
  await sharp(tbuf)
    .resize(1600, th, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/maps/vertedero-terrain.png`);
  console.log('terrain height', th);
  await buildNewMaps();
  await buildBrand();
  fs.mkdirSync(`${OUT}/audio`, { recursive: true });
  fs.copyFileSync(`${RAW}/audio/music-1.mp3`, `${OUT}/audio/music-1.mp3`);
}

/** Max desktop width for any shipped background (see docs/DECISIONES.md). */
const MAX_W = 1600;

/** Keys a raw RGB image and returns a sharp instance over the RGBA result. */
async function keyed(file, key) {
  const img = key(await load(file));
  return toSharp(img);
}

async function buildNewMaps() {
  const M = `${OUT}/maps`;
  fs.mkdirSync(M, { recursive: true });
  // Graveyard: ground (magenta key) + far layer (green key).
  const ter = key2img(await keyed(`${RAW}/maps/cementerio/cementerio-terrain.png`, keyMagentaGlobal));
  const tbuf = await trimmed(await ter);
  const tm = await sharp(tbuf).metadata();
  const th = Math.round(tm.height * (MAX_W / tm.width) * 1.5); // same vertical stretch as the Vertedero terrain
  await sharp(tbuf)
    .resize(MAX_W, th, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(`${M}/cementerio-terrain.png`);
  console.log('cementerio terrain height', th);
  await (
    await keyed(`${RAW}/maps/cementerio/cementerio-far.png`, keyCementerioFar)
  )
    .resize({ width: MAX_W })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(`${M}/cementerio-far.webp`);
  // Vertedero midground (green key).
  await (
    await keyed(`${RAW}/maps/vertedero/vertedero-mid.png`, keyGreen)
  )
    .resize({ width: MAX_W })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(`${M}/vertedero-mid.webp`);
  // Toy factory: one opaque full background, no key.
  await sharp(`${RAW}/maps/fabrica/fabrica-bg.png`)
    .resize({ width: MAX_W })
    .webp({ quality: 82 })
    .toFile(`${M}/fabrica-bg.webp`);
}
const key2img = async (s) => {
  const { data, info } = await s.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
};

/** Wordmark logo, app icons (any + maskable + apple touch), favicon.ico and the Open Graph card. */
async function buildBrand() {
  const logo = await trimmed(await load(`${RAW}/logo/logo-frankentilleria-sf.png`));
  await sharp(logo).resize({ width: 1000 }).png({ compressionLevel: 9 }).toFile(`${OUT}/logo.png`);
  const icon = await trimmed(await load(`${RAW}/logo/icono-frankentilleria-sf.png`));
  const NOCHE = { r: 0x2e, g: 0x2a, b: 0x47, alpha: 1 };
  const onNoche = async (size, inner) => {
    const art = await sharp(icon).resize(inner, inner, { fit: 'inside' }).png().toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: NOCHE } })
      .composite([{ input: art, gravity: 'centre' }])
      .png()
      .toBuffer();
  };
  for (const s of [192, 512])
    await sharp(icon).resize(s, s, { fit: 'inside' }).png().toFile(`${OUT}/icon-${s}.png`);
  // Maskable: art inside the central 70 % safe zone over a full-bleed background.
  await sharp(await onNoche(512, Math.round(512 * 0.7))).toFile(`${OUT}/icon-maskable-512.png`);
  await sharp(await onNoche(180, Math.round(180 * 0.82))).toFile(`${OUT}/apple-touch-icon.png`);
  const sizes = [16, 32, 48];
  const pngs = [];
  for (const s of sizes) pngs.push(await sharp(icon).resize(s, s, { fit: 'inside' }).png().toBuffer());
  await sharp(pngs[1]).toFile(`${OUT}/favicon-32.png`);
  fs.writeFileSync(`${OUT}/favicon.ico`, buildIco(sizes, pngs));
  // Open Graph card 1200x630 from the cover key art.
  await sharp(`${RAW}/screens/portada-key-art.png`)
    .resize(1200, 630, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toFile(`${OUT}/og-image.jpg`);
}

/** Minimal ICO container holding PNG-compressed images. */
function buildIco(sizes, pngs) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const dir = pngs.map((p, i) => {
    const e = Buffer.alloc(16);
    e[0] = sizes[i];
    e[1] = sizes[i];
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(p.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += p.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...pngs]);
}

await buildParts();
await buildSprites();
await writeAtlas();
await buildBackgrounds();
console.log('assets ok ->', path.resolve(OUT));
