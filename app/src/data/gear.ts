import { GearOption, GearSlotKey } from './types';

export interface LootDrop {
  slot: GearSlotKey;
  gearId: string;
}

export const GEAR: Record<GearSlotKey, GearOption[]> = {
  weapon: [
    { id: 'none', name: 'Без оружия', mult: 1, desc: 'Никаких бонусов.' },
    { id: 'w1', name: 'Верный клинок', mult: 1.10, desc: '+10% к урону/лечению.', icon: 'ostryy-stilet', price: 40 },
    { id: 'w2', name: 'Клинок павшего чемпиона', mult: 1.20, desc: '+20% к урону/лечению.', icon: 'proklyataya-rapira', price: 90 },
    { id: 'w3', name: 'Кровопийца Гроблота', mult: 1.32, hpMult: 0.90, desc: '+32% к урону/лечению, но -10% к HP.', icon: 'proklyatyy-mech', price: 160 },
    { id: 'w4', name: 'Посох Некроманта', mult: 1.18, desc: '+18% к урону/лечению.', icon: 'posoh-nekromanta', price: 110 },
    { id: 'w5', name: 'Коса Жнеца', mult: 1.42, desc: '+42% к урону/лечению.', icon: 'kosa-zhnetsa', price: 220 },
  ],
  armor: [
    { id: 'none', name: 'Без брони', hpMult: 1, desc: 'Никаких бонусов.' },
    { id: 'a1', name: 'Кожаный нагрудник', hpMult: 1.10, desc: '+10% к HP.', icon: 'proklyatyy-nagrudnik', price: 40 },
    { id: 'a2', name: 'Кольчуга ветерана', hpMult: 1.20, desc: '+20% к HP.', icon: 'shlem-padshego-rytsarya', price: 90 },
    { id: 'a3', name: 'Плита Несокрушимости', hpMult: 1.32, mult: 0.90, desc: '+32% к HP, но -10% к урону/лечению.', icon: 'goticheskiy-schit', price: 160 },
    { id: 'a4', name: 'Шлем с Шипами', hpMult: 1.24, desc: '+24% к HP.', icon: 'shlem-s-shipami', price: 120 },
    { id: 'a5', name: 'Наплечники Падшего Паладина', hpMult: 1.44, desc: '+44% к HP.', icon: 'naplechniki-padshego-paladina', price: 230 },
  ],
  trinket: [
    { id: 'none', name: 'Без амулета', desc: 'Никаких бонусов.' },
    { id: 't1', name: 'Оберег стойкости', wardMult: 0.88, desc: '-12% к получаемому урону.', icon: 'obereg-maga', price: 40 },
    { id: 't2', name: 'Часы мага', cdMult: 0.85, desc: '-15% к перезарядке способности.', icon: 'oko-tenevogo-maga', price: 100 },
    { id: 't3', name: 'Кровавый гранат', mult: 1.08, wardMult: 1.10, desc: '+8% к урону/лечению, но +10% к получаемому урону.', icon: 'yadro-magmaticheskogo-golema', price: 110 },
    { id: 't4', name: 'Алхимический Пояс', cdMult: 0.82, desc: '-18% к перезарядке способности.', icon: 'alhimicheskiy-poyas', price: 130 },
    { id: 't5', name: 'Кольцо Мертвеца', mult: 1.14, desc: '+14% к урону/лечению.', icon: 'koltso-mertvetsa', price: 150 },
  ],
};

// Sell price at the trader — half the buy price, rounded down.
export const SELL_RATIO = 0.5;

export const SLOT_LABEL: Record<GearSlotKey, string> = {
  weapon: 'Оружие',
  armor: 'Броня',
  trinket: 'Амулет',
};

export const SLOT_ORDER: GearSlotKey[] = ['weapon', 'armor', 'trinket'];

// Starting stash — the guild owns exactly one of each, so the very first
// gearing decision (who gets it) already matters.
export const STARTING_INVENTORY: Record<string, number> = { w1: 1, a1: 1, t1: 1 };

// Boss kills drop from the rarer tiers — a real, ownable item added to the
// guild's shared inventory, not an infinite catalog entry.
export const BOSS_LOOT_TABLE: LootDrop[] = [
  { slot: 'weapon', gearId: 'w2' },
  { slot: 'weapon', gearId: 'w3' },
  { slot: 'weapon', gearId: 'w4' },
  { slot: 'weapon', gearId: 'w5' },
  { slot: 'armor', gearId: 'a2' },
  { slot: 'armor', gearId: 'a3' },
  { slot: 'armor', gearId: 'a4' },
  { slot: 'armor', gearId: 'a5' },
  { slot: 'trinket', gearId: 't2' },
  { slot: 'trinket', gearId: 't3' },
  { slot: 'trinket', gearId: 't4' },
  { slot: 'trinket', gearId: 't5' },
];

// Regular room fights have a chance at a single common-tier drop off the
// slain trash mobs — smaller and less certain than a boss kill's guaranteed
// rare loot.
export const TRASH_LOOT_TABLE: LootDrop[] = [
  { slot: 'weapon', gearId: 'w1' },
  { slot: 'armor', gearId: 'a1' },
  { slot: 'trinket', gearId: 't1' },
];
export const TRASH_LOOT_CHANCE = 0.55;
