import tuningJson from '../data/tuning.json';

export interface Tuning {
  /** Puntería neutra con la que arranca cada turno (el ángulo se mide hacia el rival). */
  aim: { angle: number; power: number };
  /** Ráfagas: caminata al azar del viento durante el vuelo, un paso cada 1/60 s, acotada por gustMax (unidades de viento). */
  wind: { gustStep: number; gustMax: number };
  /** Parte del daño de la explosión que aún llega a quien está tras el terreno. */
  cover: { blast: number };
  knockback: { scale: number; minHorizontal: number };
  /** Segundos del arco que muestra la vista previa de la puntería. */
  preview: { seconds: number };
  acidKills: boolean;
  /** Multiplicador del error de puntería en un turno aturdido. */
  stunSpreadMult: number;
  /** Un proyectil no lastima a su dueño (golpe ni explosión) durante sus primeros segundos de vuelo. */
  spawnGrace: { seconds: number };
  /** TODO(balance): provisional; elegido con `npm run simulate` (docs/balance/BALANCE_RONDA3.md). */
  balance: { globalDamageMultiplier: number };
  /** Explosión del barril de TNT. */
  barrel: { damage: number; radius: number; crater: number; knockback: number };
}

export const TUNING = tuningJson as unknown as Tuning;

/** Interruptores por partida (las pruebas y el simulador los apagan para aislar una regla). */
export interface Rules {
  spread: boolean;
  /** Multiplica el error de puntería de todas las armas (barridos de balance). */
  spreadScale: number;
  /** Multiplica el daño de todas las armas (barridos de balance). */
  damageScale: number;
  gusts: boolean;
  acidKills: boolean;
  /** Eventos de ronda (tormenta, meteoritos...) activados o no. */
  events: boolean;
  /** Las cajas favorecen a la criatura que va atrás. */
  catchUp: boolean;
  knockbackScale: number;
  coverFactor: number;
}
export function defaultRules(): Rules {
  return {
    spread: true,
    spreadScale: 1,
    damageScale: TUNING.balance.globalDamageMultiplier,
    gusts: true,
    acidKills: TUNING.acidKills,
    events: true,
    catchUp: true,
    knockbackScale: TUNING.knockback.scale,
    coverFactor: TUNING.cover.blast,
  };
}
