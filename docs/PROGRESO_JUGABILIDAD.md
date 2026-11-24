# Progreso de jugabilidad

Documento vivo: se actualiza al cerrar cada fase para poder retomar sin perder contexto.
Objetivo y metas: combate estratégico (primer golpe ≤ 60 %, empates ≤ 5 %, 10–16 rondas, remontadas ≥ 20 %, ningún arma > 35 % del daño ni > 40 % de turnos).

## Fase 0: línea base — hecha

- Hecho: bot novato/experto (`src/core/bot.ts`), simulador y agregador (`src/core/sim.ts`), `npm run simulate`, pruebas `tests/bot.test.ts`, [BOT.md](BOT.md), [BALANCE_BASE.md](BALANCE_BASE.md).
- Métricas (experto vs experto, 300 partidas): primer golpe gana 69.3 %, empates 3.0 %, 7.1 rondas, remontadas 3.7 %, Bazuca 51.4 % del daño.
- Pendiente: nada de esta fase.

## Fase 1: romper la repetición — hecha (metas parciales)

- Hecho (core, con pruebas `tests/phase1.test.ts`): puntería neutra por turno, ráfagas (`Battle.windNow`), dispersión por arma (`aim.ts`, `weapons.json → spread`), empuje con `launched` (salir por el borde = muerte), cobertura de explosión, ácido letal (empate por ácido gana el de más vida), vista previa corta (`tuning.json`). Parámetros en `src/data/tuning.json`; interruptores por partida en `Battle.rules`.
- Daño de todas las armas a la mitad y dispersión ×2 (barrido en [BALANCE_FASE1.md](BALANCE_FASE1.md)).
- Métricas (ee, 300): primer golpe 62.1 % (base 69.3), empates 0.3 %, 10.5 rondas, remontadas 6.0 % (meta 20), Bazuca 55.7 % del daño (meta 35).
- Pendiente: remontadas y dominio de la Bazuca (Fases 2 y 4); bot experto que use cobertura/retirada; HUD de rachas de viento y verificación visual; e2e de la fase.
## Fase 2: armas — 2A hecha en el core (2B no)

- Hecho: 8 armas por datos con munición, mortero (arco alto), poción (charcos), mazo (aturdir), Tesla (cadena), Caja de munición, bot que valora estados y munición, carrusel de armas en el HUD, pruebas `tests/weapons2.test.ts`, [BALANCE_FASE2.md](BALANCE_FASE2.md).
- Métricas (ee, 300): primer golpe 50.0 %, empates 0.7 %, 10.0 rondas, remontadas 10.7 % (meta 20), Bazuca 30.1 % del daño, Cañón 27.9 % de turnos.
- Pendiente: íconos de estado junto a la barra de vida y dibujo de charcos (UI, sesión de escenas); bot que se acerque para Mazo/Tesla; capturas de cada arma; Fase 2B.
## Fase 3: mapas vivos y eventos — hecha (core + UI básica)

- Hecho: `src/core/world.ts` (obstáculos, peligros, eventos con aviso una ronda antes, nada programado mata), `events.json`, `maps.json → hazards`, dibujo en `src/ui/worldView.ts` (barriles, portales, resorte, cinta, ventilador, pelota, charcos de ácido, muros pintados sobre el terreno), banners, niebla que oculta la vista previa, capturas en `docs/capturas/jugabilidad/`, [BALANCE_FASE3.md](BALANCE_FASE3.md).
- Métricas (ee, 300): primer golpe 52.7 %, empates 1.3 %, 9.6 rondas, remontadas 13.0 %, Bazuca 31.1 %.
- Pendiente: remontadas ≥ 20 % (Fase 4); íconos de estado junto a la barra; arte propio de peligros; el bot ignora los peligros; puentes sin usar en ningún mapa.
## Fase 4: cajas, remontada y recompensas — pendiente
## Fase 5: diseño de escuadra — pendiente
