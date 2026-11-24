# Arte que está en el pipeline pero todavía no se usa

Estos frames existen como hojas en `assets/raw` y están definidos en `scripts/sheets.mjs`, pero ninguna mecánica del juego los dibuja, así que no entran al build. Para volver a generar uno se quita su nombre del conjunto `FUTURO` de `scripts/sheets.mjs` y se corre `npm run assets`. El atlas donde caería cada uno lo decide el prefijo (ver `src/ui/atlasRefs.ts`).

## Armas que no existen todavía

| Frame | Uso previsto |
|---|---|
| icon-mina, fx-mina-armada | mina que se arma en el suelo |
| icon-dinamita, fx-dinamita-encendida | dinamita con mecha |
| icon-ataque-aereo, fx-misil-ataque-aereo, fx-marcador-ataque-aereo | bombardeo con marcador previo |
| icon-taladro | arma de excavación |
| icon-senuelo, fx-senuelo | señuelo de cuerpo completo |
| icon-gancho, fx-gancho-cabeza | gancho con cuerda |
| icon-cuervos, fx-cuervo-1, fx-cuervo-2, fx-cuervo-3 | bandada de cuervos (tres cuadros de aleteo con el mismo ancla) |
| icon-escudo-reflector, fx-burbuja-escudo | escudo que devuelve proyectiles |
| fx-mazo-onda | onda de impacto del mazo |
| fx-tierra-salpicadura | tierra que salta al cavar o explotar |

## Eventos de ronda y estados

| Frame | Uso previsto |
|---|---|
| ev-meteor, ev-meteor-small, ev-scorch-mark, ev-impact-ring, ev-warning-mark | lluvia de meteoritos |
| ev-lightning-vertical, ev-storm-cloud | tormenta eléctrica |
| ev-low-gravity-feathers | gravedad baja |
| badge-meteoritos, badge-tormenta, badge-gravedad-baja, badge-luna-llena, badge-viento | banner de eventos de ronda |
| badge-acido, badge-aturdido | estados bajo la barra de vida |
| fx-acid-drop, fx-acid-bubble, fx-acido-charco | gotas y burbujas de ácido, charco de la poción |
| fx-anger-mark, fx-exclamation | reacciones de las criaturas |

## Cajas, cofre, cosméticos y tumbas

| Frame | Uso previsto |
|---|---|
| crate-utility, crate-weapon | cajas actuales con arte propio (hoy se usa item_mystery) |
| crate-mimic-closed, crate-mimic-open | caja trampa |
| fx-parachute, fx-signal-flare | caída de cajas con paracaídas y bengala |
| chest-closed, chest-open | cofre de remiendos al final de la partida |
| hat-top, hat-party, hat-crown, hat-propeller | sombreros de la colección |
| patch-star, patch-skull | parches de la colección |
| grave-tombstone, grave-tombstone-broken | lápida cuando una criatura cae |

Para los sombreros hay decisiones tomadas que conviene respetar al conectarlos. No se rotan. El ancla de cada sombrero es el centro de su base. La parte alta de la cabeza se mide como la primera fila con al menos el 45 % del ancho máximo, para que la antena del Juguete y el plumero de la Armadura no cuenten. En la Armadura y el Espantapájaros el sombrero cosmético se desactiva porque esas cabezas ya llevan casco con plumero y sombrero de bruja. Los parches necesitan un punto por torso, que se puede poner al 55 % de la altura del torso.

## Interfaz y logros

| Frame | Uso previsto |
|---|---|
| hud-heart, hud-wind, hud-clock, hud-skull | iconos del panel de equipo, el viento y el reloj (hoy se dibujan por código) |
| hud-back, hud-sound, ui-muted | botones de Atrás y de sonido en Ajustes |
| hud-ammo | munición en el selector de armas |
| ui-trophy, ui-star | pantalla de resumen |
| ui-lock | elementos de la colección sin desbloquear |
| ui-check, ui-close | botones de los modales de confirmación |
| ach-locked | logro bloqueado en la pantalla de logros |

## Obstáculos de mapa

Todos van en un atlas aparte (`atlas-objects`) que hoy no se genera. Hay que decidir primero en qué mapa va cada uno y cómo interactúa con el terreno.

| Frame | Mapa o uso |
|---|---|
| obj-tnt-barrel, obj-wall-destructible, obj-spring-pad, obj-fan, obj-portal-blue, obj-portal-orange, obj-bridge, obj-bridge-broken, obj-rope-segment | obstáculos comunes |
| obj-crane-claw, obj-scrap-pile | Vertedero |
| obj-zombie-hand, obj-tombstone-falling, obj-fog-bank | Cementerio |
| obj-conveyor, obj-rolling-ball, obj-toy-blocks, obj-wrecking-ball | Fábrica de juguetes |

## Arte y audio que nunca llegó

Terreno y capa intermedia de la Fábrica, capa intermedia del Cementerio, íconos de habilidades de cabeza, expresiones de cabezas, arte de la pantalla de resultados, una segunda y tercera pista de música y los efectos de sonido.
