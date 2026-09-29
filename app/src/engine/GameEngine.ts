import AsyncStorage from '@react-native-async-storage/async-storage';
import { diedIn3dLastRun } from '../battle3d/probe3d';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { POOL, RECRUITS, ALL_CANDIDATES, XP_PER_LEVEL, MAX_LEVEL } from '../data/characters';
import { GEAR, SLOT_LABEL, SLOT_ORDER, STARTING_INVENTORY, BOSS_LOOT_TABLE, TRASH_LOOT_TABLE, TRASH_LOOT_CHANCE, SELL_RATIO, UNIQUE_BOSS_LOOT, UNIQUE_BOSS_LOOT_EXTRA, emptyEquipment, SLOT_KIND, slotGear, slotsForKind, migrateEquipment, GEAR_KINDS } from '../data/gear';
import { DUNGEONS, DungeonDef, LOCATIONS } from '../data/dungeons';
import { ABILITY_BY_CANDIDATE } from '../data/abilities';
import { ABILITY_ART, SkillArtId } from '../data/skillArt';
import { TALENT_TREE, TalentTier } from '../data/talents';
import { CLASSES } from '../data/classes';
import { PROFESSIONS, PROFESSION_MAX_LEVEL, PROFESSION_XP_PER_LEVEL, professionTrainCost, scaledMult } from '../data/professions';
import { REAGENTS, REAGENT_BY_LOCATION, ROOM_REAGENT_CHANCE } from '../data/reagents';
import { RECIPES } from '../data/recipes';
import { GEAR_SETS, GearSetDef, SetBonusDef } from '../data/gearSets';
import { Rarity, StatLine, compareLines, rarityOf, setNameOf, statLines } from '../data/gearInfo';
import { QUESTS } from '../data/quests';
import { ACHIEVEMENTS } from '../data/achievements';
import { DailyMetric, pickDailyTemplates } from '../data/dailyQuests';
import { ARENA_RIVALS, arenaRankName } from '../data/arena';
import { WeeklyModifierDef, pickWeeklyModifier, pickWeeklyDungeonId } from '../data/weeklyChallenge';
import { CURIOS } from '../data/curios';
import { EventOption, OFFICE_EVENTS, STAFF_EVENTS } from '../data/events';
import { BARKS, barkMoment } from '../data/barks';
import { GearIconId as ItemIconId } from '../data/armourSets';
import { ARMOUR_IDS, RETIRED_ARMOUR_IDS, STARTING_OUTFITS, armourOf, dressInStartingSet } from '../data/armourSets';

/** A starting hero's slots: empty but for their armour set. */
function startingEquipment(id: number) { const e = emptyEquipment(); dressInStartingSet(id, e); return e; }
import { FEATURES, FEATURE_ORDER, Feature, Tip } from '../data/features';
import { IconName } from '../components/Icon';
import type { Quality } from '../battle3d/quality';
import { AttackRange, Candidate, EncounterDef, GearKind, GearOption, GearSlotKey, Role } from '../data/types';
import {
  ACCENT, ATTACK_TURN_SCALE, HEAL_TURN_SCALE,
  GRID_ROWS, GRID_COLS, BACK_ROW, MOVE_RANGE, BOSS_W, BOSS_H, FOE_SPEED,
  Ability, AbilityIcon, BossMoveTimers, Enemy, EnemyRole, Raider, SignatureKind, Sim, TurnEntry, LogKind,
} from '../combat/types';

export type Screen = 'title' | 'home' | 'roster' | 'char' | 'gear' | 'dungeon' | 'combat' | 'results' | 'quests' | 'inventory' | 'settings' | 'shop' | 'event' | 'analytics' | 'personnel' | 'levelmap' | 'hire' | 'arena' | 'profession' | 'achievements' | 'weekly';

const SAVE_KEY = 'raid-commander.save.v1';
const STARTING_GOLD = 60;
const MIN_ROSTER = 5;
const PAYROLL_BASE = 5;
// Tempered for the 30-level track — at the old rate (2/level) a maxed squad's
// payroll would outrun any realistic dungeon income (5 × 65 = 325/return).
const PAYROLL_PER_LEVEL = 1;
const RESIGNATION_MORALE_THRESHOLD = 15;
const RESIGNATION_CHANCE = 0.5;
const HISTORY_LIMIT = 30;

// Combat tuning for the stagger / enrage / combo layer.
const STAGGER_MAX = 100;
const STAGGER_ATTACK = 5;
const STAGGER_FRONT_MELEE = 3;
const STAGGER_CRIT = 5;
const STAGGER_NUKE = 10;
const STAGGER_DECAY = 5;
const VULNERABLE_ROUNDS = 2;
const VULNERABLE_MULT = 1.5;
const ENRAGE_ROUND_BOSS = 14;
const ENRAGE_ROUND_ROOM = 10;
const ENRAGE_STEP = 0.12;
const POISONED_BOSS_MULT = 1.15;
const FORMATION_BONUS = 0.08;
const INSPIRED_ROUNDS = 2;
const INSPIRED_HEAL_MULT = 1.3;
const TANK_GUARD_MULT = 0.85;
const DEFEND_MULT = 0.6;

// Room enemy groups, by the room's position in its dungeon. The brute always
// leads (it carries the boss-style move kit); the others take a fixed share
// of the room's HP pool, the brute gets the rest.
// Where a room group stands when the fight opens: the brute out front, the
// others behind it on the flanks.
const ROOM_START = [{ row: 1, col: 3 }, { row: 0, col: 1 }, { row: 0, col: 5 }];
const BOSS_START = { row: 0, col: Math.floor((GRID_COLS - BOSS_W) / 2) };
const ROOM_GROUPS: EnemyRole[][] = [['brute', 'archer'], ['brute', 'shaman'], ['brute', 'archer', 'shaman']];
export function roomGroupRoles(roomIdx: number): EnemyRole[] {
  return ROOM_GROUPS[Math.min(roomIdx, ROOM_GROUPS.length - 1)];
}
const ENEMY_HP_SHARE: Record<Exclude<EnemyRole, 'brute'>, number> = { archer: 0.28, shaman: 0.25 };
const ENEMY_NAME: Record<EnemyRole, string> = { brute: 'Громила', archer: 'Стрелок', shaman: 'Шаман' };
const ENEMY_NAME_ACC: Record<EnemyRole, string> = { brute: 'громилу', archer: 'стрелка', shaman: 'шамана' };
const ARCHER_DMG = 8;
/** How long the party cheers on the field after a win, ms. */
const VICTORY_MS = 2200;

// Location-final boss signatures: boss turns between casts (the first comes on the 2nd boss turn).
const SIG_COOLDOWN: Record<SignatureKind, number> = { devour: 4, iceShell: 5, feast: 0, debt: 4, backstab: 3, execution: 5, lava: 4, quota: 5, raise: 3 };
// 'raise': raised skeletons, ids from MINION_ID0 so they never clash with the boss (-1) or room enemies.
const MINION_ID0 = 100;
const MINION_MAX = 3;
const MINION_PER_CAST = 2;
const MINION_HP_SHARE = 0.07;
const MINION_DMG = 10;
const ICE_SHELL_MULT = 0.25;
const FEAST_HEAL_SHARE = 0.004;
const FEAST_THRESHOLD = 0.4;
const LAVA_MAX_CELLS = 7;
// Quota is set against the party's raw per-round damage; crits, combos and abilities are what push a focused round past it.
const WINDUP_MS = 750;
const GEAR_SLOT_COMP_HP = 0.1;
const GEAR_SLOT_COMP_DMG = 0.2;
const QUOTA_SHARE = 2.8;
const SHAMAN_HEAL_SHARE = 0.07;
// Splitting one HP pool into several targets loses damage to overkill and to
// venom dying with its carrier, so the group gets a slightly smaller pool.
const ROOM_GROUP_HP_MULT = 0.9;
const BERSERK_TAKEN_MULT = 1.25;
// Offsets the counterplay the positional layer adds (dodgeable area hits, a tank soaking the front) — tuned by simulation against the pre-rework difficulty.
const BOSS_DMG_SCALE = 1.6;
const EMPLOYEE_OF_MONTH_CYCLE = 3;
const DEPARTED_LOG_LIMIT = 20;
const FEUD_MULT = 0.9;
const STRIKE_MULT = 0.85;

export interface HistoryPoint {
  gold: number;
  avgMorale: number;
}

export interface DepartedEntry {
  name: string;
  epithet: string;
  role: Role;
  story: string;
  level: number;
  reason: 'fired' | 'resigned';
}

interface SaveData {
  pool: { id: number; level: number; xp: number; equipment: Record<GearSlotKey, string>; talents: (string | null)[]; classId: string | null; professionId: string | null; professionLevel: number; professionXp: number; morale: number }[];
  selected: number[];
  inventoryCounts: Record<string, number>;
  /** Set once the starting five have been put in their armour sets. */
  outfitted?: boolean;
  reagentCounts: Record<string, number>;
  gold: number;
  dungeonId: string;
  defeatedDungeons: string[];
  claimedQuestIds: string[];
  curiosOwned: string[];
  claimedAchievementIds: string[];
  everCrafted: boolean;
  settings: { haptics: boolean; view3d?: boolean; speed?: number; auto?: boolean; quality?: Quality; sound?: boolean; music?: boolean };
  statsRoomWins: number;
  statsBossWins: number;
  statsWipes: number;
  history: HistoryPoint[];
  campReturns: number;
  departedLog: DepartedEntry[];
  dailyDate: string;
  dailyProgress: Record<string, number>;
  dailyClaimedIds: string[];
  arenaRating: number;
  arenaWins: number;
  arenaLosses: number;
  weeklyChallengeWeek: string;
  weeklyClaimed: boolean;
  seenUnlocks?: string[];
  seenTips?: string[];
  raises?: Record<string, number>;
  feud?: Feud | null;
  strikeTrips?: number;
}

/** Two squad members who won't cover each other until it blows over. */
export interface Feud { a: number; b: number; trips: number }

export interface GearSlotOption {
  id: string;
  name: string;
  icon?: ItemIconId;
  border: string;
  bg: string;
  color: string;
  disabled: boolean;
  stockLabel: string;
  onPick: () => void;
}
export interface GearSlotVM {
  label: string;
  desc: string;
  options: GearSlotOption[];
}

export interface EquipItemVM {
  id: string;
  name: string;
  icon?: ItemIconId;
  rarity: Rarity;
  desc: string;
  stats: StatLine[];
  compare: StatLine[];
  setName: string | null;
  free: number;
  worn: boolean;
  available: boolean;
  wornBy: string[];
  onEquip: () => void;
}
export interface EquipSlotVM {
  slot: GearSlotKey;
  label: string;
  equipped: EquipItemVM | null;
  stash: EquipItemVM[];
  onUnequip: () => void;
}
export interface EquipmentVM {
  slots: EquipSlotVM[];
  totals: StatLine[];
}

export interface FoeRect { id: number; row: number; col: number; w: number; h: number }

export interface LootItem {
  slot: GearKind;
  gearId: string;
  name: string;
  assigned: number | null;
}
export interface ReagentDrop {
  name: string;
  icon: ItemIconId;
  qty: number;
}
export interface CombatResult {
  win: boolean;
  isBoss: boolean;
  loot: LootItem[];
  curioFound: string | null;
  goldFound: number;
  reagentFound: ReagentDrop | null;
}

export interface BanterLine { id: number; name: string; text: string }

export interface TalentOptionVM {
  id: string;
  name: string;
  desc: string;
  icon?: IconName;
  selected: boolean;
  disabled: boolean;
  onPick: () => void;
}
export interface TalentTierVM {
  level: number;
  unlocked: boolean;
  chosen: boolean;
  options: TalentOptionVM[];
}

export type TurnActionKey = 'attack' | 'heal' | 'ability' | 'interrupt' | 'breakChain' | 'brace' | 'rally' | 'breakIce' | 'defend' | 'breakShell';
export interface TurnActionVM {
  key: TurnActionKey;
  label: string;
  sub?: string;
  abilityIcon?: AbilityIcon;
  abilityArt?: SkillArtId;
  needsTarget: boolean;
  disabled: boolean;
}
export interface HealTargetVM {
  id: number;
  name: string;
  hpPct: number;
}

export interface HireOptionVM {
  id: number;
  name: string;
  epithet: string;
  role: Role;
  attackRange: AttackRange;
  bio: string;
  story: string;
  hp: number;
  dps: number;
  healPower?: number;
  gs: number;
  cost: number;
  affordable: boolean;
  onHire: () => void;
}

export interface ShopBuyOption {
  slot: GearSlotKey;
  id: string;
  name: string;
  desc: string;
  icon?: ItemIconId;
  price: number;
  affordable: boolean;
  onBuy: () => void;
}
export interface ShopSellRow {
  slot: GearSlotKey;
  id: string;
  name: string;
  icon?: ItemIconId;
  free: number;
  sellPrice: number;
  onSell: () => void;
}

export interface QuestVM {
  id: string;
  name: string;
  desc: string;
  rewardDesc: string;
  achieved: boolean;
  claimed: boolean;
  onClaim: () => void;
}

export interface AnalyticsVM {
  winRatePct: number | null;
  totalFights: number;
  roomWins: number;
  bossWins: number;
  wipes: number;
  kpiDone: number;
  kpiTotal: number;
  avgMorale: number;
  gold: number;
  history: HistoryPoint[];
}

export interface PayrollNotice {
  paid: number;
  shortfall: boolean;
}

export interface ActiveEventVM {
  title: string;
  desc: string;
  labelA: string;
  labelB: string;
  resultText: string | null;
  faces: number[];
  stakes: string | null;
}

export interface ResignationNotice {
  name: string;
}

export interface EmployeeOfMonthNotice {
  name: string;
}

export interface PersonnelRosterEntry {
  id: number;
  name: string;
  epithet: string;
  role: Role;
  className: string | null;
  professionName: string | null;
  level: number;
  morale: number;
  story: string;
}

export interface PersonnelVM {
  roster: PersonnelRosterEntry[];
  departed: DepartedEntry[];
}

export class GameEngine {
  screen: Screen = 'title';
  charId: number | null = null;
  payrollNotice: PayrollNotice | null = null;
  resignationNotice: ResignationNotice | null = null;
  employeeOfMonthNotice: EmployeeOfMonthNotice | null = null;
  activeEvent: ActiveEventVM | null = null;
  private pendingEventOptions: [EventOption, EventOption] | null = null;
  private postEventScreen: Screen = 'home';

  statsRoomWins = 0;
  statsBossWins = 0;
  statsWipes = 0;
  history: HistoryPoint[] = [];
  campReturns = 0;
  departedLog: DepartedEntry[] = [];

  pool: Candidate[];
  selected: Set<number>;
  inventoryCounts: Record<string, number>;
  reagentCounts: Record<string, number> = {};
  gold = STARTING_GOLD;
  dungeonId = 'wastes';
  defeatedDungeons = new Set<string>();
  encIdx = 0;
  sim: Sim | null = null;
  result: CombatResult | null = null;

  // quest tracking — one-shot flags for events that leave no other trace
  everClearedRoom = false;
  everInterrupted = false;
  everUsedAbility = false;
  everAssignedLoot = false;
  everCrafted = false;
  claimedQuestIds = new Set<string>();
  curiosOwned = new Set<string>();
  claimedAchievementIds = new Set<string>();

  // daily quests — reset whenever the wall-clock date rolls over
  dailyDate = '';
  dailyProgress: Record<string, number> = {};
  dailyClaimedIds = new Set<string>();

  // arena (offline PvP) — rating persists, the live opponent/flag do not
  arenaRating = 1000;
  arenaWins = 0;
  arenaLosses = 0;
  inArena = false;
  arenaOpponent: { name: string; hp: number; dmgMult: number; goldReward: number; ratingWin: number; ratingLoss: number } | null = null;

  // weekly challenge — a boss re-fight with a rotating modifier, replayable once its reward is claimed for the week
  weeklyChallengeWeek = '';
  weeklyClaimed = false;
  inWeeklyChallenge = false;
  private weeklyModifierDmgMult = 1;

  /** A boss fight opens on its title card; the first turn waits until it's done. */
  bossIntro: { name: string; place: string; line: string } | null = null;
  /** Graphics were dropped to «Низкое» at launch because the app died inside 3D last time (see probe3d). */
  safeMode3d = false;
  private introTimer: ReturnType<typeof setTimeout> | null = null;

  // gradual unlocks and first-fight tips
  seenUnlocks = new Set<Feature>();
  /** HR consequences: extra wage per trip by hero id, an open quarrel, trips left on a go-slow strike. */
  raises: Record<number, number> = {};
  feud: Feud | null = null;
  strikeTrips = 0;
  seenTips = new Set<Tip>();

  settings: { haptics: boolean; speed: number; auto: boolean; quality: Quality; sound: boolean; music: boolean } = { haptics: true, speed: 1, auto: false, quality: 'medium', sound: true, music: true };

  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private subs = new Set<() => void>();
  private version = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;

  constructor() {
    this.pool = POOL.map((c) => ({ ...c, level: 1, xp: 0, equipment: startingEquipment(c.id), talents: [null, null, null, null], classId: null, professionId: null, professionLevel: 1, professionXp: 0 }));
    this.selected = new Set([0, 2, 4, 5, 6]);
    this.inventoryCounts = { ...STARTING_INVENTORY };
  }

  // ── persistence ──────────────────────────────────────────
  // Combat state (sim) and current screen are deliberately excluded — a
  // restart always resumes at the title screen, out of combat.
  private serialize(): SaveData {
    return {
      pool: this.pool.map((c) => ({ id: c.id, level: c.level, xp: c.xp, equipment: c.equipment, talents: c.talents, classId: c.classId, professionId: c.professionId, professionLevel: c.professionLevel, professionXp: c.professionXp, morale: c.morale })),
      selected: Array.from(this.selected),
      inventoryCounts: this.inventoryCounts,
      reagentCounts: this.reagentCounts,
      gold: this.gold,
      dungeonId: this.dungeonId,
      defeatedDungeons: Array.from(this.defeatedDungeons),
      claimedQuestIds: Array.from(this.claimedQuestIds),
      curiosOwned: Array.from(this.curiosOwned),
      claimedAchievementIds: Array.from(this.claimedAchievementIds),
      everCrafted: this.everCrafted,
      settings: this.settings,
      statsRoomWins: this.statsRoomWins,
      statsBossWins: this.statsBossWins,
      statsWipes: this.statsWipes,
      history: this.history,
      campReturns: this.campReturns,
      departedLog: this.departedLog,
      dailyDate: this.dailyDate,
      dailyProgress: this.dailyProgress,
      dailyClaimedIds: Array.from(this.dailyClaimedIds),
      arenaRating: this.arenaRating,
      arenaWins: this.arenaWins,
      arenaLosses: this.arenaLosses,
      weeklyChallengeWeek: this.weeklyChallengeWeek,
      weeklyClaimed: this.weeklyClaimed,
      seenUnlocks: Array.from(this.seenUnlocks),
      seenTips: Array.from(this.seenTips),
      raises: this.raises,
      feud: this.feud,
      strikeTrips: this.strikeTrips,
      outfitted: true,
    };
  }
  private applySave(data: SaveData) {
    // Pool is rebuilt from scratch out of the static roster (base 9 + any
    // hired recruits) rather than patched in place — patching only ever
    // updated candidates the fresh constructor already had, so a fired
    // candidate would linger and a hired recruit would go missing on load.
    if (data.pool) {
      const byId = new Map(ALL_CANDIDATES.map((c) => [c.id, c]));
      this.pool = data.pool
        .map((saved): Candidate | null => {
          const def = byId.get(saved.id);
          if (!def) return null;
          return {
            ...def, level: saved.level, xp: saved.xp, equipment: migrateEquipment(saved.equipment),
            talents: saved.talents, classId: saved.classId ?? null, professionId: saved.professionId ?? null,
            professionLevel: saved.professionLevel ?? 1, professionXp: saved.professionXp ?? 0, morale: saved.morale,
          };
        })
        .filter((c): c is Candidate => c != null);
    }
    if (data.selected) this.selected = new Set(data.selected);
    if (data.inventoryCounts) this.inventoryCounts = data.inventoryCounts;
    // Saves from before the armour sets get one of each piece.
    for (const id of ARMOUR_IDS) if (this.inventoryCounts[id] === undefined) this.inventoryCounts[id] = 1;
    // Shoulders, cloaks, belts and boots of the sets are now part of the torso and legs items.
    for (const id of RETIRED_ARMOUR_IDS) delete this.inventoryCounts[id];
    // Saves from before the starting outfits: dress the starting five in any empty armour slot,
    // adding the pieces to the stash where the guild has none spare.
    if (!data.outfitted) for (const c of this.pool) {
      if (!(c.id in STARTING_OUTFITS)) continue;
      const before = { ...c.equipment };
      dressInStartingSet(c.id, c.equipment);
      for (const slot of Object.keys(c.equipment) as GearSlotKey[]) {
        const id = c.equipment[slot];
        if (id === before[slot]) continue;
        const worn = this.pool.filter((o) => Object.values(o.equipment).includes(id)).length;
        if ((this.inventoryCounts[id] ?? 0) < worn) this.inventoryCounts[id] = worn;
      }
    }
    if (data.reagentCounts) this.reagentCounts = data.reagentCounts;
    if (typeof data.gold === 'number') this.gold = data.gold;
    if (data.dungeonId) this.dungeonId = data.dungeonId;
    if (data.defeatedDungeons) this.defeatedDungeons = new Set(data.defeatedDungeons);
    if (data.claimedQuestIds) this.claimedQuestIds = new Set(data.claimedQuestIds);
    if (data.curiosOwned) this.curiosOwned = new Set(data.curiosOwned);
    if (data.claimedAchievementIds) this.claimedAchievementIds = new Set(data.claimedAchievementIds);
    if (typeof data.everCrafted === 'boolean') this.everCrafted = data.everCrafted;
    if (data.settings) { const { view3d: _retired, ...saved } = data.settings; this.settings = { ...this.settings, ...saved }; }
    if (typeof data.statsRoomWins === 'number') this.statsRoomWins = data.statsRoomWins;
    if (typeof data.statsBossWins === 'number') this.statsBossWins = data.statsBossWins;
    if (typeof data.statsWipes === 'number') this.statsWipes = data.statsWipes;
    if (Array.isArray(data.history)) this.history = data.history;
    if (typeof data.campReturns === 'number') this.campReturns = data.campReturns;
    if (Array.isArray(data.departedLog)) this.departedLog = data.departedLog;
    if (typeof data.dailyDate === 'string') this.dailyDate = data.dailyDate;
    if (data.dailyProgress) this.dailyProgress = data.dailyProgress;
    if (data.dailyClaimedIds) this.dailyClaimedIds = new Set(data.dailyClaimedIds);
    if (typeof data.arenaRating === 'number') this.arenaRating = data.arenaRating;
    if (typeof data.arenaWins === 'number') this.arenaWins = data.arenaWins;
    if (typeof data.arenaLosses === 'number') this.arenaLosses = data.arenaLosses;
    if (typeof data.weeklyChallengeWeek === 'string') this.weeklyChallengeWeek = data.weeklyChallengeWeek;
    if (typeof data.weeklyClaimed === 'boolean') this.weeklyClaimed = data.weeklyClaimed;
    if (Array.isArray(data.seenUnlocks)) this.seenUnlocks = new Set(data.seenUnlocks as Feature[]);
    else for (const f of FEATURE_ORDER) if (this.isUnlocked(f)) this.seenUnlocks.add(f); // older save: no announcements for what it already had
    if (Array.isArray(data.seenTips)) this.seenTips = new Set(data.seenTips as Tip[]);
    else if (this.statsRoomWins > 0) this.seenTips = new Set(['move', 'act', 'focus', 'danger', 'windup']);
    if (data.raises) this.raises = data.raises;
    if (data.feud) this.feud = data.feud;
    if (typeof data.strikeTrips === 'number') this.strikeTrips = data.strikeTrips;
  }
  async load() {
    try {
      const raw = await AsyncStorage.getItem(SAVE_KEY);
      if (raw) this.applySave(JSON.parse(raw));
    } catch {
      // corrupt or unavailable storage — start fresh rather than crash
    }
    // The phone killed the app inside a 3D view last time: lighten the graphics and say so.
    if (await diedIn3dLastRun() && this.settings.quality !== 'low') { this.settings.quality = 'low'; this.safeMode3d = true; }
    this.loaded = true;
    this.notify();
  }
  private scheduleSave() {
    if (!this.loaded) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      AsyncStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())).catch(() => {});
    }, 500);
  }
  async resetProgress() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    this.pool = POOL.map((c) => ({ ...c, level: 1, xp: 0, equipment: startingEquipment(c.id), talents: [null, null, null, null], classId: null, professionId: null, professionLevel: 1, professionXp: 0 }));
    this.selected = new Set([0, 2, 4, 5, 6]);
    this.inventoryCounts = { ...STARTING_INVENTORY };
    this.reagentCounts = {};
    this.gold = STARTING_GOLD;
    this.dungeonId = 'wastes';
    this.defeatedDungeons = new Set();
    this.encIdx = 0;
    this.sim = null;
    this.result = null;
    this.everClearedRoom = false;
    this.everInterrupted = false;
    this.everUsedAbility = false;
    this.everAssignedLoot = false;
    this.everCrafted = false;
    this.claimedQuestIds = new Set();
    this.curiosOwned = new Set();
    this.claimedAchievementIds = new Set();
    this.statsRoomWins = 0; this.statsBossWins = 0; this.statsWipes = 0;
    this.history = [];
    this.campReturns = 0;
    this.departedLog = [];
    this.dailyDate = ''; this.dailyProgress = {}; this.dailyClaimedIds = new Set();
    this.arenaRating = 1000; this.arenaWins = 0; this.arenaLosses = 0; this.inArena = false; this.arenaOpponent = null;
    this.weeklyChallengeWeek = ''; this.weeklyClaimed = false; this.inWeeklyChallenge = false; this.weeklyModifierDmgMult = 1;
    this.seenUnlocks = new Set(); this.seenTips = new Set();
    this.raises = {}; this.feud = null; this.strikeTrips = 0;
    this.payrollNotice = null; this.resignationNotice = null; this.activeEvent = null; this.employeeOfMonthNotice = null;
    try { await AsyncStorage.removeItem(SAVE_KEY); } catch {}
    this.screen = 'title';
    this.notify();
  }

  // ── haptics ──────────────────────────────────────────────
  private haptic(fn: () => Promise<void>) {
    if (!this.settings.haptics || Platform.OS === 'web') return;
    fn().catch(() => {});
  }
  /** Battle speed: 1 or 2 (turn pauses and wind-ups are divided by it). */
  toggleSpeed() {
    this.settings.speed = this.settings.speed >= 2 ? 1 : 2;
    this.notify();
  }
  /** Auto-battle: the party plays its own turns. Takes over at once if a hero is waiting. */
  toggleAuto() {
    this.settings.auto = !this.settings.auto;
    const s = this.sim;
    if (this.settings.auto && s && !s.over && s.awaitingPlayer && !this.bossIntro) this.scheduleAuto();
    this.notify();
  }
  setQuality(q: Quality) {
    this.settings.quality = q;
    this.notify();
  }
  private pace(ms: number) {
    return ms / Math.max(1, this.settings.speed || 1);
  }
  dismissSafeMode3d() {
    this.safeMode3d = false;
    this.notify();
  }
  toggleSound() {
    this.settings.sound = !this.settings.sound;
    this.notify();
  }
  toggleMusic() {
    this.settings.music = !this.settings.music;
    this.notify();
  }
  toggleHaptics() {
    this.settings.haptics = !this.settings.haptics;
    if (this.settings.haptics) this.haptic(() => Haptics.selectionAsync());
    this.notify();
  }

  // ── pub/sub ──────────────────────────────────────────────
  subscribe = (cb: () => void) => {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  };
  getVersion = () => this.version;
  private notify() {
    this.version++;
    for (const cb of this.subs) cb();
    if (!(this.sim && !this.sim.over)) this.scheduleSave();
  }
  bump() { this.notify(); }

  // ── gradual unlocks & tips ───────────────────────────────
  isUnlocked(f: Feature): boolean {
    const d = FEATURES[f];
    return this.statsRoomWins >= (d.rooms ?? 0) && this.defeatedDungeons.size >= (d.bosses ?? 0);
  }
  /** Features that have opened but haven't been announced yet, in order. */
  newUnlocks(): Feature[] {
    return FEATURE_ORDER.filter((f) => this.isUnlocked(f) && !this.seenUnlocks.has(f));
  }
  markUnlockSeen(f: Feature) {
    this.seenUnlocks.add(f);
    this.notify();
  }
  tipPending(t: Tip): boolean {
    return !this.seenTips.has(t);
  }
  dismissTip(t: Tip) {
    this.seenTips.add(t);
    this.notify();
  }
  resetTips() {
    this.seenTips = new Set();
    this.notify();
  }

  // ── navigation ───────────────────────────────────────────
  go(screen: Screen) {
    if (screen !== 'combat') {
      this.clearTurnTimer();
      this.bossIntro = null;
      if (this.introTimer) { clearTimeout(this.introTimer); this.introTimer = null; }
    }
    this.screen = screen;
    this.notify();
  }
  openChar(id: number) {
    this.charId = id;
    this.screen = 'char';
    this.notify();
  }

  // ── roster / squad ───────────────────────────────────────
  squad(): Candidate[] {
    return this.pool.filter((c) => this.selected.has(c.id));
  }
  toggleSelect(id: number) {
    if (this.selected.has(id)) this.selected.delete(id);
    else if (this.selected.size < 5) this.selected.add(id);
    this.notify();
  }
  squadReady() {
    return this.selected.size === 5;
  }

  currentDungeon(): DungeonDef {
    return DUNGEONS.find((d) => d.id === this.dungeonId) || DUNGEONS[0];
  }
  isDungeonUnlocked(id: string): boolean {
    const idx = DUNGEONS.findIndex((d) => d.id === id);
    if (idx <= 0) return idx === 0;
    return this.defeatedDungeons.has(DUNGEONS[idx - 1].id);
  }
  selectDungeon(id: string) {
    this.dungeonId = id;
    this.notify();
  }

  // Every slot's piece stacks multiplicatively on every stat it carries.
  gearMults(c: Candidate) {
    let outputMult = 1, hpMult = 1, wardMult = 1, cdMult = 1;
    for (const slot of SLOT_ORDER) {
      const o = slotGear(slot).find((x) => x.id === c.equipment[slot]);
      if (!o) continue;
      outputMult *= o.mult || 1;
      hpMult *= o.hpMult || 1;
      wardMult *= o.wardMult || 1;
      cdMult *= o.cdMult || 1;
    }
    return { outputMult, hpMult, wardMult, cdMult };
  }

  // ── inventory ────────────────────────────────────────────
  itemOwned(gearId: string): number {
    return this.inventoryCounts[gearId] || 0;
  }
  itemInUseCount(slot: GearSlotKey, gearId: string, excludeCandidateId?: number, excludeSlot?: GearSlotKey): number {
    let n = 0;
    for (const c of this.pool) for (const s of slotsForKind(SLOT_KIND[slot])) {
      if (c.id === excludeCandidateId && (excludeSlot === undefined || s === excludeSlot)) continue;
      if (c.equipment[s] === gearId) n++;
    }
    return n;
  }
  /** How many of an item are worn by anyone, in any slot. */
  wornCount(gearId: string): number {
    let n = 0;
    for (const c of this.pool) for (const s of SLOT_ORDER) if (c.equipment[s] === gearId) n++;
    return n;
  }
  itemAvailable(c: Candidate, slot: GearSlotKey, gearId: string): boolean {
    if (gearId === 'none') return true;
    if (c.equipment[slot] === gearId) return true;
    return this.itemOwned(gearId) - this.itemInUseCount(slot, gearId, c.id, slot) > 0;
  }
  inventoryVM() {
    const rows: { slot: GearSlotKey; slotLabel: string; name: string; desc: string; icon?: ItemIconId; owned: number; free: number; wornBy: string[]; rarity: ReturnType<typeof rarityOf> }[] = [];
    for (const kind of GEAR_KINDS) {
      const slot = slotsForKind(kind)[0];
      for (const o of GEAR[kind]) {
        if (o.id === 'none') continue;
        const owned = this.itemOwned(o.id);
        if (owned <= 0) continue;
        const wornBy = this.pool.filter((c) => SLOT_ORDER.some((s2) => c.equipment[s2] === o.id)).map((c) => c.name);
        rows.push({ slot, slotLabel: SLOT_LABEL[slot], name: o.name, desc: o.desc, icon: o.icon, owned, free: owned - wornBy.length, wornBy, rarity: rarityOf(o) });
      }
    }
    return rows;
  }

  // ── trader ───────────────────────────────────────────────
  buyItem(slot: GearSlotKey, gearId: string) {
    const o = slotGear(slot).find((x) => x.id === gearId);
    if (!o || !o.price || this.gold < o.price) return;
    this.gold -= o.price;
    this.inventoryCounts[gearId] = (this.inventoryCounts[gearId] || 0) + 1;
    this.bumpDaily('gearChange');
    this.notify();
  }
  sellItem(slot: GearSlotKey, gearId: string) {
    const o = slotGear(slot).find((x) => x.id === gearId);
    if (!o || !o.price) return;
    const wornBy = this.wornCount(gearId);
    const free = this.itemOwned(gearId) - wornBy;
    if (free <= 0) return;
    this.inventoryCounts[gearId] = this.itemOwned(gearId) - 1;
    this.gold += Math.round(o.price * SELL_RATIO);
    this.notify();
  }
  shopBuyVM(): ShopBuyOption[] {
    const rows: ShopBuyOption[] = [];
    for (const kind of GEAR_KINDS) {
      const slot = slotsForKind(kind)[0];
      for (const o of GEAR[kind]) {
        if (!o.price) continue;
        rows.push({
          slot, id: o.id, name: o.name, desc: o.desc, icon: o.icon, price: o.price,
          affordable: this.gold >= o.price,
          onBuy: () => this.buyItem(slot, o.id),
        });
      }
    }
    return rows;
  }
  shopSellVM(): ShopSellRow[] {
    const rows: ShopSellRow[] = [];
    for (const kind of GEAR_KINDS) {
      const slot = slotsForKind(kind)[0];
      for (const o of GEAR[kind]) {
        if (!o.price) continue;
        const owned = this.itemOwned(o.id);
        if (owned <= 0) continue;
        const wornBy = this.wornCount(o.id);
        const free = owned - wornBy;
        if (free <= 0) continue;
        rows.push({
          slot, id: o.id, name: o.name, icon: o.icon, free,
          sellPrice: Math.round(o.price * SELL_RATIO),
          onSell: () => this.sellItem(slot, o.id),
        });
      }
    }
    return rows;
  }

  curioVM() {
    return CURIOS.map((c) => ({
      id: c.id, name: c.name, desc: c.desc, icon: c.icon, owned: this.curiosOwned.has(c.id),
    }));
  }
  private rollCurio(chance: number) {
    if (Math.random() >= chance) return null;
    const undiscovered = CURIOS.filter((c) => !this.curiosOwned.has(c.id));
    if (!undiscovered.length) return null;
    const pick = undiscovered[Math.floor(Math.random() * undiscovered.length)];
    this.curiosOwned.add(pick.id);
    return pick.name;
  }

  gearSlotsFor(c: Candidate): GearSlotVM[] {
    return SLOT_ORDER.map((slot) => {
      const cur = slotGear(slot).find((x) => x.id === c.equipment[slot]) || slotGear(slot)[0];
      return {
        label: SLOT_LABEL[slot],
        desc: cur.desc,
        options: slotGear(slot).map((o) => {
          const selected = o.id === cur.id;
          const available = this.itemAvailable(c, slot, o.id);
          const free = o.id === 'none' ? Infinity : this.itemOwned(o.id) - this.itemInUseCount(slot, o.id, c.id, slot);
          return {
            id: o.id,
            name: o.name,
            icon: o.icon,
            border: selected ? ACCENT : '#574a38',
            bg: selected ? 'rgba(201,163,107,0.14)' : 'transparent',
            color: selected ? '#ecd9b0' : available ? '#9397ab' : '#595d6c',
            disabled: !available,
            stockLabel: o.id === 'none' ? '' : `в наличии: ${Math.max(0, free)}`,
            onPick: () => {
              if (!this.itemAvailable(c, slot, o.id)) return;
              if (c.equipment[slot as GearSlotKey] !== o.id) this.bumpDaily('gearChange');
              c.equipment[slot as GearSlotKey] = o.id;
              this.notify();
            },
          };
        }),
      };
    });
  }

  private equipSlot(c: Candidate, slot: GearSlotKey, gearId: string) {
    if (!this.itemAvailable(c, slot, gearId)) return;
    if (c.equipment[slot] !== gearId) this.bumpDaily('gearChange');
    c.equipment[slot] = gearId;
    this.notify();
  }
  // Paperdoll view: what each slot wears plus the guild stash for that slot,
  // each piece carrying its rarity, stats and a diff against the worn one.
  equipmentVM(c: Candidate): EquipmentVM {
    const slots = SLOT_ORDER.map((slot): EquipSlotVM => {
      const worn = slotGear(slot).find((x) => x.id === c.equipment[slot]) || slotGear(slot)[0];
      const item = (o: GearOption): EquipItemVM => {
        const isWorn = o.id === worn.id;
        const wornBy = this.pool.filter((p) => SLOT_ORDER.some((s2) => (p.id !== c.id || s2 !== slot) && p.equipment[s2] === o.id)).map((p) => p.name);
        return {
          id: o.id,
          name: o.name,
          icon: o.icon,
          rarity: rarityOf(o),
          desc: o.desc,
          stats: statLines(o),
          compare: isWorn ? [] : compareLines(o, worn),
          setName: setNameOf(o.id),
          free: Math.max(0, this.itemOwned(o.id) - wornBy.length - (isWorn ? 1 : 0)),
          worn: isWorn,
          available: this.itemAvailable(c, slot, o.id),
          wornBy,
          onEquip: () => this.equipSlot(c, slot, o.id),
        };
      };
      return {
        slot,
        label: SLOT_LABEL[slot],
        equipped: worn.id === 'none' ? null : item(worn),
        stash: slotGear(slot).filter((o) => o.id !== 'none' && this.itemOwned(o.id) > 0).map(item),
        onUnequip: () => this.equipSlot(c, slot, 'none'),
      };
    });
    const g = this.gearMults(c);
    const sb = this.setBonusMults(c);
    const totals = statLines({
      id: 'total', name: '', desc: '',
      mult: g.outputMult * sb.outputMult, hpMult: g.hpMult * sb.hpMult,
      wardMult: g.wardMult * sb.wardMult, cdMult: g.cdMult * sb.cdMult,
    });
    return { slots, totals };
  }

  talentTiersFor(c: Candidate): TalentTier[] {
    return TALENT_TREE[c.id];
  }
  talentMults(c: Candidate) {
    const tiers = this.talentTiersFor(c);
    let outputMult = 1, hpMult = 1, wardMult = 1, cdMult = 1;
    c.talents.forEach((pick, i) => {
      if (!pick) return;
      const opt = tiers[i]?.options.find((o) => o.id === pick);
      if (!opt) return;
      outputMult *= opt.outputMult || 1;
      hpMult *= opt.hpMult || 1;
      wardMult *= opt.wardMult || 1;
      cdMult *= opt.cdMult || 1;
    });
    return { outputMult, hpMult, wardMult, cdMult };
  }
  chooseTalent(candidateId: number, tierIdx: number, optionId: string) {
    const c = this.pool.find((x) => x.id === candidateId);
    if (!c) return;
    const tier = this.talentTiersFor(c)[tierIdx];
    if (!tier || c.level < tier.level || c.talents[tierIdx] != null) return;
    c.talents[tierIdx] = optionId;
    this.notify();
  }
  talentVM(c: Candidate): TalentTierVM[] {
    const tiers = this.talentTiersFor(c);
    return tiers.map((tier, i) => {
      const unlocked = c.level >= tier.level;
      const pick = c.talents[i];
      return {
        level: tier.level,
        unlocked,
        chosen: pick != null,
        options: tier.options.map((o) => ({
          id: o.id,
          name: o.name,
          desc: o.desc,
          icon: o.icon,
          selected: pick === o.id,
          disabled: !unlocked || pick != null,
          onPick: () => this.chooseTalent(c.id, i, o.id),
        })),
      };
    });
  }

  // ── class ────────────────────────────────────────────────
  classOptionsFor(c: Candidate) {
    return CLASSES[c.role];
  }
  classMults(c: Candidate) {
    const opt = c.classId ? this.classOptionsFor(c).find((o) => o.id === c.classId) : null;
    return {
      outputMult: opt?.outputMult || 1,
      hpMult: opt?.hpMult || 1,
      wardMult: opt?.wardMult || 1,
    };
  }
  chooseClass(candidateId: number, classId: string) {
    const c = this.pool.find((x) => x.id === candidateId);
    if (!c || c.classId != null) return;
    if (!this.classOptionsFor(c).some((o) => o.id === classId)) return;
    c.classId = classId;
    this.notify();
  }
  classOptionsVM(c: Candidate): TalentOptionVM[] {
    return this.classOptionsFor(c).map((o) => ({
      id: o.id,
      name: o.name,
      desc: o.desc,
      selected: c.classId === o.id,
      disabled: c.classId != null,
      onPick: () => this.chooseClass(c.id, o.id),
    }));
  }

  // ── gear sets ────────────────────────────────────────────
  setBonusesFor(c: Candidate): { set: GearSetDef; count: number }[] {
    return GEAR_SETS.map((set) => {
      let count = 0;
      if (c.equipment.weapon === set.weapon) count++;
      if (c.equipment.chest === set.armor) count++;
      if (c.equipment.necklace === set.trinket) count++;
      return { set, count };
    }).filter((x) => x.count > 0);
  }
  setBonusMults(c: Candidate) {
    let outputMult = 1, hpMult = 1, wardMult = 1, cdMult = 1;
    for (const { set, count } of this.setBonusesFor(c)) {
      if (count < 2) continue;
      const apply = (b: SetBonusDef) => {
        outputMult *= b.outputMult ?? 1; hpMult *= b.hpMult ?? 1; wardMult *= b.wardMult ?? 1; cdMult *= b.cdMult ?? 1;
      };
      apply(set.bonus2);
      if (count >= 3) apply(set.bonus3);
    }
    return { outputMult, hpMult, wardMult, cdMult };
  }
  setProgressVM(c: Candidate) {
    return this.setBonusesFor(c).map(({ set, count }) => ({
      name: set.name,
      count,
      bonus2Desc: set.bonus2.desc,
      bonus3Desc: set.bonus3.desc,
      active2: count >= 2,
      active3: count >= 3,
    }));
  }

  // ── profession ───────────────────────────────────────────
  professionMults(c: Candidate) {
    const opt = c.professionId ? PROFESSIONS.find((o) => o.id === c.professionId) : null;
    if (!opt) return { outputMult: 1, hpMult: 1, wardMult: 1, cdMult: 1 };
    return {
      outputMult: scaledMult(opt.outputMult, c.professionLevel),
      hpMult: scaledMult(opt.hpMult, c.professionLevel),
      wardMult: scaledMult(opt.wardMult, c.professionLevel),
      cdMult: scaledMult(opt.cdMult, c.professionLevel),
    };
  }
  chooseProfession(candidateId: number, professionId: string) {
    const c = this.pool.find((x) => x.id === candidateId);
    if (!c || c.professionId != null) return;
    if (!PROFESSIONS.some((o) => o.id === professionId)) return;
    c.professionId = professionId;
    c.professionLevel = 1;
    c.professionXp = 0;
    this.notify();
  }
  professionOptionsVM(c: Candidate) {
    return PROFESSIONS.map((o) => ({
      id: o.id,
      name: o.name,
      desc: o.desc,
      icon: o.icon,
      selected: c.professionId === o.id,
      disabled: c.professionId != null,
      onPick: () => this.chooseProfession(c.id, o.id),
    }));
  }
  private professionBonusLines(opt: { outputMult?: number; hpMult?: number; wardMult?: number; cdMult?: number }, level: number): string[] {
    const lines: string[] = [];
    const pct = (v: number) => Math.round(Math.abs(v - 1) * 100);
    if (opt.hpMult !== undefined) lines.push(`${opt.hpMult >= 1 ? '+' : '-'}${pct(scaledMult(opt.hpMult, level))}% к максимальному HP`);
    if (opt.outputMult !== undefined) lines.push(`${opt.outputMult >= 1 ? '+' : '-'}${pct(scaledMult(opt.outputMult, level))}% к урону/лечению`);
    if (opt.wardMult !== undefined) lines.push(`${opt.wardMult <= 1 ? '-' : '+'}${pct(scaledMult(opt.wardMult, level))}% к получаемому урону`);
    if (opt.cdMult !== undefined) lines.push(`${opt.cdMult <= 1 ? '-' : '+'}${pct(scaledMult(opt.cdMult, level))}% к перезарядке способности`);
    return lines;
  }
  professionVM(c: Candidate) {
    const opt = c.professionId ? PROFESSIONS.find((o) => o.id === c.professionId) : null;
    if (!opt) return null;
    const atMax = c.professionLevel >= PROFESSION_MAX_LEVEL;
    const cost = professionTrainCost(c.professionLevel);
    return {
      id: opt.id,
      name: opt.name,
      desc: opt.desc,
      icon: opt.icon,
      level: c.professionLevel,
      maxLevel: PROFESSION_MAX_LEVEL,
      xp: c.professionXp,
      xpPerLevel: PROFESSION_XP_PER_LEVEL,
      atMax,
      currentBonusLines: this.professionBonusLines(opt, c.professionLevel),
      nextBonusLines: atMax ? null : this.professionBonusLines(opt, c.professionLevel + 1),
      trainCost: atMax ? null : cost,
      canAffordTrain: !atMax && this.gold >= cost,
      onTrain: () => this.trainProfession(c.id),
    };
  }
  trainProfession(candidateId: number) {
    const c = this.pool.find((x) => x.id === candidateId);
    if (!c || !c.professionId || c.professionLevel >= PROFESSION_MAX_LEVEL) return;
    const cost = professionTrainCost(c.professionLevel);
    if (this.gold < cost) return;
    this.gold -= cost;
    c.professionXp += 15 + Math.floor(Math.random() * 11);
    while (c.professionXp >= PROFESSION_XP_PER_LEVEL && c.professionLevel < PROFESSION_MAX_LEVEL) {
      c.professionXp -= PROFESSION_XP_PER_LEVEL;
      c.professionLevel++;
    }
    if (c.professionLevel >= PROFESSION_MAX_LEVEL) c.professionXp = 0;
    this.notify();
  }

  // ── crafting ─────────────────────────────────────────────
  reagentOwned(reagentId: string): number {
    return this.reagentCounts[reagentId] || 0;
  }
  reagentInventoryVM() {
    return REAGENTS.map((r) => ({ id: r.id, name: r.name, desc: r.desc, icon: r.icon, owned: this.reagentOwned(r.id) })).filter((r) => r.owned > 0);
  }
  recipesVM(c: Candidate) {
    if (!c.professionId) return [];
    return RECIPES.filter((r) => r.professionId === c.professionId).map((r) => {
      const reagent = REAGENTS.find((x) => x.id === r.reagentId)!;
      const owned = this.reagentOwned(r.reagentId);
      const unlocked = c.professionLevel >= r.unlockLevel;
      const gearOpt = GEAR[r.slot].find((o) => o.id === r.gearId)!;
      const craftable = unlocked && owned >= r.reagentQty && this.gold >= r.goldCost;
      return {
        id: r.id,
        name: r.name,
        slot: slotsForKind(r.slot)[0],
        slotLabel: SLOT_LABEL[slotsForKind(r.slot)[0]],
        resultDesc: gearOpt.desc,
        resultIcon: gearOpt.icon,
        unlocked,
        unlockLevel: r.unlockLevel,
        reagentName: reagent.name,
        reagentIcon: reagent.icon,
        reagentOwned: owned,
        reagentNeeded: r.reagentQty,
        goldCost: r.goldCost,
        craftable,
        onCraft: () => this.craftItem(c.id, r.id),
      };
    });
  }
  craftItem(candidateId: number, recipeId: string) {
    const c = this.pool.find((x) => x.id === candidateId);
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!c || !r || c.professionId !== r.professionId) return;
    if (c.professionLevel < r.unlockLevel) return;
    if (this.reagentOwned(r.reagentId) < r.reagentQty) return;
    if (this.gold < r.goldCost) return;
    this.reagentCounts[r.reagentId] -= r.reagentQty;
    this.gold -= r.goldCost;
    this.inventoryCounts[r.gearId] = (this.inventoryCounts[r.gearId] || 0) + 1;
    this.everCrafted = true;
    this.notify();
  }

  // ── analytics ────────────────────────────────────────────
  analyticsVM(): AnalyticsVM {
    const roomWins = this.statsRoomWins, bossWins = this.statsBossWins, wipes = this.statsWipes;
    const decisive = bossWins + wipes;
    const avgMorale = this.pool.length ? Math.round(this.pool.reduce((sum, c) => sum + c.morale, 0) / this.pool.length) : 0;
    return {
      winRatePct: decisive ? Math.round((bossWins / decisive) * 100) : null,
      totalFights: roomWins + bossWins + wipes,
      roomWins, bossWins, wipes,
      kpiDone: this.claimedQuestIds.size,
      kpiTotal: QUESTS.length,
      avgMorale,
      gold: this.gold,
      history: this.history,
    };
  }

  // ── personnel ────────────────────────────────────────────
  personnelVM(): PersonnelVM {
    return {
      roster: this.pool.map((c) => ({
        id: c.id,
        name: c.name,
        epithet: c.epithet,
        role: c.role,
        className: c.classId ? (CLASSES[c.role].find((cl) => cl.id === c.classId)?.name ?? null) : null,
        professionName: c.professionId ? (PROFESSIONS.find((p) => p.id === c.professionId)?.name ?? null) : null,
        level: c.level,
        morale: c.morale,
        story: c.story,
      })),
      departed: this.departedLog,
    };
  }

  // ── quests ───────────────────────────────────────────────
  questVM(): QuestVM[] {
    return QUESTS.map((q) => ({
      id: q.id,
      name: q.name,
      desc: q.desc,
      rewardDesc: q.rewardDesc,
      achieved: q.check(this),
      claimed: this.claimedQuestIds.has(q.id),
      onClaim: () => this.claimQuest(q.id),
    }));
  }
  claimQuest(id: string) {
    if (this.claimedQuestIds.has(id)) return;
    const q = QUESTS.find((x) => x.id === id);
    if (!q || !q.check(this)) return;
    this.claimedQuestIds.add(id);
    for (const c of this.pool) this.adjustMorale(c.id, q.rewardMorale);
    this.notify();
  }

  // ── achievements ─────────────────────────────────────────
  achievementVM() {
    return ACHIEVEMENTS.map((a) => ({
      id: a.id,
      name: a.name,
      desc: a.desc,
      rewardDesc: `+${a.rewardGold} золота`,
      achieved: a.check(this),
      claimed: this.claimedAchievementIds.has(a.id),
      onClaim: () => this.claimAchievement(a.id),
    }));
  }
  claimAchievement(id: string) {
    if (this.claimedAchievementIds.has(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a || !a.check(this)) return;
    this.claimedAchievementIds.add(id);
    this.gold += a.rewardGold;
    this.notify();
  }

  // ── daily quests ─────────────────────────────────────────
  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }
  private ensureDailyFresh() {
    const today = this.todayKey();
    if (this.dailyDate !== today) {
      this.dailyDate = today;
      this.dailyProgress = {};
      this.dailyClaimedIds = new Set();
    }
  }
  private bumpDaily(metric: DailyMetric, amount = 1) {
    this.ensureDailyFresh();
    this.dailyProgress[metric] = (this.dailyProgress[metric] || 0) + amount;
  }
  dailyQuestVM(): (QuestVM & { progress: number; target: number })[] {
    this.ensureDailyFresh();
    return pickDailyTemplates(this.dailyDate).map((t) => {
      const progress = Math.min(t.target, this.dailyProgress[t.metric] || 0);
      return {
        id: t.id,
        name: t.name,
        desc: t.desc,
        rewardDesc: `+${t.rewardGold} золота`,
        achieved: progress >= t.target,
        claimed: this.dailyClaimedIds.has(t.id),
        progress,
        target: t.target,
        onClaim: () => this.claimDailyQuest(t.id),
      };
    });
  }
  claimDailyQuest(id: string) {
    this.ensureDailyFresh();
    if (this.dailyClaimedIds.has(id)) return;
    const t = pickDailyTemplates(this.dailyDate).find((x) => x.id === id);
    if (!t || (this.dailyProgress[t.metric] || 0) < t.target) return;
    this.dailyClaimedIds.add(id);
    this.gold += t.rewardGold;
    this.notify();
  }

  gainXp(cid: number, amount: number) {
    const c = this.pool.find((x) => x.id === cid);
    if (!c || c.level >= MAX_LEVEL) return;
    c.xp += amount;
    while (c.xp >= XP_PER_LEVEL && c.level < MAX_LEVEL) {
      c.xp -= XP_PER_LEVEL;
      c.level++;
      this.bumpDaily('levelUp');
    }
    if (c.level >= MAX_LEVEL) c.xp = XP_PER_LEVEL;
  }
  adjustMorale(cid: number, d: number) {
    const c = this.pool.find((x) => x.id === cid);
    if (c) c.morale = Math.max(0, Math.min(100, c.morale + d));
  }

  // ── HR: payroll & headcount ────────────────────────────────
  // Charged whenever the squad returns from the field — win or wipe, the
  // guild's active roster still drew a wage. Only the 5 fielded members
  // count; benched personnel cost nothing.
  runPayroll() {
    const active = this.squad();
    if (!active.length) return;
    const due = active.reduce((sum, c) => sum + PAYROLL_BASE + c.level * PAYROLL_PER_LEVEL + (this.raises[c.id] ?? 0), 0);
    if (this.gold >= due) {
      this.gold -= due;
      this.payrollNotice = { paid: due, shortfall: false };
    } else {
      const paid = this.gold;
      this.gold = 0;
      for (const c of this.pool) this.adjustMorale(c.id, -8);
      this.payrollNotice = { paid, shortfall: true };
    }
  }
  /** Output penalty from open HR trouble: a feuding pair fielded together, or a go-slow strike. */
  hrMult(cid: number, squadIds: number[]): number {
    let m = 1;
    const f = this.feud;
    if (f && (cid === f.a || cid === f.b) && squadIds.includes(f.a) && squadIds.includes(f.b)) m *= FEUD_MULT;
    if (this.strikeTrips > 0) m *= STRIKE_MULT;
    return m;
  }
  /** Line for the combat log at the start of a trip, if HR trouble follows the squad in. */
  hrNote(): string | null {
    if (this.inArena) return null;
    const ids = this.squad().map((c) => c.id);
    const notes: string[] = [];
    const f = this.feud;
    if (f && ids.includes(f.a) && ids.includes(f.b)) notes.push(`${this.nameOf(f.a)} и ${this.nameOf(f.b)} в ссоре и не прикрывают друг друга (−${Math.round((1 - FEUD_MULT) * 100)}% урона).`);
    if (this.strikeTrips > 0) notes.push(`Итальянская забастовка: отряд работает строго по инструкции (−${Math.round((1 - STRIKE_MULT) * 100)}% урона).`);
    return notes.length ? notes.join(' ') : null;
  }
  nameOf(cid: number): string {
    return this.pool.find((c) => c.id === cid)?.name ?? ALL_CANDIDATES.find((c) => c.id === cid)?.name ?? '—';
  }
  /** Each trip back to camp wears down open HR trouble. */
  private tickHr() {
    if (this.feud) {
      const f = this.feud;
      if (!this.pool.some((c) => c.id === f.a) || !this.pool.some((c) => c.id === f.b)) this.feud = null;
      else if (--f.trips <= 0) this.feud = null;
    }
    if (this.strikeTrips > 0) this.strikeTrips--;
    for (const id of Object.keys(this.raises)) if (!this.pool.some((c) => c.id === Number(id))) delete this.raises[Number(id)];
  }
  dismissPayrollNotice() {
    this.payrollNotice = null;
    this.notify();
  }

  // ── hiring ───────────────────────────────────────────────
  hireVM(): HireOptionVM[] {
    const hiredIds = new Set(this.pool.map((c) => c.id));
    return RECRUITS.filter((r) => !hiredIds.has(r.id)).map((r) => ({
      id: r.id, name: r.name, epithet: r.epithet, role: r.role, attackRange: r.attackRange,
      bio: r.bio, story: r.story, hp: r.hp, dps: r.dps, healPower: r.healPower, gs: r.gs,
      cost: r.hireCost ?? 0,
      affordable: this.gold >= (r.hireCost ?? 0),
      onHire: () => this.hireRecruit(r.id),
    }));
  }
  hireRecruit(id: number) {
    if (this.pool.some((c) => c.id === id)) return;
    const def = RECRUITS.find((r) => r.id === id);
    if (!def) return;
    const cost = def.hireCost ?? 0;
    if (this.gold < cost) return;
    this.gold -= cost;
    this.pool.push({ ...def, level: 1, xp: 0, equipment: emptyEquipment(), talents: [null, null, null, null], classId: null, professionId: null, professionLevel: 1, professionXp: 0 });
    this.notify();
  }

  canFire(): boolean {
    return this.pool.length > MIN_ROSTER;
  }
  fireCandidate(id: number, reason: 'fired' | 'resigned' = 'fired') {
    if (!this.canFire()) return;
    const idx = this.pool.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const c = this.pool[idx];
    this.departedLog.unshift({ name: c.name, epithet: c.epithet, role: c.role, story: c.story, level: c.level, reason });
    if (this.departedLog.length > DEPARTED_LOG_LIMIT) this.departedLog.pop();
    this.pool.splice(idx, 1);
    this.selected.delete(id);
    for (const other of this.pool) this.adjustMorale(other.id, -5);
    if (this.charId === id) this.charId = null;
    this.notify();
  }

  dismissResignationNotice() {
    this.resignationNotice = null;
    this.notify();
  }
  /** A burned-out employee (very low morale) may quit on their own, independent of anything the player chooses. */
  private checkResignations() {
    if (!this.canFire()) return;
    const atRisk = this.pool.filter((c) => c.morale < RESIGNATION_MORALE_THRESHOLD);
    if (!atRisk.length || Math.random() >= RESIGNATION_CHANCE) return;
    const leaver = atRisk[Math.floor(Math.random() * atRisk.length)];
    const name = leaver.name;
    this.fireCandidate(leaver.id, 'resigned');
    this.resignationNotice = { name };
  }
  dismissEmployeeOfMonthNotice() {
    this.employeeOfMonthNotice = null;
    this.notify();
  }
  /** Every few trips back to camp, the guild recognizes its strongest performer with a small morale boost. */
  private checkEmployeeOfMonth() {
    this.campReturns++;
    if (this.campReturns % EMPLOYEE_OF_MONTH_CYCLE !== 0 || !this.pool.length) return;
    let best = this.pool[0];
    for (const c of this.pool) {
      if (c.level * 10 + c.morale > best.level * 10 + best.morale) best = c;
    }
    const cost = 20;
    if (this.gold >= cost) this.gold -= cost;
    for (const c of this.pool) this.adjustMorale(c.id, c.id === best.id ? 20 : 5);
    this.employeeOfMonthNotice = { name: best.name };
  }
  private recordHistory() {
    const avgMorale = this.pool.length ? Math.round(this.pool.reduce((sum, c) => sum + c.morale, 0) / this.pool.length) : 0;
    this.history.push({ gold: this.gold, avgMorale });
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
  }

  // ── HR: office events ────────────────────────────────────
  // A chance, every time the squad comes back to camp, of a small text-only
  // HR scenario with two consequences to pick between.
  private tryBuildEvent() {
    if (this.isUnlocked('personnel') && Math.random() < 0.6) {
      // A strike, when morale is low enough for one, jumps the queue.
      for (const def of [...STAFF_EVENTS].sort((x, y) => Number(y.id === 'strike') - Number(x.id === 'strike') || Math.random() - 0.5)) {
        const built = def.build(this);
        if (built) return built;
      }
    }
    const order = [...OFFICE_EVENTS].sort(() => Math.random() - 0.5);
    for (const def of order) {
      const built = def.build(this);
      if (built) return built;
    }
    return null;
  }
  /** Returns true if an event was triggered (caller should route to the 'event' screen instead of going straight to camp). */
  private maybeTriggerEvent(returnTo: Screen, force = false): boolean {
    if (!force && Math.random() >= 0.4) return false;
    const built = this.tryBuildEvent();
    if (!built) return false;
    this.pendingEventOptions = built.options;
    this.activeEvent = { title: built.title, desc: built.desc, labelA: built.options[0].label, labelB: built.options[1].label, resultText: null, faces: built.faces ?? [], stakes: built.stakes ?? null };
    this.postEventScreen = returnTo;
    return true;
  }
  chooseEvent(which: 'a' | 'b') {
    if (!this.activeEvent || !this.pendingEventOptions) return;
    const opt = this.pendingEventOptions[which === 'a' ? 0 : 1];
    const resultText = opt.apply(this);
    this.activeEvent = { ...this.activeEvent, resultText };
    this.pendingEventOptions = null;
    this.notify();
  }
  dismissEvent() {
    this.activeEvent = null;
    this.go(this.postEventScreen);
  }
  private returnToCamp(target: Screen) {
    this.runPayroll();
    this.checkResignations();
    this.checkEmployeeOfMonth();
    this.tickHr();
    this.recordHistory();
    if (this.maybeTriggerEvent(target)) { this.screen = 'event'; this.notify(); return; }
    this.go(target);
  }

  log(text: string, kind?: LogKind) {
    const s = this.sim;
    if (!s) return;
    s.log.push({ text, kind });
    while (s.log.length > 3) s.log.shift();
  }

  // ── combat setup ─────────────────────────────────────────
  makeAbility(candidateId: number, cdMult: number): Ability {
    const def = ABILITY_BY_CANDIDATE[candidateId];
    return { kind: def.kind, icon: def.icon, cd: 0, cdMax: Math.max(1, Math.round(def.cdMax * cdMult)), active: false, activeRounds: 0, activeMax: def.activeMax };
  }

  // Classic RPG attributes, purely a flavorful read-out of the same combat
  // math makeRaiders() uses — they grow with level/gear/talents/profession
  // exactly like real combat power does, but touch no balance numbers of
  // their own, so there's nothing new to tune or break.
  attributesFor(c: Candidate) {
    const gm = this.gearMults(c);
    const tm = this.talentMults(c);
    const cm = this.classMults(c);
    const pm = this.professionMults(c);
    const sm = this.setBonusMults(c);
    const moraleMult = c.morale >= 80 ? 1.05 : c.morale < 30 ? 0.90 : 1;
    const lvl = 1 + (c.level - 1) * 0.02;
    const outputMult = gm.outputMult * tm.outputMult * cm.outputMult * pm.outputMult * sm.outputMult * moraleMult;
    const hpMult = gm.hpMult * tm.hpMult * cm.hpMult * pm.hpMult * sm.hpMult;
    const effDps = c.dps * outputMult * lvl;
    const effHeal = (c.healPower || 0) * outputMult * lvl;
    const effHp = c.hp * hpMult * lvl;
    const baseSpeed: Record<Role, number> = { dps: 12, heal: 9, tank: 6 };
    const speed = baseSpeed[c.role] + (c.id % 5) * 0.1;
    const melee = c.attackRange === 'melee';
    return {
      strength: Math.round(effDps * (melee ? 2.5 : 0.8) + (c.role === 'tank' ? 20 : 0)),
      agility: Math.round(effDps * (melee ? 0.8 : 2.5) + (c.attackRange === 'ranged' ? 5 : 0)),
      intellect: Math.round(effHeal * 10 + lvl * 6),
      stamina: Math.round(effHp / 8),
      initiative: Math.round(speed * 10),
    };
  }

  makeRaiders(squad: Candidate[]): Raider[] {
    const squadIds = squad.map((c) => c.id);
    const baseSpeed: Record<Role, number> = { dps: 12, heal: 9, tank: 6 };
    return squad.map((d, i) => {
      const gm = this.gearMults(d);
      const tm = this.talentMults(d);
      const cm = this.classMults(d);
      const pm = this.professionMults(d);
      const sm = this.setBonusMults(d);
      // A satisfied employee performs better — an unhappy one phones it in.
      const moraleMult = d.morale >= 80 ? 1.05 : d.morale < 30 ? 0.90 : 1;
      // Spread over the full 30-level track rather than the old 5-level one —
      // +2%/level caps at +58% instead of the old +20%, so a maxed veteran is
      // meaningfully stronger without trivialising the early campaign.
      const lvl = 1 + (d.level - 1) * 0.02;
      const maxHp = Math.round(d.hp * gm.hpMult * tm.hpMult * cm.hpMult * pm.hpMult * sm.hpMult * lvl);
      return {
        id: i, name: d.name, role: d.role, attackRange: d.attackRange, candidateId: d.id, trait: d.trait, level: d.level,
        maxHp, hp: maxHp, alive: true, dps: d.dps, healPower: d.healPower || 9,
        outputMult: gm.outputMult * tm.outputMult * cm.outputMult * pm.outputMult * sm.outputMult * moraleMult * (this.inArena ? 1 : this.hrMult(d.id, squadIds)),
        wardMult: gm.wardMult * tm.wardMult * cm.wardMult * pm.wardMult * sm.wardMult, levelMult: lvl,
        speed: baseSpeed[d.role] + (d.id % 5) * 0.1,
        chainPartner: null, defending: false, ability: this.makeAbility(d.id, gm.cdMult * tm.cdMult * pm.cdMult * sm.cdMult),
        row: BACK_ROW, col: i + 1,
      };
    });
  }

  private buildRoomGroup(totalHp: number, roomIdx: number): Enemy[] {
    const roles = roomGroupRoles(roomIdx);
    const hps = roles.map((r) => (r === 'brute' ? 0 : Math.round(totalHp * ENEMY_HP_SHARE[r])));
    hps[0] = totalHp - hps.reduce((a, b) => a + b, 0);
    return roles.map((role, i) => ({ id: i, role, name: ENEMY_NAME[role], maxHp: hps[i], hp: hps[i], alive: true, ...ROOM_START[i] }));
  }

  // The helm/gloves/boots/ring slots added power the dungeons were never
  // tuned for; deeper dungeons (where those pieces are actually owned) get
  // proportionally tougher so the curve stays where it was.
  slotCompMult(kind: 'hp' | 'dmg'): number {
    // Zero through the first location (3 dungeons), full by the last one.
    const idx = Math.max(0, DUNGEONS.findIndex((d) => d.id === this.dungeonId) - 2);
    return 1 + (kind === 'hp' ? GEAR_SLOT_COMP_HP : GEAR_SLOT_COMP_DMG) * idx / (DUNGEONS.length - 3);
  }

  freshSim(enc: EncounterDef, keepRaiders: Raider[] | null, roomIdx = 0): Sim {
    const raiders = keepRaiders || this.makeRaiders(this.squad());
    const dmgMult = this.inArena
      ? (this.arenaOpponent?.dmgMult ?? 1)
      : (this.currentDungeon().dmgMult ?? 1) * (this.inWeeklyChallenge ? this.weeklyModifierDmgMult : 1) * this.slotCompMult('dmg');
    const encHp = Math.round(enc.hp * (this.inArena ? 1 : this.slotCompMult('hp')));
    raiders.forEach((r, i) => {
      r.chainPartner = null;
      r.defending = false;
      r.row = BACK_ROW; r.col = i + 1;
      if (r.ability) { r.ability.active = false; r.ability.activeRounds = 0; r.ability.cd = 0; }
    });
    const enemies = enc.type === 'room' ? this.buildRoomGroup(Math.round(encHp * ROOM_GROUP_HP_MULT), roomIdx) : [];
    return {
      boss: { name: enc.enemyName, maxHp: enemies.length ? enemies.reduce((a, e) => a + e.maxHp, 0) : encHp, hp: enemies.length ? enemies.reduce((a, e) => a + e.hp, 0) : encHp },
      bossPos: enemies.length ? null : { ...BOSS_START },
      enemies, minions: [], focusId: enemies.length ? enemies[0].id : null,
      fx: { seq: 0, actor: null, kind: null, crit: false, targetEnemy: null, targetRaider: null },
      impact: { seq: 0, cells: [], kind: null }, shakeSeq: 0, dodge: { seq: 0, ids: [] }, victory: false, windup: false, moveFx: null,
      signature: enc.type === 'boss' && !this.inArena ? this.currentDungeon().signature ?? null : null,
      sigTimer: 2, iceShell: false, debt: null, execution: null, quota: null, lava: [],
      name: enc.name, raiders, encounterType: enc.type, dmgMult,
      round: 1, order: [], turnPos: -1, awaitingPlayer: false, movePhase: false, bossCyclePos: 0,
      bossMoveTimers: { beam: 1, meteor: 2, poison: 3, chain: 3, brace: 3, freeze: 2, curse: 2, cleave: 2 },
      pendingCast: null, chain: null, poison: null, bossPoison: null, partyWard: null, braceCall: null,
      frozen: null, ashCurse: null, danger: null,
      stagger: 0, stunned: false, vulnerableRounds: 0, inspiredRounds: 0,
      enrageAt: enc.type === 'boss' ? ENRAGE_ROUND_BOSS : ENRAGE_ROUND_ROOM,
      rallyCd: 0, tilt: 0, phase: 1, log: [], over: false, selected: null,
    };
  }

  startEncounter = () => {
    const enc = this.currentDungeon().encounters[this.encIdx];
    const keep = this.sim && this.sim.raiders.some((r) => r.alive) ? this.sim.raiders : null;
    this.sim = this.freshSim(enc, keep, this.encIdx);
    this.log(enc.type === 'boss' ? 'Пул начался. Рейд-лидер, командуй!' : 'Отряд входит в бой: ' + enc.name + ' — ' + enc.enemyName.toLowerCase() + '. Выберите цель, нажав на врага.');
    const hr = keep ? null : this.hrNote();
    if (hr) this.log(hr, 'warn');
    this.screen = 'combat';
    this.beginRound();
    if (enc.type === 'boss') this.openBossIntro(enc.enemyName, this.currentDungeon().name, enc.desc);
    else if (!this.sim.over) this.advanceTurn();
    this.notify();
  };

  private openBossIntro(name: string, place: string, line: string) {
    this.bossIntro = { name, place, line };
    // Safety net: the screen normally closes it (on a timer or a tap).
    if (this.introTimer) clearTimeout(this.introTimer);
    this.introTimer = setTimeout(() => this.endBossIntro(), 8000);
  }
  /** Closes the boss title card and lets the fight's first turn go. */
  endBossIntro = () => {
    if (!this.bossIntro) return;
    this.bossIntro = null;
    if (this.introTimer) { clearTimeout(this.introTimer); this.introTimer = null; }
    if (this.sim && !this.sim.over && this.screen === 'combat') this.advanceTurn();
    this.notify();
  };

  // ── arena (offline PvP) ──────────────────────────────────
  arenaRankName(): string {
    return arenaRankName(this.arenaRating);
  }
  private generateArenaOpponent() {
    const raiders = this.makeRaiders(this.squad());
    const totalMaxHp = raiders.reduce((s, r) => s + r.maxHp, 0);
    const totalDps = raiders.reduce((s, r) => s + r.dps * (r.outputMult || 1) * (r.levelMult || 1), 0);
    const ratingFactor = Math.max(0.6, Math.min(2.2, 1 + (this.arenaRating - 1000) / 600));
    const hp = Math.max(200, Math.round(totalDps * 16 * ratingFactor));
    const dmgMult = Math.max(0.55, Math.min(1.8, 0.85 * ratingFactor));
    const name = ARENA_RIVALS[Math.floor(Math.random() * ARENA_RIVALS.length)];
    return {
      name, hp, dmgMult,
      goldReward: 25 + Math.round(18 * ratingFactor),
      ratingWin: 22, ratingLoss: 14,
      totalMaxHpHint: totalMaxHp,
    };
  }
  arenaVM() {
    if (!this.arenaOpponent && this.squadReady()) this.arenaOpponent = this.generateArenaOpponent();
    return {
      rating: this.arenaRating,
      rank: this.arenaRankName(),
      wins: this.arenaWins,
      losses: this.arenaLosses,
      opponent: this.arenaOpponent,
      ready: this.squadReady(),
      onReroll: () => { this.arenaOpponent = this.squadReady() ? this.generateArenaOpponent() : null; this.notify(); },
      onFight: () => this.startArenaFight(),
    };
  }
  startArenaFight() {
    if (!this.squadReady()) return;
    if (!this.arenaOpponent) this.arenaOpponent = this.generateArenaOpponent();
    this.inArena = true;
    const opp = this.arenaOpponent;
    const enc: EncounterDef = { type: 'boss', name: 'Арена', enemyName: opp.name, hp: opp.hp, desc: '' };
    this.sim = this.freshSim(enc, null);
    this.log('Отряд выходит на арену против ' + opp.name + '.');
    this.screen = 'combat';
    this.beginRound();
    if (!this.sim.over) this.advanceTurn();
    this.notify();
  }
  private endArenaGame(win: boolean) {
    const s = this.sim!; s.over = true;
    this.clearTurnTimer();
    this.haptic(() => Haptics.notificationAsync(win ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error));
    const opp = this.arenaOpponent!;
    let goldFound = 0;
    if (win) {
      this.arenaWins++;
      this.arenaRating += opp.ratingWin;
      goldFound = opp.goldReward;
      this.gold += goldFound;
      this.bumpDaily('goldEarned', goldFound);
    } else {
      this.arenaLosses++;
      this.arenaRating = Math.max(600, this.arenaRating - opp.ratingLoss);
    }
    this.result = { win, isBoss: true, loot: [], curioFound: null, goldFound, reagentFound: null };
    this.screen = 'results';
    this.notify();
  }

  goDungeon() {
    this.encIdx = 0;
    this.sim = null;
    this.go('dungeon');
  }

  // ── weekly challenge (boss re-fight with a rotating modifier) ────
  private weekKey(): string {
    const days = Math.floor(Date.now() / 86400000);
    return 'w' + Math.floor(days / 7);
  }
  private ensureWeeklyFresh() {
    const wk = this.weekKey();
    if (this.weeklyChallengeWeek !== wk) {
      this.weeklyChallengeWeek = wk;
      this.weeklyClaimed = false;
    }
  }
  private currentWeeklyChallenge(): { dungeon: DungeonDef; encounter: EncounterDef; modifier: WeeklyModifierDef } | null {
    this.ensureWeeklyFresh();
    const cleared = DUNGEONS.filter((d) => this.defeatedDungeons.has(d.id));
    const dungeonId = pickWeeklyDungeonId(this.weeklyChallengeWeek, cleared.map((d) => d.id));
    if (!dungeonId) return null;
    const dungeon = DUNGEONS.find((d) => d.id === dungeonId)!;
    const modifier = pickWeeklyModifier(this.weeklyChallengeWeek);
    const encounter = dungeon.encounters[dungeon.encounters.length - 1];
    return { dungeon, encounter, modifier };
  }
  weeklyChallengeVM() {
    const cur = this.currentWeeklyChallenge();
    if (!cur) {
      return {
        available: false as const,
        claimed: this.weeklyClaimed,
        ready: this.squadReady(),
      };
    }
    const loc = LOCATIONS.find((l) => l.id === cur.dungeon.locationId);
    return {
      available: true as const,
      dungeonName: cur.dungeon.name,
      locationName: loc?.name ?? '',
      bossName: cur.encounter.enemyName,
      modifierName: cur.modifier.name,
      modifierDesc: cur.modifier.desc,
      claimed: this.weeklyClaimed,
      ready: this.squadReady(),
      onFight: () => this.startWeeklyChallenge(),
    };
  }
  startWeeklyChallenge() {
    const cur = this.currentWeeklyChallenge();
    if (!cur || !this.squadReady() || this.weeklyClaimed) return;
    this.inWeeklyChallenge = true;
    this.weeklyModifierDmgMult = cur.modifier.dmgMult;
    this.dungeonId = cur.dungeon.id;
    const enc: EncounterDef = { ...cur.encounter, hp: Math.round(cur.encounter.hp * cur.modifier.hpMult) };
    this.sim = this.freshSim(enc, null);
    this.log('Отряд выходит на испытание недели: ' + cur.dungeon.name + ' (' + cur.modifier.name + ').');
    this.screen = 'combat';
    this.beginRound();
    this.openBossIntro(cur.encounter.enemyName, 'Испытание недели · ' + cur.modifier.name, cur.encounter.desc);
    this.notify();
  }
  private endWeeklyChallenge(win: boolean) {
    const s = this.sim!; s.over = true;
    this.clearTurnTimer();
    this.haptic(() => Haptics.notificationAsync(win ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error));
    const cur = this.currentWeeklyChallenge();
    let loot: LootItem[] = [];
    let curioFound: string | null = null;
    let goldFound = 0;
    let reagentFound: ReagentDrop | null = null;
    if (win && cur) {
      for (const r of s.raiders) this.gainXp(r.candidateId, 40);
      this.weeklyClaimed = true;
      this.statsBossWins++;
      this.bumpDaily('bossWin');
      goldFound = Math.round((70 + Math.floor(Math.random() * 41)) * cur.modifier.goldMult);
      const reagentDef = REAGENT_BY_LOCATION[cur.dungeon.locationId];
      if (reagentDef) {
        const qty = 2 + Math.floor(Math.random() * 2) + cur.modifier.bonusReagentQty;
        this.reagentCounts[reagentDef.id] = (this.reagentCounts[reagentDef.id] || 0) + qty;
        reagentFound = { name: reagentDef.name, icon: reagentDef.icon, qty };
      }
      curioFound = this.rollCurio(cur.modifier.guaranteedCurio ? 1 : 0.6);
      const rollCount = 1 + Math.floor(Math.random() * 2) + (cur.modifier.extraLootRoll ? 1 : 0);
      const shuffled = [...BOSS_LOOT_TABLE].sort(() => Math.random() - 0.5);
      loot = shuffled.slice(0, rollCount).map((drop) => ({
        slot: drop.slot,
        gearId: drop.gearId,
        name: GEAR[drop.slot].find((o) => o.id === drop.gearId)?.name || drop.gearId,
        assigned: null,
      }));
    } else {
      this.statsWipes++;
    }
    this.gold += goldFound;
    if (goldFound > 0) this.bumpDaily('goldEarned', goldFound);
    this.result = { win, isBoss: true, loot, curioFound, goldFound, reagentFound };
    this.screen = 'results';
    this.notify();
  }

  // ── turn engine ──────────────────────────────────────────
  private clearTurnTimer() {
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
  }
  private scheduleAdvance(delay: number) {
    this.clearTurnTimer();
    this.turnTimer = setTimeout(() => { this.turnTimer = null; this.advanceTurn(); this.notify(); }, this.pace(delay));
  }

  // ── auto-battle ──────────────────────────────────────────
  // The party's own turns, played the way the balance sim plays them: melee
  // walks up to its target, ranged and healers hang back, everyone steps
  // out of telegraphed zones; then the most useful action this turn.
  private scheduleAuto() {
    this.clearTurnTimer();
    this.turnTimer = setTimeout(() => { this.turnTimer = null; this.autoStep(); }, this.pace(420));
  }
  private autoStep() {
    const s = this.sim; const r = this.currentRaider();
    if (!s || s.over || !r || !s.awaitingPlayer || !this.settings.auto) return;
    if (s.movePhase) {
      this.autoPlace(r);
      this.turnTimer = setTimeout(() => { this.turnTimer = null; this.autoStep(); }, this.pace(380));
      return;
    }
    const [key, target] = this.autoAction(r);
    this.raiderAction(key, target);
  }
  private autoFocus() {
    const s = this.sim!;
    if (!s.enemies.length) return;
    for (const role of ['shaman', 'archer', 'brute'] as EnemyRole[]) {
      const f = s.enemies.find((x) => x.role === role && x.alive);
      if (f) { if (s.focusId !== f.id) s.focusId = f.id; return; }
    }
  }
  private autoPlace(r: Raider) {
    const s = this.sim!;
    this.autoFocus();
    const rects = this.foeRects();
    if (!rects.length) { this.skipMove(); return; }
    const focus = s.enemies.length ? rects.find((f) => f.id === s.focusId) || rects[0] : rects[0];
    const lead = s.enemies.length ? rects.find((f) => s.enemies.find((x) => x.id === f.id && x.role === 'brute')) || focus : rects[0];
    const cells = this.reachableCells().concat([{ row: r.row, col: r.col }]);
    const danger = new Set(s.danger ? s.danger.cells : []);
    const lava = new Set(s.lava ?? []);
    const melee = r.attackRange === 'melee';
    const allies = s.raiders.filter((x) => x.alive && x.id !== r.id);
    let best = cells[cells.length - 1]; let bestScore = -1e9;
    for (const c of cells) {
      let sc = 0;
      const key = c.row + ',' + c.col;
      if (danger.has(key)) sc -= r.role === 'tank' && s.danger!.kind === 'cleave' ? 30 : 100;
      if (lava.has(key)) sc -= 40;
      if (melee) {
        const d = GameEngine.rectDist(c.row, c.col, focus);
        const anyAdj = rects.some((f) => GameEngine.rectDist(c.row, c.col, f) <= 1);
        sc += d <= 1 ? 50 : anyAdj ? 35 - d : -8 * d;
        if (r.role === 'tank' && GameEngine.rectDist(c.row, c.col, lead) <= 1) sc += 12;
        if (anyAdj) sc += 3 * allies.filter((x) => x.attackRange === 'melee' && Math.max(Math.abs(x.row - c.row), Math.abs(x.col - c.col)) === 1).length;
      } else {
        sc += Math.min(Math.min(...rects.map((f) => GameEngine.rectDist(c.row, c.col, f))), 4) * 6;
      }
      if (c.row === r.row && c.col === r.col) sc += 1;
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
    if (best.row === r.row && best.col === r.col) this.skipMove(); else this.moveRaider(best.row, best.col);
  }
  private autoAction(r: Raider): [TurnActionKey, number?] {
    const s = this.sim!;
    this.autoFocus();
    const acts = this.turnActionsVM();
    const has = (k: TurnActionKey) => acts.some((a) => a.key === k && !a.disabled);
    const alive = s.raiders.filter((x) => x.alive);
    const lowest = alive.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
    const weakest = () => this.healTargetsVM().sort((a, b) => a.hpPct - b.hpPct)[0];
    if (has('interrupt')) return ['interrupt'];
    if (has('breakChain')) return ['breakChain'];
    if (has('breakShell') && r.role !== 'heal') return ['breakShell'];
    if (s.execution) {
      const t = s.raiders.find((x) => x.id === s.execution!.targetId);
      if (t && t.hp < t.maxHp * 0.6) {
        if (r.role === 'heal' && has('heal') && t.id !== r.id) return ['heal', t.id];
        if (t.id === r.id && has('defend')) return ['defend'];
      }
    }
    if (has('breakIce') && r.role !== 'heal') return ['breakIce'];
    if (has('brace') && s.braceCall && s.braceCall.braced.size < 3) return ['brace'];
    if (has('rally') && (s.tilt >= 40 || (s.ashCurse && s.ashCurse.stacks >= 2))) return ['rally'];
    if (r.role === 'heal' && has('heal') && lowest.hp / lowest.maxHp < 0.65) { const t = weakest(); if (t) return ['heal', t.id]; }
    if (has('ability')) {
      const k = r.ability.kind;
      if (!['drainHeal', 'volatileHeal'].includes(k) || lowest.hp / lowest.maxHp < 0.8) return ['ability'];
    }
    if (has('attack')) return ['attack'];
    if (r.role === 'heal' && has('heal')) { const t = weakest(); if (t) return ['heal', t.id]; }
    if (has('defend')) return ['defend'];
    return ['attack'];
  }

  private buildOrder(): TurnEntry[] {
    const s = this.sim!;
    const entries: { entry: TurnEntry; speed: number }[] = [];
    for (const r of s.raiders) if (r.alive) entries.push({ entry: { kind: 'raider', id: r.id }, speed: r.speed });
    if (s.boss.hp > 0) entries.push({ entry: { kind: 'boss' }, speed: 10 });
    entries.sort((a, b) => b.speed - a.speed);
    return entries.map((e) => e.entry);
  }

  /** Round-start upkeep: rebuilds the turn order and ticks ongoing effects that persist across rounds (chain, phase-3 aura, boss poison, rally cooldown). */
  private beginRound() {
    const s = this.sim!;
    s.order = this.buildOrder();
    s.turnPos = -1;
    s.rallyCd = Math.max(0, s.rallyCd - 1);
    if (s.partyWard && --s.partyWard.roundsLeft <= 0) s.partyWard = null;
    if (s.inspiredRounds > 0) s.inspiredRounds--;
    if (s.signature === 'feast' && s.boss.hp > 0 && this.alive().some((r) => r.hp < r.maxHp * FEAST_THRESHOLD)) {
      const amt = Math.min(s.boss.maxHp - s.boss.hp, Math.round(s.boss.maxHp * FEAST_HEAL_SHARE));
      if (amt > 0) { s.boss.hp += amt; this.log(s.boss.name + ' питается ранами отряда (+' + amt + ').', 'warn'); }
    }
    if (s.lava.length) {
      const burned = this.alive().filter((r) => s.lava.includes(r.row + ',' + r.col));
      const dmg = Math.round(7 * this.bossDmgMult(true));
      for (const r of burned) this.hurt(r, dmg);
      if (burned.length) this.log('Лава жжёт: ' + burned.map((r) => r.name).join(', ') + ' (-' + dmg + ').', 'warn');
    }
    if (s.vulnerableRounds > 0 && --s.vulnerableRounds === 0) {
      this.log(s.enemies.length ? 'Враги приходят в себя.' : s.boss.name + ' приходит в себя.', 'warn');
    }
    if (s.round === s.enrageAt) {
      this.haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      this.log(s.enemies.length ? 'Враги звереют — с каждым раундом бьют всё сильнее!' : s.boss.name + ' впадает в ярость — с каждым раундом бьёт всё сильнее!', 'warn');
    }

    if (s.phase >= 3) {
      const dmg = Math.round(10 * this.bossDmgMult());
      if (this.alive().length) {
        for (const r of this.alive()) this.hurt(r, dmg);
        this.log('Раскалённая аура обжигает весь рейд (-' + dmg + ').', 'warn');
      }
    }
    if (s.chain) {
      const a = s.raiders.find((r) => r.id === s.chain!.aId);
      const b = s.raiders.find((r) => r.id === s.chain!.bId);
      if (a && b && a.alive && b.alive) {
        const dmg = Math.round(22 * this.bossDmgMult());
        this.hurt(a, dmg); this.hurt(b, dmg); this.addTilt(6);
        this.log('Цепь бьёт током — ' + a.name + ' и ' + b.name + ' страдают (-' + dmg + ').', 'warn');
        s.chain.roundsLeft--;
        if (s.chain.roundsLeft <= 0) { a.chainPartner = null; b.chainPartner = null; s.chain = null; }
      } else {
        if (a) a.chainPartner = null; if (b) b.chainPartner = null; s.chain = null;
      }
    }
    if (s.bossPoison) {
      const carrier = s.bossPoison.enemyId == null ? null : s.enemies.find((e) => e.id === s.bossPoison!.enemyId && e.alive);
      if (s.bossPoison.enemyId != null && !carrier) {
        s.bossPoison = null;
      } else {
        const dmg = Math.round(s.bossPoison.dmgPerTick);
        this.damageFoe(dmg, carrier ? carrier.id : null);
        this.log('Яд василиска продолжает разъедать ' + (carrier ? ENEMY_NAME_ACC[carrier.role] : 'босса') + ' (-' + dmg + ').', 'ok');
        s.bossPoison.roundsLeft--;
        if (s.bossPoison.roundsLeft <= 0) s.bossPoison = null;
      }
    }
    this.checkDeaths();
    this.checkOutcome();
  }

  private advanceTurn() {
    const s = this.sim; if (!s || s.over) return;
    s.awaitingPlayer = false;
    s.turnPos++;
    if (s.turnPos >= s.order.length) {
      s.round++;
      this.beginRound();
      if (s.over) return;
      s.turnPos = 0;
      if (s.order.length === 0) return;
    }
    const entry = s.order[s.turnPos];
    if (entry.kind === 'raider') {
      const r = s.raiders.find((x) => x.id === entry.id);
      if (!r || !r.alive) { this.advanceTurn(); return; }
      this.tickAbility(r);
      if (s.poison && s.poison.targetId === r.id) {
        const dmg = Math.round(s.poison.dmgPerTick);
        this.hurt(r, dmg);
        this.log(r.name + ' страдает от яда (-' + dmg + ').', 'warn');
        s.poison.roundsLeft--;
        if (s.poison.roundsLeft <= 0) s.poison = null;
        this.checkDeaths();
        if (this.checkOutcome()) return;
        if (!r.alive) { this.advanceTurn(); return; }
      }
      if (s.frozen && s.frozen.targetId === r.id) {
        s.frozen.roundsLeft--;
        if (s.frozen.roundsLeft <= 0) {
          this.log('Лёд, сковывавший ' + r.name + ', трескается сам собой — оттепель.', 'ok');
          s.frozen = null;
        } else {
          this.log(r.name + ' скован(а) льдом и пропускает ход.', 'warn');
        }
        this.advanceTurn();
        return;
      }
      s.selected = r.id;
      s.awaitingPlayer = true;
      s.movePhase = true;
      if (this.settings.auto) this.scheduleAuto();
    } else if (this.heavyBlowPending()) {
      // Give the heavy blow a beat of wind-up the UI can show before it lands.
      s.windup = true;
      this.clearTurnTimer();
      this.turnTimer = setTimeout(() => { this.turnTimer = null; this.resolveBossTurn(); this.notify(); }, this.pace(WINDUP_MS));
    } else {
      this.resolveBossTurn();
    }
  }
  private heavyBlowPending(): boolean {
    const s = this.sim!;
    return !!(s.danger || s.pendingCast || s.execution || s.braceCall);
  }
  private resolveBossTurn() {
    const s = this.sim; if (!s || s.over) return;
    s.windup = false;
    this.bossTurn();
    this.checkDeaths();
    if (this.checkOutcome()) return;
    this.scheduleAdvance(900);
  }

  private checkDeaths() {
    const s = this.sim!;
    for (const r of s.raiders) {
      if (r.alive && r.hp <= 0) {
        r.alive = false; r.hp = 0;
        if (s.chain && (s.chain.aId === r.id || s.chain.bId === r.id)) {
          const otherId = s.chain.aId === r.id ? s.chain.bId : s.chain.aId;
          const other = s.raiders.find((x) => x.id === otherId);
          if (other) other.chainPartner = null;
          s.chain = null;
        }
        r.chainPartner = null;
        if (s.poison && s.poison.targetId === r.id) s.poison = null;
        if (s.frozen && s.frozen.targetId === r.id) s.frozen = null;
        if (s.selected === r.id) s.selected = null;
        this.addTilt(20);
        this.haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
        this.log(r.name + ' погиб(ла).', 'warn');
        s.shakeSeq++;
      }
    }
  }
  private checkOutcome(): boolean {
    const s = this.sim!;
    const dead = s.raiders.filter((r) => !r.alive).length;
    const tank = s.raiders.find((r) => r.role === 'tank' && r.alive);
    if (dead >= 3 || !tank) { this.endGame(false); return true; }
    if (s.boss.hp <= 0) {
      // A short cheer on the field before the results.
      s.over = true; s.victory = true;
      this.clearTurnTimer();
      this.notify();
      setTimeout(() => { if (this.sim === s) this.endGame(true); }, VICTORY_MS);
      return true;
    }
    return false;
  }
  private checkPhase() {
    const s = this.sim!;
    if (s.encounterType !== 'boss') return;
    if (s.phase === 1 && s.boss.hp <= s.boss.maxHp * 0.5) {
      s.phase = 2;
      s.shakeSeq++;
      this.haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      this.log('Босс: «Вы недооцениваете меня!» Земля исходит ядом.', 'warn');
    } else if (s.phase === 2 && s.boss.hp <= s.boss.maxHp * 0.25) {
      s.phase = 3;
      s.shakeSeq++;
      this.haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      this.log('Босс звереет! Раскалённая аура жжёт весь рейд.', 'warn');
    }
  }

  alive(): Raider[] {
    return this.sim!.raiders.filter((r) => r.alive);
  }
  dpsMult() {
    const t = this.sim!.tilt;
    return t >= 70 ? 0.55 : t >= 40 ? 0.8 : 1;
  }
  healMult() {
    const t = this.sim!.tilt;
    return t >= 70 ? 0.5 : t >= 40 ? 0.75 : 1;
  }
  addTilt(a: number) {
    const s = this.sim!;
    s.tilt = Math.min(100, Math.max(0, s.tilt + a));
  }
  hurt(r: Raider, amount: number) {
    let d = amount;
    if (r.ability && r.ability.kind === 'selfShield' && r.ability.active) d *= 0.5;
    const pw = this.sim?.partyWard;
    if (pw) d *= pw.mult;
    const curse = this.sim?.ashCurse;
    if (curse) d *= 1 + 0.15 * curse.stacks;
    if (r.role === 'tank' && this.engaged(r)) d *= TANK_GUARD_MULT;
    if (r.defending) d *= DEFEND_MULT;
    if (r.ability && r.ability.kind === 'berserk' && r.ability.active) d *= BERSERK_TAKEN_MULT;
    d *= r.wardMult || 1;
    r.hp -= d;
  }
  outMult(r: Raider) {
    let m = 1;
    if (r.trait === 'legend') m *= 1.2;
    if (r.trait === 'egoist') m *= 0.85;
    if (r.trait === 'novice') {
      const t = Math.min(4, this.sim!.round);
      m *= 0.7 + 0.3 * (t / 4);
    }
    return m * (r.outputMult || 1) * (r.levelMult || 1);
  }
  enrageMult() {
    const s = this.sim!;
    return 1 + ENRAGE_STEP * Math.max(0, s.round - s.enrageAt + 1);
  }
  /** Counterable damage (telegraphed hits, room archers/shamans you can kill first) skips BOSS_DMG_SCALE, so a mistake stings without wiping a new player. */
  bossDmgMult(avoidable = false) {
    return this.sim!.dmgMult * this.enrageMult() * (avoidable ? 1 : BOSS_DMG_SCALE);
  }
  private tickAbility(r: Raider) {
    r.defending = false;
    const a = r.ability;
    if (a.cd > 0) a.cd--;
    if (a.active && --a.activeRounds <= 0) { a.active = false; a.activeRounds = 0; }
  }
  private frontAllies(r: Raider): number {
    if (r.attackRange !== 'melee' || !this.engaged(r)) return 0;
    // Shoulder to shoulder — side-by-side or front-to-back neighbours, at most two, like the old front line.
    return Math.min(2, this.alive().filter((x) => x.id !== r.id && x.attackRange === 'melee' && this.engaged(x)
      && Math.abs(x.row - r.row) + Math.abs(x.col - r.col) === 1).length);
  }

  // ── positions on the shared field ────────────────────────
  /** Every living enemy's footprint as a rectangle: room foes are 1×1, the boss BOSS_W × BOSS_H. */
  foeRects(): FoeRect[] {
    const s = this.sim;
    if (!s) return [];
    const one = (e: Enemy): FoeRect => ({ id: e.id, row: e.row, col: e.col, w: 1, h: 1 });
    if (!s.enemies.length) {
      const boss: FoeRect[] = s.bossPos && s.boss.hp > 0 ? [{ id: -1, row: s.bossPos.row, col: s.bossPos.col, w: BOSS_W, h: BOSS_H }] : [];
      return [...boss, ...s.minions.filter((m) => m.alive).map(one)];
    }
    return s.enemies.filter((e) => e.alive).map(one);
  }
  /** Chebyshev distance from a cell to the nearest cell of a footprint — 1 means standing right next to it. */
  static rectDist(row: number, col: number, f: { row: number; col: number; w: number; h: number }): number {
    const dr = row < f.row ? f.row - row : row > f.row + f.h - 1 ? row - (f.row + f.h - 1) : 0;
    const dc = col < f.col ? f.col - col : col > f.col + f.w - 1 ? col - (f.col + f.w - 1) : 0;
    return Math.max(dr, dc);
  }
  private foeAt(row: number, col: number, except?: number): boolean {
    return this.foeRects().some((f) => f.id !== except && GameEngine.rectDist(row, col, f) === 0);
  }
  /** Enemies standing next to this raider. */
  adjacentFoes(r: Raider): FoeRect[] {
    return this.foeRects().filter((f) => GameEngine.rectDist(r.row, r.col, f) <= 1);
  }
  engaged(r: Raider): boolean {
    return this.adjacentFoes(r).length > 0;
  }
  private leaderRect(): FoeRect | null {
    const s = this.sim!;
    if (!s.enemies.length) return this.foeRects()[0] ?? null;
    const b = s.enemies.find((e) => e.role === 'brute' && e.alive);
    return b ? { id: b.id, row: b.row, col: b.col, w: 1, h: 1 } : null;
  }
  /**
   * Where an enemy ends up after walking up to `speed` cells toward the lowest
   * `score`, never onto a raider or another enemy (its own cell if nothing is better).
   */
  private stepFoe(f: FoeRect, speed: number, score: (row: number, col: number) => number): { row: number; col: number } {
    const raiderCells = new Set(this.alive().map((r) => r.row + ',' + r.col));
    const others = this.foeRects().filter((o) => o.id !== f.id);
    let best = { row: f.row, col: f.col }; let bestScore = score(f.row, f.col);
    for (let row = Math.max(0, f.row - speed); row <= Math.min(GRID_ROWS - f.h, f.row + speed); row++) {
      for (let col = Math.max(0, f.col - speed); col <= Math.min(GRID_COLS - f.w, f.col + speed); col++) {
        let free = true;
        for (let dr = 0; dr < f.h && free; dr++) for (let dc = 0; dc < f.w && free; dc++) {
          const cr = row + dr; const cc = col + dc;
          if (raiderCells.has(cr + ',' + cc) || others.some((o) => GameEngine.rectDist(cr, cc, o) === 0)) free = false;
        }
        if (!free) continue;
        const sc = score(row, col) + 0.01 * Math.max(Math.abs(row - f.row), Math.abs(col - f.col));
        if (sc < bestScore) { bestScore = sc; best = { row, col }; }
      }
    }
    return best;
  }
  /** The leader (boss or brute) closes in on a tank if it can, otherwise on whoever is nearest. */
  private advanceLeader() {
    const s = this.sim!;
    const f = this.leaderRect(); if (!f) return;
    const alive = this.alive(); if (!alive.length) return;
    const near = (pool: Raider[]) => pool.reduce((a, b) => (GameEngine.rectDist(b.row, b.col, f) < GameEngine.rectDist(a.row, a.col, f) ? b : a));
    if (alive.some((r) => GameEngine.rectDist(r.row, r.col, f) <= 1)) return; // already in the thick of it
    const tanks = alive.filter((r) => r.role === 'tank');
    const target = near(tanks.length ? tanks : alive);
    const speed = s.enemies.length ? FOE_SPEED.brute : FOE_SPEED.boss;
    const to = this.stepFoe(f, speed, (row, col) => GameEngine.rectDist(target.row, target.col, { ...f, row, col }));
    if (to.row === f.row && to.col === f.col) return;
    if (s.bossPos) s.bossPos = to;
    else { const e = s.enemies.find((x) => x.id === f.id)!; e.row = to.row; e.col = to.col; }
  }
  /** Archers and shamans keep about three cells between themselves and the party, backing off when rushed. */
  private repositionSkirmisher(e: Enemy) {
    const alive = this.alive(); if (!alive.length) return;
    const f: FoeRect = { id: e.id, row: e.row, col: e.col, w: 1, h: 1 };
    const to = this.stepFoe(f, FOE_SPEED[e.role as 'archer' | 'shaman'], (row, col) => {
      const d = Math.min(...alive.map((r) => Math.max(Math.abs(r.row - row), Math.abs(r.col - col))));
      return Math.abs(d - 3) + row * 0.05;
    });
    e.row = to.row; e.col = to.col;
  }
  /** Every hit on the boss goes through here so combos, the stun window and the stagger meter apply consistently. */
  private hitBoss(r: Raider, raw: number, staggerGain: number): { dmg: number; note: string } {
    const s = this.sim!;
    const tags: string[] = [];
    let m = 1;
    if (r.ability.kind === 'berserk' && r.ability.active) { m *= 2; tags.push('берсерк'); }
    const allies = this.frontAllies(r);
    if (allies > 0) { m *= 1 + FORMATION_BONUS * allies; tags.push('строй'); }
    // In a boss fight a raised skeleton can be the target: the focused one in reach, or one blocking a melee raider.
    const target = s.enemies.length ? this.focusEnemy() : this.attackTarget(r);
    const onMinion = !s.enemies.length && !!target;
    if (s.bossPoison && (s.bossPoison.enemyId == null || s.bossPoison.enemyId === target?.id)) { m *= POISONED_BOSS_MULT; tags.push('яд'); }
    if (s.vulnerableRounds > 0) { m *= VULNERABLE_MULT; tags.push('оглушён'); }
    if (s.iceShell) { m *= ICE_SHELL_MULT; tags.push('панцирь'); }
    const dmg = Math.max(1, Math.round(raw * m));
    this.damageFoe(dmg, target ? target.id : null);
    if (s.debt && s.debt.targetId === r.id) s.debt.paid = true;
    if (s.quota) s.quota.dealt += dmg;
    if (target) tags.unshift('→ ' + target.name);
    if (!onMinion && s.vulnerableRounds === 0 && !s.stunned && staggerGain > 0 && s.boss.hp > 0) {
      s.stagger = Math.min(STAGGER_MAX, s.stagger + staggerGain);
      if (s.stagger >= STAGGER_MAX) {
        s.stagger = 0;
        s.stunned = true;
        s.vulnerableRounds = VULNERABLE_ROUNDS + 1;
        this.haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
        this.log(s.enemies.length ? 'Натиск смял строй врагов — они оглушены! Бейте, пока открыты.' : 'Натиск сломил защиту — ' + s.boss.name + ' оглушён! Бейте, пока открыт.', 'ok');
      }
    }
    this.checkPhase();
    return { dmg, note: tags.length ? ' (' + tags.join(', ') + ')' : '' };
  }
  focusEnemy(): Enemy | null {
    const s = this.sim!;
    if (!s.enemies.length) return s.minions.find((m) => m.id === s.focusId && m.alive) ?? null;
    return s.enemies.find((e) => e.id === s.focusId && e.alive) || s.enemies.find((e) => e.alive) || null;
  }
  /** Melee can only hit what it stands next to: its focus if adjacent, otherwise the nearest adjacent foe. */
  attackTarget(r: Raider): Enemy | null {
    const s = this.sim!;
    if (!s.enemies.length) {
      // Boss fight: a focused skeleton in reach, else the boss (null) — unless only skeletons stand next to a melee raider.
      const m = this.focusEnemy();
      if (r.attackRange !== 'melee') return m;
      const adj = this.adjacentFoes(r).map((f) => f.id);
      if (m && adj.includes(m.id)) return m;
      if (adj.includes(-1)) return null;
      return s.minions.find((x) => x.alive && adj.includes(x.id)) ?? null;
    }
    const focus = this.focusEnemy();
    if (!focus || r.attackRange !== 'melee') return focus;
    const adj = this.adjacentFoes(r).map((f) => f.id);
    if (adj.includes(focus.id)) return focus;
    return this.sim!.enemies.find((e) => e.alive && adj.includes(e.id)) ?? focus;
  }
  setFocus(enemyId: number) {
    const s = this.sim;
    if (!s) return;
    // Tapping the boss drops a skeleton focus; skeletons and room enemies take it.
    if (!s.enemies.length && enemyId < 0) { s.focusId = null; this.notify(); return; }
    if (![...s.enemies, ...s.minions].some((e) => e.id === enemyId && e.alive)) return;
    s.focusId = enemyId;
    this.notify();
  }
  /** Applies damage to a room enemy (or the boss), handles deaths and keeps the group total in s.boss in sync. */
  private damageFoe(dmg: number, enemyId: number | null) {
    const s = this.sim!;
    if (!s.enemies.length) {
      const m = enemyId != null && enemyId >= MINION_ID0 ? s.minions.find((x) => x.id === enemyId && x.alive) : undefined;
      if (m) {
        m.hp = Math.max(0, m.hp - dmg);
        if (m.hp === 0) {
          m.alive = false;
          this.log(m.name + ' рассыпается грудой костей.', 'ok');
          if (s.focusId === m.id) s.focusId = null;
        }
        return;
      }
      s.boss.hp = Math.max(0, s.boss.hp - dmg);
      if (s.boss.hp === 0 && s.minions.some((x) => x.alive)) {
        for (const x of s.minions) x.alive = false;
        this.log('Без хозяина поднятые скелеты рассыпаются.', 'ok');
      }
      return;
    }
    const e = s.enemies.find((x) => x.id === enemyId && x.alive) || s.enemies.find((x) => x.alive);
    if (!e) return;
    e.hp = Math.max(0, e.hp - dmg);
    if (e.hp === 0) {
      e.alive = false;
      this.log(e.name + ' повержен.', 'ok');
      if (e.role === 'brute' && (s.danger || s.pendingCast || s.braceCall)) {
        s.danger = null; s.pendingCast = null; s.braceCall = null;
        this.log('Заготовленный удар громилы так и не состоялся.', 'ok');
      }
      if (s.focusId === e.id) s.focusId = s.enemies.find((x) => x.alive)?.id ?? null;
    }
    this.syncGroupHp();
  }
  private syncGroupHp() {
    const s = this.sim!;
    s.boss.hp = s.enemies.reduce((sum, e) => sum + (e.alive ? e.hp : 0), 0);
  }
  healTarget(healer: Raider): Raider | null {
    const injured = this.alive().filter((x) => x !== healer && x.hp < x.maxHp);
    const pool = injured.filter((x) => x.trait !== 'egoist').length ? injured.filter((x) => x.trait !== 'egoist') : injured;
    let t: Raider | null = null;
    for (const x of pool) { if (!t || x.hp / x.maxHp < t.hp / t.maxHp) t = x; }
    if (!t && healer.hp < healer.maxHp) t = healer;
    return t;
  }

  // ── player turn actions ──────────────────────────────────
  currentRaider(): Raider | null {
    const s = this.sim; if (!s || !s.awaitingPlayer) return null;
    const entry = s.order[s.turnPos];
    if (!entry || entry.kind !== 'raider') return null;
    return s.raiders.find((x) => x.id === entry.id) || null;
  }

  // ── tactical grid ────────────────────────────────────────
  reachableCells(): { row: number; col: number }[] {
    const s = this.sim; const r = this.currentRaider();
    if (!s || !r || !s.movePhase) return [];
    const occupied = new Set(s.raiders.filter((x) => x.alive && x.id !== r.id).map((x) => x.row + ',' + x.col));
    const cells: { row: number; col: number }[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (row === r.row && col === r.col) continue;
        const dist = Math.max(Math.abs(row - r.row), Math.abs(col - r.col));
        if (dist > MOVE_RANGE) continue;
        if (occupied.has(row + ',' + col) || this.foeAt(row, col)) continue;
        cells.push({ row, col });
      }
    }
    return cells;
  }
  moveRaider(row: number, col: number) {
    const s = this.sim; const r = this.currentRaider();
    if (!s || !r || !s.movePhase) return;
    if (!this.reachableCells().some((c) => c.row === row && c.col === col)) return;
    s.moveFx = { seq: (s.moveFx?.seq ?? 0) + 1, id: r.id, fromRow: r.row, fromCol: r.col };
    r.row = row; r.col = col;
    s.movePhase = false;
    this.log(r.name + (this.engaged(r) ? ' вступает в ближний бой.' : ' меняет позицию на поле.'));
    this.notify();
  }
  skipMove() {
    const s = this.sim;
    if (!s || !s.movePhase) return;
    s.movePhase = false;
    this.notify();
  }

  turnActionsVM(): TurnActionVM[] {
    const s = this.sim; const r = this.currentRaider();
    if (!s || !r) return [];
    const actions: TurnActionVM[] = [];
    if (s.pendingCast) {
      actions.push({ key: 'interrupt', label: 'Прервать (' + s.pendingCast.targetName + ')', needsTarget: false, disabled: false });
    }
    if (s.chain && (s.chain.aId === r.id || s.chain.bId === r.id)) {
      actions.push({ key: 'breakChain', label: 'Разорвать цепь', needsTarget: false, disabled: false });
    }
    if (s.frozen && s.frozen.targetId !== r.id) {
      actions.push({ key: 'breakIce', label: 'Расколоть лёд (' + s.frozen.targetName + ')', needsTarget: false, disabled: false });
    }
    if (s.braceCall && !s.braceCall.braced.has(r.id)) {
      actions.push({ key: 'brace', label: 'Приготовиться', needsTarget: false, disabled: false });
    }
    const inMeleeRange = r.attackRange === 'ranged' || this.engaged(r);
    const focus = this.attackTarget(r);
    actions.push({
      key: 'attack', label: 'Атаковать', needsTarget: false, disabled: !inMeleeRange,
      sub: !inMeleeRange ? 'подойдите вплотную к врагу' : focus ? 'цель: ' + focus.name : undefined,
    });
    if (r.role === 'heal') {
      actions.push({ key: 'heal', label: 'Лечить', needsTarget: true, disabled: false });
    }
    const def = ABILITY_BY_CANDIDATE[r.candidateId];
    actions.push({
      key: 'ability', label: def.name, abilityIcon: def.icon, abilityArt: ABILITY_ART[r.candidateId], needsTarget: false,
      disabled: r.ability.cd > 0, sub: r.ability.cd > 0 ? `КД: ${r.ability.cd}` : undefined,
    });
    if (s.iceShell) actions.push({ key: 'breakShell', label: 'Расколоть панцирь', needsTarget: false, disabled: false });
    if (s.rallyCd <= 0) actions.push({ key: 'rally', label: 'Сплотить отряд', needsTarget: false, disabled: false });
    actions.push({ key: 'defend', label: 'Оборона', sub: '−40% урона до след. хода', needsTarget: false, disabled: false });
    return actions;
  }
  healTargetsVM(): HealTargetVM[] {
    const r = this.currentRaider();
    if (!r) return [];
    return this.alive().filter((x) => x.id !== r.id).map((x) => ({ id: x.id, name: x.name, hpPct: Math.max(0, Math.round((x.hp / x.maxHp) * 100)) }));
  }

  raiderAction = (key: TurnActionKey, targetId?: number) => {
    const s = this.sim; const r = this.currentRaider();
    if (!s || !r || s.over) return;
    s.awaitingPlayer = false;
    const fxKind = key === 'attack' ? (r.attackRange === 'melee' ? 'melee' : 'ranged') : key === 'heal' ? 'heal' : key === 'ability' ? 'ability' : key === 'rally' ? 'rally' : null;
    const aimsAtEnemy = key === 'attack' || key === 'ability';
    if (key === 'attack' && r.attackRange === 'melee') {
      const t = this.attackTarget(r);
      if (t && t.id !== s.focusId) s.focusId = t.id;
      else if (!t && !s.enemies.length) s.focusId = null; // swinging at the boss, not a skeleton out of reach
    }
    s.fx = { seq: s.fx.seq + 1, actor: fxKind ? r.id : null, kind: fxKind, crit: false, targetEnemy: aimsAtEnemy ? (this.focusEnemy()?.id ?? -1) : null, targetRaider: null };
    switch (key) {
      case 'attack': this.doAttack(r); break;
      case 'heal': this.doHeal(r, targetId); break;
      case 'ability': this.doAbility(r); break;
      case 'interrupt': this.doInterrupt(r); break;
      case 'breakChain': this.doBreakChain(r); break;
      case 'breakIce': this.doBreakIce(r); break;
      case 'brace': this.doBrace(r); break;
      case 'rally': this.doRally(r); break;
      case 'breakShell':
        s.iceShell = false;
        this.log(r.name + ' раскалывает ледяной панцирь!', 'ok');
        break;
      case 'defend':
        r.defending = true;
        this.log(r.name + ' уходит в оборону.');
        break;
    }
    this.checkDeaths();
    this.notify();
    if (!this.checkOutcome()) this.scheduleAdvance(650);
  };

  private doAttack(r: Raider) {
    const crit = Math.random() < 0.14;
    let raw = r.dps * this.outMult(r) * this.dpsMult() * ATTACK_TURN_SCALE;
    if (crit) raw *= 1.8;
    const frontMelee = r.attackRange === 'melee' && this.engaged(r);
    const stagger = STAGGER_ATTACK + (frontMelee ? STAGGER_FRONT_MELEE : 0) + (crit ? STAGGER_CRIT : 0);
    this.sim!.fx.crit = crit;
    const { dmg, note } = this.hitBoss(r, raw, stagger);
    this.log(r.name + (crit ? ' наносит критический удар: -' : ' атакует: -') + dmg + note, crit ? 'ok' : undefined);
    if (crit) this.haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }
  private doHeal(r: Raider, targetId?: number) {
    let t = targetId != null ? this.sim!.raiders.find((x) => x.id === targetId && x.alive) || null : null;
    if (!t) t = this.healTarget(r) || r;
    const inspired = this.sim!.inspiredRounds > 0;
    const amt = Math.max(1, Math.round(r.healPower * this.outMult(r) * this.healMult() * HEAL_TURN_SCALE * (inspired ? INSPIRED_HEAL_MULT : 1)));
    t.hp = Math.min(t.maxHp, t.hp + amt);
    this.sim!.fx.targetRaider = t.id;
    this.log(r.name + ' лечит ' + t.name + ': +' + amt + (inspired ? ' (воодушевление)' : ''), 'ok');
  }
  private doInterrupt(r: Raider) {
    const s = this.sim!;
    if (!s.pendingCast) return;
    this.log(r.name + ' срывает каст — чисто сработано!', 'ok');
    s.pendingCast = null;
    this.addTilt(-5);
    this.everInterrupted = true;
    this.haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }
  private doBreakChain(r: Raider) {
    const s = this.sim!;
    if (!s.chain || (s.chain.aId !== r.id && s.chain.bId !== r.id)) return;
    const otherId = s.chain.aId === r.id ? s.chain.bId : s.chain.aId;
    const other = s.raiders.find((x) => x.id === otherId);
    if (other) other.chainPartner = null;
    r.chainPartner = null;
    s.chain = null;
    this.log(r.name + ' разрывает цепь рывком.', 'ok');
  }
  private doBreakIce(r: Raider) {
    const s = this.sim!;
    if (!s.frozen) return;
    const targetName = s.frozen.targetName;
    s.frozen = null;
    this.log(r.name + ' раскалывает лёд, освобождая ' + targetName + '.', 'ok');
  }
  private doBrace(r: Raider) {
    const s = this.sim!;
    if (!s.braceCall) return;
    s.braceCall.braced.add(r.id);
    this.log(r.name + ' готовится принять удар.', 'ok');
  }
  private doRally(r: Raider) {
    const s = this.sim!;
    if (s.rallyCd > 0) return;
    this.addTilt(-30);
    s.rallyCd = 4;
    s.inspiredRounds = INSPIRED_ROUNDS + 1;
    const hadCurse = !!s.ashCurse;
    s.ashCurse = null;
    this.log(r.name + ': «Так, все выдохнули! Добиваем!» Лечение усилено на 2 раунда.' + (hadCurse ? ' Пепел стряхнут с плеч отряда.' : ''), 'ok');
  }
  private doAbility(r: Raider) {
    const s = this.sim!;
    const a = r.ability;
    if (a.cd > 0) return;
    if (r.trait === 'clicker' && Math.random() < 0.2) {
      a.cd = a.cdMax;
      this.log(r.name + ' тыкает не туда — способность прогорела впустую.', 'warn');
      return;
    }
    this.everUsedAbility = true;
    this.bumpDaily('abilityUsed');
    this.haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    switch (a.kind) {
      case 'selfShield':
        s.fx.targetEnemy = null;
        a.active = true; a.activeRounds = a.activeMax; a.cd = a.cdMax;
        this.log(r.name + ' раскрывает Librum Tenebris — урон по нему снижен.', 'ok');
        break;
      case 'partyShield':
        s.fx.targetEnemy = null;
        a.active = true; a.activeRounds = a.activeMax; a.cd = a.cdMax;
        s.partyWard = { roundsLeft: a.activeMax, mult: 0.7 };
        this.log(r.name + ' встаёт последним рубежом — весь отряд получает меньше урона.', 'ok');
        break;
      case 'drainHeal': {
        a.cd = a.cdMax;
        const t = this.healTarget(r) || r;
        s.fx.targetEnemy = null; s.fx.targetRaider = t.id;
        t.hp = Math.min(t.maxHp, t.hp + 90);
        r.hp = Math.max(1, r.hp - 15);
        this.log(r.name + ' платит собственной кровью за исцеление: ' + t.name, 'ok');
        break;
      }
      case 'volatileHeal': {
        a.cd = a.cdMax;
        const t = this.healTarget(r) || r;
        s.fx.targetEnemy = null; s.fx.targetRaider = t.id;
        if (Math.random() < 0.2) {
          t.hp = Math.min(t.maxHp, t.hp + 15);
          this.addTilt(6);
          this.log(r.name + ': эликсир пошёл не так — эффект слабее ожидаемого.', 'warn');
        } else {
          const amt = Math.round(40 + Math.random() * 70);
          t.hp = Math.min(t.maxHp, t.hp + amt);
          this.log(r.name + ' щедро отливает экспериментальный эликсир: ' + t.name, 'ok');
        }
        break;
      }
      case 'venom':
        a.cd = a.cdMax;
        s.bossPoison = { roundsLeft: 3, dmgPerTick: Math.round(9 * this.outMult(r) * ATTACK_TURN_SCALE * 0.5), enemyId: s.enemies.length ? this.focusEnemy()?.id ?? null : null };
        this.log(r.name + ' смазывает клинки ядом василиска.', 'ok');
        break;
      case 'berserk':
        s.fx.targetEnemy = null;
        // +1 because the casting turn itself is spent — the buff should cover the next activeMax attacks.
        a.active = true; a.activeRounds = a.activeMax + 1; a.cd = a.cdMax;
        this.log(r.name + ' впадает в кровавую ярость — урон удвоен, но и сам он уязвим.', 'ok');
        break;
      case 'nukeSelfDamage': {
        a.cd = a.cdMax;
        const { dmg, note } = this.hitBoss(r, r.dps * this.outMult(r) * this.dpsMult() * ATTACK_TURN_SCALE * 0.9, STAGGER_NUKE);
        this.hurt(r, 10);
        this.log(r.name + ' бьёт зелёной стрелой (-' + dmg + note + ') — яд ранит и её саму.', 'ok');
        break;
      }
      case 'nukeHeal': {
        a.cd = a.cdMax;
        const { dmg, note } = this.hitBoss(r, r.dps * this.outMult(r) * this.dpsMult() * ATTACK_TURN_SCALE * 0.9, STAGGER_NUKE);
        for (const x of this.alive()) x.hp = Math.min(x.maxHp, x.hp + 20);
        this.log(r.name + ' выпускает Огонь Душ (-' + dmg + note + ') — обжигает врага и лечит отряд.', 'ok');
        break;
      }
      case 'nukeTilt': {
        a.cd = a.cdMax;
        const { dmg, note } = this.hitBoss(r, r.dps * this.outMult(r) * this.dpsMult() * ATTACK_TURN_SCALE * 1.3, STAGGER_NUKE);
        this.addTilt(6);
        this.log(r.name + ' карает врага именем бога (-' + dmg + note + '), в которого уже не верит.', 'warn');
        break;
      }
    }
    this.checkPhase();
  }

  // ── boss turn ────────────────────────────────────────────
  private bossTurn() {
    const s = this.sim!;
    if (s.stunned) {
      s.stunned = false;
      const interrupted = !!(s.pendingCast || s.braceCall || s.danger || s.debt || s.execution || s.quota);
      s.pendingCast = null; s.braceCall = null; s.danger = null; s.debt = null; s.execution = null; s.quota = null;
      this.log((s.enemies.length ? 'Враги оглушены и пропускают ход' : s.boss.name + ' оглушён и пропускает ход') + (interrupted ? ' — заготовленная атака сорвана.' : '.'), 'ok');
      return;
    }
    if (s.vulnerableRounds === 0) s.stagger = Math.max(0, s.stagger - STAGGER_DECAY);
    s.fx = { seq: s.fx.seq + 1, actor: 'enemy', kind: 'enemy', crit: false, targetEnemy: null, targetRaider: null };
    if (!s.enemies.length) { this.leaderTurn(); this.minionTurn(); return; }
    const has = (role: EnemyRole) => s.enemies.some((e) => e.role === role && e.alive);
    if (has('brute')) this.leaderTurn();
    for (const e of s.enemies) if (e.alive && e.role !== 'brute') this.repositionSkirmisher(e);
    if (has('archer')) this.archerShot();
    if (has('shaman')) this.shamanTurn();
  }

  /** Picks off the back line — healers and ranged — which a front-row tank can't cover. */
  private archerShot() {
    const alive = this.alive();
    if (!alive.length) return;
    // The raider hanging furthest back from the brawl — healers and casters, usually.
    const lead = this.leaderRect();
    const away = (r: Raider) => (lead ? GameEngine.rectDist(r.row, r.col, lead) : BACK_ROW - r.row);
    const far = Math.max(...alive.map(away));
    const pool = alive.filter((r) => away(r) === far);
    const t = pool[Math.floor(Math.random() * pool.length)];
    const dmg = Math.round((ARCHER_DMG + Math.random() * 8) * this.bossDmgMult(true));
    this.hurt(t, dmg);
    this.log('Стрелок бьёт по ' + t.name + ' (-' + dmg + ').', 'warn');
  }
  /** Patches up the most battered ally; with nobody hurt it jabs the party instead. */
  private shamanTurn() {
    const s = this.sim!;
    const hurtFoes = s.enemies.filter((e) => e.alive && e.hp < e.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (hurtFoes.length) {
      const e = hurtFoes[0];
      const amt = Math.min(e.maxHp - e.hp, Math.round(s.boss.maxHp * SHAMAN_HEAL_SHARE));
      e.hp += amt;
      this.syncGroupHp();
      this.log('Шаман латает ' + ENEMY_NAME_ACC[e.role] + ' (+' + amt + ').', 'warn');
      return;
    }
    const alive = this.alive();
    const t = alive[Math.floor(Math.random() * alive.length)];
    const dmg = Math.round((10 + Math.random() * 5) * this.bossDmgMult(true));
    this.hurt(t, dmg);
    this.log('Шаман насылает порчу на ' + t.name + ' (-' + dmg + ').', 'warn');
  }

  private leaderName(): string {
    const s = this.sim!;
    return s.enemies.length ? ENEMY_NAME.brute : s.boss.name;
  }

  /** The boss (or a room's brute): resolves whatever it telegraphed last turn, otherwise picks its next move. */
  private leaderTurn() {
    const s = this.sim!;
    if (s.pendingCast) {
      const t = s.raiders.find((r) => r.id === s.pendingCast!.targetId);
      if (t && t.alive) {
        const dmg = Math.round(140 * this.bossDmgMult());
        this.hurt(t, dmg);
        this.addTilt(15);
        this.log(t.name + ' получает полный луч смерти в лицо (-' + dmg + ').', 'warn');
        s.shakeSeq++;
      }
      s.pendingCast = null;
      return;
    }
    if (s.braceCall) {
      const soaked = s.braceCall.braced.size >= 3;
      const dmg = Math.round((soaked ? 38 : 100) * this.bossDmgMult());
      for (const r of this.alive()) this.hurt(r, dmg);
      this.addTilt(soaked ? 4 : 16);
      if (!soaked) s.shakeSeq++;
      this.log(soaked ? 'Рейд приготовился вовремя — «Кровавый прилив» смягчён.' : 'Никто толком не приготовился — Прилив ударил в полную силу!', soaked ? 'ok' : 'warn');
      s.braceCall = null;
      return;
    }
    if (s.danger) {
      const zone = s.danger;
      s.danger = null;
      const base = { meteor: 55, cleave: 45, devour: 75, backstab: 50 }[zone.kind];
      const dmg = Math.round(base * this.bossDmgMult(true));
      const hit = this.alive().filter((r) => zone.cells.includes(r.row + ',' + r.col));
      for (const r of hit) { this.hurt(r, dmg); this.addTilt(6); }
      s.impact = { seq: s.impact.seq + 1, cells: zone.cells, kind: zone.kind };
      // Those standing right beside the blast leap aside.
      const near = this.alive().filter((r) => !hit.includes(r) && zone.cells.some((c) => { const [zr, zc] = c.split(',').map(Number); return Math.max(Math.abs(zr - r.row), Math.abs(zc - r.col)) === 1; }));
      if (near.length) s.dodge = { seq: s.dodge.seq + 1, ids: near.map((r) => r.id) };
      if (hit.length) s.shakeSeq++;
      const what = { meteor: 'Огненный дождь', cleave: 'Сокрушающий взмах', devour: 'Пасть', backstab: 'Удар в спину' }[zone.kind];
      if (hit.length) this.log(what + ' накрывает: ' + hit.map((r) => r.name).join(', ') + ' (-' + dmg + ').', 'warn');
      else this.log(what + ' — мимо: отряд вовремя сменил позицию.', 'ok');
      if (zone.kind === 'devour' && hit.length) {
        const heal = Math.min(s.boss.maxHp - s.boss.hp, dmg * 2 * hit.length);
        s.boss.hp += heal;
        this.log(s.boss.name + ' проглатывает добычу и восстанавливает силы (+' + heal + ').', 'warn');
      }
      // Signature zones land on top of a normal turn; the shared meteor/cleave ones spend it (tuned that way).
      if (zone.kind === 'meteor' || zone.kind === 'cleave') return;
    }
    if (s.debt) {
      const d = s.debt; s.debt = null;
      const t = s.raiders.find((r) => r.id === d.targetId && r.alive);
      if (d.paid) this.log('Долг ' + d.targetName + ' погашен — Ростовщик недовольно прячет расписку.', 'ok');
      else if (t) {
        const dmg = Math.round(95 * this.bossDmgMult(true));
        this.hurt(t, dmg); this.addTilt(10); s.shakeSeq++;
        this.log('Взыскание! ' + t.name + ' не заплатил по расписке (-' + dmg + ').', 'warn');
      }
    }
    if (s.execution) {
      const ex = s.execution; s.execution = null;
      const t = s.raiders.find((r) => r.id === ex.targetId && r.alive);
      if (t) {
        const covered = t.defending || t.hp >= t.maxHp * 0.6;
        const dmg = Math.round((covered ? 15 : 70) * this.bossDmgMult(true));
        this.hurt(t, dmg); s.shakeSeq++;
        this.log(covered ? 'Залп по ' + t.name + ' — но приговорённый успел укрыться (-' + dmg + ').' : 'Залп! Приказ о расстреле ' + t.name + ' исполнен (-' + dmg + ').', covered ? 'ok' : 'warn');
      }
    }
    if (s.quota) {
      const q = s.quota; s.quota = null;
      if (q.dealt >= q.need) {
        s.stagger = 0; s.vulnerableRounds = 2;
        this.log('План перевыполнен (' + q.dealt + '/' + q.need + ') — Держатель пакета в замешательстве! Бейте, пока открыт.', 'ok');
      } else {
        const dmg = Math.round(60 * this.bossDmgMult(true));
        for (const r of this.alive()) this.hurt(r, dmg);
        this.addTilt(12); s.shakeSeq++;
        this.log('План провален (' + q.dealt + '/' + q.need + ') — штраф всему отряду (-' + dmg + ').', 'warn');
      }
    }

    this.advanceLeader();
    const alive = this.alive();
    if (!alive.length) return;
    const t = s.bossMoveTimers;
    const lead = this.leaderRect();
    const nextToLeader = (r: Raider) => !!lead && GameEngine.rectDist(r.row, r.col, lead) <= 1;
    // Every enemy can cleave the front line, on top of its own signature kit.
    const moves: (keyof BossMoveTimers)[] = [...(this.currentDungeon().bossKit ?? ['beam', 'meteor', 'poison', 'chain', 'brace']), 'cleave'];
    for (const k of moves) t[k] = Math.max(0, t[k] - 1);
    // The signature comes on top of the boss's normal move, never instead of it.
    if (s.signature && s.signature !== 'feast' && --s.sigTimer <= 0 && this.castSignature(s.signature)) {
      s.sigTimer = SIG_COOLDOWN[s.signature];
    }

    const eligible = (k: keyof BossMoveTimers): boolean => {
      if (t[k] > 0) return false;
      if (k === 'beam') return s.encounterType === 'boss';
      if (k === 'poison') return s.phase >= 2 && !s.poison;
      if (k === 'chain') return s.phase >= 2 && !s.chain && alive.length >= 2;
      if (k === 'brace') return s.phase >= 2;
      if (k === 'freeze') return !s.frozen;
      if (k === 'curse') return true;
      if (k === 'cleave') return !s.danger && alive.some(nextToLeader);
      if (k === 'meteor') return !s.danger;
      return true;
    };

    let chosen: keyof BossMoveTimers | null = null;
    for (let i = 0; i < moves.length; i++) {
      const k = moves[(s.bossCyclePos + i) % moves.length];
      if (eligible(k)) { chosen = k; break; }
    }
    s.bossCyclePos = (s.bossCyclePos + 1) % moves.length;

    if (!chosen) {
      this.basicStrike();
      return;
    }

    switch (chosen) {
      case 'beam': {
        const target = alive[Math.floor(Math.random() * alive.length)];
        s.pendingCast = { targetId: target.id, targetName: target.name };
        t.beam = 4;
        this.log(target.name + ': «Рейд-лидер, на мне луч, СНИМИ ЕГО!»', 'warn');
        break;
      }
      case 'meteor': {
        // Aimed at columns people are actually standing in, so it always demands a move.
        const occupied = [...new Set(alive.map((r) => r.col))].sort(() => Math.random() - 0.5);
        const cols = occupied.slice(0, 2);
        while (cols.length < 2) {
          const c = Math.floor(Math.random() * GRID_COLS);
          if (!cols.includes(c)) cols.push(c);
        }
        cols.sort((a, b) => a - b);
        const cells: string[] = [];
        for (const c of cols) for (let row = 0; row < GRID_ROWS; row++) cells.push(row + ',' + c);
        s.danger = { kind: 'meteor', cells, cols };
        this.log('Небо над колоннами ' + cols.map((c) => c + 1).join(' и ') + ' наливается огнём — уйдите с отмеченных клеток!', 'warn');
        this.basicStrike();
        t.meteor = 3;
        break;
      }
      case 'cleave': {
        const cells: string[] = [];
        for (let row = 0; row < GRID_ROWS; row++) for (let col = 0; col < GRID_COLS; col++) {
          if (lead && GameEngine.rectDist(row, col, lead) === 1) cells.push(row + ',' + col);
        }
        s.danger = { kind: 'cleave', cells, cols: [] };
        this.log(this.leaderName() + ' раскручивает сокрушающий взмах вокруг себя — отступите или примите удар!', 'warn');
        this.basicStrike();
        t.cleave = 4;
        break;
      }
      case 'poison': {
        const target = alive[Math.floor(Math.random() * alive.length)];
        s.poison = { targetId: target.id, roundsLeft: 3, dmgPerTick: Math.round(16 * this.bossDmgMult()) };
        this.log('Босс отравляет ' + target.name + ' — яд будет разъедать её каждый ход.', 'warn');
        t.poison = 4;
        break;
      }
      case 'chain': {
        const pool = [...alive];
        const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        a.chainPartner = b.id; b.chainPartner = a.id;
        s.chain = { aId: a.id, bId: b.id, roundsLeft: 3 };
        this.log('Цепи сковали ' + a.name + ' и ' + b.name + ' — разорвите их!', 'warn');
        t.chain = 4;
        break;
      }
      case 'brace': {
        s.braceCall = { braced: new Set() };
        this.log('«Кровавый прилив» нарастает — отряду нужно приготовиться!', 'warn');
        t.brace = 5;
        break;
      }
      case 'freeze': {
        const target = alive[Math.floor(Math.random() * alive.length)];
        s.frozen = { targetId: target.id, targetName: target.name, roundsLeft: 2 };
        this.log(target.name + ' закован(а) в ледяной плен — расколите лёд или ждите оттепели.', 'warn');
        t.freeze = 5;
        break;
      }
      case 'curse': {
        const stacks = Math.min(4, (s.ashCurse?.stacks ?? 0) + 1);
        s.ashCurse = { stacks };
        this.log('Кардинал осыпает отряд пеплом — уязвимость ×' + stacks + ', пока кто-то не сплотит отряд.', 'warn');
        t.curse = 4;
        break;
      }
    }
  }

  /** Location-final boss's own move. Returns false when it has nothing sensible to do this turn (the kit acts instead). */
  private castSignature(sig: SignatureKind): boolean {
    const s = this.sim!;
    const alive = this.alive();
    if (!alive.length) return false;
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
    switch (sig) {
      case 'devour': {
        const lead = this.leaderRect();
        const front = alive.filter((r) => lead && GameEngine.rectDist(r.row, r.col, lead) <= 1);
        const t = pick(front.length ? front : alive);
        s.danger = { kind: 'devour', cells: [t.row + ',' + t.col], cols: [t.col] };
        this.log(s.boss.name + ' раскрывает пасть над ' + t.name + ' — уведите с этой клетки!', 'warn');
        return true;
      }
      case 'backstab': {
        const back = BACK_ROW;
        const cells: string[] = [];
        for (let col = 0; col < GRID_COLS; col++) cells.push(back + ',' + col);
        s.danger = { kind: 'backstab', cells, cols: [] };
        this.log(s.boss.name + ' растворяется в тенях и заходит в тыл — задний ряд под ударом!', 'warn');
        return true;
      }
      case 'iceShell': {
        if (s.iceShell) return false;
        s.iceShell = true;
        this.log(s.boss.name + ' покрывается ледяным панцирем — урон по нему −75%, пока его не расколют.', 'warn');
        return true;
      }
      case 'debt': {
        const t = pick(alive.filter((r) => r.role !== 'heal').length ? alive.filter((r) => r.role !== 'heal') : alive);
        s.debt = { targetId: t.id, targetName: t.name, paid: false };
        this.log(s.boss.name + ' выписывает долговую расписку на ' + t.name + ': ударь его до следующего хода — или взыскание!', 'warn');
        return true;
      }
      case 'execution': {
        const t = alive.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
        s.execution = { targetId: t.id, targetName: t.name };
        this.log(s.boss.name + ': «Расстрелять ' + t.name + '!» — подлечите выше 60% или прикройте обороной.', 'warn');
        return true;
      }
      case 'lava': {
        if (s.lava.length >= LAVA_MAX_CELLS) return false;
        const free: string[] = [];
        for (let row = 0; row < GRID_ROWS; row++) for (let col = 0; col < GRID_COLS; col++) {
          const k = row + ',' + col;
          if (!s.lava.includes(k) && !this.foeAt(row, col)) free.push(k);
        }
        const added = free.sort(() => Math.random() - 0.5).slice(0, 2);
        s.lava = [...s.lava, ...added];
        this.log('Извержение! Лава растекается по полю — стоять на ней больно.', 'warn');
        return true;
      }
      case 'quota': {
        const est = alive.reduce((sum, r) => sum + r.dps * this.outMult(r) * this.dpsMult() * ATTACK_TURN_SCALE, 0);
        s.quota = { need: Math.max(1, Math.round(est * QUOTA_SHARE)), dealt: 0 };
        this.log(s.boss.name + ' требует квартальный отчёт: нанесите ' + s.quota.need + ' урона до его следующего хода!', 'warn');
        return true;
      }
      case 'raise': {
        const up = s.minions.filter((m) => m.alive).length;
        const lead = this.leaderRect();
        if (!lead || up >= MINION_MAX) return false;
        // Cells right around the boss, the party's side first.
        const raiderCells = new Set(alive.map((r) => r.row + ',' + r.col));
        const free: { row: number; col: number }[] = [];
        for (let row = 0; row < GRID_ROWS; row++) for (let col = 0; col < GRID_COLS; col++) {
          if (GameEngine.rectDist(row, col, lead) === 1 && !this.foeAt(row, col) && !raiderCells.has(row + ',' + col)) free.push({ row, col });
        }
        free.sort((a, b) => b.row - a.row || Math.random() - 0.5);
        const n = Math.min(MINION_PER_CAST, MINION_MAX - up, free.length);
        if (!n) return false;
        const hp = Math.max(1, Math.round(s.boss.maxHp * MINION_HP_SHARE));
        for (const at of free.slice(0, n)) {
          s.minions.push({ id: MINION_ID0 + s.minions.length, role: 'brute', name: 'Скелет', maxHp: hp, hp, alive: true, ...at });
        }
        s.shakeSeq++;
        this.log(s.boss.name + ' поднимает мертвецов: ' + (n === 1 ? 'скелет встаёт' : n + ' скелета встают') + ' из земли!', 'warn');
        return true;
      }
      case 'feast':
        return false;
    }
  }

  /** Raised skeletons: each hits a raider next to it (tanks first), or shambles one cell toward the nearest. */
  private minionTurn() {
    const s = this.sim!;
    for (const m of s.minions) {
      if (!m.alive) continue;
      const alive = this.alive();
      if (!alive.length) return;
      const f: FoeRect = { id: m.id, row: m.row, col: m.col, w: 1, h: 1 };
      const near = () => alive.filter((r) => GameEngine.rectDist(r.row, r.col, f) <= 1);
      if (!near().length) {
        const t = alive.reduce((a, b) => (GameEngine.rectDist(b.row, b.col, f) < GameEngine.rectDist(a.row, a.col, f) ? b : a));
        const to = this.stepFoe(f, 1, (row, col) => GameEngine.rectDist(t.row, t.col, { ...f, row, col }));
        m.row = f.row = to.row; m.col = f.col = to.col;
      }
      const front = near();
      if (!front.length) continue;
      const tanks = front.filter((r) => r.role === 'tank');
      const pool = tanks.length ? tanks : front;
      const t = pool[Math.floor(Math.random() * pool.length)];
      const dmg = Math.round((MINION_DMG + Math.random() * 5) * this.bossDmgMult());
      this.hurt(t, dmg);
      this.log(m.name + ' бьёт ' + t.name + ' (-' + dmg + ').', 'warn');
    }
  }

  /** Plain strikes hit whoever stands next to the leader, tanks first; with nobody in its way it charges the nearest raider, harder. */
  private basicStrike() {
    const s = this.sim!;
    const alive = this.alive();
    if (!alive.length) return;
    const lead = this.leaderRect();
    const dist = (r: Raider) => (lead ? GameEngine.rectDist(r.row, r.col, lead) : 1);
    const front = alive.filter((r) => dist(r) <= 1);
    const tanks = front.filter((r) => r.role === 'tank');
    const nearest = alive.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    const pool = tanks.length ? tanks : front.length ? front : [nearest];
    const target = pool[Math.floor(Math.random() * pool.length)];
    const exposed = front.length === 0;
    const dmg = Math.round((20 + Math.random() * 12) * (exposed ? 1.3 : 1) * this.bossDmgMult());
    this.hurt(target, dmg);
    this.log(this.leaderName() + (exposed ? ' прорывается к ' + target.name + ' (-' + dmg + ') — никто не встал у него на пути.' : ' обрушивается на ' + target.name + ' (-' + dmg + ').'), 'warn');
  }

  endGame(win: boolean) {
    if (this.inArena) { this.endArenaGame(win); return; }
    if (this.inWeeklyChallenge) { this.endWeeklyChallenge(win); return; }
    const s = this.sim!; s.over = true;
    this.clearTurnTimer();
    const isBoss = s.encounterType === 'boss';
    this.haptic(() => Haptics.notificationAsync(win ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error));
    let loot: LootItem[] = [];
    let curioFound: string | null = null;
    let goldFound = 0;
    let reagentFound: ReagentDrop | null = null;
    const reagentDef = REAGENT_BY_LOCATION[this.currentDungeon().locationId];
    if (win && isBoss) {
      for (const r of s.raiders) this.gainXp(r.candidateId, 40);
      const shuffled = [...BOSS_LOOT_TABLE].sort(() => Math.random() - 0.5);
      loot = shuffled.slice(0, 1 + Math.floor(Math.random() * 2)).map((drop) => ({
        slot: drop.slot,
        gearId: drop.gearId,
        name: GEAR[drop.slot].find((o) => o.id === drop.gearId)?.name || drop.gearId,
        assigned: null,
      }));
      // Every boss's signature trophy is guaranteed on the dungeon's first-ever clear.
      if (!this.defeatedDungeons.has(this.dungeonId)) {
        for (const unique of [UNIQUE_BOSS_LOOT[this.dungeonId], UNIQUE_BOSS_LOOT_EXTRA[this.dungeonId]]) {
          if (!unique) continue;
          loot.push({
            slot: unique.slot,
            gearId: unique.gearId,
            name: GEAR[unique.slot].find((o) => o.id === unique.gearId)?.name || unique.gearId,
            assigned: null,
          });
        }
      }
      curioFound = this.rollCurio(0.6);
      goldFound = 70 + Math.floor(Math.random() * 41);
      this.statsBossWins++;
      this.bumpDaily('bossWin');
      if (reagentDef) {
        const qty = 2 + Math.floor(Math.random() * 2);
        this.reagentCounts[reagentDef.id] = (this.reagentCounts[reagentDef.id] || 0) + qty;
        reagentFound = { name: reagentDef.name, icon: reagentDef.icon, qty };
      }
    } else if (win) {
      for (const r of s.raiders) this.gainXp(r.candidateId, 15);
      this.everClearedRoom = true;
      this.statsRoomWins++;
      this.bumpDaily('roomWin');
      if (Math.random() < TRASH_LOOT_CHANCE) {
        const drop = TRASH_LOOT_TABLE[Math.floor(Math.random() * TRASH_LOOT_TABLE.length)];
        loot = [{
          slot: drop.slot,
          gearId: drop.gearId,
          name: GEAR[drop.slot].find((o) => o.id === drop.gearId)?.name || drop.gearId,
          assigned: null,
        }];
      }
      curioFound = this.rollCurio(0.2);
      goldFound = 12 + Math.floor(Math.random() * 11);
      if (reagentDef && Math.random() < ROOM_REAGENT_CHANCE) {
        this.reagentCounts[reagentDef.id] = (this.reagentCounts[reagentDef.id] || 0) + 1;
        reagentFound = { name: reagentDef.name, icon: reagentDef.icon, qty: 1 };
      }
    } else {
      this.statsWipes++;
    }
    this.gold += goldFound;
    if (goldFound > 0) this.bumpDaily('goldEarned', goldFound);
    this.result = { win, isBoss, loot, curioFound, goldFound, reagentFound };
    this.screen = 'results';
    this.notify();
  }
  private banterCache = new WeakMap<CombatResult, BanterLine[]>();
  /** Two lines of squad chatter for the result screen, fixed per result so re-renders don't reroll it. */
  banter(): BanterLine[] {
    const res = this.result; const s = this.sim;
    if (!res || !s) return [];
    const cached = this.banterCache.get(res);
    if (cached) return cached;
    const rough = s.raiders.some((r) => !r.alive || r.hp / r.maxHp < 0.3);
    const moment = barkMoment(res.win, res.isBoss, rough);
    const voiced = s.raiders.filter((r) => BARKS[r.candidateId]);
    const speakers = res.win ? voiced.filter((r) => r.alive) : voiced;
    const rnd = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
    const lines: BanterLine[] = [];
    if (speakers.length) {
      const a = rnd(speakers);
      lines.push({ id: a.candidateId, name: a.name, text: rnd(BARKS[a.candidateId][moment]) });
      const others = voiced.filter((r) => r.candidateId !== a.candidateId && (r.alive || !res.win));
      if (others.length) {
        const b = rnd(others);
        lines.push({ id: b.candidateId, name: b.name, text: rnd(BARKS[b.candidateId].reply) });
      }
    }
    this.banterCache.set(res, lines);
    return lines;
  }
  assignLoot(idx: number, raiderId: number) {
    const item = this.result!.loot[idx]; if (!item || item.assigned !== null) return;
    const raider = this.sim!.raiders.find((r) => r.id === raiderId); if (!raider) return;
    item.assigned = raiderId;
    this.everAssignedLoot = true;
    this.inventoryCounts[item.gearId] = (this.inventoryCounts[item.gearId] || 0) + 1;
    const candidate = this.pool.find((c) => c.id === raider.candidateId);
    // Into a free slot, or over an ordinary item; a worn armour-set piece stays on (the loot waits in the stash).
    if (candidate) { const slots = slotsForKind(item.slot); const s2 = slots.find((x) => candidate.equipment[x] === 'none') ?? slots.find((x) => !armourOf(candidate.equipment[x])); if (s2) candidate.equipment[s2] = item.gearId; }
    this.adjustMorale(raider.candidateId, raider.trait === 'legend' ? 20 : 15);
    for (const o of this.sim!.raiders) {
      if (o.id === raider.id) continue;
      let p = 5;
      if (o.trait === 'egoist') p = 10;
      if (o.trait === 'ninjaLooter') p = 12;
      if (o.trait === 'legend') p = 8;
      this.adjustMorale(o.candidateId, -p);
    }
    this.notify();
  }

  resultPrimary = () => {
    const res = this.result!;
    if (this.inArena) {
      this.inArena = false;
      this.arenaOpponent = null;
      this.encIdx = 0; this.sim = null; this.result = null;
      this.returnToCamp('arena');
      return;
    }
    if (this.inWeeklyChallenge) {
      this.inWeeklyChallenge = false;
      this.weeklyModifierDmgMult = 1;
      this.encIdx = 0; this.sim = null; this.result = null;
      this.returnToCamp('home');
      return;
    }
    if (res.win && !res.isBoss) {
      this.encIdx = Math.min(this.currentDungeon().encounters.length - 1, this.encIdx + 1);
      this.go('dungeon');
    } else {
      if (res.win && res.isBoss) this.defeatedDungeons.add(this.dungeonId);
      this.encIdx = 0; this.sim = null; this.result = null;
      this.returnToCamp('home');
    }
  };
  resultSecondary = () => {
    const wasArena = this.inArena;
    this.inArena = false;
    this.arenaOpponent = null;
    if (this.inWeeklyChallenge) { this.inWeeklyChallenge = false; this.weeklyModifierDmgMult = 1; }
    this.encIdx = 0; this.sim = null; this.result = null;
    this.returnToCamp(wasArena ? 'arena' : 'roster');
  };
}
