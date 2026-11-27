# Balance Fase 3: mapas vivos y eventos

Todo por datos: `maps.json → hazards` (por mapa) y `events.json`. Reglas puras en `src/core/world.ts` (pruebas `tests/world.test.ts`, 26).

| Mapa | Comunes | Propios |
|---|---|---|
| Vertedero | muro destructible, 2 barriles TNT | montón de chatarra que se derrumba (un impacto cava ×1.8), grúa que suelta un barril junto a una criatura cada 3 rondas |
| Cementerio embrujado | resorte, 2 barriles TNT | mano de zombi que aturda (cada 3 rondas, radio 170), lápida que cae (18 de daño, cada 4), niebla (oculta la vista previa del tiro) |
| Fábrica de juguetes | portal doble (los proyectiles lo cruzan), barril TNT | cinta transportadora, ventilador con viento local (+3), pelota rodante (cada 4 rondas) |

Puentes: el tipo `bridge` existe y se prueba (plataforma fina que rompe una explosión), pero ningún mapa lo usa todavía.

Eventos (cada 3 rondas desde la ronda 3, aviso una ronda antes con banner): tormenta eléctrica (rayo en el punto más alto), lluvia de meteoritos (3 puntos anunciados), gravedad baja (×0.5), luna llena (daño ×2), ráfaga de viento (+3).
Los avisos de peligros (grúa, mano, lápida, pelota) también salen una ronda antes. **Nada de lo programado mata**: el daño del entorno y de los eventos deja siempre 1 de vida (prueba con todos los eventos sobre criaturas de 1 de vida). Los barriles sí son letales: los provoca un jugador y se ven.
"Reducir efectos": los eventos solo añaden sacudida al rayo (apagada en ese modo).

## Antes / después (300 partidas, experto vs experto)

| Métrica | Línea base | Fase 2A | Fase 3 | Meta | ¿Cumple? |
|---|---|---|---|---|---|
| Gana quien da el primer golpe | 69.3 % | 50.0 % | 52.7 % | ≤ 60 % | Sí |
| Empates | 3.0 % | 0.7 % | 1.3 % | ≤ 5 % | Sí |
| Rondas medias | 7.1 | 10.0 | 9.6 | 10–16 | Casi |
| Remontadas | 3.7 % | 10.7 % | 13.0 % | ≥ 20 % | No (mejora) |
| Mayor cuota de daño (Bazuca) | 51.4 % | 30.1 % | 31.1 % | ≤ 35 % | Sí |
| Arma más elegida (Cañón) | 32.5 % | 27.9 % | 25.9 % | ≤ 40 % | Sí |

Sin peligros ni eventos (`SIM_HAZARDS=0`, `SIM_RULES='{"events":false}'`): 50.0 % primer golpe, 10.0 rondas, 10.7 % remontadas. Los peligros acortan la partida (≈ 0.4 rondas) y suben las remontadas (+2 puntos), que es lo que se busca.

Iteraciones: la primera versión daba 7.9 rondas. Quitando un tipo de peligro a la vez (barrido en el simulador) los responsables eran la **grúa** (soltaba el barril encima del rival: ahora cae a 140–240 px a un lado) y la **pelota** (empujaba demasiado: ahora 140 de empuje). Los barriles se bajaron a 12 de daño / 220 de empuje (`tuning.json → barrel`). También se corrigió un atasco: una cinta contra un hoyo dejaba a la criatura "en el aire" para siempre (el turno nunca cerraba); ahora la cinta la arrastra y la deja caer.

Pendiente de la fase: remontadas aún por debajo de 20 % (Fase 4: cajas hacia quien va perdiendo); el bot no usa los peligros a propósito (ni evita la pelota); verificación manual en móvil real; arte propio de los peligros (descripciones en `FUTURO.md`).

Reproducir: `SIM_N=300 SIM_OUT=docs/balance/BALANCE_FASE3.md npm run simulate`.

## Resultados de la simulación completa


300 partidas por emparejamiento, semillas 1000..1299, mapas rotados.

### experto vs experto

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 52.7 % |
| Empates | 1.3 % |
| Rondas medias | 9.6 |
| Turnos medios | 18.4 |
| Daño medio por turno | 4.8 |
| Turnos con acierto | 59.1 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 13.0 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 31.1 % | 18.4 % | 76.1 % |
| Poción ácida | 19.7 % | 7.8 % | 80.6 % |
| Cañón | 17.3 % | 25.9 % | 61.3 % |
| Mortero | 14.1 % | 10.8 % | 59.0 % |
| Ráfaga de hielo | 10.5 % | 17.9 % | 68.3 % |
| Granada de calabaza | 7.3 % | 19.2 % | 22.7 % |

### novato vs novato

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 52.4 % |
| Empates | 1.3 % |
| Rondas medias | 10.5 |
| Turnos medios | 20.2 |
| Daño medio por turno | 1.8 |
| Turnos con acierto | 26.1 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 2.7 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Cañón | 29.1 % | 43.2 % | 25.3 % |
| Bazuca | 22.6 % | 13.4 % | 31.0 % |
| Granada de calabaza | 13.3 % | 14.9 % | 21.3 % |
| Poción ácida | 12.6 % | 5.7 % | 30.5 % |
| Mortero | 11.9 % | 6.9 % | 30.0 % |
| Ráfaga de hielo | 7.7 % | 13.4 % | 26.8 % |
| Rayo Tesla | 2.0 % | 1.4 % | 25.6 % |
| Mazo de justa | 0.8 % | 1.2 % | 12.7 % |

### experto vs novato

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 69.8 % |
| Empates | 1.3 % |
| Rondas medias | 10.1 |
| Turnos medios | 19.3 |
| Daño medio por turno | 3.2 |
| Turnos con acierto | 41.5 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 11.0 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 28.3 % | 15.2 % | 56.2 % |
| Cañón | 22.8 % | 36.9 % | 39.1 % |
| Poción ácida | 17.8 % | 6.5 % | 59.1 % |
| Mortero | 14.2 % | 8.9 % | 47.3 % |
| Ráfaga de hielo | 9.8 % | 15.0 % | 49.7 % |
| Granada de calabaza | 7.0 % | 16.1 % | 18.7 % |
| Rayo Tesla | 0.1 % | 0.8 % | 6.8 % |
| Mazo de justa | 0.0 % | 0.7 % | 2.4 % |

