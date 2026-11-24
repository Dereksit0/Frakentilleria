// Detects the rig anchors of every donor piece from the atlas pixels and writes src/data/rig.json.
// Usage: node scripts/rig-anchors.mjs        (after `npm run assets`)
// Hand corrections live in rig.json under "manual" (made with ?debug=rig) and survive re-runs.
import sharp from 'sharp';
import fs from 'node:fs';
import { detectHeadNeckX, detectTorsoHipX, detectTorsoNeck } from './rig-detect.mjs';

const OUT = 'src/data/rig.json';
const atlas = JSON.parse(fs.readFileSync('public/assets/atlas.json', 'utf8'));
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const DONORS = ['armadura', 'espantapajaros', 'maniqui', 'juguete', 'refri'];
const SLOTS = ['head', 'torso', 'arms', 'legs'];

const sheet = await sharp('public/assets/atlas.png')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const SW = sheet.info.width;

/** Alpha mask (1 = opaque) of one atlas frame. */
function mask(name) {
  const f = atlas.frames[name].frame;
  const m = new Uint8Array(f.w * f.h);
  const lum = new Uint8Array(f.w * f.h);
  for (let y = 0; y < f.h; y++)
    for (let x = 0; x < f.w; x++) {
      const i = ((f.y + y) * SW + f.x + x) * 4;
      m[y * f.w + x] = sheet.data[i + 3] > 40 ? 1 : 0;
      lum[y * f.w + x] = Math.max(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]);
    }
  return { m, lum, w: f.w, h: f.h };
}

/**
 * Box of the main body of a piece. Small blobs that float away from it (leftovers of the extraction, e.g. the belt
 * scrap at the top of the armour legs) are ignored: the view crops the frame to this box so they are never drawn.
 */
function bboxOf({ m, w, h }, name = '') {
  const seen = new Uint8Array(w * h);
  const blobs = [];
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || seen[i]) continue;
    const b = { area: 0, x0: w, y0: h, x1: -1, y1: -1 };
    const st = [i];
    seen[i] = 1;
    while (st.length) {
      const j = st.pop();
      const x = j % w,
        y = (j / w) | 0;
      b.area++;
      if (x < b.x0) b.x0 = x;
      if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y;
      if (y > b.y1) b.y1 = y;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ]) {
        const xx = x + dx,
          yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const k = yy * w + xx;
        if (m[k] && !seen[k]) {
          seen[k] = 1;
          st.push(k);
        }
      }
    }
    blobs.push(b);
  }
  const big = Math.max(...blobs.map((b) => b.area));
  const gap = (a, b) => Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1), Math.max(a.y0 - b.y1, b.y0 - a.y1));
  const keep = blobs.filter(
    (b) => b.area >= big * 0.1 || blobs.some((o) => o !== b && o.area >= big * 0.1 && gap(b, o) <= 6),
  );
  for (const b of blobs) if (!keep.includes(b)) console.log('  stray blob ignored in', name, b);
  return [
    Math.min(...keep.map((b) => b.x0)),
    Math.min(...keep.map((b) => b.y0)),
    Math.max(...keep.map((b) => b.x1)),
    Math.max(...keep.map((b) => b.y1)),
  ];
}

/** Height of the vertical opaque run that contains (x, y). */
function runAt({ m, w, h }, x, y) {
  if (!m[y * w + x]) return 0;
  let a = y,
    b = y;
  while (a > 0 && m[(a - 1) * w + x]) a--;
  while (b < h - 1 && m[(b + 1) * w + x]) b++;
  return b - a + 1;
}

/**
 * Centre of the round cap at the left (dir = 1) or right (dir = -1) end of a piece: the extreme opaque point inside the
 * given row range, moved inward by the cap radius (found where the cap stops widening).
 */
function capCenter(img, bbox, side, rowFrom, rowTo) {
  const { m, w } = img;
  const [x0, , x1] = bbox;
  let ex = side === 'left' ? w : -1;
  const hit = [];
  for (let y = rowFrom; y <= rowTo; y++)
    for (let x = 0; x < w; x++)
      if (m[y * w + x]) {
        if (side === 'left' ? x < ex : x > ex) {
          ex = x;
          hit.length = 0;
        }
        if (x === ex) hit.push(y);
        break;
      }
  if (side === 'right') {
    ex = -1;
    hit.length = 0;
    for (let y = rowFrom; y <= rowTo; y++)
      for (let x = w - 1; x >= 0; x--)
        if (m[y * w + x]) {
          if (x > ex) {
            ex = x;
            hit.length = 0;
          }
          if (x === ex) hit.push(y);
          break;
        }
  }
  const yc = Math.round(hit.reduce((a, b) => a + b, 0) / hit.length);
  const dir = side === 'left' ? 1 : -1;
  const kMax = Math.round((x1 - x0) * 0.22);
  let r = kMax;
  for (let k = 4; k <= kMax; k++) {
    const x = ex + dir * k;
    if (runAt(img, x, yc) < 2 * k * 0.95) {
      r = k;
      break;
    }
  }
  return [Math.round(ex + dir * Math.min(r, kMax)), yc];
}

/** px the bottom of the head sinks below the torso neck anchor (tuned with the neck contact sheet). */
const NECK_DEPTH = { armadura: 9, espantapajaros: 9, maniqui: 10, juguete: 10, refri: 9 };

/** Visual-only second arm (angles in degrees: 0 = right, 90 = up; see src/core/rig.ts). */
const BACK_ARM = {
  restDeg: -108,
  scale: 0.9,
  followOffsetDeg: 8,
  tint: 0.85,
  walkSwing: 0.35,
  hurtShake: 0.35,
};

/**
 * Arm size rule: the length shoulder→muzzle times armScale must be 0.9–1.1 times the torso height (154 px for every donor).
 * The art of the Armadura (cannon + pauldron) is the bulkiest, so it takes the smallest scale that still respects the rule.
 */
const ARM_SCALE = { armadura: 0.84, espantapajaros: 0.85, maniqui: 0.85, juguete: 0.83, refri: 0.83 };

const pieces = {};
for (const d of DONORS) {
  pieces[d] = {};
  for (const s of SLOTS) {
    const img = mask(`part_${d}_${s}`);
    const bb = bboxOf(img, `${d}.${s}`);
    const [x0, y0, x1, y1] = bb;
    const R = (v) => Math.round(v);
    if (s === 'head') {
      // Centre of the neck stump (last rows). Heads whose bottom is their wide body (helmet, pumpkin) use the centre of
      // that body instead: see NECK_BODY_ROWS.
      pieces[d][s] = { bbox: bb, neck: [R(detectHeadNeckX(img, bb, d)), y1], neckDepth: NECK_DEPTH[d] };
    } else if (s === 'torso') {
      const rows = [y0 + R((y1 - y0) * 0.1), y0 + R((y1 - y0) * 0.55)];
      pieces[d][s] = {
        bbox: bb,
        neck: detectTorsoNeck(img, bb).map(Math.round),
        hip: [R(detectTorsoHipX(img, bb)), y1],
        shoulderFront: capCenter(img, bb, 'right', rows[0], rows[1]),
        shoulderBack: capCenter(img, bb, 'left', rows[0], rows[1]),
      };
    } else if (s === 'arms') {
      const shoulder = capCenter(img, bb, 'left', y0, y0 + R((y1 - y0) * 0.6));
      let ty = 0,
        tc = 0;
      for (let y = y0; y <= y1; y++)
        if (img.m[y * img.w + x1]) {
          ty += y;
          tc++;
        }
      pieces[d][s] = { bbox: bb, shoulder, muzzle: [x1, R(ty / tc)], armScale: ARM_SCALE[d] };
    } else {
      // legs: two blobs; split at the emptiest column near the middle of the lower half
      const { m, w } = img;
      const occ = new Array(w).fill(0);
      for (let y = y0 + R((y1 - y0) * 0.5); y <= y1; y++) for (let x = 0; x < w; x++) occ[x] += m[y * w + x];
      const mid = (x0 + x1) / 2;
      let split = R(mid);
      for (let x = R(mid - 25); x <= R(mid + 25); x++)
        if (occ[x] < occ[split] || (occ[x] === occ[split] && Math.abs(x - mid) < Math.abs(split - mid)))
          split = x;
      const cen = (from, to) => {
        let sx = 0,
          c = 0;
        for (let y = y0; y <= y1; y++)
          for (let x = from; x < to; x++)
            if (m[y * w + x]) {
              sx += x;
              c++;
            }
        return c ? sx / c : (from + to) / 2;
      };
      const left = cen(x0, split),
        right = cen(split + 1, x1 + 1);
      // Centre between the two feet (last 20 rows): the legs' origin, aligned with the centre of the torso base.
      const feet = (from, to) => {
        let sx = 0,
          c = 0;
        for (let y = y1 - 20; y <= y1; y++)
          for (let x = from; x <= to; x++)
            if (m[y * w + x]) {
              sx += x;
              c++;
            }
        return sx / c;
      };
      const cx = R((feet(x0, split - 1) + feet(split, x1)) / 2);
      pieces[d][s] = { bbox: bb, hipTop: [cx, y0], ground: [cx, y1], hipSpacing: R(right - left), split };
    }
  }
}

const out = {
  _note:
    'Detected by scripts/rig-anchors.mjs from the atlas pixels (px inside each frame). "manual" holds hand calibrations made with ?debug=rig and wins over the detected values.',
  overlap: prev.overlap ?? { neck: 6, hip: 10 },
  manual: prev.manual ?? {},
  backArm: prev.backArm ?? BACK_ARM,
  pieces,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('rig.json written for', DONORS.join(', '));
