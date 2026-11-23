# Contrato Sesión A → Sesión B (UI/escenas)

Lo que la UI puede dar por hecho del lado de assets, mapas y datos. Si algo de esto cambia, la Sesión A actualiza este archivo y `tests/maps.test.ts`.

## 1. Ids de mapa (orden de `MAPS`)

| id           | Nombre en pantalla   | Capas (depth · parallax)                       | Terreno                            |
| ------------ | -------------------- | ---------------------------------------------- | ---------------------------------- |
| `vertedero`  | Vertedero            | `sky` 0 · 0.0, `far` 10 · 0.15, `mid` 20 · 0.4 | imagen, depth 30                   |
| `cementerio` | Cementerio embrujado | `sky` (degradado) 0 · 0.0, `far` 10 · 0.15     | imagen, depth 30                   |
| `fabrica`    | Fábrica de juguetes  | `bg` 0 · 0.0 (placeholder)                     | procedural, depth 30 (placeholder) |

Siempre se importa `MAPS` y `WORLD` de `src/core/data.ts`; no hay que hardcodear ids. `WORLD = { width: 1600, height: 900, maxPan: 120 }`.

## 2. Rutas exactas (`public/assets/`, relativas a `assets/` con `load.setPath('assets/')`)

- Capas y terreno: **las que dice `maps.json`** (`layer.src`, `terrain.src`). Hoy:
  `maps/vertedero-sky.webp`, `maps/vertedero-far.webp`, `maps/vertedero-mid.webp`, `maps/vertedero-terrain.png`,
  `maps/cementerio-far.webp`, `maps/cementerio-terrain.png`, `maps/fabrica-bg.webp`.
- Marca: `logo.png` (1000 px de ancho, transparente), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180), `favicon.ico`, `favicon-32.png`, `og-image.jpg` (1200×630).
- Pantallas: `screens/menu-bg-laboratorio.webp`, `screens/splashscreen.webp`, `screens/portada-key-art.webp`.
- Atlas: `atlas.png` + `atlas.json`. Música: `audio/music-1.mp3`.

Todo se regenera con `npm run assets` desde `assets/raw` (nunca editar `public/assets` a mano).

## 3. Cargar capas y parallax desde `maps.json`

- Claves de textura (las que ya usa `Boot.ts`): `layer:<mapId>:<layerId>` y `terrain:<mapId>`.
- Capas `kind: 'gradient'` no tienen archivo: se dibujan por código con `stops` (`[offset 0..1, '#RRGGBB'][]`) en un canvas de textura (clave sugerida `grad:<mapId>:<layerId>`).
- Orden de dibujo: `depth` ascendente; las unidades van por encima del terreno (`terrain.depth` = 30).
- `parallax` usa la convención `scrollFactor` de Phaser: 0 = fijo a pantalla, 1 = pegado al mundo.
- Posición/tamaño de cada capa para una cámara con desplazamiento `camX` (px, se limita a ±`WORLD.maxPan`): `layerRect(layer, WORLD, camX)` → `{ x, y, w, h, scale }`. Ya sobredimensiona la capa para que nunca se vean bordes. Llamarla cada frame y aplicar `setPosition(x, y).setDisplaySize(w, h)` (origen 0,0).
- Si una imagen no carga, la UI debe degradar (el core no falla): `status: 'placeholder'` marca arte provisional.

## 4. Terreno destructible

`buildTerrain(map, WORLD, art?)` devuelve un `Terrain` de 1600×900:

- `terrain.kind === 'procedural'` → no necesita `art`; los colores para dibujarlo están en `terrain.colors` (`lip`, `body`, `outline`).
- `terrain.kind === 'image'` → pasar `art = { alpha, w, h }` con el plano alfa (1 byte por píxel) de la textura `terrain:<id>` (se obtiene con un canvas 2D y `getImageData`). El arte va anclado al piso del mundo; para dibujarlo: `y = WORLD.height - alto de la textura`, `x = 0`.
- Los datos de la partida salen del mapa: `map.spawns` (`[xJ1, xJ2]`), `map.groundY`, `map.liquid.startY` (nivel inicial del ácido; hoy 900 en los tres), `map.wind` (`min`, `max`, `bias`; `bias` es TODO = 0).

## 5. Elegir mapa

`pickMapId(seed, ids)` → id (misma semilla = mismo mapa). Selector manual: usar cualquier id de `MAPS`. Ya está cableado en `src/ui/session.ts`.

## 6. Ejemplo mínimo (escena Phaser)

```ts
import Phaser from 'phaser';
import { MAPS, WORLD } from '../core/data';
import { buildTerrain, layerRect } from '../core/maps';

export class MapDemo extends Phaser.Scene {
  private layers: { img: Phaser.GameObjects.Image; def: (typeof MAPS)[number]['layers'][number] }[] = [];

  create(): void {
    const map = MAPS.find((m) => m.id === 'cementerio') ?? MAPS[0];
    for (const def of [...map.layers].sort((a, b) => a.depth - b.depth)) {
      if (def.kind !== 'image') continue; // gradient layers: draw a canvas texture from def.stops
      const img = this.add.image(0, 0, `layer:${map.id}:${def.id}`).setOrigin(0, 0).setDepth(def.depth);
      this.layers.push({ img, def });
    }
    // Terrain: decode the alpha plane for image terrains.
    let art: { alpha: Uint8Array; w: number; h: number } | undefined;
    if (map.terrain.kind === 'image') {
      const src = this.textures.get(`terrain:${map.id}`).getSourceImage() as HTMLImageElement;
      const c = document.createElement('canvas');
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(src, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      const alpha = new Uint8Array(c.width * c.height);
      for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4 + 3];
      art = { alpha, w: c.width, h: c.height };
    }
    const terrain = buildTerrain(map, WORLD, art);
    void terrain; // hand it to the Battle core with { spawns: map.spawns }
  }

  update(): void {
    const camX = (this.input.activePointer.x / this.scale.width - 0.5) * 2 * WORLD.maxPan; // demo pan
    for (const { img, def } of this.layers) {
      const r = layerRect(def, WORLD, camX);
      img.setPosition(r.x, r.y).setDisplaySize(r.w, r.h);
    }
  }
}
```

## 7. Meta de `index.html` (Open Graph / PWA)

Recursos listos: `assets/og-image.jpg` (1200×630), `assets/favicon.ico`, `assets/favicon-32.png`, `assets/apple-touch-icon.png`, `assets/icon-192.png`, `assets/icon-512.png`, `assets/icon-maskable-512.png` (usar `"purpose": "maskable"` en el manifest). Colores: `theme_color` Noche `#2E2A47`. `index.html` es de la Sesión B; la Sesión A solo pide estos `<meta>`/`<link>` si aún no están.
