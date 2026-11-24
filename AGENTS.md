# Reglas del proyecto para asistentes de IA

Proyecto: FrankenTillería (artillería por turnos para 2 jugadores). Autor: Derek Ramírez Enriquez.

## Reglas
1. Lee `docs/GUIA_DE_CODIGO.md` y `docs/DECISIONES_JUEGO.md` antes de cambiar nada.
2. La lógica de juego vive en `src/core/` y no importa Phaser: debe ser pura y determinista (RNG con semilla).
3. TDD: primero la prueba en `tests/`, después el código. Toda regla de balance sale de `src/data/*.json`, nunca de números sueltos.
4. `assets/raw/` son los originales: no se modifican. Los optimizados salen de `npm run assets` hacia `public/assets/`.
5. No inventar números de balance: si falta un dato, dejar un `TODO(balance)` en el JSON.
6. Antes de cada commit deben pasar `npm run lint`, `npm test` y `npm run build`.
7. Commits en español, formato `tipo: descripción`, tiempo presente, sin mencionar herramientas.
8. Nunca subir claves, tokens ni archivos `.env`.

## Skills y MCP
Ver `docs/ia/skills/` y `docs/ia/mcp.md`.
