class_name Demo
## A ready-made guild for screenshots and testing: five heroes, some wins, a
## few systems open, an event and a contract on hand.


static func setup() -> void:
	var g = Game
	g.reset_progress()
	g.finish_draft([0, 3, 8, 1, 6])
	g.stats_room_wins = 40
	for d in ["wastes", "road", "groblot", "frostpass"]: g.defeated[d] = true
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


static func open(what: String) -> void:
	var g = Game
	match what:
		"char": g.open_char(g.squad()[0].id)
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
