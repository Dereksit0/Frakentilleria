# FrankenTillería – Paquete de traspaso a VS Code

Este paquete junta todo lo necesario para empezar a programar. Léelo primero y luego sigue "Pasos".

## 1. Qué es el juego (resumen de 30 segundos)

Videojuego web de artillería por turnos tipo Worms, para 2 jugadores en el mismo dispositivo (hot-seat).
Primero armas una criatura en el laboratorio (cabeza, torso, brazos y piernas de 5 donantes: Armadura,
Espantapájaros, Maniquí, Juguete de cuerda, Refrigerador) y luego combates por turnos en un mapa destructible.
Frase: "Ensambla. Dispara. Sobrevive."

Proyecto final de "Programación Asistida por IA" (UMAD, Dr. Miguel Jara Maldonado). Debe cumplir la rúbrica del PDF.

## 2. Stack y decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Motor | Phaser 3 + TypeScript + Vite |
| Pruebas | Vitest, con TDD sobre `src/core/` |
| Despliegue | Vercel (costo $0) |
| Arquitectura | Lógica pura en `core/` (sin Phaser) y render en `scenes/`; datos en JSON (`parts.json`, `weapons.json`) |
| Mundo | 1600×900 unidades lógicas, escala FIT, UI en capa propia |
| Turno | 20 s (6 s de movimiento acumulado, 1 acción de ataque, 3 s de retirada) |
| Reglas | Viento −5..+5; cajas cada 4 turnos; tormenta ácida desde la ronda 6 (+40 px por ronda) |
| Piezas | 5 donantes × 4 espacios = 20 piezas, presupuesto de puntos por criatura |
| Estadísticas base | Vida 80, Movilidad 100 %, Resistencia 0 %, Daño 100 % |
| Fórmula de daño | daño base × (1 + bonos) × (1 − resistencia) |

## 3. Qué hay en esta carpeta

```
HANDOFF.md                  este archivo
docs/                       <- pon aquí los dos documentos (ver Paso 1)
design-prototype/           archivos del prototipo de pantallas (referencia visual)
assets/raw/                 imágenes y música generadas, SIN procesar
  logo/        logo-frankentilleria-sf.png (DEFINITIVO, transparente), icono-frankentilleria-sf.png (DEFINITIVO, transparente)
               [antiguos conservados: logo-wordmark-final.png, icon-cannon-square.png]
  screens/     portada-key-art.png, splashscreen.png, menu-bg-laboratorio.png
  characters/  donante-armadura-parts.png   (1 de 5 donantes)
  maps/        vertedero-sky.png, vertedero-far.png, vertedero-terrain.png
  maps/vertedero/  vertedero-mid.png            (plano medio, fondo verde)
  maps/cementerio/ cementerio-terrain.png (fondo magenta), cementerio-far.png (fondo verde)
  maps/fabrica/    fabrica-bg.png               (fondo completo, una capa)
  weapons/     iconos-armas.png (6 armas en una hoja)
  fx/          proyectiles-explosiones.png
  ui/          items-cajas-habilidades.png
  audio/       music-1.mp3 (65 s)
```

Importante: las imágenes son PNG **sin transparencia** (RGB). Los fondos magenta `#FF00FF` o verde
`#00FF00` hay que quitarlos antes de usarlas. El cielo, el fondo del menú, la portada y el splash NO
llevan recorte (son fondos completos).

## 4. Pantallas y dónde está su especificación

Prototipo de diseño: carpeta design-prototype/ (se abre en el navegador).

| Pantalla | Archivos (PC / móvil) | Nota |
|---|---|---|
| Menú | `Menu.dc.html` / `Menu-Movil.dc.html` | Reemplazar el título improvisado por el logo final |
| Laboratorio | `Laboratorio.dc.html` / `Laboratorio-Movil.dc.html` | Presupuesto, estadísticas, ADN, "Al azar" |
| Pasa el dispositivo | `Pasa.dc.html` / `Pasa-Movil.dc.html` | Entre J1 y J2 |
| Combate | `Combate.dc.html` / `Combate-Movil.dc.html` | HUD, armas, potencia, habilidad |
| Pausa | `Pausa.dc.html` / `Pausa-Movil.dc.html` | |
| Resumen | `Resumen.dc.html`, `Resumen-Empate.dc.html` (+ móvil) | Gana J1 y empate |
| Tutorial | `Tutorial.dc.html` / `Tutorial-Movil.dc.html` | 5 pasos |
| Ajustes | `Ajustes.dc.html` / `Ajustes-Movil.dc.html` | |
| Criaturas y estados | `Criatura.dc.html`, `Donantes.dc.html`, `Estados.dc.html` | |
| Navegación | `Main.dc.html` | Detecta PC o móvil automáticamente |

Los `.dc.html` NO son código del juego: son maquetas del lienzo de diseño. Úsalas para medir, copiar textos
y entender los estados. El juego real se reconstruye en Phaser.

### Medidas que no se deben cambiar
- Lienzo lógico PC: 1600×900. Móvil horizontal: 844×390 (escala 0.433, zonas seguras de 48 px).
- Botones táctiles: 104 px lógicos (≈ 45 px reales en móvil; el mínimo táctil es 44 px).
- Texto mínimo: 32 px lógicos. Contorno de tinta 4 px. Esquinas de 12 px en botones y paneles.
- Detección de dispositivo (sin botones): `innerWidth <= 900`, o puntero táctil y lado menor `<= 600`.

### Colores del prototipo
Tinta `#0F0E15`, Carbón `#1B1A24`, Noche `#2E2A47`, Tormenta `#5B3FA0`, Hueso `#F4EFE1`,
Voltio `#FFE14D`, Alarma `#FF5468`. Tipografías: Bungee (títulos) y Nunito Bold (texto).

## 5. Diferencias que hay que resolver (no las apliqué sin tu aprobación)

1. **Ácido:** el documento de diseño dice `#7CFF4F`; el prototipo usa `#7CE08A`. Elegir uno y fijarlo.
2. **Presupuesto de puntos:** el documento dice "5 ± 1 puntos por pieza"; el prototipo usa costos de 4 a 6 y un tope de 22.
   Falta confirmar si el tope existe y cuánto vale.
3. **Degradados:** el arte generado tiene degradados suaves; el style board decía "sin degradados salvo el cielo".
   Decidir si se acepta como excepción.
4. **Armas:** el prototipo usa Cañón, Mortero y Cohete; el documento de diseño define otras (mazo, granada de calabaza,
   bazuca, rayo Tesla, ráfaga de hielo). Alinear antes de crear `weapons.json`.
5. **Alcance:** solo existe 1 de 5 donantes; hay 3 mapas (ver docs/DECISIONES.md y docs/ASSETS_TODO.md).

## 6. Qué falta producir (con IA)

4 donantes (hojas de piezas), capas extra para la Fábrica, expresiones de las criaturas,
íconos pequeños de HUD, 2 pistas de música más y los efectos de sonido.

## 7. Pasos para arrancar en VS Code

1. **Exporta los dos documentos** desde el asistente de IA (exportar a Markdown) y guárdalos en `docs/`:
   - `docs/PLANEACION.md` (Planeación completa)
   - `docs/DISENO.md` (Diseño del juego)
   Son la fuente de verdad de reglas, piezas, armas, números y rúbrica.
2. Abre esta carpeta en VS Code (`File > Open Folder`) e inicia el asistente de IA en la terminal integrada.
3. Pega el prompt de construcción del repositorio (el que mejoramos en el chat) y añade al final:
   "Lee primero HANDOFF.md, docs/PLANEACION.md y docs/DISENO.md. Usa assets/raw como fuente y no los modifiques."
4. Pide recortar el fondo de las imágenes con un script en `scripts/` que lea de `assets/raw` y escriba a `public/assets`.
5. Empieza por `src/core/` con pruebas (daño, presupuesto, viento, turnos) antes de tocar las escenas.

## 8. Costo

Todo es $0 MXN: Phaser, TypeScript, Vite, Vitest, GitHub y Vercel (plan gratuito o el Pro que ya tienes). Total: $0 MXN.

## 9. Esquema de nombres en assets/raw (actualizado)

`<categoria>/<mapa>/<mapa>-<capa>.png` para mapas nuevos (capas: `sky`, `far`, `mid`, `terrain`, `bg`). Los archivos originales siguen planos en `maps/`. Nunca se modifica `assets/raw`; `npm run assets` genera `public/assets`. Revisión de chroma: `node scripts/preview-chroma.mjs`.
