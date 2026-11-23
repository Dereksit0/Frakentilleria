# Arte pendiente y estado de assets

## Ya existe (tachado)

- ~~Tercer mapa~~ → hay 3: Vertedero, Cementerio embrujado, Fábrica de juguetes.
- ~~Plano medio del Vertedero~~ → `assets/raw/maps/vertedero/vertedero-mid.png`.
- ~~Logo sin fondo~~ → `assets/raw/logo/logo-frankentilleria-sf.png`.
- ~~Ícono sin fondo~~ → `assets/raw/logo/icono-frankentilleria-sf.png` (favicon, PWA 192/512, maskable, apple-touch).

## Sigue faltando

- 4 donantes (hojas de piezas): Espantapájaros, Maniquí, Juguete de cuerda, Refrigerador. Hoy son placeholders SVG generados por `scripts/build-assets.mjs`.
- Expresiones de las criaturas.
- Íconos pequeños de HUD.
- Efectos de sonido (SFX).
- Música extra (2 pistas; solo existe `music-1.mp3`).
- Íconos de arma "Mazo" e "Hielo" (placeholders SVG).
- Capas lejana e intermedia propias para la Fábrica de juguetes (hoy es un fondo de una sola capa).
- Arte de terreno propio para la Fábrica (hoy procedural por código).
- Cielo propio del Cementerio (hoy degradado por código).

## Pendientes menores de calidad

- `vertedero-mid`: ~12 px con tinte verde residual dentro de la ventana del coche (imperceptible a escala de juego).
- `cementerio-far`: el cilindro de líquido verde de la torre pierde un poco de brillo en el borde por estar cerca del color llave; si molesta, pedir al autor la versión con fondo azul/rojo.
