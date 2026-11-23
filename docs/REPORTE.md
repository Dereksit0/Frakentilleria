# Reporte de verificación – FrankenTillería

Fecha de la verificación: 23-nov-2026. Todo lo de esta página se ejecutó de verdad en el árbol de trabajo; no hay cifras estimadas.

## Resultados reales

| Comprobación | Comando | Resultado |
|---|---|---|
| Lint + tipos (src, tests, e2e) | `npm run lint` | sin errores |
| Pruebas unitarias | `npm test` | **143 pruebas en 15 archivos, todas en verde** |
| Cobertura de `src/core` | `npm run test:cov` | 95.1 % sentencias · 90.7 % ramas · 98.1 % funciones · **98.1 % líneas** |
| Compilación | `npm run build` | correcta (Vite 8, chunk de Phaser ≈ 1.26 MB / 343 KB gzip) |
| E2E Playwright PC (1600×900) | `npx playwright test game.spec.ts` | 3/3: partida completa (laboratorio → pasa el dispositivo → combate → resumen → revancha), ajustes/tutorial, sin errores de consola |
| E2E Playwright móvil (844×390, táctil) | ídem, proyecto `movil` | 3/3 con la misma partida completa usando toques; aviso "Gira tu dispositivo" en vertical |
| Mapas (otra sesión) | `e2e/maps.spec.ts` | 3 mapas × PC/móvil |
| Simulación sin interfaz | `tests/simulation.test.ts` | 40 partidas con bot terminan siempre; misma semilla ⇒ misma partida |

Datos de 300 partidas simuladas con un bot que apunta con ruido (balance preliminar, mapa Fábrica): **11.5 rondas de media**, victorias J1 135 / J2 136 / empates 29 (≈ 10 %).
Con turnos de ≤ 20 s esto equivale a una partida real de ~4–7 minutos (la rúbrica pide que no sea ni larga ni corta).

Capturas reales en `docs/capturas/juego/` (PC, móvil, tormenta ácida, resumen, vertical).

## Lo que NO pude verificar (dicho sin adornos)

- **60 fps**: el equipo de pruebas solo tiene WebGL por software (SwiftShader: 8–20 fps en las capturas). El código está pensado para 60 fps
  (HUD con caché de estado, máximo 150 partículas vivas = 5 emisores con tope, textura de terreno solo se sube al explotar),
  pero la medición real en un navegador con GPU queda pendiente.
- **Despliegue en Vercel**: no hay sesión iniciada (`vercel whoami` → "Logged out"). No publiqué nada con un despliegue temporal anónimo sin permiso del dueño.
  Pasos: `npx vercel login` y `npx vercel --prod` (ya existe `vercel.json`), o importar el repositorio de GitHub en vercel.com (framework Vite, salida `dist`).
- **Context7**: el servidor MCP está en `.mcp.json` pero no estuvo disponible en la sesión; la API de Phaser 3.90 se verificó ejecutando el juego en Chromium con Playwright.
- `docs/DISENO.md` y `docs/PLANEACION.md` no existen en el paquete. Ver `docs/DECISIONES_JUEGO.md`.

## Bugs encontrados al probar en navegador y corregidos

1. Botones con área táctil desplazada: un `Container` de Phaser suma su origen (w/2, h/2) al punto de prueba, así que ¡Fuego! no respondía al clic real (sí con eventos sintéticos).
   Corregido en `src/ui/widgets.ts` y cubierto por el e2e con clics y toques reales.
2. Campo ADN del DOM mal posicionado (medía su tamaño antes de aplicar el estilo): origen arriba-izquierda.
3. Nombre "Juguete de cuerda" tapaba el efecto en el laboratorio: se usa "Juguete" como en el prototipo.
4. Cambiar el radio de los cuerpos rompía la validación de spawns de los mapas: se revirtió; el tamaño visual se ajusta con la escala de la criatura.

## Checklist de la rúbrica (`docs/rubrica.pdf`)

| Criterio | Evidencia |
|---|---|
| Prompting (≥ 1 técnica) | `PROMPTS.md`: iteraciones con prompt, resultado y ajuste |
| MCP | `.mcp.json` (Playwright, Context7), `docs/ia/mcp.md`; Playwright usado para verificar escenas y capturas |
| Skills | `docs/ia/skills/nueva-parte.md`, `docs/ia/skills/crear-test-tdd.md` |
| AGENTS.md | `AGENTS.md` |
| Refinamiento iterativo | historial de commits + `PROMPTS.md` |
| Pruebas unitarias | 143 pruebas, 98 % de líneas del core |
| Metodología TDD | pruebas escritas en rojo antes de cada módulo del core (commits `feat(core)`) |
| Agente personalizado | `docs/ia/skills/agente-balance.md` |
| ≥ 2 jugadores por turnos, mover + 1 ataque | `Battle`: 20 s, 6 s de movimiento, 1 ataque, 3 s de retirada |
| Ensamblar con cabeza/torso/brazos/piernas, atributos, armas y habilidades | Laboratorio + `parts.json` (20 piezas) |
| Datos en JSON para balancear | `src/data/parts.json`, `weapons.json`, `crates.json`, `maps.json` |
| Vida de cada personaje y de quién es el turno | HUD: insignia de turno (color + forma) y placas de vida |
| Gana el último en pie | `Battle.result`, pantalla de resumen, revancha |
| Extras (terreno destructible, viento, más armas) | los tres, más cajas, tormenta ácida y habilidades |
| Sin fallos evidentes | 0 errores de consola en los e2e; simulaciones sin excepciones |
| Reporte 5–10 págs., presentación | pendiente de redactar por el equipo (diagramas y capturas listos en `docs/`) |

## Costo

$0 MXN: Phaser, TypeScript, Vite, Vitest, Playwright, Fontsource, GitHub y Vercel (plan gratuito). Ver tabla en `README.md`.

## Siguientes 3 pasos

1. Desplegar en Vercel (iniciar sesión o enlazar el repo) y medir fps reales en un celular de gama media.
2. Conseguir `DISENO.md` y contrastar: presupuesto (22 asumido), números de armas, color de ácido y selector de mapa; ajustar con el agente `balance`.
3. Arte pendiente (`docs/ASSETS_TODO.md`): 4 donantes, íconos de Mazo e Hielo, efectos de sonido y 2 pistas de música.
