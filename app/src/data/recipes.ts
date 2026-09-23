import { GearSlotKey } from './types';

export interface RecipeDef {
  id: string;
  professionId: string;
  name: string;
  slot: GearSlotKey;
  gearId: string;
  unlockLevel: number;
  goldCost: number;
  reagentId: string;
  reagentQty: number;
}

// Two recipes per profession — an early one craftable right away, and a
// late one unlocked deep into training — each turning one location's
// drop-only reagent into a real, ownable piece of gear.
export const RECIPES: RecipeDef[] = [
  { id: 'r-blacksmith1', professionId: 'blacksmithing', name: 'Клинок из Металлолома', slot: 'weapon', gearId: 'rw-blacksmith1', unlockLevel: 1, goldCost: 40, reagentId: 'scrap-metal', reagentQty: 5 },
  { id: 'r-blacksmith2', professionId: 'blacksmithing', name: 'Демонический Тесак', slot: 'weapon', gearId: 'rw-blacksmith2', unlockLevel: 12, goldCost: 150, reagentId: 'demonic-alloy', reagentQty: 5 },

  { id: 'r-leather1', professionId: 'leatherworking', name: 'Доспех из Волчьей Шкуры', slot: 'armor', gearId: 'ra-leather1', unlockLevel: 1, goldCost: 40, reagentId: 'wolf-hide', reagentQty: 5 },
  { id: 'r-leather2', professionId: 'leatherworking', name: 'Доспех из Чешуи Виверны', slot: 'armor', gearId: 'ra-leather2', unlockLevel: 12, goldCost: 150, reagentId: 'wyvern-scale', reagentQty: 5 },

  { id: 'r-jewel1', professionId: 'jewelcrafting', name: 'Серебряное Кольцо', slot: 'trinket', gearId: 'rt-jewel1', unlockLevel: 1, goldCost: 40, reagentId: 'silver-ingot', reagentQty: 5 },
  { id: 'r-jewel2', professionId: 'jewelcrafting', name: 'Кольцо из Демонического Сплава', slot: 'trinket', gearId: 'rt-jewel2', unlockLevel: 12, goldCost: 150, reagentId: 'demonic-alloy', reagentQty: 5 },

  { id: 'r-enchant1', professionId: 'enchanting', name: 'Зачарованный Клинок Тьмы', slot: 'weapon', gearId: 'rw-enchant1', unlockLevel: 1, goldCost: 45, reagentId: 'dark-essence', reagentQty: 5 },
  { id: 'r-enchant2', professionId: 'enchanting', name: 'Зачарованный Клинок Пепла', slot: 'weapon', gearId: 'rw-enchant2', unlockLevel: 12, goldCost: 160, reagentId: 'ash-slate', reagentQty: 5 },

  { id: 'r-alchemy1', professionId: 'alchemy', name: 'Костяной Оберег', slot: 'trinket', gearId: 'rt-alchemy1', unlockLevel: 1, goldCost: 45, reagentId: 'bone-dust', reagentQty: 5 },
  { id: 'r-alchemy2', professionId: 'alchemy', name: 'Эликсир из Чешуи Виверны', slot: 'trinket', gearId: 'rt-alchemy2', unlockLevel: 12, goldCost: 160, reagentId: 'wyvern-scale', reagentQty: 5 },

  { id: 'r-engineer1', professionId: 'engineering', name: 'Механический Наплечник', slot: 'armor', gearId: 'ra-engineer1', unlockLevel: 1, goldCost: 45, reagentId: 'scrap-metal', reagentQty: 5 },
  { id: 'r-engineer2', professionId: 'engineering', name: 'Осадный Экзоскелет', slot: 'armor', gearId: 'ra-engineer2', unlockLevel: 12, goldCost: 160, reagentId: 'demonic-alloy', reagentQty: 5 },
];
