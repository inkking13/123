export type DailyMetric = 'roomWin' | 'bossWin' | 'levelUp' | 'goldEarned' | 'abilityUsed' | 'gearChange';

export interface DailyQuestTemplate {
  id: string;
  name: string;
  desc: string;
  metric: DailyMetric;
  target: number;
  rewardGold: number;
}

export const DAILY_QUEST_TEMPLATES: DailyQuestTemplate[] = [
  { id: 'daily-rooms', name: 'Ежедневный обход', desc: 'Зачистите 2 комнаты в любых походах.', metric: 'roomWin', target: 2, rewardGold: 25 },
  { id: 'daily-boss', name: 'Охота на босса', desc: 'Победите одного босса.', metric: 'bossWin', target: 1, rewardGold: 45 },
  { id: 'daily-levelup', name: 'Кадровый резерв', desc: 'Повысьте уровень любого бойца.', metric: 'levelUp', target: 1, rewardGold: 20 },
  { id: 'daily-gold', name: 'Экономный менеджер', desc: 'Заработайте 40 золота с добычи.', metric: 'goldEarned', target: 40, rewardGold: 15 },
  { id: 'daily-ability', name: 'Мастер тактики', desc: 'Активируйте способность бойца в бою.', metric: 'abilityUsed', target: 1, rewardGold: 20 },
  { id: 'daily-gear', name: 'Отдел снаряжения', desc: 'Купите или смените снаряжение бойцу.', metric: 'gearChange', target: 1, rewardGold: 15 },
];

// Deterministic pick of 3 templates for a given "YYYY-MM-DD" key, so the
// day's quest set is stable across app restarts without extra save state —
// it's re-derived from the date every time, not stored.
export function pickDailyTemplates(dateKey: string): DailyQuestTemplate[] {
  let seed = 0;
  for (let i = 0; i < dateKey.length; i++) seed = (seed * 31 + dateKey.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const pool = [...DAILY_QUEST_TEMPLATES];
  const picked: DailyQuestTemplate[] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(rand() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}
