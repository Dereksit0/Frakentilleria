# Modo escuadra (2 criaturas por jugador): diseño propuesto

**Estado: solo diseño. No se construyó.** Parte de lo que ya existe : combate por turnos con dispersión, empuje, armas con munición, cajas, peligros y eventos, todo por datos y probado en `src/core/`.

## 1. Objetivo

Que cada jugador lleve **dos criaturas** y decida en cada turno **cuál de las dos actúa**. Añade una decisión más (¿quién se expone, quién se cubre, quién recoge la caja?) sin cambiar las reglas de un disparo.

## 2. Reglas propuestas

| Tema | Propuesta | Por qué |
|---|---|---|
| Criaturas | 2 por jugador, cada una con su ADN (4 piezas) | El Laboratorio ya sabe construir una |
| Presupuesto | 22 puntos **por criatura** (igual que hoy) | Evita rehacer los costos de `parts.json` |
| Vida | La misma fórmula por criatura (base 80 + piezas) | Un jugador tiene el doble de vida total: ver riesgos |
| Turno | Cada turno es de un **jugador**; elige **una** criatura viva, se mueve y dispara con ella una vez | Mantiene 20 s, 6 s de movimiento y un ataque |
| Orden | J1, J2, J1, J2… (una ronda = cada jugador jugó una vez) | `TurnOrder` ya cuenta rondas así |
| Elegir quién actúa | Antes de moverse el jugador toca el retrato de su criatura (o **Q/E**); cambiar cuesta 0 s hasta el primer movimiento o disparo, después queda fijada | Sin penalización de planificar, sin cambiar a mitad de acción |
| Descanso | La criatura que actuó **no puede actuar el turno siguiente del mismo jugador** si la otra está viva | Obliga a alternar; si solo queda una, actúa siempre |
| Victoria | Gana quien deje al rival sin criaturas vivas. Empate si caen las últimas a la vez | Misma regla que hoy, aplicada al equipo |
| Ácido y bordes | Igual que hoy, por criatura; si el ácido alcanza a todas las de ambos equipos a la vez, cae primero la de menos vida | Se conserva la regla de desempate |
| Cajas | Las recoge cualquier criatura viva; la ayuda al que va perdiendo mide la **vida total del equipo** | Se reutiliza `catchUp` |
| Eventos y peligros | Sin cambios (no matan: dejan 1 de vida) | Ya son por datos |
| Habilidad de cabeza | De un solo uso **por criatura** | Cada cabeza trae la suya |
| Armas y munición | Por criatura (inventario propio) | Así importa quién dispara qué |

## 3. Laboratorio doble

Flujo: J1 arma la criatura A y luego la B → pantalla "Pasa el dispositivo" → J2 arma las suyas.

- Pestañas **Criatura 1 / Criatura 2** arriba, cada una con su indicador de puntos (22 máx). Botón **Listo** solo con las dos válidas.
- Atajo: **Copiar a la otra** (duplica una criatura) y **Al azar** por criatura.
- Código ADN: se extiende a **dos códigos** concatenados con un separador; los códigos de una sola criatura actuales siguen funcionando (una criatura = modo clásico).
- Botones de 104 px y texto de 32 px mínimo: en móvil (844×390) caben 2 pestañas de 300×104 sin quitar espacio a la lista de piezas.

## 4. HUD de combate

- Dos tarjetas por jugador (hoy hay una): retrato 64 px, barra de vida segmentada y estados (congelado, aturdido, escudo). La criatura **activa** va con borde amarillo **y** forma (rombo), no solo color.
- Móvil: las tarjetas del rival se reducen a retrato + barra; las del jugador activo quedan arriba a la izquierda. Tocar el retrato propio cambia de criatura (si todavía se puede).
- Carrusel de armas y munición: ya es genérico; muestra las de la criatura activa.
- Cámara: sigue a la criatura activa; un pequeño marcador flotante indica a la compañera.
- Resumen: daño y mejor tiro por jugador y por criatura; el cofre y los logros no cambian (los logros de "vida restante" usan la vida del equipo).

## 5. Cambios en el código

| Área | Cambio | Tamaño |
|---|---|---|
| `battle.ts` | `units` pasa de 2 a 4; `current` = criatura elegida del jugador en turno; `chooseActor(i)`; descanso; fin por equipo | Grande |
| `turns.ts` | `TurnOrder` por **jugador**, no por criatura | Pequeño |
| `unit.ts` | `owner` (jugador) además de `index` | Pequeño |
| `world.ts`, cajas, eventos | Sustituir "los dos `units`" por "todos los vivos" (ya iteran listas) | Medio |
| `bot.ts` / `sim.ts` | El bot elige criatura (la que tiene mejor tiro o la más herida que se cubre) | Medio |
| `dna.ts` / `session.ts` | Dos selecciones por jugador, compatibilidad con códigos viejos | Medio |
| UI (Lab, Hud, Battle, Result, PassDevice) | Pestañas, tarjetas dobles, selección de actor, resumen | Grande |
| Datos | `squad.json` con presupuesto, descanso y reglas de ayuda | Pequeño |

Todo lo nuevo de reglas debe nacer con prueba en rojo (`tests/squad.test.ts`): elegir actor, descanso, victoria por equipo, ácido con 4 criaturas, determinismo con semilla.

## 6. Estimación

| Bloque | Estimación (una persona) |
|---|---|
| Reglas del núcleo + pruebas | 3 días |
| Bot y simulador (4 criaturas, métricas por equipo) | 2 días |
| Laboratorio doble + ADN | 3 días |
| HUD, cámara y resumen | 3 días |
| Balance con simulación (3 iteraciones) | 2 días |
| e2e PC y móvil, capturas y docs | 2 días |
| **Total** | **≈ 15 días** (3 semanas con revisión) |

## 7. Riesgos

1. **Duración.** Con el doble de vida total, las partidas se alargan (hoy ≈ 10 rondas y el ácido de la ronda 6 las cierra). Mitigación: vida base menor por criatura o ácido desde la ronda 5; se mide con `npm run simulate`.
2. **Pantalla pequeña.** 4 tarjetas + carrusel de armas + botones de 104 px apretan el HUD en 844×390. Mitigación: tarjetas del rival compactas y prueba en móvil desde el primer prototipo.
3. **Complejidad del turno.** Una decisión extra puede ser mucho para jugadores casuales. Mitigación: la primera criatura queda elegida por defecto; el descanso se explica con un aviso.
4. **Primer golpe y bola de nieve.** Con dos cuerpos se puede sacrificar uno para ganar posición; hay que volver a medir primer golpe y remontadas (hoy 53.7 % y 12.7 %).
5. **Rig y animaciones.** Dos criaturas por bando duplican vistas y animaciones activas; el límite de 150 partículas y 12 números flotantes debe seguir valiendo.
6. **Códigos ADN.** Hay que mantener compatibilidad con los de una criatura; se prueba con los códigos existentes.
7. **Dependencias.** Conviene hacerlo después de cerrar el rediseño del ensamble (otra tarea) para no editar las mismas vistas a la vez.

## 8. Criterios de aceptación

- Pruebas de núcleo en verde y partida completa simulada con 4 criaturas (300 partidas, semillas fijas).
- Primer golpe ≤ 60 %, empates ≤ 5 %, rondas 10–16 (con ácido ajustado si hace falta), ninguna arma > 35 % del daño.
- e2e Playwright de una partida de escuadra en PC (1600×900) y móvil (844×390), sin errores de página.
- Los códigos ADN de una criatura siguen funcionando.
