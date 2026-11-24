# Arte pendiente y estado de assets

## Ya existe (tachado)

- ~~Tercer mapa~~ → hay 3: Vertedero, Cementerio embrujado, Fábrica de juguetes.
- ~~Plano medio del Vertedero~~ → `assets/raw/maps/vertedero/vertedero-mid.png`.
- ~~4 donantes (Espantapájaros, Maniquí, Juguete, Refrigerador)~~ → `assets/raw/characters/donante-<nombre>-parts.png`; `npm run assets` genera piezas, anclajes (`src/data/anchors.json`) e íconos (`icon_<donante>`) en el atlas.
- ~~Íconos de armas (Mazo, Hielo y las 9 armas nuevas), sprites de efectos e insignias de estado y evento~~ → `assets/raw/{weapons,fx,ui}`; `npm run assets` genera `atlas-icons`, `atlas-fx` y `atlas-badges` (WebP + JSON con anclajes). Tabla id → uso en `docs/CONTRATO_UI.md` §9.
- ~~Logo sin fondo~~ → `assets/raw/logo/logo-frankentilleria-sf.png`.
- ~~Ícono sin fondo~~ → `assets/raw/logo/icono-frankentilleria-sf.png` (favicon, PWA 192/512, maskable, apple-touch).

## Sigue faltando

- Sin mecánica ni conexión todavía (arte listo y registrado): mina, dinamita, ataque aéreo, taladro, señuelo, gancho, cuervos, escudo reflector, charco de ácido, onda del mazo, burbuja de escudo, tierra, insignias de aturdido / ácido y las 5 de evento.

- Expresiones de las criaturas.
- Íconos pequeños de HUD.
- Efectos de sonido (SFX).
- Música extra (2 pistas; solo existe `music-1.mp3`).
- Capas lejana e intermedia propias para la Fábrica de juguetes (hoy es un fondo de una sola capa).
- Arte de terreno propio para la Fábrica (hoy procedural por código).
- Cielo propio del Cementerio (hoy degradado por código).

## Prompts de IA para la Fábrica de juguetes

Hoy la Fábrica tiene `status: "placeholder"` en `fabrica/bg` y `fabrica/terrain` (`src/data/maps.json`). Para reemplazarlas basta con soltar los PNG en `assets/raw/maps/fabrica/`, correr `npm run assets` y cambiar los datos (ver al final).

**Estilo común (pegar en ambos prompts):** "Arte de videojuego 2D en estilo cartoon, contorno grueso de tinta casi negra (#0F0E15), colores planos con sombreado suave de una sola capa, sin texto ni personajes. Paleta: pared amarilla #F8C12F, zócalo verde azulado #268C7E, metal gris violáceo #635478 y #6A6988, detalles rojos #FF5468 y voltio #FFE14D. Tema: fábrica de juguetes con toques de laboratorio Frankenstein (costuras, tornillos, parches morados #5B3FA0). Debe combinar con los otros mapas de FrankenTillería."

**Capa lejana** (`fabrica-far.png`) — mismas dimensiones y llave que `cementerio-far`:
"Imagen horizontal de 1672×941 px. Fondo sólido verde croma puro #00FF00 en toda la parte superior y en los huecos (sin degradados, sin ruido, sin sombras sobre el fondo). En la franja inferior, silueta lejana de interior de fábrica: ventanal arqueado con siluetas de engranes y botellas, tuberías verticales, cintas transportadoras con juguetes sin terminar, estantes de osos de peluche y una torre de máquina con luces de colores. El elemento más alto no debe pasar del 60 % de la altura; el 40 % superior queda verde croma vacío. Nada de verde #00FF00 ni tonos parecidos dentro del arte (evitar líquidos verdes neón)."

**Terreno** (`fabrica-terrain.png`) — mismas dimensiones y llave que `cementerio-terrain`:
"Imagen horizontal de 1983×793 px. Fondo sólido magenta croma puro #FF00FF (sin degradados ni ruido). Una franja de suelo horizontal que ocupa el ancho completo, con la superficie superior ligeramente irregular y el borde apoyado en la parte inferior de la imagen: placa de metal remachada gris violáceo (#6A6988 arriba, #3B3452 abajo) con costuras cosidas, tornillos, engranes y piezas de juguete enterradas; sobre la superficie, algunos props pequeños (engrane, cubo de bloques, pieza de tren). Los props no deben cortarse en los bordes izquierdo y derecho. Sin magenta ni morado rosado dentro del arte; los parches deben ser morado oscuro (#5B3FA0 o más oscuro)."

**Cómo se activa el arte nuevo (solo datos):**

1. Copiar los PNG a `assets/raw/maps/fabrica/` y añadir su procesado en `scripts/build-assets.mjs` (mismo patrón que Cementerio: `keyGreen` para la lejana, `keyMagenta` para el terreno).
2. En `maps.json` → `fabrica`: pasar `bg` a una capa `far` (`parallax` 0.15, `depth` 10, `status` "final"), añadir un cielo (`gradient` o imagen, `parallax` 0), y cambiar `terrain` a `{ "kind": "image", "src": "maps/fabrica-terrain.png", "status": "final" }`; recalcular `groundY` y `spawns` (la prueba `tests/maps.test.ts` valida que sean jugables).

## Pendientes menores de calidad

- ~~`vertedero-mid`: motas verdosas~~ → eliminadas (despill + limpieza de motas).
- ~~`cementerio-far`: cilindro de líquido~~ → recuperado con una zona protegida (el líquido es casi el mismo verde que la llave; ver `scripts/chroma.mjs`). Si se cambia el arte de la torre hay que revisar `CEMENTERIO_FAR_PROTECT`.
- `cementerio-far`: el arco izquierdo de la torre conserva un reflejo verde semitransparente (viene del arte).

## Pendiente de la fase de jugabilidad (armas y estados)

- Íconos de estado junto a la barra de vida (congelado, quemadura, escudo, aturdido), 64×64, trazo grueso Tinta #0F0E15, fondo transparente. Prompt: "Ícono de videojuego 2D cartoon, contorno grueso casi negro, un copo de nieve azul claro sobre fondo transparente" (repetir con llama verde ácido #7CFF4F, escudo dorado, estrellas mareadas amarillas).
- Sprite de charco de ácido (200×60, verde #7CFF4F con burbujas, vista lateral) y de la Caja de munición (hoy reutiliza `item_fist`).
