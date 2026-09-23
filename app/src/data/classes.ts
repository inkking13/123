import { Role } from './types';

export interface ClassDef {
  id: string;
  name: string;
  desc: string;
  outputMult?: number;
  hpMult?: number;
  wardMult?: number;
}

// A one-time, permanent choice made the moment a mercenary joins a raid for
// the first time — independent of the level-gated talent tree. Doesn't touch
// each character's personal signature ability or backstory, just their
// underlying build within their fixed role.
export const CLASSES: Record<Role, [ClassDef, ClassDef]> = {
  tank: [
    {
      id: 'guardian', name: 'Страж',
      desc: '+15% к максимальному HP и -10% к получаемому урону, но -10% к урону.',
      hpMult: 1.15, wardMult: 0.90, outputMult: 0.90,
    },
    {
      id: 'berserker', name: 'Берсерк',
      desc: '+20% к урону, но -12% к максимальному HP.',
      outputMult: 1.20, hpMult: 0.88,
    },
  ],
  heal: [
    {
      id: 'priest', name: 'Жрец',
      desc: '+18% к лечению, но -10% к максимальному HP.',
      outputMult: 1.18, hpMult: 0.90,
    },
    {
      id: 'warden', name: 'Хранитель',
      desc: '+15% к максимальному HP, но -10% к лечению.',
      hpMult: 1.15, outputMult: 0.90,
    },
  ],
  dps: [
    {
      id: 'duelist', name: 'Дуэлянт',
      desc: '+18% к урону, но -10% к максимальному HP.',
      outputMult: 1.18, hpMult: 0.90,
    },
    {
      id: 'brawler', name: 'Костолом',
      desc: '+15% к максимальному HP, но -8% к урону.',
      hpMult: 1.15, outputMult: 0.92,
    },
  ],
};
