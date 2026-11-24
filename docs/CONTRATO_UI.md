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
## 10. HUD, interfaz, ácido, dolor y burla, obstáculos, eventos, cajas, cosméticos y piezas (segunda entrega)

Atlas nuevos (mismo sistema que §9; `atlasRef(id)` elige el atlas por prefijo): `atlas-ui` (hud-, ui-, ach-; botones cuadrados de 104 px y @2x de 208; logros 96 / 192), `atlas-fx` (fx-, ev-), `atlas-objects` (obj-) y `atlas-items` (crate-, chest-, hat-, patch-, grave-, part-). Boot carga `atlas-ui`, `atlas-fx` y las dos teselas de ácido; `atlas-objects` y `atlas-items` se cargan en `Battle.preload` (`loadLazyAtlases`) y en la galería. Los botones cuadrados con icono usan `new Button(..., { icon: 'hud-pause' })` (icono completo) o `{ leftIcon: 'ui-home' }` (icono pequeño a la izquierda de la etiqueta).

Ácido: `public/assets/acid-surface.webp` (2048×238, cresta + burbujas, espejo para que ambos bordes coincidan) y `acid-body.webp` (2048×256, relleno opaco repetible en x e y) son archivos sueltos para `TileSprite` (`src/ui/acidLayer.ts`). El cuerpo se coloca justo bajo la superficie con `tilePositionY = 128` y el mismo `tilePositionX`. `?debug=acid` salta a la ronda 8 con la tormenta.

| Id(s) | Archivo (original) | Uso |
|---|---|---|
| hud-pause, ui-help | ui/hud.png, ui/ui-extra.png | **Conectados**: botones de pausa y ayuda del HUD |
| hud-settings, ui-home | ui/hud.png, ui/ui-extra.png | **Conectados**: botón Ajustes y Salir al menú de Pausa, Menú de Resumen |
| ui-rematch | ui/ui-extra.png | **Conectado**: botón Revancha de Resumen |
| hud-heart, hud-wind, hud-clock, hud-sound, hud-back, hud-ammo, hud-skull | ui/hud.png | Registrados: el HUD actual dibuja corazón, viento y reloj por código dentro del panel de equipo (otra sesión); sustituir cuando ese panel se estabilice. hud-back en Atrás, hud-sound / ui-muted en Ajustes, hud-ammo en el selector de armas, hud-skull con vida baja |
| ui-trophy, ui-star, ui-lock, ui-check, ui-close | ui/ui-extra.png | Registrados: Resumen (copa y estrella), elementos bloqueados, modales de confirmación (check / close) |
| ach-* (9) | ui/logros.png | Registrados: pantalla de logros / Colección (ach-locked para los pendientes) |
| fx-acid-streaks, fx-acid-splash-crown | fx/acido-elementos.png | **Conectados**: lluvia ácida (tope de 10) y corona de salpicadura (al caer una criatura al ácido) |
| ui-warning-acid, ui-acid-rising-arrow | fx/acido-elementos.png | **Conectados**: aviso de la ronda previa al ácido |
| fx-acid-drop, fx-acid-bubble | fx/acido-elementos.png | Registrados: gotas de la tormenta y burbujas del ácido |
| fx-hit-puff, fx-impact-spark, fx-dizzy-stars, fx-sweat-drops, fx-bubble-shout | fx/dolor-burla.png | **Conectados**: estado hurt (golpe fuerte: estrellas, sudor y "¡Eso dolió!") con tope de 12 efectos |
| fx-laugh-marks, fx-bubble-speech | fx/dolor-burla.png | **Conectados**: estado taunt ("¡Tomaaa!" tras un golpe, "¡Jajaja!" con el botón Burlar). Texto del juego, 32 px, tinta sobre crema |
| fx-anger-mark, fx-exclamation | fx/dolor-burla.png | Registrados (enojo, alerta) |
| grave-ghost, part-* | items/tumba-piezas.png | **Conectados**: estado defeat (fantasma que sube y dos piezas según la cabeza, tabla en `src/data/defeatParts.json`) |
| grave-tombstone, grave-tombstone-broken | items/tumba-piezas.png | Registrados: lápida tras la derrota (hoy la criatura queda en gris) |
| crate-utility, crate-weapon | items/cajas-nuevas.png | Registrados: las cajas actuales usan item_mystery (caja misteriosa hasta recogerse) |
| crate-mimic-closed / open, fx-parachute, fx-signal-flare | items/cajas-nuevas.png | Registrados para la Fase 4 (cajas trampa y lanzamiento con paracaídas) |
| chest-closed / open, hat-*, patch-*, fx-confetti | items/cosmeticos.png | Registrados con anclas; datos de colocación en `src/data/cosmeticRig.json` (hatAnchor, hatScale, headTop, hatOffset, hatMode, patchSlot, patchScale). Se conectarán a la Colección cuando dibuje cosméticos sobre la criatura |
| obj-* (18) | objects/obstaculos-comunes.png, obstaculos-mapas.png | Registrados como ids disponibles; no se colocan en los mapas |
| ev-* (9) | fx/eventos.png | Registrados como ids disponibles; no hay eventos de ronda todavía |

## 9. Íconos de armas, sprites de combate e insignias (tres atlas WebP)

Se cargan en `Boot` (claves `atlas-icons`, `atlas-fx`, `atlas-badges`). `src/ui/atlasRefs.ts` elige el atlas por prefijo: `atlasRef(id)` devuelve `[clave, id]` para `scene.add.image(x, y, ...atlasRef(id))`. Cada frame lleva `pivot` (anclaje normalizado, Phaser lo usa como origen) y `anchorPx` (píxeles). Íconos: 128 px (`icon-x`) y 256 px (`icon-x@2x`); insignias: 64 px (`badge-x`) y 128 px (`badge-x@2x`); sprites: tamaño lógico 1:1. Vista de revisión: `/?debug=assets`.

| Id | Archivo (original) | Uso |
|---|---|---|
| icon-mazo-de-justa | weapons/iconos-armas-2.png | **Conectado**: Mazo (Laboratorio, selector de armas) |
| icon-rafaga-de-hielo | weapons/iconos-armas-2.png | **Conectado**: Ráfaga de hielo |
| icon-granada-de-calabaza | weapons/iconos-armas-2.png | **Conectado**: Granada de calabaza |
| icon-mina, icon-dinamita, icon-ataque-aereo | weapons/iconos-armas-2.png | Registrados (`weapons.json → plannedIcons`); sin arma aún |
| icon-taladro, icon-senuelo, icon-gancho, icon-cuervos, icon-escudo-reflector | weapons/iconos-armas-3.png | Registrados (`plannedIcons`); sin arma aún (el escudo del juego es una habilidad sin ícono propio) |
| fx-granada-calabaza | fx/efectos-armas-1.png | **Conectado**: proyectil de la granada |
| fx-hielo-proyectil, fx-hielo-explosion | fx/efectos-armas-1.png | **Conectados**: proyectil y explosión de la Ráfaga de hielo |
| fx-rayo-arco, fx-rayo-impacto | fx/efectos-armas-1.png | **Conectados**: disparo del Rayo Tesla (arco estirado del cañón al impacto) |
| fx-acido-charco | fx/efectos-armas-1.png | Pendiente: el núcleo ya emite el evento `puddle` pero `Battle` aún no lo dibuja; usar centro-abajo en (x, y) del evento |
| fx-mina-armada, fx-dinamita-encendida, fx-misil-ataque-aereo, fx-marcador-ataque-aereo | fx/efectos-armas-1/2.png | Registrados, para las fases de jugabilidad |
| fx-senuelo, fx-gancho-cabeza, fx-cuervo-1/2/3, fx-mazo-onda, fx-burbuja-escudo, fx-tierra-salpicadura | fx/efectos-armas-2.png | Registrados. Los 3 cuervos comparten lienzo y anclaje (centro del cuerpo): animar alternando frames sin reposicionar. La burbuja se puede dibujar con alfa ≈ 0.5 |
| badge-congelado, badge-escudo | ui/emblemas-estados-eventos.png | **Conectados**: junto a la barra de vida en combate (`Battle.syncBadges`) |
| badge-acido, badge-aturdido | ui/emblemas-estados-eventos.png | Pendientes: se mostrarán junto a la barra cuando el núcleo exponga el estado (slot en `syncBadges`) |
| badge-tormenta, badge-meteoritos, badge-gravedad-baja, badge-luna-llena, badge-viento | ui/emblemas-estados-eventos.png | Pendientes: banner de eventos de ronda (aún no existe) |

## 8. Mundo vivo (peligros y eventos)

- `terrain.hazards` (puesto por `buildTerrain` desde `maps.json → hazards`) lo lee el `World` del combate (`core.world`). Muros, chatarra y puentes se **estampan en el terreno** al crear el `Battle`: hay que pintarlos después de crearlo (ver `paintStamps` en `src/ui/worldView.ts`).
- Estado para dibujar: `world.barrels`, `world.balls`, `world.fog`, `world.active`/`pending`, `core.puddles`; hazards estáticos (portal, resorte, cinta, ventilador) salen de `terrain.hazards`.
- Eventos del core nuevos: `event-warn` (id, round, xs de meteoritos), `event-start`, `event-end`, `lightning`, `hazard-warn`, `hazard-fire`, `puddle`. Explosiones con `weapon` `barril` y `meteoro`.
- Todo lo programado se anuncia una ronda antes; con "Reducir efectos" solo se omite la sacudida.

## 9. Cajas y recompensas

- `crates.json`: `fallSpeed` (paracaídas, px/s), `catchUp`, `mystery`, tipos con `effect` `heal|shield|moveTime|damageBoost|ammo|mystery|mimic`. Eventos nuevos: `crate-outcome { unit, good, what }`; la imitadora emite `crate-pick` + `explosion` con `weapon: 'imitadora'`.
- Recompensas: `sharedCollection()` (`src/core/rewards.ts`) → `recordMatch(summary, rng)` devuelve `{ chest, achievements }`. El resumen se arma con `Battle.comeback`, `weaponsUsed`, `lastDeathCause`, `stats` y las vidas finales. Clave de `localStorage`: `frankentilleria.collection`.
- Escena `Coleccion` (Menú → Colección). `drawMarker` dibuja cada cosmético por código.
