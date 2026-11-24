/** Constantes visuales de todas las escenas (números hex para Phaser, textos para las fuentes). */
export const W = 1600;
export const H = 900;
export const BTN = 104; // zona táctil en px lógicos (unos 45 px reales en un teléfono)
export const MIN_FONT = 32; // tamaño mínimo de texto en px lógicos
export const INK_W = 4; // contorno de tinta
export const RADIUS = 12;

export const C = {
  ink: 0x0f0e15,
  coal: 0x1b1a24,
  night: 0x2e2a47,
  storm: 0x5b3fa0,
  bone: 0xf4efe1,
  volt: 0xffe14d,
  alarm: 0xff5468,
  acid: 0x7cff4f,
  p1: 0x7fa0ff,
  p2: 0xff9a4d,
  disabled: 0x4a4466,
  steel: 0xa99be0,
} as const;

export const S = {
  ink: '#0F0E15',
  coal: '#1B1A24',
  night: '#2E2A47',
  storm: '#5B3FA0',
  bone: '#F4EFE1',
  volt: '#FFE14D',
  alarm: '#FF5468',
  alarmSoft: '#FF9AA6',
  acid: '#7CFF4F',
  p1: '#7FA0FF',
  p2: '#FF9A4D',
  disabled: '#4A4466',
} as const;

export const FONT_TITLE = 'Bungee, Impact, sans-serif';
export const FONT_BODY = 'Nunito, "Trebuchet MS", Arial, sans-serif';

/** Pares de texto y fondo que deben mantener un contraste de al menos 4.5:1 (lo comprueban las pruebas). */
export const CONTRAST_PAIRS: { name: string; fg: string; bg: string }[] = [
  { name: 'bone on night', fg: S.bone, bg: S.night },
  { name: 'bone on coal', fg: S.bone, bg: S.coal },
  { name: 'bone on storm (secondary buttons)', fg: S.bone, bg: S.storm },
  { name: 'ink on volt (primary buttons)', fg: S.ink, bg: S.volt },
  { name: 'ink on alarm (fire / urgent timer)', fg: S.ink, bg: S.alarm },
  { name: 'ink on acid', fg: S.ink, bg: S.acid },
  { name: 'ink on p1 badge', fg: S.ink, bg: S.p1 },
  { name: 'ink on p2 badge', fg: S.ink, bg: S.p2 },
  { name: 'volt on ink (toasts, wind)', fg: S.volt, bg: S.ink },
  { name: 'alarm-soft on ink (errors)', fg: S.alarmSoft, bg: S.ink },
  { name: 'acid on ink (ok messages)', fg: S.acid, bg: S.ink },
  { name: 'p1 on ink (nameplates)', fg: S.p1, bg: S.ink },
  { name: 'p2 on ink (nameplates)', fg: S.p2, bg: S.ink },
  { name: 'bone on disabled', fg: S.bone, bg: S.disabled },
  { name: 'ink on bone (tutorial card)', fg: S.ink, bg: S.bone },
  // Barras de vida: rellenos contra la pista Carbón y números sobre tinta
  { name: 'bar J1 fill on coal', fg: S.p1, bg: S.coal },
  { name: 'bar J2 fill on coal', fg: S.p2, bg: S.coal },
  { name: 'bar low-health (alarm) on coal', fg: S.alarm, bg: S.coal },
  { name: 'ghost bar (volt) on coal', fg: S.volt, bg: S.coal },
  { name: 'bone bar number on ink', fg: S.bone, bg: S.ink },
  // El relleno y el fantasma nunca se tocan: una raya de tinta de 3 px los separa
  { name: 'alarm fill vs ink divider', fg: S.alarm, bg: S.ink },
  { name: 'ghost volt vs ink divider', fg: S.volt, bg: S.ink },
  { name: 'bar J1 fill vs ink divider', fg: S.p1, bg: S.ink },
  { name: 'bar J2 fill vs ink divider', fg: S.p2, bg: S.ink },
];
