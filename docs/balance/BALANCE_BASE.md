# Línea base de jugabilidad (Fase 0)

Estado del combate **antes** de cualquier cambio de jugabilidad (solo se añadió el bot y el simulador).
Reproducir: `SIM_N=300 SIM_OUT=docs/balance/BALANCE_BASE.md npm run simulate` (ver [BOT.md](BOT.md)).

**Lectura rápida (experto vs experto, el caso de referencia):**

| Meta | Línea base | Meta | ¿Cumple? |
|---|---|---|---|
| Gana quien da el primer golpe | 69.3 % | ≤ 60 % | No |
| Empates | 3.0 % | ≤ 5 % | Sí |
| Rondas medias | 7.1 | 10–16 | No (cortas) |
| Remontadas | 3.7 % | ≥ 20 % | No |
| Mayor cuota de daño de un arma | 51.4 % (Bazuca) | ≤ 35 % | No |
| Arma más elegida | 32.5 % (Ráfaga de hielo) | ≤ 40 % | Sí |

Observaciones: la Bazuca y la Ráfaga de hielo aciertan casi siempre (≈ 100 %) porque la trayectoria es idéntica y calculable; la Granada y el Tesla fallan mucho; el Mazo casi no se usa (exige estar pegado al rival y no hay movimiento estratégico).


300 partidas por emparejamiento, semillas 1000..1299, mapas rotados.

### experto vs experto

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 69.3 % |
| Empates | 3.0 % |
| Rondas medias | 7.1 |
| Turnos medios | 13.8 |
| Daño medio por turno | 9.5 |
| Turnos con acierto | 66.5 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 3.7 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 51.4 % | 22.9 % | 99.9 % |
| Ráfaga de hielo | 28.5 % | 32.5 % | 99.7 % |
| Granada de calabaza | 10.9 % | 29.4 % | 23.2 % |
| Rayo Tesla | 9.1 % | 12.0 % | 35.7 % |
| Mazo de justa | 0.2 % | 3.1 % | 3.1 % |

### novato vs novato

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 70.8 % |
| Empates | 7.3 % |
| Rondas medias | 10.3 |
| Turnos medios | 20.1 |
| Daño medio por turno | 3.9 |
| Turnos con acierto | 26.4 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 2.7 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 44.4 % | 22.8 % | 39.5 % |
| Granada de calabaza | 24.6 % | 27.1 % | 23.1 % |
| Ráfaga de hielo | 16.0 % | 24.5 % | 32.7 % |
| Rayo Tesla | 12.3 % | 17.9 % | 13.6 % |
| Mazo de justa | 2.7 % | 7.7 % | 8.2 % |

### experto vs novato

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 86.3 % |
| Empates | 2.7 % |
| Rondas medias | 8.3 |
| Turnos medios | 15.9 |
| Daño medio por turno | 6.3 |
| Turnos con acierto | 44.2 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 2.0 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 45.2 % | 21.3 % | 65.4 % |
| Ráfaga de hielo | 25.0 % | 26.5 % | 72.7 % |
| Granada de calabaza | 17.5 % | 28.8 % | 24.6 % |
| Rayo Tesla | 11.7 % | 17.3 % | 21.3 % |
| Mazo de justa | 0.6 % | 6.1 % | 3.8 % |

