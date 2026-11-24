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

## 2. Espantapájaros: las piernas se desplazaban a la derecha

**Causa (verificada).** El anclaje `hip` del torso era la media de los píxeles opacos de las últimas 6 filas. En el Espantapájaros esas filas son los flecos y **el extremo de la cuerda con nudo** (a la derecha): resultó `x = 130` cuando el centro real de la base está en `x ≈ 101`, así que las piernas quedaban unos **27 px** a la derecha. En la Armadura el error era de 3–5 px.

**Qué se hizo.**
- `detectTorsoHipX` (`scripts/rig-detect.mjs`): la mediana de los centros de cada fila entre 12 y 30 px sobre el borde inferior, que ignora flecos, cuerda y etiquetas. Resultado: Armadura 104, Espantapájaros 101, Maniquí 104, Juguete 85 (el torso con la llave a la derecha), Refrigerador 108.
- El origen de las piernas es el centro entre los **dos pies** (últimas 20 filas), no el centro de toda la pieza.
- `hipOffsetX` manual por torso (último recurso, hoy 0 en los cinco) en `rig.json → manual` (`donante.torso.hipOffsetX`).

**Resultado.** `tests/rig-masks.test.ts` → "torso × piernas: centradas": **25 de 25** con error ≤ 2 px entre el centro de los pies y el centro de la base del torso (con las máscaras reales; antes fallaban 15, la peor con 27 px) y solape vertical ≥ 4 px. Hoja de contacto revisada: `docs/capturas/rig/hoja-piernas-25.png`. Las 625 combinaciones siguen siendo una sola mancha.

## 3. Brazos de Armadura demasiado grandes

**Causa (medida).** Todas las piezas de brazo se normalizaron al mismo **ancho** de marco (230 px), pero el arte de la Armadura (hombrera + cañón + puño) es mucho más grueso: 94 px de alto en el hombro y 124 de máximo frente a ~60–80 de las demás. Con el mismo arte en los dos brazos, el trasero colgaba como un cañón enorme.

**Qué se hizo.**
- `armScale` por pieza en `rig.json` (lo escribe `scripts/rig-anchors.mjs`, tabla `ARM_SCALE`). **Regla:** largo hombro→boquilla × `armScale` entre 0,9 y 1,1 veces la altura del torso (154 px en los cinco). Valores: Armadura 0,84 (166 px → 139, 0,90×), Espantapájaros 0,85, Maniquí 0,85, Juguete 0,83, Refrigerador 0,83 (≈ 1,0×). Con ~0,7 el brazo de Armadura quedaría en 0,75× el torso, fuera de la regla; 0,84 es el menor valor que la cumple.
- El brazo trasero se dibuja al **90 %** del delantero (`backArm.scale`) y al 85 % de brillo.
- Reposo del trasero: −108° (hacia abajo y algo hacia afuera). Una búsqueda sobre las 125 combinaciones torso×piernas×brazo mostró que con ángulos menos inclinados que −106° el brazo cruza las piernas (hasta 1700 píxeles); desde −106° ninguno. Por eso **no** se recoge hacia delante, como pedía el texto para los brazos con cañón: cruzaría las piernas. Documentado en `DECISIONES_JUEGO.md`.
- El solucionador (`src/core/rig.ts`) escala cajas, pivote y vectores del brazo; la vista aplica la escala.

**Resultado.** `tests/rig-masks.test.ts`: 25 combinaciones brazo×torso dentro del rango 0,9–1,1, el trasero al 90 %, y 25 combinaciones brazo×piernas con la punta del trasero sobre el suelo y ≤ 25 px de brazo sobre las piernas (ninguna lo cruza). Capturas antes/después en PC y móvil: `docs/capturas/ronda3/brazos-antes-*` y `brazos-despues-*`.
