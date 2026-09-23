import type { GameEngine } from '../engine/GameEngine';
import { MAX_LEVEL } from './characters';

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  rewardDesc: string;
  rewardMorale: number;
  check: (e: GameEngine) => boolean;
}

const hasGear = (e: GameEngine) =>
  e.pool.some((c) => c.equipment.weapon !== 'none' || c.equipment.armor !== 'none' || c.equipment.trinket !== 'none');
const hasTalent = (e: GameEngine) => e.pool.some((c) => c.talents.some((t) => t != null));
const hasVeteran = (e: GameEngine) => e.pool.some((c) => c.level >= 10);
const hasGrandmaster = (e: GameEngine) => e.pool.some((c) => c.level >= MAX_LEVEL);
const hasBalancedSquad = (e: GameEngine) => {
  if (!e.squadReady()) return false;
  const squad = e.squad();
  return squad.some((c) => c.role === 'tank') && squad.some((c) => c.role === 'heal');
};

export const QUESTS: QuestDef[] = [
  {
    id: 'balanced-squad',
    name: 'Полный отряд',
    desc: 'Соберите отряд из пяти бойцов с хотя бы одним танком и одним хилером.',
    rewardDesc: '+8 морали всей гильдии',
    rewardMorale: 8,
    check: hasBalancedSquad,
  },
  {
    id: 'first-blood',
    name: 'Первая кровь',
    desc: 'Зачистите первую комнату любого похода.',
    rewardDesc: '+8 морали всей гильдии',
    rewardMorale: 8,
    check: (e) => e.everClearedRoom,
  },
  {
    id: 'groblot-down',
    name: 'Гроза Гроблота',
    desc: 'Победите Гроблота Пожирателя.',
    rewardDesc: '+10 морали всей гильдии',
    rewardMorale: 10,
    check: (e) => e.defeatedDungeons.has('groblot'),
  },
  {
    id: 'icepeaks-down',
    name: 'Покоритель пиков',
    desc: 'Победите Ярла Ледяного Пепла в Ледяных Пиках.',
    rewardDesc: '+10 морали всей гильдии',
    rewardMorale: 10,
    check: (e) => e.defeatedDungeons.has('icepeaks'),
  },
  {
    id: 'ashen-down',
    name: 'Пепел и покаяние',
    desc: 'Победите Кардинала Пепла в Соборе Пепла.',
    rewardDesc: '+10 морали всей гильдии',
    rewardMorale: 10,
    check: (e) => e.defeatedDungeons.has('ashen'),
  },
  {
    id: 'mines-down',
    name: 'Долг уплачен',
    desc: 'Победите Ростовщика Коронного в Шахтах Должников.',
    rewardDesc: '+12 морали всей гильдии',
    rewardMorale: 12,
    check: (e) => e.defeatedDungeons.has('mines'),
  },
  {
    id: 'boardroom-down',
    name: 'Смена владельца',
    desc: 'Победите Держателя Контрольного Пакета и узнайте, кому вы служили всё это время.',
    rewardDesc: '+15 морали всей гильдии',
    rewardMorale: 15,
    check: (e) => e.defeatedDungeons.has('boardroom'),
  },
  {
    id: 'gear-up',
    name: 'Кузнец',
    desc: 'Наденьте любое снаряжение хотя бы на одного бойца.',
    rewardDesc: '+6 морали всей гильдии',
    rewardMorale: 6,
    check: hasGear,
  },
  {
    id: 'first-talent',
    name: 'Свой путь',
    desc: 'Выберите талант для любого бойца.',
    rewardDesc: '+6 морали всей гильдии',
    rewardMorale: 6,
    check: hasTalent,
  },
  {
    id: 'veteran',
    name: 'Ветеран',
    desc: 'Доведите любого бойца до 10 уровня.',
    rewardDesc: '+12 морали всей гильдии',
    rewardMorale: 12,
    check: hasVeteran,
  },
  {
    id: 'grandmaster',
    name: 'Легенда отдела кадров',
    desc: `Доведите любого бойца до максимального, ${MAX_LEVEL} уровня.`,
    rewardDesc: '+25 морали всей гильдии',
    rewardMorale: 25,
    check: hasGrandmaster,
  },
  {
    id: 'interrupter',
    name: 'Хладнокровие',
    desc: 'Прервите каст босса в бою.',
    rewardDesc: '+8 морали всей гильдии',
    rewardMorale: 8,
    check: (e) => e.everInterrupted,
  },
  {
    id: 'ability-user',
    name: 'Мастер тактики',
    desc: 'Активируйте способность бойца в бою.',
    rewardDesc: '+6 морали всей гильдии',
    rewardMorale: 6,
    check: (e) => e.everUsedAbility,
  },
  {
    id: 'loot-split',
    name: 'Дележ по-честному',
    desc: 'Распределите добычу после победы над боссом.',
    rewardDesc: '+8 морали всей гильдии',
    rewardMorale: 8,
    check: (e) => e.everAssignedLoot,
  },
];
