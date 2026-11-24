import partsJson from '../data/parts.json';
import weaponsJson from '../data/weapons.json';
import cratesJson from '../data/crates.json';
import eventsJson from '../data/events.json';
import mapsJson from '../data/maps.json';
import type { MapDef, WorldDef } from './maps';

export type { MapDef, WorldDef };

export type Slot = 'head' | 'torso' | 'arms' | 'legs';
export const SLOTS: readonly Slot[] = ['head', 'torso', 'arms', 'legs'];

export interface PartDef {
  id: string;
  donor: string;
  slot: Slot;
  cost: number;
  effect: { hp?: number; mob?: number; res?: number; dmg?: number };
  weapon?: string;
  ability?: string;
}
export interface PartsData {
  budget: number;
  base: { hp: number; mobility: number; resistance: number; damage: number };
  boxes: Record<Slot, [number, number]>;
  donors: Record<string, { name: string; color: string }>;
  parts: PartDef[];
}
type WeaponKind = 'melee' | 'grenade' | 'projectile' | 'beam';
export interface WeaponDef {
  name: string;
  kind: WeaponKind;
  icon: string;
  damage: number;
  radius: number;
  crater: number;
  windFactor: number;
  range?: number;
  /** Cuerpo a cuerpo: medio ángulo (grados) del sector frente al atacante, centrado en la puntería. */
  arc?: number;
  knockback?: number;
  bounce?: number;
  fuse?: number;
  sprite?: string;
  freezeTurns?: number;
  /** Error de puntería en grados: base + perPower × potencia % + perMove × píxeles caminados en el turno. */
  spread?: { base: number; perPower: number; perMove: number };
  /** Munición al inicio de la partida; sin valor = infinita (el cañón base). */
  ammo?: number;
  /** Obliga a un arco alto: la elevación no baja de estos grados (mortero). */
  minAngle?: number;
  /** Atraviesa el terreno mientras sube, así la cobertura no lo frena (mortero). */
  arcOverCover?: boolean;
  /** Estado: quien recibe el golpe apunta peor en su(s) próximo(s) turno(s). */
  stunTurns?: number;
  /** Rayo: salta a otras criaturas cercanas a la golpeada. */
  chain?: { radius: number; jumps: number; falloff: number };
  /** Deja una zona que daña durante varios turnos (poción ácida). */
  puddle?: { radius: number; turns: number; damage: number };
}
export interface AbilityDef {
  name: string;
  desc: string;
  effect: 'shield' | 'leap' | 'moveTime' | 'damageBoost' | 'heal';
  value: number;
}
export interface CrateDef {
  name: string;
  sprite: string;
  effect: 'heal' | 'shield' | 'moveTime' | 'damageBoost' | 'ammo' | 'mystery' | 'mimic';
  value: number;
  weight: number;
}
export const PARTS = partsJson as unknown as PartsData;
export const WEAPONS = weaponsJson.weapons as unknown as Record<string, WeaponDef>;
export const ABILITIES = weaponsJson.abilities as unknown as Record<string, AbilityDef>;
export const CRATES = cratesJson as unknown as {
  everyTurns: number;
  /** Velocidad del paracaídas en px/s. */
  fallSpeed: number;
  /** Cuando una criatura va atrás por `gap` (fracción de la vida máxima), las cajas caen cerca de ella con probabilidad `pull`. */
  catchUp: { gap: number; pull: number; spread: number; favored: string[]; favoredBoost: number };
  mystery: { goodChance: number; heal: number; shield: number; boost: number; trapDamage: number };
  types: Record<string, CrateDef>;
};
export interface EventTypeDef {
  name: string;
  desc: string;
  weight: number;
  damage?: number;
  radius?: number;
  count?: number;
  crater?: number;
  scale?: number;
  bonus?: number;
}
export const EVENTS = eventsJson as unknown as {
  firstRound: number;
  everyRounds: number;
  types: Record<string, EventTypeDef>;
};
export const WORLD = (mapsJson as unknown as { world: WorldDef }).world;
export const MAPS = (mapsJson as unknown as { maps: MapDef[] }).maps;
export const DONOR_IDS = Object.keys(PARTS.donors);
