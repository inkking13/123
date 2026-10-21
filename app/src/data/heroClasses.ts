import { IconName } from '../components/Icon';

// The eight classes. A hero's class is part of who they are (fixed, from their
// story) and sits on top of their role: the role decides where they stand in
// the squad (tank, healer, damage), the class how they fight — a passive that
// is always on and their own valor move, paid from the party's shared pool.

export type HeroClassId = 'warrior' | 'paladin' | 'priest' | 'druid' | 'mage' | 'necromancer' | 'rogue' | 'hunter';

export interface HeroClassDef {
  name: string;
  icon: IconName;
  color: string;
  /** The always-on trait, in one line. */
  passiveName: string;
  passive: string;
  valorName: string;
  valorCost: number;
  valorDesc: string;
}

export const HERO_CLASSES: Record<HeroClassId, HeroClassDef> = {
  warrior: {
    name: 'Воин', icon: 'sword', color: '#c98c6d',
    passiveName: 'Боевой задор', passive: 'Первый удар, пропущенный за раунд, даёт отряду +1 доблесть.',
    valorName: 'Сокрушительный удар', valorCost: 2, valorDesc: 'Верный крит ×2.2 и сильный натиск по врагу.',
  },
  paladin: {
    name: 'Паладин', icon: 'shield-chevron', color: '#e2bd7c',
    passiveName: 'Аура защиты', passive: 'Союзники на соседних клетках получают на 15% меньше урона.',
    valorName: 'Божественный щит', valorCost: 3, valorDesc: 'Весь отряд получает на 40% меньше урона до конца следующего раунда.',
  },
  priest: {
    name: 'Жрец', icon: 'first-aid-kit', color: '#efdbb2',
    passiveName: 'Благодать', passive: 'Лечение на 15% сильнее и снимает яд с союзника.',
    valorName: 'Молитва исцеления', valorCost: 2, valorDesc: 'Лечит весь отряд сразу.',
  },
  druid: {
    name: 'Друид', icon: 'drop', color: '#93ad7f',
    passiveName: 'Побеги', passive: 'Вылеченный союзник ещё 2 раунда восстанавливает здоровье сам.',
    valorName: 'Цветение', valorCost: 2, valorDesc: 'Весь отряд 3 раунда восстанавливает здоровье в начале раунда.',
  },
  mage: {
    name: 'Маг', icon: 'fire', color: '#d97a4a',
    passiveName: 'Взрыв', passive: 'Атака задевает врагов рядом с целью на 35% урона.',
    valorName: 'Огненный шторм', valorCost: 3, valorDesc: 'Пламя по всем врагам на поле.',
  },
  necromancer: {
    name: 'Некромант', icon: 'skull', color: '#9b8fc4',
    passiveName: 'Похищение жизни', passive: 'Атака возвращает некроманту 30% нанесённого урона здоровьем.',
    valorName: 'Жатва душ', valorCost: 2, valorDesc: 'Тяжёлый удар; половина урона лечит самого раненого союзника.',
  },
  rogue: {
    name: 'Разбойник', icon: 'hand-fist', color: '#86b39a',
    passiveName: 'Удар с фланга', passive: '+40% урона, если рядом с целью стоит ещё кто-то из отряда.',
    valorName: 'Смертельный удар', valorCost: 2, valorDesc: 'Удар ×2.4, а по врагу ниже 30% здоровья — ×3.5.',
  },
  hunter: {
    name: 'Охотник', icon: 'target', color: '#a9c27a',
    passiveName: 'Дистанция', passive: '+25% урона, пока рядом нет ни одного врага.',
    valorName: 'Прицельный выстрел', valorCost: 2, valorDesc: 'Верный крит ×2.2 откуда угодно.',
  },
};

export const HERO_CLASS_ORDER = Object.keys(HERO_CLASSES) as HeroClassId[];
