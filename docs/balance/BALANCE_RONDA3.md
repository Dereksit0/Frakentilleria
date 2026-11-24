# Balance ronda 3: partidas un poco más rápidas

Cambio: `src/data/tuning.json → balance.globalDamageMultiplier` (**1,5**, `TODO(balance)`: provisional). Es el valor por defecto de `rules.damageScale` y multiplica el daño de **armas** (impacto, explosión, mazo, Tesla, barril). La caída, el ácido y la tormenta ácida no lo usan (prueba en `tests/globalDamage.test.ts`); las estadísticas del Laboratorio y el balance relativo entre armas no cambian.

Método: bot (`docs/BOT.md`), 300 partidas con semillas fijas 1000..1299, mapas rotados. Barrido experto contra experto (`SIM_RULES='{"damageScale":X}' npm run simulate`):

| Multiplicador | Primer golpe | Empates | Rondas medias | Remontadas | Bazuca (% daño) |
|---|---|---|---|---|---|
| 1,0 (antes) | 53,0 % | 0,0 % | 9,8 | 12,7 % | 30,7 % |
| 1,15 | 54,2 % | 0,3 % | 9,6 | 14,3 % | — |
| 1,3 | 52,2 % | 1,0 % | 9,4 | 16,7 % | — |
| **1,5 (elegido)** | **52,7 %** | **0,7 %** | **9,0** | **19,0 %** | **32,4 %** |
| 1,7 | 55,7 % | 0,7 % | 8,5 | 18,7 % | 32,8 % |
| 2,0 | 56,2 % | 0,3 % | 7,8 | 18,7 % | 33,3 % |

Se empezó con ~1,3, como se pedía: bajaba las rondas muy poco (9,8 → 9,4) porque la duración está limitada sobre todo por el ácido de la ronda 6, no por el daño. Se eligió 1,5 porque acerca las remontadas a la meta sin disparar el primer golpe. No se adelantó el ácido.

## Antes / después (300 partidas por emparejamiento)

| Emparejamiento | Métrica | Antes (×1,0) | Después (×1,5) | Meta nueva |
|---|---|---|---|---|
| experto – experto | Rondas medias | 9,8 | **9,0** | 7–11 ✔ |
| | Primer golpe gana | 53,0 % | 52,7 % | ≤ 60 % ✔ |
| | Empates | 0,0 % | 0,7 % | ≤ 5 % ✔ |
| | Remontadas | 12,7 % | **19,0 %** | ≥ 20 % ✘ (a 1 punto; el ruido de 300 partidas es de ±2,3) |
| | Bazuca, % del daño | 30,7 % | 32,4 % | ≤ 35 % ✔ |
| novato – novato | Rondas medias | 10,7 | 10,7 | 7–11 ✔ |
| | Primer golpe gana | 51,9 % | 55,2 % | ≤ 60 % ✔ |
| | Empates | 0,7 % | 0,7 % | ≤ 5 % ✔ |
| | Remontadas | 2,7 % | 6,7 % | ≥ 20 % ✘ |
| experto – novato | Rondas medias | 10,1 | 9,7 | 7–11 ✔ |
| | Primer golpe gana | 51,9 % | 57,4 % | ≤ 60 % ✔ |
| | Empates | 0,7 % | 1,0 % | ≤ 5 % ✔ |
| | Remontadas | 10,3 % | 13,0 % | ≥ 20 % ✘ |

**Honestamente:** las rondas ya estaban dentro de la banda 7–11 con el daño anterior (9,8); el multiplicador las baja a 9,0 y mejora las remontadas, pero **la meta de remontadas ≥ 20 % sigue sin cumplirse** en ningún emparejamiento (la mejor, 19,0 %). El mayor efecto negativo es en novato contra experto: el primer golpe sube a 57,4 % (sigue bajo el 60 %).
