extends SceneTree
## Every class, every spec, every spell: heroes at the top level with every
## tree's capstone learned cast each spell of their book in a live fight, then
## a few squads in other specs play a dungeon on auto.
## `godot --headless --path godot -s res://tests/spells.gd`

func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var game = root.get_node("Game")
	var db = root.get_node("DB")
	game.reset_progress()
	for c in db.all_candidates:
		if game.find_hero(c.id) == null: game.pool.append(game._new_hero(c))
	var casts = 0
	for c in game.pool:
		c.level = db.characters.MAX_LEVEL
		for sp in db.specs_of(c.heroClass):
			for t in db.talent_tree(c.heroClass, sp.id):
				if t.eff.has("grants"): c.talentPoints[t.id] = 1
	for cls in db.specs.SPECS:
		var hero = null
		for c in game.pool:
			if c.heroClass == cls: hero = c
		if hero == null:
			print("no hero for ", cls)
			continue
		for sp in db.specs_of(cls):
			game.set_spec(hero.id, sp.id)
			var others = game.pool.filter(func(c): return c.id != hero.id).slice(0, 4)
			game.selected = {}
			for c in [hero] + others: game.selected[c.id] = true
			game.select_dungeon("wastes")
			game.go_dungeon()
			game.b.start_encounter()
			var s = game.b.sim
			var r = null
			for x in s.raiders:
				if x.candidateId == hero.id: r = x
			for spell in r.spells:
				var sd = db.spell(cls, spell.id)
				r.res.val = r.res.max
				spell.cd = 0
				game.b._cast(r, sd, null)
				casts += 1
				if s.boss.hp <= 0: break
			game.b.clear_timer()
			print("%s/%s: %d spells, role %s" % [cls, sp.id, r.spells.size(), r.role])
	print("casts ", casts)
	# Squads in other specs on auto.
	game.reset_progress()
	game.finish_draft([0, 3, 8, 1, 6])
	game.set_spec(0, "holy")
	game.set_spec(3, "shadow")
	game.set_spec(1, "protection")
	game.set_spec(8, "protection")
	print("ready with paladin healer: ", game.squad_ready(), " roles ", game.squad().map(func(c): return c.role))
	game.set_spec(8, "retribution")
	game.settings.auto = true
	game.settings.speed = 2
	Engine.time_scale = 8.0
	for c in game.pool: c.level = 12
	game.select_dungeon("wastes")
	game.go_dungeon()
	while true:
		game.b.start_encounter()
		while game.screen == "combat": await create_timer(0.1).timeout
		var res = game.b.result
		print("room %d: win=%s log=%s" % [game.enc_idx, res.win, game.b.sim.log.map(func(l): return l.text)])
		var last: bool = res.isBoss or not res.win
		game.b.result_primary()
		if game.screen == "event": game.dismiss_event()
		if last: break
	quit()
