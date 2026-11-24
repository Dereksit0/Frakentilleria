# FrankenTillería: reporte del proyecto final

Programación asistida por inteligencia artificial. Borrador: las partes personales (objetivos individuales y autoevaluaciones) las escribe cada integrante.

Código: https://github.com/Dereksit0/Frakentilleria

## 1. Planteamiento del problema

En la novela de Mary Shelley, Víctor Frankenstein arma un cuerpo con partes de distintos orígenes. El proyecto pide convertir esa idea en un videojuego de estrategia por turnos y artillería, al estilo de Worms Armageddon, en dos partes: un laboratorio donde cada jugador ensambla a su personaje con piezas que aportan atributos y armas, y un combate por turnos donde se enfrentan los personajes armados.

El reto no era solo que funcionara. El juego tenía que ser entretenido y no durar ni demasiado ni demasiado poco, sus piezas se debían poder balancear sin tocar el código, y el proyecto debía mostrar el uso de las técnicas del curso de programación asistida por IA. Nuestro juego se llama FrankenTillería. Cinco donantes (Armadura, Espantapájaros, Maniquí, Juguete y Refrigerador) aportan una cabeza, un torso, unos brazos y unas piernas, y cada pieza cambia la vida, la movilidad, la resistencia o el daño. Algunas dan armas o habilidades.

## 2. Objetivos

### Objetivos generales

- Programar un juego de dos jugadores por turnos con laboratorio de ensamble y combate de artillería.
- Agregar terreno destructible, viento y varias armas sobre una base que ya funcionara.
- Mantener las partes y las armas en archivos JSON para balancearlas sin cambiar código.
- Medir el balance con simulaciones en lugar de a ojo.
- Aplicar los conceptos del curso y dejar evidencia de cada uno.

### Objetivos individuales

Cada integrante escribe aquí los suyos. Plantilla:

| Integrante | Área que implementó | Objetivo individual |
|---|---|---|
| | | |
| | | |
| | | |

## 3. Diseño de la solución

### Arquitectura

El código está en cuatro capas. Los datos en JSON alimentan un núcleo de reglas que no depende de Phaser. Las escenas de Phaser y los componentes de interfaz solo dibujan lo que el núcleo calcula. Por eso el núcleo se puede probar con Vitest y simular miles de partidas.

![Arquitectura por capas](diagramas/arquitectura.png)

### Flujo de pantallas y de un turno

![Flujo de pantallas](diagramas/flujo-pantallas.png)

En un turno el jugador puede caminar hasta 6 s acumulados y hace un solo ataque. Después hay una retirada de 3 s, actúan los charcos, el ácido y los eventos, y juega el siguiente.

![Flujo de un turno](diagramas/flujo-turno.png)

### Datos de las piezas y metodología

Las piezas viven en `src/data/parts.json`. De ahí salen las estadísticas, el presupuesto y las armas que se muestran en el laboratorio y que usa el combate.

![Flujo de datos de las piezas](diagramas/datos-piezas.png)

Escribimos las reglas del núcleo con TDD: primero la prueba, después el código.

![Ciclo TDD](diagramas/ciclo-tdd.png)

### Código clave

La prueba de la fórmula de daño, escrita antes que el código, y la fórmula misma:

![Prueba TDD del daño](capturas/informe/01-prueba-tdd-dano.png)

![Cálculo de daño](capturas/informe/03-calculo-de-dano.png)

Las piezas como datos balanceables:

![JSON de piezas](capturas/informe/02-json-de-piezas.png)

Todo el azar pasa por un generador con semilla, y eso permite repetir una partida y simular cientos:

![Generador con semilla](capturas/informe/04-generador-con-semilla.png)

El ensamble de la criatura a partir de anclas, y la máquina de estados de las animaciones:

![Solucionador de ensamble](capturas/informe/08-solucionador-de-ensamble.png)

![Máquina de estados de animación](capturas/informe/07-maquina-de-estados-de-animacion.png)

El terreno destructible y la balística con viento:

![Terreno destructible](capturas/informe/09-terreno-destructible.png)

![Balística con viento](capturas/informe/06-balistica-con-viento.png)

La lista completa de fragmentos con archivo y líneas está en `docs/CAPTURAS_CODIGO.md`.

### Uso de la IA

Usamos un asistente de IA como herramienta, con reglas escritas en `AGENTS.md`, prompts documentados y refinados en `PROMPTS.md`, skills y un agente de balance en `docs/ia/`, y servidores MCP descritos en `docs/ia/mcp.md`. La dirección fue nuestra: el asistente propuso un bono de daño para el que va perdiendo, lo medimos con el simulador y lo descartamos porque no movía las métricas. La meta de remontadas de 20 % no se alcanzó (quedó en 12.7 %) y lo dejamos escrito así en `docs/balance/`.

### Balance y duración

Un bot de dos niveles juega partidas completas con semilla. La primera versión del combate era casi lineal: el 69.3 % de las partidas las ganaba quien daba el primer golpe. Después de bajar el daño de las armas, subir la dispersión y repartir el daño entre ocho armas, bajó a 50 %. Con mil partidas entre bots con semillas al azar, una partida dura 10.2 rondas y 19.6 turnos en promedio, lo que son unos 4 a 6 minutos con personas.

### Capturas del funcionamiento

![Laboratorio](capturas/02-laboratorio.png)

![Combate](capturas/04-combate.png)

![Resumen](capturas/05-resumen.png)

![Criaturas mezcladas](capturas/15-criaturas-mezcladas.png)

![Tormenta ácida](capturas/13-tormenta-acida.png)

![Combate en teléfono](capturas/07-combate-movil.png)

## 4. Liga al código

https://github.com/Dereksit0/Frakentilleria

## 5. Autoevaluación de cada integrante

Cada persona escribe sus 500 palabras. No las redactó nadie más. Preguntas guía:

- Qué hice y qué decisiones tomé yo, no la IA.
- Qué sentí durante el proyecto: dónde me frustré, dónde me sorprendí, qué me dio orgullo.
- Qué aprendí del curso y del proyecto, tanto de programación como de trabajar con un asistente de IA.
- Cómo aporta este proyecto a mi desarrollo y qué haría distinto.

| Integrante | Autoevaluación (500 palabras) |
|---|---|
| | |

## 6. Referencias

- Shelley, M. (1818). Frankenstein o el moderno Prometeo.
- Team17. Worms Armageddon, referencia de jugabilidad.
- Phaser 3, documentación: https://phaser.io/
- Vite: https://vite.dev/
- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/
- Mermaid, para los diagramas: https://mermaid.js.org/
- Materiales y rúbrica del curso de Programación asistida por IA (`docs/rubrica.pdf`).
