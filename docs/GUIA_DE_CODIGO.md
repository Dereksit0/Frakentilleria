# Guía del código

Esta guía sirve para que cada integrante pueda explicar la parte que hizo. Empieza por el mapa de carpetas, sigue con cómo pasa un turno y termina con qué concepto del curso se ve en cada lugar.

## Las cuatro capas

1. Datos en `src/data/`. Son archivos JSON con las piezas, las armas, los mapas, las cajas, los eventos y los ajustes. Cambiar un número aquí cambia el juego sin tocar código.
2. Núcleo en `src/core/`. Son las reglas del juego escritas en TypeScript puro. No importa Phaser ni toca el navegador, por eso se puede probar con Vitest y simular miles de partidas.
3. Interfaz en `src/ui/`. Dibuja y anima lo que el núcleo calcula: la criatura, las barras de vida, el ácido, el viento y los botones. La parte que no necesita Phaser vive en `src/ui/model/` y también tiene pruebas.
4. Escenas en `src/scenes/`. Son las pantallas de Phaser. Leen el estado del núcleo en cada cuadro y le pasan lo que hace el jugador.

El diagrama está en `docs/diagramas/arquitectura.png`.

## Qué hace cada carpeta y cada archivo importante

### src/data

- `parts.json`: los cinco donantes, el costo y el efecto de cada pieza, qué arma o habilidad da, el presupuesto de 22 puntos y los valores base.
- `weapons.json`: las ocho armas con su daño, radio, cráter, munición, dispersión y comportamiento, y las habilidades.
- `maps.json`: los tres mapas, con capas de fondo, terreno, puntos de salida, peligros y viento.
- `tuning.json`: ajustes de reglas como la ráfaga máxima, la gracia de salida del proyectil o la cobertura del terreno.
- `crates.json`, `events.json`, `cosmetics.json`: cajas, eventos de ronda y la colección.
- `anchors.json` y `rig.json`: puntos de unión de cada pieza de arte. Los genera `npm run assets` y se corrigen a mano.
- `taunts.json`: la burla de cada cabeza.

### src/core

- `data.ts` carga los JSON y los tipa. Es la única puerta de entrada a los datos.
- `stats.ts`, `dna.ts`: calculan las estadísticas de una criatura a partir de sus cuatro piezas, el presupuesto y el código de 8 caracteres para compartirla.
- `rng.ts`: generador con semilla. Todo el azar del juego pasa por aquí, y por eso una partida se puede repetir.
- `terrain.ts`, `maps.ts`: el terreno es un byte por píxel que se puede abrir con círculos. `maps.ts` valida los mapas y construye el terreno desde el alfa del arte.
- `ballistics.ts`: simula el vuelo de un proyectil con gravedad, viento y ráfagas.
- `damage.ts`: la fórmula de daño, la caída del daño con la distancia y el daño por caída.
- `unit.ts`: una criatura en el mundo, con su movimiento, salto y caída.
- `turns.ts`: el reloj del turno (20 s, 6 s de movimiento, una acción, 3 s de retirada), el orden de los jugadores y el sorteo del viento.
- `battle.ts`: la partida entera. Une todo lo anterior, dispara, explota, empuja, aplica estados y decide quién gana. Suelta eventos que las escenas leen para dibujar.
- `world.ts`: obstáculos, peligros por mapa y eventos de ronda.
- `acid.ts`: la altura del ácido en cada ronda.
- `bot.ts`, `sim.ts`: el bot que elige arma y puntería, y el simulador que juega partidas completas. Con ellos se mide el balance.
- `rig.ts`: calcula dónde va cada pieza de la criatura y cómo gira el brazo al apuntar.
- `flow.ts`: qué hace el botón Atrás en cada pantalla.
- `rewards.ts`: cofre de remiendos, colección y logros.
- `windVisual.ts`, `aim.ts`, `tuning.ts`, `contrast.ts`: descripción del viento para la interfaz, puntería neutra, ajustes de reglas y cálculo de contraste.

### src/ui

- `creatureView.ts`: dibuja una criatura con las posiciones de `rig.ts` y las poses de `model/anim.ts`.
- `model/anim.ts`: máquina de estados de las animaciones (reposo, caminar, apuntar, dolor, burla, derrota) con prioridades. No usa Phaser.
- `healthBar.ts` y `model/healthBar.ts`: la barra de vida y el modelo que decide su aspecto.
- `acidLayer.ts`, `windFx.ts`, `worldView.ts`, `painFx.ts`, `speechBubble.ts`, `floatingNumbers.ts`: efectos visuales.
- `widgets.ts`, `theme.ts`, `modal.ts`: botones, colores, tamaños y el diálogo de confirmar.
- `audio.ts`, `settings.ts`, `session.ts`: sonido, ajustes guardados y datos que pasan de una escena a otra.
- `viewport.ts`, `device.ts`, `install.ts`, `fullscreen*.ts`, `backNav.ts`, `model/mobile.ts`: todo lo de teléfonos y tabletas.

### src/scenes

`Boot` carga los archivos y avisa si falta uno necesario. Después vienen `Splash`, `Menu`, `Lab` (el laboratorio de Víctor), `PassDevice`, `Battle` con su `Hud`, `Pause`, `Result`, `Tutorial`, `Settings` y `Coleccion`.

### El resto

- `tests/` tiene las pruebas de Vitest, una por módulo del núcleo y de los modelos.
- `e2e/` tiene las pruebas de navegador con Playwright.
- `scripts/` tiene el pipeline de arte (`build-assets.mjs`, `sheets.mjs`, `donors.mjs`, `acid.mjs`), el simulador (`simulate.sim.ts`), el recorrido de semillas fijas (`semillas.sim.ts`) y la prueba de estrés (`estres.sim.ts`).

## Cómo pasa un turno

El diagrama está en `docs/diagramas/flujo-turno.png`. En palabras:

1. `Battle` (escena) llama a `core.update(dt)` en cada cuadro. Si el jugador toca un botón, la escena llama a `move`, `setAim`, `selectWeapon`, `useAbility` o `fire` del núcleo.
2. Al empezar el turno, `turns.ts` sortea el viento y `world.ts` anuncia lo que pasará la ronda siguiente.
3. En la fase de apuntar el jugador puede caminar hasta 6 s en total. `unit.ts` mueve a la criatura sobre el terreno. Al disparar, `fire` crea un proyectil con la velocidad de `ballistics.ts` y el reloj pasa a la retirada de 3 s.
4. Mientras el proyectil vuela, `battle.ts` lo mueve con gravedad, viento y ráfagas. Cuando toca el terreno o una criatura explota: abre un cráter en `terrain.ts`, calcula el daño con `damage.ts`, empuja y aplica estados como congelar o aturdir.
5. Al cerrar el turno actúan los charcos, el ácido si ya llegó la ronda 6 y los eventos de ronda. Si queda más de una criatura viva, juega la siguiente.
6. Todo lo que pasa sale como un evento (`drainEvents`). La escena los lee y dibuja explosiones, números de daño, sonidos y animaciones. El núcleo nunca dibuja.

## De dónde salen los datos de las piezas

El diagrama está en `docs/diagramas/datos-piezas.png`. `parts.json` define cada pieza. `core/data.ts` la carga y `stats.ts` suma los efectos de las cuatro piezas elegidas. El laboratorio muestra esas estadísticas y el presupuesto. `unit.ts` crea la criatura con esa vida y movilidad, y `battle.ts` le da las armas que `weaponsFor` saca de los brazos y el torso. El dibujo viene de `public/assets/atlas.json`, con un sprite por donante y ranura.

## Qué concepto del curso se ve dónde

| Concepto | Dónde se ve |
|---|---|
| Diseño primero y datos en JSON | `design-prototype/`, `src/data/`, `docs/DECISIONES_JUEGO.md` |
| TDD | `tests/` junto a `src/core/`, ciclo en `docs/diagramas/ciclo-tdd.png` |
| Pruebas unitarias | `npm test`, 565 pruebas de Vitest |
| Pruebas de navegador | `e2e/`, con Playwright en PC, móvil y Safari |
| Simulación para balancear | `src/core/bot.ts`, `src/core/sim.ts`, `docs/balance/` |
| AGENTS.md | `AGENTS.md` |
| Skills y agente personalizado | `docs/ia/skills/` |
| MCP | `docs/ia/mcp.md` |
| Prompting y refinamiento iterativo | `PROMPTS.md` |
