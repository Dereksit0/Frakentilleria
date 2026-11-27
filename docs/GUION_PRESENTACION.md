# Guion de la presentación

Dura entre 5 y 10 minutos. Los tiempos son una guía; cada integrante habla de la parte que hizo.

## 1. Qué es el juego (1 minuto)

Artillería por turnos para dos jugadores. Cada uno arma una criatura con piezas de cinco donantes y pelean en un mapa con terreno que se rompe y viento que cambia. Gana el último en pie. Mostrar la portada y el menú.

## 2. El laboratorio (1 minuto)

Abrir el laboratorio. Cambiar una pieza y mostrar cómo cambian la vida, la movilidad, la resistencia y el daño, y el presupuesto de 22 puntos. Decir que todo sale de `src/data/parts.json` y que se puede balancear sin tocar código. Mostrar el botón Al azar y el código de ocho caracteres para compartir una criatura.

## 3. Un combate (2 minutos)

Jugar un par de turnos. Señalar de quién es el turno, la vida de cada criatura, el reloj, el viento y el cambio de arma. Disparar con el cañón y después con un arma con munición. Mostrar que solo hay una acción de ataque por turno.

## 4. Terreno destructible y viento (1 minuto)

Disparar al terreno para abrir un cráter y mostrar cómo cambia por dónde se puede caminar. Mostrar el viento en el HUD y cómo desvía el tiro, y las ráfagas durante el vuelo. Mostrar el ácido que sube desde la ronda 6.

## 5. Las pruebas (1 minuto)

Correr `npm test` y mostrar que son 565 pruebas del núcleo y de los modelos. Mostrar una prueba escrita antes que el código (`tests/damage.test.ts`) y el simulador con bots que usamos para medir el balance (`docs/balance/BALANCE_RESUMEN.md`). Contar que la auditoría final comprobó que 300 partidas con semillas fijas dan el mismo resultado antes y después de limpiar el código.

## 6. El uso de IA (1 minuto)

Mostrar `AGENTS.md`, `PROMPTS.md` con las iteraciones y el agente de balance. Explicar qué decidimos nosotros: descartamos un bono que no movía las métricas, aceptamos que la meta de remontadas no se alcanzó y pedimos una condición medible para la limpieza.

## 7. Puntos fuertes del código (1 minuto)

- El núcleo no depende de Phaser, por eso se puede probar y simular.
- Todo el azar usa una semilla, así que una partida se repite igual.
- El balance vive en JSON.
- El mismo juego funciona en PC, teléfono y tableta, y se probó en Chrome y Safari.

## Antes de presentar

Probar el juego en el equipo donde se va a presentar, tener el repositorio abierto en `docs/GUIA_DE_CODIGO.md` y acordar quién maneja el teclado en cada parte.
