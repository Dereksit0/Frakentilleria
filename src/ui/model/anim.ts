import rigData from '../../data/rig.json';
import tauntData from '../../data/taunts.json';

const BACK = rigData.backArm;

/**
 * Modelo de animación de una criatura sin Phaser ni tweens: una máquina de estados con prioridades y poses procedurales,
 * sin reservar memoria en cada cuadro. La vista (src/ui/creatureView.ts) solo copia una Pose a las piezas armadas.
 */
export const ANIM_STATES = [
  'idle',
  'walk',
  'aim',
  'fire',
  'hurt',
  'taunt',
  'victory',
  'defeat',
  'ability',
  'lowHp',
] as const;
export type AnimState = (typeof ANIM_STATES)[number];

/** Gana la prioridad más alta. Un estado con tiempo en curso solo lo reemplaza otro de igual o mayor prioridad. */
const ANIM_PRIORITY: Record<AnimState, number> = {
  defeat: 100,
  victory: 90,
  hurt: 70,
  fire: 60,
  ability: 50,
  taunt: 40,
  aim: 20,
  walk: 15,
  lowHp: 10,
  idle: 0,
};

/** ms. 0 = en bucle hasta que otro lo reemplace; victory nunca termina; defeat termina su pose y se queda. */
export const ANIM_DURATION: Record<AnimState, number> = {
  idle: 0,
  walk: 0,
  aim: 0,
  lowHp: 0,
  fire: 450,
  hurt: 650,
  taunt: 1000,
  ability: 700,
  victory: 0,
  defeat: 1800,
};

const AMBIENT: readonly AnimState[] = ['idle', 'walk', 'aim', 'lowHp'];
const isAmbient = (s: AnimState): boolean => AMBIENT.includes(s);
const isTerminal = (s: AnimState): boolean => s === 'victory' || s === 'defeat';

const LOW_HP_RATIO = 0.25;

export interface AmbientInput {
  moving: boolean;
  aiming: boolean;
  /** vida / vida máxima */
  hpRatio: number;
  alive: boolean;
}

/** Estado en bucle que corresponde a lo que hace la criatura cuando no suena nada especial. */
export function ambientState(i: AmbientInput): AnimState {
  if (!i.alive) return 'idle';
  if (i.moving) return 'walk';
  if (i.aiming) return 'aim';
  if (i.hpRatio <= LOW_HP_RATIO) return 'lowHp';
  return 'idle';
}

export class AnimMachine {
  state: AnimState = 'idle';
  /** ms en el estado actual. */
  time = 0;

  /** Empieza `next` si la prioridad lo permite (con la misma prioridad lo reinicia). Devuelve si empezó. */
  request(next: AnimState): boolean {
    if (this.state === 'defeat') return false;
    if (!isAmbient(this.state) && ANIM_PRIORITY[next] < ANIM_PRIORITY[this.state]) return false;
    this.state = next;
    this.time = 0;
    return true;
  }

  update(dtMs: number, amb: AmbientInput): void {
    this.time += dtMs;
    if (isTerminal(this.state)) return;
    if (!isAmbient(this.state)) {
      if (this.time >= ANIM_DURATION[this.state]) {
        this.state = ambientState(amb);
        this.time = 0;
      }
      return;
    }
    const next = ambientState(amb);
    if (next !== this.state) {
      this.state = next;
      this.time = 0;
    }
  }
}

export interface Pose {
  bodyDx: number;
  bodyDy: number;
  squashX: number;
  squashY: number;
  /** Arco del torso, la cabeza y el brazo alrededor de la cadera, rad (negativo = hacia atrás). */
  upperRot: number;
  torsoScaleY: number;
  headDx: number;
  headDy: number;
  headRot: number;
  headScaleX: number;
  /** Rotación extra del brazo sobre la puntería, rad (negativo = sube el brazo). */
  armRot: number;
  armDx: number;
  armDy: number;
  legLRot: number;
  legRRot: number;
  /** Brazo trasero: 0 = cuelga en reposo, 1 = sigue la puntería del delantero. */
  backMode: number;
  /** Brazo trasero: rotación extra de la imagen (rad), negativa lo sube. */
  backRot: number;
  backDx: number;
  backDy: number;
  /** Destello blanco de 0 a 1. */
  flash: number;
  /** Luz azul de 0 a 1 (burla del Refrigerador, habilidad). */
  glow: number;
  /** Cuenta los pasos de baile; la vista pita cuando cambia. */
  beat: number;
}

export function newPose(): Pose {
  return {
    bodyDx: 0,
    bodyDy: 0,
    squashX: 1,
    squashY: 1,
    upperRot: 0,
    torsoScaleY: 1,
    headDx: 0,
    headDy: 0,
    headRot: 0,
    headScaleX: 1,
    armRot: 0,
    armDx: 0,
    armDy: 0,
    legLRot: 0,
    legRRot: 0,
    backMode: 0,
    backRot: 0,
    backDx: 0,
    backDy: 0,
    flash: 0,
    glow: 0,
    beat: 0,
  };
}

const TAU = Math.PI * 2;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface TauntDef {
  name: string;
  variant: 'salute' | 'laugh' | 'pose' | 'dance' | 'door';
}
export const TAUNTS = tauntData.heads as Record<string, TauntDef>;

/**
 * Escribe en `out` la pose de `state` a los `t` ms (y la devuelve). `donor` = la cabeza donante (elige la variante de burla).
 * Con `reduced` ("Reducir efectos") no hay sacudidas, destellos ni temblores rápidos: solo cambios suaves de pose.
 */
export function poseAt(out: Pose, state: AnimState, t: number, donor: string, reduced: boolean): Pose {
  out.bodyDx = out.bodyDy = out.upperRot = out.headDx = out.headDy = out.headRot = 0;
  out.armRot = out.armDx = out.armDy = out.legLRot = out.legRRot = out.flash = out.glow = out.beat = 0;
  out.backMode = out.backRot = out.backDx = out.backDy = 0;
  out.squashX = out.squashY = out.torsoScaleY = out.headScaleX = 1;
  const D = ANIM_DURATION[state];
  const u = D > 0 ? clamp01(t / D) : 0;
  const e = Math.sin(Math.PI * u); // envolvente 0 → 1 → 0 para los estados con tiempo
  switch (state) {
    case 'idle': {
      const s = Math.sin((t / 2600) * TAU);
      out.bodyDy = -1.5 * s;
      out.torsoScaleY = 1 + 0.012 * s;
      out.armRot = 0.02 * Math.sin((t / 3100) * TAU);
      out.headRot = 0.02 * Math.sin((t / 3700) * TAU + 1);
      out.headDy = -0.8 * s;
      out.backRot = 0.03 * Math.sin((t / 2900) * TAU + 2);
      break;
    }
    case 'aim': {
      const s = Math.sin((t / 2200) * TAU);
      out.bodyDy = -1.2 * s;
      out.torsoScaleY = 1 + 0.01 * s;
      out.upperRot = 0.03;
      out.armRot = 0.012 * Math.sin((t / 1700) * TAU);
      out.headRot = 0.02 * s;
      out.backMode = 1;
      out.backRot = out.armRot * 0.8;
      break;
    }
    case 'walk': {
      const ph = (t / 420) * TAU;
      out.bodyDy = -3 * Math.abs(Math.sin(ph));
      out.legLRot = 0.5 * Math.sin(ph);
      out.legRRot = -0.5 * Math.sin(ph);
      out.upperRot = 0.04;
      out.headRot = 0.04 * Math.sin(ph * 2);
      out.armRot = 0.05 * Math.sin(ph);
      out.backRot = -BACK.walkSwing * Math.sin(ph); // al revés que el brazo delantero
      break;
    }
    case 'lowHp': {
      const s = Math.sin((t / 900) * TAU);
      out.squashY = 0.96;
      out.squashX = 1.02;
      out.bodyDy = -2 * s;
      out.torsoScaleY = 1 + 0.03 * s;
      out.headRot = 0.1 + 0.03 * s;
      out.upperRot = 0.06;
      out.backRot = 0.08;
      break;
    }
    case 'fire': {
      const k = (1 - u) * (1 - u) * Math.min(1, t / 30);
      const kick = reduced ? 0.12 : 1;
      out.bodyDx = -14 * (1 - u) * (1 - u) * (1 - u) * Math.min(1, t / 30) * kick;
      out.squashY = 1 + 0.07 * k;
      out.squashX = 1 - 0.07 * k;
      out.upperRot = -0.1 * k;
      out.armRot = -0.25 * k;
      out.backMode = 1;
      out.backRot = -0.12 * k;
      break;
    }
    case 'hurt': {
      const quick = (1 - u) * (1 - u);
      out.upperRot = -0.32 * e * (reduced ? 0.5 : 1);
      out.squashY = 1 - 0.06 * e;
      out.squashX = 1 + 0.04 * e;
      if (!reduced) {
        out.flash = t < 110 ? 1 : Math.max(0, 1 - (t - 110) / 110);
        out.bodyDx = 7 * quick * Math.sin(t / 16);
        out.headRot = 0.3 * (1 - u) * Math.sin(t / 55);
      } else {
        out.headRot = -0.2 * e;
      }
      out.headDy = 4 * e;
      out.armRot = 0.2 * e;
      out.backRot = reduced ? -0.3 * e : -0.3 * e + BACK.hurtShake * (1 - u) * Math.sin(t / 45);
      break;
    }
    case 'ability': {
      const s1 = Math.sin(Math.PI * clamp01(u / 0.4));
      const s2 = Math.sin(Math.PI * clamp01((u - 0.4) / 0.6));
      out.squashY = 1 - 0.2 * s1 + 0.15 * s2;
      out.squashX = 1 + 0.2 * s1 - 0.1 * s2;
      out.bodyDy = -30 * s2 * (reduced ? 0.5 : 1);
      out.glow = s2;
      out.armRot = -0.6 * s2;
      out.backRot = -1.2 * s2;
      break;
    }
    case 'victory': {
      const hop = Math.abs(Math.sin((Math.PI * t) / 700));
      out.bodyDy = -45 * hop;
      out.squashY = 1 + 0.06 * hop;
      out.squashX = 1 - 0.04 * hop;
      out.armRot = -1.3 * clamp01(t / 200);
      out.headRot = -0.1 * Math.sin((t / 700) * TAU);
      out.legLRot = 0.25 * hop;
      out.legRRot = -0.25 * hop;
      out.backRot = -3.2 * clamp01(t / 200); // los dos brazos arriba
      break;
    }
    case 'defeat': {
      const k = 1 - (1 - u) * (1 - u); // frena al final
      const lift = Math.sin(Math.PI * clamp01(u * 1.7));
      out.bodyDx = -20 * k;
      out.upperRot = -0.6 * k;
      out.squashY = 1 - 0.1 * k;
      out.torsoScaleY = 1 - 0.25 * k;
      out.headDx = -70 * k;
      out.headDy = 240 * k - 80 * lift;
      out.headRot = -4 * Math.PI * k;
      out.armDx = 120 * k;
      out.armDy = 200 * k - 170 * lift;
      out.armRot = 5 * k;
      out.legLRot = 0.4 * k;
      out.legRRot = -0.5 * k;
      out.backRot = 1.6 * k;
      out.backDx = -30 * k;
      out.backDy = 60 * k;
      break;
    }
    case 'taunt': {
      const f = reduced ? 0.4 : 1;
      switch (TAUNTS[donor]?.variant) {
        case 'salute':
          out.armRot = -1.9 * e;
          out.backRot = 0.5 * e; // la otra mano en la cadera
          out.headRot = 0.1 * e;
          out.upperRot = 0.05 * e;
          break;
        case 'laugh': {
          const jitter = reduced ? Math.sin(t / 160) : Math.sin(t / 45);
          out.torsoScaleY = 1 + 0.05 * jitter * e * f;
          out.bodyDy = -3 * Math.abs(jitter) * e * f;
          out.upperRot = -0.12 * e;
          out.backRot = -0.6 * e * (1 + 0.3 * jitter * f);
          out.headRot = -0.3 * e + 0.5 * Math.sin(Math.PI * clamp01((u - 0.55) / 0.4));
          break;
        }
        case 'pose':
          out.upperRot = -0.18 * e;
          out.bodyDx = 4 * e * f;
          out.legLRot = 0.15 * e;
          out.legRRot = -0.1 * e;
          out.armRot = -1.0 * e;
          out.backRot = 0.7 * e; // mano en la cadera
          out.headRot = 0.2 * e;
          break;
        case 'dance': {
          out.beat = Math.floor(Math.min(t, D) / 125);
          const step = reduced ? Math.sin((t / 250) * Math.PI) : out.beat % 2 ? 1 : -1;
          out.armRot = 0.6 * step * e;
          out.bodyDy = reduced ? 0 : -4 * (out.beat % 2) * e;
          out.legLRot = 0.4 * step * e;
          out.legRRot = -0.4 * step * e;
          out.headRot = 0.25 * step * e;
          out.backRot = -0.6 * step * e;
          break;
        }
        case 'door':
          out.glow = e;
          out.headScaleX = 1 - 0.55 * e;
          out.upperRot = 0.05 * e;
          out.armRot = -0.4 * e;
          out.backRot = -0.5 * e;
          break;
        default:
          out.armRot = -1.0 * e;
      }
      break;
    }
  }
  if (reduced) out.flash = 0;
  return out;
}

export type AnimFx =
  | 'stars'
  | 'sweat'
  | 'dust'
  | 'confetti'
  | 'smoke'
  | 'bolts'
  | 'sparkle'
  | 'say-hurt'
  | 'say-taunt'
  | 'sfx-win'
  | 'sfx-ability'
  | 'sfx-hurt';
const NONE: readonly AnimFx[] = [];
const FX_ENTER: Partial<Record<AnimState, readonly AnimFx[]>> = {
  hurt: ['stars', 'say-hurt', 'sfx-hurt'],
  taunt: ['say-taunt', 'sparkle'],
  victory: ['confetti', 'sfx-win'],
  defeat: ['smoke', 'bolts'],
  ability: ['sparkle', 'sfx-ability'],
};
/** Efectos de una vez al empezar un estado (arreglos fijos: no se reserva memoria). */
export const fxOnEnter = (state: AnimState, donor: string): readonly AnimFx[] =>
  donor ? (FX_ENTER[state] ?? NONE) : NONE;

/** Efecto repetido: devuelve su tipo si entre tPrev y tNow se cruzó un límite del intervalo. */
export function periodicFx(state: AnimState, tPrev: number, tNow: number): AnimFx | null {
  const every = state === 'walk' ? 210 : state === 'lowHp' ? 1200 : 0;
  if (!every || Math.floor(tNow / every) <= Math.floor(tPrev / every)) return null;
  return state === 'walk' ? 'dust' : 'sweat';
}

const LINES = tauntData.lines as Record<'hurt' | 'taunt', string[]>;
/** Texto corto del globo; `n` recorre la lista siempre en el mismo orden. */
export function pickLine(kind: 'hurt' | 'taunt', n: number): string {
  const list = LINES[kind];
  return list[((n % list.length) + list.length) % list.length];
}
