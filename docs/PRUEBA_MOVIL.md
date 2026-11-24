# Prueba en iPhone y Android reales

Lo que Playwright **no** puede comprobar y debes probar tú en un teléfono (el despliegue lo haces tú desde Vercel).

## iPhone (Safari)

1. Abre la URL en Safari **horizontal**. Debe verse el menú sin recortes y, abajo, el aviso amarillo "Desliza hacia arriba para ocultar la barra".
2. Desliza hacia arriba en el Menú: la barra de direcciones y la de pestañas deben colapsar y el juego crecer para llenar la pantalla. El aviso desaparece tras el primer scroll.
3. Entra al Laboratorio: también debe poder deslizarse. Entra a un combate: **no** debe haber scroll; apuntar con el dedo no mueve la página.
4. Toca los botones justo después de deslizar: la respuesta del toque debe coincidir con el dibujo (la posición de los toques se recalcula al hacer scroll).
5. Menú → **Instalar**: aparece el modal con los 3 pasos y los íconos de Compartir y "+". Sigue los pasos: Compartir → Añadir a pantalla de inicio → ábrelo desde el ícono.
6. Desde el ícono debe abrir **sin barras** (pantalla completa), en horizontal; el botón "Instalar" ya no aparece. Comprueba el notch: los botones no deben quedar bajo la isla/ceja (zonas seguras).
7. Primer toque: la música/sonidos se activan (iOS exige un gesto).
8. Gira a vertical: aparece "Gira tu dispositivo"; vuelve a horizontal y el juego reaparece del tamaño correcto.
9. Cambia de app y vuelve: el juego sigue (si Safari perdió el contexto WebGL, la página se recarga sola).
10. Sin "tirón para refrescar", sin zoom con doble toque ni con pellizco, sin menú de copiar al mantener pulsado.

## Android (Chrome)

1. Abre la URL en Chrome horizontal. En el Menú debe aparecer **Instalar** (si Chrome ya disparó `beforeinstallprompt`); si no, **Pantalla completa: NO**.
2. **Instalar** muestra el diálogo del sistema; tras instalar, abre desde el ícono: pantalla completa y horizontal.
3. Sin instalar: **Pantalla completa** entra y sale (y al primer toque en el Splash lo intenta solo).
4. El scroll del Menú/Laboratorio colapsa la barra de Chrome; en combate no hay scroll.
5. Mismo punto 4, 7, 8, 9 y 10 de iPhone.

## iPad

- Tiene la API de pantalla completa: el botón dice "Pantalla completa". También hay franja de scroll en Menú y Laboratorio (la barra de Safari también colapsa).

## Qué se verificó sin dispositivo (Playwright)

- Pixel 7 horizontal (Chromium), iPhone 14 y iPad horizontal (WebKit) y escritorio: meta viewport (`viewport-fit=cover`, `interactive-widget=resizes-content`) y metas de app web, la caja del juego no sobrepasa el `visualViewport`, el lienzo mantiene 16:9, el botón de instalación según la plataforma (en iPhone, los 3 pasos), la franja de scroll solo en Menú/Laboratorio y solo con puntero táctil, y combate sin scroll con `touch-action: none` en el lienzo.
- **No se puede emular:** la colapsada real de la barra de Safari, el diálogo de instalación de Chrome, el instalador de iOS, las zonas seguras reales de un iPhone con isla, el audio bloqueado hasta el primer gesto y la pérdida real del contexto WebGL.
