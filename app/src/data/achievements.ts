import type { GameEngine } from '../engine/GameEngine';
import { CURIOS } from './curios';
import { MAX_LEVEL } from './characters';
import { PROFESSION_MAX_LEVEL } from './professions';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  rewardGold: number;
  check: (e: GameEngine) => boolean;
}

const clearedAll = (ids: string[]) => (e: GameEngine) => ids.every((id) => e.defeatedDungeons.has(id));

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach-outskirts', name: 'Покоритель Окраин', rewardGold: 40,
    desc: 'Зачистите все три подземелья Окраин Гильдии.',
    check: clearedAll(['wastes', 'road', 'groblot']),
  },
  {
    id: 'ach-icefrontier', name: 'Хозяин Ледяного Края', rewardGold: 55,
    desc: 'Зачистите все три подземелья Ледяного Края.',
    check: clearedAll(['frostpass', 'wolfrifts', 'icepeaks']),
  },
  {
    id: 'ach-ashlands', name: 'Пепел Земель Пепла', rewardGold: 70,
    desc: 'Зачистите все три подземелья Земель Пепла.',
    check: clearedAll(['charfields', 'parishruins', 'ashen']),
  },
  {
    id: 'ach-debtprovince', name: 'Кредитор Кредиторов', rewardGold: 85,
    desc: 'Зачистите все три подземелья Долговой Провинции.',
    check: clearedAll(['mortgagedfarms', 'debtorsjail', 'mines']),
  },
  {
    id: 'ach-shadowguild', name: 'Гроза Гильдии Теней', rewardGold: 100,
    desc: 'Зачистите все три подземелья Гильдии Теней.',
    check: clearedAll(['blackmarket', 'smugglercatacombs', 'nightsyndicate']),
  },
  {
    id: 'ach-forgottenlegion', name: 'Победитель Забытого Легиона', rewardGold: 115,
    desc: 'Зачистите все три подземелья Забытого Легиона.',
    check: clearedAll(['unmarkedgraves', 'desertersfort', 'deadlegion']),
  },
  {
    id: 'ach-dragonwastes', name: 'Укротитель Драконьих Пустошей', rewardGold: 130,
    desc: 'Зачистите все три подземелья Драконьих Пустошей.',
    check: clearedAll(['burntcliffs', 'wyvernlair', 'ancientpeak']),
  },
  {
    id: 'ach-hierarchy', name: 'Хозяин Гильдии', rewardGold: 200,
    desc: 'Зачистите все три подземелья Вершины Иерархии и узнайте всю правду.',
    check: clearedAll(['shareholderfloor', 'councilantechamber', 'boardroom']),
  },
  {
    id: 'ach-craftsman', name: 'Первый Заказ', rewardGold: 25,
    desc: 'Скрафтите любой предмет по рецепту профессии.',
    check: (e) => e.everCrafted,
  },
  {
    id: 'ach-master-profession', name: 'Мастер на Все Руки', rewardGold: 60,
    desc: 'Прокачайте любую профессию до максимального уровня мастерства.',
    check: (e) => e.pool.some((c) => c.professionLevel >= PROFESSION_MAX_LEVEL),
  },
  {
    id: 'ach-curios', name: 'Коллекционер Диковин', rewardGold: 90,
    desc: `Соберите все ${CURIOS.length} реликвий.`,
    check: (e) => e.curiosOwned.size >= CURIOS.length,
  },
  {
    id: 'ach-arena-legend', name: 'Легенда Арены', rewardGold: 100,
    desc: 'Достигните ранга «Легенда Арены» (1500 рейтинга).',
    check: (e) => e.arenaRating >= 1500,
  },
  {
    id: 'ach-full-set', name: 'Полный Комплект', rewardGold: 45,
    desc: 'Наденьте на одного бойца все три предмета одного комплекта.',
    check: (e) => e.pool.some((c) => e.setProgressVM(c).some((s) => s.count >= 3)),
  },
  {
    id: 'ach-five-max-level', name: 'Пятеро Лучших', rewardGold: 150,
    desc: `Доведите пятерых бойцов до максимального, ${MAX_LEVEL} уровня.`,
    check: (e) => e.pool.filter((c) => c.level >= MAX_LEVEL).length >= 5,
  },
];
