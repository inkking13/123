import { EnemyRole } from '../combat/types';

// Portraits cropped from the uploaded "Decay & Doom" bestiary sheets.
export type MonsterArtId =
  | 'blood-feathered-raptor'
  | 'blood-soaked-warden'
  | 'bone-shard-golem'
  | 'bone-weaver'
  | 'carrion-rat-king'
  | 'chimera-corruptor'
  | 'chitinous-scorpiid'
  | 'cinder-kin-fiend'
  | 'corrupted-ooze'
  | 'crypt-lord'
  | 'crystal-spiderling'
  | 'darkwood-treant'
  | 'earth-breaker'
  | 'feral-werewolf'
  | 'fetid-swamp-thing'
  | 'fungal-hive-mind'
  | 'gloom-caster-specter'
  | 'gloom-stalker-wraith'
  | 'grave-dust-ghoul'
  | 'hive-mother'
  | 'hollow-armor'
  | 'hooded-cultist'
  | 'iron-bound-colossus'
  | 'lich-librarian'
  | 'lord-of-flies'
  | 'plague-bringer'
  | 'rot-carcass-scavenger'
  | 'shadow-silk-weaver'
  | 'shadow-weaver-sprite'
  | 'shadow-wolf'
  | 'star-gazer-dragon'
  | 'storm-crow'
  | 'storm-wrought-golem'
  | 'sunken-tyrant'
  | 'void-serpent'
  | 'void-spawn-parasite'
  | 'weaver-of-dreams'
  | 'wyrm-of-the-wasteland';

export const MONSTER_ART: Record<MonsterArtId, any> = {
  'blood-feathered-raptor': require('../../assets/monsters/blood-feathered-raptor.jpg'),
  'blood-soaked-warden': require('../../assets/monsters/blood-soaked-warden.jpg'),
  'bone-shard-golem': require('../../assets/monsters/bone-shard-golem.jpg'),
  'bone-weaver': require('../../assets/monsters/bone-weaver.jpg'),
  'carrion-rat-king': require('../../assets/monsters/carrion-rat-king.jpg'),
  'chimera-corruptor': require('../../assets/monsters/chimera-corruptor.jpg'),
  'chitinous-scorpiid': require('../../assets/monsters/chitinous-scorpiid.jpg'),
  'cinder-kin-fiend': require('../../assets/monsters/cinder-kin-fiend.jpg'),
  'corrupted-ooze': require('../../assets/monsters/corrupted-ooze.jpg'),
  'crypt-lord': require('../../assets/monsters/crypt-lord.jpg'),
  'crystal-spiderling': require('../../assets/monsters/crystal-spiderling.jpg'),
  'darkwood-treant': require('../../assets/monsters/darkwood-treant.jpg'),
  'earth-breaker': require('../../assets/monsters/earth-breaker.jpg'),
  'feral-werewolf': require('../../assets/monsters/feral-werewolf.jpg'),
  'fetid-swamp-thing': require('../../assets/monsters/fetid-swamp-thing.jpg'),
  'fungal-hive-mind': require('../../assets/monsters/fungal-hive-mind.jpg'),
  'gloom-caster-specter': require('../../assets/monsters/gloom-caster-specter.jpg'),
  'gloom-stalker-wraith': require('../../assets/monsters/gloom-stalker-wraith.jpg'),
  'grave-dust-ghoul': require('../../assets/monsters/grave-dust-ghoul.jpg'),
  'hive-mother': require('../../assets/monsters/hive-mother.jpg'),
  'hollow-armor': require('../../assets/monsters/hollow-armor.jpg'),
  'hooded-cultist': require('../../assets/monsters/hooded-cultist.jpg'),
  'iron-bound-colossus': require('../../assets/monsters/iron-bound-colossus.jpg'),
  'lich-librarian': require('../../assets/monsters/lich-librarian.jpg'),
  'lord-of-flies': require('../../assets/monsters/lord-of-flies.jpg'),
  'plague-bringer': require('../../assets/monsters/plague-bringer.jpg'),
  'rot-carcass-scavenger': require('../../assets/monsters/rot-carcass-scavenger.jpg'),
  'shadow-silk-weaver': require('../../assets/monsters/shadow-silk-weaver.jpg'),
  'shadow-weaver-sprite': require('../../assets/monsters/shadow-weaver-sprite.jpg'),
  'shadow-wolf': require('../../assets/monsters/shadow-wolf.jpg'),
  'star-gazer-dragon': require('../../assets/monsters/star-gazer-dragon.jpg'),
  'storm-crow': require('../../assets/monsters/storm-crow.jpg'),
  'storm-wrought-golem': require('../../assets/monsters/storm-wrought-golem.jpg'),
  'sunken-tyrant': require('../../assets/monsters/sunken-tyrant.jpg'),
  'void-serpent': require('../../assets/monsters/void-serpent.jpg'),
  'void-spawn-parasite': require('../../assets/monsters/void-spawn-parasite.jpg'),
  'weaver-of-dreams': require('../../assets/monsters/weaver-of-dreams.jpg'),
  'wyrm-of-the-wasteland': require('../../assets/monsters/wyrm-of-the-wasteland.jpg'),
};

/** One portrait per boss, picked to match its description. */
export const BOSS_ART: Record<string, MonsterArtId> = {
  wastes: 'carrion-rat-king',
  road: 'chimera-corruptor',
  groblot: 'plague-bringer',
  frostpass: 'storm-wrought-golem',
  wolfrifts: 'feral-werewolf',
  icepeaks: 'crypt-lord',
  charfields: 'bone-weaver',
  parishruins: 'lich-librarian',
  ashen: 'earth-breaker',
  mortgagedfarms: 'fungal-hive-mind',
  debtorsjail: 'iron-bound-colossus',
  mines: 'lord-of-flies',
  blackmarket: 'hive-mother',
  smugglercatacombs: 'weaver-of-dreams',
  nightsyndicate: 'void-serpent',
  unmarkedgraves: 'storm-crow',
  desertersfort: 'bone-shard-golem',
  deadlegion: 'hollow-armor',
  burntcliffs: 'wyrm-of-the-wasteland',
  wyvernlair: 'blood-feathered-raptor',
  ancientpeak: 'star-gazer-dragon',
  shareholderfloor: 'gloom-caster-specter',
  councilantechamber: 'sunken-tyrant',
  boardroom: 'blood-soaked-warden',
};

/** Each location fields its own brute / archer / shaman in room fights. */
export const ROOM_ART: Record<string, Record<EnemyRole, MonsterArtId>> = {
  outskirts: { brute: 'rot-carcass-scavenger', archer: 'shadow-wolf', shaman: 'hooded-cultist' },
  icefrontier: { brute: 'darkwood-treant', archer: 'crystal-spiderling', shaman: 'gloom-stalker-wraith' },
  ashlands: { brute: 'cinder-kin-fiend', archer: 'grave-dust-ghoul', shaman: 'hooded-cultist' },
  debtprovince: { brute: 'chitinous-scorpiid', archer: 'shadow-silk-weaver', shaman: 'corrupted-ooze' },
  shadowguild: { brute: 'void-spawn-parasite', archer: 'shadow-weaver-sprite', shaman: 'gloom-caster-specter' },
  forgottenlegion: { brute: 'grave-dust-ghoul', archer: 'gloom-stalker-wraith', shaman: 'gloom-caster-specter' },
  dragonwastes: { brute: 'cinder-kin-fiend', archer: 'blood-feathered-raptor', shaman: 'fetid-swamp-thing' },
  hierarchy: { brute: 'void-spawn-parasite', archer: 'shadow-weaver-sprite', shaman: 'hooded-cultist' },
};
