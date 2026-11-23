// Chroma-key helpers shared by the asset pipeline and the preview script.
// Images are { data: Buffer (RGBA), w, h }. All functions mutate and return the image.

const dist = (d, i, bg) => {
  const dr = d[i * 4] - bg[0],
    dg = d[i * 4 + 1] - bg[1],
    db = d[i * 4 + 2] - bg[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

/**
 * Removes a flat key colour.
 *  - `mode: 'flood'`  only background connected to the image border is removed (safe when the art
 *    contains colours close to the key, e.g. purple patches vs magenta).
 *  - `mode: 'global'` every pixel close to the key is removed, including holes (car windows, fence mesh,
 *    tower windows) that a flood fill cannot reach.
 * `hard` = distance below which a pixel is fully transparent; `soft` = distance above which it is fully opaque.
 * Pixels in between get a partial alpha and their colour is decontaminated (taken from nearby opaque pixels),
 * which removes the pink/green halo around outlines.
 */
export function keyColor(
  img,
  bg,
  { mode = 'flood', hard = 70, soft = 150, despillRadius = 3, protect = [] } = {},
) {
  const { data, w, h } = img;
  const n = w * h;
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = dist(data, i, bg);

  const remove = new Uint8Array(n); // 1 = candidate background
  if (mode === 'global') {
    for (let i = 0; i < n; i++) if (d[i] < soft) remove[i] = 1;
  } else {
    const stack = [];
    const push = (x, y) => {
      const i = y * w + x;
      if (!remove[i] && d[i] < soft) {
        remove[i] = 1;
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
  }

  // Protected rectangles [x0,y0,x1,y1] hold art that is genuinely key-coloured (e.g. a green liquid); never keyed.
  for (const [x0, y0, x1, y1] of protect)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) remove[y * w + x] = 0;

  // Alpha: ramp inside the soft band.
  const solid = new Uint8Array(n); // opaque and trustworthy colour (outside the ramp)
  for (let i = 0; i < n; i++) {
    if (!remove[i]) {
      data[i * 4 + 3] = 255;
      solid[i] = 1;
    } else if (d[i] <= hard) data[i * 4 + 3] = 0;
    else data[i * 4 + 3] = Math.round(((d[i] - hard) / (soft - hard)) * 255);
  }
  // Decontaminate semi-transparent pixels: borrow colour from the nearest trustworthy opaque neighbours.
  const R = despillRadius;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = data[i * 4 + 3];
      if (!remove[i] || a === 0) continue;
      let r = 0,
        g = 0,
        b = 0,
        c = 0;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (!solid[j]) continue;
          r += data[j * 4];
          g += data[j * 4 + 1];
          b += data[j * 4 + 2];
          c++;
        }
      if (c) {
        data[i * 4] = r / c;
        data[i * 4 + 1] = g / c;
        data[i * 4 + 2] = b / c;
      } else data[i * 4 + 3] = 0; // no real colour nearby: it is only fringe noise
    }
  // Final fringe pass: opaque pixels that touch transparency and still lean toward the key colour.
  for (let pass = 0; pass < 2; pass++) {
    const kill = [];
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (data[i * 4 + 3] === 0 || data[i * 4 + 3] < 255) continue;
        const touches =
          data[(i - 1) * 4 + 3] === 0 ||
          data[(i + 1) * 4 + 3] === 0 ||
          data[(i - w) * 4 + 3] === 0 ||
          data[(i + w) * 4 + 3] === 0;
        if (touches && d[i] < soft * 1.25 && leansToKey(data, i, bg)) kill.push(i);
      }
    for (const i of kill) data[i * 4 + 3] = 0;
  }
  despillBand(img, bg, 3);
  removeSpecks(img, bg, 80);
  return img;
}

/** How strongly a colour leans toward the key hue (green: g over r/b; magenta: r/b over g). */
const keyness = (r, g, b, green) => (green ? g - Math.max(r, b) : Math.min(r, b) - g);

/**
 * Line-based despill. A contaminated edge pixel is a blend  c = F + t (K - F)  of the real art colour F
 * (estimated from clean neighbours) and the key colour K. Legit pixels that merely look like the key
 * (the green liquid, purple patches) do NOT lie on that line, so they are left untouched. Only pixels within
 * `band` px of transparency are examined.
 */
function despillBand(img, bg, band) {
  const { data, w, h } = img;
  const green = bg[1] > 200;
  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] !== 0) continue;
      for (let dy = -band; dy <= band; dy++)
        for (let dx = -band; dx <= band; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) near[yy * w + xx] = 1;
        }
    }
  const R = band + 2;
  const out = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!near[i] || data[i * 4 + 3] === 0) continue;
      const r = data[i * 4],
        g = data[i * 4 + 1],
        b = data[i * 4 + 2];
      if (keyness(r, g, b, green) < 12) continue; // not leaning to the key: clean
      // Clean neighbours = opaque pixels that do not lean to the key.
      let fr = 0,
        fg = 0,
        fb = 0,
        c = 0;
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (data[j * 4 + 3] !== 255) continue;
          if (keyness(data[j * 4], data[j * 4 + 1], data[j * 4 + 2], green) >= 12) continue;
          fr += data[j * 4];
          fg += data[j * 4 + 1];
          fb += data[j * 4 + 2];
          c++;
        }
      if (!c) continue;
      fr /= c;
      fg /= c;
      fb /= c;
      // Project c onto the line F -> K and measure the residual.
      const kx = bg[0] - fr,
        ky = bg[1] - fg,
        kz = bg[2] - fb;
      const cx = r - fr,
        cy = g - fg,
        cz = b - fb;
      const t = (cx * kx + cy * ky + cz * kz) / (kx * kx + ky * ky + kz * kz);
      if (t < 0.08 || t > 1) continue;
      const res = Math.hypot(cx - t * kx, cy - t * ky, cz - t * kz);
      if (res < 38) out.push(i, fr, fg, fb);
    }
  for (let k = 0; k < out.length; k += 4) {
    const i = out[k];
    data[i * 4] = out[k + 1];
    data[i * 4 + 1] = out[k + 2];
    data[i * 4 + 2] = out[k + 3];
  }
}

/**
 * Deletes tiny blobs of key-tinted pixels that touch transparency (leftover key colour trapped between
 * outlines). Large key-like regions, such as the green liquid tube, are real art and are kept.
 */
function removeSpecks(img, bg, maxSize) {
  const { data, w, h } = img;
  const green = bg[1] > 200;
  const tinted = (i) =>
    data[i * 4 + 3] === 255 && keyness(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], green) >= 45;
  const seen = new Uint8Array(w * h);
  for (let s0 = 0; s0 < w * h; s0++) {
    if (seen[s0] || !tinted(s0)) continue;
    const comp = [s0];
    seen[s0] = 1;
    let touches = false;
    for (let k = 0; k < comp.length && comp.length <= maxSize; k++) {
      const i = comp[k],
        x = i % w,
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
        if (data[j * 4 + 3] < 255) touches = true;
        else if (!seen[j] && tinted(j)) {
          seen[j] = 1;
          comp.push(j);
        }
      }
    }
    if (comp.length <= maxSize && touches) for (const i of comp) data[i * 4 + 3] = 0;
  }
}

/** True when the pixel is closer to the key hue than a normal art colour would be (green: g high vs r/b; magenta: r,b high vs g). */
function leansToKey(data, i, bg) {
  const r = data[i * 4],
    g = data[i * 4 + 1],
    b = data[i * 4 + 2];
  if (bg[1] > 200) return g > r + 60 && g > b + 60;
  return r > g + 60 && b > g + 60;
}

export const keyMagenta = (img) => keyColor(img, [255, 0, 255], { mode: 'global', hard: 45, soft: 90 });
export const keyGreen = (img, opts = {}) =>
  keyColor(img, [0, 255, 0], { mode: 'global', hard: 50, soft: 110, ...opts });

/**
 * The lab tower's glass tube is filled with a liquid that is (almost) the key green (distance 15-77 from #00FF00),
 * so colour alone cannot tell it from sky. Its interior, in source pixels (1672x941), is protected from keying.
 */
export const CEMENTERIO_FAR_PROTECT = [[1363, 553, 1449, 637]];
export const keyCementerioFar = (img) => keyGreen(img, { protect: CEMENTERIO_FAR_PROTECT });

/** Largest-remaining-pixel statistic used by the halo check: counts opaque pixels that look like leftover key colour. */
export function haloCount(img, bg) {
  const { data, w, h } = img;
  let bad = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (data[i * 4 + 3] === 0) continue;
      const edge =
        data[(i - 1) * 4 + 3] < 255 ||
        data[(i + 1) * 4 + 3] < 255 ||
        data[(i - w) * 4 + 3] < 255 ||
        data[(i + w) * 4 + 3] < 255;
      if (edge && leansToKey(data, i, bg)) bad++;
    }
  return bad;
}
