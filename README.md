# FrankenTillería

Juego de artillería por turnos para dos jugadores, al estilo de Worms. Cada jugador arma su criatura con una cabeza, un torso, brazos y piernas que vienen de cinco donantes distintos (Armadura, Espantapájaros, Maniquí, Juguete y Refrigerador). Cada pieza cambia la vida, la movilidad, la resistencia o el daño, y algunas dan armas o habilidades. Después las dos criaturas pelean en un mapa con terreno destructible y viento. Gana el último que queda en pie.

Repositorio: https://github.com/Dereksit0/Frakentilleria

## Cómo correrlo

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # pruebas unitarias (Vitest)
npm run lint       # ESLint y tipos
npm run build      # compilación de producción en dist/
npm run simulate   # partidas bot contra bot para medir el balance
npm run e2e        # pruebas de navegador (Playwright)
```

Hay que tener Node 20.19 o más nuevo.

## Controles

| Acción | PC | Móvil (horizontal) |
|---|---|---|
| Mover | A/D o flechas | botones < > |
| Apuntar | arrastrar en una zona libre, o W/S | arrastrar en una zona libre |
| Potencia | barra del HUD o Q/E | barra del HUD |
| Disparar | botón Fuego, Espacio o Enter | botón Fuego |
| Arma, habilidad, salto | 1-2, H, J | botones del HUD |
| Pausa | Esc o P | botón de pausa |

## Cómo está organizado

- `src/core/`: las reglas del juego, sin Phaser. Turnos, balística, terreno, daño, combate, bot.
- `src/data/`: piezas, armas, mapas, cajas, eventos y ajustes en JSON. El balance se toca aquí.
- `src/scenes/` y `src/ui/`: las pantallas y los componentes de Phaser.
- `tests/`: pruebas unitarias del núcleo y de los modelos de interfaz.
- `e2e/`: pruebas de navegador en PC, móvil y Safari.
- `scripts/`: pipeline de arte, simulador y prueba de estrés.
- `assets/raw/`: arte original sin tocar. `public/assets/`: arte ya optimizado.
- `docs/`: guía de código, decisiones, balance, rúbrica y material para el reporte.

Para entender el código conviene empezar por [docs/GUIA_DE_CODIGO.md](docs/GUIA_DE_CODIGO.md). Las decisiones de diseño están en [docs/DECISIONES_JUEGO.md](docs/DECISIONES_JUEGO.md) y el arte que falta conectar en [docs/FUTURO.md](docs/FUTURO.md).

## Balance

Todos los números del juego están en `src/data/*.json`. Los que todavía son provisionales llevan `TODO(balance)`. Para medir un cambio se corren partidas entre dos bots con semillas fijas:

```bash
SIM_N=300 SIM_OUT=docs/balance/BALANCE_FASE4.md npm run simulate
```

Los resultados de cada fase están en [docs/balance/](docs/balance/).

## Uso de IA

Usamos un asistente de IA como herramienta durante el desarrollo. Las reglas que le dimos están en [AGENTS.md](AGENTS.md), los prompts y cómo los fuimos refinando en [PROMPTS.md](PROMPTS.md), y las skills, el agente de balance y los servidores MCP en [docs/ia/](docs/ia/).

## Tecnologías y costo

Phaser 3, TypeScript, Vite, Vitest, Playwright y Vercel para publicarlo. Todo es gratuito, así que el costo del proyecto es de 0 pesos.

## Créditos

Hecho por Derek Ramírez Enriquez.
