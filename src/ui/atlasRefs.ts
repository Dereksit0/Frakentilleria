import type Phaser from 'phaser';

/** Atlas texture keys (loaded in Boot). Frame ids decide which atlas they live in. */
export type AtlasKey = 'atlas' | 'atlas-icons' | 'atlas-fx' | 'atlas-badges';

/** icon-* -> atlas-icons, fx-* -> atlas-fx, badge-* -> atlas-badges; everything else (part_*, wicon_*, fx_*, item_*) -> atlas. */
export function atlasOf(frame: string): AtlasKey {
  if (frame.startsWith('icon-')) return 'atlas-icons';
  if (frame.startsWith('fx-')) return 'atlas-fx';
  if (frame.startsWith('badge-')) return 'atlas-badges';
  return 'atlas';
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
