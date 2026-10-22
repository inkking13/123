class_name World
extends RefCounted
## The open map between fights, after Wartales: one region per land, the
## squad walking it in real time. Walking spends hours; hours spend rations
## and wear the squad down; night makes the roaming bands bolder. A region
## holds its land's three dungeons, a town (market, tavern, contract board,
## provisions, an inn), chests, gathering spots, roads to the lands either
## side, and bands of foes that wander and give chase.

const SIZE := 70.0                 # half the side of a region, metres
const WALK_SPEED := 5.0
const METRES_PER_HOUR := 12.0
const MEAL_HOURS := 8.0
const FATIGUE_PER_HOUR := 2.0
const START_FOOD := 15
const FOOD_PACK := 5
const FOOD_PACK_PRICE := 20
const INN_PRICE := 15
const REACH := 2.4                 # how near counts as arrived at a place
const BAND_SPEED := 2.2
const BAND_CHASE_SPEED := 4.2
const BAND_SIGHT := 10.0
const BAND_CATCH := 1.7
const BAND_RESPAWN_DAYS := 2
const HERB_REGROW_DAYS := 2
const NIGHT_ENEMY_DMG := 1.25

## How each land looks: ground, grass and rock tints, trees, sky and fog.
const THEMES := {
	"outskirts": {"ground": Color(0.27, 0.28, 0.17), "ground2": Color(0.22, 0.26, 0.14), "road": Color(0.42, 0.36, 0.27), "tree": "pine", "leaf": Color(0.2, 0.32, 0.17), "rock": Color(0.45, 0.43, 0.4), "sky": Color(0.55, 0.62, 0.72), "fog": Color(0.55, 0.58, 0.6), "town": "Пограничная Застава"},
	"icefrontier": {"ground": Color(0.78, 0.82, 0.86), "ground2": Color(0.62, 0.68, 0.74), "road": Color(0.5, 0.5, 0.52), "tree": "pine", "leaf": Color(0.25, 0.36, 0.33), "rock": Color(0.55, 0.6, 0.68), "sky": Color(0.7, 0.78, 0.88), "fog": Color(0.8, 0.85, 0.9), "town": "Зимовье Волчьей Тропы"},
	"ashlands": {"ground": Color(0.24, 0.22, 0.21), "ground2": Color(0.32, 0.25, 0.2), "road": Color(0.4, 0.33, 0.28), "tree": "dead", "leaf": Color(0.15, 0.13, 0.12), "rock": Color(0.3, 0.27, 0.26), "sky": Color(0.55, 0.42, 0.35), "fog": Color(0.45, 0.36, 0.32), "town": "Пепельный Приход"},
	"debtprovince": {"ground": Color(0.42, 0.4, 0.24), "ground2": Color(0.36, 0.38, 0.22), "road": Color(0.47, 0.4, 0.3), "tree": "round", "leaf": Color(0.33, 0.38, 0.17), "rock": Color(0.5, 0.47, 0.42), "sky": Color(0.65, 0.66, 0.6), "fog": Color(0.62, 0.62, 0.55), "town": "Долговой Посад"},
	"shadowguild": {"ground": Color(0.2, 0.22, 0.24), "ground2": Color(0.16, 0.2, 0.2), "road": Color(0.3, 0.3, 0.32), "tree": "round", "leaf": Color(0.13, 0.2, 0.19), "rock": Color(0.28, 0.29, 0.33), "sky": Color(0.35, 0.38, 0.48), "fog": Color(0.3, 0.32, 0.4), "town": "Чёрный Рынок"},
	"forgottenlegion": {"ground": Color(0.3, 0.3, 0.25), "ground2": Color(0.26, 0.24, 0.2), "road": Color(0.38, 0.36, 0.3), "tree": "dead", "leaf": Color(0.2, 0.2, 0.16), "rock": Color(0.42, 0.42, 0.38), "sky": Color(0.5, 0.52, 0.5), "fog": Color(0.48, 0.5, 0.47), "town": "Лагерь Дезертиров"},
	"dragonwastes": {"ground": Color(0.45, 0.32, 0.22), "ground2": Color(0.38, 0.24, 0.17), "road": Color(0.52, 0.4, 0.3), "tree": "dead", "leaf": Color(0.3, 0.2, 0.14), "rock": Color(0.48, 0.33, 0.26), "sky": Color(0.7, 0.5, 0.38), "fog": Color(0.66, 0.48, 0.38), "town": "Крепость Скал"},
	"hierarchy": {"ground": Color(0.3, 0.22, 0.24), "ground2": Color(0.36, 0.2, 0.2), "road": Color(0.45, 0.35, 0.3), "tree": "dead", "leaf": Color(0.3, 0.12, 0.1), "rock": Color(0.35, 0.25, 0.27), "sky": Color(0.55, 0.32, 0.3), "fog": Color(0.5, 0.3, 0.3), "town": "Предвратье Совета"},
}
const BAND_NAMES := {
	"outskirts": ["Мародёры", "Беглые каторжники", "Шайка с тракта"],
	"icefrontier": ["Ледяные волки", "Снежные разбойники", "Стая из ущелья"],
	"ashlands": ["Пепельные культисты", "Обугленные мертвецы", "Мародёры гарей"],
	"debtprovince": ["Коллекторы", "Приставы без жалования", "Разорённые фермеры"],
	"shadowguild": ["Контрабандисты", "Ночные ножи", "Соглядатаи гильдии"],
	"forgottenlegion": ["Призрачный дозор", "Дезертиры", "Костяные легионеры"],
	"dragonwastes": ["Культ виверны", "Выжженные следопыты", "Драконьи прихвостни"],
	"hierarchy": ["Демонические клерки", "Стража Совета", "Аудиторы бездны"],
}

var g  # Game
var region = "outskirts"
var pos = Vector2(-60, 0)
var target = null                  # Vector2 the squad walks to, or null
var goal = ""                      # the place they walk to, if any
var hours = 9.0                    # time of day, 0..24
var day = 1
var food = START_FOOD
var meal_clock = 0.0               # hours since the squad last ate
var hungry = false
var fatigue = 0.0                  # 0..100
var opened = {}                    # chest id -> true
var gathered = {}                  # spot id -> day it was picked
var bands = {}                     # region -> [band]
var beaten = {}                    # band id -> day it was beaten
var _grace = 0.0                   # seconds the bands leave the squad alone after a fight
var _layouts = {}
var log_note = ""                  # one line for the HUD: what just happened


func _init(game) -> void:
	g = game


# ── save ───────────────────────────────────────────────────────────────────
func to_dict() -> Dictionary:
	return {"region": region, "x": pos.x, "z": pos.y, "hours": hours, "day": day, "food": food, "mealClock": meal_clock,
		"hungry": hungry, "fatigue": fatigue, "opened": opened.keys(), "gathered": gathered, "beaten": beaten}


func from_dict(d) -> void:
	if not (d is Dictionary): return
	region = d.get("region", region)
	if not THEMES.has(region): region = "outskirts"
	pos = Vector2(float(d.get("x", pos.x)), float(d.get("z", pos.y)))
	hours = float(d.get("hours", hours)); day = int(d.get("day", day))
	food = int(d.get("food", food)); meal_clock = float(d.get("mealClock", 0)); hungry = bool(d.get("hungry", false))
	fatigue = float(d.get("fatigue", 0))
	opened = {}
	for k in d.get("opened", []): opened[k] = true
	gathered = d.get("gathered", {}) if d.get("gathered") is Dictionary else {}
	beaten = d.get("beaten", {}) if d.get("beaten") is Dictionary else {}
	target = null; goal = ""


func reset() -> void:
	region = "outskirts"; pos = layout().start; target = null; goal = ""
	hours = 9.0; day = 1; food = START_FOOD; meal_clock = 0.0; hungry = false; fatigue = 0.0
	opened = {}; gathered = {}; bands = {}; beaten = {}


# ── the region's layout (fixed per land) ───────────────────────────────────
func location_index(loc := "") -> int:
	var id = loc if loc != "" else region
	for i in DB.locations.size():
		if DB.locations[i].id == id: return i
	return 0


func region_dungeons(loc := "") -> Array:
	var id = loc if loc != "" else region
	return DB.dungeon_list.filter(func(d): return d.locationId == id)


## A land is open once its first dungeon is.
func region_open(loc: String) -> bool:
	var ds = region_dungeons(loc)
	return not ds.is_empty() and g.is_dungeon_unlocked(ds[0].id)


func theme() -> Dictionary:
	return THEMES[region]


## Places, roads and band camps of a land, the same every time.
func layout(loc := "") -> Dictionary:
	var id = loc if loc != "" else region
	if _layouts.has(id): return _layouts[id]
	var rng = RandomNumberGenerator.new()
	rng.seed = hash(id) + 7
	var idx = location_index(id)
	var places = []
	var west = Vector2(-SIZE + 6, rng.randf_range(-12, 12))
	var east = Vector2(SIZE - 6, rng.randf_range(-12, 12))
	if idx > 0: places.append({"id": "west", "kind": "road", "pos": west, "to": DB.locations[idx - 1].id})
	if idx < DB.locations.size() - 1: places.append({"id": "east", "kind": "road", "pos": east, "to": DB.locations[idx + 1].id})
	# The road runs west to east through the dungeons and the town.
	var ds = region_dungeons(id)
	var stops = [west]
	var xs = [-38.0, 2.0, 36.0]
	for i in ds.size():
		var p = Vector2(xs[i] + rng.randf_range(-5, 5), rng.randf_range(-40, 40))
		places.append({"id": "d:" + ds[i].id, "kind": "dungeon", "pos": p, "dungeon": ds[i].id})
		stops.append(p)
	var town = Vector2(-16 + rng.randf_range(-4, 4), rng.randf_range(-14, 14))
	places.append({"id": "town", "kind": "town", "pos": town})
	stops.append(town)
	stops.append(east)
	stops.sort_custom(func(a, b): return a.x < b.x)
	for i in 5:
		places.append({"id": "chest%d" % i, "kind": "chest", "pos": _free_spot(rng, places)})
	for i in 3:
		places.append({"id": "herb%d" % i, "kind": "herb", "pos": _free_spot(rng, places)})
	# Band camps keep away from the places and from where the squad comes in.
	var camps = []
	var keep_off = places + [{"pos": west + Vector2(4, 0)}, {"pos": west + Vector2(14, 0)}]
	for i in 4:
		var c = _free_spot(rng, keep_off, 16.0)
		camps.append(c)
		keep_off.append({"pos": c})
	var out = {"places": places, "road": stops, "camps": camps, "start": west + Vector2(4, 0), "town": town, "seed": rng.seed}
	_layouts[id] = out
	return out


func _free_spot(rng: RandomNumberGenerator, places: Array, gap := 9.0) -> Vector2:
	for _try in 40:
		var p = Vector2(rng.randf_range(-SIZE + 10, SIZE - 10), rng.randf_range(-SIZE + 10, SIZE - 10))
		if places.all(func(q): return q.pos.distance_to(p) > gap): return p
	return Vector2(rng.randf_range(-SIZE + 10, SIZE - 10), rng.randf_range(-SIZE + 10, SIZE - 10))


func place(id: String):
	for p in layout().places:
		if p.id == id: return p
	return null


# ── bands of foes ──────────────────────────────────────────────────────────
## The land's bands, made the first time the squad comes; beaten ones stay
## away for a couple of days.
func region_bands() -> Array:
	if not bands.has(region):
		var list = []
		var lay = layout()
		var names: Array = BAND_NAMES[region]
		for i in lay.camps.size():
			var home: Vector2 = lay.camps[i]
			list.append({"id": "%s:%d" % [region, i], "home": home, "pos": home, "to": home, "wait": randf() * 3.0,
				"name": names[i % names.size()], "size": 2 + (i % 2), "chasing": false})
		bands[region] = list
	return bands[region].filter(func(b): return not beaten.has(b.id) or day - int(beaten[b.id]) >= BAND_RESPAWN_DAYS)


func is_night() -> bool:
	return hours >= 20.0 or hours < 6.0


# ── the clock, the larder and the squad's legs ─────────────────────────────
## A few seconds' peace on coming out onto the map.
func arrive() -> void:
	_grace = 4.0


func walk_to(p: Vector2, place_id := "") -> void:
	target = Vector2(clampf(p.x, -SIZE + 2, SIZE - 2), clampf(p.y, -SIZE + 2, SIZE - 2))
	goal = place_id


## One frame on the map: the squad walks, time passes, bands roam and chase.
## Returns a band that caught the squad, or null.
func step(dt: float):
	_grace = maxf(0.0, _grace - dt)
	var moved = 0.0
	if target != null:
		var d: Vector2 = target - pos
		var stepd = minf(d.length(), WALK_SPEED * dt)
		if d.length() > 0.01: pos += d.normalized() * stepd
		moved = stepd
		if pos.distance_to(target) < 0.05:
			target = null
	if moved > 0: _pass_hours(moved / METRES_PER_HOUR)
	var sight = BAND_SIGHT * (1.5 if is_night() else 1.0)
	for b in region_bands():
		var to_squad: Vector2 = pos - b.pos
		b.chasing = _grace <= 0 and to_squad.length() < sight
		if b.chasing:
			b.pos += to_squad.normalized() * minf(to_squad.length(), BAND_CHASE_SPEED * dt)
			if b.pos.distance_to(pos) < BAND_CATCH: return b
		else:
			b.wait -= dt
			if b.wait <= 0:
				b.to = b.home + Vector2(randf_range(-9, 9), randf_range(-9, 9))
				b.wait = 3.0 + randf() * 4.0
			var w: Vector2 = b.to - b.pos
			if w.length() > 0.1: b.pos += w.normalized() * minf(w.length(), BAND_SPEED * dt)
	return null


## Arrived at the place the squad was walking to?
func arrived() -> String:
	if goal == "" or target != null: return ""
	var p = place(goal)
	if p and p.pos.distance_to(pos) <= REACH + 0.1: return goal
	return ""


func near_place():
	var best = null
	for p in layout().places:
		if p.pos.distance_to(pos) <= REACH * 1.5 and (best == null or p.pos.distance_to(pos) < best.pos.distance_to(pos)): best = p
	return best


func _pass_hours(h: float) -> void:
	hours += h
	while hours >= 24.0:
		hours -= 24.0
		day += 1
	fatigue = minf(100.0, fatigue + FATIGUE_PER_HOUR * h * (2.0 if hungry else 1.0))
	meal_clock += h
	if meal_clock >= MEAL_HOURS:
		meal_clock -= MEAL_HOURS
		_eat()


func _eat() -> void:
	var mouths = maxi(1, g.squad().size())
	if food >= mouths:
		food -= mouths
		if hungry: log_note = "Отряд наконец поел."
		hungry = false
	else:
		food = 0
		if not hungry: log_note = "Провизия кончилась — отряд голодает."
		hungry = true
		for c in g.squad(): g.adjust_morale(c.id, -3)


func squad_size() -> int:
	return maxi(1, g.squad().size())


## Make camp anywhere: eight hours, a meal, the tiredness gone.
func camp() -> void:
	var mouths = squad_size()
	var fed = food >= mouths
	food = maxi(0, food - mouths)
	hungry = not fed
	meal_clock = 0.0
	hours += 8.0
	while hours >= 24.0:
		hours -= 24.0
		day += 1
	fatigue = 0.0 if fed else 40.0
	for c in g.squad(): g.adjust_morale(c.id, 3 if fed else -2)
	log_note = "Привал: отряд выспался у костра." if fed else "Привал без ужина — сон был тревожным."
	target = null; goal = ""
	g.notify()


func rest_at_inn() -> void:
	if g.gold < INN_PRICE: return
	g.gold -= INN_PRICE
	hours += 8.0
	while hours >= 24.0:
		hours -= 24.0
		day += 1
	fatigue = 0.0; meal_clock = 0.0; hungry = false
	for c in g.squad(): g.adjust_morale(c.id, 4)
	log_note = "Ночлег в таверне: тёплые постели и горячий ужин."
	g.notify()


func buy_food() -> void:
	if g.gold < FOOD_PACK_PRICE: return
	g.gold -= FOOD_PACK_PRICE
	food += FOOD_PACK
	g.notify()


## What tiredness, hunger and the dark do to a fight started on the map.
func output_mult() -> float:
	var m = 1.0
	if fatigue >= 85: m *= 0.8
	elif fatigue >= 60: m *= 0.9
	if hungry: m *= 0.85
	return m


func fatigue_word() -> String:
	if fatigue >= 85: return "Изнурён"
	if fatigue >= 60: return "Устал"
	if fatigue >= 30: return "Бодр"
	return "Свеж"


# ── places ─────────────────────────────────────────────────────────────────
func open_chest(id: String) -> void:
	if opened.has(id): return
	opened[id] = true
	var gold = 20 + randi() % 31
	g.gold += gold
	var parts = ["%d золота" % gold]
	if randf() < 0.6:
		var n = 2 + randi() % 3
		food += n
		parts.append("%d пайка" % n)
	var rdef = DB.reagents.REAGENT_BY_LOCATION.get(region)
	if rdef and randf() < 0.5:
		g.reagent_counts[rdef.id] = g.reagent_owned(rdef.id) + 1
		parts.append(rdef.name)
	log_note = "В сундуке: " + ", ".join(parts) + "."
	g.notify()


func herb_ready(id: String) -> bool:
	return not gathered.has(id) or day - int(gathered[id]) >= HERB_REGROW_DAYS


func gather(id: String) -> void:
	if not herb_ready(id): return
	gathered[id] = day
	var rdef = DB.reagents.REAGENT_BY_LOCATION.get(region)
	var n = 1 + randi() % 2
	if rdef: g.reagent_counts[rdef.id] = g.reagent_owned(rdef.id) + n
	var meal = 1 + randi() % 2
	food += meal
	log_note = "Собрано: %s ×%d и %d пайка из дичи и кореньев." % [rdef.name if rdef else "сырьё", n, meal]
	hours += 1.0
	g.notify()


func travel(to: String) -> void:
	if not region_open(to): return
	var from = region
	region = to
	var lay = layout()
	var back = null
	for p in lay.places:
		if p.kind == "road" and p.to == from: back = p
	pos = (back.pos + (Vector2(4, 0) if back.id == "west" else Vector2(-4, 0))) if back else lay.start
	target = null; goal = ""
	_pass_hours(6.0)
	log_note = "Отряд добрался до земель: %s." % DB.locations[location_index()].name
	g.notify()


## The long way round to a far land: six hours a land along the roads.
func travel_far(to: String) -> void:
	if to == region or not region_open(to): return
	var lands = absi(location_index(to) - location_index())
	region = to
	pos = layout().start
	target = null; goal = ""
	_pass_hours(6.0 * lands)
	log_note = "Дорога до земель «%s» заняла %d ч." % [DB.locations[location_index()].name, 6 * lands]
	g.notify()


## After a fight the bands give the squad a few seconds to walk off.
func after_fight(band_id: String, won: bool) -> void:
	if won: beaten[band_id] = day
	_grace = 5.0
	if not won:
		pos = layout().town + Vector2(3, 0)
		food = maxi(0, food - squad_size())
		log_note = "Отряд отступил к городу, растеряв часть припасов."
	target = null; goal = ""
