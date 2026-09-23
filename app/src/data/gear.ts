import { GearOption, GearSlotKey } from './types';

export interface LootDrop {
  slot: GearSlotKey;
  gearId: string;
}

export const GEAR: Record<GearSlotKey, GearOption[]> = {
  weapon: [
    { id: 'none', name: 'Без оружия', mult: 1, desc: 'Никаких бонусов.' },
    { id: 'w1', name: 'Верный клинок', mult: 1.10, desc: '+10% к урону/лечению.', icon: 'ostryy-stilet', price: 40 },
    { id: 'w2', name: 'Клинок павшего чемпиона', mult: 1.20, desc: '+20% к урону/лечению.', icon: 'proklyataya-rapira', price: 90 },
    { id: 'w3', name: 'Кровопийца Гроблота', mult: 1.32, hpMult: 0.90, desc: '+32% к урону/лечению, но -10% к HP.', icon: 'proklyatyy-mech', price: 160 },
    { id: 'w4', name: 'Посох Некроманта', mult: 1.18, desc: '+18% к урону/лечению.', icon: 'posoh-nekromanta', price: 110 },
    { id: 'w5', name: 'Коса Жнеца', mult: 1.42, desc: '+42% к урону/лечению.', icon: 'kosa-zhnetsa', price: 220 },
    { id: 'uw-wastes', name: 'Топор Вожака Свалки', mult: 1.46, desc: '+46% к урону/лечению. Трофей с Вожака Свалки.', icon: 'topor-bezumnogo-vozhdya' },
    { id: 'uw-frostpass', name: 'Топор Тролля-Исполина', mult: 1.52, desc: '+52% к урону/лечению. Трофей с Тролля-Исполина Перевала.', icon: 'boevoy-topor' },
    { id: 'uw-charfields', name: 'Осколок Косы Пепельного Жнеца', mult: 1.60, desc: '+60% к урону/лечению. Трофей с Пепельного Жнеца.', icon: 'oskolok-kosy-zhnetsa-dush' },
    { id: 'uw-mortgagedfarms', name: 'Цеп Управляющего Фермами', mult: 1.68, desc: '+68% к урону/лечению. Трофей с Управляющего Фермами.', icon: 'shipastyy-tsep' },
    { id: 'uw-blackmarket', name: 'Кинжал Хозяина Рынка', mult: 1.78, desc: '+78% к урону/лечению. Трофей с Хозяина Рынка.', icon: 'yadovityy-kinzhal' },
    { id: 'uw-unmarkedgraves', name: 'Заступ-Реликвия Могильщика', mult: 1.90, desc: '+90% к урону/лечению. Трофей с Могильщика Легиона.', icon: 'oskolki-posoha-haosa' },
    { id: 'uw-burntcliffs', name: 'Коготь Ящера-Патриарха', mult: 2.05, desc: '+105% к урону/лечению. Трофей с Ящера-Патриарха.', icon: 'kogot-tvari-bezdny' },
    { id: 'uw-shareholderfloor', name: 'Гримуар Директора по Персоналу', mult: 2.25, desc: '+125% к урону/лечению. Трофей с Директора по Персоналу Бездны.', icon: 'grimuar-proklyatyh-klyuchey' },
  ],
  armor: [
    { id: 'none', name: 'Без брони', hpMult: 1, desc: 'Никаких бонусов.' },
    { id: 'a1', name: 'Кожаный нагрудник', hpMult: 1.10, desc: '+10% к HP.', icon: 'proklyatyy-nagrudnik', price: 40 },
    { id: 'a2', name: 'Кольчуга ветерана', hpMult: 1.20, desc: '+20% к HP.', icon: 'shlem-padshego-rytsarya', price: 90 },
    { id: 'a3', name: 'Плита Несокрушимости', hpMult: 1.32, mult: 0.90, desc: '+32% к HP, но -10% к урону/лечению.', icon: 'goticheskiy-schit', price: 160 },
    { id: 'a4', name: 'Шлем с Шипами', hpMult: 1.24, desc: '+24% к HP.', icon: 'shlem-s-shipami', price: 120 },
    { id: 'a5', name: 'Наплечники Падшего Паладина', hpMult: 1.44, desc: '+44% к HP.', icon: 'naplechniki-padshego-paladina', price: 230 },
    { id: 'ua-road', name: 'Плащ Атамана Тракта', hpMult: 1.48, desc: '+48% к HP. Трофей с Атамана Тракта.', icon: 'voroniy-plasch' },
    { id: 'ua-wolfrifts', name: 'Наплечники из Костей Стаи', hpMult: 1.55, desc: '+55% к HP. Трофей с Матери Стаи.', icon: 'kostyanye-naplechniki' },
    { id: 'ua-parishruins', name: 'Лик Настоятеля Руин', hpMult: 1.62, desc: '+62% к HP. Трофей с Настоятеля Руин.', icon: 'litso-verhovnogo-zhretsa' },
    { id: 'ua-debtorsjail', name: 'Перчатки Начальника Тюрьмы', hpMult: 1.70, desc: '+70% к HP. Трофей с Начальника Тюрьмы.', icon: 'kogtistye-perchatki' },
    { id: 'ua-smugglercatacombs', name: 'Вуаль Смотрителя Катакомб', hpMult: 1.80, desc: '+80% к HP. Трофей со Смотрителя Катакомб.', icon: 'vual-nochnogo-stalkera' },
    { id: 'ua-desertersfort', name: 'Герб Полковника-Отступника', hpMult: 1.92, desc: '+92% к HP. Трофей с Полковника-Отступника.', icon: 'gerb-bessmertnogo-rytsarya' },
    { id: 'ua-wyvernlair', name: 'Чешуя Королевы Виверн', hpMult: 2.05, desc: '+105% к HP. Трофей с Королевы Виверн.', icon: 'golova-drevnego-drakona' },
    { id: 'ua-councilantechamber', name: 'Маска Спикера Совета', hpMult: 2.25, desc: '+125% к HP. Трофей со Спикера Совета.', icon: 'maska-kultista' },
  ],
  trinket: [
    { id: 'none', name: 'Без амулета', desc: 'Никаких бонусов.' },
    { id: 't1', name: 'Оберег стойкости', wardMult: 0.88, desc: '-12% к получаемому урону.', icon: 'obereg-maga', price: 40 },
    { id: 't2', name: 'Часы мага', cdMult: 0.85, desc: '-15% к перезарядке способности.', icon: 'oko-tenevogo-maga', price: 100 },
    { id: 't3', name: 'Кровавый гранат', mult: 1.08, wardMult: 1.10, desc: '+8% к урону/лечению, но +10% к получаемому урону.', icon: 'yadro-magmaticheskogo-golema', price: 110 },
    { id: 't4', name: 'Алхимический Пояс', cdMult: 0.82, desc: '-18% к перезарядке способности.', icon: 'alhimicheskiy-poyas', price: 130 },
    { id: 't5', name: 'Кольцо Мертвеца', mult: 1.14, desc: '+14% к урону/лечению.', icon: 'koltso-mertvetsa', price: 150 },
    { id: 'ut-groblot', name: 'Череп из Логова Гроблота', cdMult: 0.80, desc: '-20% к перезарядке способности. Трофей с Гроблота Пожирателя.', icon: 'zagadochnyy-cherep' },
    { id: 'ut-icepeaks', name: 'Корона Ярла Ледяного Пепла', wardMult: 0.82, desc: '-18% к получаемому урону. Трофей с Ярла Ледяного Пепла.', icon: 'korona-padshego-korolya' },
    { id: 'ut-ashen', name: 'Кадило Кардинала Пепла', mult: 1.20, desc: '+20% к урону/лечению. Трофей с Кардинала Пепла.', icon: 'temnoe-kadilo' },
    { id: 'ut-mines', name: 'Мешочек Золота Ростовщика', cdMult: 0.75, desc: '-25% к перезарядке способности. Трофей с Ростовщика Коронного.', icon: 'meshochek-zolota' },
    { id: 'ut-nightsyndicate', name: 'Маска Барона Полуночи', wardMult: 0.75, desc: '-25% к получаемому урону. Трофей с Барона Полуночи.', icon: 'maska-bezlikogo' },
    { id: 'ut-deadlegion', name: 'Стяг Генерала без Имени', mult: 1.28, wardMult: 1.06, desc: '+28% к урону/лечению, но +6% к получаемому урону. Трофей с Генерала без Имени.', icon: 'styag-armii-mertyh' },
    { id: 'ut-ancientpeak', name: 'Рога Пирокластона', cdMult: 0.68, desc: '-32% к перезарядке способности. Трофей с Пирокластона.', icon: 'roga-povelitelya-ada' },
    { id: 'ut-boardroom', name: 'Ядро Держателя Контрольного Пакета', mult: 1.35, wardMult: 1.08, desc: '+35% к урону/лечению, но +8% к получаемому урону. Трофей с Держателя Контрольного Пакета.', icon: 'yadro-zhertvennogo-altarya' },
  ],
};

// Guaranteed unique drop on a dungeon's FIRST boss kill — one weapon, one
// armor and one trinket per location, cycling through that location's three
// dungeons so every single boss (not just the anchor ones) is worth farming.
export const UNIQUE_BOSS_LOOT: Record<string, LootDrop> = {
  wastes: { slot: 'weapon', gearId: 'uw-wastes' },
  road: { slot: 'armor', gearId: 'ua-road' },
  groblot: { slot: 'trinket', gearId: 'ut-groblot' },
  frostpass: { slot: 'weapon', gearId: 'uw-frostpass' },
  wolfrifts: { slot: 'armor', gearId: 'ua-wolfrifts' },
  icepeaks: { slot: 'trinket', gearId: 'ut-icepeaks' },
  charfields: { slot: 'weapon', gearId: 'uw-charfields' },
  parishruins: { slot: 'armor', gearId: 'ua-parishruins' },
  ashen: { slot: 'trinket', gearId: 'ut-ashen' },
  mortgagedfarms: { slot: 'weapon', gearId: 'uw-mortgagedfarms' },
  debtorsjail: { slot: 'armor', gearId: 'ua-debtorsjail' },
  mines: { slot: 'trinket', gearId: 'ut-mines' },
  blackmarket: { slot: 'weapon', gearId: 'uw-blackmarket' },
  smugglercatacombs: { slot: 'armor', gearId: 'ua-smugglercatacombs' },
  nightsyndicate: { slot: 'trinket', gearId: 'ut-nightsyndicate' },
  unmarkedgraves: { slot: 'weapon', gearId: 'uw-unmarkedgraves' },
  desertersfort: { slot: 'armor', gearId: 'ua-desertersfort' },
  deadlegion: { slot: 'trinket', gearId: 'ut-deadlegion' },
  burntcliffs: { slot: 'weapon', gearId: 'uw-burntcliffs' },
  wyvernlair: { slot: 'armor', gearId: 'ua-wyvernlair' },
  ancientpeak: { slot: 'trinket', gearId: 'ut-ancientpeak' },
  shareholderfloor: { slot: 'weapon', gearId: 'uw-shareholderfloor' },
  councilantechamber: { slot: 'armor', gearId: 'ua-councilantechamber' },
  boardroom: { slot: 'trinket', gearId: 'ut-boardroom' },
};

// Sell price at the trader — half the buy price, rounded down.
export const SELL_RATIO = 0.5;

export const SLOT_LABEL: Record<GearSlotKey, string> = {
  weapon: 'Оружие',
  armor: 'Броня',
  trinket: 'Амулет',
};

export const SLOT_ORDER: GearSlotKey[] = ['weapon', 'armor', 'trinket'];

// Starting stash — the guild owns exactly one of each, so the very first
// gearing decision (who gets it) already matters.
export const STARTING_INVENTORY: Record<string, number> = { w1: 1, a1: 1, t1: 1 };

// Boss kills drop from the rarer tiers — a real, ownable item added to the
// guild's shared inventory, not an infinite catalog entry.
export const BOSS_LOOT_TABLE: LootDrop[] = [
  { slot: 'weapon', gearId: 'w2' },
  { slot: 'weapon', gearId: 'w3' },
  { slot: 'weapon', gearId: 'w4' },
  { slot: 'weapon', gearId: 'w5' },
  { slot: 'armor', gearId: 'a2' },
  { slot: 'armor', gearId: 'a3' },
  { slot: 'armor', gearId: 'a4' },
  { slot: 'armor', gearId: 'a5' },
  { slot: 'trinket', gearId: 't2' },
  { slot: 'trinket', gearId: 't3' },
  { slot: 'trinket', gearId: 't4' },
  { slot: 'trinket', gearId: 't5' },
];

// Regular room fights have a chance at a single common-tier drop off the
// slain trash mobs — smaller and less certain than a boss kill's guaranteed
// rare loot.
export const TRASH_LOOT_TABLE: LootDrop[] = [
  { slot: 'weapon', gearId: 'w1' },
  { slot: 'armor', gearId: 'a1' },
  { slot: 'trinket', gearId: 't1' },
];
export const TRASH_LOOT_CHANCE = 0.55;
