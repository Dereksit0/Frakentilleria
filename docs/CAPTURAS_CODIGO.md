# Fragmentos de código para el reporte

Estos diez fragmentos muestran los conceptos del curso en el código. Las capturas están en `docs/capturas/informe/`. Los rangos de líneas son los del repositorio en el momento de escribir esto; si se edita el archivo, hay que volver a sacar la captura.

| Captura | Archivo y líneas | Concepto que muestra |
|---|---|---|
| `01-prueba-tdd-dano.png` | `tests/damage.test.ts`, 1 a 20 | TDD: la prueba describe la fórmula del daño antes del código |
| `02-json-de-piezas.png` | `src/data/parts.json`, 1 a 60 | Piezas definidas en datos, balanceables sin tocar código |
| `03-calculo-de-dano.png` | `src/core/damage.ts`, 1 a 26 | Fórmula `base × (1 + bono) × (1 − resistencia)`, caída con la distancia y daño por caída |
| `04-generador-con-semilla.png` | `src/core/rng.ts`, 1 a 37 | Todo el azar pasa por un generador con semilla, por eso las partidas se pueden repetir |
| `05-reloj-del-turno.png` | `src/core/turns.ts`, 12 a 62 | Reglas del turno: movimiento acumulado, una sola acción y retirada |
| `06-balistica-con-viento.png` | `src/core/ballistics.ts`, 39 a 75 | Vuelo del proyectil con gravedad y viento, y choque con el terreno |
| `07-maquina-de-estados-de-animacion.png` | `src/ui/model/anim.ts`, 75 a 105 | Máquina de estados con prioridades, sin depender de Phaser |
| `08-solucionador-de-ensamble.png` | `src/core/rig.ts`, 182 a 232 | Ensamble de la criatura a partir de anclas de cada pieza |
| `09-terreno-destructible.png` | `src/core/terrain.ts`, 67 a 90 | Terreno de un byte por píxel que se abre con círculos |
| `10-simulacion-con-bot.png` | `src/core/sim.ts`, 51 a 72 | Simulación de partidas completas con bots para medir el balance |
