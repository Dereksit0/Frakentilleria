# Mejoras de UI: botón Atrás y barras de vida

Capturas reales de Playwright (PC 1600×900 y móvil 844×390): `docs/capturas/mejoras/antes/` y `docs/capturas/mejoras/despues/`
(se regeneran con `SHOT_DIR=<carpeta> npx playwright test mejoras.spec.ts`).

## Parte A · Botón Atrás

| # | Antes | Después |
|---|---|---|
| A1 | El Laboratorio no tenía salida: solo "Listo". | Botón `‹ Atrás` arriba a la izquierda (200×104, texto 32 px, estilo del Menú), con foco de teclado visible (Tab / Enter). |
| A2 | — | Lab J1 → Menú. Con cambios sin confirmar abre el modal "¿Salir? Perderás los cambios" (Quedarme / Salir); sin cambios sale directo. |
| A3 | — | Lab J2 → Lab J1 conservando la criatura ya confirmada de J1 y el borrador de J2 (`session.drafts`). No hay modal porque no se pierde nada. |
| A4 | "Pasa el dispositivo" no tenía salida. | `‹ Cancelar` → modal "¿Cancelar la partida?"; nunca vuelve al arte del otro jugador. |
| A5 | Esc solo cerraba overlays. | Esc, botón atrás del navegador y gesto atrás del teléfono pasan por una pila de manejadores (`src/ui/backNav.ts`); un `popstate` re-empuja la entrada de historial para no salir de la página. |
| A6 | Menú, Splash: raíz. | Resumen: Esc → Menú. Tutorial, Ajustes y Pausa: Esc / atrás los cierran. Batalla: atrás = pausa. |

Salidas revisadas: Tutorial (Saltar), Ajustes (Volver), Pausa (Continuar / Salir al menú) y Resumen (Menú) ya tenían salida clara; **faltaban Laboratorio y Pasa el dispositivo**.
El área táctil de `Button` ya está corregida (bug de ¡Fuego!) y el e2e de Atrás pulsa el botón con clic y con toque reales.

## Parte B · Vida en combate

Patrones adoptados (inspiración, sin copiar arte ni marcas):

- **Worms:** un panel por equipo en el HUD (retrato, nombre, barra grande) y nombre sobre cada unidad.
- **Brawl Stars:** barra con número sobre la cabeza, relleno del color del jugador, unidad activa más grande.
- **MOBA / peleas:** barra "fantasma" amarilla que se vacía ~500 ms después del golpe.
- **RPG:** números flotantes (grandes en golpe fuerte, `+` verde en curación, verde ácido en ácido), máximo 12 a la vez.

| # | Antes | Después |
|---|---|---|
| B1 | Placa de texto "J1 · 14/88" sobre la criatura. | Barra con contorno de tinta 4 px, fondo Carbón, relleno del color del jugador, número en Bungee, chip de color **y forma** (círculo J1 / rombo J2) y nombre corto. |
| B2 | Sin lectura rápida. | Marcas finas cada 20 de vida. |
| B3 | La vida cambiaba de golpe. | Baja con suavidad (~300 ms) y deja barra fantasma amarilla que espera 500 ms y se vacía; separador de tinta entre relleno y fantasma. |
| B4 | Solo texto "¡poca vida!" encima de la criatura. | ≤ 25 %: barra Alarma + rayas diagonales + calavera + pulso lento (≤ 10 %: pulso rápido). No depende solo del color. |
| B5 | Parpadeo/golpe inexistente. | Parpadeo y temblor de la barra al recibir daño. Con "Reducir efectos": sin temblor, sin parpadeo, sin fantasma; solo cambia la barra. |
| B6 | Números flotantes sin límite. | Pool de 12 textos reutilizados; golpe fuerte (≥ 25 % de la vida máxima) más grande. |
| B7 | Turno indicado solo con una insignia. | Criatura activa: barra 15 % más grande, opaca y flecha animada; las demás al 78 % de opacidad. |
| B8 | HUD superior con insignia de turno. | Un panel por jugador: retrato de la cabeza, nombre ("Turno de J1" cuando juega), barra grande con número, resistencia y bono de daño con ícono, y rayo de habilidad (apagado y tachado si ya se usó). |
| B9 | Placas de J1 y J2 podían encimarse. | Se separan automáticamente (y se apilan si no caben en el borde). |
| B10 | — | `?debug=fps` muestra un contador de cuadros en vivo. |

### Regla de tamaño de texto para barras flotantes

Las barras sobre las criaturas viven en el mundo (1600×900) y escalan con la cámara FIT. Todo su texto usa **32 px lógicos como mínimo**
(≈ 14 px reales en un teléfono de 844×390, igual que el resto del juego). Para no tapar la acción se acortan los elementos que no son texto
(barra de 104 px, chip de 40 px) y no se agranda la fuente: la placa activa crece 15 %.
En el HUD el texto se escala con "Texto grande" pero nunca baja de 32 px.

### Contraste (4.5:1, `tests/contrast.test.ts`)

Relleno J1, J2, Alarma y fantasma sobre Carbón; número Hueso sobre Tinta; y los cuatro rellenos contra el separador de tinta. La primera versión
comparaba Alarma con el fantasma amarillo (2.4:1, no pasa): se añadió el separador de tinta en vez de depender de ese contraste.

## Verificación

Resultados reales de esta entrega (23-nov-2026):

| Comprobación | Resultado |
|---|---|
| `npm run lint` (eslint + tsc de src, tests y e2e) | sin errores |
| `npm test` | 177 pruebas, 19 archivos, todas en verde (incluye `flow`, `healthBar`, contraste de barras y `fullscreen`) |
| Cobertura de `src/core` | 95.2 % sentencias · 90.9 % ramas · 98.1 % líneas |
| `npm run build` | correcta |
| E2E Playwright (PC y móvil) | `game`, `atras` y `fullscreen`: 28 de 28 en una corrida con `--repeat-each=2` (el spec de pantalla completa se corrigió y se volvió a correr aparte: 4 de 4); `maps`: 6 de 6 |
| Rendimiento (CPU, 400 cuadros con 4 barras animadas + 12 números flotantes) | 0.14 ms por cuadro para todas las barras; 12 números activos como máximo; 28 objetos en la escena de combate |
| `?debug=fps` | existe (contador abajo a la izquierda); en este equipo solo hay WebGL por software (≈ 10 fps), **no es representativo**: los 60 fps reales siguen sin medirse |

Fallos que aparecieron y se corrigieron durante la verificación:

1. `game.spec` fallaba de forma intermitente: "Al azar" reparte armas distintas y el Mazo (cuerpo a cuerpo, 70 px) no alcanzaba al rival a 150 px. El rival ahora se coloca a 70 px.
2. Con muy pocos cuadros por segundo (software), la barra fantasma tardaba más en vaciarse en pantalla; las capturas esperan 2.5 s antes de fotografiar la vida baja.
3. `hasText` de los e2e no buscaba dentro de los botones (contenedores); ahora recorre contenedores.
4. El contraste Alarma vs fantasma amarillo era 2.4:1: se agregó un separador de tinta (ver arriba).

Pendiente: medir fps reales en un teléfono, revisar los textos de 32 px de las placas flotantes en pantallas muy pequeñas y decidir si el aviso de iPhone necesita una imagen.
