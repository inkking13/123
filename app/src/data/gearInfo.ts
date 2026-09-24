import { GearOption, GearSlotKey } from './types';
import { GEAR_SETS } from './gearSets';

// Diablo-style rarity tiers, derived from where an item comes from rather
// than stored per item: shop tier by price, crafted pieces, boss trophies.
export type Rarity = 'common' | 'magic' | 'rare' | 'legendary' | 'unique';

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#c9c9cf',
  magic: '#7f9cf5',
  rare: '#e6d160',
  legendary: '#e88a3a',
  unique: '#c9a36b',
};

export const RARITY_NAME: Record<Rarity, string> = {
  common: 'Обычный',
  magic: 'Магический',
  rare: 'Редкий',
  legendary: 'Легендарный',
  unique: 'Уникальный',
};

export const SET_COLOR = '#6fcf7c';

export function rarityOf(o: GearOption): Rarity {
  if (/^u[wat]-/.test(o.id)) return 'unique';
  if (/^r[wat]-/.test(o.id)) return 'legendary';
  if ((o.price || 0) >= 150) return 'rare';
  if ((o.price || 0) >= 90) return 'magic';
  return 'common';
}

export function setNameOf(gearId: string): string | null {
  const s = GEAR_SETS.find((x) => x.weapon === gearId || x.armor === gearId || x.trinket === gearId);
  return s ? s.name : null;
}

export interface StatLine {
  text: string;
  good: boolean;
}

type StatKey = 'mult' | 'hpMult' | 'wardMult' | 'cdMult';
const STATS: { key: StatKey; label: string; lowerIsBetter: boolean }[] = [
  { key: 'mult', label: 'к урону/лечению', lowerIsBetter: false },
  { key: 'hpMult', label: 'к HP', lowerIsBetter: false },
  { key: 'wardMult', label: 'к получаемому урону', lowerIsBetter: true },
  { key: 'cdMult', label: 'к перезарядке', lowerIsBetter: true },
];

const pct = (v: number) => Math.round(v * 100);
const signed = (n: number) => (n > 0 ? `+${n}%` : `${n}%`);

export function statLines(o: GearOption): StatLine[] {
  return STATS.flatMap(({ key, label, lowerIsBetter }) => {
    const v = o[key];
    if (v == null || v === 1) return [];
    const d = pct(v - 1);
    return [{ text: `${signed(d)} ${label}`, good: lowerIsBetter ? d < 0 : d > 0 }];
  });
}

// Per-stat difference against the currently worn piece, in percentage
// points — the green/red arrows under a Diablo tooltip.
export function compareLines(o: GearOption, worn: GearOption): StatLine[] {
  return STATS.flatMap(({ key, label, lowerIsBetter }) => {
    const d = pct((o[key] ?? 1) - (worn[key] ?? 1));
    if (d === 0) return [];
    return [{ text: `${d > 0 ? '▲' : '▼'} ${signed(d)} ${label}`, good: lowerIsBetter ? d < 0 : d > 0 }];
  });
}

export const SLOT_SILHOUETTE: Record<GearSlotKey, 'sword' | 'shield' | 'crown-simple'> = {
  weapon: 'sword',
  armor: 'shield',
  trinket: 'crown-simple',
};
