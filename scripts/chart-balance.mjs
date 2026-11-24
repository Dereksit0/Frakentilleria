import { writeFileSync } from 'node:fs';

/**
 * Draws docs/balance-resumen.svg: one small panel per metric (experto vs experto, 300 partidas) across the phases,
 * with the target drawn as a line or band. The numbers come from docs/BALANCE_BASE.md ... BALANCE_FASE4.md.
 * Run: node scripts/chart-balance.mjs
 */
const phases = ['Base', 'F1', 'F2A', 'F3', 'F4'];
const panels = [
  { title: 'Gana quien pega primero (%)', values: [69.3, 62.1, 50.0, 52.7, 53.7], max: 80, target: { type: 'max', at: 60, label: 'meta ≤ 60' } },
  { title: 'Remontadas (%)', values: [3.7, 6.0, 10.7, 13.0, 12.7], max: 24, target: { type: 'min', at: 20, label: 'meta ≥ 20' } },
  { title: 'Rondas medias', values: [7.1, 10.5, 10.0, 9.6, 9.8], max: 20, target: { type: 'band', from: 10, to: 16, label: 'meta 10 a 16' } },
  { title: 'Daño del arma líder (%)', values: [51.4, 55.7, 30.1, 31.1, 30.5], max: 80, target: { type: 'max', at: 35, label: 'meta ≤ 35' } },
];

const PW = 380;
const PH = 250;
const GAP = 24;
const W = PW * 2 + GAP * 3;
const H = PH * 2 + GAP * 3 + 40;
const css = `
  .bg { fill:#ffffff } .bar { fill:#5b3fa0 } .last { fill:#e2762d } .ok-fill { fill:#2e8b57 } .ok-line { stroke:#2e8b57 } .grid { stroke:#e4e0ee }
  text { font-family: system-ui, sans-serif; fill:#1f1b2e } .muted { fill:#6b6580 } text.ok { fill:#2e8b57 }
  @media (prefers-color-scheme: dark) {
    .bg { fill:#16131f } .bar { fill:#9d84e0 } .last { fill:#ffb067 } .ok-fill { fill:#6fd49a } .ok-line { stroke:#6fd49a } .grid { stroke:#2e2a47 }
    text { fill:#f1edf8 } .muted { fill:#a49cbb } text.ok { fill:#6fd49a }
  }
`;

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Métricas de jugabilidad por fase frente a las metas">
<style>${css}</style>
<rect class="bg" width="${W}" height="${H}"/>
<text x="${GAP}" y="28" font-size="18" font-weight="700">Jugabilidad por fase (experto vs experto, 300 partidas)</text>
`;

panels.forEach((p, i) => {
  const ox = GAP + (i % 2) * (PW + GAP);
  const oy = 40 + GAP + Math.floor(i / 2) * (PH + GAP);
  const left = 44;
  const top = 34;
  const w = PW - left - 12;
  const h = PH - top - 40;
  const y = (v) => oy + top + h - (v / p.max) * h;
  svg += `<g>\n<text x="${ox}" y="${oy + 16}" font-size="14" font-weight="600">${p.title}</text>\n`;
  for (let t = 0; t <= 4; t++) {
    const v = (p.max / 4) * t;
    svg += `<line x1="${ox + left}" x2="${ox + left + w}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`;
    svg += `<text class="muted" x="${ox + left - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end">${Math.round(v)}</text>\n`;
  }
  if (p.target.type === 'band') {
    svg += `<rect x="${ox + left}" y="${y(p.target.to)}" width="${w}" height="${y(p.target.from) - y(p.target.to)}" class="ok-fill" opacity="0.14"/>`;
  } else {
    svg += `<line x1="${ox + left}" x2="${ox + left + w}" y1="${y(p.target.at)}" y2="${y(p.target.at)}" class="ok-line" stroke-width="2" stroke-dasharray="6 4"/>`;
  }
  svg += `<text x="${ox + left + w}" y="${oy + 16}" font-size="11" text-anchor="end" class="ok">${p.target.label}</text>\n`;
  const bw = w / p.values.length;
  p.values.forEach((v, k) => {
    const x = ox + left + k * bw + bw * 0.15;
    const last = k === p.values.length - 1;
    svg += `<rect x="${x}" y="${y(v)}" width="${bw * 0.7}" height="${oy + top + h - y(v)}" rx="3" class="${last ? 'last' : 'bar'}"/>`;
    svg += `<text x="${x + bw * 0.35}" y="${y(v) - 5}" font-size="11" text-anchor="middle">${v}</text>`;
    svg += `<text class="muted" x="${x + bw * 0.35}" y="${oy + top + h + 16}" font-size="11" text-anchor="middle">${phases[k]}</text>\n`;
  });
  svg += '</g>\n';
});
svg += '</svg>\n';
writeFileSync('docs/balance-resumen.svg', svg);
console.log('docs/balance-resumen.svg');
