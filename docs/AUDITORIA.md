# Auditoría: congelamiento al impactar, trayectoria, armas, pantallas, Colección y caché

Estado al 26/11/2026, sobre `main` local (sin publicar). Un commit por prioridad.

## Números de pruebas

| | Antes (`eaf3d47`) | Después |
|---|---|---|
| Pruebas unitarias (`npm test`) | 577 en 37 archivos | **641 en 43 archivos**, todas pasan |
| Archivos E2E (Playwright) | 19 | 23 (`impacto`, `trayectoria`, `resoluciones`, `pwa`) |
| `npm run lint` | pasa | pasa |
| `npm run build` | pasa | pasa |

Cada commit se comprobó por separado: su instantánea exacta (extraída del índice a una carpeta aparte) pasó lint, pruebas y build antes de hacer el commit.

**E2E de regresión sobre el estado final** (impacto con las 8 armas, error forzado y trayectoria en los 3 mapas): PC 12/12, Android (Pixel 7) 12/12, iPhone 8/9. La que falló en iPhone fue Tesla, con "Page crashed" mientras cargaba el combate, antes de disparar. Repetida 4 veces: pasó 3 y la otra se cerró a los 1,4 s, al arrancar la página. Apunta a inestabilidad del WebKit de Playwright en Windows (ya se había visto antes con otras armas), no al impacto, pero solo un iPhone real lo confirma. Resoluciones: 8/8. PWA: 1/1.

Pruebas nuevas: `impacto` (8, una por arma), `armas` (36), `aim-preview` (7), `watchdog` (5), `vibrate` (3), `coleccion` (3) y 2 pares de contraste.

## 1. Congelamiento al impactar (iPhone)

**Causa raíz.** `vibrate()` comprobaba `'vibrate' in navigator`, que en WebKit es verdadero aunque el valor sea `undefined`. En cada golpe, `navigator.vibrate(ms)` lanzaba `TypeError: navigator.vibrate is not a function` dentro del `update` de la escena de combate. Una excepción ahí impide que Phaser programe el siguiente cuadro, así que la pantalla quedaba congelada para siempre. Se reprodujo en WebKit (perfil iPhone 14 de Playwright): el reloj de la escena quedaba fijo al primer impacto.

**Corrección.** Se comprueba `typeof navigator.vibrate === 'function'`, sin `try/catch`.

**Red de seguridad, que no oculta errores:**
- Manejador global (`error` y `unhandledrejection`) que registra el error y lo muestra en un panel con `?debug=log`, o manteniendo 2 s el dedo en la esquina superior izquierda (botón Copiar).
- Latido que reinicia el bucle de cuadros si se detiene con la página visible.
- Vigilante en el núcleo: un proyectil de más de 8 s o una espera de más de 4 s se resuelven aplicando el daño pendiente, y el turno avanza.

**Error encontrado en el propio vigilante.** La simulación de armas mostró que forzaba turnos sanos con la granada: 28 de 60 partidas. Si el turno terminaba en el mismo cuadro de la explosión, su reloj no se reiniciaba y sumaba los vuelos de turnos seguidos. Ahora se reinicia en `endTurn()`, con su prueba.

**Comprobado:**
- E2E de impacto con las 8 armas: pasa en Android (Pixel 7) y en iPhone.
- Un error forzado dentro del `update` queda registrado y el bucle vuelve a correr.

## 2. Línea de trayectoria

**Causa.** No dejó de dibujarse. Desde el commit del viento visible (`a898bea`), el cielo se llena de partículas color hueso iguales a los puntos de la vista previa, que además quedaba debajo de las placas de nombre.

**Corrección.**
- La línea es discontinua amarilla con borde de tinta y va por encima de las placas. Con alto contraste usa hueso y un borde más grueso.
- El cálculo pasó a `aimPreview` en `src/core/aim.ts`. Antes el mortero se dibujaba sin su ángulo mínimo; ahora lo respeta, igual que el disparo real.

**Regla de mapa que choca con el pedido.** En el Cementerio la niebla oculta la vista previa por diseño (`docs/BALANCE_FASE3.md`). No se cambió.

## 3. Armas

`tests/armas.test.ts` prueba cada arma. `scripts/armas.sim.ts` corre 60 partidas de bots por arma, en los 3 mapas, con una sola arma y munición infinita.

| Arma | Qué se probó | Resultado | Bots: aciertos · daño/acierto |
|---|---|---|---|
| Cañón | selección, disparo, trayectoria = balística, radio/cráter/daño de datos, munición infinita, cráter, turno | pasa | 49,9 % · 7,4 |
| Mortero | ídem + ángulo mínimo 60°, sin munición no se usa | pasa | 42,7 % · 16,7 |
| Bazuca | ídem | pasa | 54,3 % · 16,0 |
| Granada | ídem + estalla a los 3 s de mecha | pasa | 20,7 % · 11,5 |
| Mazo | selección, golpe, radio/cráter/daño, aturdimiento, munición, turno | pasa | **5,3 %** · 24,8 |
| Tesla | selección, rayo recto, daño, cadena con caída, munición, turno | pasa | **13,0 %** · 15,1 |
| Hielo | ídem proyectil + congela | pasa | 51,4 % · 6,4 |
| Poción | ídem proyectil + charco con radio y turnos de datos | pasa | 69,2 % · 14,2 |

En las 480 partidas hubo 0 partidas sin terminar, 0 turnos forzados y 0 NaN.

**Dudosos (no se cambió ninguna regla):**
- El Mazo y el Tesla aciertan poco porque el bot no se acerca a su alcance (120 y 420 px), no porque fallen. Es comportamiento del bot.
- La vista previa del Tesla mide 220 px aunque su alcance real es 420, y la del Mazo 90 px con alcance de 120.

## 4. Pantallas

- **Escala:** `Phaser.Scale.EXPAND` más `src/ui/stage.ts`. No hay franjas, el HUD queda en el área de diseño centrada y la física no cambia.
- **Combate:** en pantallas anchas usa zoom uniforme y recorta una franja del cielo y del suelo. En pantallas altas muestra más cielo.
- **Capturas:** las 6 pantallas en 8 resoluciones, en `docs/capturas/resoluciones/`. Las medidas están en `medidas.json`.

| Resolución | Lienzo | Botón más chico | Texto más chico |
|---|---|---|---|
| 844×390 | llena 100 % | 45 px | 14 px |
| 1024×768 | llena 100 % | 67 px | 20 px |
| 1366×768 | llena 100 % | 89 px | 27 px |
| 1920×1080 | llena 100 % | 125 px | 38 px |
| 2560×1440 | llena 100 % | 166 px | 51 px |
| 360×640, 390×844, 768×1024 (vertical) | aviso "Gira tu dispositivo" | 23–50 px si se jugara en vertical | 7–15 px |

## 5. Pasa el dispositivo

"al" y la etiqueta del jugador forman una sola fila medida y centrada. La E2E comprueba en las 8 resoluciones que no se traslapan.

## 6. Colección

- **Logros:** tarjetas con su insignia `ach-*`, nombre, descripción, estado y progreso "X de N".
- **Cosméticos:** muestran su arte de `atlas-items`. Los que no tienen arte muestran nombre y candado; la lista está en `docs/ASSETS_TODO.md`.
- **Desplazamiento:** la lista se desplaza y Volver queda fijo.
- **Insignias:** `atlas-badges` contiene estados del combate, no logros.

## 7. Caché PWA

- **Nombre:** `frankentilleria-v2-<build>`.
- **Estrategia:** primero la red y revalidación de los archivos sin hash.
- **Instalación:** guarda la página, el código, los estilos y las fuentes.
- **Activación:** vuelve a pedir a la red los atlas que tenía el build anterior.
- **E2E:** tras un nuevo build se carga la versión nueva, solo queda su caché y abre sin conexión sin que falte ningún archivo.

## Pendiente de comprobar en un dispositivo real

Ver el resumen de la entrega. Lo principal:
- el impacto en un iPhone físico;
- la app anclada a la pantalla de inicio;
- la muesca y la barra de inicio;
- la vibración en Android;
- la actualización de la PWA en un despliegue real de Vercel.
