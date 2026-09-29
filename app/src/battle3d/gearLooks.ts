import { GearSlotKey } from '../data/types';
import { SLOT_KIND, SLOT_ORDER, slotGear } from '../data/gear';
import { RARITY_COLOR, rarityOf } from '../data/gearInfo';
import { HeroLook, Weapon } from './heroLooks';
import type { HelmModelName } from './HelmModel';
import type { WornPiece } from './Wardrobe';
import { armourOf } from '../data/armourSets';


// What worn gear looks like on a low-poly hero: each item maps to a piece
// kind (a horned helm, a chain shirt, clawed gloves…) and carries its
// rarity colour for trims, gems and glows.

export type HelmKind = 'cap' | 'nasal' | 'horned' | 'infernal' | 'plague';
export type ChestKind = 'leather' | 'chain' | 'plate' | 'cloak' | 'bone' | 'scale';
export type HandKind = 'plate' | 'claw' | 'leather';
export type FeetKind = 'chain' | 'plate' | 'leather';

export interface GearPiece<K> { kind: K; rarity: string; rich: boolean }

export interface GearLook {
  weapon?: GearPiece<Weapon> & { glow?: string };
  helm?: GearPiece<HelmKind> & { model?: HelmModelName };
  chest?: GearPiece<ChestKind>;
  hands?: GearPiece<HandKind>;
  feet?: GearPiece<FeetKind>;
  /** Rarity colours of the amulet and ring, if worn. */
  amulet?: string;
  ring?: string;
  /** Colour of the rarest piece worn (the pedestal glows with it). */
  best?: string;
  /** Armour-set pieces worn, drawn on Meshy bodies that can wear them. */
  pieces?: WornPiece[];
}

const WEAPON: Record<string, Weapon> = {
  w1: 'sword', w2: 'sword', w3: 'sword', w4: 'staff', w5: 'scythe',
  'uw-wastes': 'greatAxe', 'uw-frostpass': 'axe', 'uw-charfields': 'scythe', 'uw-mortgagedfarms': 'flail',
  'uw-blackmarket': 'dagger', 'uw-unmarkedgraves': 'greatHammer', 'uw-burntcliffs': 'claws', 'uw-shareholderfloor': 'book',
  'rw-blacksmith1': 'sword', 'rw-blacksmith2': 'axe', 'rw-enchant1': 'sword', 'rw-enchant2': 'sword',
};
const WEAPON_GLOW: Record<string, string> = { 'rw-enchant1': '#8a6aff', 'rw-enchant2': '#ff7a2a', 'uw-charfields': '#ff9a4a' };
const HELM: Record<string, HelmKind> = { h1: 'cap', h2: 'nasal', h3: 'horned', h4: 'cap', 'uh-parishruins': 'infernal', 'uh-desertersfort': 'plague' };
/** Helmets drawn with a Meshy model instead of the built piece. */
const HELM_MODEL: Record<string, HelmModelName> = { h2: 'knight', h3: 'viking', h4: 'veil', 'uh-desertersfort': 'warden' };
const CHEST: Record<string, ChestKind> = {
  a1: 'leather', a2: 'chain', a3: 'plate', a4: 'plate', a5: 'plate',
  'ua-road': 'cloak', 'ua-wolfrifts': 'bone', 'ua-parishruins': 'plate', 'ua-debtorsjail': 'plate', 'ua-smugglercatacombs': 'cloak',
  'ua-desertersfort': 'plate', 'ua-wyvernlair': 'scale', 'ua-councilantechamber': 'plate',
  'ra-leather1': 'leather', 'ra-leather2': 'scale', 'ra-engineer1': 'plate', 'ra-engineer2': 'plate',
};
const HANDS: Record<string, HandKind> = { g1: 'plate', g2: 'claw', g3: 'leather', 'ug-road': 'leather', 'ug-wyvernlair': 'claw' };
const FEET: Record<string, FeetKind> = { b1: 'chain', b2: 'plate', b3: 'leather', 'ub-wolfrifts': 'plate', 'ub-smugglercatacombs': 'leather' };

const RANK = ['common', 'magic', 'rare', 'legendary', 'unique'] as const;

function piece<K>(slot: GearSlotKey, id: string, table: Record<string, K>, fallback: K): GearPiece<K> | undefined {
  if (!id || id === 'none') return undefined;
  const o = slotGear(slot).find((x) => x.id === id);
  if (!o) return undefined;
  const r = rarityOf(o);
  return { kind: table[id] ?? fallback, rarity: RARITY_COLOR[r], rich: RANK.indexOf(r) >= 2 };
}

export function gearLookOf(equipment: Partial<Record<GearSlotKey, string>> | undefined): GearLook {
  if (!equipment) return {};
  const g: GearLook = {};
  const w = piece('weapon', equipment.weapon ?? 'none', WEAPON, 'sword');
  if (w) g.weapon = { ...w, glow: WEAPON_GLOW[equipment.weapon!] };
  const h = piece('helm', equipment.helm ?? 'none', HELM, 'cap');
  if (h) g.helm = { ...h, model: HELM_MODEL[equipment.helm!] };
  g.chest = piece('chest', equipment.chest ?? 'none', CHEST, 'leather');
  g.hands = piece('gloves', equipment.gloves ?? 'none', HANDS, 'leather');
  g.feet = piece('boots', equipment.boots ?? 'none', FEET, 'leather');
  const t = piece('necklace', equipment.necklace ?? 'none', {} as Record<string, string>, 'amulet');
  const rg = piece('ring1', equipment.ring1 ?? equipment.ring2 ?? 'none', {} as Record<string, string>, 'ring');
  if (t) g.amulet = t.rarity;
  if (rg) g.ring = rg.rarity;
  let best = -1;
  for (const slot of Object.keys(equipment) as GearSlotKey[]) {
    const o = SLOT_KIND[slot] ? slotGear(slot).find((x) => x.id === equipment[slot]) : undefined;
    if (!o || o.id === 'none') continue;
    const i = RANK.indexOf(rarityOf(o));
    if (i > best) { best = i; g.best = RARITY_COLOR[rarityOf(o)]; }
  }
  const pieces: WornPiece[] = [];
  for (const slot of SLOT_ORDER) { const a = armourOf(equipment[slot]); if (a) pieces.push({ set: a.set.id, piece: a.piece, closedHelm: a.set.closedHelm }); }
  if (pieces.length) g.pieces = pieces;
  return g;
}

const MELEE = new Set<Weapon>(['sword', 'axe', 'mace', 'greatAxe', 'greatHammer', 'dagger', 'scythe', 'flail', 'claws', 'trident']);
const CASTER = new Set<Weapon>(['staff', 'orb', 'book']);
export const TWO_HANDED = new Set<Weapon>(['greatAxe', 'greatHammer', 'scythe']);

/**
 * The hero's look with the worn weapon in hand. A fighter takes up any melee
 * weapon and a staff- or orb-caster any focus; archers and alchemists keep
 * their bows and flasks whatever sits in the slot.
 */
export function withGear(look: HeroLook, gear: GearLook | undefined): HeroLook {
  const w = gear?.weapon;
  if (!w) return look;
  let weapon = look.weapon;
  if (MELEE.has(look.weapon) && MELEE.has(w.kind)) weapon = w.kind;
  else if (CASTER.has(look.weapon) && CASTER.has(w.kind)) weapon = w.kind;
  if (weapon === look.weapon && !w.glow) return look;
  const twoH = TWO_HANDED.has(weapon);
  const offHand = twoH || (weapon !== 'dagger' && look.offHand === 'dagger') ? 'none' : look.offHand;
  return { ...look, weapon, offHand, glow: w.glow ?? look.glow };
}
