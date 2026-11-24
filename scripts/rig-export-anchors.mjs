// Draws every anchor of every piece over its image: docs/capturas/rig/anclajes/<donor>_<slot>.png (3x, nearest).
// Usage: node scripts/rig-export-anchors.mjs   (reads src/data/rig.json with the manual calibrations applied)
import sharp from 'sharp';
import fs from 'node:fs';

const OUT = 'docs/capturas/rig/anclajes';
fs.mkdirSync(OUT, { recursive: true });
const atlas = JSON.parse(fs.readFileSync('public/assets/atlas.json', 'utf8'));
const rig = JSON.parse(fs.readFileSync('src/data/rig.json', 'utf8'));
for (const [key, pt] of Object.entries(rig.manual ?? {})) {
  const [d, s, a] = key.split('.');
  rig.pieces[d][s][a] = pt;
}
const COLORS = {
  neck: '#ff9a4d',
  hip: '#ffe14d',
  hipTop: '#ffe14d',
  ground: '#ffffff',
  shoulderFront: '#ff5468',
  shoulderBack: '#7fa0ff',
  shoulder: '#ff5468',
  muzzle: '#7cff4f',
};
const Z = 3;
for (const [donor, slots] of Object.entries(rig.pieces)) {
  for (const [slot, data] of Object.entries(slots)) {
    const f = atlas.frames[`part_${donor}_${slot}`].frame;
    const base = await sharp('public/assets/atlas.png')
      .extract({ left: f.x, top: f.y, width: f.w, height: f.h })
      .resize(f.w * Z, f.h * Z, { kernel: 'nearest' })
      .png()
      .toBuffer();
    let svg = `<svg width="${f.w * Z}" height="${f.h * Z}" xmlns="http://www.w3.org/2000/svg">`;
    for (let x = 0; x <= f.w; x += 10)
      svg += `<line x1="${x * Z}" y1="0" x2="${x * Z}" y2="${f.h * Z}" stroke="#fff" stroke-opacity="${x % 50 === 0 ? 0.35 : 0.1}"/>`;
    for (let y = 0; y <= f.h; y += 10)
      svg += `<line x1="0" y1="${y * Z}" x2="${f.w * Z}" y2="${y * Z}" stroke="#fff" stroke-opacity="${y % 50 === 0 ? 0.35 : 0.1}"/>`;
    const [x0, y0, x1, y1] = data.bbox;
    svg += `<rect x="${x0 * Z}" y="${y0 * Z}" width="${(x1 - x0 + 1) * Z}" height="${(y1 - y0 + 1) * Z}" fill="none" stroke="#7cff4f" stroke-opacity="0.6"/>`;
    for (const [k, p] of Object.entries(data)) {
      if (!Array.isArray(p) || k === 'bbox') continue;
      const c = COLORS[k] ?? '#fff';
      svg += `<circle cx="${p[0] * Z}" cy="${p[1] * Z}" r="7" fill="${c}" stroke="#0f0e15" stroke-width="2"/><text x="${p[0] * Z + 10}" y="${p[1] * Z + 5}" font-size="16" font-family="sans-serif" fill="${c}" stroke="#0f0e15" stroke-width="0.6">${k} ${p[0]},${p[1]}</text>`;
    }
    svg += '</svg>';
    await sharp({ create: { width: f.w * Z, height: f.h * Z, channels: 4, background: '#2e2a47' } })
      .composite([{ input: base }, { input: Buffer.from(svg) }])
      .png()
      .toFile(`${OUT}/${donor}_${slot}.png`);
  }
}
console.log('anchors exported to', OUT);
