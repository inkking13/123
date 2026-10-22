extends Node
## The game's static data, read once from data/*.json, plus the small helpers
## that go with it: item lookups, rarity, set pieces, seeded weekly and daily picks.

var characters: Dictionary
var gear: Dictionary
var armour: Dictionary
var dungeons: Dictionary
var abilities: Dictionary
var skill_art: Dictionary
var item_icons: Dictionary
var monster_art: Dictionary
var hero_classes: Dictionary
var professions: Dictionary
var reagents: Dictionary
var recipes: Array
var curios: Array
var quests: Array
var achievements: Array
var daily: Dictionary
var arena: Dictionary
var weekly: Dictionary
var barks: Dictionary
var features: Dictionary
var traits: Dictionary
var gear_sets: Array
var gear_info: Dictionary
var contracts: Dictionary
## The WoW-style class rework: specs and resources, the spellbook, the talent trees.
var specs: Dictionary
var spellbook: Dictionary
var talent_trees: Dictionary
var _talent_by_id := {}

## Every hero who can ever join, by id.
var candidates := {}
var all_candidates: Array = []
var dungeon_list: Array = []
var locations: Array = []
const SLOT_ORDER := ["weapon", "offhand", "helm", "necklace", "shoulders", "cloak", "chest", "belt", "gloves", "pants", "boots", "ring1", "ring2", "acc1", "acc2"]
const GEAR_KINDS := ["weapon", "offhand", "helm", "necklace", "shoulders", "cloak", "chest", "belt", "gloves", "pants", "boots", "ring", "accessory"]
const ROLE_NAME := {"tank": "Танк", "heal": "Хилер", "dps": "ДПС"}
const ROLE_COLOR := {"tank": Color("#8aa2d6"), "heal": Color("#86b39a"), "dps": Color("#c98c6d")}


func _init() -> void:
	characters = _load("characters")
	gear = _load("gear")
	armour = _load("armourSets")
	dungeons = _load("dungeons")
	abilities = _load("abilities").ABILITY_BY_CANDIDATE
	skill_art = _load("skillArt")
	item_icons = _load("itemIcons").ITEM_ICONS
	monster_art = _load("monsterArt")
	hero_classes = _load("heroClasses").HERO_CLASSES
	professions = _load("professions")
	reagents = _load("reagents")
	recipes = _load("recipes").RECIPES
	curios = _load("curios").CURIOS
	quests = _load("quests").QUESTS
	achievements = _load("achievements").ACHIEVEMENTS
	daily = _load("dailyQuests")
	arena = _load("arena")
	weekly = _load("weeklyChallenge")
	barks = _load("barks").BARKS
	features = _load("features")
	traits = _load("traits").TRAITS
	gear_sets = _load("gearSets").GEAR_SETS
	gear_info = _load("gearInfo")
	contracts = _load("contracts")
	specs = _load("specs")
	spellbook = _load("spellbook").SPELLS
	talent_trees = _load("talentTrees").TREES
	for cls in talent_trees:
		for sid in talent_trees[cls]:
			for t in talent_trees[cls][sid]: _talent_by_id[t.id] = t
	all_candidates = characters.ALL_CANDIDATES
	for c in all_candidates: candidates[int(c.id)] = c
	dungeon_list = dungeons.DUNGEONS
	locations = dungeons.LOCATIONS


func _load(name: String) -> Dictionary:
	var f := FileAccess.open("res://data/%s.json" % name, FileAccess.READ)
	var d = JSON.parse_string(f.get_as_text())
	return _ints(d)


## JSON numbers arrive as floats; whole ones become ints so ids compare cleanly.
func _ints(v):
	if v is Dictionary:
		for k in v.keys(): v[k] = _ints(v[k])
	elif v is Array:
		for i in v.size(): v[i] = _ints(v[i])
	elif v is float and v == floor(v) and absf(v) < 1e9:
		return int(v)
	return v


# ── gear ────────────────────────────────────────────────────────────────────
func slot_kind(slot: String) -> String:
	return gear.SLOT_KIND[slot]


func slot_gear(slot: String) -> Array:
	return gear.GEAR[slot_kind(slot)]


func slots_for_kind(kind: String) -> Array:
	return SLOT_ORDER.filter(func(s): return gear.SLOT_KIND[s] == kind)


func slot_label(slot: String) -> String:
	return gear.SLOT_LABEL[slot]


func find_gear(gear_id: String) -> Dictionary:
	for kind in GEAR_KINDS:
		for o in gear.GEAR[kind]:
			if o.id == gear_id: return o
	return {}


func gear_in(kind: String, gear_id: String) -> Dictionary:
	for o in gear.GEAR[kind]:
		if o.id == gear_id: return o
	return {}


func empty_equipment() -> Dictionary:
	var e := {}
	for s in SLOT_ORDER: e[s] = "none"
	return e


func migrate_equipment(saved) -> Dictionary:
	var e := empty_equipment()
	var rename := {"armor": "chest", "trinket": "necklace", "ring": "ring1"}
	if saved is Dictionary:
		for k in saved:
			var key: String = rename.get(k, k)
			if e.has(key) and not (saved[k] in armour.RETIRED_ARMOUR_IDS): e[key] = saved[k]
	return e


func armour_of(gear_id: String):
	var re := RegEx.create_from_string("^set-([a-z]+)-([a-z]+)$")
	var m := re.search(gear_id)
	if not m: return null
	for s in armour.ARMOUR_SETS:
		if s.id == m.get_string(1) and m.get_string(2) in armour.ARMOUR_ITEMS:
			return {"set": s, "item": m.get_string(2)}
	return null


func dress_in_starting_set(id: int, equipment: Dictionary) -> void:
	var set_id = armour.STARTING_OUTFITS.get(str(id))
	if set_id == null: return
	for item in armour.ARMOUR_ITEMS:
		var slot: String = armour.ITEM_KIND[item]
		if not equipment.has(slot) or equipment[slot] == "none": equipment[slot] = "set-%s-%s" % [set_id, item]


func starting_equipment(id: int) -> Dictionary:
	var e := empty_equipment()
	dress_in_starting_set(id, e)
	return e


## Where an item's icon lives under assets/, or "".
func item_icon_path(icon) -> String:
	if icon == null: return ""
	if item_icons.has(icon): return item_icons[icon].asset
	if armour.ARMOUR_ICONS.has(icon): return armour.ARMOUR_ICONS[icon].asset
	return ""


func rarity_of(o: Dictionary) -> String:
	var id: String = o.get("id", "")
	if RegEx.create_from_string("^u[a-z]-").search(id): return "unique"
	if RegEx.create_from_string("^r[wat]-").search(id): return "legendary"
	var price: int = o.get("price", 0) if o.get("price") != null else 0
	if price >= 150: return "rare"
	if price >= 90: return "magic"
	return "common"


func rarity_color(r: String) -> Color:
	return Color(gear_info.RARITY_COLOR[r])


func set_name_of(gear_id: String):
	for s in gear_sets:
		if s.weapon == gear_id or s.armor == gear_id or s.trinket == gear_id: return s.name
	return null


const STATS := [["mult", "к урону/лечению", false], ["hpMult", "к HP", false], ["wardMult", "к получаемому урону", true], ["cdMult", "к перезарядке", true]]


func _signed(n: int) -> String:
	return ("+%d%%" % n) if n > 0 else ("%d%%" % n)


func stat_lines(o: Dictionary) -> Array:
	var out := []
	for st in STATS:
		var v = o.get(st[0])
		if v == null or v == 1: continue
		var d := int(round((v - 1.0) * 100))
		out.append({"text": "%s %s" % [_signed(d), st[1]], "good": d < 0 if st[2] else d > 0})
	return out


func compare_lines(o: Dictionary, worn: Dictionary) -> Array:
	var out := []
	for st in STATS:
		var a = o.get(st[0]); var b = worn.get(st[0])
		var d := int(round(((a if a != null else 1.0) - (b if b != null else 1.0)) * 100))
		if d == 0: continue
		out.append({"text": "%s %s %s" % ["▲" if d > 0 else "▼", _signed(d), st[1]], "good": d < 0 if st[2] else d > 0})
	return out


# ── dungeons, monsters ─────────────────────────────────────────────────────
func dungeon(id: String) -> Dictionary:
	for d in dungeon_list:
		if d.id == id: return d
	return dungeon_list[0]


func dungeon_index(id: String) -> int:
	for i in dungeon_list.size():
		if dungeon_list[i].id == id: return i
	return -1


func location(id: String) -> Dictionary:
	for l in locations:
		if l.id == id: return l
	return {}


func room_art_for(d: Dictionary):
	var ra: Dictionary = monster_art.ROOM_ART
	if ra.has(d.id): return ra[d.id]
	return ra.get(d.locationId)


func monster_path(id) -> String:
	if id == null or not monster_art.MONSTER_ART.has(id): return ""
	return monster_art.MONSTER_ART[id].asset


func boss_art_path(dungeon_id: String) -> String:
	return monster_path(monster_art.BOSS_ART.get(dungeon_id))


func ability(cid: int) -> Dictionary:
	return abilities[str(cid)]


func ability_art_path(cid: int) -> String:
	var id = skill_art.ABILITY_ART.get(str(cid))
	if id == null or not skill_art.SKILL_ART.has(id): return ""
	return skill_art.SKILL_ART[id].asset


func hero_class(id: String) -> Dictionary:
	return hero_classes[id]


func portrait_path(cid: int) -> String:
	return "portraits/%d.jpg" % cid


# ── professions ────────────────────────────────────────────────────────────
func profession(id) -> Dictionary:
	for p in professions.PROFESSIONS:
		if p.id == id: return p
	return {}


func profession_train_cost(level: int) -> int:
	return 8 + level * 3


func scaled_mult(full, level: int) -> float:
	if full == null: return 1.0
	var frac := clampf(float(level - 1) / (professions.PROFESSION_MAX_LEVEL - 1), 0.0, 1.0)
	return 1.0 + (full - 1.0) * frac


func reagent(id: String) -> Dictionary:
	for r in reagents.REAGENTS:
		if r.id == id: return r
	return {}


# ── seeded picks: the day's quests and the week's challenge ───────────────
class Seeded:
	var seed := 0
	func _init(key: String) -> void:
		for ch in key.to_utf8_buffer(): seed = (seed * 31 + ch) & 0xffffffff
	func next() -> float:
		seed = (seed * 1664525 + 1013904223) & 0xffffffff
		return float(seed) / float(0xffffffff)


func pick_daily_templates(date_key: String) -> Array:
	var rand := Seeded.new(date_key)
	var pool: Array = daily.DAILY_QUEST_TEMPLATES.duplicate()
	var picked := []
	for i in 3:
		if pool.is_empty(): break
		var idx := int(floor(rand.next() * pool.size()))
		picked.append(pool.pop_at(idx))
	return picked


func pick_weekly_modifier(week_key: String) -> Dictionary:
	var rand := Seeded.new(week_key + ":modifier")
	var mods: Array = weekly.WEEKLY_MODIFIERS
	return mods[int(floor(rand.next() * mods.size()))]


func pick_weekly_dungeon_id(week_key: String, cleared: Array):
	if cleared.is_empty(): return null
	var rand := Seeded.new(week_key + ":dungeon")
	return cleared[int(floor(rand.next() * cleared.size()))]


func arena_rank_name(rating: int) -> String:
	var name: String = arena.ARENA_RANKS[0].name
	for r in arena.ARENA_RANKS:
		if rating >= r.min: name = r.name
	return name


func bark_moment(win: bool, is_boss: bool, rough: bool) -> String:
	if not win: return "loss"
	if is_boss: return "boss"
	return "close" if rough else "win"


func unlock_hint(f: String) -> String:
	var d: Dictionary = features.FEATURES[f]
	var b: int = d.get("bosses", 0) if d.get("bosses") != null else 0
	if b > 0: return "Откроется после первого босса" if b == 1 else "Откроется после %d-го босса" % b
	var r: int = d.get("rooms", 0) if d.get("rooms") != null else 0
	return "Откроется после первой победы" if r <= 1 else "Откроется после %d побед" % r


# ── specs, resources, spellbook, talents ────────────────────────────────────
func specs_of(cls: String) -> Array:
	return specs.SPECS[cls]


func spec_def(cls: String, spec_id) -> Dictionary:
	for s in specs.SPECS[cls]:
		if s.id == spec_id: return s
	return {}


## The spec a hero starts in: the first of their class that keeps their hired role.
func default_spec(def: Dictionary) -> String:
	var all: Array = specs.SPECS[def.heroClass]
	for s in all:
		if s.role == def.role: return s.id
	return all[0].id


## A hero's fighting numbers in a spec. The hired role keeps the hired numbers;
## another role reshapes the same offence power and vitality.
func stats_for(def: Dictionary, spec_id) -> Dictionary:
	var sd = spec_def(def.heroClass, spec_id)
	var role: String = sd.get("role", def.role)
	var rs: Dictionary = specs.ROLE_STATS
	var native: String = def.role
	var heal = def.get("healPower")
	var power: float = float(def.dps) / rs[native].dps
	if native == "heal" and heal != null: power = float(heal) / rs.heal.heal
	var vit: float = float(def.hp) / rs[native].hp
	var out = {"role": role, "attackRange": sd.get("range", def.attackRange), "power": power}
	if role == native:
		out.hp = def.hp; out.dps = def.dps; out.healPower = heal if role == "heal" else null
	else:
		out.hp = int(round(vit * rs[role].hp))
		out.dps = maxi(1, int(round(power * rs[role].dps)))
		out.healPower = int(round(power * rs.heal.heal)) if role == "heal" else null
	return out


func resource_of(cls: String) -> Dictionary:
	return specs.RESOURCES[specs.CLASS_RESOURCE[cls]]


func spells_of(cls: String) -> Array:
	return spellbook.get(cls, [])


func spell(cls: String, id: String) -> Dictionary:
	for s in spellbook.get(cls, []):
		if s.id == id: return s
	return {}


func talent_tree(cls: String, spec_id: String) -> Array:
	return talent_trees[cls][spec_id]


func talent(id: String) -> Dictionary:
	return _talent_by_id.get(id, {})


## What a talent gives at a rank, in words.
func talent_lines(cls: String, t: Dictionary, rank: int) -> Array:
	var r = maxi(1, rank)
	var e: Dictionary = t.eff
	var pct = func(v: float) -> String: return "%d%%" % int(round(absf(v) * 100 * r))
	var out = []
	if e.has("dmg"): out.append("+%s к урону" % pct.call(e.dmg))
	if e.has("heal"): out.append("+%s к лечению" % pct.call(e.heal))
	if e.has("hp"): out.append("+%s к максимальному здоровью" % pct.call(e.hp))
	if e.has("taken"): out.append("−%s к получаемому урону" % pct.call(e.taken))
	if e.has("crit"): out.append("+%s к шансу крита" % pct.call(e.crit))
	if e.has("regen"): out.append("+%d к восстановлению ресурса за ход" % (e.regen * r))
	if e.has("cost"): out.append("−%s к цене заклинаний" % pct.call(e.cost))
	if e.has("spell"):
		for id in e.spell: out.append("+%s к силе: %s" % [pct.call(e.spell[id]), spell(cls, id).get("name", id)])
	if e.has("cdr"):
		for id in e.cdr: out.append("−%d к перезарядке: %s" % [e.cdr[id] * r, spell(cls, id).get("name", id)])
	if e.has("grants"):
		for s in spellbook.get(cls, []):
			if s.talent == e.grants: out.append("Новое заклинание: %s — %s" % [s.name, s.desc])
	return out

