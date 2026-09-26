import { IconName } from '../components/Icon';

// Systems open up as the guild makes progress, so a new player starts with
// camp, squad and dungeons and meets gear, talents, hiring, classes,
// professions and the arena one at a time. Progress is counted as rooms won
// and distinct dungeon bosses beaten.

export type Feature =
  | 'gear' | 'quests' | 'shop' | 'talents' | 'weekly' | 'achievements'
  | 'hire' | 'classes' | 'personnel' | 'professions' | 'arena' | 'analytics';

export interface FeatureDef {
  /** Rooms won needed (any fights). */
  rooms?: number;
  /** Distinct dungeon bosses beaten needed. */
  bosses?: number;
  title: string;
  /** Shown once when it opens: what it is and why to care. */
  intro: string;
  icon: IconName;
}

export const FEATURES: Record<Feature, FeatureDef> = {
  gear: {
    rooms: 1, icon: 'shield', title: 'Снаряжение и инвентарь',
    intro: 'Добыча из боёв копится на складе гильдии. Наденьте её на героев в «Отряд → К снаряжению»: оружие, броня и амулеты усиливают урон, здоровье и защиту.',
  },
  quests: {
    rooms: 2, icon: 'scroll', title: 'KPI',
    intro: 'Задания от руководства: выполняйте их в походах и забирайте награды на вкладке KPI внизу экрана.',
  },
  shop: {
    bosses: 1, icon: 'storefront', title: 'Отдел закупок',
    intro: 'Покупайте снаряжение за бюджет гильдии и продавайте лишнее со склада.',
  },
  talents: {
    bosses: 1, icon: 'chart-line-up', title: 'Таланты',
    intro: 'С уровнем герои получают таланты: откройте героя в «Отряде» и выберите по одному в каждом ряду дерева.',
  },
  weekly: {
    bosses: 1, icon: 'crown-simple', title: 'Испытание недели',
    intro: 'Раз в неделю — повторный бой с уже побеждённым боссом и особым условием. За победу — награда.',
  },
  achievements: {
    bosses: 1, icon: 'trophy', title: 'Достижения',
    intro: 'Отметки за вехи гильдии, у каждой своя награда.',
  },
  hire: {
    bosses: 2, icon: 'door-open', title: 'Найм героев',
    intro: 'На рынке труда появились соискатели: нанимайте новых героев за золото и собирайте отряд под подземелье.',
  },
  classes: {
    bosses: 2, icon: 'hand-fist', title: 'Классы',
    intro: 'Каждому герою можно один раз выбрать класс — он задаёт базовый стиль боя. Выбор — в карточке героя.',
  },
  personnel: {
    bosses: 2, icon: 'identification-card', title: 'Личные дела',
    intro: 'Досье сотрудников и архив уволенных: кто сколько служит, мораль и история.',
  },
  professions: {
    bosses: 3, icon: 'hard-hat', title: 'Профессии и крафт',
    intro: 'Героям можно выбрать ремесло: кузнец, алхимик и другие делают снаряжение из реагентов, которые падают в походах.',
  },
  arena: {
    bosses: 3, icon: 'sword', title: 'Арена',
    intro: 'Бои с отрядами других гильдий за рейтинг и золото. Вкладка «Арена» внизу экрана.',
  },
  analytics: {
    bosses: 4, icon: 'chart-line-up', title: 'Аналитика гильдии',
    intro: 'Графики побед, бюджета, морали и KPI — для тех, кто любит отчёты.',
  },
};

export const FEATURE_ORDER = Object.keys(FEATURES) as Feature[];

/** «после первой победы», «после 2-го босса»… */
export function unlockHint(f: Feature): string {
  const d = FEATURES[f];
  if (d.bosses) return d.bosses === 1 ? 'Откроется после первого босса' : `Откроется после ${d.bosses}-го босса`;
  const r = d.rooms ?? 0;
  return r <= 1 ? 'Откроется после первой победы' : `Откроется после ${r} побед`;
}

/** Combat tips shown once each in the first fights. */
export type Tip = 'move' | 'act' | 'focus' | 'danger' | 'windup';
export const TIPS: Record<Tip, string> = {
  move: 'Ход героя. Подсвеченные клетки — куда он может пойти. Нажмите клетку на поле или «Пропустить перемещение».',
  focus: 'Нажмите на врага на поле — весь отряд будет бить его. Ближний бой — только вплотную к врагу.',
  act: '«Атаковать» — обычный удар. Кнопка с картинкой — особая способность героя, после неё нужно несколько ходов перезарядки.',
  danger: 'Красные клетки — сюда враг ударит на следующем ходу. Уведите героев с них.',
  windup: 'Враг замахивается для мощного удара. «Оборона» снижает урон по герою до его следующего хода.',
};
