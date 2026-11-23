import { expect, test, type Page } from '@playwright/test';
import { hasText, sceneValue, skipSplash, tap, waitScene } from './helpers';

// Logical coordinates of the controls (1600x900 world)
const BACK = [148, 58] as const; // Lab "‹ Atrás"
const CANCEL = [178, 58] as const; // PassDevice "‹ Cancelar"
const STAY = [610, 542] as const; // modal "Quedarme"
const LEAVE = [990, 542] as const; // modal "Salir"
const DONOR_ROW_2 = [1211, 496] as const; // Maniquí
const TAB_TORSO = [1124, 168] as const;
const LISTO = [1427, 842] as const;
const SOY_J2 = [1190, 732] as const;

const sel = (page: Page) => sceneValue<Record<string, string>>(page, 'Lab', '(s) => ({ ...s.sel })');

test.describe('botón Atrás y navegación', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await skipSplash(page);
  });

  test('sin cambios sale directo al menú; con cambios pide confirmación y respeta Quedarme / Salir', async ({ page }, info) => {
    const touch = info.project.name === 'movil';
    await tap(page, 800, 490, touch); // Jugar
    await waitScene(page, 'Lab');
    await page.waitForTimeout(500);
    await tap(page, ...BACK, touch);
    await waitScene(page, 'Menu');

    await tap(page, 800, 490, touch);
    await waitScene(page, 'Lab');
    await page.waitForTimeout(500);
    const original = await sel(page);
    await tap(page, ...DONOR_ROW_2, touch); // change the head -> dirty
    expect((await sel(page)).head).toBe('maniqui');
    await tap(page, ...BACK, touch);
    await page.waitForTimeout(300);
    expect(await hasText(page, 'Lab', '¿Salir?')).toBe(true);
    await page.screenshot({ path: `shots/${info.project.name}-atras-modal.png` });

    await tap(page, ...STAY, touch); // Quedarme: nothing is lost
    await page.waitForTimeout(300);
    expect(await hasText(page, 'Lab', '¿Salir?')).toBe(false);
    expect((await sel(page)).head).toBe('maniqui');

    await tap(page, ...BACK, touch);
    await page.waitForTimeout(300);
    await tap(page, ...LEAVE, touch); // Salir: changes are discarded
    await waitScene(page, 'Menu');
    await tap(page, 800, 490, touch);
    await waitScene(page, 'Lab');
    await page.waitForTimeout(500);
    expect(await sel(page)).toEqual(original);
  });

  test('Esc y el botón atrás del navegador hacen lo mismo y no sacan al jugador de la página', async ({ page }, info) => {
    const touch = info.project.name === 'movil';
    const url = page.url();
    await tap(page, 800, 490, touch);
    await waitScene(page, 'Lab');
    await page.waitForTimeout(500);
    if (!touch) {
      await page.keyboard.press('Escape');
      await waitScene(page, 'Menu');
      await tap(page, 800, 490, touch);
      await waitScene(page, 'Lab');
      await page.waitForTimeout(500);
    }
    await page.goBack().catch(() => undefined);
    await waitScene(page, 'Menu');
    expect(page.url()).toBe(url);
  });

  test('J2 vuelve a J1 conservando la criatura de J1 y el borrador de J2; Pasa el dispositivo solo cancela al menú', async ({ page }, info) => {
    const touch = info.project.name === 'movil';
    await tap(page, 800, 490, touch);
    await waitScene(page, 'Lab');
    await page.waitForTimeout(500);
    await tap(page, ...DONOR_ROW_2, touch); // J1 head = maniqui
    const j1 = await sel(page);
    await tap(page, ...LISTO, touch);
    await waitScene(page, 'PassDevice');
    await page.waitForTimeout(500);

    // Pass screen: cancel needs confirmation and "Quedarme" keeps us here
    await tap(page, ...CANCEL, touch);
    await page.waitForTimeout(300);
    expect(await hasText(page, 'PassDevice', '¿Cancelar la partida?')).toBe(true);
    await page.screenshot({ path: `shots/${info.project.name}-pasa-cancelar.png` });
    await tap(page, ...STAY, touch);
    await page.waitForTimeout(300);
    expect(await hasText(page, 'PassDevice', '¿Cancelar la partida?')).toBe(false);

    await tap(page, ...SOY_J2, touch);
    await waitScene(page, 'Lab');
    await page.waitForTimeout(500);
    await tap(page, ...TAB_TORSO, touch);
    await tap(page, ...DONOR_ROW_2, touch); // J2 torso = maniqui (draft)
    const j2 = await sel(page);
    expect(j2.torso).toBe('maniqui');

    await tap(page, ...BACK, touch); // J2 -> J1 without a modal
    await expect.poll(() => sceneValue<number>(page, 'Lab', '(s) => s.player')).toBe(1);
    await page.waitForTimeout(500);
    expect(await sel(page)).toEqual(j1);

    await tap(page, ...LISTO, touch); // J1 confirms again -> pass -> J2 sees the preserved draft
    await waitScene(page, 'PassDevice');
    await page.waitForTimeout(500);
    await tap(page, ...SOY_J2, touch);
    await waitScene(page, 'Lab');
    await expect.poll(() => sceneValue<number>(page, 'Lab', '(s) => s.player')).toBe(2);
    await page.waitForTimeout(600);
    expect(await sel(page)).toEqual(j2);
  });
});
