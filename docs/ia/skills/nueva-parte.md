# Skill: nueva-parte

Añadir una pieza (parte) nueva a la criatura.

1. Definir la pieza en `src/data/parts.json` (id, ranura, estadísticas, costo de presupuesto). Sin números inventados: usar los de la planeación o marcar TODO.
2. Escribir primero la prueba en `tests/` (estadísticas, presupuesto, ADN).
3. Implementar el mínimo en `src/core/` hasta que pase.
4. Registrar el sprite en `assets/raw/` con el esquema de nombres de `HANDOFF.md` y ejecutar `npm run assets`.
5. Verificar con `npm run lint`, `npm test` y `npm run build`.
