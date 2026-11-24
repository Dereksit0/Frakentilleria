/**
 * "Atrás" compartido por todas las pantallas: Esc, el botón en pantalla, el botón del navegador y el gesto del
 * teléfono terminan en el manejador que esté arriba de esta pila.
 */
const stack: (() => void)[] = [];

/** Registra un manejador y devuelve la función que lo quita (llamarla al cerrar la escena). */
export function pushBackHandler(fn: () => void): () => void {
  stack.push(fn);
  return () => {
    const i = stack.lastIndexOf(fn);
    if (i >= 0) stack.splice(i, 1);
  };
}

function triggerBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}

/**
 * Mantiene al jugador dentro de la página: se agrega una entrada al historial y se vuelve a agregar en cada popstate,
 * así el botón atrás del navegador o del teléfono nunca saca del juego por accidente.
 */
export function installBackNavigation(): void {
  try {
    history.replaceState({ ft: 0 }, '');
    history.pushState({ ft: 1 }, '');
  } catch {
    return;
  }
  window.addEventListener('popstate', () => {
    try {
      history.pushState({ ft: 1 }, '');
    } catch {
      /* sin historial disponible: no pasa nada */
    }
    triggerBack();
  });
}
