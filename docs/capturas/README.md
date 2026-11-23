# Capturas de verificación

Generadas por `npx playwright test e2e/maps.spec.ts` (proyectos `pc` 1600×900 y `movil` 844×390).

- `<proyecto>-<mapa>-selector.png`: Menú con el botón "Mapa: …" ya cambiado.
- `<proyecto>-<mapa>-combate.png`: Combate con la cámara centrada.
- `<proyecto>-<mapa>-parallax-izq.png` / `-der.png`: cámara en −120 / +120 px; las capas se desplazan `2 × 120 × parallax` px entre ambas (la prueba lo comprueba numéricamente y que cambien píxeles).
- `chroma/`: vistas previas del chroma key sobre cuadros, blanco, negro y color de contraste.

## Resultados reales (6 pruebas, todas pasan)

Parallax: vertedero (sky 0, far 36 px, mid 96 px de desplazamiento total), cementerio (sky 0, far 36 px), fábrica (una capa fija, sin cambio de píxeles).

| Proyecto | Mapa       | FPS (rAF) | FPS (Phaser) |
| -------- | ---------- | --------- | ------------ |
| pc       | vertedero  | 6.1       | 6.5          |
| pc       | cementerio | 7.2       | 7.5          |
| pc       | fabrica    | 8.3       | 9.0          |
| movil    | vertedero  | 10.4      | 11.9         |
| movil    | cementerio | 10.8      | 12.3         |
| movil    | fabrica    | 12.0      | 13.2         |

**60 fps NO se pudo verificar.** Esta máquina no tiene GPU disponible para el navegador de pruebas: Chromium usa WebGL por software (SwiftShader) y hasta el Menú corre a ~8 fps (pc) / ~13 fps (móvil). Las cifras de arriba son del renderizador por CPU y no representan el juego en un equipo normal. La prueba exige ≥ 55 fps cuando detecta GPU real y, con render por software, solo registra el valor. Pendiente: repetir en un equipo con GPU.
