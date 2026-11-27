/** Cómo se ve y se siente el viento (partículas, manga, flechas, aviso), sin Phaser. */

/** Nunca hay más partículas de ambiente vivas que esto (todo el combate tiene un presupuesto de 150). */
export const MAX_WIND_PARTICLES = 60;
const MAX_WIND = 5;

/** Tipo de partícula de ambiente por mapa. */
export const WIND_KINDS: Record<string, readonly ['paper' | 'leaf' | 'fluff', 'dust' | 'fog' | 'confetti']> =
  {
    vertedero: ['paper', 'dust'],
    cementerio: ['leaf', 'fog'],
    fabrica: ['fluff', 'confetti'],
  };

export interface WindVisual {
  /** -1 izquierda, 0 nada, +1 derecha. */
  direction: -1 | 0 | 1;
  /** Radianes: 0 = hacia la derecha, π = hacia la izquierda. */
  angle: number;
  /** Partículas de ambiente vivas (máximo 60), proporcionales a la fuerza. */
  particles: number;
  /** px/s de las partículas de ambiente, con signo. */
  driftSpeed: number;
  /** Nivel de inflado de la manga, de 0 a 5. */
  sockLevel: number;
  /** Una flecha por nivel (nunca solo color). */
  arrows: number;
  /** Muestra el aviso de 1,2 s al empezar el turno. */
  notice: boolean;
  /** Rayas de ráfaga que cruzan la pantalla (viento fuerte). */
  streaks: boolean;
  /** px que se inclinan las capas lejanas (nubes) hacia el viento, con signo. */
  cloudShift: number;
}

export function windVisual(wind: number): WindVisual {
  const w = Number.isFinite(wind) ? Math.max(-MAX_WIND, Math.min(MAX_WIND, wind)) : 0;
  const level = Math.round(Math.abs(w));
  const direction = (w > 0 ? 1 : w < 0 ? -1 : 0) as -1 | 0 | 1;
  return {
    direction,
    angle: direction < 0 ? Math.PI : 0,
    particles: Math.round((Math.abs(w) / MAX_WIND) * MAX_WIND_PARTICLES),
    driftSpeed: w * 70,
    sockLevel: level,
    arrows: level,
    notice: level > 0,
    streaks: level >= 3,
    cloudShift: w * 8,
  };
}
