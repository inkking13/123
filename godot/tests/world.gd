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
	game.finish_draft([0, 3, 8, 1, 6])
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
	w.walk_to(band.pos)
	var caught = null
	for i in 4000:
		caught = w.step(0.05)
		if caught != null: break
	print("met band: ", caught.name if caught else "none")
	game.start_skirmish(caught)
	await _fight(game)
	print("skirmish: screen ", game.screen, " win ", game.b.result.win if game.b.result else "?")
	game.b.result_primary()
	print("after: screen ", game.screen, " note ", w.log_note, " beaten ", w.beaten.keys())
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
	var saved = w.to_dict()
	w.from_dict(saved)
	print("save round trip region ", w.region, " day ", w.day)
	quit()
