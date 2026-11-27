import Phaser from 'phaser';
import { settings, onSettingsChange } from './settings';

/** Efectos de sonido sintetizados con WebAudio (sin archivos) y música en bucle con Phaser. */
export type Sfx =
  | 'click'
  | 'error'
  | 'shoot'
  | 'beam'
  | 'explosion'
  | 'hit'
  | 'pickup'
  | 'win'
  | 'tick'
  | 'ability'
  | 'splash'
  | 'freeze'
  | 'wind'
  | 'achievement';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Arranca el contexto de audio desde un gesto del usuario (iOS no deja sonar antes del primer toque). */
export function unlockAudio(): void {
  ac();
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol = 0.3, delay = 0): void {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, f0: number, f1: number): void {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(f0, t);
  filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filt).connect(g).connect(master);
  src.start(t);
}

export function sfx(name: Sfx): void {
  if (!settings.sfx) return;
  switch (name) {
    case 'achievement':
      tone('triangle', 523, 523, 0.14, 0.2);
      tone('triangle', 659, 659, 0.14, 0.2, 0.12);
      tone('triangle', 784, 784, 0.14, 0.2, 0.24);
      tone('triangle', 1047, 1047, 0.3, 0.22, 0.36);
      break;
    case 'wind':
      noise(0.55, 0.16, 2400, 500);
      tone('sine', 700, 420, 0.5, 0.05);
      break;
    case 'click':
      tone('square', 620, 520, 0.06, 0.12);
      break;
    case 'error':
      tone('sawtooth', 180, 120, 0.18, 0.18);
      break;
    case 'shoot':
      noise(0.18, 0.3, 3000, 300);
      tone('sawtooth', 300, 90, 0.18, 0.15);
      break;
    case 'beam':
      tone('sawtooth', 1400, 240, 0.28, 0.2);
      tone('square', 90, 60, 0.28, 0.1);
      break;
    case 'explosion':
      noise(0.6, 0.55, 2200, 80);
      tone('sine', 110, 35, 0.5, 0.4);
      break;
    case 'hit':
      tone('sine', 160, 50, 0.16, 0.4);
      break;
    case 'pickup':
      tone('triangle', 660, 660, 0.09, 0.2);
      tone('triangle', 990, 990, 0.12, 0.2, 0.09);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.22, i * 0.14));
      break;
    case 'tick':
      tone('square', 900, 900, 0.04, 0.08);
      break;
    case 'ability':
      tone('sine', 300, 900, 0.3, 0.25);
      break;
    case 'splash':
      noise(0.35, 0.25, 1200, 300);
      break;
    case 'freeze':
      [1800, 2400, 3000].forEach((f, i) => tone('sine', f, f * 0.8, 0.15, 0.1, i * 0.05));
      break;
  }
}

let music: Phaser.Sound.BaseSound | null = null;

/** Arranca o reanuda la música respetando el ajuste. Se puede llamar desde cualquier escena. */
export function startMusic(scene: Phaser.Scene): void {
  if (!scene.cache.audio.exists('music1')) return;
  if (!music) {
    music = scene.sound.add('music1', { loop: true, volume: 0.35 });
    onSettingsChange(() => {
      if (!music) return;
      if (settings.music && !music.isPlaying) music.play();
      if (!settings.music && music.isPlaying) music.pause();
    });
  }
  if (settings.music && !music.isPlaying) music.play();
}

export function duckMusic(volume: number): void {
  const m = music as (Phaser.Sound.BaseSound & { setVolume?: (v: number) => void }) | null;
  m?.setVolume?.(volume);
}
