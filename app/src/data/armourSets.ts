import { GearKind, GearOption } from './types';
import { ItemIconId } from './itemIcons';

// The owner's four Meshy outfits. Each was cut offline into eight meshes
// (hood, shoulders, cloak, jacket, belt, gloves, pants, boots); they are worn
// as four items, so the rough cuts between meshes that always go together stay
// hidden: the helm or hood, the torso (jacket with shoulders, cloak and belt),
// the gloves, and the legs (pants with boots). The torso and legs items keep
// the jacket and pants ids so saves still find them. On a hero an item's meshes
// are drawn skinned to their race body (see battle3d/Wardrobe). The guild starts
// with one of each.

export type ArmourSetId = 'leather' | 'knight' | 'arcane' | 'templar';
/** One of the eight meshes a set was cut into. */
export type ArmourPiece = 'hood' | 'shoulders' | 'cloak' | 'jacket' | 'belt' | 'gloves' | 'pants' | 'boots';
/** A wearable item of a set: the helm, torso, gloves or legs. */
export type ArmourItem = 'hood' | 'jacket' | 'gloves' | 'pants';

export const ARMOUR_ITEMS: ArmourItem[] = ['hood', 'jacket', 'gloves', 'pants'];

/** The meshes each item puts on. */
export const ITEM_PIECES: Record<ArmourItem, ArmourPiece[]> = {
  hood: ['hood'], jacket: ['jacket', 'shoulders', 'cloak', 'belt'], gloves: ['gloves'], pants: ['pants', 'boots'],
};

/** The slot kind each item goes in. */
export const ITEM_KIND: Record<ArmourItem, GearKind> = { hood: 'helm', jacket: 'chest', gloves: 'gloves', pants: 'pants' };

type PieceStats = Pick<GearOption, 'mult' | 'hpMult' | 'wardMult' | 'cdMult'>;
interface ArmourSetDef {
  id: ArmourSetId;
  /** A closed helm hides the whole head; a hood leaves the face showing. */
  closedHelm: boolean;
  names: Record<ArmourItem, string>;
  /** What the set is good at, spread over its items. */
  stats: Record<ArmourItem, PieceStats>;
}

const hp = (h: number): PieceStats => ({ hpMult: h });
export const ARMOUR_SETS: ArmourSetDef[] = [
  {
    id: 'leather', closedHelm: false,
    names: { hood: 'Кожаный капюшон', jacket: 'Кожаная куртка с плащом', gloves: 'Кожаные перчатки', pants: 'Кожаные штаны и сапоги' },
    // Light and quick: damage and a shorter cooldown.
    stats: { hood: { mult: 1.03 }, jacket: { mult: 1.08, hpMult: 1.03, cdMult: 0.96 }, gloves: { mult: 1.04 }, pants: { mult: 1.02, cdMult: 0.97 } },
  },
  {
    id: 'knight', closedHelm: true,
    names: { hood: 'Рыцарский шлем', jacket: 'Рыцарские латы', gloves: 'Рыцарские латные перчатки', pants: 'Рыцарские поножи и сабатоны' },
    // Heavy plate: health and less damage taken.
    stats: { hood: hp(1.05), jacket: { hpMult: 1.15, wardMult: 0.95 }, gloves: hp(1.03), pants: { hpMult: 1.08, wardMult: 0.99 } },
  },
  {
    id: 'arcane', closedHelm: false,
    names: { hood: 'Капюшон чародея', jacket: 'Одеяние чародея', gloves: 'Перчатки чародея', pants: 'Штаны и сапоги чародея' },
    // For casters: power and cooldowns.
    stats: { hood: { mult: 1.03, cdMult: 0.98 }, jacket: { mult: 1.07, cdMult: 0.93 }, gloves: { mult: 1.03 }, pants: { hpMult: 1.03, cdMult: 0.98 } },
  },
  {
    id: 'templar', closedHelm: true,
    names: { hood: 'Шлем тамплиера', jacket: 'Доспех тамплиера', gloves: 'Латные перчатки тамплиера', pants: 'Поножи и сабатоны тамплиера' },
    // Holy warrior: some of both.
    stats: { hood: { hpMult: 1.04, mult: 1.01 }, jacket: { hpMult: 1.11, mult: 1.04, wardMult: 0.98 }, gloves: { mult: 1.03 }, pants: hp(1.07) },
  },
];

export const armourId = (set: ArmourSetId, item: ArmourItem) => `set-${set}-${item}`;
/** The set and item behind an item id, or null for any other item (including the four retired pieces). */
export function armourOf(gearId: string | undefined): { set: ArmourSetDef; item: ArmourItem } | null {
  const m = /^set-([a-z]+)-([a-z]+)$/.exec(gearId ?? '');
  const set = m && ARMOUR_SETS.find((s) => s.id === m[1]);
  return set && (ARMOUR_ITEMS as string[]).includes(m![2]) ? { set, item: m![2] as ArmourItem } : null;
}
/** Ids of the pieces that were items of their own before the sets were regrouped. */
export const RETIRED_ARMOUR_IDS: string[] = ARMOUR_SETS.flatMap((s) => ['shoulders', 'cloak', 'belt', 'boots'].map((p) => `set-${s.id}-${p}`));

// Icons rendered from each item's meshes.
export type ArmourIconId = `a-${ArmourSetId}-${ArmourItem}`;
export type GearIconId = ItemIconId | ArmourIconId;
export const ARMOUR_ICONS: Record<ArmourIconId, any> = {
  'a-leather-hood': require('../../assets/items/armour/a-leather-hood.jpg'),
  'a-leather-jacket': require('../../assets/items/armour/a-leather-jacket.jpg'),
  'a-leather-gloves': require('../../assets/items/armour/a-leather-gloves.jpg'),
  'a-leather-pants': require('../../assets/items/armour/a-leather-pants.jpg'),
  'a-knight-hood': require('../../assets/items/armour/a-knight-hood.jpg'),
  'a-knight-jacket': require('../../assets/items/armour/a-knight-jacket.jpg'),
  'a-knight-gloves': require('../../assets/items/armour/a-knight-gloves.jpg'),
  'a-knight-pants': require('../../assets/items/armour/a-knight-pants.jpg'),
  'a-arcane-hood': require('../../assets/items/armour/a-arcane-hood.jpg'),
  'a-arcane-jacket': require('../../assets/items/armour/a-arcane-jacket.jpg'),
  'a-arcane-gloves': require('../../assets/items/armour/a-arcane-gloves.jpg'),
  'a-arcane-pants': require('../../assets/items/armour/a-arcane-pants.jpg'),
  'a-templar-hood': require('../../assets/items/armour/a-templar-hood.jpg'),
  'a-templar-jacket': require('../../assets/items/armour/a-templar-jacket.jpg'),
  'a-templar-gloves': require('../../assets/items/armour/a-templar-gloves.jpg'),
  'a-templar-pants': require('../../assets/items/armour/a-templar-pants.jpg'),
};

const pct = (m: number) => `${m > 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%`;
function describe(s: PieceStats): string {
  const parts: string[] = [];
  if (s.mult) parts.push(`${pct(s.mult)} к урону/лечению`);
  if (s.hpMult) parts.push(`${pct(s.hpMult)} к HP`);
  if (s.wardMult) parts.push(`${pct(s.wardMult)} к получаемому урону`);
  if (s.cdMult) parts.push(`${pct(s.cdMult)} к перезарядке способности`);
  return parts.join(', ') + '.';
}

/** Every set item, grouped by the slot kind it goes in. */
export const ARMOUR_GEAR: Partial<Record<GearKind, GearOption[]>> = {};
for (const set of ARMOUR_SETS) for (const item of ARMOUR_ITEMS) {
  (ARMOUR_GEAR[ITEM_KIND[item]] ??= []).push({
    id: armourId(set.id, item), name: set.names[item], ...set.stats[item],
    desc: describe(set.stats[item]), icon: `a-${set.id}-${item}` as ArmourIconId,
  });
}
export const ARMOUR_IDS: string[] = ARMOUR_SETS.flatMap((s) => ARMOUR_ITEMS.map((i) => armourId(s.id, i)));

/** The set each of the starting five wears from the first screen (by candidate id). */
export const STARTING_OUTFITS: Record<number, ArmourSetId> = {
  0: 'knight', // Каелен, the tank: plate
  2: 'arcane', // Фаэлар, the healer
  4: 'leather', // Векс, the assassin
  5: 'templar', // Громмаш
  6: 'leather', // Сильвана, the archer
};

/** Put a hero's starting set on them: every armour slot that is still empty. */
export function dressInStartingSet(id: number, equipment: Record<string, string>): void {
  const set = STARTING_OUTFITS[id];
  if (!set) return;
  for (const item of ARMOUR_ITEMS) { const slot = ITEM_KIND[item]; if (!equipment[slot] || equipment[slot] === 'none') equipment[slot] = armourId(set, item); }
}
