extends Node
## The guild: everything outside a fight — heroes, gear, gold, the camp's
## systems, saving — ported from the Expo game's GameEngine. Fights live in
## Battle (battle.gd), reached as Game.b. Screens listen to `changed`.

signal changed

const SAVE_PATH := "user://save.json"
const STARTING_GOLD := 60
const MIN_ROSTER := 5
const PAYROLL_BASE := 5
const PAYROLL_PER_LEVEL := 1
const RESIGNATION_MORALE_THRESHOLD := 15
const RESIGNATION_CHANCE := 0.5
const HISTORY_LIMIT := 30
const EMPLOYEE_OF_MONTH_CYCLE := 3
const DEPARTED_LOG_LIMIT := 20
const FEUD_MULT := 0.9
const STRIKE_MULT := 0.85
const TRANSIENT_SCREENS := ["draft", "dungeon", "combat", "results", "event"]
const SCREEN_TITLE := {
	"title": "Меню", "home": "Лагерь", "roster": "Отряд", "gear": "Снаряжение", "inventory": "Инвентарь", "shop": "Закупки",
	"analytics": "Аналитика", "personnel": "Личные дела", "levelmap": "Карта", "hire": "Найм", "arena": "Арена",
	"profession": "Профессия", "achievements": "Достижения", "weekly": "Испытание", "quests": "KPI", "settings": "Настройки",
	"contracts": "Контракты", "world": "Карта", "town": "Город", "talents": "Таланты", "bivouac": "Привал",
}

var screen = "title"
var has_save = false
var char_id = null
var payroll_notice = null
var resignation_notice = null
var employee_notice = null
var active_event = null
var _pending_event_options = null
var _post_event_screen = "home"

var stats_room_wins = 0
var stats_boss_wins = 0
var stats_wipes = 0
var history: Array = []
var camp_returns = 0
var departed_log: Array = []

## The guild's heroes: dictionaries of the hero's def plus level, xp, equipment, talents…
var pool: Array = []
var selected = {}
var inventory: Dictionary = {}
var reagent_counts = {}
var gold = STARTING_GOLD
var dungeon_id = "wastes"
var defeated = {}
var enc_idx = 0

var ever_cleared_room = false
var ever_interrupted = false
var ever_used_ability = false
var ever_used_valor = false
var ever_assigned_loot = false
var ever_crafted = false
var claimed_quests = {}
var curios_owned = {}
var claimed_achievements = {}

var contract_offers: Array = []
var active_contract = null
var contracts_done = 0
## The open map (World) and whether the dungeon under way was entered from it.
var w
var from_world = false
var contract_outcome = null
var trip = {"maxRound": 0, "lost": false, "valorSpent": 0}

var daily_date = ""
var daily_progress = {}
var daily_claimed = {}

var arena_rating = 1000
var arena_wins = 0
var arena_losses = 0
var in_arena = false
var arena_opponent = null

var weekly_week = ""
var weekly_claimed = false
var in_weekly = false
var weekly_dmg_mult = 1.0

var seen_unlocks = {}
var seen_tips = {}
var raises = {}
var feud = null
var strike_trips = 0
var settings = {"haptics": true, "speed": 1, "auto": false, "quality": "low", "qualityPicked": false, "sound": true, "music": true}

var b: Battle
var _trail: Array = []
var _save_pending = false
var loaded = false


func _ready() -> void:
	b = Battle.new(self)
	w = World.new(self)
	inventory = DB.gear.STARTING_INVENTORY.duplicate()
	load_game()


# ── change, save, load ──────────────────────────────────────────────────────
func notify() -> void:
	changed.emit()
	if not (b.sim and not b.sim.over): _schedule_save()


func _schedule_save() -> void:
	if not loaded or _save_pending: return
	_save_pending = true
	get_tree().create_timer(0.5).timeout.connect(func():
		_save_pending = false
		var f = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
		if f: f.store_string(JSON.stringify(_serialize())))


func _serialize() -> Dictionary:
	var p = []
	for c in pool:
		p.append({"id": c.id, "level": c.level, "xp": c.xp, "equipment": c.equipment, "spec": c.spec, "talentPoints": c.talentPoints,
			"professionId": c.professionId, "professionLevel": c.professionLevel, "professionXp": c.professionXp, "morale": c.morale})
	return {
		"pool": p, "selected": selected.keys(), "inventoryCounts": inventory, "reagentCounts": reagent_counts, "gold": gold,
		"dungeonId": dungeon_id, "defeatedDungeons": defeated.keys(), "claimedQuestIds": claimed_quests.keys(),
		"curiosOwned": curios_owned.keys(), "claimedAchievementIds": claimed_achievements.keys(), "everCrafted": ever_crafted,
		"settings": settings, "statsRoomWins": stats_room_wins, "statsBossWins": stats_boss_wins, "statsWipes": stats_wipes,
		"history": history, "campReturns": camp_returns, "departedLog": departed_log, "dailyDate": daily_date,
		"dailyProgress": daily_progress, "dailyClaimedIds": daily_claimed.keys(), "arenaRating": arena_rating,
		"arenaWins": arena_wins, "arenaLosses": arena_losses, "weeklyChallengeWeek": weekly_week, "weeklyClaimed": weekly_claimed,
		"seenUnlocks": seen_unlocks.keys(), "seenTips": seen_tips.keys(), "raises": raises, "feud": feud, "strikeTrips": strike_trips,
		"contractOffers": contract_offers, "activeContract": active_contract, "contractsDone": contracts_done, "outfitted": true,
		"world": w.to_dict(),
	}


func _set_of(a) -> Dictionary:
	var d = {}
	if a is Array:
		for x in a: d[x] = true
	return d


func _apply_save(data: Dictionary) -> void:
	data = DB._ints(data)
	if data.get("pool") is Array:
		pool = []
		for saved in data.pool:
			if not DB.candidates.has(saved.id): continue
			var c: Dictionary = DB.candidates[saved.id].duplicate(true)
			c.level = saved.level; c.xp = saved.xp; c.equipment = DB.migrate_equipment(saved.equipment)
			# Saves from before the talent trees keep their spec default and no points spent.
			c.spec = saved.get("spec", DB.default_spec(c))
			if DB.spec_def(c.heroClass, c.spec).is_empty(): c.spec = DB.default_spec(c)
			c.talentPoints = saved.talentPoints if saved.get("talentPoints") is Dictionary else {}
			apply_spec(c)
			c.professionId = saved.get("professionId")
			c.professionLevel = saved.get("professionLevel", 1); c.professionXp = saved.get("professionXp", 0); c.morale = saved.morale
			pool.append(c)
	selected = {}
	for id in data.get("selected", []): selected[int(id)] = true
	if data.get("inventoryCounts") is Dictionary: inventory = data.inventoryCounts
	for id in DB.armour.ARMOUR_IDS:
		if not inventory.has(id): inventory[id] = 1
	for id in DB.armour.RETIRED_ARMOUR_IDS: inventory.erase(id)
	if data.get("reagentCounts") is Dictionary: reagent_counts = data.reagentCounts
	gold = data.get("gold", gold)
	dungeon_id = data.get("dungeonId", dungeon_id)
	defeated = _set_of(data.get("defeatedDungeons"))
	claimed_quests = _set_of(data.get("claimedQuestIds"))
	curios_owned = _set_of(data.get("curiosOwned"))
	claimed_achievements = _set_of(data.get("claimedAchievementIds"))
	ever_crafted = data.get("everCrafted", false)
	if data.get("settings") is Dictionary: settings.merge(data.settings, true)
	stats_room_wins = data.get("statsRoomWins", 0)
	stats_boss_wins = data.get("statsBossWins", 0)
	stats_wipes = data.get("statsWipes", 0)
	history = data.get("history", [])
	camp_returns = data.get("campReturns", 0)
	departed_log = data.get("departedLog", [])
	daily_date = data.get("dailyDate", "")
	daily_progress = data.get("dailyProgress", {})
	daily_claimed = _set_of(data.get("dailyClaimedIds"))
	arena_rating = data.get("arenaRating", 1000)
	arena_wins = data.get("arenaWins", 0)
	arena_losses = data.get("arenaLosses", 0)
	weekly_week = data.get("weeklyChallengeWeek", "")
	weekly_claimed = data.get("weeklyClaimed", false)
	if data.get("seenUnlocks") is Array: seen_unlocks = _set_of(data.seenUnlocks)
	else:
		for f in DB.features.FEATURE_ORDER:
			if is_unlocked(f): seen_unlocks[f] = true
	seen_tips = _set_of(data.get("seenTips"))
	raises = {}
	for k in data.get("raises", {}): raises[int(k)] = data.raises[k]
	feud = data.get("feud")
	strike_trips = data.get("strikeTrips", 0)
	contract_offers = []
	for c in data.get("contractOffers", []):
		if _known_contract(c): contract_offers.append(c)
	var ac = data.get("activeContract")
	if ac is Dictionary and _known_contract(ac): active_contract = ac
	contracts_done = data.get("contractsDone", 0)
	if data.has("world"): w.from_dict(data.world)
	else: w.reset()


func _known_contract(c) -> bool:
	return c is Dictionary and DB.dungeon_index(c.get("dungeonId", "")) >= 0 and DB.contracts.CONTRACT_TERMS.has(c.get("term", ""))


func load_game() -> void:
	if FileAccess.file_exists(SAVE_PATH):
		var data = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
		if data is Dictionary:
			_apply_save(data)
			has_save = true
	loaded = true
	notify()


func reset_progress() -> void:
	pool = []; selected = {}; inventory = DB.gear.STARTING_INVENTORY.duplicate(); reagent_counts = {}
	gold = STARTING_GOLD; dungeon_id = "wastes"; defeated = {}; enc_idx = 0; b.sim = null; b.result = null
	ever_cleared_room = false; ever_interrupted = false; ever_used_ability = false; ever_used_valor = false
	ever_assigned_loot = false; ever_crafted = false
	claimed_quests = {}; curios_owned = {}; claimed_achievements = {}
	stats_room_wins = 0; stats_boss_wins = 0; stats_wipes = 0
	history = []; camp_returns = 0; departed_log = []
	daily_date = ""; daily_progress = {}; daily_claimed = {}
	arena_rating = 1000; arena_wins = 0; arena_losses = 0; in_arena = false; arena_opponent = null
	weekly_week = ""; weekly_claimed = false; in_weekly = false; weekly_dmg_mult = 1.0
	seen_unlocks = {}; seen_tips = {}; raises = {}; feud = null; strike_trips = 0
	contract_offers = []; active_contract = null; contracts_done = 0; contract_outcome = null
	w.reset(); from_world = false
	payroll_notice = null; resignation_notice = null; active_event = null; employee_notice = null
	DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE_PATH))
	has_save = false
	screen = "title"
	notify()


# ── settings ────────────────────────────────────────────────────────────────
func haptic(ms := 20) -> void:
	if settings.haptics: Input.vibrate_handheld(ms)


func toggle_speed() -> void:
	settings.speed = 1 if settings.speed >= 2 else 2
	notify()


func toggle_auto() -> void:
	settings.auto = not settings.auto
	var s = b.sim
	if settings.auto and s and not s.over and s.awaitingPlayer and b.boss_intro == null: b.schedule_auto()
	notify()


func set_quality(q: String) -> void:
	settings.quality = q
	settings.qualityPicked = true
	notify()


## The size of the interface on a computer screen (1.0 = as designed).
func set_ui_scale(v: float) -> void:
	settings.uiScale = v
	notify()


func toggle_setting(key: String) -> void:
	settings[key] = not settings[key]
	if key == "haptics" and settings.haptics: haptic(15)
	notify()


func pace(sec: float) -> float:
	return sec / maxf(1.0, settings.speed)


# ── unlocks and tips ────────────────────────────────────────────────────────
func is_unlocked(f: String) -> bool:
	var d: Dictionary = DB.features.FEATURES[f]
	var rooms = d.get("rooms"); var bosses = d.get("bosses")
	return stats_room_wins >= (rooms if rooms != null else 0) and defeated.size() >= (bosses if bosses != null else 0)


func new_unlocks() -> Array:
	return DB.features.FEATURE_ORDER.filter(func(f): return is_unlocked(f) and not seen_unlocks.has(f))


func mark_unlock_seen(f: String) -> void:
	seen_unlocks[f] = true
	notify()


func tip_pending(t: String) -> bool:
	return not seen_tips.has(t)


func dismiss_tip(t: String) -> void:
	seen_tips[t] = true
	notify()


func reset_tips() -> void:
	seen_tips = {}
	notify()


# ── navigation ──────────────────────────────────────────────────────────────
func go(s: String) -> void:
	_track(s)
	_show(s)


func go_tab(s: String) -> void:
	_trail = [] if s == "home" else ["home"]
	_show(s)


func back() -> void:
	_show(_trail.pop_back() if not _trail.is_empty() else "home")


func back_label() -> String:
	var prev: String = _trail.back() if not _trail.is_empty() else "home"
	if prev == "char":
		var c = find_hero(char_id)
		return c.name if c else "Герой"
	return SCREEN_TITLE.get(prev, "Лагерь")


## The phone's back button; false lets the system close the app.
func hardware_back() -> bool:
	match screen:
		"home", "title": return false
		"combat", "results", "event", "draft": return true
		"dungeon":
			if enc_idx == 0: back()
			return true
	back()
	return true


func quick_raid() -> void:
	if is_unlocked_world():
		go_world()
		return
	var open = []
	for l in DB.locations:
		for d in DB.main_dungeons():
			if d.locationId == l.id and is_dungeon_unlocked(d.id): open.append(d)
	var target = null
	if active_contract:
		for d in open:
			if d.id == active_contract.dungeonId: target = d
	if target == null and not open.is_empty(): target = open.back()
	if target == null:
		go_tab("levelmap")
		return
	select_dungeon(target.id)
	if squad_ready():
		_trail = ["home"]
		go_dungeon()
	else:
		go_tab("roster")


## Out onto the map, where the squad last stood.
func go_world() -> void:
	if not squad_ready():
		go_tab("roster")
		return
	if not w.region_open(w.region):
		w.region = "outskirts"
		w.pos = w.layout().start
	w.arrive()
	go_tab("world")


## To a dungeon: once the map is open the squad walks there over it (after the
## road to its land); before that, straight in as before.
func head_for(id: String) -> void:
	if not is_dungeon_unlocked(id): return
	if not is_unlocked_world():
		select_dungeon(id)
		if squad_ready(): go_dungeon()
		else: go("roster")
		return
	if not squad_ready():
		go_tab("roster")
		return
	var loc: String = DB.dungeon(id).locationId
	if w.region != loc: w.travel_far(loc)
	var p = w.place("d:" + id)
	if p: w.walk_to(p.pos + (w.pos - p.pos).normalized() * World.REACH * 0.7, p.id)
	w.arrive()
	go_tab("world")


## A dungeon entered from the map hands the squad back to the map after.
func enter_dungeon(id: String) -> void:
	if not is_dungeon_unlocked(id) or not squad_ready(): return
	select_dungeon(id)
	from_world = true
	go_dungeon()


## A band caught the squad (or the squad caught it): a fight in the open.
func start_skirmish(band: Dictionary) -> void:
	var ds = w.region_dungeons()
	var hardest = ds[0]
	for d in ds:
		if is_dungeon_unlocked(d.id) and not d.get("side", false): hardest = d
	select_dungeon(hardest.id)
	b.start_skirmish(band)


func _track(next: String) -> void:
	var cur = screen
	if next == cur: return
	if next == "home" or next == "title":
		_trail = []
		return
	var at = _trail.rfind(next)
	if at >= 0:
		_trail.resize(at)
		return
	if not (cur in TRANSIENT_SCREENS): _trail.append(cur)


func _show(s: String) -> void:
	if s != "combat":
		b.clear_timer()
		b.boss_intro = null
	screen = s
	notify()


func open_char(id: int) -> void:
	char_id = id
	go("char")


# ── roster ──────────────────────────────────────────────────────────────────
func find_hero(id):
	if id == null: return null
	for c in pool:
		if c.id == id: return c
	return null


func squad() -> Array:
	return pool.filter(func(c): return selected.has(c.id))


func toggle_select(id: int) -> void:
	if selected.has(id): selected.erase(id)
	elif selected.size() < 5: selected[id] = true
	notify()


func squad_ready() -> bool:
	return selected.size() == 5


## The map opens once the squad has seen its first fight through.
func is_unlocked_world() -> bool:
	return stats_room_wins > 0 or not defeated.is_empty()


func current_dungeon() -> Dictionary:
	return DB.dungeon(dungeon_id)


## The road opens one dungeon after another; a side dungeon opens after the
## one it names.
func is_dungeon_unlocked(id: String) -> bool:
	var idx = DB.dungeon_index(id)
	if idx < 0: return false
	var d: Dictionary = DB.dungeon_list[idx]
	if d.has("after"): return defeated.has(d.after)
	var main: Array = DB.main_dungeons()
	var at = main.find(d)
	return at == 0 or defeated.has(main[at - 1].id)


func select_dungeon(id: String) -> void:
	dungeon_id = id
	notify()


func go_dungeon() -> void:
	enc_idx = 0
	b.sim = null
	go("dungeon")


func name_of(cid: int) -> String:
	var c = find_hero(cid)
	if c: return c.name
	return DB.candidates[cid].name if DB.candidates.has(cid) else "—"


# ── combat power from gear, talents, specialization, profession, sets ──────
func _mults() -> Dictionary:
	return {"outputMult": 1.0, "hpMult": 1.0, "wardMult": 1.0, "cdMult": 1.0}


func _num(v) -> float:
	return 1.0 if v == null else float(v)


func gear_mults(c: Dictionary) -> Dictionary:
	var m = _mults()
	for slot in DB.SLOT_ORDER:
		var o: Dictionary = DB.gear_in(DB.slot_kind(slot), c.equipment.get(slot, "none"))
		if o.is_empty(): continue
		m.outputMult *= _num(o.get("mult")); m.hpMult *= _num(o.get("hpMult"))
		m.wardMult *= _num(o.get("wardMult")); m.cdMult *= _num(o.get("cdMult"))
	return m


func talent_mults(c: Dictionary) -> Dictionary:
	var b = talent_bonus(c)
	var m = _mults()
	m.outputMult = 1.0 + b.dmg; m.hpMult = 1.0 + b.hp; m.wardMult = maxf(0.3, 1.0 - b.taken)
	return m


## The spec's role is gone into the old one-off specialization: nothing extra.
func class_mults(_c: Dictionary) -> Dictionary:
	return _mults()


# ── specs and talent trees (classic WoW: three trees, a point a level) ──────
## Sets the hero's role, range and numbers from their spec.
func apply_spec(c: Dictionary) -> void:
	var st = DB.stats_for(DB.candidates[c.id], c.spec)
	c.role = st.role; c.attackRange = st.attackRange
	c.hp = st.hp; c.dps = st.dps; c.healPower = st.healPower; c.power = st.power


func set_spec(cid: int, spec_id: String) -> void:
	var c = find_hero(cid)
	if c == null or c.spec == spec_id or DB.spec_def(c.heroClass, spec_id).is_empty(): return
	c.spec = spec_id
	apply_spec(c)
	notify()


func talent_points_total(c: Dictionary) -> int:
	return maxi(0, c.level - 1)


func talent_points_spent(c: Dictionary) -> int:
	var n = 0
	for id in c.talentPoints: n += int(c.talentPoints[id])
	return n


func tree_points(c: Dictionary, spec_id: String) -> int:
	var n = 0
	for t in DB.talent_tree(c.heroClass, spec_id):
		n += int(c.talentPoints.get(t.id, 0))
	return n


func talent_rank(c: Dictionary, tid: String) -> int:
	return int(c.talentPoints.get(tid, 0))


## Why a talent can't take a point now, or "" if it can.
func talent_block(c: Dictionary, spec_id: String, t: Dictionary) -> String:
	if talent_rank(c, t.id) >= t.max: return "Изучен полностью"
	var need: int = DB.specs.TALENT_TIERS[t.tier]
	if tree_points(c, spec_id) < need: return "Нужно %d очк. в этой ветке" % need
	if talent_points_spent(c) >= talent_points_total(c): return "Нет свободных очков"
	return ""


func learn_talent(cid: int, spec_id: String, tid: String) -> void:
	var c = find_hero(cid)
	if c == null: return
	var t = DB.talent(tid)
	if t.is_empty() or talent_block(c, spec_id, t) != "": return
	c.talentPoints[tid] = talent_rank(c, tid) + 1
	notify()


func respec_cost(c: Dictionary) -> int:
	return 0 if talent_points_spent(c) == 0 else int(DB.specs.RESPEC_COST_PER_LEVEL) * c.level


func reset_talents(cid: int) -> void:
	var c = find_hero(cid)
	if c == null or talent_points_spent(c) == 0 or gold < respec_cost(c): return
	gold -= respec_cost(c)
	c.talentPoints = {}
	notify()


## Every talent's effect on a hero, summed over ranks.
func talent_bonus(c: Dictionary) -> Dictionary:
	var b = {"dmg": 0.0, "heal": 0.0, "hp": 0.0, "taken": 0.0, "crit": 0.0, "regen": 0, "cost": 0.0, "spell": {}, "cdr": {}, "grants": []}
	for tid in c.talentPoints:
		var r: int = int(c.talentPoints[tid])
		var t = DB.talent(tid)
		if t.is_empty() or r <= 0: continue
		var e: Dictionary = t.eff
		for k in ["dmg", "heal", "hp", "taken", "crit", "cost"]:
			if e.has(k): b[k] += float(e[k]) * r
		if e.has("regen"): b.regen += int(e.regen) * r
		if e.has("spell"):
			for id in e.spell: b.spell[id] = b.spell.get(id, 0.0) + float(e.spell[id]) * r
		if e.has("cdr"):
			for id in e.cdr: b.cdr[id] = b.cdr.get(id, 0) + int(e.cdr[id]) * r
		if e.has("grants"): b.grants.append(e.grants)
	return b


## The spells a hero can cast: by level, spec, or a capstone talent.
func known_spells(c: Dictionary) -> Array:
	var grants: Array = talent_bonus(c).grants
	return DB.spells_of(c.heroClass).filter(func(s):
		if s.talent != null: return s.talent in grants
		return s.level <= c.level and (s.spec == null or s.spec == c.spec))


func set_bonuses_for(c: Dictionary) -> Array:
	var out = []
	for s in DB.gear_sets:
		var n = 0
		if c.equipment.weapon == s.weapon: n += 1
		if c.equipment.chest == s.armor: n += 1
		if c.equipment.necklace == s.trinket: n += 1
		if n > 0: out.append({"set": s, "count": n})
	return out


func set_bonus_mults(c: Dictionary) -> Dictionary:
	var m = _mults()
	for x in set_bonuses_for(c):
		if x.count < 2: continue
		var bonuses = [x.set.bonus2]
		if x.count >= 3: bonuses.append(x.set.bonus3)
		for bn in bonuses:
			m.outputMult *= _num(bn.get("outputMult")); m.hpMult *= _num(bn.get("hpMult"))
			m.wardMult *= _num(bn.get("wardMult")); m.cdMult *= _num(bn.get("cdMult"))
	return m


func profession_mults(c: Dictionary) -> Dictionary:
	var opt = DB.profession(c.professionId)
	if opt.is_empty(): return _mults()
	return {
		"outputMult": DB.scaled_mult(opt.get("outputMult"), c.professionLevel), "hpMult": DB.scaled_mult(opt.get("hpMult"), c.professionLevel),
		"wardMult": DB.scaled_mult(opt.get("wardMult"), c.professionLevel), "cdMult": DB.scaled_mult(opt.get("cdMult"), c.professionLevel),
	}


func morale_mult(c: Dictionary) -> float:
	return 1.05 if c.morale >= 80 else (0.9 if c.morale < 30 else 1.0)


func attributes_for(c: Dictionary) -> Dictionary:
	var gm = gear_mults(c); var tm = talent_mults(c); var cm = class_mults(c); var pm = profession_mults(c); var sm = set_bonus_mults(c)
	var lvl = 1.0 + (c.level - 1) * 0.02
	var out_m: float = gm.outputMult * tm.outputMult * cm.outputMult * pm.outputMult * sm.outputMult * morale_mult(c)
	var hp_m: float = gm.hpMult * tm.hpMult * cm.hpMult * pm.hpMult * sm.hpMult
	var eff_dps: float = c.dps * out_m * lvl
	var eff_heal: float = _num(c.get("healPower")) * out_m * lvl if c.get("healPower") != null else 0.0
	var eff_hp: float = c.hp * hp_m * lvl
	var speed: float = {"dps": 12, "heal": 9, "tank": 6}[c.role] + (c.id % 5) * 0.1
	var melee: bool = c.attackRange == "melee"
	return {
		"strength": int(round(eff_dps * (2.5 if melee else 0.8) + (20 if c.role == "tank" else 0))),
		"agility": int(round(eff_dps * (0.8 if melee else 2.5) + (0 if melee else 5))),
		"intellect": int(round(eff_heal * 10 + lvl * 6)),
		"stamina": int(round(eff_hp / 8)),
		"initiative": int(round(speed * 10)),
	}


# ── inventory and the trader ────────────────────────────────────────────────
func item_owned(id: String) -> int:
	return int(inventory.get(id, 0))


func item_in_use(slot: String, id: String, except_cid = null, except_slot = null) -> int:
	var n = 0
	for c in pool:
		for s in DB.slots_for_kind(DB.slot_kind(slot)):
			if c.id == except_cid and (except_slot == null or s == except_slot): continue
			if c.equipment.get(s) == id: n += 1
	return n


func worn_count(id: String) -> int:
	var n = 0
	for c in pool:
		for s in DB.SLOT_ORDER:
			if c.equipment.get(s) == id: n += 1
	return n


func item_available(c: Dictionary, slot: String, id: String) -> bool:
	if id == "none" or c.equipment.get(slot) == id: return true
	return item_owned(id) - item_in_use(slot, id, c.id, slot) > 0


func equip(c: Dictionary, slot: String, id: String) -> void:
	if not item_available(c, slot, id): return
	if c.equipment[slot] != id: bump_daily("gearChange")
	c.equipment[slot] = id
	notify()


func inventory_rows() -> Array:
	var rows = []
	for kind in DB.GEAR_KINDS:
		var slot: String = DB.slots_for_kind(kind)[0]
		for o in DB.gear.GEAR[kind]:
			if o.id == "none": continue
			var owned = item_owned(o.id)
			if owned <= 0: continue
			var worn_by = []
			for c in pool:
				for s in DB.SLOT_ORDER:
					if c.equipment.get(s) == o.id:
						worn_by.append(c.name)
						break
			rows.append({"slot": slot, "item": o, "owned": owned, "free": owned - worn_by.size(), "wornBy": worn_by})
	return rows


func buy_item(slot: String, id: String) -> void:
	var o: Dictionary = DB.gear_in(DB.slot_kind(slot), id)
	if o.is_empty() or o.get("price") == null or gold < o.price: return
	gold -= o.price
	inventory[id] = item_owned(id) + 1
	bump_daily("gearChange")
	notify()


func sell_price(o: Dictionary) -> int:
	return int(round(o.price * DB.gear.SELL_RATIO))


func sell_item(slot: String, id: String) -> void:
	var o: Dictionary = DB.gear_in(DB.slot_kind(slot), id)
	if o.is_empty() or o.get("price") == null: return
	if item_owned(id) - worn_count(id) <= 0: return
	inventory[id] = item_owned(id) - 1
	gold += sell_price(o)
	notify()


func shop_rows(selling: bool) -> Array:
	var rows = []
	for kind in DB.GEAR_KINDS:
		var slot: String = DB.slots_for_kind(kind)[0]
		for o in DB.gear.GEAR[kind]:
			if o.get("price") == null or o.price == 0: continue
			if selling:
				var free = item_owned(o.id) - worn_count(o.id)
				if free > 0: rows.append({"slot": slot, "item": o, "free": free, "price": sell_price(o)})
			else:
				rows.append({"slot": slot, "item": o, "price": o.price, "affordable": gold >= o.price})
	return rows


func roll_curio(chance: float):
	if randf() >= chance: return null
	var left: Array = DB.curios.filter(func(x): return not curios_owned.has(x.id))
	if left.is_empty(): return null
	var p: Dictionary = left.pick_random()
	curios_owned[p.id] = true
	return p.name


## The paperdoll: each slot's worn piece and the stash that fits it.
func equipment_vm(c: Dictionary) -> Dictionary:
	var slots = []
	for slot in DB.SLOT_ORDER:
		var list: Array = DB.slot_gear(slot)
		var worn: Dictionary = DB.gear_in(DB.slot_kind(slot), c.equipment.get(slot, "none"))
		if worn.is_empty(): worn = list[0]
		var item = func(o: Dictionary) -> Dictionary:
			var is_worn: bool = o.id == worn.id
			var worn_by = []
			for p in pool:
				for s2 in DB.SLOT_ORDER:
					if (p.id != c.id or s2 != slot) and p.equipment.get(s2) == o.id:
						worn_by.append(p.name)
						break
			return {"item": o, "rarity": DB.rarity_of(o), "stats": DB.stat_lines(o), "compare": [] if is_worn else DB.compare_lines(o, worn),
				"setName": DB.set_name_of(o.id), "free": maxi(0, item_owned(o.id) - worn_by.size() - (1 if is_worn else 0)),
				"worn": is_worn, "available": item_available(c, slot, o.id), "wornBy": worn_by}
		var stash = []
		for o in list:
			if o.id != "none" and item_owned(o.id) > 0: stash.append(item.call(o))
		slots.append({"slot": slot, "label": DB.slot_label(slot), "equipped": null if worn.id == "none" else item.call(worn), "stash": stash})
	var g = gear_mults(c); var sb = set_bonus_mults(c)
	var totals = DB.stat_lines({"mult": g.outputMult * sb.outputMult, "hpMult": g.hpMult * sb.hpMult, "wardMult": g.wardMult * sb.wardMult, "cdMult": g.cdMult * sb.cdMult})
	return {"slots": slots, "totals": totals}


# ── profession and crafting ─────────────────────────────────────────────────
func choose_profession(cid: int, pid: String) -> void:
	var c = find_hero(cid)
	if c == null or c.professionId != null or DB.profession(pid).is_empty(): return
	c.professionId = pid; c.professionLevel = 1; c.professionXp = 0
	notify()


func profession_bonus_lines(opt: Dictionary, level: int) -> Array:
	var lines = []
	var pct = func(v: float) -> int: return int(round(absf(v - 1.0) * 100))
	if opt.get("hpMult") != null: lines.append("%s%d%% к максимальному HP" % ["+" if opt.hpMult >= 1 else "-", pct.call(DB.scaled_mult(opt.hpMult, level))])
	if opt.get("outputMult") != null: lines.append("%s%d%% к урону/лечению" % ["+" if opt.outputMult >= 1 else "-", pct.call(DB.scaled_mult(opt.outputMult, level))])
	if opt.get("wardMult") != null: lines.append("%s%d%% к получаемому урону" % ["-" if opt.wardMult <= 1 else "+", pct.call(DB.scaled_mult(opt.wardMult, level))])
	if opt.get("cdMult") != null: lines.append("%s%d%% к перезарядке способности" % ["-" if opt.cdMult <= 1 else "+", pct.call(DB.scaled_mult(opt.cdMult, level))])
	return lines


func train_profession(cid: int) -> void:
	var c = find_hero(cid)
	var maxl: int = DB.professions.PROFESSION_MAX_LEVEL
	var per: int = DB.professions.PROFESSION_XP_PER_LEVEL
	if c == null or c.professionId == null or c.professionLevel >= maxl: return
	var cost = DB.profession_train_cost(c.professionLevel)
	if gold < cost: return
	gold -= cost
	c.professionXp += 15 + randi() % 11
	while c.professionXp >= per and c.professionLevel < maxl:
		c.professionXp -= per
		c.professionLevel += 1
	if c.professionLevel >= maxl: c.professionXp = 0
	notify()


func reagent_owned(id: String) -> int:
	return int(reagent_counts.get(id, 0))


func recipes_for(c: Dictionary) -> Array:
	if c.professionId == null: return []
	var out = []
	for r in DB.recipes:
		if r.professionId != c.professionId: continue
		var unlocked: bool = c.professionLevel >= r.unlockLevel
		out.append({"recipe": r, "reagent": DB.reagent(r.reagentId), "result": DB.gear_in(r.slot, r.gearId), "unlocked": unlocked,
			"owned": reagent_owned(r.reagentId), "craftable": unlocked and reagent_owned(r.reagentId) >= r.reagentQty and gold >= r.goldCost})
	return out


func craft(cid: int, recipe_id: String) -> void:
	var c = find_hero(cid)
	var r = null
	for x in DB.recipes:
		if x.id == recipe_id: r = x
	if c == null or r == null or c.professionId != r.professionId or c.professionLevel < r.unlockLevel: return
	if reagent_owned(r.reagentId) < r.reagentQty or gold < r.goldCost: return
	reagent_counts[r.reagentId] = reagent_owned(r.reagentId) - r.reagentQty
	gold -= r.goldCost
	inventory[r.gearId] = item_owned(r.gearId) + 1
	ever_crafted = true
	notify()


# ── quests, achievements, dailies ───────────────────────────────────────────
func quest_rows() -> Array:
	var out = []
	for q in DB.quests:
		out.append({"q": q, "achieved": Checks.quest(self, q.id), "claimed": claimed_quests.has(q.id)})
	return out


func claim_quest(id: String) -> void:
	if claimed_quests.has(id) or not Checks.quest(self, id): return
	for q in DB.quests:
		if q.id == id:
			claimed_quests[id] = true
			for c in pool: adjust_morale(c.id, q.rewardMorale)
	notify()


func achievement_rows() -> Array:
	var out = []
	for a in DB.achievements:
		out.append({"a": a, "achieved": Checks.achievement(self, a.id), "claimed": claimed_achievements.has(a.id)})
	return out


func claim_achievement(id: String) -> void:
	if claimed_achievements.has(id) or not Checks.achievement(self, id): return
	for a in DB.achievements:
		if a.id == id:
			claimed_achievements[id] = true
			gold += a.rewardGold
	notify()


func _today() -> String:
	return Time.get_date_string_from_system(true)


func _ensure_daily() -> void:
	var t = _today()
	if daily_date != t:
		daily_date = t; daily_progress = {}; daily_claimed = {}


func bump_daily(metric: String, amount := 1) -> void:
	_ensure_daily()
	daily_progress[metric] = int(daily_progress.get(metric, 0)) + amount


func daily_rows() -> Array:
	_ensure_daily()
	var out = []
	for t in DB.pick_daily_templates(daily_date):
		var p = mini(t.target, int(daily_progress.get(t.metric, 0)))
		out.append({"t": t, "progress": p, "achieved": p >= t.target, "claimed": daily_claimed.has(t.id)})
	return out


func claim_daily(id: String) -> void:
	_ensure_daily()
	if daily_claimed.has(id): return
	for t in DB.pick_daily_templates(daily_date):
		if t.id == id and int(daily_progress.get(t.metric, 0)) >= t.target:
			daily_claimed[id] = true
			gold += t.rewardGold
	notify()


func gain_xp(cid: int, amount: int) -> void:
	var c = find_hero(cid)
	var maxl: int = DB.characters.MAX_LEVEL
	var per: int = DB.characters.XP_PER_LEVEL
	if c == null or c.level >= maxl: return
	c.xp += amount
	while c.xp >= per and c.level < maxl:
		c.xp -= per
		c.level += 1
		bump_daily("levelUp")
	if c.level >= maxl: c.xp = per


func adjust_morale(cid: int, d: int) -> void:
	var c = find_hero(cid)
	if c: c.morale = clampi(c.morale + d, 0, 100)


func analytics() -> Dictionary:
	var decisive = stats_boss_wins + stats_wipes
	return {
		"winRatePct": int(round(100.0 * stats_boss_wins / decisive)) if decisive > 0 else null,
		"totalFights": stats_room_wins + stats_boss_wins + stats_wipes, "roomWins": stats_room_wins, "bossWins": stats_boss_wins,
		"wipes": stats_wipes, "kpiDone": claimed_quests.size(), "kpiTotal": DB.quests.size(), "avgMorale": avg_morale(), "gold": gold, "history": history,
	}


func avg_morale() -> int:
	if pool.is_empty(): return 0
	var sum = 0
	for c in pool: sum += c.morale
	return int(round(float(sum) / pool.size()))


# ── contracts ───────────────────────────────────────────────────────────────
func contract_board() -> Array:
	_fill_contract_board()
	return contract_offers.map(func(c): return contract_vm(c))


func active_contract_vm():
	return contract_vm(active_contract) if active_contract else null


func contract_here():
	return contract_vm(active_contract) if active_contract and active_contract.dungeonId == dungeon_id else null


func accept_contract(id: String) -> void:
	if active_contract: return
	for c in contract_offers:
		if c.id == id:
			active_contract = c
			contract_offers.erase(c)
			break
	_fill_contract_board()
	notify()


func abandon_contract() -> void:
	if not active_contract: return
	active_contract = null
	_fill_contract_board()
	notify()


func go_contract() -> void:
	var c = active_contract
	if not c or not is_dungeon_unlocked(c.dungeonId): return
	head_for(c.dungeonId)


func contract_vm(c: Dictionary) -> Dictionary:
	var d = DB.dungeon(c.dungeonId)
	var term: Dictionary = DB.contracts.CONTRACT_TERMS[c.term]
	var clients: Array = DB.contracts.CLIENTS
	var client: Dictionary = clients[c.client % clients.size()]
	return {"id": c.id, "dungeonId": c.dungeonId, "dungeonName": d.name, "locationName": DB.location(d.locationId).get("name", ""),
		"term": c.term, "termTitle": term.title, "termDesc": term.desc, "icon": term.icon, "pay": c.pay,
		"clientName": client.name, "clientLine": client.line, "progress": _contract_progress(c)}


func _contract_progress(c: Dictionary):
	if c.dungeonId != dungeon_id or (enc_idx == 0 and b.sim == null): return null
	var s = b.sim
	match c.term:
		"noLoss":
			var dead = false
			if s:
				for r in s.raiders:
					if not r.alive: dead = true
			return "Условие нарушено: есть павшие" if trip.lost or dead else "Пока без потерь"
		"swift": return "Самый долгий бой: %d из %d раундов" % [maxi(trip.maxRound, s.round if s else 0), DB.contracts.SWIFT_ROUNDS]
		"valor": return "Доблести потрачено: %d из %d" % [trip.valorSpent, DB.contracts.VALOR_NEEDED]
	return null


func _fill_contract_board() -> void:
	var open: Array = DB.dungeon_list.filter(func(d): return is_dungeon_unlocked(d.id))
	if open.is_empty(): return
	var near = open.slice(maxi(0, open.size() - 4))
	var terms: Array = DB.contracts.CONTRACT_TERMS.keys()
	var guard = 0
	while contract_offers.size() < 3 and guard < 30:
		guard += 1
		var d: Dictionary = near.pick_random()
		var term: String = terms.pick_random()
		var taken = contract_offers.duplicate()
		if active_contract: taken.append(active_contract)
		var dup = false
		for x in taken:
			if x.dungeonId == d.id and x.term == term: dup = true
		if dup: continue
		var idx = DB.dungeon_tier(d.id)
		var pay = int(round((55 + idx * 14) * DB.contracts.CONTRACT_TERMS[term].payMult / 5.0)) * 5
		contract_offers.append({"id": "%x%04x" % [Time.get_ticks_msec(), randi() % 65536], "dungeonId": d.id, "term": term,
			"client": randi() % DB.contracts.CLIENTS.size(), "pay": pay})


func settle_contract(win: bool, is_boss: bool) -> void:
	contract_outcome = null
	var c = active_contract
	if not c or c.dungeonId != dungeon_id or (win and not is_boss): return
	var broken = null
	if not win: broken = "Отряд не дошёл до конца похода."
	elif c.term == "noLoss" and trip.lost: broken = "В походе погибли бойцы."
	elif c.term == "swift" and trip.maxRound > DB.contracts.SWIFT_ROUNDS: broken = "Один из боёв затянулся до %d раундов." % trip.maxRound
	elif c.term == "valor" and trip.valorSpent < DB.contracts.VALOR_NEEDED: broken = "Доблести потрачено %d из %d." % [trip.valorSpent, DB.contracts.VALOR_NEEDED]
	var vm = contract_vm(c)
	active_contract = null
	if broken:
		contract_outcome = {"contract": vm, "success": false, "note": broken}
	else:
		gold += c.pay
		bump_daily("goldEarned", c.pay)
		contracts_done += 1
		for m in squad(): adjust_morale(m.id, 5)
		contract_outcome = {"contract": vm, "success": true, "note": "%s платит %d золота. Мораль отряда +5." % [vm.clientName, c.pay]}
	_fill_contract_board()


# ── HR: payroll, trouble, hiring, departures ────────────────────────────────
func run_payroll() -> void:
	var active = squad()
	if active.is_empty(): return
	var due = 0
	for c in active: due += PAYROLL_BASE + c.level * PAYROLL_PER_LEVEL + int(raises.get(c.id, 0))
	if gold >= due:
		gold -= due
		payroll_notice = {"paid": due, "shortfall": false}
	else:
		var paid = gold
		gold = 0
		for c in pool: adjust_morale(c.id, -8)
		payroll_notice = {"paid": paid, "shortfall": true}


func hr_mult(cid: int, squad_ids: Array) -> float:
	var m = 1.0
	if feud and (cid == feud.a or cid == feud.b) and feud.a in squad_ids and feud.b in squad_ids: m *= FEUD_MULT
	if strike_trips > 0: m *= STRIKE_MULT
	return m


func hr_note():
	if in_arena: return null
	var ids = squad().map(func(c): return c.id)
	var notes = []
	if feud and feud.a in ids and feud.b in ids:
		notes.append("%s и %s в ссоре и не прикрывают друг друга (−%d%% урона)." % [name_of(feud.a), name_of(feud.b), int(round((1 - FEUD_MULT) * 100))])
	if strike_trips > 0:
		notes.append("Итальянская забастовка: отряд работает строго по инструкции (−%d%% урона)." % int(round((1 - STRIKE_MULT) * 100)))
	return " ".join(notes) if not notes.is_empty() else null


func _tick_hr() -> void:
	if feud:
		if find_hero(feud.a) == null or find_hero(feud.b) == null: feud = null
		else:
			feud.trips -= 1
			if feud.trips <= 0: feud = null
	if strike_trips > 0: strike_trips -= 1
	for id in raises.keys():
		if find_hero(id) == null: raises.erase(id)


func dismiss(notice: String) -> void:
	set(notice, null)
	notify()


func hire_options() -> Array:
	return DB.all_candidates.filter(func(r): return find_hero(r.id) == null)


func _new_hero(def: Dictionary) -> Dictionary:
	var c = def.duplicate(true)
	c.level = 1; c.xp = 0; c.equipment = DB.starting_equipment(def.id)
	c.spec = DB.default_spec(def); c.talentPoints = {}
	apply_spec(c)
	c.professionId = null; c.professionLevel = 1; c.professionXp = 0
	return c


func hire(id: int) -> void:
	if find_hero(id) != null or not DB.candidates.has(id): return
	var def: Dictionary = DB.candidates[id]
	var cost: int = def.get("hireCost", 0) if def.get("hireCost") != null else 0
	if gold < cost: return
	gold -= cost
	pool.append(_new_hero(def))
	_stock_worn_armour()
	notify()


func _stock_worn_armour() -> void:
	for c in pool:
		for id in c.equipment.values():
			if id == "none": continue
			var worn = 0
			for o in pool:
				if id in o.equipment.values(): worn += 1
			if item_owned(id) < worn: inventory[id] = worn


func needs_draft() -> bool:
	return pool.is_empty()


func start() -> void:
	go("draft" if needs_draft() else "home")


func draft_problem(ids: Array):
	var picks: Array = DB.characters.POOL.filter(func(c): return c.id in ids)
	var spent = 0
	for c in picks: spent += c.hireCost
	var size: int = DB.characters.DRAFT_SIZE
	if spent > DB.characters.DRAFT_BUDGET: return "Не хватает бюджета"
	if picks.size() < size: return "Выберите ещё %d" % (size - picks.size())
	if picks.size() > size: return "Нужно ровно %d" % size
	if not picks.any(func(c): return c.role == "tank"): return "Нужен танк"
	if not picks.any(func(c): return c.role == "heal"): return "Нужен хилер"
	return null


func finish_draft(ids: Array) -> void:
	if not needs_draft() or draft_problem(ids) != null: return
	var picks: Array = DB.characters.POOL.filter(func(c): return c.id in ids)
	var spent = 0
	pool = []
	for c in picks:
		pool.append(_new_hero(c))
		spent += c.hireCost
	_stock_worn_armour()
	selected = {}
	for c in picks: selected[c.id] = true
	gold = STARTING_GOLD + DB.characters.DRAFT_BUDGET - spent
	screen = "home"
	notify()


func can_fire() -> bool:
	return pool.size() > MIN_ROSTER


func fire(id: int, reason := "fired") -> void:
	if not can_fire(): return
	var c = find_hero(id)
	if c == null: return
	departed_log.push_front({"name": c.name, "epithet": c.epithet, "role": c.role, "story": c.story, "level": c.level, "reason": reason})
	if departed_log.size() > DEPARTED_LOG_LIMIT: departed_log.pop_back()
	pool.erase(c)
	selected.erase(id)
	for o in pool: adjust_morale(o.id, -5)
	if char_id == id: char_id = null
	notify()


func _check_resignations() -> void:
	if not can_fire(): return
	var at_risk: Array = pool.filter(func(c): return c.morale < RESIGNATION_MORALE_THRESHOLD)
	if at_risk.is_empty() or randf() >= RESIGNATION_CHANCE: return
	var leaver: Dictionary = at_risk.pick_random()
	var n: String = leaver.name
	fire(leaver.id, "resigned")
	resignation_notice = {"name": n}


func _check_employee_of_month() -> void:
	camp_returns += 1
	if camp_returns % EMPLOYEE_OF_MONTH_CYCLE != 0 or pool.is_empty(): return
	var best: Dictionary = pool[0]
	for c in pool:
		if c.level * 10 + c.morale > best.level * 10 + best.morale: best = c
	if gold >= 20: gold -= 20
	for c in pool: adjust_morale(c.id, 20 if c.id == best.id else 5)
	employee_notice = {"name": best.name}


func _record_history() -> void:
	history.append({"gold": gold, "avgMorale": avg_morale()})
	if history.size() > HISTORY_LIMIT: history.pop_front()


# ── office events ───────────────────────────────────────────────────────────
func _try_build_event():
	if is_unlocked("personnel") and randf() < 0.6:
		var order: Array = Events.STAFF.duplicate()
		order.shuffle()
		order.sort_custom(func(x, y): return x == "strike" and y != "strike")
		for id in order:
			var built = Events.build(self, id)
			if built: return built
	var office: Array = Events.OFFICE.duplicate()
	office.shuffle()
	for id in office:
		var built = Events.build(self, id)
		if built: return built
	return null


func maybe_trigger_event(return_to: String, force := false) -> bool:
	if not force and randf() >= 0.4: return false
	var built = _try_build_event()
	if built == null: return false
	_pending_event_options = built.options
	active_event = {"title": built.title, "desc": built.desc, "labelA": built.options[0].label, "labelB": built.options[1].label,
		"resultText": null, "faces": built.get("faces", []), "stakes": built.get("stakes")}
	_post_event_screen = return_to
	return true


func choose_event(which: String) -> void:
	if active_event == null or _pending_event_options == null: return
	var opt: Dictionary = _pending_event_options[0 if which == "a" else 1]
	active_event.resultText = opt.apply.call()
	_pending_event_options = null
	notify()


func dismiss_event() -> void:
	active_event = null
	go(_post_event_screen)


func return_to_camp(target: String) -> void:
	contract_outcome = null
	run_payroll()
	_check_resignations()
	_check_employee_of_month()
	_tick_hr()
	_record_history()
	if maybe_trigger_event(target):
		screen = "event"
		notify()
		return
	go(target)


# ── arena and the weekly challenge (the fights themselves are in Battle) ───
func arena_vm() -> Dictionary:
	if arena_opponent == null and squad_ready(): arena_opponent = b.generate_arena_opponent()
	return {"rating": arena_rating, "rank": DB.arena_rank_name(arena_rating), "wins": arena_wins, "losses": arena_losses,
		"opponent": arena_opponent, "ready": squad_ready()}


func reroll_arena() -> void:
	arena_opponent = b.generate_arena_opponent() if squad_ready() else null
	notify()


func _week_key() -> String:
	var days = int(Time.get_unix_time_from_system() / 86400.0)
	return "w%d" % int(days / 7)


func _ensure_weekly() -> void:
	var wk = _week_key()
	if weekly_week != wk:
		weekly_week = wk
		weekly_claimed = false


func current_weekly():
	_ensure_weekly()
	var cleared: Array = DB.dungeon_list.filter(func(d): return defeated.has(d.id)).map(func(d): return d.id)
	var did = DB.pick_weekly_dungeon_id(weekly_week, cleared)
	if did == null: return null
	var d = DB.dungeon(did)
	return {"dungeon": d, "encounter": d.encounters.back(), "modifier": DB.pick_weekly_modifier(weekly_week)}


func weekly_vm() -> Dictionary:
	var cur = current_weekly()
	if cur == null: return {"available": false, "claimed": weekly_claimed, "ready": squad_ready()}
	return {"available": true, "dungeonName": cur.dungeon.name, "locationName": DB.location(cur.dungeon.locationId).get("name", ""),
		"bossName": cur.encounter.enemyName, "modifierName": cur.modifier.name, "modifierDesc": cur.modifier.desc,
		"claimed": weekly_claimed, "ready": squad_ready()}
