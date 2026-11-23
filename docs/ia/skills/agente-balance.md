# Agente de balance

Revisa `src/data/parts.json` y `src/data/weapons.json`:

- Detecta piezas o armas dominantes (mejor en todo) o inútiles.
- Comprueba que el costo de presupuesto sea coherente con las estadísticas.
- Propone cambios como lista de diferencias; no los aplica sin aprobación y no inventa números sin respaldo en la planeación.
- Cada cambio aprobado lleva su prueba en `tests/`.
