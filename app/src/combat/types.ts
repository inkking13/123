import { AttackRange, Role, TraitId } from '../data/types';

export const DANGER = '#d1685c';
export const ACCENT = '#9184d9';

// Tactical grid — raiders occupy one of GRID_ROWS × GRID_COLS cells; the boss
// sits in its own row in front of row 0. Melee needs row 0 (the front line)
// to swing; ranged/heal act from any row. Movement range is generous enough
// that a raider can cross the whole grid (back row to front) in one turn.
export const GRID_ROWS = 3;
export const GRID_COLS = 5;
export const FRONT_ROW = 0;
export const BACK_ROW = GRID_ROWS - 1;
export const MOVE_RANGE = 2;

// Turn economy constants — a "turn" replaces what used to be several seconds
// of continuous real-time combat, so raw dps/healPower (balanced per-second)
// are scaled up by these factors to land on comparable total damage/healing
// over a fight of similar length (now measured in rounds, not seconds).
export const ATTACK_TURN_SCALE = 6;
export const HEAL_TURN_SCALE = 6;

export type AbilityKind =
  | 'selfShield' | 'partyShield' | 'drainHeal' | 'volatileHeal'
  | 'venom' | 'berserk' | 'nukeSelfDamage' | 'nukeHeal' | 'nukeTilt';

export type AbilityIcon = 'shield' | 'shield-chevron' | 'skull' | 'flask' | 'drop' | 'flame' | 'target' | 'fire' | 'sword';

export interface Ability {
  kind: AbilityKind;
  icon: AbilityIcon;
  cd: number; // rounds remaining until usable again
  cdMax: number; // cooldown length, in rounds
  active: boolean;
  activeRounds: number; // rounds remaining while a buff is in effect
  activeMax: number;
}

export interface Raider {
  id: number;
  name: string;
  role: Role;
  attackRange: AttackRange;
  candidateId: number;
  trait: TraitId;
  level: number;
  maxHp: number;
  hp: number;
  alive: boolean;
  dps: number;
  healPower: number;
  outputMult: number;
  wardMult: number;
  levelMult: number;
  speed: number;
  chainPartner: number | null;
  ability: Ability;
  /** Took the "Оборона" action — reduced damage until their own next turn. */
  defending: boolean;
  row: number;
  col: number;
}

export interface Boss {
  name: string;
  maxHp: number;
  hp: number;
}

/** Room encounters field a small group instead of one HP pool — each role pressures the party differently, so kill order matters. */
export type EnemyRole = 'brute' | 'archer' | 'shaman';
export interface Enemy {
  id: number;
  role: EnemyRole;
  name: string;
  maxHp: number;
  hp: number;
  alive: boolean;
}

/** An announced, interruptible beam cast — resolves on the boss's next turn unless a raider spends their turn to interrupt it. */
export interface PendingCast {
  targetId: number;
  targetName: string;
}

/** Two raiders chained together; either can spend a turn to break it, otherwise both take damage each round it persists. */
export interface ChainState {
  aId: number;
  bId: number;
  roundsLeft: number;
}

/** A raider poisoned by the boss — ticks damage at the start of their own turn. */
export interface PoisonState {
  targetId: number;
  roundsLeft: number;
  dmgPerTick: number;
}

/** The boss poisoned by Vex's venom ability — ticks at the start of each new round. */
export interface BossPoisonState {
  roundsLeft: number;
  dmgPerTick: number;
  /** Which room enemy carries the venom; null in boss fights. */
  enemyId: number | null;
}

export interface PartyWardState {
  roundsLeft: number;
  mult: number;
}

/** "Кровавый прилив" reimagined: announced one boss-turn ahead, resolves on the boss's next turn. Raiders who spend their turn to brace count toward softening it. */
export interface BraceCall {
  braced: Set<number>;
}

export type LogKind = 'info' | 'ok' | 'warn';

/** The most recent actor, published for the combat screen's attack animations. `seq` bumps on every action so the UI can replay even identical ones. */
export interface CombatFx {
  seq: number;
  actor: number | 'enemy' | null;
  kind: 'melee' | 'ranged' | 'heal' | 'ability' | 'enemy' | null;
  crit: boolean;
  /** Where a projectile should fly: a room enemy id, -1 for the boss, or null. */
  targetEnemy: number | null;
  /** Ally receiving a heal (for the healing orb), or null. */
  targetRaider: number | null;
}
export interface LogEntry {
  text: string;
  kind?: LogKind;
}

export type EncounterType = 'room' | 'boss';

export type TurnEntry = { kind: 'raider'; id: number } | { kind: 'boss' };

export interface BossMoveTimers {
  beam: number;
  meteor: number;
  poison: number;
  chain: number;
  brace: number;
  freeze: number;
  curse: number;
  cleave: number;
}

/** A telegraphed area attack — marked on the grid on one boss turn, lands on the next on whoever is still standing in it. Cells are "row,col" keys. */
export interface DangerZone {
  kind: 'meteor' | 'cleave';
  cells: string[];
  cols: number[];
}

/** Ярл Ледяного Пепла's signature move: a raider frozen solid skips their own turns until it thaws or someone shatters the ice. */
export interface FrozenState {
  targetId: number;
  targetName: string;
  roundsLeft: number;
}

/** Кардинал Пепла's signature move: a party-wide, stacking vulnerability that only "Сплотить отряд" can clear. */
export interface AshCurseState {
  stacks: number;
}

export interface Sim {
  /** In room fights this mirrors the group's combined HP, so the header bar and win check work unchanged. */
  boss: Boss;
  enemies: Enemy[];
  focusId: number | null;
  fx: CombatFx;
  /** Bumped when a telegraphed zone lands, so the cells it covered can burst. */
  impact: { seq: number; cells: string[] };
  /** Bumped on heavy moments (big hits, deaths, phase changes) to shake the battlefield. */
  shakeSeq: number;
  name: string;
  raiders: Raider[];
  encounterType: EncounterType;
  dmgMult: number;

  round: number;
  order: TurnEntry[];
  turnPos: number;
  awaitingPlayer: boolean;
  movePhase: boolean;
  bossCyclePos: number;
  bossMoveTimers: BossMoveTimers;

  pendingCast: PendingCast | null;
  chain: ChainState | null;
  poison: PoisonState | null;
  bossPoison: BossPoisonState | null;
  partyWard: PartyWardState | null;
  braceCall: BraceCall | null;
  frozen: FrozenState | null;
  ashCurse: AshCurseState | null;
  danger: DangerZone | null;

  /** Builds up from sustained hits; at 100 the boss is stunned (skips its next turn, loses whatever it was winding up) and stays vulnerable for a couple of rounds. */
  stagger: number;
  stunned: boolean;
  vulnerableRounds: number;
  /** Round from which the boss starts hitting harder every round, so stalling a fight out has a cost. */
  enrageAt: number;
  /** Rounds left of the post-rally boost to healing. */
  inspiredRounds: number;

  rallyCd: number;
  tilt: number;
  phase: number;
  log: LogEntry[];
  over: boolean;
  selected: number | null;
}
