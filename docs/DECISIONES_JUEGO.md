# Decisiones de diseño

Aquí está lo que decidimos al construir el juego y por qué. Las reglas vienen del enunciado del proyecto, del prototipo de diseño (`design-prototype/`) y de la rúbrica (`docs/rubrica.pdf`). Lo que no teníamos documento para confirmar lo escribimos como supuesto y lo dejamos en `src/data/*.json` con la marca `TODO(balance)`, para ajustarlo sin tocar código.

## Reglas base

El mundo mide 1600 por 900 unidades lógicas y se escala para caber en cualquier pantalla. Cada turno dura 20 s, de los cuales el jugador puede caminar hasta 6 s acumulados y hace un solo ataque; después tiene 3 s de retirada. El viento es un entero de -5 a 5 que se sortea al empezar cada turno con la semilla de la partida. Cae una caja cada 3 turnos. Desde la ronda 6 sube el ácido 40 px por ronda, y quien lo toca muere. Una criatura sin piezas tiene 80 de vida, 100 % de movilidad, 0 % de resistencia y 100 % de daño. El daño final es `base × (1 + bonos) × (1 − resistencia)` y la resistencia tiene tope de 90 %.

Los botones miden 104 px lógicos y el texto nunca baja de 32 px. Se detecta un teléfono cuando la ventana mide 900 px o menos de ancho, o cuando hay puntero táctil y el lado corto mide 600 px o menos.

## Piezas, presupuesto y armas

Tomamos un presupuesto de 22 puntos por criatura, porque el prototipo usaba ese tope y un laboratorio sin tope no tiene sentido. Las piezas cuestan entre 4 y 6 puntos y el efecto es el mismo en las cuatro ranuras de un donante: Armadura 6 puntos y 10 % de resistencia, Espantapájaros 5 y 8 de vida, Maniquí 4 y 10 % de movilidad, Juguete 5 y 8 % de daño, Refrigerador 6 y 10 de vida.

Los brazos y el torso dan un arma cada uno y la cabeza da una habilidad de un solo uso. Todas las criaturas empiezan con un cañón infinito.

| Donante | Brazos | Torso | Habilidad |
|---|---|---|---|
| Armadura | Mazo de justa | Bazuca | Escudo (recibe la mitad del daño) |
| Espantapájaros | Granada de calabaza | Ráfaga de hielo | Salto |
| Maniquí | Bazuca | Mortero | Carrera (4 s más de movimiento) |
| Juguete | Rayo Tesla | Granada de calabaza | Cuerda (50 % más de daño al siguiente tiro) |
| Refrigerador | Ráfaga de hielo | Poción ácida | Curar (20 de vida) |

Las armas con munición traen entre 4 y 6 disparos. Aturdir multiplica por 2.5 la dispersión del siguiente turno, congelar impide caminar un turno y el charco de la poción quema a cualquiera que esté dentro, también a quien la lanzó. El mortero obliga a un ángulo de al menos 60 grados y su tiro ignora la cobertura mientras sube. Ninguna arma daña ni empuja a su dueño durante los primeros 0,4 s de vuelo.

## Combate

Apuntar es arrastrar en cualquier zona libre y la potencia se ajusta con la barra del HUD. Cada turno empieza con la puntería neutra, mirando al rival. La dispersión crece con la potencia y con lo que se caminó en el turno, y el viento puede cambiar durante el vuelo con ráfagas acotadas. Las explosiones empujan y el terreno entre la explosión y la criatura reduce el daño. Una criatura lanzada fuera de los bordes muere. Si al cerrar el turno no queda nadie vivo es empate; si el ácido alcanza a las dos a la vez, sobrevive la de más vida.

Las cajas dan salud, munición, tiempo de movimiento, escudo o un bono de daño. La caja misteriosa puede ser trampa pero nunca mata. Si una criatura va perdiendo por 20 % de la vida máxima o más, la mayoría de las cajas caen cerca de ella. Probamos además un bono de daño para quien va perdiendo y lo descartamos porque no movía ninguna métrica.

Al terminar la partida se abre un cofre de remiendos con un objeto, o dos si hubo ganador. Los cosméticos no cambian ninguna estadística.

## Cómo medimos el balance

Escribimos un bot de dos niveles, novato y experto, y un simulador que juega partidas completas con semilla (`docs/balance/BOT.md`). Con él medimos cada fase sobre 300 partidas. La primera versión de combate era casi lineal: quien daba el primer golpe ganaba el 69.3 % de las veces. Bajamos el daño de las armas a la mitad, subimos la dispersión al doble y repartimos el daño entre ocho armas, y quedó en 50 %. La meta de remontadas de 20 % no se alcanzó: llegamos a 12.7 %. Los números por fase están en `docs/balance/`.

## Mapas

Hay tres mapas (Vertedero, Cementerio embrujado y Fábrica de juguetes) definidos por datos en `maps.json`: capas con paralaje, terreno, puntos de salida, peligros y viento. El paralaje sigue la convención de Phaser, donde 0 es fijo a la pantalla y 1 va pegado al mundo, y cada capa se agranda lo justo para que no se vean sus bordes al mover la cámara. Cuando el mapa tiene arte de terreno, la máscara de píxeles sólidos sale del canal alfa del PNG. La Fábrica usa un terreno procedural porque nunca llegó su arte de terreno.

Los puntos de salida los valida una prueba: suelo sólido bajo los pies, desnivel de 24 px o menos, espacio libre del alto de una criatura, al menos 600 px entre los dos, simetría de 100 px y fuera del ácido. El sesgo de viento de cada mapa es 0 por ahora.

## Arte y ensamble de la criatura

Los fondos de las hojas de arte son verde o magenta. Los quitamos con un flood-fill desde el borde y una segunda pasada estricta para los huecos cerrados, y revisamos cada resultado sobre fondo de cuadros, blanco, negro y magenta para encontrar halos. El pipeline está en `scripts/`.

Cada pieza lleva anclas en `src/data/anchors.json` (cuello, cadera, hombro) y `src/data/rig.json` (detalle fino y correcciones a mano). `src/core/rig.ts` las convierte en posiciones: las piernas se apoyan en el suelo, el torso se hunde unos píxeles en las piernas, la cabeza en el torso y el brazo gira desde el hombro. El brazo se dibuja dos veces, uno delante con el arma y otro atrás, más oscuro, solo de adorno. El largo del brazo se normaliza a entre 0.9 y 1.1 veces la altura del torso. Los brazos del arte no están dibujados perfectamente horizontales, así que el ángulo de reposo se resta al apuntar.

El ácido se dibuja con dos imágenes que se repiten. La superficie es la tira original espejada, de modo que sus dos bordes son la misma columna y no se ve costura. El cuerpo es un fragmento de la parte baja, espejado en los dos ejes. Con "Reducir efectos" se quitan la lluvia ácida y casi todo el movimiento.

## Accesibilidad y pantallas

Los textos cumplen un contraste de 4.5 a 1, que comprueba una prueba. El jugador se distingue por color y por forma (círculo el 1, cuadrado el 2), el tiempo urgente cambia de color y muestra signos de exclamación, y la vida baja usa rayas y calavera además del color. "Reducir efectos" apaga sacudidas, pausas de impacto, paralaje y casi todas las partículas. El juego se pausa solo si la pestaña pierde el foco, y el botón Atrás de cada pantalla, Esc y el gesto del teléfono hacen lo mismo.

## Herramientas de depuración

`?debug=fps` muestra los cuadros por segundo y se deja en producción para medir en el celular. `?debug=rig`, `?debug=assets` y `?debug=acid` solo existen en desarrollo y no entran al bundle final.
