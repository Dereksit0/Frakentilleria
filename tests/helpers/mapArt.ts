import sharp from 'sharp';
import { MAPS } from '../../src/core/data';

export interface MapArt {
  alpha: Uint8Array;
  w: number;
  h: number;
}

/** Decodes every shipped image terrain into its alpha plane (what the scene does with a canvas). */
export async function loadMapArts(): Promise<Record<string, MapArt>> {
  const arts: Record<string, MapArt> = {};
  for (const m of MAPS) {
    if (m.terrain.kind !== 'image') continue;
    const { data, info } = await sharp(`public/assets/${m.terrain.src}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alpha = new Uint8Array(info.width * info.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
    arts[m.id] = { alpha, w: info.width, h: info.height };
  }
  return arts;
}
