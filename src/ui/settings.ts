export interface SettingsData {
  sfx: boolean;
  music: boolean;
  vibration: boolean;
  highContrast: boolean;
  bigText: boolean;
  reduceEffects: boolean;
}

const KEY = 'frankentilleria.settings.v1';
const DEFAULTS: SettingsData = {
  sfx: true,
  music: true,
  vibration: true,
  highContrast: false,
  bigText: false,
  reduceEffects: false,
};

function load(): SettingsData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SettingsData>) };
  } catch {
    /* storage unavailable: use defaults */
  }
  // Respect the OS-level reduced motion preference on first run.
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { ...DEFAULTS, reduceEffects: reduce };
}

export const settings: SettingsData = load();
const listeners = new Set<() => void>();

export function updateSetting<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
  settings[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function onSettingsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Font size helper: honours "Texto grande" but never goes below the 32 px minimum. */
export function fs(base: number): number {
  const v = settings.bigText ? Math.round(base * 1.15) : base;
  return Math.max(32, v);
}

export function vibrate(ms: number): void {
  // `'vibrate' in navigator` is true on some WebKit builds while the value is undefined: calling it threw on every hit.
  if (settings.vibration && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')
    navigator.vibrate(ms);
}
