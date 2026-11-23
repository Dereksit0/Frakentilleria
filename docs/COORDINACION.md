# Coordinación entre sesiones

Dos sesiones de trabajo comparten el repositorio y el mismo directorio de trabajo.

## Reparto de carpetas

|                                     | Sesión A: assets / mapas / docs                                                                                                                                                                                                                | Sesión B: UI / escenas                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carpetas                            | `scripts/`, `assets/`, `public/assets/`, `src/data/maps.json`, `src/core/maps.ts`, `tests/maps.test.ts`, `docs/ASSETS_TODO.md`, `docs/DECISIONES.md`, `docs/CONTRATO_UI.md`, `docs/COORDINACION.md`, `docs/capturas/chroma/`, `vite.config.ts` | `src/ui/`, `src/scenes/`, `src/main.ts`, `index.html`, PWA, tests de UI, `playwright.config.ts`, `e2e/game.spec.ts` y `e2e/helpers.ts`, README/AGENTS/PROMPTS |
| Compartido (avisar antes de editar) | `src/core/data.ts`, `package.json`, `.github/`                                                                                                                                                                                                 |                                                                                                                                                               |
| Core del juego                      | no se toca: `battle`, `unit`, `stats`, `turns`, `acid`, `damage`, `dna`, `ballistics`, `terrain`, `rng`                                                                                                                                        |                                                                                                                                                               |

## Reglas

- Antes de cada commit: `git fetch` y fusionar `origin/main` (`git pull --rebase origin main`; con cambios sin commitear de la otra sesión en el árbol, usar `git merge --ff-only origin/main`).
- Commits pequeños con rutas explícitas (`git add <archivo>`), nunca `git add -A`. Nunca `--force`.
- Los mensajes de commit no mencionan herramientas ni IA y no llevan coautorías.
- Si hay conflicto en un archivo ajeno: parar y reportar.

## Estado (actualizado en la entrega de mapas, tareas 1–7)

### Sesión A dejó listo

- Pipeline de assets (`npm run assets`) con chroma key sin halos (`scripts/chroma.mjs`); vistas previas en `docs/capturas/chroma/` (cuadros, blanco, negro y contraste).
- 3 mapas por datos (`vertedero`, `cementerio`, `fabrica`) con `status` por capa, parallax, spawns validados por prueba, viento (`bias` = 0, TODO).
- `src/core/maps.ts`: `validateMap`, `layerRect`, `placeMask`, `buildTerrain`, `pickMapId`, `surfaceY`; 29 pruebas en `tests/maps.test.ts`.
- Marca: logo, íconos (incl. maskable y apple-touch), favicon y `og-image.jpg` en `public/assets/`.
- `vite.config.ts` sin el error de `manualChunks` (ya corregido en `aead89f`).
- `docs/CONTRATO_UI.md` con rutas, claves de textura y un ejemplo de escena.

### Sesión A espera de la Sesión B

- Logo `public/assets/logo.png` en Menú, Splash, Tutorial, pantalla de carga, Ajustes/Créditos y Resumen (tamaño relativo del prototipo).
- `<meta>` Open Graph, favicon, `apple-touch-icon` y `manifest` con ícono maskable en `index.html` (los archivos ya existen; ver `docs/CONTRATO_UI.md` §7).
- Avisar si necesitan otro formato, tamaño o capa; se genera desde `assets/raw`.

### Sesión B espera de la Sesión A

- Nada pendiente en este momento. Mapas, claves y rutas están en `docs/CONTRATO_UI.md`.

### Para la Sesión B (revisar al integrar)

- Al momento de redactar este documento `npx tsc --noEmit -p .`, `eslint .`, `npm test` (141 pruebas) y `npm run build` pasan en el árbol compartido. Los errores que se vieron antes (`src/ui/creatureView.ts`: `body` incompatible con `Container` y `this` no asignable a `GameObject`; import `./scenes/Settings`, `./scenes/Battle` y `./scenes/Result` inexistentes) eran de trabajo en curso de la Sesión B y ya no aparecen; si reaparecen, son de la Sesión B.
- `src/scenes/Battle.ts` usa un terreno procedural de respaldo con `seed: 5, amp: 80` cuando falla la imagen: es un valor provisional de la UI, no un dato de mapa.

### Bloqueos

- `e2e/maps.spec.ts` (Sesión A) está commiteado en local pero **no publicado**: importa `e2e/helpers.ts`, que es de la Sesión B y aún no está en `origin/main`. Se publicará junto con (o después de) los archivos de B.
- La Sesión B no ha publicado `1c4ba10` (escenas); `origin/main` solo contiene los commits de la Sesión A.
- 60 fps sin verificar: el equipo de pruebas solo tiene WebGL por software (ver `docs/capturas/README.md`).

### Pruebas e2e de mapas (Sesión A)

`e2e/maps.spec.ts`: 6 casos (3 mapas × pc/móvil) pasan: selector, combate, parallax medido y sin errores de carga de assets. Elige el mapa con el botón `Mapa:` del Menú (288, 822).

## Documentos faltantes

`docs/DISENO.md` y `docs/PLANEACION.md` **no están en el repositorio** (el `HANDOFF.md` pide exportarlos desde Claude). No se han inventado: todas las decisiones actuales (reglas, estadísticas, colores, medidas, diferencias abiertas) se basan en `HANDOFF.md` y en `docs/rubrica.pdf`. Cuando se coloquen, hay que contrastar: armas, tope de presupuesto, color del ácido, selector de mapa y degradados.
