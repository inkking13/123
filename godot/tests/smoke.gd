extends SceneTree
## Headless check of the game's logic: draft a guild, then play dungeons on
## auto-battle start to finish. `godot --headless --path godot -s res://tests/smoke.gd`

func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var game = root.get_node("Game")
	game.reset_progress()
	print("draft problem: ", game.draft_problem([0, 3, 8, 4, 7]))
	game.finish_draft([0, 3, 8, 4, 7])
	print("gold after draft: ", game.gold, " squad ", game.squad().map(func(c): return c.name))
	game.settings.auto = true
	game.settings.speed = 2
	Engine.time_scale = 8.0
	var fights := 0
	for dungeon in ["wastes", "road"]:
		game.select_dungeon(dungeon)
		game.go_dungeon()
		while true:
			game.b.start_encounter()
			while game.screen == "combat": await create_timer(0.1).timeout
			fights += 1
			var res = game.b.result
			print("%s room %d: win=%s rounds=%d log=%s" % [dungeon, game.enc_idx, res.win, game.b.sim.round, game.b.sim.log.map(func(l): return l.text)])
			var last: bool = res.isBoss or not res.win
			game.b.result_primary()
			if game.screen == "event": game.dismiss_event()
			if last: break
	print("fights ", fights, " gold ", game.gold, " defeated ", game.defeated.keys(), " room wins ", game.stats_room_wins)
	print("contracts ", game.contract_board().map(func(c): return c.dungeonName + "/" + c.termTitle))
	print("quests achieved ", game.quest_rows().filter(func(q): return q.achieved).map(func(q): return q.q.id))
	quit()
