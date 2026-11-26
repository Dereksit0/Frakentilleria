import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, COSMETICS } from '../src/core/rewards';

function frames(name: string): Set<string> {
  const j = JSON.parse(fs.readFileSync(`public/assets/${name}.json`, 'utf8')) as {
    frames?: Record<string, unknown> | { filename: string }[];
    textures?: { frames: { filename: string }[] }[];
  };
  const f = j.frames ?? j.textures?.flatMap((t) => t.frames) ?? [];
  return new Set(Array.isArray(f) ? f.map((x) => x.filename) : Object.keys(f));
}

describe('colección: cada tarjeta muestra arte real o un candado, nunca una figura de relleno', () => {
  it('cada logro apunta a una insignia que existe en el atlas de interfaz, y hay insignia de bloqueado', () => {
    const ui = frames('atlas-ui');
    for (const a of ACHIEVEMENTS) expect(ui.has(a.art), `${a.id} → ${a.art}`).toBe(true);
    expect(ui.has('ach-locked')).toBe(true);
    expect(ui.has('ui-lock')).toBe(true);
  });

  it('el arte declarado de cada cosmético existe en el atlas de objetos', () => {
    const items = frames('atlas-items');
    const withArt = COSMETICS.items.filter((c) => c.art);
    expect(withArt.length).toBeGreaterThan(0);
    for (const c of withArt) expect(items.has(c.art!), `${c.id} → ${c.art}`).toBe(true);
  });

  it('los colores no necesitan arte: su vista previa es el propio color', () => {
    for (const c of COSMETICS.items.filter((i) => i.kind === 'color'))
      expect(c.color, c.id).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
