import { WandererModel } from './WandererModel';
import { BODIES, meshyModel } from './MeshyModel';

/** Approximate standing height of each low-poly build, for anchoring HP bars and framing cameras. */
export const MODEL_HEIGHT = { human: 1.12, dwarf: 0.92, orc: 1.26, elf: 1.2, gnome: 0.95, brute: 1.35, golem: 1.5, imp: 0.95 } as const;

/** Heroes drawn with a sheet-built model instead of the generic rig. */
export const SHEET_MODELS: Record<number, { height: number; Model: typeof WandererModel; dance?: boolean }> = {
  5: { height: BODIES.orc.height, Model: meshyModel(5, 'orc'), dance: true }, // Громмаш, секира, на риге Meshy
  // Meshy race base bodies with their own animation clips.
  0: { height: BODIES.human.height, Model: meshyModel(0, 'human', { act: { melee: 'Sword_Slash', ability: 'Shield_Push' } }), dance: true }, // Каелен, булава и щит-башня
  1: { height: BODIES.dwarf.height, Model: meshyModel(1, 'dwarf', { weapon: 'runeAxe', act: { melee: 'Hammer_Swing', ability: 'Shield_Push' } }), dance: true }, // Борин, рунный топор
  3: { height: BODIES.human.height, Model: meshyModel(3, 'human', { act: { ability: 'cast2', melee: 'cast3' } }), dance: true }, // Тэдиус
  8: { height: BODIES.human.height, Model: meshyModel(8, 'human', { act: { melee: 'Thrust_Slash', ability: 'Shield_Push' } }), dance: true }, // Родерик, меч и щит
  6: { height: BODIES.elf.height, Model: meshyModel(6, 'elf', { act: { default: 'Archery_Shot', ranged: 'Archery_Shot' } }), dance: true }, // Сильвана, лук
  7: { height: BODIES.elf.height, Model: meshyModel(7, 'elf', { act: { ability: 'cast2', heal: 'cast1', ranged: 'cast6', rally: 'cast4' } }), dance: true }, // Элара, ведьма
  // The rest on the nearest existing Meshy body.
  2: { height: BODIES.elfMale.height, Model: meshyModel(2, 'elfMale', { act: { default: 'mage_soell_cast_1', melee: 'mage_soell_cast_3', ability: 'Charged_Spell_Cast', ranged: 'mage_soell_cast_6', heal: 'mage_soell_cast_4', rally: 'mage_soell_cast_7' } }), dance: true }, // Фаэлар, эльф с посохом, на мужском эльфе Meshy
  9: { height: BODIES.dwarf.height, Model: meshyModel(9, 'dwarf', { act: { default: 'Hammer_Swing', ability: 'Charged_Slash' } }), dance: true }, // Освальд, двуручный молот
  10: { height: BODIES.elf.height, Model: meshyModel(10, 'elf', { act: { default: 'cast1', ability: 'cast2', rally: 'cast4' } }), dance: true }, // Ирма, полевой врач
  11: { height: BODIES.dwarf.height, Model: meshyModel(11, 'dwarf'), dance: true }, // Джаспер, гном с колбами
  12: { height: BODIES.human.height, Model: meshyModel(12, 'human', { act: { melee: 'Sword_Slash', ability: 'Charged_Slash' } }), dance: true }, // Гаррет, топор
  4: { height: BODIES.human.height, Model: meshyModel(4, 'human', { act: { default: 'Double_Combo_Attack', ability: 'Triple_Combo_Attack' } }), dance: true }, // Векс, два кинжала
  13: { height: BODIES.elf.height, Model: meshyModel(13, 'elf', { act: { ability: 'Ground_Slam', ranged: 'cast6', heal: 'cast1', rally: 'cast4' } }), dance: true }, // Мортана, огонь в ладони
};
