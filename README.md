# FrankenTillería

Artillería por turnos para 2 jugadores. **Ensambla. Dispara. Sobrevive.**
Armas tu criatura con piezas, la lanzas a un mapa con terreno destructible y te enfrentas a un rival en el mismo dispositivo.

## Instalar y correr
```bash
npm install
npm run dev     # servidor de desarrollo
npm test        # pruebas (Vitest)
npm run lint    # ESLint + tipos
npm run build   # compilación de producción
npm run simulate  # simulación de partidas con el bot (balance)
npm run e2e     # pruebas de navegador (Playwright, PC y móvil)
```

## Controles
| Acción | PC | Móvil (horizontal) |
|---|---|---|
| Mover | A/D o ←/→ | botones < > (104 px) |
| Apuntar | arrastrar en cualquier zona libre, o W/S | arrastrar en una zona libre |
| Potencia | barra del HUD o Q/E | barra del HUD |
| Disparar | ¡Fuego! o Espacio/Enter | ¡Fuego! |
| Arma / habilidad / salto | 1-2 / H / J | botones del HUD / ^ |
| Pausa | Esc o P | botón II |

## Jugabilidad y balance
El combate es estratégico por diseño: viento nuevo cada turno y ráfagas, dispersión, empuje, cobertura, 8 armas con munición, obstáculos y peligros por mapa, eventos de ronda, cajas que ayudan al que va perdiendo y un cofre de remiendos con colección y logros.

- Todo está por datos (`src/data/*.json`) y los números provisionales llevan `TODO(balance)`.
- Se mide con un bot (`docs/BOT.md`): `SIM_N=300 SIM_OUT=docs/BALANCE_FASE4.md npm run simulate`. Variables: `SIM_N`, `SIM_SEED`, `SIM_RULES` (JSON de reglas), `SIM_HAZARDS=0`, `SIM_PAIRS=ee`.
- Resultados y metas: [docs/BALANCE_RESUMEN.md](docs/BALANCE_RESUMEN.md); avance por fase: [docs/PROGRESO_JUGABILIDAD.md](docs/PROGRESO_JUGABILIDAD.md); modo escuadra (solo diseño): [docs/ESCUADRA.md](docs/ESCUADRA.md).

## Estructura
- `src/core/`: reglas del juego (puras, sin Phaser)
- `src/data/`: piezas, armas, cajas, mapas, eventos, cosméticos y ajustes (`tuning.json`) en JSON
- `src/scenes/`, `src/ui/`: escenas y componentes de Phaser
- `tests/`: pruebas unitarias
- `scripts/`: pipeline de assets (chroma key, optimización)
- `assets/raw/`: originales; `public/assets/`: optimizados
- `docs/`: decisiones, pendientes de assets y documentación de IA (`docs/ia/`)

Reglas del proyecto para asistentes de IA: [AGENTS.md](AGENTS.md). Prompts: [PROMPTS.md](PROMPTS.md).

## Tecnologías
Phaser 3, TypeScript, Vite, Vitest, Vercel.

## Costos
| Concepto | Costo |
|---|---|
| Hosting (Vercel, plan gratuito) | $0 |
| Motor y librerías (código abierto) | $0 |
| Fuentes (Fontsource) | $0 |
| **Total** | **$0** |

## Créditos
Desarrollado por Derek Ramírez Enriquez.
