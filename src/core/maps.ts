import { Rng } from './rng';
import { Terrain } from './terrain';

/** Pure map logic: schema validation, parallax maths, terrain building and seeded selection. No rendering. */

export type ArtStatus = 'final' | 'placeholder';
export const ART_STATUSES: readonly ArtStatus[] = ['final', 'placeholder'];

export interface LayerDef {
  id: string;
  kind: 'image' | 'gradient';
  src?: string;
  stops?: [number, string][];
  /** Phaser scrollFactor convention: 0 = fixed to the screen, 1 = glued to the world. */
  parallax: number;
  depth: number;
  anchor: 'fill' | 'bottom' | 'top';
  /** 'placeholder' = provisional art that will be swapped by changing files/data only. */
  status: ArtStatus;
  note?: string;
}
export interface TerrainDef {
  kind: 'image' | 'procedural';
  src?: string;
  depth: number;
  seed?: number;
  base?: number;
  amp?: number;
  colors?: { lip: string; body: string; outline: string };
  status: ArtStatus;
  note?: string;
}
export interface MapDef {
  id: string;
  name: string;
  layers: LayerDef[];
  terrain: TerrainDef;
  groundY: number;
  liquid: { kind: 'acid'; startY: number };
  spawns: [number, number];
  wind: { min: number; max: number; bias: number };
  todo?: string[];
}
export interface WorldDef {
  width: number;
  height: number;
  maxPan: number;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Returns a list of human readable schema problems (empty = valid). */
export function validateMap(m: MapDef, world: WorldDef): string[] {
  const e: string[] = [];
  const at = (msg: string) => e.push(`${m.id || '?'}: ${msg}`);
  if (!m.id || !/^[a-z0-9-]+$/.test(m.id)) at('id must be lowercase slug');
  if (!m.name) at('missing name');
  if (!Array.isArray(m.layers) || m.layers.length === 0) at('needs at least one layer');
  const ids = new Set<string>();
  const depths = new Set<number>();
  for (const l of m.layers ?? []) {
    if (ids.has(l.id)) at(`duplicate layer id ${l.id}`);
    ids.add(l.id);
    if (depths.has(l.depth)) at(`duplicate depth ${l.depth}`);
    depths.add(l.depth);
    if (!ART_STATUSES.includes(l.status)) at(`layer ${l.id}: status must be final | placeholder`);
    if (!(l.parallax >= 0 && l.parallax <= 1)) at(`layer ${l.id}: parallax must be 0..1`);
    if (l.kind === 'image' && !l.src) at(`layer ${l.id}: image layer needs src`);
    if (
      l.kind === 'gradient' &&
      (!l.stops || l.stops.length < 2 || l.stops.some(([o, c]) => o < 0 || o > 1 || !HEX.test(c)))
    )
      at(`layer ${l.id}: gradient needs >=2 stops [0..1, #RRGGBB]`);
  }
  // Parallax must not decrease toward the camera: farther layers move less.
  const sorted = [...(m.layers ?? [])].sort((a, b) => a.depth - b.depth);
  for (let i = 1; i < sorted.length; i++)
    if (sorted[i].parallax < sorted[i - 1].parallax)
      at(`layer ${sorted[i].id}: parallax must not be lower than the layer behind it`);
  const t = m.terrain;
  if (!t) at('missing terrain');
  else {
    if (!ART_STATUSES.includes(t.status)) at('terrain status must be final | placeholder');
    if (t.kind === 'image' && !t.src) at('image terrain needs src');
    if (t.kind === 'procedural') {
      if (![t.seed, t.base, t.amp].every((v) => typeof v === 'number'))
        at('procedural terrain needs seed, base, amp');
      if (!t.colors || ![t.colors.lip, t.colors.body, t.colors.outline].every((c) => HEX.test(c)))
        at('procedural terrain needs lip/body/outline colours');
    }
    if (m.layers?.some((l) => l.depth >= t.depth)) at('terrain depth must be above every background layer');
  }
  if (!(m.groundY > 0 && m.groundY < world.height)) at('groundY out of world');
  if (!(m.liquid && m.liquid.startY > m.groundY && m.liquid.startY <= world.height))
    at('liquid.startY must lie between groundY and world bottom');
  if (!Array.isArray(m.spawns) || m.spawns.length !== 2) at('needs two spawns');
  else {
    const [a, b] = m.spawns;
    if (!(a >= 0 && b <= world.width && a < b)) at('spawns must be ordered and inside the world');
    if (b - a < world.width / 4) at('spawns too close together');
  }
  if (
    !m.wind ||
    !(m.wind.min >= -5 && m.wind.max <= 5 && m.wind.min <= m.wind.bias && m.wind.bias <= m.wind.max)
  )
    at('wind must stay within -5..5 and contain bias');
  return e;
}

/** Destination rectangle of a background layer for a given camera pan (px, within ±world.maxPan). */
export function layerRect(
  layer: LayerDef,
  world: WorldDef,
  camX: number,
): { x: number; y: number; w: number; h: number; scale: number } {
  const pan = Math.max(-world.maxPan, Math.min(world.maxPan, camX));
  // Oversize the layer just enough that its edges never show while the camera pans.
  const extra = 2 * layer.parallax * world.maxPan;
  const scale = (world.width + extra) / world.width;
  const w = world.width * scale;
  const h = world.height * scale;
  const x = -extra / 2 - pan * layer.parallax;
  const y = layer.anchor === 'top' ? 0 : world.height - h; // fill & bottom: keep the bottom edge on the world floor
  return { x, y, w, h, scale };
}

/** Places a source alpha image bottom-anchored inside the world and returns a 1-byte-per-pixel solid mask. */
export function placeMask(
  alpha: ArrayLike<number>,
  sw: number,
  sh: number,
  world: WorldDef,
  threshold = 128,
): Uint8Array {
  const mask = new Uint8Array(world.width * world.height);
  const y0 = world.height - sh;
  for (let y = 0; y < sh; y++) {
    const wy = y0 + y;
    if (wy < 0 || wy >= world.height) continue;
    for (let x = 0; x < Math.min(sw, world.width); x++)
      if (alpha[y * sw + x] >= threshold) mask[wy * world.width + x] = 1;
  }
  return mask;
}

/** Builds the destructible terrain: from the decoded terrain art alpha, or procedurally when the map says so. */
export function buildTerrain(
  m: MapDef,
  world: WorldDef,
  art?: { alpha: ArrayLike<number>; w: number; h: number },
): Terrain {
  const t = m.terrain;
  if (t.kind === 'procedural')
    return Terrain.procedural(world.width, world.height, t.seed as number, t.base as number, t.amp as number);
  if (!art) throw new Error(`map ${m.id}: image terrain needs decoded art`);
  return Terrain.fromMask(world.width, world.height, placeMask(art.alpha, art.w, art.h, world));
}

/** Seeded map pick used when no selector choice exists. Same seed => same map. */
export function pickMapId(seed: number, ids: readonly string[]): string {
  if (ids.length === 0) throw new Error('no maps available');
  return ids[Math.floor(new Rng(seed).next() * ids.length)];
}

/** Y of the terrain surface at column x (first solid pixel from the top), or -1 when the column is empty. */
export function surfaceY(t: Terrain, x: number): number {
  for (let y = 0; y < t.height; y++) if (t.isSolid(x, y)) return y;
  return -1;
}
