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
  row: number;
  col: number;
}

export interface Boss {
  name: string;
  maxHp: number;
  hp: number;
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
  boss: Boss;
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

  rallyCd: number;
  tilt: number;
  phase: number;
  log: LogEntry[];
  over: boolean;
  selected: number | null;
}
