export type Role = 'tank' | 'heal' | 'dps';
export type TraitId = 'steady' | 'novice' | 'egoist' | 'clicker' | 'legend' | 'ninjaLooter';
export type GearSlotKey = 'weapon' | 'armor' | 'trinket';
/** Melee must stand on the grid's front row to attack; ranged/healers can act from anywhere. */
export type AttackRange = 'melee' | 'ranged';

export interface CandidateDef {
  id: number;
  name: string;
  epithet: string;
  role: Role;
  attackRange: AttackRange;
  hp: number;
  dps: number;
  healPower?: number;
  gs: number;
  trait: TraitId;
  morale: number;
  bio: string;
  story: string;
  /** Gold cost to hire — present only for candidates who start unhired (data/characters.ts RECRUITS). */
  hireCost?: number;
}

export interface Candidate extends CandidateDef {
  level: number;
  xp: number;
  equipment: Record<GearSlotKey, string>;
  /** One picked option id ('a' | 'b') per talent tier, or null while unpicked. */
  talents: (string | null)[];
  /** Chosen subclass id within the character's fixed role, or null while unpicked. */
  classId: string | null;
  /** Chosen profession id (independent of role/class), or null while unpicked. */
  professionId: string | null;
  /** Profession skill level (1..PROFESSION_MAX_LEVEL) — the profession's bonus scales with it. */
  professionLevel: number;
  professionXp: number;
}

export interface GearOption {
  id: string;
  name: string;
  mult?: number;
  hpMult?: number;
  wardMult?: number;
  cdMult?: number;
  desc: string;
  icon?: import('./itemIcons').ItemIconId;
  /** Gold price at the camp trader. Absent (or 'none') means not sold. */
  price?: number;
}

export interface EncounterDef {
  type: 'room' | 'boss';
  name: string;
  enemyName: string;
  hp: number;
  desc: string;
}
