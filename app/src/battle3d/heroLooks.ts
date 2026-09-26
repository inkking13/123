// How each hero looks as a low-poly figure — picked from their portrait:
// build, skin/hair, outfit colours, head details, weapon and off-hand.

export type Build = 'human' | 'dwarf' | 'orc' | 'elf' | 'gnome';
export type Hair = 'short' | 'long' | 'mohawk' | 'none';
export type Beard = 'none' | 'short' | 'long';
export type HeadGear = 'none' | 'hood' | 'maskHood';
export type Outfit = 'plate' | 'robe' | 'leather' | 'bare';
export type Weapon = 'sword' | 'axe' | 'mace' | 'greatAxe' | 'greatHammer' | 'dagger' | 'staff' | 'bow' | 'flask' | 'orb';
export type OffHand = 'none' | 'roundShield' | 'kiteShield' | 'towerShield' | 'dagger' | 'flask';

export interface HeroLook {
  build: Build;
  skin: string;
  hair: string;
  hairStyle: Hair;
  beard: Beard;
  ears?: 'pointed';
  horns?: boolean;
  headGear: HeadGear;
  outfit: Outfit;
  /** Main cloth/armour colour, secondary (belt, boots, trim) and metal. */
  primary: string;
  secondary: string;
  metal: string;
  cape?: string;
  weapon: Weapon;
  offHand: OffHand;
  /** Glow colour of staffs, orbs, flasks and enchanted blades. */
  glow?: string;
  shieldColor?: string;
  emblem?: string;
}

export const HERO_LOOKS: Record<number, HeroLook> = {
  // Каелен, инквизитор: седой, бронзовые латы, щит-башня и булава.
  0: { build: 'human', skin: '#d9a88a', hair: '#8f8a82', hairStyle: 'short', beard: 'short', headGear: 'none', outfit: 'plate',
    primary: '#8a6a42', secondary: '#4a3526', metal: '#c9a45c', cape: '#3a2a22', weapon: 'mace', offHand: 'towerShield', shieldColor: '#6b4a2e', emblem: '#d8b25a' },
  // Борин, воин-дварф: рыжая борода, стальные латы, круглый деревянный щит и топор.
  1: { build: 'dwarf', skin: '#e0a887', hair: '#b4502a', hairStyle: 'long', beard: 'long', headGear: 'none', outfit: 'plate',
    primary: '#6f7a86', secondary: '#4b3a2e', metal: '#aeb6bf', weapon: 'axe', offHand: 'roundShield', shieldColor: '#7a5230', emblem: '#aeb6bf' },
  // Фаэлар: эльф с бледно-зелёной кожей и белыми волосами, оливковый капюшон, посох с бирюзовым камнем.
  2: { build: 'elf', skin: '#a9c2a0', hair: '#e6ecd8', hairStyle: 'long', beard: 'none', ears: 'pointed', headGear: 'hood', outfit: 'robe',
    primary: '#55603c', secondary: '#3a3f2a', metal: '#8a7a52', weapon: 'staff', offHand: 'none', glow: '#5fe0d0' },
  // Тэдиус, алхимик: седая длинная борода, тёмный фартук, зелёные колбы.
  3: { build: 'human', skin: '#d6a98c', hair: '#b8b8b0', hairStyle: 'long', beard: 'long', headGear: 'none', outfit: 'leather',
    primary: '#3d4a4a', secondary: '#5a4632', metal: '#8a8f94', weapon: 'flask', offHand: 'flask', glow: '#6cff9a' },
  // Векс, ассасин: рога, чёрная маска-капюшон, тёмная кожа брони, красные клинки.
  4: { build: 'human', skin: '#8a3a3a', hair: '#1a1416', hairStyle: 'none', beard: 'none', horns: true, headGear: 'maskHood', outfit: 'leather',
    primary: '#2c2426', secondary: '#4a2e2a', metal: '#9a9ea4', weapon: 'dagger', offHand: 'dagger', glow: '#ff3a3a' },
  // Громмаш: орк, серо-зелёная кожа, чёрный ирокез, голый торс в ремнях, огромный топор.
  5: { build: 'orc', skin: '#7c8a6a', hair: '#1c1a1a', hairStyle: 'mohawk', beard: 'none', headGear: 'none', outfit: 'bare',
    primary: '#4a3226', secondary: '#2e2220', metal: '#9ca4ac', weapon: 'greatAxe', offHand: 'none' },
  // Сильвана: эльфийка-лучница, тёмные волосы, зелёный капюшон, лук с зелёной стрелой.
  6: { build: 'elf', skin: '#d8b49a', hair: '#2a2420', hairStyle: 'long', beard: 'none', ears: 'pointed', headGear: 'hood', outfit: 'leather',
    primary: '#3f5a42', secondary: '#3a2e24', metal: '#8a7a5a', cape: '#2f4a36', weapon: 'bow', offHand: 'none', glow: '#8cff5a' },
  // Элара, ведьма: бледная, длинные чёрные волосы, тёмный корсет, зелёная магия в руке.
  7: { build: 'elf', skin: '#e4d6cc', hair: '#141214', hairStyle: 'long', beard: 'none', headGear: 'none', outfit: 'robe',
    primary: '#26262a', secondary: '#3a4a48', metal: '#7a8a86', weapon: 'orb', offHand: 'none', glow: '#5aff8a' },
  // Родерик, паладин: сияющие латы, синий щит с золотым орлом, меч.
  8: { build: 'human', skin: '#dcae90', hair: '#6a4a30', hairStyle: 'short', beard: 'short', headGear: 'none', outfit: 'plate',
    primary: '#b8c4cc', secondary: '#5a4632', metal: '#dfe6ea', cape: '#2a3f7a', weapon: 'sword', offHand: 'kiteShield', shieldColor: '#2a4a8a', emblem: '#e0b84a' },
  // Освальд, наёмник-дварф: рыжая борода, стальные латы, двуручный молот.
  9: { build: 'dwarf', skin: '#dea486', hair: '#b04a24', hairStyle: 'short', beard: 'long', headGear: 'none', outfit: 'plate',
    primary: '#6a6e74', secondary: '#5a3a28', metal: '#b0b4b8', weapon: 'greatHammer', offHand: 'none' },
  // Ирма, полевой врач: светлые волосы, белое одеяние с золотом, посох с розовым кристаллом.
  10: { build: 'human', skin: '#ecc8a8', hair: '#e8c878', hairStyle: 'long', beard: 'none', headGear: 'none', outfit: 'robe',
    primary: '#efe6d2', secondary: '#c89a4a', metal: '#d8b25a', weapon: 'staff', offHand: 'none', glow: '#ff8ad8' },
  // Джаспер: гном в очках и кожаном фартуке, швыряет цветные колбы.
  11: { build: 'gnome', skin: '#d8a888', hair: '#6a4a36', hairStyle: 'short', beard: 'none', ears: 'pointed', headGear: 'none', outfit: 'leather',
    primary: '#6a4a36', secondary: '#4a5a4e', metal: '#9a8a6a', weapon: 'flask', offHand: 'flask', glow: '#c86aff' },
  // Гаррет, коллектор: меховой воротник, латы поверх кожи, топор.
  12: { build: 'human', skin: '#d0a086', hair: '#5a4230', hairStyle: 'long', beard: 'short', headGear: 'none', outfit: 'plate',
    primary: '#5a5450', secondary: '#4a3a2e', metal: '#a8aeb4', cape: '#6a5a48', weapon: 'axe', offHand: 'none' },
  // Мортана: тёмные волосы, лёгкая кожаная броня, огонь в ладони.
  13: { build: 'human', skin: '#e2b89c', hair: '#3a2a22', hairStyle: 'long', beard: 'none', headGear: 'none', outfit: 'leather',
    primary: '#8a7a6a', secondary: '#4a3a30', metal: '#9aa8b4', weapon: 'orb', offHand: 'none', glow: '#ff8a2a' },
};
