/**
 * "Back" handling shared by every screen: Esc, the on-screen button, the browser back button and the
 * phone back gesture all end up in the handler on top of this stack.
 */
const stack: (() => void)[] = [];

/** Registers a handler; returns the function that removes it (call it on scene shutdown). */
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
 * Keeps the player inside the page: one extra history entry is pushed and re-pushed on every popstate,
 * so the browser/phone back button never leaves the game by accident.
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
      /* ignore */
    }
    triggerBack();
  });
}
