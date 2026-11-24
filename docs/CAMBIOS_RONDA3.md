# Cambios de la ronda 3

Un apartado por cambio: qué causaba el problema, qué se hizo y el resultado real. Las capturas están en `docs/capturas/ronda3/`.

## 1. El Mazo de justa se disparaba a sí mismo

**Causa (verificada con una prueba en rojo).** El golpe cuerpo a cuerpo se resolvía como una explosión a 70 px delante del atacante con `radio 70 + media caja`. El centro del propio atacante queda a ≈ 81 px de ese punto, o sea dentro del radio, y `explodeCore` no excluía al dueño: el atacante recibía daño con caída de explosión. La dirección del empuje no estaba invertida (era un empuje radial desde la explosión).

**Qué se hizo (`src/core/battle.ts`, con pruebas primero en `tests/melee.test.ts`).**
- El golpe es ahora un **sector delante del atacante**: centrado en el ángulo de apuntado, con semiángulo `arc` (55°) y alcance `range` (120) más media caja, ambos en `weapons.json`. Se excluye **siempre al atacante por id**; el empuje y el aturdimiento van alejándose del atacante.
- **Autocolisión de proyectiles.** La gracia de salida (antes un 0,4 s fijo en el código) está en `tuning.json → spawnGrace.seconds`. Además, un proyectil que explota dentro de esa gracia (por ejemplo, disparado contra el suelo a los pies) **no daña ni empuja a su dueño**.
- Política de daño propio (se mantiene): las explosiones lejanas (granada, mortero, barril…) siguen pudiendo dañar al dueño; nunca al aparecer el proyectil. Documentada en `DECISIONES_JUEGO.md`.
- Armas auditadas: cañón, mortero, bazuca, granada, hielo, poción (proyectiles/granadas, cubiertas por la gracia), Tesla (el rayo y la cadena ya excluían al dueño) y mazo (sector). Mina, dinamita y ataque aéreo **no existen todavía** (solo íconos planeados en `weapons.json`): se aplicarán las mismas reglas al implementarlas.

**Resultado.**
- `tests/melee.test.ts`: 19 pruebas (adyacente, atacante intacto en cuatro distancias, fuera de alcance, dentro del alcance, detrás, arriba/abajo, escalón, ambos lados, datos, gracia, suelo a los pies y **una prueba por cada arma** con el rival fuera de alcance: el dueño no recibe daño ni aturdimiento). Antes del arreglo el atacante perdía 6–10 de vida en cada golpe (rojo).
- Suite completa: 445 pruebas en verde; lint y build en verde.
- e2e `e2e/mazo.spec.ts` (PC y móvil): el rival a 100 px recibe daño y el atacante conserva vida, posición y no queda aturdido. Capturas `docs/capturas/ronda3/pc-mazo-golpe.png` y `movil-mazo-golpe.png`.
