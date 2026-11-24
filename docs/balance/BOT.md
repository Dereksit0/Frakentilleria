# Bot de simulación

Código: `src/core/bot.ts` (decisión) y `src/core/sim.ts` (partida completa y métricas). Pruebas: `tests/bot.test.ts`.
Sin Phaser y sin `Math.random`: todo sale de `Rng` con semilla, así que (semilla, niveles) → mismo resultado.

## Niveles

- **novato**: elige un arma al azar, calcula el mejor tiro con ella y le añade error (±9° de ángulo, ±16 % de potencia).
- **experto**: evalúa **todas** sus armas y escoge la de mayor valor esperado (daño absoluto + estados). Suma un bono de variedad (+12 %) al arma que no usó el turno anterior y un pequeño ruido (4 %) para no repetirse.

## Cómo evalúa un arma

- Proyectil y granada: búsqueda gruesa de ángulo (15°–85°, paso 7) × potencia (30–100, paso 10) simulando la trayectoria con el viento actual y el `windFactor` del arma; después afina ±4° / ±6. El puntaje es `daño × caída(distancia al centro del rival)`. La granada se juzga por el punto de caída; no cuenta tiros que caen sobre el propio bot.
- Poción: suma parte de lo que quemará el charco si cae cerca. Hielo/Mazo: suman un valor fijo por congelar (+9) o aturdir (+6). Respeta la munición y el ángulo mínimo del mortero.
- Rayo (`beam`): alcance contra la distancia real; ignora el viento.
- Cuerpo a cuerpo (`melee`): distancia entre el golpe y el rival.
- Si el mejor puntaje es menor al 35 % del daño del arma y queda tiempo de movimiento, el bot **se acerca** (dos ráfagas de 1.2 s) y vuelve a planear.

## Métricas (`aggregate`)

- *Primer golpe*: primer jugador que inflige daño de arma al rival. Se mide la victoria de ese jugador sobre partidas con ganador.
- *Remontada*: partida ganada por quien en algún momento tuvo ≤ 40 % de la vida del rival (sobre todas las partidas). `hadUnderdog` cuenta cuántas partidas tuvieron esa situación.
- *Daño por arma*: el daño enemigo infligido durante el turno se atribuye al arma disparada ese turno.
- *Turnos con acierto*: disparos que dañaron al rival entre disparos hechos.
- Los mapas rotan por semilla (`MAPS[seed % n]`).

## Comandos

```
npm run simulate                      # 300 partidas por emparejamiento, imprime/escribe tablas
SIM_N=300 SIM_SEED=1000 SIM_OUT=docs/balance/BALANCE_FASE1.md SIM_TITLE="Fase 1" npm run simulate
```

Emparejamientos: experto–experto, novato–novato y experto–novato. Los PNG de terreno se decodifican con `sharp` (`tests/helpers/mapArt.ts`).
