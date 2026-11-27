# Auditoría final

Hice la auditoría sobre una copia limpia del repositorio en el commit `a898bea`, para que el trabajo de otras sesiones no mezclara los resultados. La regla fue que el comportamiento del juego no cambiara. La prueba de eso es `scripts/semillas.sim.ts`: juega 300 partidas entre bots expertos con las semillas 1 a 300 y guarda el resultado exacto de cada una (mapa, ganador, rondas, turnos, disparos, aciertos y daño). Corrí la simulación antes de tocar nada y después de cada cambio relevante. El archivo final es idéntico byte por byte al de la línea base (`semillas-base-a898bea.json` contra `semillas-final-a898bea.json` en `docs/auditoria/`).

Mientras trabajaba, la otra sesión publicó cuatro commits nuevos (cuerpos sólidos, logros, portales y multiplicador de daño) que sí cambian el juego. Los fusioné, volví a pasar mis limpiezas sobre el código nuevo y repetí la comprobación contra el estado de ese momento (`eaf3d47`): `semillas-base-eaf3d47.json` y `semillas-final-eaf3d47.json` también son idénticos. El bundle y las pruebas del cuadro incluyen esos commits, por eso el JS no baja.

## Línea base y resultado

| Medida | Antes | Después |
|---|---|---|
| Archivos rastreados | 538 | 528 |
| `src/core` | 22 archivos, 3417 líneas | 22 archivos, 3556 líneas |
| `src/scenes` | 14 archivos, 2827 líneas | 14 archivos, 2919 líneas |
| `src/ui` | 24 archivos, 2928 líneas | 24 archivos, 2996 líneas |
| `src/data` | 12 archivos, 1348 líneas | 11 archivos, 1031 líneas |
| `tests` | 34 archivos, 4302 líneas | 33 archivos, 4150 líneas |
| `e2e` | 18 archivos, 1546 líneas | 17 archivos, 1476 líneas |
| `scripts` | 14 archivos, 2509 líneas | 16 archivos, 2659 líneas |
| `docs` | 277 archivos (253 capturas) | 271 archivos (20 capturas más 10 del informe) |
| Peso de `docs/` | 172 MB | 22 MB |
| Peso de `public/` | 7.3 MB | 6.4 MB |
| Bundle JS | 1343.89 kB (372.20 kB gzip) | 1350.71 kB (374.52 kB gzip) |
| `dist/` | 9.0 MB | 8.2 MB |
| `tsc --noEmit` y ESLint sin advertencias | sin errores | sin errores, también con `--noUnusedLocals --noUnusedParameters` |
| Pruebas | 543 | 565 (la otra sesión agregó pruebas durante la auditoría) |
| Cobertura de `src/core` (sentencias, ramas, funciones, líneas) | 96.17, 90.3, 97.09, 97.67 | 96.81, 90.48, 97.74, 98.21 |
| Simulación de 300 semillas | referencia | idéntica |

Las líneas de `src/` subieron aunque quité código porque los comentarios en español, aunque más cortos en número, ocupan varias líneas cuando explican el porqué, y agregué lo que faltaba: la pantalla de error de carga y los campos de la simulación. Las 12 pruebas que bajaron salen de reemplazar dos archivos de pruebas de atlas por uno solo (`tests/atlas.test.ts`) que además comprueba que todo frame que nombra el código existe.

Capturas de las pantallas clave antes (`docs/auditoria/base/`) y después (`docs/auditoria/despues/`): menú, laboratorio, pasa el dispositivo, combate y resumen.

## Qué eliminé

- 36 exportaciones y constantes sin uso en `src/` que detectó `knip` (se les quitó `export`) y 2 declaraciones que no usaba nadie. La última pasada completa de `knip` no dejó exportaciones sin uso en `src/` (la repetición final falló por falta de memoria del equipo, no por el código). Quedan 8 archivos que `knip` marca como sin uso: siete son herramientas que se corren a mano (`scripts/chart-balance.mjs`, `preview-*.mjs`, `rig-*.mjs`) y `public/sw.js`, que se registra por nombre desde `src/main.ts`. Los dejé a propósito.
- `depcheck` y `npm run` no encuentran dependencias ni scripts sin uso.
- 87 frames de arte que ninguna mecánica usa: íconos de armas que no existen, insignias de estado y de evento, efectos de armas no implementadas, el logro bloqueado, cajas trampa, cofre, sombreros, parches, lápidas y los 18 obstáculos de mapa. Salieron del build y quedaron en `docs/FUTURO.md` con su id y su uso previsto. El pipeline sigue sabiendo generarlos: se quita el nombre del conjunto `FUTURO` de `scripts/sheets.mjs`. También se fueron `atlas-objects`, `cosmeticRig.json` y el campo `plannedIcons` de `weapons.json`.
- 5 frames viejos del atlas principal (`wicon_grenade`, `wicon_mace`, `wicon_ice`, `fx_smoke`, `item_crate`) y los dos íconos de marcador hechos con SVG.
- Siete documentos de proceso que ya no servían (traspaso inicial, coordinación entre sesiones, listas de arte pendiente, bitácoras de mejoras) y unas 230 capturas repetidas o de pruebas de antes y después.
- Las herramientas `?debug=rig`, `?debug=assets` y `?debug=acid` ya no entran al bundle de producción. `?debug=fps` se queda.

## Qué cambié de estilo

- Los comentarios de `src/`, `tests/` y los títulos de las pruebas pasaron a español. Borré los separadores decorativos y los comentarios que repetían lo que dice el código, y dejé los que explican por qué (una fórmula, un caso borde, una decisión).
- Formato: pasé Prettier a todo `src`, `tests`, `e2e` y `scripts` en un commit aparte (`formato:`), para que ese ruido no se mezclara con los demás cambios.
- La prueba de poses finitas hacía miles de comprobaciones y fallaba por tiempo en una máquina ocupada. Ahora junta los fallos y comprueba una sola vez.
- Reescribí en prosa el README y `docs/DECISIONES_JUEGO.md`, y moví los documentos de balance a `docs/balance/`.
- Los comentarios de `scripts/` y `e2e/` siguen en inglés. No los traduje; queda pendiente.

## Fallos encontrados y corregidos

- Pantalla negra si falta un archivo necesario: ahora `Boot` muestra "No se pudo cargar el juego" con un botón para reintentar. Los archivos opcionales siguen fallando en silencio.
- `e2e/game.spec.ts` dependía de que un tiro al azar acertara: ahora repite el tiro hasta cinco veces.
- `e2e/maps.spec.ts` fallaba en la línea base: el paralaje medido incluía la inclinación por viento de las capas lejanas, y el mapa sin capas móviles se pasaba del umbral por las partículas de viento. Ajusté ambas pruebas.
- `tests/anim.test.ts` y las pruebas que leen PNG fallaban en máquinas con poca memoria. Subí el tiempo límite a 20 s y limité Vitest a 2 procesos.

## Estabilidad

- Estrés: 1000 partidas entre bots con semillas al azar (`scripts/estres.sim.ts`), revisando en cada paso que no haya valores no finitos, que las criaturas vivas estén dentro del mapa y que ninguna partida se quede atascada. Resultado: 0 problemas. Promedio de 10.2 rondas, 19.6 turnos y unos 95 s de juego de bots por partida; 4 empates en mil (`docs/auditoria/estres.json`).
- Navegador (`npm run e2e`, 62 pruebas): 47 pasan y 15 se omiten por diseño. Corren en PC (1600x900), móvil (844x390) y en WebKit con los perfiles de iPhone y iPad. `e2e/pantallas.spec.ts` recorre menú, laboratorio, pasa el dispositivo, combate y resumen en los cuatro y exige cero errores de consola. El único mensaje que filtra es el aviso de Safari de que no reconoce `interactive-widget` en la etiqueta viewport, que es de Chrome y no afecta nada.
- La matriz completa se corrió antes de fusionar con los commits nuevos de la otra sesión. Después de fusionar repetí el recorrido de pantallas en los cuatro perfiles (pasa) pero no toda la matriz.
- Casos de borde que ya manejaba el código y comprobé en la revisión: `localStorage` bloqueado (`settings.ts`, `rewards.ts`, con prueba), audio bloqueado hasta el primer toque (`audio.ts`, `viewport.ts`), WebGL perdido (`viewport.ts` restaura o recarga), cambio de orientación (aviso en móvil vertical, `e2e/game.spec.ts`), pestaña en segundo plano (el combate se pausa solo) y Atrás en cada pantalla (`e2e/atras.spec.ts`). WebGL no disponible lo cubre `Phaser.AUTO`, que cae a canvas.
- Rendimiento con `?debug=fps`: el equipo donde corrí las pruebas solo tiene WebGL por software (SwiftShader), así que la medición de la tormenta ácida (3 a 7 fps) no representa un celular real. No tengo una medición válida de 60 fps. Queda pendiente medirla en el teléfono del equipo con `?debug=fps` en las pantallas con más efectos (ácido, viento y explosiones).

## Lo que no hice o quedó pendiente

- Traducir los comentarios de `scripts/` y `e2e/`.
- Medir los fps en un dispositivo real.
- Los números del balance que siguen marcados `TODO(balance)`, y la meta de remontadas (12.7 % contra 20 %), no se tocaron: no eran parte de la limpieza.
- Reescribir en prosa los documentos de `docs/balance/`, `docs/ia/`, `docs/PRUEBA_MOVIL.md` y `PROMPTS.md`, que conservan su formato anterior. `PROMPTS.md` además es evidencia del proceso y lo dejé casi intacto.
- Lo que solo puede hacer el equipo: reparto de tareas, objetivos individuales, autoevaluaciones y la presentación (ver `docs/CUMPLIMIENTO.md`).

## Posibles errores de diseño que no toqué

- La caja `crate-weapon` y las demás cajas se dibujan todas con la misma imagen de caja misteriosa hasta recogerse: es decisión de diseño, no un fallo.
- `docs/DISENO.md` y `docs/PLANEACION.md` nunca estuvieron en el repositorio, así que varios supuestos (presupuesto de 22 puntos, costos por donante) salen del prototipo y no se pudieron contrastar.

## Segunda auditoría: congelamiento al impactar, trayectoria, armas, pantallas, Colección y caché

Estado al 26/11/2026. Un commit por prioridad, hechos sobre `eaf3d47` y fusionados después con la limpieza de la primera auditoría.

### Números de pruebas

| | Antes (`eaf3d47`) | Después, sin fusionar | Después de fusionar con la limpieza |
|---|---|---|---|
| Pruebas unitarias (`npm test`) | 577 en 37 archivos | 641 en 43 archivos | **629 en 42 archivos**, todas pasan |
| Archivos E2E (Playwright) | 19 | 23 (`impacto`, `trayectoria`, `resoluciones`, `pwa`) | 22 (la limpieza quitó uno) |
| `npm run lint` | pasa | pasa | pasa |
| `npm run build` | pasa | pasa | pasa |

Las 12 pruebas unitarias de menos salen de la limpieza, que juntó dos archivos de pruebas de atlas en `tests/atlas.test.ts`. Cada commit de prioridad se comprobó por separado: su instantánea exacta (extraída del índice a una carpeta aparte) pasó lint, pruebas y build antes de hacer el commit.

**Al fusionar.** La limpieza había sacado del build el candado, el logro bloqueado, tres sombreros y dos parches porque ninguna pantalla los usaba. La nueva Colección sí los usa, así que volvieron al build quitándolos del conjunto `FUTURO` de `scripts/sheets.mjs`, igual que se hizo con los logros. `docs/FUTURO.md` quedó al día.

**E2E de regresión sobre el estado final** (impacto con las 8 armas, error forzado y trayectoria en los 3 mapas): PC 12/12, Android (Pixel 7) 12/12, iPhone 8/9. La que falló en iPhone fue Tesla, con "Page crashed" mientras cargaba el combate, antes de disparar. Repetida 4 veces: pasó 3 y la otra se cerró a los 1,4 s, al arrancar la página. Apunta a inestabilidad del WebKit de Playwright en Windows (ya se había visto antes con otras armas), no al impacto, pero solo un iPhone real lo confirma. Resoluciones: 8/8. PWA: 1/1.

Pruebas nuevas: `impacto` (8, una por arma), `armas` (36), `aim-preview` (7), `watchdog` (5), `vibrate` (3), `coleccion` (3) y 2 pares de contraste.

### 1. Congelamiento al impactar (iPhone)

**Causa raíz.** `vibrate()` comprobaba `'vibrate' in navigator`, que en WebKit es verdadero aunque el valor sea `undefined`. En cada golpe, `navigator.vibrate(ms)` lanzaba `TypeError: navigator.vibrate is not a function` dentro del `update` de la escena de combate. Una excepción ahí impide que Phaser programe el siguiente cuadro, así que la pantalla quedaba congelada para siempre. Se reprodujo en WebKit (perfil iPhone 14 de Playwright): el reloj de la escena quedaba fijo al primer impacto.

**Corrección.** Se comprueba `typeof navigator.vibrate === 'function'`, sin `try/catch`.

**Red de seguridad, que no oculta errores:**
- Manejador global (`error` y `unhandledrejection`) que registra el error y lo muestra en un panel con `?debug=log`, o manteniendo 2 s el dedo en la esquina superior izquierda (botón Copiar).
- Latido que reinicia el bucle de cuadros si se detiene con la página visible.
- Vigilante en el núcleo: un proyectil de más de 8 s o una espera de más de 4 s se resuelven aplicando el daño pendiente, y el turno avanza.

**Error encontrado en el propio vigilante.** La simulación de armas mostró que forzaba turnos sanos con la granada: 28 de 60 partidas. Si el turno terminaba en el mismo cuadro de la explosión, su reloj no se reiniciaba y sumaba los vuelos de turnos seguidos. Ahora se reinicia en `endTurn()`, con su prueba.

**Comprobado:**
- E2E de impacto con las 8 armas: pasa en Android (Pixel 7) y en iPhone.
- Un error forzado dentro del `update` queda registrado y el bucle vuelve a correr.

### 2. Línea de trayectoria

**Causa.** No dejó de dibujarse. Desde el commit del viento visible (`a898bea`), el cielo se llena de partículas color hueso iguales a los puntos de la vista previa, que además quedaba debajo de las placas de nombre.

**Corrección.**
- La línea es discontinua amarilla con borde de tinta y va por encima de las placas. Con alto contraste usa hueso y un borde más grueso.
- El cálculo pasó a `aimPreview` en `src/core/aim.ts`. Antes el mortero se dibujaba sin su ángulo mínimo; ahora lo respeta, igual que el disparo real.

**Regla de mapa que choca con el pedido.** En el Cementerio la niebla oculta la vista previa por diseño (`docs/BALANCE_FASE3.md`). No se cambió.

### 3. Armas

`tests/armas.test.ts` prueba cada arma. `scripts/armas.sim.ts` corre 60 partidas de bots por arma, en los 3 mapas, con una sola arma y munición infinita.

| Arma | Qué se probó | Resultado | Bots: aciertos · daño/acierto |
|---|---|---|---|
| Cañón | selección, disparo, trayectoria = balística, radio/cráter/daño de datos, munición infinita, cráter, turno | pasa | 49,9 % · 7,4 |
| Mortero | ídem + ángulo mínimo 60°, sin munición no se usa | pasa | 42,7 % · 16,7 |
| Bazuca | ídem | pasa | 54,3 % · 16,0 |
| Granada | ídem + estalla a los 3 s de mecha | pasa | 20,7 % · 11,5 |
| Mazo | selección, golpe, radio/cráter/daño, aturdimiento, munición, turno | pasa | **5,3 %** · 24,8 |
| Tesla | selección, rayo recto, daño, cadena con caída, munición, turno | pasa | **13,0 %** · 15,1 |
| Hielo | ídem proyectil + congela | pasa | 51,4 % · 6,4 |
| Poción | ídem proyectil + charco con radio y turnos de datos | pasa | 69,2 % · 14,2 |

En las 480 partidas hubo 0 partidas sin terminar, 0 turnos forzados y 0 NaN.

**Dudosos (no se cambió ninguna regla):**
- El Mazo y el Tesla aciertan poco porque el bot no se acerca a su alcance (120 y 420 px), no porque fallen. Es comportamiento del bot.
- La vista previa del Tesla mide 220 px aunque su alcance real es 420, y la del Mazo 90 px con alcance de 120.

### 4. Pantallas

- **Escala:** `Phaser.Scale.EXPAND` más `src/ui/stage.ts`. No hay franjas, el HUD queda en el área de diseño centrada y la física no cambia.
- **Combate:** en pantallas anchas usa zoom uniforme y recorta una franja del cielo y del suelo. En pantallas altas muestra más cielo.
- **Capturas:** las 6 pantallas en 8 resoluciones, en `docs/capturas/resoluciones/`. Las medidas están en `medidas.json`.

| Resolución | Lienzo | Botón más chico | Texto más chico |
|---|---|---|---|
| 844×390 | llena 100 % | 45 px | 14 px |
| 1024×768 | llena 100 % | 67 px | 20 px |
| 1366×768 | llena 100 % | 89 px | 27 px |
| 1920×1080 | llena 100 % | 125 px | 38 px |
| 2560×1440 | llena 100 % | 166 px | 51 px |
| 360×640, 390×844, 768×1024 (vertical) | aviso "Gira tu dispositivo" | 23–50 px si se jugara en vertical | 7–15 px |

### 5. Pasa el dispositivo

"al" y la etiqueta del jugador forman una sola fila medida y centrada. La E2E comprueba en las 8 resoluciones que no se traslapan.

### 6. Colección

- **Logros:** tarjetas con su insignia `ach-*`, nombre, descripción, estado y progreso "X de N".
- **Cosméticos:** muestran su arte de `atlas-items`. Los que no tienen arte muestran nombre y candado; la lista está en `docs/FUTURO.md`.
- **Desplazamiento:** la lista se desplaza y Volver queda fijo.
- **Insignias:** `atlas-badges` contiene estados del combate, no logros.

### 7. Caché PWA

- **Nombre:** `frankentilleria-v2-<build>`.
- **Estrategia:** primero la red y revalidación de los archivos sin hash.
- **Instalación:** guarda la página, el código, los estilos y las fuentes.
- **Activación:** vuelve a pedir a la red los atlas que tenía el build anterior.
- **E2E:** tras un nuevo build se carga la versión nueva, solo queda su caché y abre sin conexión sin que falte ningún archivo.

### Pendiente de comprobar en un dispositivo real

Ver el resumen de la entrega. Lo principal:
- el impacto en un iPhone físico;
- la app anclada a la pantalla de inicio;
- la muesca y la barra de inicio;
- la vibración en Android;
- la actualización de la PWA en un despliegue real de Vercel.
