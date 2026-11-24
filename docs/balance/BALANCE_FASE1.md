# Balance Fase 1: romper la repetición y dar valor a la posición

Cambios (todo por datos en `src/data/tuning.json` y `weapons.json`, números `TODO(balance)`):
viento nuevo por turno + ráfagas durante el vuelo, puntería neutra cada turno, dispersión por arma (crece con potencia y distancia caminada), empuje (con arranque horizontal aunque el golpe sea directo), cobertura de terreno contra explosiones (×0.5), ácido letal al tocarlo, salida lateral del mundo mortal si te lanzan, vista previa corta (0.45 s).
Para medir se bajó el daño de todas las armas a la mitad (los combates eran de 3–4 impactos) y se duplicó la dispersión; barrido en la tabla de abajo.

## Antes / después (experto vs experto, 300 partidas, semillas 1000–1299)

| Métrica | Línea base | Fase 1 | Meta | ¿Cumple? |
|---|---|---|---|---|
| Gana quien da el primer golpe | 69.3 % | 62.1 % | ≤ 60 % | Casi |
| Empates | 3.0 % | 0.3 % | ≤ 5 % | Sí |
| Rondas medias | 7.1 | 10.5 | 10–16 | Sí (límite bajo; lo acota el ácido) |
| Remontadas | 3.7 % | 6.0 % | ≥ 20 % | No |
| Mayor cuota de daño (Bazuca) | 51.4 % | 55.7 % | ≤ 35 % | No |
| Arma más elegida | 32.5 % | 28.8 % | ≤ 40 % | Sí |
| Turnos con acierto | 66.5 % | 56.7 % | — | — |

## Barrido que llevó a estos valores (150 partidas, experto vs experto)

| `damageScale` / `spreadScale` | Primer golpe | Empates | Rondas | Remontadas |
|---|---|---|---|---|
| 1 / 1 (solo reglas nuevas) | 64.9 % | 0.0 % | 7.5 | 9.3 % |
| 0.6 / 2 | 65.3 % | 1.3 % | 10.1 | 2.7 % |
| 0.45 / 2 | 61.7 % | 0.0 % | 10.7 | 5.3 % |
| 0.45 / 3 | 63.3 % | 0.7 % | 10.7 | 5.3 % |

Lo que dice el dato:

- La dispersión **sola** casi no mueve el primer golpe (66 % → 68 %): el experto sigue acertando más de la mitad y el primero que golpea sigue ganando. Lo que sí lo baja es alargar la partida (menos daño por impacto).
- Con el ácido letal, el techo de duración son ~10–13 rondas: si nadie gana a tiempo, el ácido decide. Un empate por ácido lo gana la criatura con más vida.
- Remontadas y cuota de la Bazuca **no cumplen**: con una sola arma fuerte y sin cajas ni movimiento táctico no hay forma de remontar. Es lo que atacan las Fases 2 (armas distintas) y 4 (cajas de remontada). Ajuste que probaría después: tope de daño de la Bazuca y que el bot experto use cobertura y retirada.

Reproducir: `SIM_N=300 SIM_OUT=docs/balance/BALANCE_FASE1.md npm run simulate` (con `SIM_RULES='{"damageScale":0.6}'` para barridos).

## Resultados de la simulación completa


300 partidas por emparejamiento, semillas 1000..1299, mapas rotados.

### experto vs experto

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 62.1 % |
| Empates | 0.3 % |
| Rondas medias | 10.5 |
| Turnos medios | 20.2 |
| Daño medio por turno | 4.3 |
| Turnos con acierto | 56.7 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 6.0 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 55.7 % | 28.5 % | 80.9 % |
| Ráfaga de hielo | 20.7 % | 28.8 % | 76.7 % |
| Rayo Tesla | 12.6 % | 12.3 % | 43.6 % |
| Granada de calabaza | 10.9 % | 26.5 % | 23.2 % |
| Mazo de justa | 0.1 % | 3.9 % | 2.1 % |

### novato vs novato

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 70.0 % |
| Empates | 0.3 % |
| Rondas medias | 10.3 |
| Turnos medios | 19.8 |
| Daño medio por turno | 2.0 |
| Turnos con acierto | 27.2 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 0.7 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 44.4 % | 23.8 % | 39.2 % |
| Granada de calabaza | 22.8 % | 26.4 % | 22.9 % |
| Ráfaga de hielo | 14.7 % | 23.6 % | 33.8 % |
| Rayo Tesla | 13.8 % | 17.5 % | 16.1 % |
| Mazo de justa | 4.4 % | 8.7 % | 12.5 % |

### experto vs novato

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 72.4 % |
| Empates | 1.7 % |
| Rondas medias | 10.5 |
| Turnos medios | 20.2 |
| Daño medio por turno | 3.1 |
| Turnos con acierto | 40.1 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 5.0 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 51.3 % | 25.5 % | 60.3 % |
| Ráfaga de hielo | 17.7 % | 24.9 % | 55.5 % |
| Rayo Tesla | 15.1 % | 17.2 % | 26.6 % |
| Granada de calabaza | 15.0 % | 26.0 % | 23.2 % |
| Mazo de justa | 0.9 % | 6.5 % | 5.6 % |

