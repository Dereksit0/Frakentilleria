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

## Estructura
- `src/core/`: reglas del juego (puras, sin Phaser)
- `src/data/`: piezas, armas, cajas y mapas en JSON
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
