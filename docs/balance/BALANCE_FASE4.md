# Balance Fase 4: cajas, remontada y recompensas

## Qué cambió

- **Cajas** (`crates.json`): salud, escudo, tiempo (utilidad: más segundos de movimiento), puño, munición (arma), **misteriosa** (55 % bonus: curar 20 / escudo / +30 % daño; 45 % trampa: 12 de daño sin matar) e **imitadora** (explota al recogerla, 14 de daño sin matar y empuje). Caen en **paracaídas** (160 px/s, antes 400) y ahora cada 3 turnos.
- **Remontada**: si la diferencia de vida entre las dos criaturas llega a 20 % de la vida máxima, el 90 % de las cajas cae a ±220 px de quien va perdiendo y las de salud/escudo/munición pesan ×6 (`catchUp`: `gap`, `pull`, `spread`, `favored`).
- **Cofre de remiendos** al terminar cada partida (1 objeto; 2 si hubo ganador): parches, sombreros y colores sin efecto en combate (`cosmetics.json`, 16 objetos, rarezas común/raro/épico). Se guardan en `localStorage` (con `try/catch`; si el navegador lo bloquea funciona en memoria).
- **Pantalla Colección** (Menú → Colección): ver, equipar y guardar objetos; 8 logros (`Primera victoria`, `Veterano de chatarra`, `¡Remontada!`, `Tiro certero`, `Al límite`, `Relámpago`, `Baño ácido`, `Arsenal completo`). Los cosméticos son marcadores dibujados por código (la forma indica el tipo: cuadrado = parche, triángulo = sombrero, círculo = color).
- Pruebas nuevas: `tests/crates4.test.ts` (9) y `tests/rewards.test.ts` (18).

## Antes / después (300 partidas, experto vs experto)

| Métrica | Línea base | Fase 3 | Fase 4 | Meta | ¿Cumple? |
|---|---|---|---|---|---|
| Gana quien da el primer golpe | 69.3 % | 52.7 % | 53.7 % | ≤ 60 % | Sí |
| Empates | 3.0 % | 1.3 % | 0.0 % | ≤ 5 % | Sí |
| Rondas medias | 7.1 | 9.6 | 9.8 | 10–16 | Casi |
| Remontadas | 3.7 % | 13.0 % | 12.7 % | ≥ 20 % | **No** |
| Mayor cuota de daño (Bazuca) | 51.4 % | 31.1 % | 30.5 % | ≤ 35 % | Sí |
| Arma más elegida (Bazuca) | 32.5 % | 25.9 % | 21.5 % | ≤ 40 % | Sí |

## La meta de remontadas no se alcanza

Se probó (150–300 partidas cada una, experto vs experto; el experto ahora va a buscar cajas que estén a su alcance a pie):

| Variante | Remontadas |
|---|---|
| Cajas cada 4 turnos, curar 25, ayuda 70 % | 11.0 % |
| Cada 3 turnos, ayuda 90 %, ×5 | 11.7 % |
| Cada 2 turnos, ayuda 90 %, ×5 | 15.0 % |
| Cada 3 turnos, curar 45, ×8 | 13.0 % |
| Cada 2 turnos, curar 45, ×8 | 15.7 % |
| Bono de daño al que va perdiendo (+25 %, +60 %, +100 %) | 12.7 %, 13.0 %, 14.3 % |

Lectura: las cajas y el bono apenas mueven el indicador (±3 puntos, dentro del ruido de 300 partidas) y a cambio inundan el mapa de cajas. Con el valor elegido (cada 3 turnos) se queda en ≈ 13 %. La razón es estructural: cuando alguien llega al 40 % de la vida del rival, la partida ya tiene pocos turnos por delante (≈ 10 rondas en total) y el ácido las cierra. Lo que probaría después: (1) partidas más largas, con vida base mayor o ácido más tardío (el ácido de la ronda 6 viene del HANDOFF, así que lo dejé); (2) que el experto use los peligros del mapa (barriles, resorte) y no solo cajas; (3) una "segunda oportunidad" explícita (curación grande al caer bajo cierto umbral). El bono de daño se descartó (invisible para el jugador y sin efecto medible).

Reproducir: `SIM_N=300 SIM_OUT=docs/balance/BALANCE_FASE4.md npm run simulate`.

## Resultados de la simulación completa


300 partidas por emparejamiento, semillas 1000..1299, mapas rotados.

### experto vs experto

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 53.7 % |
| Empates | 0.0 % |
| Rondas medias | 9.8 |
| Turnos medios | 18.9 |
| Daño medio por turno | 4.4 |
| Turnos con acierto | 55.1 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 12.7 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 30.5 % | 19.5 % | 67.0 % |
| Poción ácida | 21.6 % | 8.3 % | 80.5 % |
| Mortero | 15.6 % | 11.7 % | 55.6 % |
| Cañón | 12.6 % | 21.5 % | 53.5 % |
| Ráfaga de hielo | 11.3 % | 19.5 % | 62.5 % |
| Granada de calabaza | 7.6 % | 18.9 % | 24.6 % |
| Rayo Tesla | 0.7 % | 0.4 % | 68.2 % |
| Mazo de justa | 0.3 % | 0.2 % | 100.0 % |

### novato vs novato

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 51.9 % |
| Empates | 0.7 % |
| Rondas medias | 10.7 |
| Turnos medios | 20.6 |
| Daño medio por turno | 1.8 |
| Turnos con acierto | 25.8 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 3.3 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Cañón | 29.3 % | 43.4 % | 25.8 % |
| Bazuca | 22.4 % | 13.0 % | 31.4 % |
| Granada de calabaza | 14.0 % | 15.2 % | 21.2 % |
| Poción ácida | 13.8 % | 5.8 % | 30.3 % |
| Mortero | 11.0 % | 6.8 % | 27.0 % |
| Ráfaga de hielo | 6.9 % | 13.1 % | 24.8 % |
| Rayo Tesla | 2.1 % | 1.5 % | 22.5 % |
| Mazo de justa | 0.5 % | 1.2 % | 9.9 % |

### experto vs novato

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 52.5 % |
| Empates | 0.7 % |
| Rondas medias | 10.1 |
| Turnos medios | 19.3 |
| Daño medio por turno | 3.1 |
| Turnos con acierto | 39.9 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 11.0 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 27.3 % | 15.9 % | 51.5 % |
| Poción ácida | 19.0 % | 7.0 % | 60.5 % |
| Cañón | 18.6 % | 33.9 % | 34.4 % |
| Mortero | 14.4 % | 9.1 % | 45.1 % |
| Ráfaga de hielo | 9.3 % | 15.6 % | 45.8 % |
| Granada de calabaza | 8.8 % | 16.2 % | 22.7 % |
| Rayo Tesla | 2.0 % | 1.4 % | 43.4 % |
| Mazo de justa | 0.7 % | 0.9 % | 29.4 % |

