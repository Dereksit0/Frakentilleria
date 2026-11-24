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

## 4. Móvil en cualquier navegador (sobre todo Safari de iPhone)

**Causa.** El documento no tenía nada que desplazar (`overflow: hidden`, alto 100 %), así que Safari nunca colapsa sus barras; el lienzo se medía con `100vw/100vh` (incluyen las barras) y no con el viewport visible; no había una vía de instalación para iPhone, donde JavaScript no puede pedir pantalla completa.

**Qué se hizo (todas las capas).**
- **a) Tamaño real:** `src/ui/viewport.ts` mide `visualViewport` (también en `scroll` y `orientationchange`) y fija `--vvh`; el CSS usa `100vh → 100svh → var(--vvh)` y `env(safe-area-inset-*)`. Meta viewport: `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`. La función pura `fitScale` (probada) documenta el cálculo FIT con zonas seguras.
- **b) Instalable:** el manifest ya traía `display: fullscreen`, `display_override`, `orientation: landscape` y las metas de Apple (`apple-mobile-web-app-capable`, `status-bar-style=black-translucent`, `apple-touch-icon`). Nuevo botón **Instalar / Pantalla completa** en el Menú (`src/ui/install.ts`, modo decidido por la función pura `installMode`): API de pantalla completa si existe (con prefijo webkit), `beforeinstallprompt` en Android Chrome, y en iPhone Safari un modal con los 3 pasos con íconos dibujados por código (Compartir y "+"). No aparece si ya está en `standalone`/`fullscreen`.
- **c) Sin instalar:** solo en Menú y Laboratorio, solo con puntero táctil y solo en modo navegador, el documento se hace más alto que la ventana (`#strip`, lienzo fijo detrás) con el aviso "Desliza hacia arriba para ocultar la barra", que desaparece tras el primer scroll. En combate no hay scroll y el lienzo captura los gestos. `overscroll-behavior` evita el tirón para refrescar. **Fallo real encontrado:** con el lienzo fijo y la página desplazada, Phaser medía los toques con límites en caché y fallaban 60 px; se arregló con `scale.updateBounds()` en cada scroll.
- **d) Detalles:** `touch-action: none` en el lienzo de combate y `pan-y` en Menú/Laboratorio, `user-select: none`, `-webkit-touch-callout: none`, sin menú contextual, sin zoom por gesto ni doble toque, audio desbloqueado con el primer toque, y pérdida de contexto WebGL (se evita el borrado y se recarga al restaurar). **DPR:** el lienzo es siempre 1600×900 lógicos escalado por CSS, así que el DPR no lo encarece (tope efectivo, sin configuración extra). El aviso "Gira tu dispositivo" sigue igual.
- **e) Proyectos de Playwright:** `pc`, `movil` (Pixel 7 horizontal, Chromium), `iphone` (iPhone 14 horizontal, WebKit) e `ipad` (iPad gen 7 horizontal, WebKit) con `e2e/movil-safari.spec.ts`.

**Resultado.** `tests/mobile.test.ts` (14 pruebas) y `movil-safari.spec.ts` pasan en los 4 proyectos (en una corrida el de iPad falló una vez por un arranque lento y pasó al repetirlo). Capturas de combate en `docs/capturas/ronda3/safari-*`. **No comprobable sin dispositivo:** la colapsada real de la barra de Safari y el instalador; checklist para tu iPhone y tu Android en [PRUEBA_MOVIL.md](PRUEBA_MOVIL.md).

## 5. Viento que se note

**Causa.** El viento solo se mostraba como el texto "Viento N" y una flecha corta; no había nada en la escena que lo hiciera sentir.

**Qué se hizo.**
- `windVisual(wind)` (`src/core/windVisual.ts`, pura, probada para −5..+5): dirección y ángulo, partículas (proporcionales a la fuerza, **tope 60**), velocidad con signo, nivel de la manga, una flecha por nivel, si hay aviso y si hay rachas visibles (fuerza ≥ 3), y el desplazamiento de las capas lejanas.
- **Partículas ambientales** (`src/ui/windFx.ts`): un pool fijo de 60 sprites reutilizados (papeles y polvo en el Vertedero, hojas y jirones de niebla en el Cementerio, pelusa y confeti en la Fábrica; tipos en `WIND_KINDS`). Velocidad y dirección según el viento; con ráfagas usa `windNow`. No se crea nada después del constructor y usa su propio generador (no toca el azar del juego). Rachas visibles cruzando la pantalla con `ev-wind-streaks`.
- **Manga del HUD** dibujada por código (la imagen `hud-wind` es un botón con la manga fija, no se puede orientar): apunta hacia donde sopla, se infla con la fuerza y ondea; y **una flecha por nivel** (no depende del color).
- **Nubes y capas lejanas** se inclinan hacia el viento con suavizado (`far` entero, `mid` a la mitad; el cielo no). No hay objetos separados de pasto/lápidas/cuerdas: no se simuló su vaivén.
- **Aviso de 1,2 s** al empezar el turno (flechas + "VIENTO N"). Las **rachas** durante el vuelo (|ráfaga| ≥ 1) hacen un destello en el borde de donde sopla y un silbido sintetizado (`sfx('wind')`, no existe un sfx-viento en el audio).
- **Estela** de los proyectiles inclinada por el viento y un pequeño banderín al final de la trayectoria de vista previa.
- **Reducir efectos:** sin partículas, sin rachas, sin destello, sin estelas ni banderín; quedan la manga (sin ondeo) y las flechas.

**Resultado.** `tests/windVisual.test.ts` (9 pruebas). `e2e/viento.spec.ts` (PC y móvil): con viento 0 hay 0 partículas, con ±5 hay 60 y nunca más; capturas `docs/capturas/ronda3/viento-derecha.png` (Cementerio, hojas) y `viento-izquierda.png` (Vertedero, papeles). 60 fps: no medibles aquí (WebGL por software); el coste añadido es un bucle de 60 sprites sin crear objetos.

## 6. Partidas un poco más rápidas

**Causa / punto de partida.** Con el bot, las partidas ya duraban 9,8 rondas (experto–experto), dentro de la nueva banda 7–11; el ácido de la ronda 6 es el verdadero techo de duración.

**Qué se hizo.** `balance.globalDamageMultiplier` en `tuning.json` (1,5, `TODO(balance)`), usado como `rules.damageScale` por defecto, solo en el daño de armas; la caída, el ácido y la tormenta no cambian. Barrido y tabla antes/después en [BALANCE_RONDA3.md](BALANCE_RONDA3.md).

**Resultado.** Experto–experto: rondas 9,8 → 9,0; primer golpe 52,7 %; empates 0,7 %; remontadas 12,7 → 19,0 % (meta 20 %, **no alcanzada**); Bazuca 32,4 % del daño. `tests/globalDamage.test.ts` (4 pruebas); dos pruebas antiguas de daño exacto fijan `damageScale = 1`.

## 7. Animación al ganar un logro

**Qué existía.** Ya había un sistema de logros (`rewards.ts`, 8 logros distintos, evaluados solo al terminar la partida y mostrados como una línea de texto), pero **no** coincidía con los 8 pedidos ni con el arte `ach-*` del atlas, y no había aviso.

**Qué se hizo.**
- `src/data/achievements.json` con los 8 logros y su arte (`ach-first-blood`, `ach-three-wins`, `ach-flawless`, `ach-acid-ko`, `ach-arsenal`, `ach-comeback`, `ach-survivor`, `ach-collector`): primer golpe, tres victorias acumuladas, partida sin recibir daño, muerte por ácido del rival, 5 armas distintas en una partida, remontada, sobrevivir 2 rondas de ácido y coleccionista (bloqueado mientras no existan cosméticos; hoy existen, se gana al reunirlos todos).
- Evaluación pura en `src/core/achievements.ts`: `checkLive` (durante el combate: primer golpe, 5 armas, 2 rondas de ácido) y `checkEnd` (tres victorias, sin daño, muerte por ácido, remontada, coleccionista), más la **cola** (`AchievementQueue`: uno a la vez, los demás esperan, cada id sale una vez) y el **temporizador** (`toastPose`, 3 s). `Collection` (`rewards.ts`) los guarda en `localStorage` con `try/catch` (ya lo hacía) y lleva la lista de nuevos de la partida (`beginMatch`/`matchNew`).
- Aviso (`src/ui/achievementToast.ts`): baja desde arriba con la insignia, anillo de brillo, destellos, confeti (`fx-confetti` + piezas sueltas), "¡Logro desbloqueado!", nombre y descripción (≥ 32 px, tinta sobre fondo oscuro), sonido sintetizado `sfx('achievement')` (no existe sfx-logro). ~3 s, no es interactivo (no bloquea el combate ni el input) y se encola si hay varios. Con "Reducir efectos": solo se desvanece (sin deslizar, sin confeti ni destellos).
- Resumen: "Logros nuevos: …" con todos los de la partida (en vivo y de cierre) y el aviso de los de cierre.
- Se actualizaron las pruebas de `rewards` (cambian los logros).

**Resultado.** `tests/achievements.test.ts` (16 pruebas: reglas, cola, temporizador y pose) y `tests/rewards.test.ts` ajustado. `e2e/logros.spec.ts` (PC y móvil): desbloquea dos logros a la vez, el primero se muestra y el segundo espera; con el aviso en pantalla el botón "Burlar" sigue respondiendo; captura `docs/capturas/ronda3/logro-pc.png`. Nota: "usar 5 armas distintas" cuenta las armas de toda la partida (el núcleo guarda un único conjunto para ambos jugadores).
