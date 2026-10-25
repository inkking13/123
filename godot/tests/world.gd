extends SceneTree
## The open map without a screen: walk to a chest and open it, eat on the
## road, camp, meet a band and fight it on auto, come back onto the map,
## enter a dungeon from the map and come back, travel to the next land.
## `godot --headless --path godot -s res://tests/world.gd`

func _initialize() -> void:
	_run.call_deferred()


func _walk(w, to: Vector2, id := "") -> void:
	w.walk_to(to, id)
	var guard = 0
	while w.target != null and guard < 20000:
		w.event = null
		var band = w.step(0.05)
		guard += 1
		if band != null:
			print("  caught by ", band.name)
			return


func _fight(game) -> void:
	while game.screen == "combat": await create_timer(0.1).timeout


func _run() -> void:
	var game = root.get_node("Game")
	game.reset_progress()
	game.finish_draft([0, 3, 8, 4, 7])
	for c in game.pool: c.level = 8
	game.stats_room_wins = 1
	game.settings.auto = true
	game.settings.speed = 2
	Engine.time_scale = 8.0
	var w = game.w
	game.go_world()
	print("screen ", game.screen, " region ", w.region, " at ", w.pos, " food ", w.food)
	var chest = null
	for p in w.layout().places:
		if p.kind == "chest" and chest == null: chest = p
	w._grace = 9999.0
	_walk(w, chest.pos, chest.id)
	w.open_chest(chest.id)
	print("chest: ", w.log_note, " · day ", w.day, " ", int(w.hours), "h food ", w.food, " fatigue ", int(w.fatigue))
	w.camp()
	print("camp: ", w.log_note, " fatigue ", w.fatigue, " food ", w.food)
	# A band: walk into it.
	w._grace = 0.0
	var band = w.region_bands()[0]
	var caught = null
	for i in 8000:
		if i % 50 == 0: w.walk_to(band.pos)
		w.event = null  # a road meeting would hold the squad until answered
		caught = w.step(0.05)
		if caught != null: break
	print("met band: ", caught.name if caught else "none")
	game.start_skirmish(caught)
	await _fight(game)
	print("skirmish: screen ", game.screen, " win ", game.b.result.win if game.b.result else "?")
	game.b.result_primary()
	print("after: screen ", game.screen, " note ", w.log_note, " beaten ", w.beaten.keys())
	# The land's other sights.
	print("outskirts size ", w.size(), " places ", w.layout().places.size(), " bands ", w.region_bands().size())
	w.food = 10; game.gold = 300
	w.farm_buy("farm"); print("farm: ", w.log_note, " food ", w.food)
	w.tower_look("tower"); print("tower: ", w.log_note, " scouted ", w.scouted())
	w.fish("lake"); print("lake: ", w.log_note)
	w.search_ruins("ruins"); print("ruins: ", w.log_note)
	w.pray("shrine"); print("shrine: ", w.log_note, " fatigue ", w.fatigue)
	w.hours = 12.0
	var ghosts = w.search_graves("graveyard")
	print("graveyard: ", w.log_note, " fight ", ghosts != null)
	w.safe_camp = true
	var night_raid = w.make_camp()
	print("safe camp: ", w.log_note, " ambush ", night_raid != null)
	# The walled town: its buildings are places of their own.
	print("town buildings: ", w.layout().places.filter(func(p): return p.id.begins_with("town:")).map(func(p): return p.kind))
	game.gold = 300
	w.sharpen(); print("smith: ", w.log_note, " output ", w.output_mult())
	w.drill(); print("barracks: ", w.log_note)
	w.drill(); print("drill again same day blocked: ", w.used_today("town:barracks"))
	# A dungeon from the map, played through on auto.
	var d = w.region_dungeons()[0]
	game.enter_dungeon(d.id)
	print("entered ", game.screen, " from_world ", game.from_world)
	while true:
		game.b.start_encounter()
		await _fight(game)
		var res = game.b.result
		var last: bool = res.isBoss or not res.win
		print("  room %d win=%s" % [game.enc_idx, res.win])
		game.b.result_primary()
		if game.screen == "event": game.dismiss_event()
		if last: break
	print("back on: ", game.screen, " defeated ", game.defeated.keys())
	# Hunger.
	w.food = 0
	w._pass_hours(9.0)
	print("hungry ", w.hungry, " output ", w.output_mult(), " note ", w.log_note)
	# Next land (open once the first dungeon of it is).
	var east = w.place("east")
	print("east open ", w.region_open(east.to))
	game.defeated["road"] = true; game.defeated["groblot"] = true
	w.travel(east.to)
	print("travelled to ", w.region, " at ", w.pos, " ", w.log_note)
	# Camp with tasks: a cook, a trainee, a hunter, a watch.
	w.food = 20
	var sq = game.squad()
	w.set_plan(sq[0].id, "cook"); w.set_plan(sq[1].id, "train"); w.set_plan(sq[2].id, "hunt"); w.set_plan(sq[3].id, "watch")
	var lv = sq[1].level
	var amb = w.make_camp()
	print("camp tasks: ", w.log_note, " · fed ", w.well_fed, " food ", w.food, " trainee xp/level ", sq[1].xp, "/", sq[1].level, " (was lvl ", lv, ") ambush ", amb != null)
	# Every road event, every answer.
	for e in w.ROAD_EVENTS:
		for i in e.options.size():
			w.event = e
			game.gold = 500; w.food = 20
			var jumped = w.answer(i)
			if jumped != null:
				game.b.clear_timer()
		print("event ", e.id, ": ", w.log_note)
	# Errands: take what the board offers, do a bounty and the chests, hand in.
	w.tasks = []
	for t in w.task_offers(): w.take_task(t)
	print("tasks taken: ", w.tasks.map(func(t): return t.kind + ":" + t.desc))
	for t in w.tasks:
		match t.kind:
			"bounty": w.after_fight(t.target, true)
			"chests":
				for p in w.layout().places:
					if p.kind == "chest" and not w.opened.has(p.id): w.open_chest(p.id)
			"gather": game.reagent_counts[t.target] = 10
			"dungeon": w.task_event("dungeon", t.target)
	var gold0 = game.gold
	for t in w.tasks.duplicate(): w.turn_in(t.id)
	print("handed in, gold +", game.gold - gold0, " left ", w.tasks.size(), " · ", w.log_note)
	var saved = w.to_dict()
	w.from_dict(saved)
	print("save round trip region ", w.region, " day ", w.day)
	# Side dungeons: a chain of their own off the road, never in its way.
	var keep = game.defeated.duplicate()
	game.defeated = {"wastes": true, "road": true, "groblot": true}
	var db = root.get_node("DB")
	var side = db.dungeon_list.filter(func(d): return d.get("side", false)).map(func(d): return d.id)
	print("side dungeons ", side, " open ", side.map(func(id): return game.is_dungeon_unlocked(id)), " frostpass open ", game.is_dungeon_unlocked("frostpass"))
	game.defeated["ratmill"] = true
	print("after ratmill: wolfden ", game.is_dungeon_unlocked("wolfden"), " drowned ", game.is_dungeon_unlocked("drowned"), " tiers ", side.map(func(id): return db.dungeon_tier(id)))
	print("side gates on the map ", w.layout("outskirts").places.filter(func(p): return p.get("side", false)).map(func(p): return p.pos.round()))
	game.defeated = keep
	quit()
