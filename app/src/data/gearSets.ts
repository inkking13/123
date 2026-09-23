export interface SetBonusDef {
  desc: string;
  outputMult?: number;
  hpMult?: number;
  wardMult?: number;
  cdMult?: number;
}

export interface GearSetDef {
  id: string;
  name: string;
  weapon: string;
  armor: string;
  trinket: string;
  bonus2: SetBonusDef;
  bonus3: SetBonusDef;
}

// Each location's three unique boss trophies (weapon+armor+trinket) double
// as a gear set — a reason to commit to one location's loot instead of
// always mixing in the raw best-in-slot piece from elsewhere.
export const GEAR_SETS: GearSetDef[] = [
  {
    id: 'outskirts', name: 'Снаряжение Пустошей',
    weapon: 'uw-wastes', armor: 'ua-road', trinket: 'ut-groblot',
    bonus2: { desc: '+4% к урону/лечению', outputMult: 1.04 },
    bonus3: { desc: '+6% к максимальному HP', hpMult: 1.06 },
  },
  {
    id: 'icefrontier', name: 'Ледяное Снаряжение',
    weapon: 'uw-frostpass', armor: 'ua-wolfrifts', trinket: 'ut-icepeaks',
    bonus2: { desc: '+5% к урону/лечению', outputMult: 1.05 },
    bonus3: { desc: '+7% к максимальному HP', hpMult: 1.07 },
  },
  {
    id: 'ashlands', name: 'Пепельное Облачение',
    weapon: 'uw-charfields', armor: 'ua-parishruins', trinket: 'ut-ashen',
    bonus2: { desc: '+6% к урону/лечению', outputMult: 1.06 },
    bonus3: { desc: '+8% к максимальному HP', hpMult: 1.08 },
  },
  {
    id: 'debtprovince', name: 'Комплект Должника',
    weapon: 'uw-mortgagedfarms', armor: 'ua-debtorsjail', trinket: 'ut-mines',
    bonus2: { desc: '-8% к перезарядке способности', cdMult: 0.92 },
    bonus3: { desc: '+6% к урону/лечению', outputMult: 1.06 },
  },
  {
    id: 'shadowguild', name: 'Облачение Тени',
    weapon: 'uw-blackmarket', armor: 'ua-smugglercatacombs', trinket: 'ut-nightsyndicate',
    bonus2: { desc: '-6% к получаемому урону', wardMult: 0.94 },
    bonus3: { desc: '+8% к урону/лечению', outputMult: 1.08 },
  },
  {
    id: 'forgottenlegion', name: 'Доспехи Забытого Легиона',
    weapon: 'uw-unmarkedgraves', armor: 'ua-desertersfort', trinket: 'ut-deadlegion',
    bonus2: { desc: '+8% к урону/лечению', outputMult: 1.08 },
    bonus3: { desc: '+10% к максимальному HP', hpMult: 1.10 },
  },
  {
    id: 'dragonwastes', name: 'Драконье Снаряжение',
    weapon: 'uw-burntcliffs', armor: 'ua-wyvernlair', trinket: 'ut-ancientpeak',
    bonus2: { desc: '+9% к максимальному HP', hpMult: 1.09 },
    bonus3: { desc: '-10% к перезарядке способности', cdMult: 0.90 },
  },
  {
    id: 'hierarchy', name: 'Регалии Совета',
    weapon: 'uw-shareholderfloor', armor: 'ua-councilantechamber', trinket: 'ut-boardroom',
    bonus2: { desc: '+10% к урону/лечению', outputMult: 1.10 },
    bonus3: { desc: '-10% к получаемому урону', wardMult: 0.90 },
  },
];
