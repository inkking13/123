import { AbilityIcon, AbilityKind } from '../combat/types';

export interface AbilityDef {
  kind: AbilityKind;
  icon: AbilityIcon;
  name: string;
  desc: string;
  /** Cooldown, in rounds. */
  cdMax: number;
  /** Buff duration, in rounds (0 for instant effects). */
  activeMax: number;
}

// Keyed by candidate id (data/characters.ts) — each of the nine mercenaries
// has its own signature ability instead of a generic one shared by role.
export const ABILITY_BY_CANDIDATE: Record<number, AbilityDef> = {
  0: {
    kind: 'selfShield', icon: 'shield', cdMax: 4, activeMax: 2,
    name: 'Librum Tenebris', desc: 'Раскрывает украденный гримуар — урон по нему снижен вдвое 2 хода.',
  },
  1: {
    kind: 'partyShield', icon: 'shield-chevron', cdMax: 5, activeMax: 2,
    name: 'Последний рубеж', desc: 'Встаёт живым щитом — весь отряд получает на 30% меньше урона 2 хода.',
  },
  2: {
    kind: 'drainHeal', icon: 'skull', cdMax: 3, activeMax: 0,
    name: 'Обряд тлена', desc: 'Исцеляет союзника на 90 HP ценой собственной крови — теряет 15 HP сам.',
  },
  3: {
    kind: 'volatileHeal', icon: 'flask', cdMax: 3, activeMax: 0,
    name: 'Экспериментальный эликсир', desc: 'Нестабильное зелье: обычно лечит на 40–110 HP, но иногда даёт осечку.',
  },
  4: {
    kind: 'venom', icon: 'drop', cdMax: 4, activeMax: 0,
    name: 'Яд василиска', desc: 'Смазывает клинки ядом — враг получает урон яда ещё 3 хода.',
  },
  5: {
    kind: 'berserk', icon: 'flame', cdMax: 4, activeMax: 2,
    name: 'Кровавая ярость', desc: 'Удваивает собственный урон на 2 хода, но делает его самого уязвимее.',
  },
  6: {
    kind: 'nukeSelfDamage', icon: 'target', cdMax: 4, activeMax: 0,
    name: 'Зелёная стрела', desc: 'Мощный выстрел по врагу — яд в стреле ранит и саму Сильвану.',
  },
  7: {
    kind: 'nukeHeal', icon: 'fire', cdMax: 4, activeMax: 0,
    name: 'Огонь Душ', desc: 'Обжигает врага и тут же лечит весь отряд ценой собственных сил.',
  },
  8: {
    kind: 'nukeTilt', icon: 'sword', cdMax: 4, activeMax: 0,
    name: 'Кара еретика', desc: 'Обрушивает на врага тяжёлый удар — сомнения в вере повышают напряжение отряда.',
  },
  9: {
    kind: 'partyShield', icon: 'shield-chevron', cdMax: 5, activeMax: 2,
    name: 'Страховой пункт', desc: 'Зачитывает мелкий шрифт договора — весь отряд получает на 30% меньше урона 2 хода.',
  },
  10: {
    kind: 'drainHeal', icon: 'skull', cdMax: 3, activeMax: 0,
    name: 'Расписка о рисках', desc: 'Лечит союзника на 90 HP, но берёт плату собственным здоровьем — теряет 15 HP сама.',
  },
  11: {
    kind: 'nukeTilt', icon: 'sword', cdMax: 4, activeMax: 0,
    name: 'Гимн гильдии', desc: 'Оглушительный куплет по врагу — от фальши у всего отряда сдают нервы.',
  },
  12: {
    kind: 'berserk', icon: 'flame', cdMax: 4, activeMax: 2,
    name: 'Взыскание', desc: 'Удваивает собственный урон на 2 хода, выбивая долг любой ценой — включая свою шкуру.',
  },
  13: {
    kind: 'nukeSelfDamage', icon: 'target', cdMax: 4, activeMax: 0,
    name: 'Нестабильный призыв', desc: 'Поднимает скелета на врага — заклинание срывается и бьёт немного и по самой Мортане.',
  },
};
