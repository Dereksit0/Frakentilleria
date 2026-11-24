import type Phaser from 'phaser';

export type AtlasKey = 'atlas' | 'atlas-icons' | 'atlas-fx' | 'atlas-badges' | 'atlas-ui' | 'atlas-items';

// El prefijo del frame dice en qué atlas está. Lo demás (part_*, wicon_*, fx_*, item_*) va en el principal.
const PREFIXES: [string, AtlasKey][] = [
  ['icon-', 'atlas-icons'],
  ['badge-', 'atlas-badges'],
  ['hud-', 'atlas-ui'],
  ['ui-', 'atlas-ui'],
  ['ach-', 'atlas-ui'],
  ['fx-', 'atlas-fx'],
  ['ev-', 'atlas-fx'],
  ['crate-', 'atlas-items'],
  ['chest-', 'atlas-items'],
  ['hat-', 'atlas-items'],
  ['patch-', 'atlas-items'],
  ['grave-', 'atlas-items'],
  ['part-', 'atlas-items'],
];

export function atlasOf(frame: string): AtlasKey {
  return PREFIXES.find(([prefix]) => frame.startsWith(prefix))?.[1] ?? 'atlas';
}

/** Par [textura, frame] para `scene.add.image(x, y, ...atlasRef(frame))`. */
export function atlasRef(frame: string): [AtlasKey, string] {
  return [atlasOf(frame), frame];
}

/** Cambia el frame de una imagen (de cualquier atlas) y la escala a `px` de ancho. */
export function setIconFrame(img: Phaser.GameObjects.Image, frame: string, px: number): void {
  img.setTexture(atlasOf(frame), frame);
  img.setScale(px / img.width);
}

// Las piezas sueltas y el fantasma solo se ven en combate: el atlas se carga al empezar la partida.
export function loadItemsAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists('atlas-items')) return;
  scene.load.setPath('assets/');
  scene.load.atlas('atlas-items', 'atlas-items.webp', 'atlas-items.json');
}
