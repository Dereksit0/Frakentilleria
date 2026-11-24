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

---

# Ensamble de criaturas y animaciones con personalidad

Capturas reales de Playwright en `docs/capturas/rig/` (`antes/`, `despues/`, `debug/` con `?debug=rig`) y `docs/capturas/animaciones/`.
Se regeneran con `RIG_DIR=<carpeta> npx playwright test rig.spec.ts` (añadir `RIG_DEBUG=1` para el overlay) y `npx playwright test animaciones.spec.ts`.

## Parte A · Ensamble (rig)

### Qué causaba cada defecto

| Defecto | Causa medida |
|---|---|
| El brazo sale del pecho (cañón de Armadura sobre el torso rosa) | El anclaje del hombro del torso era una **estimación fija** (centro + 8 % del ancho, 30 % de la altura): caía en el centro del pecho, no en el hombro delantero (p. ej. Maniquí `[116,54]` frente a la esfera real en `[161,44]`). Además el pivote del brazo era su **punto más a la izquierda**, no el centro de la hombrera del brazo. |
| Hueco entre torso y piernas (botas de Armadura) | El marco de las piernas de Armadura trae un **resto de la extracción** de 62×9 px flotando 18 px sobre las piernas reales. El anclaje de cadera se medía sobre la primera fila opaca, o sea sobre ese resto: las piernas reales empezaban 28 px más abajo de lo supuesto y, con el solape de 14 px del código viejo, quedaba un hueco de ≈ 14 px. |
| Hueco con resortes o botas distintas | El torso solo cubría un punto de apoyo y el solape era fijo respecto de una cadera mal medida. Ahora las piernas suben 10 px por detrás del torso y la prueba de píxeles comprueba que todo forma una sola mancha. |

### Qué se hizo

- `src/core/rig.ts` (puro, sin Phaser): `solveRig(selección)` devuelve posiciones, pivotes, capas, `bounds`, `height` y `headTop`. Torso = raíz; cabeza sobre el torso con solape de 6 px; piernas detrás, 10 px dentro del torso, separadas por `hipSpacing` de cada pieza; brazo delante con pivote en `torso.shoulderFront` (y `shoulderBack` opcional, sin arte para un segundo brazo todavía). El origen son los pies.
- `armPose(rig, apuntado)` resta el ángulo de reposo del arte del brazo: la línea hombro→punta queda **exactamente** sobre el ángulo de apuntado y la boquilla es la punta real (error < 0,05° en las pruebas).
- Datos: `src/data/rig.json`, generado por `scripts/rig-anchors.mjs` desde los píxeles del atlas (cuerpo de cada pieza sin restos, cuello, cadera, centro de las hombreras, separación de piernas). `manual` guarda las correcciones hechas a mano revisadas con `?debug=rig` y sobrevive a regenerar. `loadRig` valida al cargar y falla con `rig.json: falta el anclaje "maniqui.torso.shoulderFront"`.
- La vista recorta cada pieza a su cuerpo (los restos nunca se dibujan) y mueve cada pierna desde su propia cadera.
- `?debug=rig`: dibuja caja de cada pieza, anclajes, hombro, boquilla con su línea y el suelo sobre toda criatura. Con **F2** abre el calibrador (`RigDebug`): 1-4 pieza, `[` `]` donante, Tab ancla, flechas mover (Shift ×5), C copia el JSON `manual`.
- El disparo: la partícula de salida nace en la punta del brazo y el proyectil se acerca durante 180 ms desde allí a su trayectoria. **La trayectoria y el origen del núcleo no cambiaron** (sin cambios de balance): la caja de colisión del núcleo sigue siendo el círculo fijo del juego; `height`/`headTop` salen de las piezas ensambladas y se usan en la vista.

### Resultado de las 625 combinaciones (`tests/rig.test.ts`)

| Comprobación | Resultado |
|---|---|
| Ninguna lanza excepción | 625 / 625 |
| (a) solape vertical torso-piernas ≥ 4 px (y piernas detrás) | 625 / 625 (10 px por construcción) |
| (b) solape cabeza-torso ≥ 3 px (y cabeza encima) | 625 / 625 (6 px) |
| (c) hombro del brazo = anclaje del torso, error ≤ 1 px, brazo delante | 625 / 625 (error 0) |
| (d) cajas finitas y pies en y = 0 | 625 / 625 |
| (e) cabe en el encuadre del Laboratorio (560×480) | 625 / 625 |
| Extra: píxeles del torso+piernas+cabeza+brazo forman **una sola mancha** (sin huecos ni piezas flotando) | 625 / 625; antes del recorte de restos fallaban las 125 combinaciones con piernas de Armadura (3 manchas) |

Hojas de contacto: `docs/capturas/rig/despues/pc-hoja-60-combinaciones.png` (60 combinaciones con semilla) y `pc-peores-casos.png` (los dos casos reportados y cuatro más); las equivalentes de `antes/` muestran el defecto.

## Parte B · Animaciones

`src/ui/model/anim.ts` (puro, probado en `tests/anim.test.ts`, 27 pruebas): máquina de estados con prioridades + `poseAt(...)`, que escribe una pose en un objeto reutilizado (sin crear nada por cuadro). La vista solo copia la pose a las piezas.

| Estado | Prioridad | Qué hace |
|---|---|---|
| idle | 0 | Respira (torso sube y baja ~3 px), balanceo suave de brazo y cabeza |
| walk | 15 | Rebote, piernas alternadas, polvo en los pies |
| aim | 20 | Brazo apuntando, ligera inclinación |
| fire | 60 | Retroceso del cuerpo, estirar y encoger (squash & stretch), patada del brazo |
| hurt | 70 | Destello blanco, sacudida, arco hacia atrás, cabeza tambaleándose, estrellitas y globo (“¡Auch!”, “¡Eso dolió!”, “¡Mis tornillos!”) |
| taunt | 40 | 1 s, no gasta turno; variante por **cabeza** (datos en `src/data/taunts.json`): Armadura saludo, Espantapájaros risa + sombrero, Maniquí pose, Juguete baile con pitidos, Refrigerador puerta con luz azul. Globos “¡Tomaaa!”, “¡Jajaja!”, “¡Fallaste!” |
| ability | 50 | Se agacha y estira con destello |
| victory | 90 | Saltos con los brazos arriba y confeti |
| defeat | 100 (no se interrumpe) | Se desarma: la cabeza rueda, el brazo vuela, humo; sin contenido gráfico |
| lowHp | 10 | Se encoge y respira agitado, gotas de sudor |

- La burla se dispara sola 0,65 s después de acertarle al rival y con el botón **Burlar** (HUD, a la izquierda bajo los paneles; solo en fase de apuntado, 1 s, con enfriamiento).
- **Reducir efectos**: sin sacudida, sin destello y sin vibración rápida (probado para todos los estados y donantes); quedan los cambios de pose suaves.
- Globos: 32 px lógicos, tinta sobre hueso (≈ 17:1), un solo objeto reutilizado por criatura. Partículas dentro de los topes del combate (cada emisor limitado; confeti 24 y rayos 12 vivos como máximo).
- Sonido: reutiliza el sintetizado (`tick` marca cada compás del baile; golpe, victoria y habilidad ya los reproduce el combate).

## Verificación del ensamble y las animaciones

Ver la tabla de resultados al final de esta sección (se actualiza en la entrega).

---

# Dos brazos y cabezas alineadas

Capturas: `docs/capturas/rig/antes2/` y `despues2/` (Laboratorio con 6 combinaciones y combate con dos criaturas mezcladas, PC 1600×900 y móvil 844×390), hojas de contacto `hoja-cuello-25.png`, `hoja-brazos-25-reposo.png`, `hoja-brazos-25-apuntando.png` y las imágenes de cada pieza con sus anclajes en `docs/capturas/rig/anclajes/`.
Se regeneran con `RIG2_DIR=<carpeta> npx playwright test rig2.spec.ts`, `RIG_DIR=docs/capturas/rig npx playwright test rig-hojas.spec.ts --project=pc` y `node scripts/rig-export-anchors.mjs`.

## Parte B · Qué causaba la desalineación de las cabezas

Se verificaron las tres hipótesis:

| Hipótesis | Resultado |
|---|---|
| (a) `neck` de la cabeza con el centro de la caja | **Parcial.** El `neck` se medía en las últimas filas opacas. En los cascos y calabazas, cuya base es el cuerpo ancho de la cabeza (sin muñón), eso daba la esquina inferior derecha (Armadura `x=114`, el cuerpo del casco está centrado en `x≈109`; la calabaza `87`/`90`). Ahora para estas dos cabezas se usa el centro de su cuerpo inferior y para el resto el centro del muñón. El plumero y el sombrero no influyen (el cuello es un anclaje, no la caja). |
| (b) `neck` del torso fuera del centro de la abertura | **Confirmada, es la causa principal.** Se medía como la media de las primeras filas opacas: en el Espantapájaros caía en `x=86` sobre las puntas de paja, cuando la abertura está en `x≈103` (16 px a la izquierda), y en `y=8`, que son las puntas de paja, unos 11 px por encima del borde real del cuello: de ahí la cabeza "flotando y desplazada, dejando ver la abertura". En la Armadura la abertura está en `x≈108` y se medía `98`. Ahora el centro sale de la zona oscura del cuello (erosionada para quitar el contorno) y, cuando el cuello es plano o claro, del centro de las filas del borde. |
| (c) Rutas de dibujo distintas | **Descartada.** Laboratorio, combate, "Pasa el dispositivo", Resumen, Tutorial, Menú y la derrota ya usan el mismo `CreatureView` y el mismo `solveRig`; no había ruta duplicada. Los íconos de la lista son marcos del atlas recortados al arte visible y centrados (se ven centrados en las capturas). |

`neckDepth` (por cabeza) dice cuántos px se mete el fondo de la cabeza bajo el borde delantero del cuello del torso (9–10 px).

## Parte A · Dos brazos

- La pieza "Brazos" se usa para **ambos** brazos. Delantero: encima del torso, gira en su hombro y de su punta (`muzzle`) sale el disparo. Trasero (el brazo izquierdo en pantalla): **delante del torso** pero debajo del delantero, la misma imagen al 85 % de brillo, anclado a `shoulderBack`; es solo visual (no toca stats, ADN, armas ni colisiones).
- Datos (`src/data/rig.json`): cada torso define `shoulderFront` y `shoulderBack`; cada brazo, `shoulder` y `muzzle`; `backArm` define todos los ángulos: reposo −100° (cuelga hacia abajo y un poco hacia afuera), apuntando sigue al delantero con −12° (queda algo más abajo, no choca con la cabeza), oscilación al caminar 0,35 rad en sentido contrario, sacudida al recibir un golpe 0,35 rad.
- Animaciones: idle (vaivén suave), walk (se balancea al contrario del delantero), aim/fire (sigue y recibe el retroceso), hurt (se agita; con "Reducir efectos" solo cambia la pose), taunt (por variante: mano en la cadera, brazo alzado en la risa, etc.), victory (ambos brazos arriba), ability y defeat (cae). El volteo horizontal refleja todo el ensamble y mantiene el orden de capas.
- Encuadre: `bounds` incluye el brazo trasero colgando; las 625 combinaciones caben en 560×480 y la altura/anchura salen del ensamble resuelto.

## Pruebas con las máscaras reales (`tests/rig-masks.test.ts`, 80 pruebas)

| Relación | Pares | Qué se comprueba | Resultado |
|---|---|---|---|
| cabeza × torso | 25 | centro del muñón (o del cuerpo del casco/calabaza) = centro de la abertura, error ≤ 2 px; solape vertical de las máscaras 4–16 px; cabeza encima | 25 / 25 |
| torso × piernas | 25 | solape vertical ≥ 4 px; piernas detrás | 25 / 25 |
| torso × brazo delantero y trasero | 25 × 2 lados | articulación = enchufe, error ≤ 1 px; ambos enchufes caen sobre píxeles opacos del torso; las máscaras se solapan (trasero colgando); los dos brazos delante del torso, el delantero encima del trasero | 25 / 25 |
| encuadre | 625 | cabe en 560×480 incluyendo el brazo trasero | 625 / 625 |
| anclajes | 5 | los guardados coinciden con la medición de píxeles (≤ 1 px) salvo ajustes manuales | 5 / 5 |

Además siguen en verde las 625 combinaciones de `tests/rig.test.ts` (una sola mancha, sin huecos ni piezas flotando).

## Qué queda más débil

- Los **hombros** (centro de hombreras, anillos, esferas, llave y cilindros) se midieron con un detector de píxeles y luego se **afinaron a mano** mirando `docs/capturas/rig/anclajes/` (`manual` en `rig.json`; anotado en `DECISIONES_JUEGO.md`). La prueba comprueba que caigan sobre píxeles del torso y que el arte se solape, pero la estética del punto exacto es juicio visual.
- **Armadura sobre Armadura:** el borde inferior del casco es oblicuo, por lo que a la izquierda se ve un poco de la abertura oscura del cuello.
- El brazo trasero colgando es largo en el Refrigerador, el Juguete y la Armadura (llega a la cadera); queda detrás de las piernas solo cuando se superponen.
- Sigue sin medirse el rendimiento en un teléfono real (WebGL por software en este equipo).
