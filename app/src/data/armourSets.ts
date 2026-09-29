import { GearKind, GearOption } from './types';
import { ItemIconId } from './itemIcons';

// The owner's four Meshy outfits, cut into eight wearable pieces each. Every
// piece is its own item for its slot; on a hero it is drawn as a skinned mesh
// fitted to their race body (see battle3d/Wardrobe). The guild starts with one
// of each.

export type ArmourSetId = 'leather' | 'knight' | 'arcane' | 'templar';
export type ArmourPiece = 'hood' | 'shoulders' | 'cloak' | 'jacket' | 'belt' | 'gloves' | 'pants' | 'boots';

export const ARMOUR_PIECES: ArmourPiece[] = ['hood', 'shoulders', 'cloak', 'jacket', 'belt', 'gloves', 'pants', 'boots'];

/** The slot kind each piece goes in. */
export const PIECE_KIND: Record<ArmourPiece, GearKind> = {
  hood: 'helm', shoulders: 'shoulders', cloak: 'cloak', jacket: 'chest', belt: 'belt', gloves: 'gloves', pants: 'pants', boots: 'boots',
};

type PieceStats = Pick<GearOption, 'mult' | 'hpMult' | 'wardMult' | 'cdMult'>;
interface ArmourSetDef {
  id: ArmourSetId;
  /** A closed helm hides the whole head; a hood leaves the face showing. */
  closedHelm: boolean;
  names: Record<ArmourPiece, string>;
  /** What the set is good at, spread over its pieces. */
  stats: Record<ArmourPiece, PieceStats>;
}

const hp = (h: number): PieceStats => ({ hpMult: h });
export const ARMOUR_SETS: ArmourSetDef[] = [
  {
    id: 'leather', closedHelm: false,
    names: { hood: 'Кожаный капюшон', shoulders: 'Кожаные наплечники', cloak: 'Рваный плащ следопыта', jacket: 'Кожаная куртка', belt: 'Кожаный пояс', gloves: 'Кожаные перчатки', pants: 'Кожаные штаны', boots: 'Кожаные сапоги' },
    // Light and quick: damage and a shorter cooldown.
    stats: { hood: { mult: 1.03 }, shoulders: { mult: 1.02 }, cloak: { cdMult: 0.96 }, jacket: { mult: 1.04, hpMult: 1.03 }, belt: { mult: 1.02 }, gloves: { mult: 1.04 }, pants: { mult: 1.02 }, boots: { cdMult: 0.97 } },
  },
  {
    id: 'knight', closedHelm: true,
    names: { hood: 'Рыцарский шлем', shoulders: 'Рыцарские наплечники', cloak: 'Рыцарский плащ', jacket: 'Рыцарская кираса', belt: 'Рыцарский пояс', gloves: 'Рыцарские латные перчатки', pants: 'Рыцарские поножи', boots: 'Рыцарские сабатоны' },
    // Heavy plate: health and less damage taken.
    stats: { hood: hp(1.05), shoulders: hp(1.04), cloak: { wardMult: 0.98 }, jacket: { hpMult: 1.08, wardMult: 0.97 }, belt: hp(1.02), gloves: hp(1.03), pants: hp(1.05), boots: { hpMult: 1.03, wardMult: 0.99 } },
  },
  {
    id: 'arcane', closedHelm: false,
    names: { hood: 'Капюшон чародея', shoulders: 'Наплечники чародея', cloak: 'Плащ чародея', jacket: 'Одеяние чародея', belt: 'Кушак чародея', gloves: 'Перчатки чародея', pants: 'Штаны чародея', boots: 'Сапоги чародея' },
    // For casters: power and cooldowns.
    stats: { hood: { mult: 1.03, cdMult: 0.98 }, shoulders: { mult: 1.02 }, cloak: { cdMult: 0.95 }, jacket: { mult: 1.05 }, belt: { cdMult: 0.98 }, gloves: { mult: 1.03 }, pants: { hpMult: 1.03 }, boots: { cdMult: 0.98 } },
  },
  {
    id: 'templar', closedHelm: true,
    names: { hood: 'Шлем тамплиера', shoulders: 'Наплечники тамплиера', cloak: 'Плащ тамплиера', jacket: 'Сюрко тамплиера', belt: 'Пояс тамплиера', gloves: 'Латные перчатки тамплиера', pants: 'Поножи тамплиера', boots: 'Сабатоны тамплиера' },
    // Holy warrior: some of both.
    stats: { hood: { hpMult: 1.04, mult: 1.01 }, shoulders: hp(1.03), cloak: { wardMult: 0.98, mult: 1.01 }, jacket: { hpMult: 1.06, mult: 1.03 }, belt: hp(1.02), gloves: { mult: 1.03 }, pants: hp(1.04), boots: hp(1.03) },
  },
];

export const armourId = (set: ArmourSetId, piece: ArmourPiece) => `set-${set}-${piece}`;
/** The set and piece behind an item id, or null for any other item. */
export function armourOf(gearId: string | undefined): { set: ArmourSetDef; piece: ArmourPiece } | null {
  const m = /^set-([a-z]+)-([a-z]+)$/.exec(gearId ?? '');
  const set = m && ARMOUR_SETS.find((s) => s.id === m[1]);
  return set && (ARMOUR_PIECES as string[]).includes(m![2]) ? { set, piece: m![2] as ArmourPiece } : null;
}

// Icons rendered from the pieces themselves.
export type ArmourIconId = `a-${ArmourSetId}-${ArmourPiece}`;
export type GearIconId = ItemIconId | ArmourIconId;
export const ARMOUR_ICONS: Record<ArmourIconId, any> = {
  'a-leather-hood': require('../../assets/items/armour/a-leather-hood.jpg'),
  'a-leather-shoulders': require('../../assets/items/armour/a-leather-shoulders.jpg'),
  'a-leather-cloak': require('../../assets/items/armour/a-leather-cloak.jpg'),
  'a-leather-jacket': require('../../assets/items/armour/a-leather-jacket.jpg'),
  'a-leather-belt': require('../../assets/items/armour/a-leather-belt.jpg'),
  'a-leather-gloves': require('../../assets/items/armour/a-leather-gloves.jpg'),
  'a-leather-pants': require('../../assets/items/armour/a-leather-pants.jpg'),
  'a-leather-boots': require('../../assets/items/armour/a-leather-boots.jpg'),
  'a-knight-hood': require('../../assets/items/armour/a-knight-hood.jpg'),
  'a-knight-shoulders': require('../../assets/items/armour/a-knight-shoulders.jpg'),
  'a-knight-cloak': require('../../assets/items/armour/a-knight-cloak.jpg'),
  'a-knight-jacket': require('../../assets/items/armour/a-knight-jacket.jpg'),
  'a-knight-belt': require('../../assets/items/armour/a-knight-belt.jpg'),
  'a-knight-gloves': require('../../assets/items/armour/a-knight-gloves.jpg'),
  'a-knight-pants': require('../../assets/items/armour/a-knight-pants.jpg'),
  'a-knight-boots': require('../../assets/items/armour/a-knight-boots.jpg'),
  'a-arcane-hood': require('../../assets/items/armour/a-arcane-hood.jpg'),
  'a-arcane-shoulders': require('../../assets/items/armour/a-arcane-shoulders.jpg'),
  'a-arcane-cloak': require('../../assets/items/armour/a-arcane-cloak.jpg'),
  'a-arcane-jacket': require('../../assets/items/armour/a-arcane-jacket.jpg'),
  'a-arcane-belt': require('../../assets/items/armour/a-arcane-belt.jpg'),
  'a-arcane-gloves': require('../../assets/items/armour/a-arcane-gloves.jpg'),
  'a-arcane-pants': require('../../assets/items/armour/a-arcane-pants.jpg'),
  'a-arcane-boots': require('../../assets/items/armour/a-arcane-boots.jpg'),
  'a-templar-hood': require('../../assets/items/armour/a-templar-hood.jpg'),
  'a-templar-shoulders': require('../../assets/items/armour/a-templar-shoulders.jpg'),
  'a-templar-cloak': require('../../assets/items/armour/a-templar-cloak.jpg'),
  'a-templar-jacket': require('../../assets/items/armour/a-templar-jacket.jpg'),
  'a-templar-belt': require('../../assets/items/armour/a-templar-belt.jpg'),
  'a-templar-gloves': require('../../assets/items/armour/a-templar-gloves.jpg'),
  'a-templar-pants': require('../../assets/items/armour/a-templar-pants.jpg'),
  'a-templar-boots': require('../../assets/items/armour/a-templar-boots.jpg'),
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

/** Every set piece as an item, grouped by the slot kind it goes in. */
export const ARMOUR_GEAR: Partial<Record<GearKind, GearOption[]>> = {};
for (const set of ARMOUR_SETS) for (const piece of ARMOUR_PIECES) {
  const kind = PIECE_KIND[piece];
  (ARMOUR_GEAR[kind] ??= []).push({
    id: armourId(set.id, piece), name: set.names[piece], ...set.stats[piece],
    desc: describe(set.stats[piece]), icon: `a-${set.id}-${piece}` as ArmourIconId,
  });
}
export const ARMOUR_IDS: string[] = ARMOUR_SETS.flatMap((s) => ARMOUR_PIECES.map((p) => armourId(s.id, p)));
