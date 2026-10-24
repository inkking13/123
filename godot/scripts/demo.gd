class_name Demo
## A ready-made guild for screenshots and testing: five heroes, some wins, a
## few systems open, an event and a contract on hand.


static func setup() -> void:
	var g = Game
	g.reset_progress()
	g.finish_draft([0, 3, 8, 1, 6])
	g.stats_room_wins = 40
	for d in ["wastes", "road", "groblot", "frostpass", "ratmill"]: g.defeated[d] = true
	for f in DB.features.FEATURE_ORDER: g.seen_unlocks[f] = true
	g.seen_unlocks.erase("contracts")
	g.payroll_notice = {"paid": 120, "shortfall": false}
	g.gold = 420
	g.settings.quality = "medium"
	# Seasoned heroes, with a few talents learned, for the trees and spellbooks.
	for c in g.pool:
		c.level = 16
		var tree: Array = DB.talent_tree(c.heroClass, c.spec)
		for t in tree.filter(func(x): return x.tier == 0): c.talentPoints[t.id] = 5
		c.talentPoints[tree.filter(func(x): return x.tier == 1)[0].id] = 2
	for t in ["move", "act", "focus"]: g.seen_tips[t] = true
	g.notify()


## Puts these heroes in the squad, hiring any not in the guild yet.
static func squad(ids: Array) -> void:
	var g = Game
	for c in DB.all_candidates:
		if c.id in ids and g.find_hero(c.id) == null: g.pool.append(g._new_hero(c))
	g.selected = {}
	for id in ids: g.selected[id] = true
	for c in g.squad(): c.level = 16


## The first hero who knows this spell casts it on the field, for shots of how it looks.
static func cast(id: String) -> void:
	var s = Game.b.sim
	for r in s.raiders:
		var sd = DB.spell(r.heroClass, id)
		if sd.is_empty() or not r.alive: continue
		var e: Dictionary = sd.eff
		var kind = "rally"
		if e.has("dmg"): kind = "melee" if r.attackRange == "melee" and not e.get("ranged", false) else "ranged"
		elif e.has("aoe"): kind = "ability"
		elif e.has("heal") or e.has("healPct") or e.has("partyHeal"): kind = "heal"
		var other = s.raiders.filter(func(x): return x.alive and x.id != r.id)
		var fe = Game.b.focus_enemy()
		s.fx = {"seq": s.fx.seq + 1, "actor": r.id, "kind": kind, "spell": id, "crit": false,
			"targetEnemy": fe.id if fe else -1, "targetRaider": other[0].id if sd.target == "ally" and not other.is_empty() else r.id}
		return
	print("nobody in the squad knows ", id)


static func open(what: String) -> void:
	var g = Game
	match what:
		"char": g.open_char(g.squad()[0].id)
		"bivouac", "bivouac-night":
			g.go_world()
			if what == "bivouac-night": g.w.hours = 21.0
			# Every task of the night taken by someone.
			var acts = ["rest", "cook", "train", "watch", "rest", "hunt"]
			var squad: Array = g.squad()
			for i in squad.size(): g.w.set_plan(squad[i].id, acts[i % acts.size()])
			g.go("bivouac")
		"town":
			g.go_world()
			g.w.take_task(g.w.task_offers()[0])
			g.go("town")
		"world-event":
			g.settings.auto = false
			g.go_world()
			g.w.event = World.ROAD_EVENTS[0]
			g.w.take_task(g.w.task_offers()[0])
		"world-at-farm", "world-at-tower", "world-at-lake", "world-at-graveyard", "world-at-camp", "world-at-ruins", "world-at-shrine":
			g.settings.auto = false
			g.go_world()
			g.w.pos = g.w.place(what.substr(9)).pos + Vector2(0, 9)
			g.w._grace = 9999.0
		"world-side":
			g.settings.auto = false
			g.go_world()
			g.w.pos = g.w.place("d:ratmill").pos + Vector2(0, 9)
			g.w._grace = 9999.0
		"world", "world-night", "world-town", "world-gate", "world-band":
			g.settings.auto = false
			g.go_world()
			if what == "world-night": g.w.hours = 22.0
			if what == "world-town":
				g.w.pos = g.w.layout().town + Vector2(2, 0)
				g.w._grace = 9999.0
			if what == "world-gate":
				g.w.pos = g.w.place("d:wastes").pos + Vector2(0, 2)
			if what == "world-band":
				var b = g.w.region_bands()[0]
				g.w.pos = b.pos + Vector2(7, 0)
				g.w._grace = 0.0
		"talents":
			g.open_char(g.squad()[0].id)
			g.go("talents")
		"dungeon": g.quick_raid()
		"combat", "combat-act":
			g.quick_raid()
			g.b.start_encounter()
			if what == "combat-act":
				g.settings.auto = false
				if g.b.current_raider(): g.b.skip_move()
		"event":
			g.maybe_trigger_event("home", true)
			g.go("event")
		"contracts":
			g.go("contracts")
			var offers: Array = g.contract_board()
			if not offers.is_empty(): g.accept_contract(offers[0].id)
		_: g.go(what)
