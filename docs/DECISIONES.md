# Decisiones de assets y mapas

## Hechos encontrados al integrar (23-nov-2026)

- Los 6 archivos nuevos no estaban en `assets/incoming/` (no existe); se tomaron de `d:/descargas`. Se copiaron a `assets/raw/` con nombres del esquema, conservando los originales.
- No existían `docs/DISENO.md` ni `docs/PLANEACION.md`; las decisiones de abajo no pudieron contrastarse con ellos.

## Chroma key (`scripts/chroma.mjs`)

- Magenta `#FF00FF` y verde `#00FF00`: modo **global** (no solo flood desde el borde) porque el arte tiene huecos enclavados (ventanas del coche, reja, torre, bolsas junto a huesos) que un flood no alcanza.
- Tolerancias medidas: el ruido del fondo llega a distancia ≤ 40 del color llave; los colores más cercanos del arte (parche morado ≈ 141, líquido verde de la torre) quedan fuera. Magenta: transparente < 45, opaco > 90. Verde: transparente < 50, opaco > 110.
- Bordes: alpha en rampa, color descontaminado con vecinos opacos y _despill_ en banda de 2 px. Revisado sobre fondo de cuadros y color de contraste (`npm run assets` + `node scripts/preview-chroma.mjs`; resultados en `docs/capturas/chroma/`).
- Despill por línea: un píxel de borde solo se corrige si está sobre la recta _color de arte vecino ↔ color llave_; así no se tocan colores legítimos parecidos a la llave. Motas pequeñas (≤ 80 px) teñidas de llave y pegadas a transparencia se eliminan.
- **Zona protegida** `CEMENTERIO_FAR_PROTECT`: el líquido del cilindro de la torre es prácticamente el verde llave (distancia 15–77 de #00FF00), indistinguible por color; su interior (en píxeles fuente 1363,553–1449,637) no se procesa.
- Los assets anteriores siguen con su flood-fill original para no cambiar nada ya validado.

## Tamaños

- Fondos a 1600 px de ancho (≤ 2048 para escritorio), WebP calidad 82 (con alpha donde aplica); terreno en PNG. Logo 1000 px de ancho.
- El terreno del Cementerio se estira ×1.5 en vertical, igual que el del Vertedero, para mantener el mismo grosor jugable.

## Mapas (todo por datos en `src/data/maps.json`)

- Parallax con la convención `scrollFactor` de Phaser (0 = fijo a pantalla, 1 = pegado al mundo). Vertedero: cielo 0.0, lejana 0.15, intermedia 0.4, terreno 1.0 (implícito). Cementerio: cielo 0.0, lejana 0.15.
- Para que no se vean bordes al mover la cámara, cada capa se sobredimensiona `2 × parallax × maxPan` (`layerRect`, `maxPan` = 120 px, **TODO** ajustar al ver la cámara real).
- **Cementerio embrujado**: cielo degradado por código Noche `#2E2A47` → Tormenta `#5B3FA0`; capa lejana = `laboratorioembrujado`; terreno = `cementerioembrujado`.
- **Fábrica de juguetes** (elección sencilla): es un mapa **jugable** con el fondo de una sola capa. El terreno destructible es **procedural** (`Terrain.procedural`, `amp` 40 y semilla 104, elegidas porque dejan ambos spawns sobre suelo llano a 645/633 px (con amp 70 el suelo inclinaba ~40° bajo los spawns)) con colores sacados del fondo (metal de la máquina `#6A6988` de labio, tubería `#635478` oscurecida `#3B3452` de cuerpo, contorno Tinta). Se reutiliza la misma mecánica de máscara por píxel que los otros mapas.
- Los mapas con arte de terreno construyen su máscara desde el alfa del PNG, anclado al piso del mundo (`placeMask`, umbral 128).
- Selector de mapa: `DISENO.md` no existe y no pude confirmar que lo pida, así que `pickMapId(seed, ids)` elige mapa al azar con semilla (misma semilla = mismo mapa). El selector visual queda a cargo de la sesión de UI; el core ya acepta un id explícito.
- Los mapas anteriores generados por código ("Cementerio de juguetes", "Azotea del laboratorio") se retiraron de `maps.json`; nada del código ni de las pruebas los referenciaba.
- `liquid.startY` = 900 en los tres (el ácido nace en el piso del mundo, como `acid.ts`).

## Marcado como TODO (no se inventaron números de balance)

- `wind.bias` = 0 en los tres mapas (el arte no sugiere un viento claro); rango −5..5 es la regla global.
- `spawns`: elegidos con `tests/maps.test.ts`: suelo sólido, huella con desnivel ≤ 24 px, alto libre de un cuerpo (2 × `UNIT_RADIUS`), separación ≥ 600 px (**TODO balance**), simetría ±100 px y fuera del ácido. El Cementerio usa [444, 1200] (en 300/1300 caía al borde de un desnivel de 40 px). Validar jugando.
- Estado del arte: cada capa y terreno tiene `status` (`final` | `placeholder`). Placeholders: `fabrica/bg` y `fabrica/terrain`.

## Marca

- Ícono maskable: arte al 70 % central sobre Noche `#2E2A47`. Apple touch 180 px sobre Noche (iOS no admite transparencia). `favicon.ico` con PNG 16/32/48. Tarjeta Open Graph 1200×630 `og-image.jpg` desde `portada-key-art` (los rastreadores no leen WebP de forma fiable).
