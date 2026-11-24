# Decisiones de juego y supuestos (core + UI)

> `docs/DISENO.md` y `docs/PLANEACION.md` **no existen** en el paquete de traspaso (la carpeta `docs/` venía vacía).
> Las reglas salen de `HANDOFF.md`, del prototipo (`design-prototype/`) y de la rúbrica (`docs/rubrica.pdf`).
> Todo número inventado vive en `src/data/*.json` marcado `TODO(balance)` para ajustarlo sin tocar código.

## Reglas tomadas tal cual del HANDOFF

| Regla | Valor | Dónde |
|---|---|---|
| Mundo | 1600×900 lógicos, escala FIT | `src/main.ts`, `src/ui/theme.ts` |
| Turno | 20 s; 6 s de movimiento acumulado; 1 ataque; 3 s de retirada | `src/core/turns.ts` |
| Viento | entero −5..+5, nuevo cada turno, con semilla | `rollWind` |
| Cajas | cada 4 turnos | `crates.json` → `everyTurns` |
| Tormenta ácida | desde la ronda 6, +40 px por ronda | `src/core/acid.ts` |
| Estadísticas base | Vida 80, Movilidad 100 %, Resistencia 0 %, Daño 100 % | `parts.json` → `base` |
| Daño | `base × (1 + bonos) × (1 − resistencia)` | `calcDamage` |
| Botones / texto | 104 px / mínimo 32 px, contorno 4 px, esquinas 12 px | `theme.ts`, `widgets.ts` |
| Dispositivo | `innerWidth <= 900` o (puntero táctil y lado menor `<= 600`) | `src/ui/device.ts` |

## Decisiones ya dadas por el dueño del proyecto

Ácido `#7CFF4F`; armas = las 5 del documento de diseño (Mazo de justa, Granada de calabaza, Bazuca, Rayo Tesla, Ráfaga de hielo);
excepción de degradados suaves aceptada; donantes y mapas sin arte se generan por código con las mismas dimensiones.

## Supuestos míos (revisar cuando exista DISENO.md)

1. **Presupuesto de puntos = 22.** El HANDOFF dice "5 ± 1 por pieza" (se respeta: costos 4–6) y que el prototipo usa un tope de 22 sin confirmar.
   Como un presupuesto sin tope no tiene sentido en el laboratorio, usé 22 (`parts.json → budget`, marcado TODO).
2. **Costos y efectos por donante** (iguales en las 4 ranuras, como en el prototipo): Armadura 6 pts / Res +10 %; Espantapájaros 5 / Vida +8;
   Maniquí 4 / Mov +10 %; Juguete 5 / Daño +8 %; Refrigerador 6 / Vida +10.
3. **Armas por pieza.** Brazos y torso otorgan un arma cada uno (sin repetir); cabeza otorga la habilidad de un solo uso.

   | Donante | Brazos | Torso | Habilidad (cabeza) |
   |---|---|---|---|
   | Armadura | Mazo de justa | Bazuca | Escudo (recibe ½ daño hasta tu siguiente turno) |
   | Espantapájaros | Granada de calabaza | Ráfaga de hielo | Salto (impulso vertical) |
   | Maniquí | Bazuca | Mazo de justa | Carrera (+4 s de movimiento) |
   | Juguete | Rayo Tesla | Granada de calabaza | Cuerda (+50 % daño al siguiente disparo) |
   | Refrigerador | Ráfaga de hielo | Rayo Tesla | Curar (+20 vida) |

4. **Armas** (`weapons.json`, números TODO): Mazo 34 de daño cuerpo a cuerpo con empuje; Granada 28, rebota 50 % y explota a los 2.5 s;
   Bazuca 32, explota al contacto; Tesla 20, rayo instantáneo que ignora el viento; Hielo 14 y congela (el rival no camina su siguiente turno).
5. **Caída:** gratis hasta 120 px, luego 0.18 de daño por px (reducido por resistencia). **Ácido:** 15 de daño plano por turno a quien tenga los pies bajo el nivel
   (ignora escudo y resistencia). Caer fuera del mundo mata.
6. **Empate:** si al cerrar el turno no queda nadie vivo (explosión mutua o ácido) → "¡Empate!". Si queda uno → gana.
7. **Cajas** (`crates.json`): salud +25, escudo ½, botas +3 s de movimiento, puño +30 % daño. Todas se ven como caja misteriosa hasta recogerse.
8. **Potencia** 10–100 %; velocidad de salida `1100 px/s × potencia`; gravedad 900 px/s²; viento = `14 px/s²` por unidad.
9. **Apuntar:** arrastrar en cualquier zona libre apunta el cañón hacia el puntero; la potencia se ajusta con la barra del HUD (o Q/E). Se muestra una trayectoria corta de ayuda.
10. **Selector de mapa** en el menú (Aleatorio / 3 mapas). Revancha conserva mapa y criaturas; "Cambiar criaturas" vuelve al laboratorio.
11. **Teclado:** A/D o ←/→ mover, W/S o ↑/↓ apuntar, Q/E potencia, Espacio/Enter fuego, 1/2 arma, H habilidad, J saltar, Esc/P pausa.
12. **Accesibilidad:** contraste ≥ 4.5:1 verificado por pruebas (`tests/contrast.test.ts`); jugador = color **y** forma (círculo J1 / cuadrado J2);
    temporizador urgente = rojo **y** signos "¡4s!"; "Reducir efectos" desactiva sacudida, pausa de impacto, parallax y casi todas las partículas.
13. **Sin Context7 en esta sesión:** la API de Phaser 3.90 se consultó de memoria y se verificó ejecutando el juego (ver `docs/REPORTE.md`).

## Arte de donantes (hojas nuevas)

- Fondo verde: llave global (`scripts/donors.mjs`, dura 50 / suave 110). El verde puro está lejos del oliva de la garra y del morado de los parches; la llave global también limpia los huecos cerrados (agujeros de la llave de cuerda del Juguete). Sobrante verde: se borra el verde claro cercano al borde y se limita el verde de los bordes (despill).
- Piezas por componentes conectados, asignadas por cuadrante de la hoja; margen de 4 px.
- Normalización: la altura (el largo, en brazos) de cada pieza iguala a la pieza de Armadura, sin superar la caja de `parts.json`. La cabeza del Espantapájaros queda limitada por el ancho del sombrero (se ve algo más pequeña); no se recortó arte.
- Los brazos vienen inclinados unos grados hacia abajo; no se rotaron: el ángulo de apuntado se aplica desde el hombro. El cañón/boquilla no cambia la regla de disparo (el proyectil sale del centro de la unidad).
- Anclajes (`src/data/anchors.json`, generado): cuello de cabeza; cuello, cadera y hombro del torso; hombro y punta del brazo; cadera y suelo de las piernas. `rig.hipOverlap`/`rig.neckOverlap` hunden las piezas para ocultar la costura. El hombro del torso es una estimación (8 % a la derecha del centro, 30 % de la altura).
- Íconos de la lista del Laboratorio: cabeza de cada donante, 96×96, fondo transparente (`icon_<donante>`).

## Fase de jugabilidad 1 (decisiones)

- El ácido **mata al tocarlo** (antes 15 de daño). Si llega a ambos a la vez, muere el de menos vida; con vida igual, empate. El último en pie no muere por ácido.
- Daño de armas a la mitad y dispersión ×2 respecto a la primera versión (barrido en `docs/BALANCE_FASE1.md`). Números siguen `TODO(balance)`.
- El ácido sigue el HANDOFF (ronda 6, +40 px por ronda); por eso las partidas largas se cierran hacia las rondas 10–13.
- Una criatura lanzada por una explosión puede salir por los costados y morir; una que salta por su cuenta sigue limitada a los bordes.
- La puntería de cada turno parte de 45° y 50 % mirando al rival.

## Fase 2A: armas por donante (propuesta, sin DISENO.md)

| Donante | Brazos | Torso | Habilidad (cabeza) |
|---|---|---|---|
| Armadura | Mazo de justa | Bazuca | Escudo |
| Espantapájaros | Granada de calabaza | Ráfaga de hielo | Salto |
| Maniquí | Bazuca | **Mortero** (antes Mazo) | Carrera |
| Juguete | Rayo Tesla | Granada de calabaza | Cuerda |
| Refrigerador | Ráfaga de hielo | **Poción ácida** (antes Tesla) | Curar |

- Todos tienen además el **Cañón** infinito como primera arma. Cada arma limitada sale de al menos un donante (prueba `tests/weapons2.test.ts`).
- Munición inicial: Mortero 5, Bazuca 5, Granada 5, Mazo 5, Tesla 6, Hielo 5, Poción 4 (`TODO(balance)`). Caja de munición: +2 al arma con menos munición.
- Aturdir = dispersión ×2.5 en su siguiente turno. Poción: el charco quema a cualquiera dentro (también a quien la lanzó) al cierre de cada turno.
- Mortero: ángulo mínimo 60°; ignora la cobertura mientras sube.
## HUD, ácido, obstáculos, eventos, cajas, cosméticos, logros, dolor y piezas (segunda entrega)

- Fondo verde en dos pasadas: flood-fill desde el borde y, después, llave estricta sobre los huecos encerrados (distancia < 60 al verde puro, o g > 205 con r < 70 y b < 100 para el verde ruidoso entre cuerdas). Los verdes legítimos (ácido lima, bloque verde, caja militar, mano de zombi, botas con baba) quedan intactos; en estas hojas no se aplica la limpieza de verde "global". Vistas previas en `docs/capturas/chroma/atlas-*`.
- Las insignias de logros (`logros.png`) se tocan entre sí por arriba y por abajo: se separan en las líneas de la cuadrícula (franja de 2 px).
- Los iconos con cuadro morado se conservan con su cuadro y se exportan cuadrados (104 px el HUD y la interfaz, 96 px los logros; @2x al doble).
- Ácido: `acid-surface` es la tira escalada a 1024 px y espejada (2048 px) para que ambos bordes sean la misma columna; el espejo se eligió sobre el crossfade para no duplicar contornos. `acid-body` son las 128 filas inferiores espejadas en x e y. La superficie sube con el nivel existente (+40 px por ronda desde la 6); con "Reducir efectos": sin lluvia y ondas casi quietas. No se cambió la regla de daño ni el nivel.
- Sombreros y parches: sin rotar. `hatAnchor` = centro de la base de cada sombrero; `hatScale` por tipo; `headTop` = primera fila de la cabeza con al menos 45 % del ancho máximo (ignora la antena del Juguete y el plumero). **Decisión:** el sombrero cosmético se desactiva (`hatMode: "off"`) en la Armadura y el Espantapájaros, que ya llevan casco con plumero y sombrero de bruja; el resto usa `hatOffset` [0, 6]. `patchSlot` = centro del torso al 55 % de la altura. `?debug=rig` no se usó (lo está cambiando otra sesión).
- Niebla (~0.85) y fantasma (~0.85) llevan opacidad en el juego, no en el archivo; los globos de texto vienen vacíos y se escalan proporcionalmente al texto (no hay nine-slice porque la cola del globo rompe los bordes).
- Relámpago vertical: ancla abajo-centro (punta en el suelo) en vez de centro, para que el impacto caiga donde se coloca.

## Armas, efectos e insignias (hojas nuevas)

- Fondo: flood-fill desde el borde (`scripts/sheets.mjs`); los contornos negros protegen el ácido y los íconos verdes. Huecos cerrados del color del fondo: solo `fx-mazo-onda` y `fx-marcador-ataque-aereo` (llave estricta, distancia < 70, dentro del elemento). En los demás se borra el verde sobrante; el charco, la gota de ácido y la burbuja de escudo no pasan por esa limpieza.
- Las hojas llegaron todas en verde (algunas se pidieron en magenta). El orden de los adjuntos fue emblemas, efectos-2, efectos-1, íconos-2, íconos-1; se asignó por contenido.
- `fx-burbuja-escudo`: las celdas hexagonales son turquesa verdoso (venían así en el original, pintadas sobre el verde); se dejó tal cual. En juego se puede bajar el alfa.
- Cuervos: misma escala y lienzo común; el anclaje es el centroide del parche morado (cuerpo), no el centro del recorte.
- `pivot` = anclaje normalizado (lo lee Phaser como origen); los píxeles van en `anchorPx` porque Phaser da prioridad a un campo `anchor` y falla con arreglos.
- Tesla: el arco `fx-rayo-arco` se estira del cañón al impacto con alto fijo de 64 px; el zigzag dibujado a mano se retiró. Granada/hielo: se retiraron los tintes (el arte ya trae color); el proyectil de hielo rota según su velocidad.
- Insignias: congelado y escudo ya salen junto a la barra (a la derecha); sin mecánica nueva.

## Fase 4 (decisiones)

- Cajas: tiempo (utilidad) = +3 s de movimiento; misteriosa 55 % bonus / 45 % trampa (nunca mata); imitadora explota con 14 de daño sin matar. Frecuencia: cada 3 turnos.
- Ayuda al que va perdiendo: diferencia de vida ≥ 20 % de la vida máxima → 90 % de las cajas cae a ±220 px de él y las de salud/escudo/munición pesan ×6.
- Cofre al terminar cada partida (también en empate): 1 objeto, 2 si hay ganador, sin repetir. Los cosméticos no cambian ninguna estadística.
- El bono de daño para el que va perdiendo se probó y se descartó (sin efecto medible; ver BALANCE_FASE4.md).
