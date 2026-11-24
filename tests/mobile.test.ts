import { describe, expect, it } from 'vitest';
import { fitScale, installMode, needsScrollStrip, type InstallEnv } from '../src/ui/model/mobile';

const env = (o: Partial<InstallEnv> = {}): InstallEnv => ({
  standalone: false,
  fullscreenApi: false,
  iosSafari: false,
  promptAvailable: false,
  ...o,
});

describe('installMode: qué botón de instalar / pantalla completa se ofrece', () => {
  it('ya instalada (standalone/fullscreen): no se muestra nada', () => {
    expect(installMode(env({ standalone: true }))).toBe('hidden');
    expect(installMode(env({ standalone: true, fullscreenApi: true }))).toBe('hidden');
    expect(installMode(env({ standalone: true, iosSafari: true }))).toBe('hidden');
  });
  it('iPhone Safari sin la API: pasos para añadir a la pantalla de inicio', () => {
    expect(installMode(env({ iosSafari: true }))).toBe('ios-steps');
  });
  it('Android Chrome con beforeinstallprompt: ofrece instalar', () => {
    expect(installMode(env({ promptAvailable: true, fullscreenApi: true }))).toBe('prompt');
  });
  it('con la API de pantalla completa (Android, iPad, escritorio): pantalla completa', () => {
    expect(installMode(env({ fullscreenApi: true }))).toBe('fullscreen');
  });
  it('iPad con la API: pantalla completa aunque sea iOS', () => {
    expect(installMode(env({ fullscreenApi: true, iosSafari: true }))).toBe('fullscreen');
  });
  it('sin nada disponible: oculto', () => {
    expect(installMode(env())).toBe('hidden');
  });
});

describe('fitScale: escala FIT 1600×900 dentro del viewport visible', () => {
  it('relación 16:9 exacta llena todo', () => {
    expect(fitScale(1600, 900)).toEqual({ scale: 1, width: 1600, height: 900 });
  });
  it('pantalla más ancha: limita por la altura', () => {
    const r = fitScale(844, 390);
    expect(r.height).toBeCloseTo(390, 5);
    expect(r.width).toBeCloseTo((390 * 16) / 9, 5);
  });
  it('pantalla más alta: limita por el ancho', () => {
    const r = fitScale(700, 600);
    expect(r.width).toBeCloseTo(700, 5);
    expect(r.height).toBeCloseTo((700 * 9) / 16, 5);
  });
  it('descuenta las zonas seguras', () => {
    const r = fitScale(844, 390, { left: 47, right: 47, top: 0, bottom: 21 });
    expect(r.height).toBeLessThanOrEqual(390 - 21);
    expect(r.width).toBeLessThanOrEqual(844 - 94);
  });
  it('viewport degenerado no devuelve NaN', () => {
    const r = fitScale(0, 0);
    expect(Number.isFinite(r.scale)).toBe(true);
    expect(r.scale).toBeGreaterThan(0);
  });
});

describe('needsScrollStrip: franja de scroll para que Safari colapse la barra', () => {
  it('solo en Menú y Laboratorio, en móvil y en modo navegador', () => {
    expect(needsScrollStrip({ standalone: false, mobile: true, scene: 'Menu' })).toBe(true);
    expect(needsScrollStrip({ standalone: false, mobile: true, scene: 'Lab' })).toBe(true);
  });
  it('nunca en combate ni en otras escenas', () => {
    for (const s of ['Battle', 'Hud', 'Pause', 'Result', 'PassDevice', 'Settings', 'Tutorial'])
      expect(needsScrollStrip({ standalone: false, mobile: true, scene: s }), s).toBe(false);
  });
  it('nunca instalada ni en escritorio', () => {
    expect(needsScrollStrip({ standalone: true, mobile: true, scene: 'Menu' })).toBe(false);
    expect(needsScrollStrip({ standalone: false, mobile: false, scene: 'Menu' })).toBe(false);
  });
});
