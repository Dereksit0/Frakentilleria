# Cumplimiento del enunciado y la rúbrica

Revisé cada punto del enunciado y de la rúbrica (`docs/rubrica.pdf`) contra el repositorio. La columna de estado usa tres valores: cumple, parcial o falta. Lo que solo puede hacer el equipo queda como "pendiente del equipo".

## Enunciado

| Requisito | Dónde se cumple | Estado | Qué hice |
|---|---|---|---|
| Nombre del juego | FrankenTillería. `README.md`, `index.html` | cumple | Nada que cambiar. |
| Mínimo dos jugadores por turnos | `src/core/turns.ts` (`TurnOrder`), `src/core/battle.ts`. Pruebas: `tests/turns.test.ts`, `tests/battle.test.ts`. Captura: `docs/capturas/pantallas/pc-combate.png` | cumple | Verificado con las pruebas y el recorrido de pantallas. |
| Cada jugador arma cabeza, torso, brazos y piernas | `src/scenes/Lab.ts`, `src/core/stats.ts`. Captura: `pc-laboratorio.png` | cumple | Verificado. |
| Ambos crean su personaje antes del combate | Flujo Lab J1, Pasa el dispositivo, Lab J2 en `src/scenes/PassDevice.ts` y `src/core/flow.ts`. Pruebas: `tests/flow.test.ts`, `e2e/game.spec.ts` | cumple | La configuración no es simultánea, el enunciado dice que eso no afecta la calificación. |
| Cada parte modifica vida, movilidad, resistencia o daño | `src/data/parts.json`, `computeStats` en `src/core/stats.ts`. Pruebas: `tests/stats.test.ts` | cumple | Verificado. |
| Algunas partes dan armas o habilidades | Brazos y torso dan armas, la cabeza una habilidad (`weaponsFor`, `abilityFor`). Pruebas: `tests/weapons2.test.ts` | cumple | Verificado: toda arma sale de al menos un donante. |
| Partes definidas en JSON y balanceables sin tocar código | `src/data/parts.json`, `weapons.json`, `tuning.json`, `crates.json`. Medición en `docs/balance/` | cumple | Quité de los JSON lo que no se usaba. Los números provisionales siguen marcados con `TODO(balance)`. |
| En su turno se mueve un tiempo y hace una sola acción de ataque | `TurnClock` en `src/core/turns.ts` (20 s, 6 s de movimiento, un disparo, 3 s de retirada). Pruebas: `tests/turns.test.ts`, `tests/battle.test.ts` | cumple | Verificado. |
| La interfaz muestra la vida de cada personaje y de quién es el turno | `src/scenes/Hud.ts`, `src/ui/healthBar.ts`. Pruebas: `tests/healthBar.test.ts`. Captura: `pc-combate.png` | cumple | Verificado en PC, móvil, iPhone e iPad. |
| Gana el último en pie | `src/core/battle.ts`. Prueba: "gana la última criatura en pie" en `tests/battle.test.ts` | cumple | Verificado. |
| Terreno destructible | `Terrain.carveCircle` en `src/core/terrain.ts`. Pruebas: `tests/terrain.test.ts`, `tests/phase1.test.ts` | cumple | Verificado. |
| Viento | `rollWind` y las ráfagas en `src/core/battle.ts`, vista en `src/ui/windFx.ts`. Pruebas: `tests/phase1.test.ts`, `tests/windVisual.test.ts` | cumple | Verificado. |
| Más armas | Ocho armas en `src/data/weapons.json`. Pruebas: `tests/weapons2.test.ts`, `tests/battle-weapons.test.ts` | cumple | Verificado. |
| Duración equilibrada de la partida | Simulación con bots, `docs/AUDITORIA.md` y `docs/balance/` | cumple | Ver el apartado de duración más abajo. |
| Sin fallos en la aplicación | `scripts/estres.sim.ts`, `e2e/pantallas.spec.ts`, `docs/AUDITORIA.md` | cumple | Mil partidas de estrés sin errores y recorrido de pantallas con cero errores en consola. Encontré y corregí dos pruebas de navegador con fallos por azar. |
| No es evidente que el código lo escribió una IA | Todo `src/`, `tests/` | parcial | Pasé comentarios y títulos de pruebas a español, quité lo que no se usaba y dejé funciones cortas con nombres del juego. Falta que el equipo lea su parte y la reescriba con sus palabras donde haga falta. |
| Liga al código | https://github.com/Dereksit0/Frakentilleria | cumple | |

### Duración de la partida

Con 1000 partidas entre bots con semillas al azar (`scripts/estres.sim.ts`): 10.2 rondas y 19.6 turnos por partida, en promedio. Con las 300 semillas fijas de la auditoría: 9.75 rondas y 18.7 turnos. Los bots no dudan, así que una partida entre ellos dura unos 95 s de juego. Una persona usa más tiempo por turno: con 19.6 turnos y entre 12 y 18 s por turno, una partida real dura entre 4 y 6 minutos. Es una duración razonable para una partida de este tipo. El ácido, que desde la ronda 6 sube 40 px por ronda, evita que se alargue: las partidas se cierran entre las rondas 10 y 13.

## Rúbrica

| Criterio | Dónde se demuestra | Estado | Qué hice |
|---|---|---|---|
| Prompting, al menos una técnica | `PROMPTS.md`, sección "Técnicas de prompting que usamos": paso a paso, pocos ejemplos, contexto fijo y criterios de aceptación | cumple | Agregué la sección con los casos reales de los prompts. |
| MCP | `docs/ia/mcp.md`. Playwright sirve para abrir el juego y sacar capturas, Context7 para consultar documentación | parcial | Playwright sí se usó. Context7 está configurado pero casi siempre falló al conectar, y la API de Phaser se verificó ejecutando el juego. Lo dejé escrito así. |
| Skills | `docs/ia/skills/nueva-parte.md`, `docs/ia/skills/crear-test-tdd.md` | cumple | Las skills reales viven en la configuración local del asistente y se copian a `docs/ia/skills/`. |
| AGENTS.md | `AGENTS.md` | cumple | Actualicé las referencias a documentos que ya no existen. |
| Refinamiento iterativo | `PROMPTS.md`, iteraciones 1 a 10 con prompt, resultado y ajuste | cumple | Agregué la iteración 10, la de esta auditoría. |
| Pruebas unitarias | `tests/`, 531 pruebas con Vitest y cobertura de `src/core` | cumple | Cambié los títulos a español y quité una prueba duplicada. |
| Metodología de desarrollo (TDD, knowledge priming o diseño primero) | TDD en `tests/` y `docs/diagramas/ciclo-tdd.png`. Diseño primero en `design-prototype/` y `docs/DECISIONES_JUEGO.md`. Contexto fijo en `AGENTS.md` | cumple | Documenté el ciclo con un diagrama. |
| Al menos un agente personalizado | Agente de balance, `docs/ia/skills/agente-balance.md` | cumple | El agente solo lee los JSON y propone cambios, no los aplica. |
| El uso de los conceptos siempre es justificable | `docs/GUIA_DE_CODIGO.md`, tabla de conceptos | cumple | Cada concepto se liga a un archivo concreto. |
| Uso de IA: se nota el control humano | Decisiones documentadas en `PROMPTS.md` y `docs/DECISIONES_JUEGO.md`: descartamos un bono que no movía las métricas, aceptamos que la meta de remontadas no se alcanzó, pusimos una condición de semillas idénticas para la auditoría | cumple | Escribí esas decisiones sin maquillar lo que no salió. |
| Funcionamiento del programa | Las pruebas de `docs/AUDITORIA.md` | cumple | Ver la fase de estabilidad en la auditoría. |
| Reporte final de 5 a 10 páginas | `docs/REPORTE.md` es un borrador con la estructura del enunciado | parcial | El borrador está listo. Los objetivos individuales y la autoevaluación de cada integrante los tiene que escribir cada persona: pendiente del equipo. |
| Presentación de 5 a 10 minutos | `docs/GUION_PRESENTACION.md` | parcial | El guion está listo. La presentación la da el equipo: pendiente del equipo. |
| Responsabilidades de cada miembro | `docs/REPARTO_DE_TAREAS.md` es una plantilla vacía | falta | No inventé nombres ni reparto: pendiente del equipo. |
| Evaluación entre compañeros | Se hace en clase | pendiente del equipo | El juego trae un tutorial de 5 pasos (`src/scenes/Tutorial.ts`) para que un compañero lo entienda sin explicación. |
