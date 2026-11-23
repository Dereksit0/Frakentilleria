import partsJson from '../data/parts.json';
import weaponsJson from '../data/weapons.json';
import cratesJson from '../data/crates.json';
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
export type WeaponKind = 'melee' | 'grenade' | 'projectile' | 'beam';
export interface WeaponDef {
  name: string;
  kind: WeaponKind;
  icon: string;
  damage: number;
  radius: number;
  crater: number;
  windFactor: number;
  range?: number;
  knockback?: number;
  bounce?: number;
  fuse?: number;
  sprite?: string;
  freezeTurns?: number;
  /** Random aim error in degrees: base + perPower × power% + perMove × px walked this turn. */
  spread?: { base: number; perPower: number; perMove: number };
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
  effect: 'heal' | 'shield' | 'moveTime' | 'damageBoost';
  value: number;
  weight: number;
}
export const PARTS = partsJson as unknown as PartsData;
export const WEAPONS = weaponsJson.weapons as unknown as Record<string, WeaponDef>;
export const ABILITIES = weaponsJson.abilities as unknown as Record<string, AbilityDef>;
export const CRATES = cratesJson as unknown as { everyTurns: number; types: Record<string, CrateDef> };
export const WORLD = (mapsJson as unknown as { world: WorldDef }).world;
export const MAPS = (mapsJson as unknown as { maps: MapDef[] }).maps;
export const DONOR_IDS = Object.keys(PARTS.donors);
