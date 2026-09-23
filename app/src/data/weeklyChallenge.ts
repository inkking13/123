export interface WeeklyModifierDef {
  id: string;
  name: string;
  desc: string;
  hpMult: number;
  dmgMult: number;
  goldMult: number;
  bonusReagentQty: number;
  guaranteedCurio: boolean;
  extraLootRoll: boolean;
}

// A rotating "affix" on a boss re-fight — same idea as the game's other
// one-way choices, but weekly instead of permanent. Every modifier trades
// a harder fight for a proportionally better payout, so none is a trap pick.
export const WEEKLY_MODIFIERS: WeeklyModifierDef[] = [
  {
    id: 'audit', name: 'Аудит эффективности',
    desc: '+35% к HP босса — зато +60% к золоту с победы.',
    hpMult: 1.35, dmgMult: 1.0, goldMult: 1.6, bonusReagentQty: 0, guaranteedCurio: false, extraLootRoll: false,
  },
  {
    id: 'deadline', name: 'Горящий дедлайн',
    desc: '+25% к урону способностей босса — зато гарантированно +2 реагента.',
    hpMult: 1.0, dmgMult: 1.25, goldMult: 1.2, bonusReagentQty: 2, guaranteedCurio: false, extraLootRoll: false,
  },
  {
    id: 'overtime', name: 'Сверхурочная смена',
    desc: '+20% к HP босса — зато гарантированная диковина за победу.',
    hpMult: 1.2, dmgMult: 1.0, goldMult: 1.15, bonusReagentQty: 0, guaranteedCurio: true, extraLootRoll: false,
  },
  {
    id: 'inspection', name: 'Внеплановая проверка',
    desc: '+20% к урону способностей босса — зато лишний трофей в добыче.',
    hpMult: 1.0, dmgMult: 1.2, goldMult: 1.2, bonusReagentQty: 0, guaranteedCurio: false, extraLootRoll: true,
  },
  {
    id: 'cost-cutting', name: 'Оптимизация расходов',
    desc: '+15% к HP и +15% к урону босса — зато x2 к золоту и реагентам.',
    hpMult: 1.15, dmgMult: 1.15, goldMult: 2.0, bonusReagentQty: 2, guaranteedCurio: false, extraLootRoll: false,
  },
];

function seededRand(key: string) {
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
}

export function pickWeeklyModifier(weekKey: string): WeeklyModifierDef {
  const rand = seededRand(weekKey + ':modifier');
  return WEEKLY_MODIFIERS[Math.floor(rand() * WEEKLY_MODIFIERS.length)];
}

/** Deterministic pick among the dungeons the guild has already cleared — this is endgame replay content, not a progression gate. */
export function pickWeeklyDungeonId(weekKey: string, clearedIds: string[]): string | null {
  if (!clearedIds.length) return null;
  const rand = seededRand(weekKey + ':dungeon');
  return clearedIds[Math.floor(rand() * clearedIds.length)];
}
