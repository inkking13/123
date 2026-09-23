import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { POOL, RECRUITS, ALL_CANDIDATES, XP_PER_LEVEL, MAX_LEVEL } from '../data/characters';
import { GEAR, SLOT_LABEL, SLOT_ORDER, STARTING_INVENTORY, BOSS_LOOT_TABLE, TRASH_LOOT_TABLE, TRASH_LOOT_CHANCE, SELL_RATIO, UNIQUE_BOSS_LOOT } from '../data/gear';
import { DUNGEONS, DungeonDef } from '../data/dungeons';
import { ABILITY_BY_CANDIDATE } from '../data/abilities';
import { TALENT_TREE, TalentTier } from '../data/talents';
import { CLASSES } from '../data/classes';
import { QUESTS } from '../data/quests';
import { DailyMetric, pickDailyTemplates } from '../data/dailyQuests';
import { ARENA_RIVALS, arenaRankName } from '../data/arena';
import { CURIOS } from '../data/curios';
import { EventOption, OFFICE_EVENTS } from '../data/events';
import { ItemIconId } from '../data/itemIcons';
import { IconName } from '../components/Icon';
import { AttackRange, Candidate, EncounterDef, GearSlotKey, Role } from '../data/types';
import {
  ACCENT, ATTACK_TURN_SCALE, HEAL_TURN_SCALE,
  GRID_ROWS, GRID_COLS, FRONT_ROW, BACK_ROW, MOVE_RANGE,
  Ability, AbilityIcon, BossMoveTimers, Raider, Sim, TurnEntry, LogKind,
} from '../combat/types';

export type Screen = 'title' | 'home' | 'roster' | 'char' | 'gear' | 'dungeon' | 'combat' | 'results' | 'quests' | 'inventory' | 'settings' | 'shop' | 'event' | 'analytics' | 'personnel' | 'levelmap' | 'hire' | 'arena';

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
  pool: { id: number; level: number; xp: number; equipment: Record<GearSlotKey, string>; talents: (string | null)[]; classId: string | null; morale: number }[];
  selected: number[];
  inventoryCounts: Record<string, number>;
  gold: number;
  dungeonId: string;
  defeatedDungeons: string[];
  claimedQuestIds: string[];
  curiosOwned: string[];
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
export interface CombatResult {
  win: boolean;
  isBoss: boolean;
  loot: LootItem[];
  curioFound: string | null;
  goldFound: number;
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

export type TurnActionKey = 'attack' | 'heal' | 'ability' | 'interrupt' | 'breakChain' | 'brace' | 'rally' | 'breakIce';
export interface TurnActionVM {
  key: TurnActionKey;
  label: string;
  sub?: string;
  abilityIcon?: AbilityIcon;
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
  claimedQuestIds = new Set<string>();
  curiosOwned = new Set<string>();

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

  settings = { haptics: true };

  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private subs = new Set<() => void>();
  private version = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private loaded = false;

  constructor() {
    this.pool = POOL.map((c) => ({ ...c, level: 1, xp: 0, equipment: { weapon: 'none', armor: 'none', trinket: 'none' }, talents: [null, null, null, null], classId: null }));
    this.selected = new Set([0, 2, 4, 5, 6]);
    this.inventoryCounts = { ...STARTING_INVENTORY };
  }

  // ── persistence ──────────────────────────────────────────
  // Combat state (sim) and current screen are deliberately excluded — a
  // restart always resumes at the title screen, out of combat.
  private serialize(): SaveData {
    return {
      pool: this.pool.map((c) => ({ id: c.id, level: c.level, xp: c.xp, equipment: c.equipment, talents: c.talents, classId: c.classId, morale: c.morale })),
      selected: Array.from(this.selected),
      inventoryCounts: this.inventoryCounts,
      gold: this.gold,
      dungeonId: this.dungeonId,
      defeatedDungeons: Array.from(this.defeatedDungeons),
      claimedQuestIds: Array.from(this.claimedQuestIds),
      curiosOwned: Array.from(this.curiosOwned),
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
            talents: saved.talents, classId: saved.classId ?? null, morale: saved.morale,
          };
        })
        .filter((c): c is Candidate => c != null);
    }
    if (data.selected) this.selected = new Set(data.selected);
    if (data.inventoryCounts) this.inventoryCounts = data.inventoryCounts;
    if (typeof data.gold === 'number') this.gold = data.gold;
    if (data.dungeonId) this.dungeonId = data.dungeonId;
    if (data.defeatedDungeons) this.defeatedDungeons = new Set(data.defeatedDungeons);
    if (data.claimedQuestIds) this.claimedQuestIds = new Set(data.claimedQuestIds);
    if (data.curiosOwned) this.curiosOwned = new Set(data.curiosOwned);
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
    this.pool = POOL.map((c) => ({ ...c, level: 1, xp: 0, equipment: { weapon: 'none', armor: 'none', trinket: 'none' }, talents: [null, null, null, null], classId: null }));
    this.selected = new Set([0, 2, 4, 5, 6]);
    this.inventoryCounts = { ...STARTING_INVENTORY };
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
    this.claimedQuestIds = new Set();
    this.curiosOwned = new Set();
    this.statsRoomWins = 0; this.statsBossWins = 0; this.statsWipes = 0;
    this.history = [];
    this.campReturns = 0;
    this.departedLog = [];
    this.dailyDate = ''; this.dailyProgress = {}; this.dailyClaimedIds = new Set();
    this.arenaRating = 1000; this.arenaWins = 0; this.arenaLosses = 0; this.inArena = false; this.arenaOpponent = null;
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
    this.pool.push({ ...def, level: 1, xp: 0, equipment: { weapon: 'none', armor: 'none', trinket: 'none' }, talents: [null, null, null, null], classId: null });
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

  makeRaiders(squad: Candidate[]): Raider[] {
    const baseSpeed: Record<Role, number> = { dps: 12, heal: 9, tank: 6 };
    return squad.map((d, i) => {
      const gm = this.gearMults(d);
      const tm = this.talentMults(d);
      const cm = this.classMults(d);
      // A satisfied employee performs better — an unhappy one phones it in.
      const moraleMult = d.morale >= 80 ? 1.05 : d.morale < 30 ? 0.90 : 1;
      // Spread over the full 30-level track rather than the old 5-level one —
      // +2%/level caps at +58% instead of the old +20%, so a maxed veteran is
      // meaningfully stronger without trivialising the early campaign.
      const lvl = 1 + (d.level - 1) * 0.02;
      const maxHp = Math.round(d.hp * gm.hpMult * tm.hpMult * cm.hpMult * lvl);
      return {
        id: i, name: d.name, role: d.role, attackRange: d.attackRange, candidateId: d.id, trait: d.trait, level: d.level,
        maxHp, hp: maxHp, alive: true, dps: d.dps, healPower: d.healPower || 9,
        outputMult: gm.outputMult * tm.outputMult * cm.outputMult * moraleMult, wardMult: gm.wardMult * tm.wardMult * cm.wardMult, levelMult: lvl,
        speed: baseSpeed[d.role] + (d.id % 5) * 0.1,
        chainPartner: null, ability: this.makeAbility(d.id, gm.cdMult * tm.cdMult),
        row: BACK_ROW, col: i,
      };
    });
  }

  freshSim(enc: EncounterDef, keepRaiders: Raider[] | null): Sim {
    const raiders = keepRaiders || this.makeRaiders(this.squad());
    const dmgMult = this.inArena ? (this.arenaOpponent?.dmgMult ?? 1) : (this.currentDungeon().dmgMult ?? 1);
    raiders.forEach((r, i) => {
      r.chainPartner = null;
      r.row = BACK_ROW; r.col = i;
      if (r.ability) { r.ability.active = false; r.ability.activeRounds = 0; r.ability.cd = 0; }
    });
    return {
      boss: { name: enc.enemyName, maxHp: enc.hp, hp: enc.hp },
      name: enc.name, raiders, encounterType: enc.type, dmgMult,
      round: 1, order: [], turnPos: -1, awaitingPlayer: false, movePhase: false, bossCyclePos: 0,
      bossMoveTimers: { beam: 1, meteor: 2, poison: 3, chain: 3, brace: 3, freeze: 2, curse: 2 },
      pendingCast: null, chain: null, poison: null, bossPoison: null, partyWard: null, braceCall: null,
      frozen: null, ashCurse: null,
      rallyCd: 0, tilt: 0, phase: 1, log: [], over: false, selected: null,
    };
  }

  startEncounter = () => {
    const enc = this.currentDungeon().encounters[this.encIdx];
    const keep = this.sim && this.sim.raiders.some((r) => r.alive) ? this.sim.raiders : null;
    this.sim = this.freshSim(enc, keep);
    this.log(enc.type === 'boss' ? 'Пул начался. Рейд-лидер, командуй!' : 'Отряд входит в бой: ' + enc.name + '.');
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
    this.result = { win, isBoss: true, loot: [], curioFound: null, goldFound };
    this.screen = 'results';
    this.notify();
  }

  goDungeon() {
    this.encIdx = 0;
    this.sim = null;
    this.go('dungeon');
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

    if (s.phase >= 3) {
      const dmg = Math.round(10 * s.dmgMult);
      if (this.alive().length) {
        for (const r of this.alive()) this.hurt(r, dmg);
        this.log('Аура ярости обжигает весь рейд (-' + dmg + ').', 'warn');
      }
    }
    if (s.chain) {
      const a = s.raiders.find((r) => r.id === s.chain!.aId);
      const b = s.raiders.find((r) => r.id === s.chain!.bId);
      if (a && b && a.alive && b.alive) {
        const dmg = Math.round(22 * s.dmgMult);
        this.hurt(a, dmg); this.hurt(b, dmg); this.addTilt(6);
        this.log('Цепь бьёт током — ' + a.name + ' и ' + b.name + ' страдают (-' + dmg + ').', 'warn');
        s.chain.roundsLeft--;
        if (s.chain.roundsLeft <= 0) { a.chainPartner = null; b.chainPartner = null; s.chain = null; }
      } else {
        if (a) a.chainPartner = null; if (b) b.chainPartner = null; s.chain = null;
      }
    }
    if (s.bossPoison) {
      const dmg = Math.round(s.bossPoison.dmgPerTick);
      s.boss.hp = Math.max(0, s.boss.hp - dmg);
      this.log('Яд василиска продолжает разъедать босса (-' + dmg + ').', 'ok');
      s.bossPoison.roundsLeft--;
      if (s.bossPoison.roundsLeft <= 0) s.bossPoison = null;
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
      this.haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      this.log('Босс: «Вы недооцениваете меня!» Земля исходит ядом.', 'warn');
    } else if (s.phase === 2 && s.boss.hp <= s.boss.maxHp * 0.25) {
      s.phase = 3;
      this.haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      this.log('Босс впадает в ярость! Аура жжёт весь рейд.', 'warn');
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
    actions.push({
      key: 'attack', label: 'Атаковать', needsTarget: false, disabled: !inMeleeRange,
      sub: inMeleeRange ? undefined : 'нужен передний край',
    });
    if (r.role === 'heal') {
      actions.push({ key: 'heal', label: 'Лечить', needsTarget: true, disabled: false });
    }
    const def = ABILITY_BY_CANDIDATE[r.candidateId];
    actions.push({
      key: 'ability', label: def.name, abilityIcon: def.icon, needsTarget: false,
      disabled: r.ability.cd > 0, sub: r.ability.cd > 0 ? `КД: ${r.ability.cd}` : undefined,
    });
    if (s.rallyCd <= 0) actions.push({ key: 'rally', label: 'Сплотить отряд', needsTarget: false, disabled: false });
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
    switch (key) {
      case 'attack': this.doAttack(r); break;
      case 'heal': this.doHeal(r, targetId); break;
      case 'ability': this.doAbility(r); break;
      case 'interrupt': this.doInterrupt(r); break;
      case 'breakChain': this.doBreakChain(r); break;
      case 'breakIce': this.doBreakIce(r); break;
      case 'brace': this.doBrace(r); break;
      case 'rally': this.doRally(r); break;
    }
    this.checkDeaths();
    this.notify();
    if (!this.checkOutcome()) this.scheduleAdvance(650);
  };

  private doAttack(r: Raider) {
    const s = this.sim!;
    const crit = Math.random() < 0.14;
    let dmg = Math.max(1, Math.round(r.dps * this.outMult(r) * this.dpsMult() * ATTACK_TURN_SCALE));
    if (crit) dmg = Math.round(dmg * 1.8);
    s.boss.hp = Math.max(0, s.boss.hp - dmg);
    this.log(r.name + (crit ? ' наносит критический удар: -' : ' атакует: -') + dmg, crit ? 'ok' : undefined);
    if (crit) this.haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    this.checkPhase();
  }
  private doHeal(r: Raider, targetId?: number) {
    let t = targetId != null ? this.sim!.raiders.find((x) => x.id === targetId && x.alive) || null : null;
    if (!t) t = this.healTarget(r) || r;
    const amt = Math.max(1, Math.round(r.healPower * this.outMult(r) * this.healMult() * HEAL_TURN_SCALE));
    t.hp = Math.min(t.maxHp, t.hp + amt);
    this.log(r.name + ' лечит ' + t.name + ': +' + amt, 'ok');
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
    const hadCurse = !!s.ashCurse;
    s.ashCurse = null;
    this.log(r.name + ': «Так, все выдохнули! Добиваем!»' + (hadCurse ? ' Пепел стряхнут с плеч отряда.' : ''), 'ok');
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
        a.active = true; a.activeRounds = a.activeMax; a.cd = a.cdMax;
        this.log(r.name + ' раскрывает Librum Tenebris — урон по нему снижен.', 'ok');
        break;
      case 'partyShield':
        a.active = true; a.activeRounds = a.activeMax; a.cd = a.cdMax;
        s.partyWard = { roundsLeft: a.activeMax, mult: 0.7 };
        this.log(r.name + ' встаёт последним рубежом — весь отряд получает меньше урона.', 'ok');
        break;
      case 'drainHeal': {
        a.cd = a.cdMax;
        const t = this.healTarget(r) || r;
        t.hp = Math.min(t.maxHp, t.hp + 90);
        r.hp = Math.max(1, r.hp - 15);
        this.log(r.name + ' платит собственной кровью за исцеление: ' + t.name, 'ok');
        break;
      }
      case 'volatileHeal': {
        a.cd = a.cdMax;
        const t = this.healTarget(r) || r;
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
        s.bossPoison = { roundsLeft: 3, dmgPerTick: Math.round(9 * this.outMult(r) * ATTACK_TURN_SCALE * 0.5) };
        this.log(r.name + ' смазывает клинки ядом василиска.', 'ok');
        break;
      case 'berserk':
        a.active = true; a.activeRounds = a.activeMax; a.cd = a.cdMax;
        this.log(r.name + ' впадает в кровавую ярость — урон удвоен, но и сам он уязвим.', 'ok');
        break;
      case 'nukeSelfDamage': {
        a.cd = a.cdMax;
        const dmg = Math.round(r.dps * this.outMult(r) * this.dpsMult() * ATTACK_TURN_SCALE * 0.9);
        s.boss.hp = Math.max(0, s.boss.hp - dmg);
        this.hurt(r, 10);
        this.log(r.name + ' бьёт зелёной стрелой (-' + dmg + ') — яд ранит и её саму.', 'ok');
        break;
      }
      case 'nukeHeal': {
        a.cd = a.cdMax;
        const dmg = Math.round(r.dps * this.outMult(r) * this.dpsMult() * ATTACK_TURN_SCALE * 0.9);
        s.boss.hp = Math.max(0, s.boss.hp - dmg);
        for (const x of this.alive()) x.hp = Math.min(x.maxHp, x.hp + 20);
        this.log(r.name + ' выпускает Огонь Душ (-' + dmg + ') — обжигает врага и лечит отряд.', 'ok');
        break;
      }
      case 'nukeTilt': {
        a.cd = a.cdMax;
        const dmg = Math.round(r.dps * this.outMult(r) * this.dpsMult() * ATTACK_TURN_SCALE * 1.3);
        s.boss.hp = Math.max(0, s.boss.hp - dmg);
        this.addTilt(6);
        this.log(r.name + ' карает врага именем бога (-' + dmg + '), в которого уже не верит.', 'warn');
        break;
      }
    }
    this.checkPhase();
  }

  // ── boss turn ────────────────────────────────────────────
  private bossTurn() {
    const s = this.sim!;
    if (s.pendingCast) {
      const t = s.raiders.find((r) => r.id === s.pendingCast!.targetId);
      if (t && t.alive) {
        const dmg = Math.round(140 * s.dmgMult);
        this.hurt(t, dmg);
        this.addTilt(15);
        this.log(t.name + ' получает полный луч смерти в лицо (-' + dmg + ').', 'warn');
      }
      s.pendingCast = null;
      return;
    }
    if (s.braceCall) {
      const soaked = s.braceCall.braced.size >= 3;
      const dmg = Math.round((soaked ? 38 : 100) * s.dmgMult);
      for (const r of this.alive()) this.hurt(r, dmg);
      this.addTilt(soaked ? 4 : 16);
      this.log(soaked ? 'Рейд приготовился вовремя — «Кровавый прилив» смягчён.' : 'Никто толком не приготовился — Прилив ударил в полную силу!', soaked ? 'ok' : 'warn');
      s.braceCall = null;
      return;
    }

    const alive = this.alive();
    if (!alive.length) return;
    const t = s.bossMoveTimers;
    const moves: (keyof BossMoveTimers)[] = this.currentDungeon().bossKit ?? ['beam', 'meteor', 'poison', 'chain', 'brace'];
    for (const k of moves) t[k] = Math.max(0, t[k] - 1);

    const eligible = (k: keyof BossMoveTimers): boolean => {
      if (t[k] > 0) return false;
      if (k === 'beam') return s.encounterType === 'boss';
      if (k === 'poison') return s.phase >= 2 && !s.poison;
      if (k === 'chain') return s.phase >= 2 && !s.chain && alive.length >= 2;
      if (k === 'brace') return s.phase >= 2;
      if (k === 'freeze') return !s.frozen;
      if (k === 'curse') return true;
      return true; // meteor
    };

    let chosen: keyof BossMoveTimers | null = null;
    for (let i = 0; i < moves.length; i++) {
      const k = moves[(s.bossCyclePos + i) % moves.length];
      if (eligible(k)) { chosen = k; break; }
    }
    s.bossCyclePos = (s.bossCyclePos + 1) % moves.length;

    if (!chosen) {
      const target = alive[Math.floor(Math.random() * alive.length)];
      const dmg = Math.round((20 + Math.random() * 12) * s.dmgMult);
      this.hurt(target, dmg);
      this.log(s.name + ' обрушивается на ' + target.name + ' (-' + dmg + ').', 'warn');
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
        const n = Math.min(alive.length, 2);
        const pool = [...alive];
        const dmg = Math.round(55 * s.dmgMult);
        for (let i = 0; i < n; i++) {
          const idx = Math.floor(Math.random() * pool.length);
          const target = pool.splice(idx, 1)[0];
          this.hurt(target, dmg);
          this.addTilt(8);
          this.log(target.name + ': «Я стою в огне!» (-' + dmg + ')', 'warn');
        }
        t.meteor = 3;
        break;
      }
      case 'poison': {
        const target = alive[Math.floor(Math.random() * alive.length)];
        s.poison = { targetId: target.id, roundsLeft: 3, dmgPerTick: Math.round(16 * s.dmgMult) };
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

  endGame(win: boolean) {
    if (this.inArena) { this.endArenaGame(win); return; }
    const s = this.sim!; s.over = true;
    this.clearTurnTimer();
    const isBoss = s.encounterType === 'boss';
    this.haptic(() => Haptics.notificationAsync(win ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error));
    let loot: LootItem[] = [];
    let curioFound: string | null = null;
    let goldFound = 0;
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
    } else {
      this.statsWipes++;
    }
    this.gold += goldFound;
    if (goldFound > 0) this.bumpDaily('goldEarned', goldFound);
    this.result = { win, isBoss, loot, curioFound, goldFound };
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
    this.encIdx = 0; this.sim = null; this.result = null;
    this.returnToCamp(wasArena ? 'arena' : 'roster');
  };
}
