import type { Page } from '@playwright/test';

type GameWindow = { __game: { scene: { isActive(k: string): boolean; getScene(k: string): unknown } } };

/** Logical game coordinates (1600x900) -> page coordinates, whatever the FIT scale is. */
export async function toPage(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const r = await page.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement;
    const b = c.getBoundingClientRect();
    return { l: b.left, t: b.top, w: b.width, h: b.height };
  });
  return { x: r.l + (x * r.w) / 1600, y: r.t + (y * r.h) / 900 };
}

export async function tap(page: Page, x: number, y: number, touch = false): Promise<void> {
  const p = await toPage(page, x, y);
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

export async function waitScene(page: Page, key: string, timeout = 60_000): Promise<void> {
  await page.waitForFunction((k) => (window as unknown as GameWindow).__game?.scene.isActive(k), key, {
    timeout,
  });
}

export async function skipSplash(page: Page): Promise<void> {
  await waitScene(page, 'Splash');
  await page.keyboard.press('Space');
  await waitScene(page, 'Menu');
  await page.waitForTimeout(500);
}

/** Reads a value from the running Battle scene's core (test-only introspection). */
export async function core<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate((f) => {
    const scene = (window as unknown as GameWindow).__game.scene.getScene('Battle') as { core: unknown };
    return new Function('core', `return (${f})(core)`)(scene.core);
  }, fn) as Promise<T>;
}

/** Runs arbitrary code against the Battle core (used to set up quick end-game situations). */
export async function mutateCore(page: Page, fn: string): Promise<void> {
  await page.evaluate((f) => {
    const scene = (window as unknown as GameWindow).__game.scene.getScene('Battle') as { core: unknown };
    new Function('core', `(${f})(core)`)(scene.core);
  }, fn);
}

/** Evaluates `fn(scene)` against any running scene (test-only introspection). */
export async function sceneValue<T>(page: Page, key: string, fn: string): Promise<T> {
  return page.evaluate(
    ([k, f]) => {
      const scene = (window as unknown as GameWindow).__game.scene.getScene(k);
      return new Function('scene', `return (${f})(scene)`)(scene);
    },
    [key, fn],
  ) as Promise<T>;
}

/** True when some visible Text in the scene contains the given string. */
export async function hasText(page: Page, key: string, text: string): Promise<boolean> {
  return sceneValue<boolean>(
    page,
    key,
    `(s) => { const walk = (list) => list.some((o) => (o.type === 'Text' && o.active && o.visible && String(o.text).includes(${JSON.stringify(text)})) || (o.type === 'Container' && o.visible && walk(o.list))); return walk(s.children.list); }`,
  );
}

/** Menu → Lab J1 → pass the device → Lab J2 → Battle, with the default creatures; `map` = index in maps.json. */
export async function openBattle(page: Page, touch: boolean, map?: number): Promise<void> {
  await page.goto('/');
  await skipSplash(page);
  if (map !== undefined) for (let i = 0; i <= map; i++) await tap(page, 288, 822, touch); // "Mapa: ..." button
  await tap(page, 800, 490, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'PassDevice');
  await tap(page, 1100, 730, touch);
  await waitScene(page, 'Lab');
  await tap(page, 1427, 842, touch);
  await waitScene(page, 'Battle');
  await page.waitForTimeout(1500);
}
