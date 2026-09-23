// Flavor names for the rival guilds the Arena pits you against — no real
// opponents, just a fresh procedurally-scaled squad each time you fight.
export const ARENA_RIVALS: string[] = [
  'Гильдия «Серебряный Крюк»',
  'Контора «Кровавый Баланс»',
  'Бюро «Второй Шанс»',
  'Синдикат «Чёрная Смета»',
  'Артель «Ночной Аудит»',
  'Лига «Стальной Протокол»',
  'Товарищество «Последний Довод»',
  'Компания «Три Клятвы»',
];

export interface ArenaRank {
  min: number;
  name: string;
}

export const ARENA_RANKS: ArenaRank[] = [
  { min: 0, name: 'Стажёр' },
  { min: 900, name: 'Наёмник' },
  { min: 1100, name: 'Ветеран Арены' },
  { min: 1300, name: 'Чемпион Гильдий' },
  { min: 1500, name: 'Легенда Арены' },
];

export function arenaRankName(rating: number): string {
  let name = ARENA_RANKS[0].name;
  for (const r of ARENA_RANKS) if (rating >= r.min) name = r.name;
  return name;
}
