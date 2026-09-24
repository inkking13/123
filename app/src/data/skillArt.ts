import { IconName } from '../components/Icon';

export type SkillArtId =
  | 'istochnik-sily'
  | 'yarost-voina'
  | 'duh-predkov'
  | 'arkannye-svyazi'
  | 'zaklinatel'
  | 'razrushitel'
  | 'posledniy-rubezh'
  | 'kostyanoe-kopye'
  | 'krovavaya-loza'
  | 'ledyanoy-vzryv'
  | 'toksichnyy-splesk'
  | 'krovavyy-ritual'
  | 'adskiy-razrez'
  | 'ledyanoy-plen'
  | 'prizyv-upyrya'
  | 'infernalnyy-prizyv'
  | 'voy-pustoty'
  | 'zolotoy-prigovor'
  | 'proklyatie-sveta'
  | 'adskiy-shtorm'
  | 'yadovityy-ukus';

export const SKILL_ART: Record<SkillArtId, any> = {
  'istochnik-sily': require('../../assets/skills/istochnik-sily.jpg'),
  'yarost-voina': require('../../assets/skills/yarost-voina.jpg'),
  'duh-predkov': require('../../assets/skills/duh-predkov.jpg'),
  'arkannye-svyazi': require('../../assets/skills/arkannye-svyazi.jpg'),
  'zaklinatel': require('../../assets/skills/zaklinatel.jpg'),
  'razrushitel': require('../../assets/skills/razrushitel.jpg'),
  'posledniy-rubezh': require('../../assets/skills/posledniy-rubezh.jpg'),
  'kostyanoe-kopye': require('../../assets/skills/kostyanoe-kopye.jpg'),
  'krovavaya-loza': require('../../assets/skills/krovavaya-loza.jpg'),
  'ledyanoy-vzryv': require('../../assets/skills/ledyanoy-vzryv.jpg'),
  'toksichnyy-splesk': require('../../assets/skills/toksichnyy-splesk.jpg'),
  'krovavyy-ritual': require('../../assets/skills/krovavyy-ritual.jpg'),
  'adskiy-razrez': require('../../assets/skills/adskiy-razrez.jpg'),
  'ledyanoy-plen': require('../../assets/skills/ledyanoy-plen.jpg'),
  'prizyv-upyrya': require('../../assets/skills/prizyv-upyrya.jpg'),
  'infernalnyy-prizyv': require('../../assets/skills/infernalnyy-prizyv.jpg'),
  'voy-pustoty': require('../../assets/skills/voy-pustoty.jpg'),
  'zolotoy-prigovor': require('../../assets/skills/zolotoy-prigovor.jpg'),
  'proklyatie-sveta': require('../../assets/skills/proklyatie-sveta.jpg'),
  'adskiy-shtorm': require('../../assets/skills/adskiy-shtorm.jpg'),
  'yadovityy-ukus': require('../../assets/skills/yadovityy-ukus.jpg'),
};

// Keyed by candidate id, like ABILITY_BY_CANDIDATE — picked to match each
// signature ability's flavour rather than its mechanical kind, so two
// characters sharing a kind (e.g. both party shields) still look different.
export const ABILITY_ART: Record<number, SkillArtId> = {
  0: 'zaklinatel',          // Librum Tenebris — stolen grimoire
  1: 'posledniy-rubezh',    // Последний рубеж
  2: 'krovavaya-loza',      // Обряд тлена
  3: 'toksichnyy-splesk',   // Экспериментальный эликсир
  4: 'yadovityy-ukus',      // Яд василиска
  5: 'yarost-voina',        // Кровавая ярость
  6: 'kostyanoe-kopye',     // Зелёная стрела
  7: 'infernalnyy-prizyv',  // Огонь Душ
  8: 'zolotoy-prigovor',    // Кара еретика
  9: 'istochnik-sily',      // Страховой пункт — a sealed clause
  10: 'krovavyy-ritual',    // Расписка о рисках — paid in blood
  11: 'voy-pustoty',        // Гимн гильдии
  12: 'razrushitel',        // Взыскание
  13: 'prizyv-upyrya',      // Нестабильный призыв
};

// Talents already share one icon per effect type across every tree, so the
// art follows that same grammar instead of being assigned per talent.
export const TALENT_ART: Partial<Record<IconName, SkillArtId>> = {
  'sword': 'adskiy-razrez',
  'first-aid-kit': 'proklyatie-sveta',
  'shield-chevron': 'duh-predkov',
  'shield': 'ledyanoy-plen',
  'target': 'arkannye-svyazi',
  'fire': 'adskiy-shtorm',
  'snowflake': 'ledyanoy-vzryv',
};
