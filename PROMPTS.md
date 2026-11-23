# Prompts, resultados y ajustes

## Iteración 1: núcleo de reglas
- **Prompt:** "Implementa rng, daño, estadísticas, presupuesto, ADN, terreno y balística con TDD."
- **Resultado:** módulos puros en `src/core/` con pruebas.
- **Ajuste:** se pidió RNG con semilla y datos en JSON para que las pruebas sean deterministas.

## Iteración 2: combate por turnos
- **Prompt:** "Añade turnos, ácido, unidades y la clase Battle con TDD."
- **Resultado:** 93 pruebas en verde.
- **Ajuste:** se separaron las reglas de ácido y de turnos en módulos propios.

## Iteración 3: mapas por datos
- **Prompt:** "Mueve los mapas a `maps.json` con esquema validado, parallax y terreno destructible."
- **Resultado:** 3 mapas cargados por datos.
- **Ajuste:** se añadió validación del esquema y se marcaron como TODO los números sin respaldo.

## Iteración 4: flujo de pantallas
- **Prompt:** "Crea las escenas de Boot, Splash, Menú, Laboratorio, Tutorial, Ajustes, Pausa y pasar dispositivo."
- **Resultado:** escenas en `src/scenes/` y componentes en `src/ui/`.
- **Ajuste:** se añadió una prueba de contraste de colores y otra de detección de dispositivo.

## Iteración 5: combate en navegador y botones que no respondían
- **Prompt:** "Verifica la partida completa en el navegador con Playwright (PC y móvil 844×390) y reporta lo que falle."
- **Resultado:** el e2e detectó que `¡Fuego!` no respondía al clic real, aunque sí a eventos sintéticos.
- **Ajuste:** diagnóstico con sondas en la página (cero objetos bajo el puntero); causa: los `Container` suman su origen al área interactiva. Se corrigió `Button` y el e2e quedó como prueba de regresión.
