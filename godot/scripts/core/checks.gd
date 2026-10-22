class_name Checks
## When each KPI and achievement counts as done (the functions that couldn't
## travel in the JSON from the Expo game's data/quests.ts and achievements.ts).


static func quest(g, id: String) -> bool:
	match id:
		"balanced-squad":
			if not g.squad_ready(): return false
			var sq: Array = g.squad()
			return sq.any(func(c): return c.role == "tank") and sq.any(func(c): return c.role == "heal")
		"first-blood": return g.ever_cleared_room
		"groblot-down": return g.defeated.has("groblot")
		"icepeaks-down": return g.defeated.has("icepeaks")
		"ashen-down": return g.defeated.has("ashen")
		"mines-down": return g.defeated.has("mines")
		"boardroom-down": return g.defeated.has("boardroom")
		"gear-up": return g.pool.any(func(c): return c.equipment.values().any(func(v): return v != "none"))
		"first-talent": return g.pool.any(func(c): return not c.talentPoints.is_empty())
		"veteran": return g.pool.any(func(c): return c.level >= 10)
		"grandmaster": return g.pool.any(func(c): return c.level >= DB.characters.MAX_LEVEL)
		"interrupter": return g.ever_interrupted
		"ability-user": return g.ever_used_ability
		"valor-user": return g.ever_used_valor
		"loot-split": return g.ever_assigned_loot
	return false


static func _cleared_all(g, ids: Array) -> bool:
	return ids.all(func(i): return g.defeated.has(i))


static func achievement(g, id: String) -> bool:
	match id:
		"ach-outskirts": return _cleared_all(g, ["wastes", "road", "groblot"])
		"ach-icefrontier": return _cleared_all(g, ["frostpass", "wolfrifts", "icepeaks"])
		"ach-ashlands": return _cleared_all(g, ["charfields", "parishruins", "ashen"])
		"ach-debtprovince": return _cleared_all(g, ["mortgagedfarms", "debtorsjail", "mines"])
		"ach-shadowguild": return _cleared_all(g, ["blackmarket", "smugglercatacombs", "nightsyndicate"])
		"ach-forgottenlegion": return _cleared_all(g, ["unmarkedgraves", "desertersfort", "deadlegion"])
		"ach-dragonwastes": return _cleared_all(g, ["burntcliffs", "wyvernlair", "ancientpeak"])
		"ach-hierarchy": return _cleared_all(g, ["shareholderfloor", "councilantechamber", "boardroom"])
		"ach-craftsman": return g.ever_crafted
		"ach-master-profession": return g.pool.any(func(c): return c.professionLevel >= DB.professions.PROFESSION_MAX_LEVEL)
		"ach-curios": return g.curios_owned.size() >= DB.curios.size()
		"ach-arena-legend": return g.arena_rating >= 1500
		"ach-full-set": return g.pool.any(func(c): return g.set_bonuses_for(c).any(func(s): return s.count >= 3))
		"ach-five-max-level": return g.pool.filter(func(c): return c.level >= DB.characters.MAX_LEVEL).size() >= 5
	return false
