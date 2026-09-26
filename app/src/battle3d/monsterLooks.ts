import { MonsterArtId } from '../data/monsterArt';
import { HeroLook } from './heroLooks';
import { CreatureLook } from './CreatureModel';

// Every bestiary monster as a low-poly figure, matched to its portrait: the
// man-shaped ones reuse the hero rig (with monster extras), the rest use the
// creature rigs. `height` is the figure's rough standing height at scale 1.

export type MonsterLook = { humanoid: HeroLook; height: number } | { creature: CreatureLook; height: number };

const hum = (l: Partial<HeroLook> & Pick<HeroLook, 'skin' | 'primary'>, height = 1.2): MonsterLook => ({
  humanoid: {
    build: 'human', hair: '#1a1616', hairStyle: 'none', beard: 'none', headGear: 'none', outfit: 'bare',
    secondary: '#2a2224', metal: '#8a8e94', weapon: 'claws', offHand: 'none', ...l,
  },
  height,
});
const cre = (c: CreatureLook, height = 0.9): MonsterLook => ({ creature: c, height });

export const MONSTER_LOOKS: Record<MonsterArtId, MonsterLook> = {
  'blood-feathered-raptor': cre({ kind: 'bird', variant: 'raptor', body: '#4a4c52', wing: '#a8242a', beak: '#d8d0c0', eyes: '#ffd24a', crest: '#d02a30' }, 1.0),
  'blood-soaked-warden': hum({ build: 'orc', skin: '#8a2a24', primary: '#7a1a1a', secondary: '#3a1414', metal: '#5a3a3a', outfit: 'plate', horns: true, eyes: '#ff4a2a', weapon: 'mace', cape: '#4a0f12' }, 1.3),
  'bone-shard-golem': hum({ build: 'golem', skin: '#cbb89a', primary: '#b8a484', secondary: '#6a5a48', skeleton: true, eyes: '#ff5a2a', horns: true, weapon: 'claws' }, 1.5),
  'bone-weaver': hum({ build: 'elf', skin: '#d8d2c0', primary: '#cfc8b4', secondary: '#3a4a50', skeleton: true, eyes: '#5ae0ff', weapon: 'orb', glow: '#5ae0ff' }, 1.25),
  'carrion-rat-king': cre({ kind: 'beast', variant: 'rat', body: '#5a5a48', belly: '#c89a8a', eyes: '#ffd24a', riders: true }, 0.9),
  'chimera-corruptor': cre({ kind: 'beast', variant: 'lion', body: '#a8844a', belly: '#d8b880', eyes: '#ffd24a', mane: '#6a4222', horns: '#d8d0b8', tail: '#5a7a3a' }, 1.0),
  'chitinous-scorpiid': cre({ kind: 'spider', variant: 'scorpion', body: '#7a2e1c', legs: '#4a1c12', eyes: '#ffb03a' }, 0.8),
  'cinder-kin-fiend': hum({ build: 'imp', skin: '#c8421c', primary: '#8a2a14', secondary: '#3a1a10', horns: true, eyes: '#ffd24a', weapon: 'orb', glow: '#ff8a2a', cracks: '#ffb03a', ears: 'pointed' }, 1.0),
  'corrupted-ooze': cre({ kind: 'blob', variant: 'ooze', body: '#5ac83a', eyes: '#f0ff9a' }, 0.75),
  'crypt-lord': hum({ skin: '#d8d2c0', primary: '#2e3440', secondary: '#1c2028', metal: '#5a6474', outfit: 'plate', skeleton: true, eyes: '#5ab8ff', crown: '#8a9aaa', weapon: 'sword', cape: '#3a2a4a', emblem: '#8ab8ff' }, 1.25),
  'crystal-spiderling': cre({ kind: 'spider', variant: 'spider', body: '#8ac8f0', legs: '#5a9ac8', eyes: '#e8f8ff', crystals: '#c8ecff' }, 0.7),
  'darkwood-treant': hum({ build: 'golem', skin: '#5a4230', primary: '#4a3424', secondary: '#3a2a1c', leaves: '#3a5a2a', eyes: '#c8ff6a', hunch: 0.12 }, 1.55),
  'earth-breaker': hum({ build: 'golem', skin: '#3a2a24', primary: '#2e2220', secondary: '#1c1614', cracks: '#ff7a1a', eyes: '#ffb03a' }, 1.5),
  'feral-werewolf': hum({ build: 'orc', skin: '#5a5450', primary: '#4a4440', secondary: '#2e2826', wolfHead: true, eyes: '#ff4a3a', hunch: 0.2 }, 1.35),
  'fetid-swamp-thing': hum({ build: 'brute', skin: '#4a5a2a', primary: '#3a4a22', secondary: '#2a321a', eyes: '#d8ff5a', hunch: 0.18, leaves: '#5a6a2a' }, 1.35),
  'fungal-hive-mind': cre({ kind: 'blob', variant: 'fungus', body: '#c8b8a0', cap: '#b85a3a', eyes: '#6affe0', spots: '#6affe0' }, 1.0),
  'gloom-caster-specter': hum({ skin: '#6a5aa0', primary: '#4a3a7a', secondary: '#2a2050', headGear: 'hood', outfit: 'robe', ghost: true, eyes: '#c88aff', weapon: 'orb', glow: '#b86aff' }, 1.25),
  'gloom-stalker-wraith': hum({ skin: '#2a2e3a', primary: '#1c1f28', secondary: '#12141a', headGear: 'hood', outfit: 'robe', ghost: true, eyes: '#8adcff', weapon: 'claws', hunch: 0.15 }, 1.25),
  'grave-dust-ghoul': hum({ skin: '#8a8a70', primary: '#5a5444', secondary: '#3a342a', eyes: '#ffe06a', hunch: 0.35, weapon: 'claws', hairStyle: 'short', hair: '#5a5a4a' }, 1.1),
  'hive-mother': cre({ kind: 'spider', variant: 'spider', body: '#4a5a2a', legs: '#2a321a', eyes: '#d8ff5a', eggs: '#9aff5a', marks: '#c8ff4a' }, 0.9),
  'hollow-armor': hum({ skin: '#3a4048', primary: '#3a404a', secondary: '#22262c', metal: '#4a5260', outfit: 'plate', headless: true, eyes: '#5ab8ff', weapon: 'sword', cracks: '#5ab8ff' }, 1.25),
  'hooded-cultist': hum({ skin: '#c8a890', primary: '#3a2450', secondary: '#1c1428', headGear: 'hood', outfit: 'robe', eyes: '#ff4a6a', weapon: 'staff', glow: '#c86aff' }, 1.2),
  'iron-bound-colossus': hum({ build: 'golem', skin: '#6a4a36', primary: '#7a5a42', secondary: '#3a2a20', metal: '#8a6a4a', outfit: 'plate', eyes: '#ffa03a', weapon: 'claws' }, 1.55),
  'lich-librarian': hum({ build: 'elf', skin: '#d8d2c0', primary: '#2a3a5a', secondary: '#1a2238', skeleton: true, outfit: 'robe', eyes: '#8ae0ff', crown: '#8a9aaa', weapon: 'orb', glow: '#8ae0ff' }, 1.25),
  'lord-of-flies': hum({ build: 'brute', skin: '#6a7a3a', primary: '#4a5a2a', secondary: '#3a3a22', horns: true, eyes: '#ffd24a', flies: true, weapon: 'claws' }, 1.35),
  'plague-bringer': hum({ build: 'brute', skin: '#7a7a3a', primary: '#5a5a2a', secondary: '#3a3222', horns: true, eyes: '#ffb03a', flies: true, wings: '#4a3a2a', weapon: 'claws' }, 1.35),
  'rot-carcass-scavenger': cre({ kind: 'bird', variant: 'vulture', body: '#5a3e30', wing: '#3e2a22', beak: '#c8b890', eyes: '#d8ff5a', head: '#c88a7a' }, 0.9),
  'shadow-silk-weaver': cre({ kind: 'spider', variant: 'spider', body: '#1e2240', legs: '#12142a', eyes: '#8adcff', marks: '#6a8aff' }, 0.75),
  'shadow-weaver-sprite': cre({ kind: 'sprite', body: '#2a1e40', wing: '#6a3aa0', eyes: '#ff8aff', spots: '#e08aff' }, 0.95),
  'shadow-wolf': cre({ kind: 'beast', variant: 'wolf', body: '#2e3038', belly: '#4a4c56', eyes: '#ff3a3a' }, 0.8),
  'star-gazer-dragon': cre({ kind: 'dragon', body: '#1e2a5a', wing: '#2e3a7a', belly: '#3a4a8a', eyes: '#ffe08a', horns: '#c8d0e8', stars: '#aee0ff' }, 1.1),
  'storm-crow': cre({ kind: 'bird', variant: 'crow', body: '#1a2030', wing: '#22304a', beak: '#3a4250', eyes: '#8adcff' }, 1.0),
  'storm-wrought-golem': hum({ build: 'golem', skin: '#6a7280', primary: '#5a626e', secondary: '#3a4048', metal: '#8a94a4', outfit: 'plate', cracks: '#8adcff', eyes: '#aeeaff' }, 1.55),
  'sunken-tyrant': hum({ build: 'orc', skin: '#4a8a8a', primary: '#3a6a6a', secondary: '#2a4a4a', metal: '#d8b25a', hair: '#1c4a44', hairStyle: 'long', beard: 'long', crown: '#d8b25a', fishTail: '#2e7a6a', weapon: 'trident', eyes: '#aefff0' }, 1.35),
  'void-serpent': cre({ kind: 'serpent', variant: 'snake', body: '#1e1640', belly: '#3a2a6a', eyes: '#c88aff', glow: '#a86aff' }, 0.9),
  'void-spawn-parasite': cre({ kind: 'serpent', variant: 'worm', body: '#b87a8a', belly: '#e8c0c0', eyes: '#ffffff' }, 0.8),
  'weaver-of-dreams': cre({ kind: 'spider', variant: 'spider', body: '#2a1a3a', legs: '#1a1026', eyes: '#e08aff', marks: '#b86aff' }, 0.8),
  'wyrm-of-the-wasteland': cre({ kind: 'serpent', variant: 'wyrm', body: '#b8904a', belly: '#e0c88a', eyes: '#ff8a2a', spikes: '#7a5a2a' }, 0.9),
};

/** Arena rivals are another guild's champion — a dark knight, not a monster. */
export const ARENA_CHAMPION: MonsterLook = hum({
  skin: '#d0a086', hair: '#2a2020', hairStyle: 'short', beard: 'short', primary: '#3a3440', secondary: '#241f28', metal: '#8a8494',
  outfit: 'plate', weapon: 'greatAxe', cape: '#6a1a24', eyes: '#ff5a4a',
}, 1.25);
