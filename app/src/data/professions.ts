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
// it grants a small passive bonus for the rest of the campaign.
export const PROFESSIONS: ProfessionDef[] = [
  {
    id: 'blacksmithing', name: 'Кузнечное дело',
    desc: 'Кузнец подгоняет собственные доспехи под себя: +10% к максимальному HP.',
    icon: 'shield-chevron', hpMult: 1.10,
  },
  {
    id: 'leatherworking', name: 'Кожевничество',
    desc: 'Лёгкая выделанная кожа не сковывает движений: +8% к урону/лечению.',
    icon: 'sword', outputMult: 1.08,
  },
  {
    id: 'jewelcrafting', name: 'Ювелирное дело',
    desc: 'Огранённые самоцветы в оправе гасят часть удара: -8% к получаемому урону.',
    icon: 'coins', wardMult: 0.92,
  },
  {
    id: 'enchanting', name: 'Зачарование',
    desc: 'Собственноручно зачарованное снаряжение быстрее восстанавливает силы: -10% к перезарядке способности.',
    icon: 'flame', cdMult: 0.90,
  },
  {
    id: 'alchemy', name: 'Алхимия',
    desc: 'Свои эликсиры прямо перед боем: +5% к урону/лечению и -4% к получаемому урону.',
    icon: 'flask', outputMult: 1.05, wardMult: 0.96,
  },
  {
    id: 'engineering', name: 'Инженерное дело',
    desc: 'Ручные гаджеты подстраховывают в бою: +4% к максимальному HP и -6% к перезарядке способности.',
    icon: 'gear', hpMult: 1.04, cdMult: 0.94,
  },
];
