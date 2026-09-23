import { IconName } from '../components/Icon';

export interface ProfessionDef {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
  outputMult?: number;
  hpMult?: number;
  wardMult?: number;
  cdMult?: number;
}

// A one-time, permanent choice, independent of role and class — a mercenary's
// side trade rather than a combat build. Picked once on the Character screen,
// then trained up to PROFESSION_MAX_LEVEL on its own dedicated screen: the
// bonus below is the value at max skill, scaled down at lower levels.
export const PROFESSIONS: ProfessionDef[] = [
  {
    id: 'blacksmithing', name: 'Кузнечное дело',
    desc: 'Кузнец подгоняет собственные доспехи под себя: до +10% к максимальному HP на пике мастерства.',
    icon: 'shield-chevron', hpMult: 1.10,
  },
  {
    id: 'leatherworking', name: 'Кожевничество',
    desc: 'Лёгкая выделанная кожа не сковывает движений: до +8% к урону/лечению на пике мастерства.',
    icon: 'sword', outputMult: 1.08,
  },
  {
    id: 'jewelcrafting', name: 'Ювелирное дело',
    desc: 'Огранённые самоцветы в оправе гасят часть удара: до -8% к получаемому урону на пике мастерства.',
    icon: 'coins', wardMult: 0.92,
  },
  {
    id: 'enchanting', name: 'Зачарование',
    desc: 'Собственноручно зачарованное снаряжение быстрее восстанавливает силы: до -10% к перезарядке способности на пике мастерства.',
    icon: 'flame', cdMult: 0.90,
  },
  {
    id: 'alchemy', name: 'Алхимия',
    desc: 'Свои эликсиры прямо перед боем: до +5% к урону/лечению и -4% к получаемому урону на пике мастерства.',
    icon: 'flask', outputMult: 1.05, wardMult: 0.96,
  },
  {
    id: 'engineering', name: 'Инженерное дело',
    desc: 'Ручные гаджеты подстраховывают в бою: до +4% к максимальному HP и -6% к перезарядке способности на пике мастерства.',
    icon: 'gear', hpMult: 1.04, cdMult: 0.94,
  },
];

export const PROFESSION_MAX_LEVEL = 20;
export const PROFESSION_XP_PER_LEVEL = 40;

// Training cost in gold for the next skill-up click at the given current level.
export function professionTrainCost(level: number): number {
  return 8 + level * 3;
}

// Scales a profession's max-level multiplier down to what a given skill
// level actually grants — level 1 gives almost nothing, level MAX gives the
// full value declared on the ProfessionDef above.
export function scaledMult(fullMult: number | undefined, level: number): number {
  if (fullMult === undefined) return 1;
  const frac = Math.max(0, Math.min(1, (level - 1) / (PROFESSION_MAX_LEVEL - 1)));
  return 1 + (fullMult - 1) * frac;
}
