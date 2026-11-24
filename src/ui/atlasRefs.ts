import type Phaser from 'phaser';

/** Atlas texture keys. `atlas-objects` and `atlas-items` are lazy (see `loadLazyAtlases`). */
export type AtlasKey =
  'atlas' | 'atlas-icons' | 'atlas-fx' | 'atlas-badges' | 'atlas-ui' | 'atlas-objects' | 'atlas-items';

/** Frame-id prefix -> atlas. Anything else (part_*, wicon_*, fx_*, item_*) lives in the main atlas. */
const PREFIXES: [string, AtlasKey][] = [
  ['icon-', 'atlas-icons'],
  ['badge-', 'atlas-badges'],
  ['hud-', 'atlas-ui'],
  ['ui-', 'atlas-ui'],
  ['ach-', 'atlas-ui'],
  ['fx-', 'atlas-fx'],
  ['ev-', 'atlas-fx'],
  ['obj-', 'atlas-objects'],
  ['crate-', 'atlas-items'],
  ['chest-', 'atlas-items'],
  ['hat-', 'atlas-items'],
  ['patch-', 'atlas-items'],
  ['grave-', 'atlas-items'],
  ['part-', 'atlas-items'],
];

export function atlasOf(frame: string): AtlasKey {
  return PREFIXES.find(([p]) => frame.startsWith(p))?.[1] ?? 'atlas';
}

/** [texture key, frame] pair to spread into `scene.add.image(x, y, ...atlasRef(frame))`. */
export function atlasRef(frame: string): [AtlasKey, string] {
  return [atlasOf(frame), frame];
}

/** Swaps an image to `frame` (any atlas) and scales it so its width is `px` logical pixels. */
export function setIconFrame(img: Phaser.GameObjects.Image, frame: string, px: number): void {
  img.setTexture(atlasOf(frame), frame);
  img.setScale(px / img.width);
}

/** Loaded on demand, when a scene needs them (combat start, collection screen, debug gallery). */
export const LAZY_ATLASES: { key: AtlasKey; image: string; json: string }[] = [
  { key: 'atlas-objects', image: 'atlas-objects.webp', json: 'atlas-objects.json' },
  { key: 'atlas-items', image: 'atlas-items.webp', json: 'atlas-items.json' },
];

/** Queues the lazy atlases that are not loaded yet. Call from a scene's `preload()`. */
export function loadLazyAtlases(scene: Phaser.Scene): void {
  scene.load.setPath('assets/');
  for (const a of LAZY_ATLASES) if (!scene.textures.exists(a.key)) scene.load.atlas(a.key, a.image, a.json);
}
