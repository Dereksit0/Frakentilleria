# Correcciones: los cuerpos se cruzaban y el juego se traba al impactar

## Cómo funcionaba antes (resumen)

- **Movimiento** (`src/core/unit.ts`): `stepUnit` movía a cada criatura sin saber nada de la otra. Caminar (`walk`) solo miraba el terreno; en el aire, `x += vx·dt` con un cheque contra paredes. Otros movimientos: la cinta (`world.carry`), el empuje de explosiones (`vx`/`vy` + `launched`), saltos y muelles; el spawn solo ponía las `x` del mapa.
- **No había ninguna colisión criatura contra criatura**: el círculo de impacto (`UNIT_RADIUS`) solo servía para los disparos. Una criatura podía caminar a través del rival o ser empujada a través de él, y el orden izquierda/derecha cambiaba.
- **Secuencia del disparo** (`battle.ts`): `fire()` → proyectil en `stepProjectiles` (subpasos de 1/120 s) → `explode`/`explodeCore` (daño, empuje, cráter, evento `explosion`/`damage`/`death`) → `update` espera a que no haya proyectiles y todos estén en el suelo (`settled`) y, si el reloj terminó o alguien murió, llama a `endTurn()` → `startTurn()`. La escena (`Battle.ts`) solo dibuja los eventos que el núcleo deja en la cola.

## Parte 1: los personajes no se atraviesan

**Qué se hizo (núcleo, con pruebas primero).**
- `BODY_HALF_WIDTH = 26` (el torso ensamblado mide ≈ 150 px y las criaturas se dibujan a escala 0,34 → ≈ 51 px de cuerpo) y `BODY_GAP = 52`: distancia mínima entre centros.
- `resolveHorizontalMove(x, otroX, deseadoX, moverIsLeft)` (pura): recorta contra el cuerpo del rival por ambos lados, sin importar el tamaño del paso (no hay efecto túnel); alejarse siempre es libre y, si ya están superpuestos, no se puede avanzar más. `separateBodies` los devuelve a sus lados de forma determinista.
- La usan **todos** los movimientos: caminar (`walk`), el vuelo y el **knockback** (`stepUnit`, se anula `vx` al chocar), la cinta transportadora (`carry`), y no hay otras mecánicas de desplazamiento todavía (gancho y portales de criaturas no existen; los portales solo mueven proyectiles). Cada criatura tiene `side` (−1 izquierda, +1 derecha) fijado al crear la partida; al crearla y **al inicio de cada turno** se separan si quedaron superpuestas.
- `Battle.update` limita el `dt` a `MAX_UPDATE_DT = 0,1 s` y mueve a las criaturas en subpasos de ≤ 1/60 s; `move()` también (con dt grande).
- Caminar contra el rival pegado no gasta el tiempo de movimiento, así que el bot no se queda empujando (usa el mismo cuerpo).

**Pruebas** (`tests/bodies.test.ts`, 14): no atraviesa caminando hacia él, no lo atraviesa con dt grande (0,5 s), el de la derecha tampoco, el knockback se detiene en el cuerpo del rival, no quedan superpuestos al empezar el turno ni al crear la partida, y el orden se conserva en 300 partidas del bot.

**Simulación de 1000 partidas** (`scripts/bodies.sim.ts`, semillas distintas, mezcla de bots experto/novato, 2.798.839 pasos observados): **0 inversiones de orden, 0 superposiciones**, separación mínima observada 52,00 px (= `BODY_GAP`), máximo 25 turnos por partida, **0 partidas atascadas**.

**Efecto en el balance** (300 partidas, semillas fijas; antes = tabla de `BALANCE_RONDA3.md`): antes algunas partidas se cruzaban y eso se corrige.

| Experto – experto | Antes | Después |
|---|---|---|
| Rondas medias | 9,0 | 8,9 |
| Gana quien da el primer golpe | 52,7 % | 58,6 % |
| Empates | 0,7 % | 1,0 % |
| Remontadas | 19,0 % | 21,0 % |

Sigue dentro de las metas (rondas 7–11, primer golpe ≤ 60 %, empates ≤ 5 %) y las remontadas pasan de 20 % por primera vez; el primer golpe sube porque ya no se puede esquivar cruzando al rival. En novato – novato: 10,6 rondas, 54,2 %, 1,0 %, 6,3 %; experto – novato: 9,5 rondas, 58,9 %, 0,3 %, 14,3 %.
