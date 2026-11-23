# Balance Fase 2A: catálogo de armas por datos

Antes de la Fase 2 cada criatura tenía 1–2 armas y la Bazuca dominaba. Ahora:

- **Cañón** (base, infinito, `ammo` ausente): todos lo tienen primero. Las demás armas traen munición (`weapons.json → ammo`); llega más por Caja de munición (`crates.json`, `effect: ammo`, tope = 2 × inicial).
- **Mortero** (`minAngle` 60, `arcOverCover`, `windFactor` 2): sube siempre en arco alto, atraviesa el terreno mientras sube y sufre el doble del viento.
- **Bazuca**: plano, radio grande. **Granada de calabaza**: rebota, explota a los 3 s. **Mazo**: cuerpo a cuerpo, empuje 700 y aturde (`stunTurns`: el siguiente turno su dispersión es ×2.5). **Tesla**: alcance 420, ignora el viento, salta (`chain`: 1 salto, 60 % del daño, radio 220). **Hielo**: congela. **Poción ácida**: deja un charco (`puddle`: radio 70, 4 turnos, 5 de daño por turno).
- Estados: congelado, aturdido y quemadura (charco) existen en el core; escudo ya existía.

## Antes / después (300 partidas, experto vs experto)

| Métrica | Línea base | Fase 1 | Fase 2A | Meta | ¿Cumple? |
|---|---|---|---|---|---|
| Gana quien da el primer golpe | 69.3 % | 62.1 % | 50.0 % | ≤ 60 % | Sí |
| Empates | 3.0 % | 0.3 % | 0.7 % | ≤ 5 % | Sí |
| Rondas medias | 7.1 | 10.5 | 10.0 | 10–16 | Sí (justo) |
| Remontadas | 3.7 % | 6.0 % | 10.7 % | ≥ 20 % | No |
| Mayor cuota de daño de un arma | 51.4 % | 55.7 % | 30.1 % (Bazuca) | ≤ 35 % | Sí |
| Arma más elegida | 32.5 % | 28.8 % | 27.9 % (Cañón) | ≤ 40 % | Sí |

Iteraciones que llevaron a estos valores (todas con `npm run simulate`):

1. Munición 3/4/2 y Cañón de 11 de daño: el Cañón hacía 60 % del daño y se elegía el 66 % de los turnos (la munición se acababa y quedaba el infinito).
2. Cañón a 8 de daño y munición 5/5/5/5/6/5/4: Bazuca 30 %, Cañón 28 % de turnos.
3. Valor de estado en el bot (congelar +9, aturdir +6): la Ráfaga de hielo pasó de 1 % a 10 % del daño.

Pendiente de esta fase: **Tesla y Mazo casi no se usan** (el bot solo los elige si ya están a su alcance; no se acerca a propósito), y **remontadas 10.7 %** (< 20 %): las cajas de remontada de la Fase 4 son el ajuste que probaría. Fase 2B (Mina, Dinamita, ataque aéreo, etc.) no se hizo: las métricas de la 2A no la piden todavía.

Tabla de donantes: ver `docs/DECISIONES_JUEGO.md`.


300 partidas por emparejamiento, semillas 1000..1299, mapas rotados.

### experto vs experto

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 50.0 % |
| Empates | 0.7 % |
| Rondas medias | 10.0 |
| Turnos medios | 19.2 |
| Daño medio por turno | 5.3 |
| Turnos con acierto | 68.1 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 10.7 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 30.1 % | 18.1 % | 85.4 % |
| Poción ácida | 20.4 % | 7.5 % | 87.5 % |
| Cañón | 19.0 % | 27.9 % | 75.7 % |
| Mortero | 14.1 % | 10.2 % | 70.7 % |
| Ráfaga de hielo | 10.1 % | 17.3 % | 76.6 % |
| Granada de calabaza | 6.2 % | 18.9 % | 23.2 % |

### novato vs novato

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 53.7 % |
| Empates | 0.7 % |
| Rondas medias | 10.8 |
| Turnos medios | 20.7 |
| Daño medio por turno | 2.1 |
| Turnos con acierto | 31.0 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 0.7 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Cañón | 30.8 % | 43.1 % | 32.3 % |
| Bazuca | 22.6 % | 13.2 % | 37.1 % |
| Poción ácida | 14.1 % | 5.9 % | 35.4 % |
| Mortero | 12.0 % | 6.8 % | 35.1 % |
| Granada de calabaza | 11.8 % | 14.9 % | 23.2 % |
| Ráfaga de hielo | 6.8 % | 13.3 % | 28.4 % |
| Rayo Tesla | 1.8 % | 1.5 % | 23.4 % |
| Mazo de justa | 0.2 % | 1.1 % | 4.5 % |

### experto vs novato

| Métrica | Valor |
|---|---|
| Partidas | 300 |
| Gana quien da el primer golpe | 67.7 % |
| Empates | 1.0 % |
| Rondas medias | 10.5 |
| Turnos medios | 20.2 |
| Daño medio por turno | 3.5 |
| Turnos con acierto | 47.3 % |
| Remontadas (ganó quien llegó a ≤ 40 % de la vida del rival) | 6.0 % |

| Arma | % del daño | % de turnos elegida | % de acierto |
|---|---|---|---|
| Bazuca | 27.1 % | 14.9 % | 61.6 % |
| Cañón | 23.6 % | 37.5 % | 46.6 % |
| Poción ácida | 17.6 % | 6.3 % | 61.8 % |
| Mortero | 14.3 % | 8.6 % | 55.7 % |
| Ráfaga de hielo | 9.6 % | 14.8 % | 56.5 % |
| Granada de calabaza | 7.7 % | 16.2 % | 22.2 % |
| Rayo Tesla | 0.1 % | 0.9 % | 5.5 % |
| Mazo de justa | 0.0 % | 0.8 % | 0.0 % |

