import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { POOL, RECRUITS, ALL_CANDIDATES, XP_PER_LEVEL, MAX_LEVEL } from '../data/characters';
import { GEAR, SLOT_LABEL, SLOT_ORDER, STARTING_INVENTORY, BOSS_LOOT_TABLE, TRASH_LOOT_TABLE, TRASH_LOOT_CHANCE, SELL_RATIO, UNIQUE_BOSS_LOOT } from '../data/gear';
import { DUNGEONS, DungeonDef, LOCATIONS } from '../data/dungeons';
import { ABILITY_BY_CANDIDATE } from '../data/abilities';
import { ABILITY_ART, SkillArtId } from '../data/skillArt';
import { TALENT_TREE, TalentTier } from '../data/talents';
import { CLASSES } from '../data/classes';
import { PROFESSIONS, PROFESSION_MAX_LEVEL, PROFESSION_XP_PER_LEVEL, professionTrainCost, scaledMult } from '../data/professions';
import { REAGENTS, REAGENT_BY_LOCATION, ROOM_REAGENT_CHANCE } from '../data/reagents';
import { RECIPES } from '../data/recipes';
import { GEAR_SETS, GearSetDef, SetBonusDef } from '../data/gearSets';
import { QUESTS } from '../data/quests';
import { ACHIEVEMENTS } from '../data/achievements';
import { DailyMetric, pickDailyTemplates } from '../data/dailyQuests';
import { ARENA_RIVALS, arenaRankName } from '../data/arena';
import { WeeklyModifierDef, pickWeeklyModifier, pickWeeklyDungeonId } from '../data/weeklyChallenge';
import { CURIOS } from '../data/curios';
import { EventOption, OFFICE_EVENTS } from '../data/events';
import { ItemIconId } from '../data/itemIcons';
import { IconName } from '../components/Icon';
import { AttackRange, Candidate, EncounterDef, GearSlotKey, Role } from '../data/types';
import {
  ACCENT, ATTACK_TURN_SCALE, HEAL_TURN_SCALE,
  GRID_ROWS, GRID_COLS, FRONT_ROW, BACK_ROW, MOVE_RANGE,
  Ability, AbilityIcon, BossMoveTimers, Enemy, EnemyRole, Raider, Sim, TurnEntry, LogKind,
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
const ROOM_GROUPS: EnemyRole[][] = [['brute', 'archer'], ['brute', 'shaman'], ['brute', 'archer', 'shaman']];
const ENEMY_HP_SHARE: Record<Exclude<EnemyRole, 'brute'>, number> = { archer: 0.28, shaman: 0.25 };
const ENEMY_NAME: Record<EnemyRole, string> = { brute: 'Громила', archer: 'Стрелок', shaman: 'Шаман' };
const ENEMY_NAME_ACC: Record<EnemyRole, string> = { brute: 'громилу', archer: 'стрелка', shaman: 'шамана' };
const ARCHER_DMG = 8;
const SHAMAN_HEAL_SHARE = 0.07;
// Splitting one HP pool into several targets loses damage to overkill and to
// venom dying with its carrier, so the group gets a slightly smaller pool.
const ROOM_GROUP_HP_MULT = 0.9;
const BERSERK_TAKEN_MULT = 1.25;
// Offsets the counterplay the positional layer adds (dodgeable area hits, a tank soaking the front) — tuned by simulation against the pre-rework difficulty.
const BOSS_DMG_SCALE = 1.6;
const EMPLOYEE_OF_MONTH_CYCLE = 3;
const DEPARTED_LOG_LIMIT = 20;

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
  reagentCounts: Record<string, number>;
  gold: number;
  dungeonId: string;
  defeatedDungeons: string[];
  claimedQuestIds: string[];
  curiosOwned: string[];
  claimedAchievementIds: string[];
  everCrafted: boolean;
  settings: { haptics: boolean };
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
}

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

export interface LootItem {
  slot: GearSlotKey;
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

export type TurnActionKey = 'attack' | 'heal' | 'ability' | 'interrupt' | 'breakChain' | 'brace' | 'rally' | 'breakIce' | 'defend';
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

  settings = { haptics: true };

  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private subs = new Set<() => void>();
  private version = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;

  constructor() {
    this.pool = POOL.map((c) => ({ ...c, level: 1, xp: 0, equipment: { weapon: 'none', armor: 'none', trinket: 'none' }, talents: [null, null, null, null], classId: null, professionId: null, professionLevel: 1, professionXp: 0 }));
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
            ...def, level: saved.level, xp: saved.xp, equipment: saved.equipment,
            talents: saved.talents, classId: saved.classId ?? null, professionId: saved.professionId ?? null,
            professionLevel: saved.professionLevel ?? 1, professionXp: saved.professionXp ?? 0, morale: saved.morale,
          };
        })
        .filter((c): c is Candidate => c != null);
    }
    if (data.selected) this.selected = new Set(data.selected);
    if (data.inventoryCounts) this.inventoryCounts = data.inventoryCounts;
    if (data.reagentCounts) this.reagentCounts = data.reagentCounts;
    if (typeof data.gold === 'number') this.gold = data.gold;
    if (data.dungeonId) this.dungeonId = data.dungeonId;
    if (data.defeatedDungeons) this.defeatedDungeons = new Set(data.defeatedDungeons);
    if (data.claimedQuestIds) this.claimedQuestIds = new Set(data.claimedQuestIds);
    if (data.curiosOwned) this.curiosOwned = new Set(data.curiosOwned);
    if (data.claimedAchievementIds) this.claimedAchievementIds = new Set(data.claimedAchievementIds);
    if (typeof data.everCrafted === 'boolean') this.everCrafted = data.everCrafted;
    if (data.settings) this.settings = { ...this.settings, ...data.settings };
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
  }
  async load() {
    try {
      const raw = await AsyncStorage.getItem(SAVE_KEY);
      if (raw) this.applySave(JSON.parse(raw));
    } catch {
      // corrupt or unavailable storage — start fresh rather than crash
    } finally {
      this.loaded = true;
      this.notify();
    }
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
    this.pool = POOL.map((c) => ({ ...c, level: 1, xp: 0, equipment: { weapon: 'none', armor: 'none', trinket: 'none' }, talents: [null, null, null, null], classId: null, professionId: null, professionLevel: 1, professionXp: 0 }));
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

  // ── navigation ───────────────────────────────────────────
  go(screen: Screen) {
    if (screen !== 'combat') this.clearTurnTimer();
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

  gearMults(c: Candidate) {
    const w = GEAR.weapon.find((x) => x.id === c.equipment.weapon) || GEAR.weapon[0];
    const a = GEAR.armor.find((x) => x.id === c.equipment.armor) || GEAR.armor[0];
    const t = GEAR.trinket.find((x) => x.id === c.equipment.trinket) || GEAR.trinket[0];
    return {
      outputMult: (w.mult || 1) * (a.mult || 1) * (t.mult || 1),
      hpMult: (w.hpMult || 1) * (a.hpMult || 1),
      wardMult: t.wardMult || 1,
      cdMult: t.cdMult || 1,
    };
  }

  // ── inventory ────────────────────────────────────────────
  itemOwned(gearId: string): number {
    return this.inventoryCounts[gearId] || 0;
  }
  itemInUseCount(slot: GearSlotKey, gearId: string, excludeCandidateId?: number): number {
    return this.pool.filter((c) => c.id !== excludeCandidateId && c.equipment[slot] === gearId).length;
  }
  itemAvailable(c: Candidate, slot: GearSlotKey, gearId: string): boolean {
    if (gearId === 'none') return true;
    if (c.equipment[slot] === gearId) return true;
    return this.itemOwned(gearId) - this.itemInUseCount(slot, gearId, c.id) > 0;
  }
  inventoryVM() {
    const rows: { slot: GearSlotKey; slotLabel: string; name: string; desc: string; icon?: ItemIconId; owned: number; free: number; wornBy: string[] }[] = [];
    for (const slot of SLOT_ORDER) {
      for (const o of GEAR[slot]) {
        if (o.id === 'none') continue;
        const owned = this.itemOwned(o.id);
        if (owned <= 0) continue;
        const wornBy = this.pool.filter((c) => c.equipment[slot] === o.id).map((c) => c.name);
        rows.push({ slot, slotLabel: SLOT_LABEL[slot], name: o.name, desc: o.desc, icon: o.icon, owned, free: owned - wornBy.length, wornBy });
      }
    }
    return rows;
  }

  // ── trader ───────────────────────────────────────────────
  buyItem(slot: GearSlotKey, gearId: string) {
    const o = GEAR[slot].find((x) => x.id === gearId);
    if (!o || !o.price || this.gold < o.price) return;
    this.gold -= o.price;
    this.inventoryCounts[gearId] = (this.inventoryCounts[gearId] || 0) + 1;
    this.bumpDaily('gearChange');
    this.notify();
  }
  sellItem(slot: GearSlotKey, gearId: string) {
    const o = GEAR[slot].find((x) => x.id === gearId);
    if (!o || !o.price) return;
    const wornBy = this.pool.filter((c) => c.equipment[slot] === gearId).length;
    const free = this.itemOwned(gearId) - wornBy;
    if (free <= 0) return;
    this.inventoryCounts[gearId] = this.itemOwned(gearId) - 1;
    this.gold += Math.round(o.price * SELL_RATIO);
    this.notify();
  }
  shopBuyVM(): ShopBuyOption[] {
    const rows: ShopBuyOption[] = [];
    for (const slot of SLOT_ORDER) {
      for (const o of GEAR[slot]) {
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
    for (const slot of SLOT_ORDER) {
      for (const o of GEAR[slot]) {
        if (!o.price) continue;
        const owned = this.itemOwned(o.id);
        if (owned <= 0) continue;
        const wornBy = this.pool.filter((c) => c.equipment[slot] === o.id).length;
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
      const cur = GEAR[slot].find((x) => x.id === c.equipment[slot]) || GEAR[slot][0];
      return {
        label: SLOT_LABEL[slot],
        desc: cur.desc,
        options: GEAR[slot].map((o) => {
          const selected = o.id === cur.id;
          const available = this.itemAvailable(c, slot, o.id);
          const free = o.id === 'none' ? Infinity : this.itemOwned(o.id) - this.itemInUseCount(slot, o.id, c.id);
          return {
            id: o.id,
            name: o.name,
            icon: o.icon,
            border: selected ? ACCENT : '#3f424d',
            bg: selected ? 'rgba(145,132,217,0.14)' : 'transparent',
            color: selected ? '#d2cefd' : available ? '#9397ab' : '#595d6c',
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
      if (c.equipment.armor === set.armor) count++;
      if (c.equipment.trinket === set.trinket) count++;
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
        slot: r.slot,
        slotLabel: SLOT_LABEL[r.slot],
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
    const due = active.reduce((sum, c) => sum + PAYROLL_BASE + c.level * PAYROLL_PER_LEVEL, 0);
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
    this.pool.push({ ...def, level: 1, xp: 0, equipment: { weapon: 'none', armor: 'none', trinket: 'none' }, talents: [null, null, null, null], classId: null, professionId: null, professionLevel: 1, professionXp: 0 });
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
    const order = [...OFFICE_EVENTS].sort(() => Math.random() - 0.5);
    for (const def of order) {
      const built = def.build(this);
      if (built) return built;
    }
    return null;
  }
  /** Returns true if an event was triggered (caller should route to the 'event' screen instead of going straight to camp). */
  private maybeTriggerEvent(returnTo: Screen): boolean {
    if (Math.random() >= 0.4) return false;
    const built = this.tryBuildEvent();
    if (!built) return false;
    this.pendingEventOptions = built.options;
    this.activeEvent = { title: built.title, desc: built.desc, labelA: built.options[0].label, labelB: built.options[1].label, resultText: null };
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
        outputMult: gm.outputMult * tm.outputMult * cm.outputMult * pm.outputMult * sm.outputMult * moraleMult,
        wardMult: gm.wardMult * tm.wardMult * cm.wardMult * pm.wardMult * sm.wardMult, levelMult: lvl,
        speed: baseSpeed[d.role] + (d.id % 5) * 0.1,
        chainPartner: null, defending: false, ability: this.makeAbility(d.id, gm.cdMult * tm.cdMult * pm.cdMult * sm.cdMult),
        row: BACK_ROW, col: i,
      };
    });
  }

  private buildRoomGroup(totalHp: number, roomIdx: number): Enemy[] {
    const roles = ROOM_GROUPS[Math.min(roomIdx, ROOM_GROUPS.length - 1)];
    const hps = roles.map((r) => (r === 'brute' ? 0 : Math.round(totalHp * ENEMY_HP_SHARE[r])));
    hps[0] = totalHp - hps.reduce((a, b) => a + b, 0);
    return roles.map((role, i) => ({ id: i, role, name: ENEMY_NAME[role], maxHp: hps[i], hp: hps[i], alive: true }));
  }

  freshSim(enc: EncounterDef, keepRaiders: Raider[] | null, roomIdx = 0): Sim {
    const raiders = keepRaiders || this.makeRaiders(this.squad());
    const dmgMult = this.inArena
      ? (this.arenaOpponent?.dmgMult ?? 1)
      : (this.currentDungeon().dmgMult ?? 1) * (this.inWeeklyChallenge ? this.weeklyModifierDmgMult : 1);
    raiders.forEach((r, i) => {
      r.chainPartner = null;
      r.defending = false;
      r.row = BACK_ROW; r.col = i;
      if (r.ability) { r.ability.active = false; r.ability.activeRounds = 0; r.ability.cd = 0; }
    });
    const enemies = enc.type === 'room' ? this.buildRoomGroup(Math.round(enc.hp * ROOM_GROUP_HP_MULT), roomIdx) : [];
    return {
      boss: { name: enc.enemyName, maxHp: enemies.length ? enemies.reduce((a, e) => a + e.maxHp, 0) : enc.hp, hp: enemies.length ? enemies.reduce((a, e) => a + e.hp, 0) : enc.hp },
      enemies, focusId: enemies.length ? enemies[0].id : null,
      fx: { seq: 0, actor: null, kind: null, crit: false, targetEnemy: null, targetRaider: null },
      impact: { seq: 0, cells: [] }, shakeSeq: 0,
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
    this.screen = 'combat';
    this.beginRound();
    if (!this.sim.over) this.advanceTurn();
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
    if (!this.sim.over) this.advanceTurn();
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
    this.turnTimer = setTimeout(() => { this.turnTimer = null; this.advanceTurn(); this.notify(); }, delay);
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
    } else {
      this.bossTurn();
      this.checkDeaths();
      if (this.checkOutcome()) return;
      this.scheduleAdvance(900);
    }
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
    if (s.boss.hp <= 0) { this.endGame(true); return true; }
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
    if (r.role === 'tank' && r.row === FRONT_ROW) d *= TANK_GUARD_MULT;
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
    if (r.attackRange !== 'melee' || r.row !== FRONT_ROW) return 0;
    return this.alive().filter((x) => x.id !== r.id && x.row === FRONT_ROW && Math.abs(x.col - r.col) === 1).length;
  }
  /** Every hit on the boss goes through here so combos, the stun window and the stagger meter apply consistently. */
  private hitBoss(r: Raider, raw: number, staggerGain: number): { dmg: number; note: string } {
    const s = this.sim!;
    const tags: string[] = [];
    let m = 1;
    if (r.ability.kind === 'berserk' && r.ability.active) { m *= 2; tags.push('берсерк'); }
    const allies = this.frontAllies(r);
    if (allies > 0) { m *= 1 + FORMATION_BONUS * allies; tags.push('строй'); }
    const target = this.focusEnemy();
    if (s.bossPoison && (s.bossPoison.enemyId == null || s.bossPoison.enemyId === target?.id)) { m *= POISONED_BOSS_MULT; tags.push('яд'); }
    if (s.vulnerableRounds > 0) { m *= VULNERABLE_MULT; tags.push('оглушён'); }
    const dmg = Math.max(1, Math.round(raw * m));
    this.damageFoe(dmg, target ? target.id : null);
    if (target) tags.unshift('→ ' + target.name);
    if (s.vulnerableRounds === 0 && !s.stunned && staggerGain > 0 && s.boss.hp > 0) {
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
    if (!s.enemies.length) return null;
    return s.enemies.find((e) => e.id === s.focusId && e.alive) || s.enemies.find((e) => e.alive) || null;
  }
  setFocus(enemyId: number) {
    const s = this.sim;
    if (!s || !s.enemies.some((e) => e.id === enemyId && e.alive)) return;
    s.focusId = enemyId;
    this.notify();
  }
  /** Applies damage to a room enemy (or the boss), handles deaths and keeps the group total in s.boss in sync. */
  private damageFoe(dmg: number, enemyId: number | null) {
    const s = this.sim!;
    if (!s.enemies.length) { s.boss.hp = Math.max(0, s.boss.hp - dmg); return; }
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
        if (occupied.has(row + ',' + col)) continue;
        cells.push({ row, col });
      }
    }
    return cells;
  }
  moveRaider(row: number, col: number) {
    const s = this.sim; const r = this.currentRaider();
    if (!s || !r || !s.movePhase) return;
    if (!this.reachableCells().some((c) => c.row === row && c.col === col)) return;
    r.row = row; r.col = col;
    s.movePhase = false;
    this.log(r.name + (row === FRONT_ROW ? ' выходит на передний край.' : ' меняет позицию на поле.'));
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
    const inMeleeRange = r.attackRange === 'ranged' || r.row === FRONT_ROW;
    const focus = this.focusEnemy();
    actions.push({
      key: 'attack', label: 'Атаковать', needsTarget: false, disabled: !inMeleeRange,
      sub: !inMeleeRange ? 'нужен передний край' : focus ? 'цель: ' + focus.name : undefined,
    });
    if (r.role === 'heal') {
      actions.push({ key: 'heal', label: 'Лечить', needsTarget: true, disabled: false });
    }
    const def = ABILITY_BY_CANDIDATE[r.candidateId];
    actions.push({
      key: 'ability', label: def.name, abilityIcon: def.icon, abilityArt: ABILITY_ART[r.candidateId], needsTarget: false,
      disabled: r.ability.cd > 0, sub: r.ability.cd > 0 ? `КД: ${r.ability.cd}` : undefined,
    });
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
    const fxKind = key === 'attack' ? (r.attackRange === 'melee' ? 'melee' : 'ranged') : key === 'heal' ? 'heal' : key === 'ability' ? 'ability' : null;
    const aimsAtEnemy = key === 'attack' || key === 'ability';
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
    const frontMelee = r.attackRange === 'melee' && r.row === FRONT_ROW;
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
        s.bossPoison = { roundsLeft: 3, dmgPerTick: Math.round(9 * this.outMult(r) * ATTACK_TURN_SCALE * 0.5), enemyId: this.focusEnemy()?.id ?? null };
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
      const interrupted = !!(s.pendingCast || s.braceCall || s.danger);
      s.pendingCast = null; s.braceCall = null; s.danger = null;
      this.log((s.enemies.length ? 'Враги оглушены и пропускают ход' : s.boss.name + ' оглушён и пропускает ход') + (interrupted ? ' — заготовленная атака сорвана.' : '.'), 'ok');
      return;
    }
    if (s.vulnerableRounds === 0) s.stagger = Math.max(0, s.stagger - STAGGER_DECAY);
    s.fx = { seq: s.fx.seq + 1, actor: 'enemy', kind: 'enemy', crit: false, targetEnemy: null, targetRaider: null };
    if (!s.enemies.length) { this.leaderTurn(); return; }
    const has = (role: EnemyRole) => s.enemies.some((e) => e.role === role && e.alive);
    if (has('brute')) this.leaderTurn();
    if (has('archer')) this.archerShot();
    if (has('shaman')) this.shamanTurn();
  }

  /** Picks off the back line — healers and ranged — which a front-row tank can't cover. */
  private archerShot() {
    const alive = this.alive();
    if (!alive.length) return;
    const backRow = Math.max(...alive.map((r) => r.row));
    const pool = alive.filter((r) => r.row === backRow);
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
      const dmg = Math.round((zone.kind === 'meteor' ? 55 : 45) * this.bossDmgMult(true));
      const hit = this.alive().filter((r) => zone.cells.includes(r.row + ',' + r.col));
      for (const r of hit) { this.hurt(r, dmg); this.addTilt(6); }
      s.impact = { seq: s.impact.seq + 1, cells: zone.cells };
      if (hit.length) s.shakeSeq++;
      const what = zone.kind === 'meteor' ? 'Огненный дождь' : 'Сокрушающий взмах';
      if (hit.length) this.log(what + ' накрывает: ' + hit.map((r) => r.name).join(', ') + ' (-' + dmg + ').', 'warn');
      else this.log(what + ' бьёт в пустоту — отряд вовремя сменил позицию.', 'ok');
      return;
    }

    const alive = this.alive();
    if (!alive.length) return;
    const t = s.bossMoveTimers;
    // Every enemy can cleave the front line, on top of its own signature kit.
    const moves: (keyof BossMoveTimers)[] = [...(this.currentDungeon().bossKit ?? ['beam', 'meteor', 'poison', 'chain', 'brace']), 'cleave'];
    for (const k of moves) t[k] = Math.max(0, t[k] - 1);

    const eligible = (k: keyof BossMoveTimers): boolean => {
      if (t[k] > 0) return false;
      if (k === 'beam') return s.encounterType === 'boss';
      if (k === 'poison') return s.phase >= 2 && !s.poison;
      if (k === 'chain') return s.phase >= 2 && !s.chain && alive.length >= 2;
      if (k === 'brace') return s.phase >= 2;
      if (k === 'freeze') return !s.frozen;
      if (k === 'curse') return true;
      if (k === 'cleave') return alive.some((r) => r.row === FRONT_ROW);
      return true; // meteor
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
        for (let col = 0; col < GRID_COLS; col++) cells.push(FRONT_ROW + ',' + col);
        s.danger = { kind: 'cleave', cells, cols: [] };
        this.log(this.leaderName() + ' замахивается на передний ряд — отступите или примите удар!', 'warn');
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

  /** Plain strikes go for whoever is standing in front, tanks first; an empty front line lets the boss reach anyone, harder. */
  private basicStrike() {
    const s = this.sim!;
    const alive = this.alive();
    if (!alive.length) return;
    const front = alive.filter((r) => r.row === FRONT_ROW);
    const tanks = front.filter((r) => r.role === 'tank');
    const pool = tanks.length ? tanks : front.length ? front : alive;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const exposed = front.length === 0;
    const dmg = Math.round((20 + Math.random() * 12) * (exposed ? 1.3 : 1) * this.bossDmgMult());
    this.hurt(target, dmg);
    this.log(this.leaderName() + ' обрушивается на ' + target.name + ' (-' + dmg + ')' + (exposed ? ' — передний край пуст, никто не прикрыл.' : '.'), 'warn');
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
      const unique = UNIQUE_BOSS_LOOT[this.dungeonId];
      if (unique && !this.defeatedDungeons.has(this.dungeonId)) {
        loot.push({
          slot: unique.slot,
          gearId: unique.gearId,
          name: GEAR[unique.slot].find((o) => o.id === unique.gearId)?.name || unique.gearId,
          assigned: null,
        });
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
  assignLoot(idx: number, raiderId: number) {
    const item = this.result!.loot[idx]; if (!item || item.assigned !== null) return;
    const raider = this.sim!.raiders.find((r) => r.id === raiderId); if (!raider) return;
    item.assigned = raiderId;
    this.everAssignedLoot = true;
    this.inventoryCounts[item.gearId] = (this.inventoryCounts[item.gearId] || 0) + 1;
    const candidate = this.pool.find((c) => c.id === raider.candidateId);
    if (candidate) candidate.equipment[item.slot] = item.gearId;
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
