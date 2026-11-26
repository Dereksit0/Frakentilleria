import Phaser from 'phaser';

/**
 * On-screen error log for devices without a console (iPhone, installed app).
 * Active with ?debug=log, in development, or with a 2 s long press on the top-left corner. Errors are always collected
 * (cheap ring buffer) so the panel can show what already happened when it is opened.
 */
interface Entry {
  t: number;
  where: string;
  msg: string;
}
const MAX = 8;
const errors: Entry[] = [];
const startedAt = typeof performance !== 'undefined' ? performance.now() : 0;
let panel: HTMLDivElement | null = null;

declare const __BUILD_ID__: string;
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

function describe(err: unknown): string {
  if (err instanceof Error)
    return `${err.name}: ${err.message}${err.stack ? '\n' + err.stack.split('\n').slice(0, 3).join('\n') : ''}`;
  try {
    return typeof err === 'string' ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Records an error (decoration failures, stuck turns, loop errors) without ever throwing. */
export function logError(err: unknown, where = ''): void {
  try {
    errors.push({ t: (performance.now() - startedAt) / 1000, where, msg: describe(err) });
    if (errors.length > MAX) errors.shift();
    (window as unknown as { __errors?: Entry[] }).__errors = errors;
    console.warn(`[frankentilleria] ${where}`, err);
  } catch {
    /* logging must never break the game */
  }
}

export function recentErrors(): readonly Entry[] {
  return errors;
}

function turnState(game: Phaser.Game): string {
  const battle = game.scene.getScene('Battle') as unknown as {
    core?: {
      turn: { turnNumber: number };
      phase: string;
      clock: { phase: string };
      projectiles: unknown[];
      round: number;
    };
  } | null;
  const c = battle && game.scene.isActive('Battle') ? battle.core : undefined;
  if (!c) return 'sin combate';
  return `turno ${c.turn.turnNumber} · ronda ${c.round} · ${c.phase} · reloj ${c.clock.phase} · proyectiles ${c.projectiles.length}`;
}

export function installDebugLog(game: Phaser.Game): void {
  window.addEventListener('error', (e) => logError(e.error ?? e.message, 'window.onerror'));
  window.addEventListener('unhandledrejection', (e) => logError(e.reason, 'unhandledrejection'));
  const flag = new URLSearchParams(location.search).get('debug') === 'log' || import.meta.env.DEV;

  let sinceKey = '';
  let sinceAt = performance.now();
  const refresh = (): void => {
    if (!panel) return;
    const key = turnState(game);
    const stateKey = key.replace(/proyectiles \d+/, (m) => m);
    if (stateKey !== sinceKey) {
      sinceKey = stateKey;
      sinceAt = performance.now();
    }
    const stuck = ((performance.now() - sinceAt) / 1000).toFixed(1);
    const lines = [
      `FrankenTillería · build ${BUILD_ID} · ${Math.round(game.loop.actualFps)} fps`,
      `${key}`,
      `lleva ${stuck} s en este estado`,
      errors.length ? '— errores —' : 'sin errores',
      ...errors
        .slice()
        .reverse()
        .map((e) => `[${e.t.toFixed(1)}s ${e.where}] ${e.msg}`),
    ];
    const body = panel.querySelector('pre');
    if (body) body.textContent = lines.join('\n');
  };
  const show = (): void => {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'debuglog';
    panel.style.cssText =
      'position:fixed;left:0;right:0;top:0;max-height:55vh;overflow:auto;z-index:50;background:rgba(15,14,21,.94);color:#7CFF4F;font:12px/1.35 monospace;padding:6px 8px;white-space:pre-wrap;-webkit-user-select:text;user-select:text;touch-action:pan-y';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;margin-bottom:4px';
    const mk = (label: string, fn: () => void): void => {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText =
        'font:700 13px monospace;padding:4px 10px;border:2px solid #FFE14D;background:#2E2A47;color:#F4EFE1;border-radius:6px';
      b.onclick = fn;
      bar.appendChild(b);
    };
    mk(
      'Copiar',
      () =>
        void navigator.clipboard
          ?.writeText(panel?.querySelector('pre')?.textContent ?? '')
          .catch(() => undefined),
    );
    mk('Cerrar', () => {
      panel?.remove();
      panel = null;
    });
    panel.appendChild(bar);
    panel.appendChild(document.createElement('pre')).style.margin = '0';
    document.body.appendChild(panel);
    refresh();
  };
  if (flag) show();
  setInterval(refresh, 400);
  (window as unknown as { __showLog: () => void }).__showLog = show;

  // Installed app without URL parameters: hold a finger (or the mouse) 2 s on the top-left corner.
  let timer: number | undefined;
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.clientX > 90 || e.clientY > 90) return;
      timer = window.setTimeout(show, 2000);
    },
    { passive: true },
  );
  for (const t of ['pointerup', 'pointercancel', 'pointermove'] as const)
    window.addEventListener(
      t,
      (e) => {
        if (t === 'pointermove' && (e as PointerEvent).clientX < 90 && (e as PointerEvent).clientY < 90)
          return;
        window.clearTimeout(timer);
      },
      { passive: true },
    );
}

/**
 * An uncaught error inside a scene update/render stops Phaser's animation-frame loop for good (the next frame is only
 * scheduled after the callback returns), freezing the screen. The error itself reaches window.onerror and is logged; this
 * heartbeat notices the stopped loop and restarts it so the screen never stays frozen.
 */
export function installLoopHeartbeat(game: Phaser.Game): void {
  let last = performance.now();
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    last = performance.now();
  });
  setInterval(() => {
    if (document.hidden) {
      last = performance.now();
      return;
    }
    if (performance.now() - last > 2500) {
      logError(
        `el bucle de cuadros llevaba ${((performance.now() - last) / 1000).toFixed(1)} s parado: reiniciado`,
        'heartbeat',
      );
      last = performance.now();
      try {
        game.loop.stop();
        game.loop.start(game.step.bind(game));
      } catch (e) {
        logError(e, 'heartbeat.restart');
      }
    }
  }, 1000);
}
