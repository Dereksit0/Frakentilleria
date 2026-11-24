# Auditoría final

Hice la auditoría sobre una copia limpia del repositorio en el commit `a898bea`, para que el trabajo de otras sesiones no mezclara los resultados. La regla fue que el comportamiento del juego no cambiara. La prueba de eso es `scripts/semillas.sim.ts`: juega 300 partidas entre bots expertos con las semillas 1 a 300 y guarda el resultado exacto de cada una (mapa, ganador, rondas, turnos, disparos, aciertos y daño). Corrí la simulación antes de tocar nada y después de cada cambio relevante. El archivo final es idéntico byte por byte al de la línea base (`docs/auditoria/semillas-base.json` contra `docs/auditoria/semillas-final.json`).

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
| Bundle JS | 1343.89 kB (372.20 kB gzip) | 1339.55 kB (370.50 kB gzip) |
| `dist/` | 9.0 MB | 8.0 MB |
| `tsc --noEmit` y ESLint sin advertencias | sin errores | sin errores, también con `--noUnusedLocals --noUnusedParameters` |
| Pruebas | 543 | 531 |
| Cobertura de `src/core` (sentencias, ramas, funciones, líneas) | 96.17, 90.3, 97.09, 97.67 | 96.18, 90.3, 97.09, 97.69 |
| Simulación de 300 semillas | referencia | idéntica |

Las líneas de `src/` subieron aunque quité código porque los comentarios en español, aunque más cortos en número, ocupan varias líneas cuando explican el porqué, y agregué lo que faltaba: la pantalla de error de carga y los campos de la simulación. Las 12 pruebas que bajaron salen de reemplazar dos archivos de pruebas de atlas por uno solo (`tests/atlas.test.ts`) que además comprueba que todo frame que nombra el código existe.

Capturas de las pantallas clave antes (`docs/auditoria/base/`) y después (`docs/auditoria/despues/`): menú, laboratorio, pasa el dispositivo, combate y resumen.

## Qué eliminé

- 36 exportaciones y constantes sin uso en `src/` que detectó `knip` (se les quitó `export`) y 2 declaraciones que no usaba nadie. La última pasada completa de `knip` no dejó exportaciones sin uso en `src/` (la repetición final falló por falta de memoria del equipo, no por el código). Quedan 8 archivos que `knip` marca como sin uso: siete son herramientas que se corren a mano (`scripts/chart-balance.mjs`, `preview-*.mjs`, `rig-*.mjs`) y `public/sw.js`, que se registra por nombre desde `src/main.ts`. Los dejé a propósito.
- `depcheck` y `npm run` no encuentran dependencias ni scripts sin uso.
- 96 frames de arte que ninguna mecánica usa: íconos de armas que no existen, insignias de estado y de evento, efectos de armas no implementadas, logros, cajas trampa, cofre, sombreros, parches, lápidas y los 18 obstáculos de mapa. Salieron del build y quedaron en `docs/FUTURO.md` con su id y su uso previsto. El pipeline sigue sabiendo generarlos: se quita el nombre del conjunto `FUTURO` de `scripts/sheets.mjs`. También se fueron `atlas-objects`, `cosmeticRig.json` y el campo `plannedIcons` de `weapons.json`.
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
