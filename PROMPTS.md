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

## Iteración 6: combate estratégico medido con simulación
- **Prompt:** "Transforma el combate de lineal a estratégico por fases (viento, dispersión, empuje, armas, mapas vivos, cajas y recompensas) con TDD y mide cada fase con un bot sobre 300 partidas."
- **Resultado:** el asistente de IA construyó un bot novato/experto y el simulador, y la línea base mostró que quien pega primero ganaba el 69.3 % de las partidas.
- **Ajuste:** la dispersión sola casi no movía la métrica; se midieron variantes y se bajó el daño de las armas a la mitad para alargar las partidas (primer golpe 62.1 %).

## Iteración 7: armas con munición y bot que valora estados
- **Prompt:** "Añade un catálogo de 8 armas dirigido por datos (cañón infinito, mortero, bazuca, granada, mazo, Tesla, hielo, poción) con munición y estados."
- **Resultado:** primera versión con el Cañón haciendo el 60 % del daño.
- **Ajuste:** se subió la munición, se bajó el daño del Cañón y el bot pasó a valorar congelar y aturdir; la Bazuca quedó en 30 % del daño y el primer golpe en 50 %.

## Iteración 8: mapas vivos y un atasco encontrado por la simulación
- **Prompt:** "Añade obstáculos, peligros por mapa y eventos de ronda con aviso, sin muertes injustas."
- **Resultado:** la simulación detectó partidas que nunca terminaban (una cinta transportadora dejaba a la criatura en el aire) y rondas demasiado cortas por la grúa y la pelota.
- **Ajuste:** la cinta ahora arrastra y deja caer; la grúa suelta el barril a un lado y la pelota empuja menos. Se añadió una prueba que comprueba que ningún evento deja una criatura a 0 de vida.

## Iteración 9: cajas, remontada y recompensas
- **Prompt:** "Añade cajas misteriosa e imitadora, ayuda al que va perdiendo, cofre de remiendos, colección y 8 logros."
- **Resultado:** las remontadas subieron a 12.7 %, sin llegar a la meta de 20 %.
- **Ajuste:** se probaron seis variantes de cajas y un bono de daño; el bono se descartó por no tener efecto medible y la meta quedó documentada como no alcanzada, con ideas para la siguiente iteración.

## Iteración 10: auditoría final sin cambiar el comportamiento
- **Prompt:** pedimos limpiar el código, dejarlo en un estilo que entendamos todos y comprobar la rúbrica, con la condición de que una simulación de 300 partidas con semillas fijas diera exactamente los mismos resultados antes y después.
- **Resultado:** quitamos las exportaciones y el arte que ninguna mecánica usaba, pasamos los comentarios y los títulos de las pruebas a español y escribimos una prueba de estrés de mil partidas. El recorrido por semillas salió idéntico en cada paso.
- **Ajuste:** encontramos dos pruebas de navegador que fallaban por azar (la partida completa dependía de que un tiro acertara y la de paralaje no contaba la inclinación por viento). Las corregimos en vez de ignorarlas. El detalle está en `docs/AUDITORIA.md`.

## Técnicas de prompting que usamos

Estos son los casos donde se ve cada técnica en los prompts de este proyecto.

- Paso a paso. Los prompts largos dividían el trabajo en tareas numeradas, cada una con su verificación y su commit, por ejemplo la integración de las hojas de arte (registrar, recortar, anclar, empaquetar, conectar, probar) y la auditoría de esta iteración. Así el asistente no saltaba a escribir código sin haber revisado antes el estado del repositorio.
- Pocos ejemplos (few-shot). Para que el estilo saliera como queríamos pusimos ejemplos dentro del prompt: el formato de los mensajes de commit (`limpieza: quito código sin uso en ballistics`) y nombres de funciones del dominio (`windForce`, `pickSpawn`, `applyKnockback`) frente a nombres genéricos que no queríamos.
- Contexto fijo (knowledge priming). `AGENTS.md` junto con `docs/DECISIONES_JUEGO.md` le dan al asistente las reglas del proyecto al empezar cada sesión: el núcleo no importa Phaser, primero la prueba, el balance va en JSON.
- Criterios de aceptación. Cada prompt terminaba con lo que tenía que pasar: lint, pruebas y build en verde, y en la auditoría además que las semillas dieran el mismo resultado.
