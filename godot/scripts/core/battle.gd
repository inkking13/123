class_name Battle
extends RefCounted
## One fight on the shared 7×6 grid, ported from the Expo game's GameEngine:
## heroes walk then act, the boss (or a room's brute, archer and shaman)
## answers with telegraphed moves, valor, classes, signatures and auto-battle.
## `sim` is a Dictionary the battlefield and the HUD read every frame.

const GRID_ROWS := 6
const GRID_COLS := 7
const BACK_ROW := GRID_ROWS - 1
const MOVE_RANGE := 2
const BOSS_W := 3
const BOSS_H := 2
const FOE_SPEED := {"boss": 1, "brute": 2, "archer": 1, "shaman": 1}
const ATTACK_TURN_SCALE := 6
const HEAL_TURN_SCALE := 6
const VALOR_MAX := 5
const VALOR_START := 1

const STAGGER_MAX := 100
const STAGGER_ATTACK := 5
const STAGGER_FRONT_MELEE := 3
const STAGGER_CRIT := 5
const STAGGER_NUKE := 10
const STAGGER_DECAY := 5
const VALOR_STRIKE_MULT := 2.2
const VALOR_GUARD_MULT := 0.6
const VALOR_MEND_MULT := 0.55
const PALADIN_AURA_MULT := 0.85
const PRIEST_HEAL_MULT := 1.15
const MAGE_SPLASH := 0.35
const NECRO_DRAIN := 0.3
const ROGUE_FLANK_MULT := 1.4
const HUNTER_RANGE_MULT := 1.25
const VALOR_FX := {"warrior": "strike", "rogue": "strike", "hunter": "strike", "necromancer": "strike", "mage": "spell", "paladin": "shout", "priest": "heal", "druid": "heal"}
const VULNERABLE_ROUNDS := 2
const VULNERABLE_MULT := 1.5
const ENRAGE_ROUND_BOSS := 14
const ENRAGE_ROUND_ROOM := 10
const ENRAGE_STEP := 0.12
const POISONED_BOSS_MULT := 1.15
const FORMATION_BONUS := 0.08
const INSPIRED_ROUNDS := 2
const INSPIRED_HEAL_MULT := 1.3
const TANK_GUARD_MULT := 0.85
const DEFEND_MULT := 0.6
const ROOM_START := [Vector2i(1, 3), Vector2i(0, 1), Vector2i(0, 5)]
const BOSS_START := Vector2i(0, 2)
const ROOM_GROUPS := [["brute", "archer"], ["brute", "shaman"], ["brute", "archer", "shaman"]]
const ENEMY_HP_SHARE := {"archer": 0.28, "shaman": 0.25}
const ENEMY_NAME := {"brute": "Громила", "archer": "Стрелок", "shaman": "Шаман"}
const ENEMY_NAME_ACC := {"brute": "громилу", "archer": "стрелка", "shaman": "шамана"}
const ARCHER_DMG := 8
const VICTORY_SEC := 2.2
const SIG_COOLDOWN := {"devour": 4, "iceShell": 5, "feast": 0, "debt": 4, "backstab": 3, "execution": 5, "lava": 4, "quota": 5, "raise": 3}
const MINION_ID0 := 100
const MINION_MAX := 3
const MINION_PER_CAST := 2
const MINION_HP_SHARE := 0.07
const MINION_DMG := 10
const ICE_SHELL_MULT := 0.25
const FEAST_HEAL_SHARE := 0.004
const FEAST_THRESHOLD := 0.4
const LAVA_MAX_CELLS := 7
const WINDUP_SEC := 0.75
const GEAR_SLOT_COMP_HP := 0.1
const GEAR_SLOT_COMP_DMG := 0.2
const QUOTA_SHARE := 2.8
const SHAMAN_HEAL_SHARE := 0.07
const ROOM_GROUP_HP_MULT := 0.9
const BERSERK_TAKEN_MULT := 1.25
const BOSS_DMG_SCALE := 1.6
## The spellbook adds damage on top of the plain attack; foes grow to match.
const SPELLBOOK_HP_MULT := 1.25

var g  # Game
var sim = null
var result = null
var boss_intro = null
var _timer_token = 0
## The band being fought on the open map, or null.
var skirmish = null


func _init(game) -> void:
	g = game


static func room_group_roles(room_idx: int) -> Array:
	return ROOM_GROUPS[mini(room_idx, ROOM_GROUPS.size() - 1)]


# ── timers: one pending step at a time ──────────────────────────────────────
func clear_timer() -> void:
	_timer_token += 1


func _after(sec: float, fn: Callable) -> void:
	_timer_token += 1
	var token = _timer_token
	g.get_tree().create_timer(g.pace(sec)).timeout.connect(func():
		if token == _timer_token: fn.call())


func _schedule_advance(sec: float) -> void:
	_after(sec, func():
		advance_turn()
		g.notify())


func log_line(text: String, kind := "") -> void:
	if sim == null: return
	sim.log.append({"text": text, "kind": kind})
	while sim.log.size() > 3: sim.log.pop_front()


# ── setup ───────────────────────────────────────────────────────────────────
func make_ability(cid: int, cd_mult: float) -> Dictionary:
	var d = DB.ability(cid)
	return {"kind": d.kind, "icon": d.icon, "cd": 0, "cdMax": maxi(1, int(round(d.cdMax * cd_mult))), "active": false, "activeRounds": 0, "activeMax": d.activeMax}


func make_raiders(squad: Array) -> Array:
	var ids = squad.map(func(c): return c.id)
	var out = []
	for i in squad.size():
		var d: Dictionary = squad[i]
		var gm: Dictionary = g.gear_mults(d); var tm: Dictionary = g.talent_mults(d); var cm: Dictionary = g.class_mults(d)
		var pm: Dictionary = g.profession_mults(d); var sm: Dictionary = g.set_bonus_mults(d)
		var lvl = 1.0 + (d.level - 1) * 0.02
		var max_hp = int(round(d.hp * gm.hpMult * tm.hpMult * cm.hpMult * pm.hpMult * sm.hpMult * lvl))
		var hr: float = 1.0 if g.in_arena else g.hr_mult(d.id, ids)
		var tb: Dictionary = g.talent_bonus(d)
		var rd: Dictionary = DB.resource_of(d.heroClass)
		var spells = g.known_spells(d).map(func(sd): return {"id": sd.id, "cd": 0, "cdMax": maxi(0, int(sd.cd) - int(tb.cdr.get(sd.id, 0)))})
		out.append({
			"spec": d.spec, "power": float(d.power), "spells": spells, "buffs": [], "absorb": 0.0, "hots": [],
			"res": {"kind": DB.specs.CLASS_RESOURCE[d.heroClass], "val": float(rd.start), "start": float(rd.start), "max": float(rd.max),
				"regen": float(rd.regen + tb.regen), "onHit": float(rd.onHit), "onHurt": float(rd.onHurt)},
			"crit": 0.14 + tb.crit, "healMult": 1.0 + tb.heal, "costMult": maxf(0.5, 1.0 + tb.cost), "spellMult": tb.spell,
			"id": i, "name": d.name, "role": d.role, "heroClass": d.heroClass, "rageRound": 0, "regen": null,
			"attackRange": d.attackRange, "candidateId": d.id, "trait": d.trait, "level": d.level,
			"maxHp": max_hp, "hp": float(max_hp), "alive": true, "dps": float(d.dps), "healPower": float(d.get("healPower", 9) if d.get("healPower") != null else 9),
			"outputMult": gm.outputMult * tm.outputMult * cm.outputMult * pm.outputMult * sm.outputMult * g.morale_mult(d) * hr,
			"wardMult": gm.wardMult * tm.wardMult * cm.wardMult * pm.wardMult * sm.wardMult, "levelMult": lvl,
			"speed": {"dps": 12.0, "heal": 9.0, "tank": 6.0}[d.role] + (d.id % 5) * 0.1,
			"chainPartner": null, "defending": false, "ability": make_ability(d.id, gm.cdMult * tm.cdMult * pm.cdMult * sm.cdMult),
			"row": BACK_ROW, "col": i + 1,
		})
	return out


func _build_room_group(total_hp: int, room_idx: int) -> Array:
	var roles = room_group_roles(room_idx)
	var hps = []
	var rest = 0
	for r in roles:
		var h = 0 if r == "brute" else int(round(total_hp * ENEMY_HP_SHARE[r]))
		hps.append(h)
		rest += h
	hps[0] = total_hp - rest
	var out = []
	for i in roles.size():
		out.append({"id": i, "role": roles[i], "name": ENEMY_NAME[roles[i]], "maxHp": hps[i], "hp": float(hps[i]), "alive": true, "row": ROOM_START[i].x, "col": ROOM_START[i].y})
	return out


func slot_comp_mult(kind: String) -> float:
	var idx = maxi(0, DB.dungeon_index(g.dungeon_id) - 2)
	return 1.0 + (GEAR_SLOT_COMP_HP if kind == "hp" else GEAR_SLOT_COMP_DMG) * idx / float(DB.dungeon_list.size() - 3)


func fresh_sim(enc: Dictionary, keep, room_idx := 0) -> Dictionary:
	var raiders: Array = keep if keep != null else make_raiders(g.squad())
	if keep == null and g.from_world and not g.in_arena:
		for r in raiders: r.outputMult *= g.w.output_mult()
	var dmg_mult: float
	if g.in_arena: dmg_mult = g.arena_opponent.dmgMult if g.arena_opponent else 1.0
	else:
		var dm = g.current_dungeon().get("dmgMult")
		dmg_mult = (dm if dm != null else 1.0) * (g.weekly_dmg_mult if g.in_weekly else 1.0) * slot_comp_mult("dmg")
	var enc_hp = int(round(enc.hp * SPELLBOOK_HP_MULT * (1.0 if g.in_arena else slot_comp_mult("hp"))))
	for i in raiders.size():
		var r: Dictionary = raiders[i]
		r.chainPartner = null; r.defending = false; r.regen = null
		r.row = BACK_ROW; r.col = i + 1
		r.ability.active = false; r.ability.activeRounds = 0; r.ability.cd = 0
		r.res.val = r.res.start; r.buffs = []; r.absorb = 0.0; r.hots = []
		for sp in r.spells: sp.cd = 0
	var enemies: Array = _build_room_group(int(round(enc_hp * ROOM_GROUP_HP_MULT)), room_idx) if enc.type == "room" else []
	var total = 0.0
	for e in enemies: total += e.hp
	var sig = null
	if enc.type == "boss" and not g.in_arena: sig = g.current_dungeon().get("signature")
	return {
		"boss": {"name": enc.enemyName, "maxHp": int(total) if enemies.size() > 0 else enc_hp, "hp": total if enemies.size() > 0 else float(enc_hp)},
		"bossPos": null if enemies.size() > 0 else {"row": BOSS_START.x, "col": BOSS_START.y},
		"enemies": enemies, "minions": [], "focusId": enemies[0].id if enemies.size() > 0 else null,
		"fx": {"seq": 0, "actor": null, "kind": null, "crit": false, "targetEnemy": null, "targetRaider": null},
		"impact": {"seq": 0, "cells": [], "kind": null}, "shakeSeq": 0, "dodge": {"seq": 0, "ids": []}, "victory": false, "windup": false, "moveFx": null,
		"signature": sig, "sigTimer": 2, "iceShell": false, "debt": null, "execution": null, "quota": null, "lava": [],
		"name": enc.name, "raiders": raiders, "encounterType": enc.type, "dmgMult": dmg_mult,
		"round": 1, "order": [], "turnPos": -1, "awaitingPlayer": false, "movePhase": false, "bossCyclePos": 0,
		"bossMoveTimers": {"beam": 1, "meteor": 2, "poison": 3, "chain": 3, "brace": 3, "freeze": 2, "curse": 2, "cleave": 2},
		"pendingCast": null, "chain": null, "poison": null, "bossPoison": null, "partyWard": null, "braceCall": null,
		"frozen": null, "ashCurse": null, "danger": null,
		"stagger": 0.0, "stunned": false, "vulnerableRounds": 0, "inspiredRounds": 0,
		"enrageAt": ENRAGE_ROUND_BOSS if enc.type == "boss" else ENRAGE_ROUND_ROOM,
		"dots": [], "partyBuffs": [],
		"rallyCd": 0, "valor": VALOR_START, "valorSeq": 0, "tilt": 0.0, "phase": 1, "log": [], "over": false, "selected": null,
	}


func start_encounter() -> void:
	var enc: Dictionary = g.current_dungeon().encounters[g.enc_idx]
	var keep = null
	if sim and sim.raiders.any(func(r): return r.alive): keep = sim.raiders
	sim = fresh_sim(enc, keep, g.enc_idx)
	if g.enc_idx == 0: g.trip = {"maxRound": 0, "lost": false, "valorSpent": 0}
	log_line("Пул начался. Рейд-лидер, командуй!" if enc.type == "boss" else "Отряд входит в бой: %s — %s. Выберите цель, нажав на врага." % [enc.name, enc.enemyName.to_lower()])
	var hr = null if keep != null else g.hr_note()
	if hr: log_line(hr, "warn")
	g.screen = "combat"
	_begin_round()
	if enc.type == "boss": _open_boss_intro(enc.enemyName, g.current_dungeon().name, enc.desc)
	elif not sim.over: advance_turn()
	g.notify()


## A fight on the open map against a roaming band: one room's worth of foes,
## bolder at night, fought by a squad as tired and hungry as it is.
func start_skirmish(band: Dictionary) -> void:
	var base: Dictionary = g.current_dungeon().encounters[0]
	var enc = {"type": "room", "name": band.name, "enemyName": band.name, "hp": int(round(float(base.hp) * (0.6 + 0.15 * band.size)))}
	skirmish = band
	sim = fresh_sim(enc, null, randi() % 3)
	if g.w.is_night(): sim.dmgMult *= World.NIGHT_ENEMY_DMG
	var tired: float = g.w.output_mult()
	for r in sim.raiders: r.outputMult *= tired
	g.trip = {"maxRound": 0, "lost": false, "valorSpent": 0}
	log_line("%s преграждают путь%s! Выберите цель, нажав на врага." % [band.name, " под покровом ночи" if g.w.is_night() else ""])
	if tired < 1.0: log_line("Отряд %s — урон снижен." % ("голоден" if g.w.hungry else "устал"), "warn")
	g.screen = "combat"
	_begin_round()
	if not sim.over: advance_turn()
	g.notify()


func _open_boss_intro(name: String, place: String, line: String) -> void:
	boss_intro = {"name": name, "place": place, "line": line}
	_after(8.0 * g.settings.speed, end_boss_intro)


func end_boss_intro() -> void:
	if boss_intro == null: return
	boss_intro = null
	if sim and not sim.over and g.screen == "combat": advance_turn()
	g.notify()


# ── arena and the weekly challenge ─────────────────────────────────────────
func generate_arena_opponent() -> Dictionary:
	var raiders = make_raiders(g.squad())
	var total_dps = 0.0
	for r in raiders: total_dps += r.dps * r.outputMult * r.levelMult
	var factor = clampf(1.0 + (g.arena_rating - 1000) / 600.0, 0.6, 2.2)
	return {"name": DB.arena.ARENA_RIVALS.pick_random(), "hp": maxi(200, int(round(total_dps * 16 * factor))),
		"dmgMult": clampf(0.85 * factor, 0.55, 1.8), "goldReward": 25 + int(round(18 * factor)), "ratingWin": 22, "ratingLoss": 14}


func start_arena() -> void:
	if not g.squad_ready(): return
	if g.arena_opponent == null: g.arena_opponent = generate_arena_opponent()
	g.in_arena = true
	var opp: Dictionary = g.arena_opponent
	sim = fresh_sim({"type": "boss", "name": "Арена", "enemyName": opp.name, "hp": opp.hp, "desc": ""}, null)
	log_line("Отряд выходит на арену против %s." % opp.name)
	g.screen = "combat"
	_begin_round()
	if not sim.over: advance_turn()
	g.notify()


func _end_arena(win: bool) -> void:
	sim.over = true
	clear_timer()
	g.haptic(60 if win else 120)
	var opp: Dictionary = g.arena_opponent
	var gold_found = 0
	if win:
		g.arena_wins += 1
		g.arena_rating += opp.ratingWin
		gold_found = opp.goldReward
		g.gold += gold_found
		g.bump_daily("goldEarned", gold_found)
	else:
		g.arena_losses += 1
		g.arena_rating = maxi(600, g.arena_rating - opp.ratingLoss)
	result = {"win": win, "isBoss": true, "loot": [], "curioFound": null, "goldFound": gold_found, "reagentFound": null}
	g.screen = "results"
	g.notify()


func start_weekly() -> void:
	var cur = g.current_weekly()
	if cur == null or not g.squad_ready() or g.weekly_claimed: return
	g.in_weekly = true
	g.weekly_dmg_mult = cur.modifier.dmgMult
	g.dungeon_id = cur.dungeon.id
	var enc: Dictionary = cur.encounter.duplicate()
	enc.hp = int(round(enc.hp * cur.modifier.hpMult))
	sim = fresh_sim(enc, null)
	log_line("Отряд выходит на испытание недели: %s (%s)." % [cur.dungeon.name, cur.modifier.name])
	g.screen = "combat"
	_begin_round()
	_open_boss_intro(cur.encounter.enemyName, "Испытание недели · " + cur.modifier.name, cur.encounter.desc)
	g.notify()


func _boss_loot(count: int) -> Array:
	var table: Array = DB.gear.BOSS_LOOT_TABLE.duplicate()
	table.shuffle()
	return table.slice(0, count).map(func(dr): return _loot_item(dr))


func _loot_item(dr: Dictionary) -> Dictionary:
	var o = DB.gear_in(dr.slot, dr.gearId)
	return {"slot": dr.slot, "gearId": dr.gearId, "name": o.get("name", dr.gearId), "assigned": null}


func _end_weekly(win: bool) -> void:
	sim.over = true
	clear_timer()
	g.haptic(60 if win else 120)
	var cur = g.current_weekly()
	var loot = []
	var curio = null
	var gold_found = 0
	var reagent = null
	if win and cur:
		for r in sim.raiders: g.gain_xp(r.candidateId, 40)
		g.weekly_claimed = true
		g.stats_boss_wins += 1
		g.bump_daily("bossWin")
		gold_found = int(round((70 + randi() % 41) * cur.modifier.goldMult))
		var rdef = DB.reagents.REAGENT_BY_LOCATION.get(cur.dungeon.locationId)
		if rdef:
			var qty: int = 2 + randi() % 2 + cur.modifier.bonusReagentQty
			g.reagent_counts[rdef.id] = g.reagent_owned(rdef.id) + qty
			reagent = {"name": rdef.name, "icon": rdef.icon, "qty": qty}
		curio = g.roll_curio(1.0 if cur.modifier.guaranteedCurio else 0.6)
		loot = _boss_loot(1 + randi() % 2 + (1 if cur.modifier.extraLootRoll else 0))
	else:
		g.stats_wipes += 1
	g.gold += gold_found
	if gold_found > 0: g.bump_daily("goldEarned", gold_found)
	result = {"win": win, "isBoss": true, "loot": loot, "curioFound": curio, "goldFound": gold_found, "reagentFound": reagent}
	g.screen = "results"
	g.notify()


# ── auto-battle ─────────────────────────────────────────────────────────────
func schedule_auto() -> void:
	_after(0.42, _auto_step)


func _auto_step() -> void:
	var r = current_raider()
	if sim == null or sim.over or r == null or not sim.awaitingPlayer or not g.settings.auto: return
	if sim.movePhase:
		_auto_place(r)
		_after(0.38, _auto_step)
		return
	var act = _auto_action(r)
	raider_action(act[0], act[1])


func _auto_focus() -> void:
	if sim.enemies.is_empty(): return
	for role in ["shaman", "archer", "brute"]:
		for e in sim.enemies:
			if e.role == role and e.alive:
				sim.focusId = e.id
				return


func _auto_place(r: Dictionary) -> void:
	_auto_focus()
	var rects = foe_rects()
	if rects.is_empty():
		skip_move()
		return
	var focus: Dictionary = rects[0]
	var lead: Dictionary = rects[0]
	if not sim.enemies.is_empty():
		for f in rects:
			if f.id == sim.focusId: focus = f
		lead = focus
		for f in rects:
			for e in sim.enemies:
				if e.id == f.id and e.role == "brute": lead = f
	var cells = reachable_cells()
	cells.append({"row": r.row, "col": r.col})
	var danger: Array = sim.danger.cells if sim.danger else []
	var melee: bool = r.attackRange == "melee"
	var allies: Array = sim.raiders.filter(func(x): return x.alive and x.id != r.id)
	var best: Dictionary = cells.back()
	var best_score = -1e9
	for c in cells:
		var sc = 0.0
		var key = "%d,%d" % [c.row, c.col]
		if key in danger: sc -= 30 if r.role == "tank" and sim.danger.kind == "cleave" else 100
		if key in sim.lava: sc -= 40
		if melee:
			var d = rect_dist(c.row, c.col, focus)
			var any_adj = rects.any(func(f): return rect_dist(c.row, c.col, f) <= 1)
			sc += 50 if d <= 1 else (35 - d if any_adj else -8 * d)
			if r.role == "tank" and rect_dist(c.row, c.col, lead) <= 1: sc += 12
			if any_adj: sc += 3 * allies.filter(func(x): return x.attackRange == "melee" and maxi(absi(x.row - c.row), absi(x.col - c.col)) == 1).size()
		else:
			var md = 99
			for f in rects: md = mini(md, rect_dist(c.row, c.col, f))
			sc += mini(md, 4) * 6
		if c.row == r.row and c.col == r.col: sc += 1
		if sc > best_score:
			best_score = sc
			best = c
	if best.row == r.row and best.col == r.col: skip_move()
	else: move_raider(best.row, best.col)


func _auto_action(r: Dictionary) -> Array:
	_auto_focus()
	var acts = turn_actions()
	var has = func(k): return acts.any(func(a): return a.key == k and not a.disabled)
	var alive_r = alive()
	var lowest: Dictionary = alive_r[0]
	for x in alive_r:
		if x.hp / x.maxHp < lowest.hp / lowest.maxHp: lowest = x
	var weakest = func():
		var ts = heal_targets()
		ts.sort_custom(func(a, b): return a.hpPct < b.hpPct)
		return ts[0] if not ts.is_empty() else null
	if has.call("interrupt"): return ["interrupt", null]
	if has.call("breakChain"): return ["breakChain", null]
	if has.call("breakShell") and r.role != "heal": return ["breakShell", null]
	if sim.execution:
		var t = _raider(sim.execution.targetId)
		if t and t.hp < t.maxHp * 0.6:
			if r.role == "heal" and has.call("heal") and t.id != r.id: return ["heal", t.id]
			if t.id == r.id and has.call("defend"): return ["defend", null]
	if has.call("breakIce") and r.role != "heal": return ["breakIce", null]
	if has.call("brace") and sim.braceCall and sim.braceCall.braced.size() < 3: return ["brace", null]
	if has.call("rally") and (sim.tilt >= 40 or (sim.ashCurse and sim.ashCurse.stacks >= 2)): return ["rally", null]
	if has.call("valor"):
		var hurt_count = alive_r.filter(func(x): return x.hp / x.maxHp < 0.7).size()
		var want = false
		match r.heroClass:
			"paladin": want = sim.windup or sim.danger != null or lowest.hp / lowest.maxHp < 0.5
			"priest", "druid": want = hurt_count >= 2
			"mage": want = sim.enemies.filter(func(e): return e.alive).size() >= 2 or sim.valor >= 4
			_: want = sim.valor >= 4 or sim.vulnerableRounds > 0
		if want: return ["valor", null]
	var cast = _auto_spell(r, acts, alive_r, lowest)
	if cast != null: return cast
	if r.role == "heal" and has.call("heal") and lowest.hp / lowest.maxHp < 0.65:
		var t = weakest.call()
		if t: return ["heal", t.id]
	if has.call("ability"):
		var k: String = r.ability.kind
		if not (k in ["drainHeal", "volatileHeal"]) or lowest.hp / lowest.maxHp < 0.8: return ["ability", null]
	if has.call("attack"): return ["attack", null]
	if r.role == "heal" and has.call("heal"):
		var t = weakest.call()
		if t: return ["heal", t.id]
	if has.call("defend"): return ["defend", null]
	return ["attack", null]


## Auto-battle's pick from the spellbook, most urgent first; null to fall back
## to the plain moves.
func _auto_spell(r: Dictionary, acts: Array, alive_r: Array, lowest: Dictionary):
	var defs = []
	for a in acts:
		if a.key.begins_with("spell:") and not a.disabled: defs.append(DB.spell(r.heroClass, a.key.substr(6)))
	if defs.is_empty(): return null
	var low: float = lowest.hp / lowest.maxHp
	var mine: float = r.hp / r.maxHp
	var hurt_n = alive_r.filter(func(x): return x.hp / x.maxHp < 0.7).size()
	var foes = sim.enemies.filter(func(e): return e.alive).size() + sim.minions.filter(func(m): return m.alive).size()
	var threat: bool = sim.windup or sim.danger != null or sim.execution != null
	var go = func(d: Dictionary, t = null): return ["spell:" + d.id, t]
	var with_key = func(k: String) -> Array: return defs.filter(func(d): return d.eff.has(k))
	for d in with_key.call("buff"):
		var taken: float = float(d.eff.buff.get("taken", 1.0))
		if taken < 1.0 and d.target == "self" and (mine < 0.45 or (r.role == "tank" and threat)): return go.call(d)
		if taken < 1.0 and d.target == "ally" and low < 0.35: return go.call(d, lowest.id)
	for d in with_key.call("healPct"):
		if low < 0.25: return go.call(d, lowest.id)
	for d in with_key.call("partyHeal") + with_key.call("partyHot"):
		if hurt_n >= 3 or (hurt_n >= 2 and low < 0.45): return go.call(d)
	if low < 0.7:
		var best = null
		for d in with_key.call("heal"):
			if best == null or float(d.eff.heal) > float(best.eff.heal): best = d
		if best != null: return go.call(best, lowest.id)
		for d in with_key.call("shield"):
			if lowest.absorb <= 0: return go.call(d, lowest.id)
		for d in with_key.call("hot"):
			if lowest.hots.is_empty(): return go.call(d, lowest.id)
	for d in with_key.call("selfHealPct"):
		if mine < 0.5: return go.call(d)
	for d in with_key.call("gain"):
		if r.res.val < 30 and not d.eff.has("buff"): return go.call(d)
	for d in with_key.call("partyBuff"):
		var pb: Dictionary = d.eff.partyBuff
		if pb.has("taken") and threat: return go.call(d)
		if pb.has("dmg") and sim.partyBuffs.is_empty(): return go.call(d)
	for d in with_key.call("buff"):
		if d.target == "self" and (d.eff.buff.has("dmg") or d.eff.buff.has("crit")) and r.buffs.is_empty() and r.role != "heal": return go.call(d)
	if foes >= 2:
		var best = null
		for d in with_key.call("aoe"):
			if best == null or float(d.eff.aoe) > float(best.eff.aoe): best = d
		if best != null: return go.call(best)
	for d in with_key.call("dot"):
		if not d.eff.has("dmg") and not d.eff.has("aoe") and not sim.dots.any(func(x): return x.name == d.name): return go.call(d)
	if r.role == "heal" and low < 0.85:
		for d in with_key.call("shield"):
			if lowest.absorb <= 0: return go.call(d, lowest.id)
		for d in with_key.call("hot"):
			if lowest.hots.is_empty(): return go.call(d, lowest.id)
	var strike = null
	for d in with_key.call("dmg"):
		if d.eff.get("interrupt", false) and not sim.pendingCast: continue
		if strike == null or float(d.eff.dmg) > float(strike.eff.dmg): strike = d
	if strike != null: return go.call(strike)
	return null


# ── rounds and turns ────────────────────────────────────────────────────────
func _raider(id) -> Variant:
	for r in sim.raiders:
		if r.id == id: return r
	return null


func _build_order() -> Array:
	var entries = []
	for r in sim.raiders:
		if r.alive: entries.append({"entry": {"kind": "raider", "id": r.id}, "speed": r.speed})
	if sim.boss.hp > 0: entries.append({"entry": {"kind": "boss"}, "speed": 10.0})
	entries.sort_custom(func(a, b): return a.speed > b.speed)
	return entries.map(func(e): return e.entry)


func _begin_round() -> void:
	var s: Dictionary = sim
	s.order = _build_order()
	s.turnPos = -1
	if s.round > 1: gain_valor(1)
	for r in alive():
		if r.regen:
			r.hp = minf(r.maxHp, r.hp + r.regen.amt)
			r.regen.rounds -= 1
			if r.regen.rounds <= 0: r.regen = null
	s.rallyCd = maxi(0, s.rallyCd - 1)
	for pb in s.partyBuffs: pb.rounds -= 1
	s.partyBuffs = s.partyBuffs.filter(func(pb): return pb.rounds > 0)
	for r in alive():
		for h in r.hots:
			r.hp = minf(r.maxHp, r.hp + h.amt)
			h.rounds -= 1
		r.hots = r.hots.filter(func(h): return h.rounds > 0)
	_tick_dots()
	if s.partyWard:
		s.partyWard.roundsLeft -= 1
		if s.partyWard.roundsLeft <= 0: s.partyWard = null
	if s.inspiredRounds > 0: s.inspiredRounds -= 1
	if s.signature == "feast" and s.boss.hp > 0 and alive().any(func(r): return r.hp < r.maxHp * FEAST_THRESHOLD):
		var amt = minf(s.boss.maxHp - s.boss.hp, round(s.boss.maxHp * FEAST_HEAL_SHARE))
		if amt > 0:
			s.boss.hp += amt
			log_line("%s питается ранами отряда (+%d)." % [s.boss.name, amt], "warn")
	if not s.lava.is_empty():
		var burned = alive().filter(func(r): return ("%d,%d" % [r.row, r.col]) in s.lava)
		var dmg = int(round(7 * boss_dmg_mult(true)))
		for r in burned: hurt(r, dmg)
		if not burned.is_empty(): log_line("Лава жжёт: %s (-%d)." % [", ".join(burned.map(func(r): return r.name)), dmg], "warn")
	if s.vulnerableRounds > 0:
		s.vulnerableRounds -= 1
		if s.vulnerableRounds == 0: log_line("Враги приходят в себя." if not s.enemies.is_empty() else s.boss.name + " приходит в себя.", "warn")
	if s.round == s.enrageAt:
		g.haptic(80)
		log_line("Враги звереют — с каждым раундом бьют всё сильнее!" if not s.enemies.is_empty() else s.boss.name + " впадает в ярость — с каждым раундом бьёт всё сильнее!", "warn")
	if s.phase >= 3 and not alive().is_empty():
		var dmg = int(round(10 * boss_dmg_mult()))
		for r in alive(): hurt(r, dmg)
		log_line("Раскалённая аура обжигает весь рейд (-%d)." % dmg, "warn")
	if s.chain:
		var a = _raider(s.chain.aId); var b = _raider(s.chain.bId)
		if a and b and a.alive and b.alive:
			var dmg = int(round(22 * boss_dmg_mult()))
			hurt(a, dmg); hurt(b, dmg); add_tilt(6)
			log_line("Цепь бьёт током — %s и %s страдают (-%d)." % [a.name, b.name, dmg], "warn")
			s.chain.roundsLeft -= 1
			if s.chain.roundsLeft <= 0:
				a.chainPartner = null; b.chainPartner = null; s.chain = null
		else:
			if a: a.chainPartner = null
			if b: b.chainPartner = null
			s.chain = null
	if s.bossPoison:
		var carrier = null
		if s.bossPoison.enemyId != null:
			for e in s.enemies:
				if e.id == s.bossPoison.enemyId and e.alive: carrier = e
		if s.bossPoison.enemyId != null and carrier == null:
			s.bossPoison = null
		else:
			var dmg = int(round(s.bossPoison.dmgPerTick))
			_damage_foe(dmg, carrier.id if carrier else null)
			log_line("Яд василиска продолжает разъедать %s (-%d)." % [ENEMY_NAME_ACC[carrier.role] if carrier else "босса", dmg], "ok")
			s.bossPoison.roundsLeft -= 1
			if s.bossPoison.roundsLeft <= 0: s.bossPoison = null
	_check_deaths()
	_check_outcome()


func advance_turn() -> void:
	var s = sim
	if s == null or s.over: return
	s.awaitingPlayer = false
	s.turnPos += 1
	if s.turnPos >= s.order.size():
		s.round += 1
		_begin_round()
		if s.over: return
		s.turnPos = 0
		if s.order.is_empty(): return
	var entry: Dictionary = s.order[s.turnPos]
	if entry.kind == "raider":
		var r = _raider(entry.id)
		if r == null or not r.alive:
			advance_turn()
			return
		_tick_ability(r)
		if s.poison and s.poison.targetId == r.id:
			var dmg = int(round(s.poison.dmgPerTick))
			hurt(r, dmg)
			log_line("%s страдает от яда (-%d)." % [r.name, dmg], "warn")
			s.poison.roundsLeft -= 1
			if s.poison.roundsLeft <= 0: s.poison = null
			_check_deaths()
			if _check_outcome(): return
			if not r.alive:
				advance_turn()
				return
		if s.frozen and s.frozen.targetId == r.id:
			s.frozen.roundsLeft -= 1
			if s.frozen.roundsLeft <= 0:
				log_line("Лёд, сковывавший %s, трескается сам собой — оттепель." % r.name, "ok")
				s.frozen = null
			else:
				log_line("%s скован(а) льдом и пропускает ход." % r.name, "warn")
			advance_turn()
			return
		s.selected = r.id
		s.awaitingPlayer = true
		s.movePhase = true
		if g.settings.auto: schedule_auto()
	elif _heavy_blow_pending():
		s.windup = true
		_after(WINDUP_SEC, func():
			_resolve_boss_turn()
			g.notify())
	else:
		_resolve_boss_turn()


func _heavy_blow_pending() -> bool:
	return sim.danger != null or sim.pendingCast != null or sim.execution != null or sim.braceCall != null


func _resolve_boss_turn() -> void:
	if sim == null or sim.over: return
	sim.windup = false
	_boss_turn()
	_check_deaths()
	if _check_outcome(): return
	_schedule_advance(0.9)


func _check_deaths() -> void:
	var s: Dictionary = sim
	for r in s.raiders:
		if r.alive and r.hp <= 0:
			r.alive = false; r.hp = 0.0
			if s.chain and (s.chain.aId == r.id or s.chain.bId == r.id):
				var other = _raider(s.chain.bId if s.chain.aId == r.id else s.chain.aId)
				if other: other.chainPartner = null
				s.chain = null
			r.chainPartner = null
			if s.poison and s.poison.targetId == r.id: s.poison = null
			if s.frozen and s.frozen.targetId == r.id: s.frozen = null
			if s.selected == r.id: s.selected = null
			add_tilt(20)
			g.haptic(90)
			log_line("%s погиб(ла)." % r.name, "warn")
			s.shakeSeq += 1


func _check_outcome() -> bool:
	var s: Dictionary = sim
	var dead = s.raiders.filter(func(r): return not r.alive).size()
	var tank = s.raiders.any(func(r): return r.role == "tank" and r.alive)
	if dead >= 3 or not tank:
		end_game(false)
		return true
	if s.boss.hp <= 0:
		s.over = true; s.victory = true
		clear_timer()
		g.notify()
		var me = s
		g.get_tree().create_timer(VICTORY_SEC).timeout.connect(func():
			if is_same(sim, me): end_game(true))
		return true
	return false


func _check_phase() -> void:
	var s: Dictionary = sim
	if s.encounterType != "boss": return
	if s.phase == 1 and s.boss.hp <= s.boss.maxHp * 0.5:
		s.phase = 2
		s.shakeSeq += 1
		g.haptic(80)
		log_line("Босс: «Вы недооцениваете меня!» Земля исходит ядом.", "warn")
	elif s.phase == 2 and s.boss.hp <= s.boss.maxHp * 0.25:
		s.phase = 3
		s.shakeSeq += 1
		g.haptic(80)
		log_line("Босс звереет! Раскалённая аура жжёт весь рейд.", "warn")


func alive() -> Array:
	return sim.raiders.filter(func(r): return r.alive)


func dps_mult() -> float:
	var t: float = sim.tilt
	return 0.55 if t >= 70 else (0.8 if t >= 40 else 1.0)


func heal_mult() -> float:
	var t: float = sim.tilt
	return 0.5 if t >= 70 else (0.75 if t >= 40 else 1.0)


func add_tilt(a: float) -> void:
	sim.tilt = clampf(sim.tilt + a, 0, 100)


func hurt(r: Dictionary, amount: float) -> void:
	var d = amount
	var s = sim
	if s and s.raiders.any(func(p): return p.alive and p.id != r.id and p.heroClass == "paladin" and maxi(absi(p.row - r.row), absi(p.col - r.col)) <= 1): d *= PALADIN_AURA_MULT
	if s and r.heroClass == "warrior" and r.rageRound != s.round and amount > 0:
		r.rageRound = s.round
		gain_valor(1)
	if r.ability.kind == "selfShield" and r.ability.active: d *= 0.5
	if s and s.partyWard: d *= s.partyWard.mult
	if s and s.ashCurse: d *= 1 + 0.15 * s.ashCurse.stacks
	if r.role == "tank" and engaged(r): d *= TANK_GUARD_MULT
	if r.defending: d *= DEFEND_MULT
	if r.ability.kind == "berserk" and r.ability.active: d *= BERSERK_TAKEN_MULT
	d *= r.wardMult
	for b in r.buffs: d *= float(b.get("taken", 1.0))
	if s:
		for pb in s.partyBuffs: d *= float(pb.get("taken", 1.0))
	if r.absorb > 0 and d > 0:
		var soak = minf(r.absorb, d)
		r.absorb -= soak; d -= soak
	if amount > 0: _gain_res(r, r.res.onHurt)
	r.hp -= d


func out_mult(r: Dictionary) -> float:
	var m = 1.0
	if r.trait == "legend": m *= 1.2
	if r.trait == "egoist": m *= 0.85
	if r.trait == "novice": m *= 0.7 + 0.3 * (mini(4, sim.round) / 4.0)
	return m * r.outputMult * r.levelMult


func enrage_mult() -> float:
	return 1.0 + ENRAGE_STEP * maxi(0, sim.round - sim.enrageAt + 1)


func boss_dmg_mult(avoidable := false) -> float:
	return sim.dmgMult * enrage_mult() * (1.0 if avoidable else BOSS_DMG_SCALE)


func _tick_ability(r: Dictionary) -> void:
	r.defending = false
	r.res.val = minf(r.res.max, r.res.val + r.res.regen)
	for sp in r.spells: sp.cd = maxi(0, sp.cd - 1)
	for b in r.buffs: b.rounds -= 1
	r.buffs = r.buffs.filter(func(b): return b.rounds > 0)
	var a: Dictionary = r.ability
	if a.cd > 0: a.cd -= 1
	if a.active:
		a.activeRounds -= 1
		if a.activeRounds <= 0:
			a.active = false; a.activeRounds = 0


func _front_allies(r: Dictionary) -> int:
	if r.attackRange != "melee" or not engaged(r): return 0
	return mini(2, alive().filter(func(x): return x.id != r.id and x.attackRange == "melee" and engaged(x) and absi(x.row - r.row) + absi(x.col - r.col) == 1).size())


# ── positions on the field ──────────────────────────────────────────────────
func foe_rects() -> Array:
	if sim == null: return []
	var one = func(e): return {"id": e.id, "row": e.row, "col": e.col, "w": 1, "h": 1}
	if sim.enemies.is_empty():
		var out = []
		if sim.bossPos and sim.boss.hp > 0: out.append({"id": -1, "row": sim.bossPos.row, "col": sim.bossPos.col, "w": BOSS_W, "h": BOSS_H})
		for m in sim.minions:
			if m.alive: out.append(one.call(m))
		return out
	return sim.enemies.filter(func(e): return e.alive).map(one)


static func rect_dist(row: int, col: int, f: Dictionary) -> int:
	var dr = 0
	if row < f.row: dr = f.row - row
	elif row > f.row + f.h - 1: dr = row - (f.row + f.h - 1)
	var dc = 0
	if col < f.col: dc = f.col - col
	elif col > f.col + f.w - 1: dc = col - (f.col + f.w - 1)
	return maxi(dr, dc)


func foe_at(row: int, col: int, except = null) -> bool:
	return foe_rects().any(func(f): return f.id != except and rect_dist(row, col, f) == 0)


func adjacent_foes(r: Dictionary) -> Array:
	return foe_rects().filter(func(f): return rect_dist(r.row, r.col, f) <= 1)


func engaged(r: Dictionary) -> bool:
	return not adjacent_foes(r).is_empty()


func _leader_rect():
	if sim.enemies.is_empty():
		var rs = foe_rects()
		return rs[0] if not rs.is_empty() else null
	for e in sim.enemies:
		if e.role == "brute" and e.alive: return {"id": e.id, "row": e.row, "col": e.col, "w": 1, "h": 1}
	return null


func _step_foe(f: Dictionary, speed: int, score: Callable) -> Dictionary:
	var raider_cells = alive().map(func(r): return "%d,%d" % [r.row, r.col])
	var others = foe_rects().filter(func(o): return o.id != f.id)
	var best = {"row": f.row, "col": f.col}
	var best_score: float = score.call(f.row, f.col)
	for row in range(maxi(0, f.row - speed), mini(GRID_ROWS - f.h, f.row + speed) + 1):
		for col in range(maxi(0, f.col - speed), mini(GRID_COLS - f.w, f.col + speed) + 1):
			var free = true
			for dr in f.h:
				for dc in f.w:
					var cr: int = row + dr; var cc: int = col + dc
					if ("%d,%d" % [cr, cc]) in raider_cells or others.any(func(o): return rect_dist(cr, cc, o) == 0): free = false
			if not free: continue
			var sc: float = score.call(row, col) + 0.01 * maxi(absi(row - f.row), absi(col - f.col))
			if sc < best_score:
				best_score = sc
				best = {"row": row, "col": col}
	return best


func _advance_leader() -> void:
	var f = _leader_rect()
	if f == null: return
	var al = alive()
	if al.is_empty() or al.any(func(r): return rect_dist(r.row, r.col, f) <= 1): return
	var tanks = al.filter(func(r): return r.role == "tank")
	var pool_r: Array = tanks if not tanks.is_empty() else al
	var target: Dictionary = pool_r[0]
	for r in pool_r:
		if rect_dist(r.row, r.col, f) < rect_dist(target.row, target.col, f): target = r
	var speed: int = FOE_SPEED.brute if not sim.enemies.is_empty() else FOE_SPEED.boss
	var to = _step_foe(f, speed, func(row, col): return float(rect_dist(target.row, target.col, {"row": row, "col": col, "w": f.w, "h": f.h})))
	if to.row == f.row and to.col == f.col: return
	if sim.bossPos: sim.bossPos = to
	else:
		for e in sim.enemies:
			if e.id == f.id:
				e.row = to.row; e.col = to.col


func _reposition_skirmisher(e: Dictionary) -> void:
	var al = alive()
	if al.is_empty(): return
	var to = _step_foe({"id": e.id, "row": e.row, "col": e.col, "w": 1, "h": 1}, FOE_SPEED[e.role], func(row, col):
		var d = 99
		for r in al: d = mini(d, maxi(absi(r.row - row), absi(r.col - col)))
		return absf(d - 3) + row * 0.05)
	e.row = to.row; e.col = to.col


## Every hit on the enemy goes through here so combos, the stun window, the stagger meter and class traits apply.
func hit_boss(r: Dictionary, raw: float, stagger_gain: float) -> Dictionary:
	var s: Dictionary = sim
	var tags = []
	var m = 1.0
	if r.ability.kind == "berserk" and r.ability.active:
		m *= 2; tags.append("берсерк")
	var bm = _buff_mult(r, "dmg")
	if bm != 1.0:
		m *= bm; tags.append("усиление")
	var allies = _front_allies(r)
	if allies > 0:
		m *= 1 + FORMATION_BONUS * allies; tags.append("строй")
	var target = focus_enemy() if not s.enemies.is_empty() else attack_target(r)
	var on_minion: bool = s.enemies.is_empty() and target != null
	if s.bossPoison and (s.bossPoison.enemyId == null or (target and s.bossPoison.enemyId == target.id)):
		m *= POISONED_BOSS_MULT; tags.append("яд")
	if s.vulnerableRounds > 0:
		m *= VULNERABLE_MULT; tags.append("оглушён")
	if s.iceShell:
		m *= ICE_SHELL_MULT; tags.append("панцирь")
	var target_id: int = target.id if target else -1
	if r.heroClass == "rogue" and alive().any(func(x): return x.id != r.id and adjacent_foes(x).any(func(f): return f.id == target_id)):
		m *= ROGUE_FLANK_MULT; tags.append("фланг")
	if r.heroClass == "hunter" and not engaged(r):
		m *= HUNTER_RANGE_MULT; tags.append("дистанция")
	var dmg = maxi(1, int(round(raw * m)))
	var splash_at = Vector2i(target.row, target.col) if r.heroClass == "mage" and target and not s.enemies.is_empty() else null
	_damage_foe(dmg, target.id if target else null)
	if splash_at != null:
		var near = s.enemies.filter(func(e): return e.alive and e.id != target_id and maxi(absi(e.row - splash_at.x), absi(e.col - splash_at.y)) <= 1)
		for e in near: _damage_foe(maxi(1, int(round(dmg * MAGE_SPLASH))), e.id)
		if not near.is_empty(): tags.append("взрыв")
	if r.heroClass == "necromancer" and r.alive:
		r.hp = minf(r.maxHp, r.hp + round(dmg * NECRO_DRAIN)); tags.append("похищение")
	if s.debt and s.debt.targetId == r.id: s.debt.paid = true
	if s.quota: s.quota.dealt += dmg
	if target: tags.push_front("→ " + target.name)
	if not on_minion: _add_stagger(stagger_gain)
	_check_phase()
	return {"dmg": dmg, "note": (" (" + ", ".join(tags) + ")") if not tags.is_empty() else ""}


## Fills the stagger meter; full, it stuns the foes for a window of bonus damage.
func _add_stagger(gain: float) -> void:
	var s: Dictionary = sim
	if s.vulnerableRounds != 0 or s.stunned or gain <= 0 or s.boss.hp <= 0: return
	s.stagger = minf(STAGGER_MAX, s.stagger + gain)
	if s.stagger >= STAGGER_MAX:
		s.stagger = 0.0
		s.stunned = true
		s.vulnerableRounds = VULNERABLE_ROUNDS + 1
		gain_valor(1)
		g.haptic(80)
		log_line("Натиск смял строй врагов — они оглушены! Бейте, пока открыты." if not s.enemies.is_empty() else "Натиск сломил защиту — %s оглушён! Бейте, пока открыт." % s.boss.name, "ok")


func focus_enemy():
	if sim.enemies.is_empty():
		for m in sim.minions:
			if m.id == sim.focusId and m.alive: return m
		return null
	for e in sim.enemies:
		if e.id == sim.focusId and e.alive: return e
	for e in sim.enemies:
		if e.alive: return e
	return null


func attack_target(r: Dictionary):
	if sim.enemies.is_empty():
		var m = focus_enemy()
		if r.attackRange != "melee": return m
		var adj = adjacent_foes(r).map(func(f): return f.id)
		if m and m.id in adj: return m
		if -1 in adj: return null
		for x in sim.minions:
			if x.alive and x.id in adj: return x
		return null
	var focus = focus_enemy()
	if focus == null or r.attackRange != "melee": return focus
	var adj = adjacent_foes(r).map(func(f): return f.id)
	if focus.id in adj: return focus
	for e in sim.enemies:
		if e.alive and e.id in adj: return e
	return focus


func set_focus(enemy_id: int) -> void:
	if sim == null: return
	if sim.enemies.is_empty() and enemy_id < 0:
		sim.focusId = null
		g.notify()
		return
	var ok = false
	for e in sim.enemies + sim.minions:
		if e.id == enemy_id and e.alive: ok = true
	if not ok: return
	sim.focusId = enemy_id
	g.notify()


func _damage_foe(dmg: float, enemy_id) -> void:
	var s: Dictionary = sim
	if s.enemies.is_empty():
		if enemy_id != null and enemy_id >= MINION_ID0:
			for m in s.minions:
				if m.id == enemy_id and m.alive:
					m.hp = maxf(0, m.hp - dmg)
					if m.hp == 0:
						m.alive = false
						log_line("%s рассыпается грудой костей." % m.name, "ok")
						gain_valor(1)
						if s.focusId == m.id: s.focusId = null
					return
		s.boss.hp = maxf(0, s.boss.hp - dmg)
		if s.boss.hp == 0 and s.minions.any(func(x): return x.alive):
			for x in s.minions: x.alive = false
			log_line("Без хозяина поднятые скелеты рассыпаются.", "ok")
		return
	var e = null
	for x in s.enemies:
		if x.id == enemy_id and x.alive: e = x
	if e == null:
		for x in s.enemies:
			if x.alive and e == null: e = x
	if e == null: return
	e.hp = maxf(0, e.hp - dmg)
	if e.hp == 0:
		e.alive = false
		log_line("%s повержен." % e.name, "ok")
		gain_valor(2)
		if e.role == "brute" and (s.danger or s.pendingCast or s.braceCall):
			s.danger = null; s.pendingCast = null; s.braceCall = null
			log_line("Заготовленный удар громилы так и не состоялся.", "ok")
		if s.focusId == e.id:
			s.focusId = null
			for x in s.enemies:
				if x.alive and s.focusId == null: s.focusId = x.id
	_sync_group_hp()


func _sync_group_hp() -> void:
	var t = 0.0
	for e in sim.enemies:
		if e.alive: t += e.hp
	sim.boss.hp = t


func heal_target(healer: Dictionary):
	var injured = alive().filter(func(x): return x.id != healer.id and x.hp < x.maxHp)
	var not_ego = injured.filter(func(x): return x.trait != "egoist")
	var pool_h: Array = not_ego if not not_ego.is_empty() else injured
	var t = null
	for x in pool_h:
		if t == null or x.hp / x.maxHp < t.hp / t.maxHp: t = x
	if t == null and healer.hp < healer.maxHp: t = healer
	return t


# ── the player's turn ───────────────────────────────────────────────────────
func current_raider():
	if sim == null or not sim.awaitingPlayer or sim.turnPos < 0 or sim.turnPos >= sim.order.size(): return null
	var entry: Dictionary = sim.order[sim.turnPos]
	if entry.kind != "raider": return null
	return _raider(entry.id)


func reachable_cells() -> Array:
	var r = current_raider()
	if sim == null or r == null or not sim.movePhase: return []
	var occupied = sim.raiders.filter(func(x): return x.alive and x.id != r.id).map(func(x): return "%d,%d" % [x.row, x.col])
	var cells = []
	for row in GRID_ROWS:
		for col in GRID_COLS:
			if row == r.row and col == r.col: continue
			if maxi(absi(row - r.row), absi(col - r.col)) > MOVE_RANGE: continue
			if ("%d,%d" % [row, col]) in occupied or foe_at(row, col): continue
			cells.append({"row": row, "col": col})
	return cells


func move_raider(row: int, col: int) -> void:
	var r = current_raider()
	if sim == null or r == null or not sim.movePhase: return
	if not reachable_cells().any(func(c): return c.row == row and c.col == col): return
	var seq: int = sim.moveFx.seq + 1 if sim.moveFx else 1
	sim.moveFx = {"seq": seq, "id": r.id, "fromRow": r.row, "fromCol": r.col}
	r.row = row; r.col = col
	sim.movePhase = false
	log_line(r.name + (" вступает в ближний бой." if engaged(r) else " меняет позицию на поле."))
	g.notify()


func skip_move() -> void:
	if sim == null or not sim.movePhase: return
	sim.movePhase = false
	g.notify()


func turn_actions() -> Array:
	var r = current_raider()
	if sim == null or r == null: return []
	var s: Dictionary = sim
	var acts = []
	var act = func(key: String, label: String, extra := {}) -> void:
		var a = {"key": key, "label": label, "needsTarget": false, "disabled": false, "sub": null}
		a.merge(extra, true)
		acts.append(a)
	if s.pendingCast: act.call("interrupt", "Прервать (%s)" % s.pendingCast.targetName)
	if s.chain and (s.chain.aId == r.id or s.chain.bId == r.id): act.call("breakChain", "Разорвать цепь")
	if s.frozen and s.frozen.targetId != r.id: act.call("breakIce", "Расколоть лёд (%s)" % s.frozen.targetName)
	if s.braceCall and not s.braceCall.braced.has(r.id): act.call("brace", "Приготовиться")
	var in_range: bool = r.attackRange == "ranged" or engaged(r)
	var focus = attack_target(r)
	act.call("attack", "Атаковать", {"disabled": not in_range, "sub": "подойдите вплотную к врагу" if not in_range else ("цель: " + focus.name if focus else null)})
	if r.role == "heal": act.call("heal", "Лечить", {"needsTarget": true})
	var res_name: String = DB.specs.RESOURCES[r.res.kind].name
	for sp in r.spells:
		var sd = DB.spell(r.heroClass, sp.id)
		var cost = spell_cost(r, sd)
		var reach: bool = sd.target != "enemy" or sd.eff.get("ranged", false) or in_range
		var sub = null
		if sp.cd > 0: sub = "КД: %d" % sp.cd
		elif not reach: sub = "подойдите вплотную"
		elif cost > 0: sub = "%d %s" % [cost, res_name.to_lower()]
		act.call("spell:" + sp.id, sd.name, {"spellIcon": sd.icon, "disabled": sp.cd > 0 or r.res.val < cost or not reach,
			"needsTarget": sd.target == "ally", "sub": sub, "cost": cost, "desc": sd.desc, "short": r.res.val < cost and sp.cd == 0})
	var def = DB.ability(r.candidateId)
	act.call("ability", def.name, {"abilityIcon": def.icon, "abilityArt": DB.ability_art_path(r.candidateId), "disabled": r.ability.cd > 0,
		"sub": "КД: %d" % r.ability.cd if r.ability.cd > 0 else null})
	var hc = DB.hero_class(r.heroClass)
	var blow: bool = r.heroClass in ["warrior", "rogue", "necromancer"]
	act.call("valor", hc.valorName, {"valorCost": hc.valorCost, "classIcon": hc.icon, "disabled": s.valor < hc.valorCost or (blow and not in_range), "sub": hc.valorDesc})
	if s.iceShell: act.call("breakShell", "Расколоть панцирь")
	if s.rallyCd <= 0: act.call("rally", "Сплотить отряд")
	act.call("defend", "Оборона", {"sub": "−40% урона до след. хода"})
	return acts


func heal_targets(include_self := false) -> Array:
	var r = current_raider()
	if r == null: return []
	return alive().filter(func(x): return include_self or x.id != r.id).map(func(x): return {"id": x.id, "name": x.name, "hpPct": maxi(0, int(round(100 * x.hp / x.maxHp)))})


func raider_action(key: String, target_id = null) -> void:
	var s = sim
	var r = current_raider()
	if s == null or r == null or s.over: return
	s.awaitingPlayer = false
	if key == "valor" and s.valor < DB.hero_class(r.heroClass).valorCost:
		s.awaitingPlayer = true
		return
	var sd = {}
	if key.begins_with("spell:"):
		var sp = _spell_state(r, key.substr(6))
		sd = DB.spell(r.heroClass, key.substr(6))
		if sp == null or sd.is_empty() or sp.cd > 0 or r.res.val < spell_cost(r, sd):
			s.awaitingPlayer = true
			return
	var valor_kind = VALOR_FX[r.heroClass] if key == "valor" else null
	var strike: bool = key == "attack" or valor_kind == "strike" or (not sd.is_empty() and sd.eff.has("dmg"))
	var fx_kind = null
	if strike: fx_kind = "melee" if r.attackRange == "melee" and not sd.get("eff", {}).get("ranged", false) else "ranged"
	elif key == "heal" or valor_kind == "heal": fx_kind = "heal"
	elif key == "ability" or valor_kind == "spell": fx_kind = "ability"
	elif key == "rally" or valor_kind == "shout": fx_kind = "rally"
	if not sd.is_empty() and fx_kind == null:
		var e: Dictionary = sd.eff
		if e.has("aoe"): fx_kind = "ability"
		elif e.has("heal") or e.has("partyHeal") or e.has("hot") or e.has("partyHot") or e.has("shield") or e.has("healPct") or e.has("selfHealPct"): fx_kind = "heal"
		else: fx_kind = "rally"
	var aims: bool = strike or key == "ability" or (not sd.is_empty() and sd.eff.has("aoe"))
	if strike and r.attackRange == "melee":
		var t = attack_target(r)
		if t and t.id != s.focusId: s.focusId = t.id
		elif t == null and s.enemies.is_empty(): s.focusId = null
	var fe = focus_enemy()
	s.fx = {"seq": s.fx.seq + 1, "actor": r.id if fx_kind else null, "kind": fx_kind, "crit": false,
		"targetEnemy": (fe.id if fe else -1) if aims else null, "targetRaider": null}
	match key:
		"attack": _do_attack(r)
		"heal": _do_heal(r, target_id)
		"ability": _do_ability(r)
		"interrupt": _do_interrupt(r)
		"breakChain": _do_break_chain(r)
		"breakIce":
			if s.frozen:
				var n: String = s.frozen.targetName
				s.frozen = null
				log_line("%s раскалывает лёд, освобождая %s." % [r.name, n], "ok")
		"brace":
			if s.braceCall:
				s.braceCall.braced[r.id] = true
				log_line("%s готовится принять удар." % r.name, "ok")
		"rally": _do_rally(r)
		"breakShell":
			s.iceShell = false
			log_line("%s раскалывает ледяной панцирь!" % r.name, "ok")
		"defend":
			r.defending = true
			log_line("%s уходит в оборону." % r.name)
		"valor": _do_valor(r)
		_:
			if not sd.is_empty(): _cast(r, sd, target_id)
	_check_deaths()
	g.notify()
	if not _check_outcome(): _schedule_advance(0.65)


func gain_valor(n: int) -> void:
	var next = mini(VALOR_MAX, sim.valor + n)
	if next > sim.valor:
		sim.valor = next
		sim.valorSeq += 1


func _do_attack(r: Dictionary) -> void:
	var crit = randf() < crit_chance(r)
	_gain_res(r, r.res.onHit)
	var raw: float = r.dps * out_mult(r) * dps_mult() * ATTACK_TURN_SCALE
	if crit: raw *= 1.8
	var front: bool = r.attackRange == "melee" and engaged(r)
	sim.fx.crit = crit
	var h = hit_boss(r, raw, STAGGER_ATTACK + (STAGGER_FRONT_MELEE if front else 0) + (STAGGER_CRIT if crit else 0))
	log_line(r.name + (" наносит критический удар: -" if crit else " атакует: -") + str(h.dmg) + h.note, "ok" if crit else "")
	if crit:
		gain_valor(1)
		g.haptic(30)


func _blow(r: Dictionary, mult: float, crit: bool) -> Dictionary:
	var raw: float = r.dps * out_mult(r) * dps_mult() * ATTACK_TURN_SCALE * mult
	var front: bool = r.attackRange == "melee" and engaged(r)
	sim.fx.crit = crit
	return hit_boss(r, raw, STAGGER_ATTACK + (STAGGER_CRIT if crit else 0) + (STAGGER_FRONT_MELEE if front else 0))


func _do_valor(r: Dictionary) -> void:
	var s: Dictionary = sim
	var hc = DB.hero_class(r.heroClass)
	s.valor -= hc.valorCost
	g.trip.valorSpent += hc.valorCost
	g.ever_used_valor = true
	var heal_power: float = r.healPower * out_mult(r) * heal_mult() * HEAL_TURN_SCALE
	match r.heroClass:
		"warrior":
			var h = _blow(r, VALOR_STRIKE_MULT, true)
			if s.vulnerableRounds == 0 and not s.stunned: s.stagger = minf(STAGGER_MAX - 1, s.stagger + 15)
			log_line("%s обрушивает сокрушительный удар: -%d%s" % [r.name, h.dmg, h.note], "ok")
		"hunter":
			var h = _blow(r, VALOR_STRIKE_MULT, true)
			log_line("%s выцеливает и бьёт наверняка: -%d%s" % [r.name, h.dmg, h.note], "ok")
		"rogue":
			var t = attack_target(r)
			var pct: float = t.hp / t.maxHp if t else s.boss.hp / s.boss.maxHp
			var fin = pct < 0.3
			var h = _blow(r, 3.5 if fin else 2.4, fin)
			log_line("%s %s: -%d%s" % [r.name, "добивает смертельным ударом" if fin else "наносит смертельный удар", h.dmg, h.note], "ok")
		"necromancer":
			var h = _blow(r, 2.0, false)
			var al = alive()
			var t: Dictionary = al[0]
			for x in al:
				if x.hp / x.maxHp < t.hp / t.maxHp: t = x
			t.hp = minf(t.maxHp, t.hp + round(h.dmg / 2.0))
			s.fx.targetRaider = t.id
			log_line("%s собирает жатву душ: -%d%s, %s +%d" % [r.name, h.dmg, h.note, t.name, int(round(h.dmg / 2.0))], "ok")
		"mage":
			var raw: float = r.dps * out_mult(r) * dps_mult() * ATTACK_TURN_SCALE * 1.3
			var foes = s.enemies.filter(func(e): return e.alive)
			if not foes.is_empty():
				for e in foes: _damage_foe(round(raw), e.id)
				log_line("%s призывает огненный шторм: по %d каждому врагу." % [r.name, int(round(raw))], "ok")
			else:
				for m in s.minions.filter(func(x): return x.alive): _damage_foe(round(raw * 0.6), m.id)
				var h = hit_boss(r, raw * 1.4, STAGGER_NUKE)
				log_line("%s обрушивает огненный шторм: -%d%s" % [r.name, h.dmg, h.note], "ok")
		"paladin":
			s.partyWard = {"roundsLeft": 2, "mult": minf(s.partyWard.mult if s.partyWard else 1.0, VALOR_GUARD_MULT)}
			r.defending = true
			log_line("%s поднимает божественный щит над отрядом — урон по всем снижен." % r.name, "ok")
		"priest":
			var amt = maxi(1, int(round(heal_power * VALOR_MEND_MULT * PRIEST_HEAL_MULT)))
			for x in alive(): x.hp = minf(x.maxHp, x.hp + amt)
			s.poison = null
			s.fx.targetRaider = r.id
			log_line("%s читает молитву исцеления: +%d каждому." % [r.name, amt], "ok")
		"druid":
			var amt = maxi(1, int(round(heal_power * 0.3)))
			for x in alive(): x.regen = {"amt": amt, "rounds": 3}
			s.fx.targetRaider = r.id
			log_line("%s: отряд прорастает живой силой — +%d каждому в начале трёх раундов." % [r.name, amt], "ok")
	g.haptic(60)
	_check_phase()


func _do_heal(r: Dictionary, target_id) -> void:
	var t = null
	if target_id != null:
		var x = _raider(target_id)
		if x and x.alive: t = x
	if t == null: t = heal_target(r)
	if t == null: t = r
	var inspired: bool = sim.inspiredRounds > 0
	var priest: bool = r.heroClass == "priest"
	var amt = maxi(1, int(round(heal_raw(r))))
	t.hp = minf(t.maxHp, t.hp + amt)
	sim.fx.targetRaider = t.id
	var notes = []
	if inspired: notes.append("воодушевление")
	if priest and sim.poison and sim.poison.targetId == t.id:
		sim.poison = null
		notes.append("яд снят")
	if r.heroClass == "druid":
		t.regen = {"amt": maxi(1, int(round(amt * 0.25))), "rounds": 2}
		notes.append("побеги")
	log_line("%s лечит %s: +%d%s" % [r.name, t.name, amt, (" (" + ", ".join(notes) + ")") if not notes.is_empty() else ""], "ok")


# ── the spellbook: resource, numbers, and casting any spell ─────────────────
func _gain_res(r: Dictionary, n: float) -> void:
	if n > 0: r.res.val = minf(r.res.max, r.res.val + n)


func spell_cost(r: Dictionary, sd: Dictionary) -> int:
	return int(round(float(sd.get("cost", 0)) * r.costMult))


func _spell_state(r: Dictionary, id: String):
	for sp in r.spells:
		if sp.id == id: return sp
	return null


## The product of one stat over a hero's own buffs and the party's.
func _buff_mult(r: Dictionary, key: String) -> float:
	var m = 1.0
	for b in r.buffs: m *= float(b.get(key, 1.0))
	if sim:
		for pb in sim.partyBuffs: m *= float(pb.get(key, 1.0))
	return m


func crit_chance(r: Dictionary) -> float:
	var c: float = r.crit
	for b in r.buffs: c += float(b.get("crit", 0.0))
	return minf(0.95, c)


## One turn's worth of healing from this hero: healers by their healing power,
## others by a quarter of their power.
func heal_raw(r: Dictionary) -> float:
	var base: float = float(r.healPower) if r.role == "heal" and r.healPower != null else r.power * 0.25
	var m: float = out_mult(r) * heal_mult() * HEAL_TURN_SCALE * r.healMult * _buff_mult(r, "dmg")
	if sim.inspiredRounds > 0: m *= INSPIRED_HEAL_MULT
	if r.heroClass == "priest": m *= PRIEST_HEAL_MULT
	return base * m


## One turn's worth of spell damage: healers cast from half their power.
func spell_raw(r: Dictionary) -> float:
	var base: float = r.power * 0.5 if r.role == "heal" else float(r.dps)
	return base * out_mult(r) * dps_mult() * ATTACK_TURN_SCALE


func _tick_dots() -> void:
	var s: Dictionary = sim
	var keep = []
	for d in s.dots:
		var alive_t = true
		if d.enemyId != null:
			alive_t = (s.enemies + s.minions).any(func(e): return e.id == d.enemyId and e.alive)
		elif s.boss.hp <= 0: alive_t = false
		if not alive_t: continue
		_damage_foe(d.dmg, d.enemyId)
		log_line("%s: -%d по %s." % [d.name, int(d.dmg), d.targetName], "ok")
		d.rounds -= 1
		if d.rounds > 0: keep.append(d)
	s.dots = keep
	_check_phase()


func _add_dot(sd: Dictionary, r: Dictionary, mult: float, rounds: int, target) -> void:
	var dmg = maxf(1, round(spell_raw(r) * mult * (1.0 + r.spellMult.get(sd.id, 0.0))))
	var id = target.id if target != null and (not sim.enemies.is_empty() or target.id >= MINION_ID0) else null
	sim.dots.append({"enemyId": id, "dmg": dmg, "rounds": rounds, "name": sd.name, "targetName": target.name if target != null else sim.boss.name})


func _ally(r: Dictionary, target_id):
	if target_id != null:
		var x = _raider(target_id)
		if x and x.alive: return x
	var t = heal_target(r)
	return t if t != null else r


## Casts any spell from the book: its numbers say what it does.
func _cast(r: Dictionary, sd: Dictionary, target_id) -> void:
	var s: Dictionary = sim
	var e: Dictionary = sd.eff
	var sp = _spell_state(r, sd.id)
	r.res.val -= spell_cost(r, sd)
	sp.cd = sp.cdMax
	var boost: float = 1.0 + float(r.spellMult.get(sd.id, 0.0))
	var notes = []
	g.ever_used_ability = true
	if e.get("interrupt", false) and s.pendingCast:
		s.pendingCast = null
		add_tilt(-5); gain_valor(1)
		g.ever_interrupted = true
		notes.append("каст сорван")
	if e.has("dmg"):
		var t = attack_target(r) if not s.enemies.is_empty() or r.attackRange == "melee" else focus_enemy()
		var m: float = float(e.dmg) * boost
		if e.has("execute"):
			var pct: float = t.hp / t.maxHp if t else s.boss.hp / s.boss.maxHp
			if pct < 0.3:
				m = float(e.execute) * boost; notes.append("казнь")
		if e.has("flank") and t and alive().any(func(x): return x.id != r.id and adjacent_foes(x).any(func(f): return f.id == t.id)):
			m = float(e.flank) * boost; notes.append("в спину")
		var crit = randf() < crit_chance(r)
		if crit:
			m *= 1.8; notes.append("крит"); gain_valor(1)
		s.fx.crit = crit
		var h = hit_boss(r, spell_raw(r) * m, STAGGER_ATTACK + float(e.get("stagger", 0)) + (STAGGER_CRIT if crit else 0))
		notes.append("-%d%s" % [h.dmg, h.note])
		if e.has("selfHeal"):
			var back = round(h.dmg * float(e.selfHeal))
			r.hp = minf(r.maxHp, r.hp + back); notes.append("+%d себе" % back)
		if t and (e.has("splash") or e.has("chain")) and not s.enemies.is_empty():
			var others = s.enemies.filter(func(x): return x.alive and x.id != t.id)
			if e.has("splash"): others = others.filter(func(x): return maxi(absi(x.row - t.row), absi(x.col - t.col)) <= 1)
			var part = float(e.get("splash", e.get("chain", 0.0)))
			for x in others.slice(0, 2): _damage_foe(maxi(1, int(round(h.dmg * part))), x.id)
		if e.has("dot"): _add_dot(sd, r, float(e.dot[0]), int(e.dot[1]), t)
		if e.has("healLowest"):
			var low: Dictionary = alive()[0]
			for x in alive():
				if x.hp / x.maxHp < low.hp / low.maxHp: low = x
			var amt = round(heal_raw(r) * float(e.healLowest) * boost)
			low.hp = minf(low.maxHp, low.hp + amt)
			notes.append("%s +%d" % [low.name, amt])
	elif e.has("dot") and not e.has("aoe"):
		var t = focus_enemy() if not s.enemies.is_empty() else attack_target(r)
		_add_dot(sd, r, float(e.dot[0]), int(e.dot[1]), t)
		notes.append("на %s" % (t.name if t else s.boss.name))
	if e.has("aoe"):
		var raw: float = spell_raw(r) * float(e.aoe) * boost
		var foes = s.enemies.filter(func(x): return x.alive)
		if not foes.is_empty():
			for x in foes:
				_damage_foe(maxi(1, int(round(raw))), x.id)
				if e.has("dot"): _add_dot(sd, r, float(e.dot[0]), int(e.dot[1]), x)
			_add_stagger(float(e.get("stagger", 0)))
			notes.append("-%d каждому" % int(round(raw)))
		else:
			for x in s.minions.filter(func(m): return m.alive): _damage_foe(maxi(1, int(round(raw))), x.id)
			var h = hit_boss(r, raw, STAGGER_ATTACK + float(e.get("stagger", 0)))
			if e.has("dot"): _add_dot(sd, r, float(e.dot[0]), int(e.dot[1]), null)
			notes.append("-%d%s" % [h.dmg, h.note])
	if e.has("heal") or e.has("healPct") or e.has("hot") or e.has("shield"):
		var t = _ally(r, target_id)
		s.fx.targetRaider = t.id
		if e.has("heal"):
			var amt = round(heal_raw(r) * float(e.heal) * boost)
			t.hp = minf(t.maxHp, t.hp + amt); notes.append("%s +%d" % [t.name, amt])
		if e.has("healPct"):
			var amt = round(t.maxHp * float(e.healPct))
			t.hp = minf(t.maxHp, t.hp + amt); notes.append("%s +%d" % [t.name, amt])
		if e.has("hot"):
			t.hots.append({"amt": round(heal_raw(r) * float(e.hot[0]) * boost), "rounds": int(e.hot[1])})
			if not e.has("heal"): notes.append("%s лечится %d раунда" % [t.name, int(e.hot[1])])
		if e.has("shield"):
			var amt = round(heal_raw(r) * float(e.shield) * boost)
			t.absorb += amt; notes.append("щит %d на %s" % [amt, t.name])
	if e.has("partyHeal"):
		var amt = round(heal_raw(r) * float(e.partyHeal) * boost)
		for x in alive(): x.hp = minf(x.maxHp, x.hp + amt)
		s.fx.targetRaider = r.id
		notes.append("+%d каждому" % amt)
	if e.has("partyHot"):
		var amt = round(heal_raw(r) * float(e.partyHot[0]) * boost)
		for x in alive(): x.hots.append({"amt": amt, "rounds": int(e.partyHot[1])})
		notes.append("отряд лечится %d раунда" % int(e.partyHot[1]))
	if e.has("selfHealPct"):
		var amt = round(r.maxHp * float(e.selfHealPct))
		r.hp = minf(r.maxHp, r.hp + amt); notes.append("+%d себе" % amt)
	if e.has("buff"):
		var b: Dictionary = e.buff.duplicate()
		var t = _ally(r, target_id) if sd.target == "ally" else r
		b.rounds = int(b.rounds) + 1
		b.name = sd.name
		t.buffs.append(b)
		if t != r: notes.append("на %s" % t.name)
	if e.has("partyBuff"):
		var pb: Dictionary = e.partyBuff.duplicate()
		pb.name = sd.name
		s.partyBuffs.append(pb)
	if e.has("gain"): _gain_res(r, float(e.gain))
	log_line("%s: %s%s" % [r.name, sd.name, (" (" + ", ".join(notes) + ")") if not notes.is_empty() else ""], "ok")
	g.haptic(20)
	_check_phase()


func _do_interrupt(r: Dictionary) -> void:
	if not sim.pendingCast: return
	log_line("%s срывает каст — чисто сработано!" % r.name, "ok")
	sim.pendingCast = null
	add_tilt(-5)
	gain_valor(1)
	g.ever_interrupted = true
	g.haptic(30)


func _do_break_chain(r: Dictionary) -> void:
	var s: Dictionary = sim
	if not s.chain or (s.chain.aId != r.id and s.chain.bId != r.id): return
	var other = _raider(s.chain.bId if s.chain.aId == r.id else s.chain.aId)
	if other: other.chainPartner = null
	r.chainPartner = null
	s.chain = null
	log_line("%s разрывает цепь рывком." % r.name, "ok")


func _do_rally(r: Dictionary) -> void:
	var s: Dictionary = sim
	if s.rallyCd > 0: return
	add_tilt(-30)
	s.rallyCd = 4
	s.inspiredRounds = INSPIRED_ROUNDS + 1
	var had: bool = s.ashCurse != null
	s.ashCurse = null
	log_line("%s: «Так, все выдохнули! Добиваем!» Лечение усилено на 2 раунда.%s" % [r.name, " Пепел стряхнут с плеч отряда." if had else ""], "ok")


func _do_ability(r: Dictionary) -> void:
	var s: Dictionary = sim
	var a: Dictionary = r.ability
	if a.cd > 0: return
	if r.trait == "clicker" and randf() < 0.2:
		a.cd = a.cdMax
		log_line("%s тыкает не туда — способность прогорела впустую." % r.name, "warn")
		return
	g.ever_used_ability = true
	g.bump_daily("abilityUsed")
	g.haptic(20)
	match a.kind:
		"selfShield":
			s.fx.targetEnemy = null
			a.active = true; a.activeRounds = a.activeMax; a.cd = a.cdMax
			log_line("%s раскрывает Librum Tenebris — урон по нему снижен." % r.name, "ok")
		"partyShield":
			s.fx.targetEnemy = null
			a.active = true; a.activeRounds = a.activeMax; a.cd = a.cdMax
			s.partyWard = {"roundsLeft": a.activeMax, "mult": 0.7}
			log_line("%s встаёт последним рубежом — весь отряд получает меньше урона." % r.name, "ok")
		"drainHeal":
			a.cd = a.cdMax
			var t = heal_target(r)
			if t == null: t = r
			s.fx.targetEnemy = null; s.fx.targetRaider = t.id
			t.hp = minf(t.maxHp, t.hp + 90)
			r.hp = maxf(1, r.hp - 15)
			log_line("%s платит собственной кровью за исцеление: %s" % [r.name, t.name], "ok")
		"volatileHeal":
			a.cd = a.cdMax
			var t = heal_target(r)
			if t == null: t = r
			s.fx.targetEnemy = null; s.fx.targetRaider = t.id
			if randf() < 0.2:
				t.hp = minf(t.maxHp, t.hp + 15)
				add_tilt(6)
				log_line("%s: эликсир пошёл не так — эффект слабее ожидаемого." % r.name, "warn")
			else:
				t.hp = minf(t.maxHp, t.hp + round(40 + randf() * 70))
				log_line("%s щедро отливает экспериментальный эликсир: %s" % [r.name, t.name], "ok")
		"venom":
			a.cd = a.cdMax
			var fe = focus_enemy() if not s.enemies.is_empty() else null
			s.bossPoison = {"roundsLeft": 3, "dmgPerTick": round(9 * out_mult(r) * ATTACK_TURN_SCALE * 0.5), "enemyId": fe.id if fe else null}
			log_line("%s смазывает клинки ядом василиска." % r.name, "ok")
		"berserk":
			s.fx.targetEnemy = null
			a.active = true; a.activeRounds = a.activeMax + 1; a.cd = a.cdMax
			log_line("%s впадает в кровавую ярость — урон удвоен, но и сам он уязвим." % r.name, "ok")
		"nukeSelfDamage":
			a.cd = a.cdMax
			var h = hit_boss(r, r.dps * out_mult(r) * dps_mult() * ATTACK_TURN_SCALE * 0.9, STAGGER_NUKE)
			hurt(r, 10)
			log_line("%s бьёт зелёной стрелой (-%d%s) — яд ранит и её саму." % [r.name, h.dmg, h.note], "ok")
		"nukeHeal":
			a.cd = a.cdMax
			var h = hit_boss(r, r.dps * out_mult(r) * dps_mult() * ATTACK_TURN_SCALE * 0.9, STAGGER_NUKE)
			for x in alive(): x.hp = minf(x.maxHp, x.hp + 20)
			log_line("%s выпускает Огонь Душ (-%d%s) — обжигает врага и лечит отряд." % [r.name, h.dmg, h.note], "ok")
		"nukeTilt":
			a.cd = a.cdMax
			var h = hit_boss(r, r.dps * out_mult(r) * dps_mult() * ATTACK_TURN_SCALE * 1.3, STAGGER_NUKE)
			add_tilt(6)
			log_line("%s карает врага именем бога (-%d%s), в которого уже не верит." % [r.name, h.dmg, h.note], "warn")
	_check_phase()


# ── the enemy's turn ────────────────────────────────────────────────────────
func _boss_turn() -> void:
	var s: Dictionary = sim
	if s.stunned:
		s.stunned = false
		var interrupted: bool = s.pendingCast or s.braceCall or s.danger or s.debt or s.execution or s.quota
		s.pendingCast = null; s.braceCall = null; s.danger = null; s.debt = null; s.execution = null; s.quota = null
		log_line(("Враги оглушены и пропускают ход" if not s.enemies.is_empty() else s.boss.name + " оглушён и пропускает ход") + (" — заготовленная атака сорвана." if interrupted else "."), "ok")
		return
	if s.vulnerableRounds == 0: s.stagger = maxf(0, s.stagger - STAGGER_DECAY)
	s.fx = {"seq": s.fx.seq + 1, "actor": "enemy", "kind": "enemy", "crit": false, "targetEnemy": null, "targetRaider": null}
	if s.enemies.is_empty():
		_leader_turn()
		_minion_turn()
		return
	var has = func(role): return s.enemies.any(func(e): return e.role == role and e.alive)
	if has.call("brute"): _leader_turn()
	for e in s.enemies:
		if e.alive and e.role != "brute": _reposition_skirmisher(e)
	if has.call("archer"): _archer_shot()
	if has.call("shaman"): _shaman_turn()


func _archer_shot() -> void:
	var al = alive()
	if al.is_empty(): return
	var lead = _leader_rect()
	var away = func(r): return rect_dist(r.row, r.col, lead) if lead else BACK_ROW - r.row
	var far = 0
	for r in al: far = maxi(far, away.call(r))
	var t: Dictionary = al.filter(func(r): return away.call(r) == far).pick_random()
	var dmg = int(round((ARCHER_DMG + randf() * 8) * boss_dmg_mult(true)))
	hurt(t, dmg)
	log_line("Стрелок бьёт по %s (-%d)." % [t.name, dmg], "warn")


func _shaman_turn() -> void:
	var s: Dictionary = sim
	var hurt_foes = s.enemies.filter(func(e): return e.alive and e.hp < e.maxHp)
	if not hurt_foes.is_empty():
		hurt_foes.sort_custom(func(a, b): return a.hp / a.maxHp < b.hp / b.maxHp)
		var e: Dictionary = hurt_foes[0]
		var amt = minf(e.maxHp - e.hp, round(s.boss.maxHp * SHAMAN_HEAL_SHARE))
		e.hp += amt
		_sync_group_hp()
		log_line("Шаман латает %s (+%d)." % [ENEMY_NAME_ACC[e.role], amt], "warn")
		return
	var t: Dictionary = alive().pick_random()
	var dmg = int(round((10 + randf() * 5) * boss_dmg_mult(true)))
	hurt(t, dmg)
	log_line("Шаман насылает порчу на %s (-%d)." % [t.name, dmg], "warn")


func leader_name() -> String:
	return ENEMY_NAME.brute if not sim.enemies.is_empty() else sim.boss.name


func _leader_turn() -> void:
	var s: Dictionary = sim
	if s.pendingCast:
		var t = _raider(s.pendingCast.targetId)
		if t and t.alive:
			var dmg = int(round(140 * boss_dmg_mult()))
			hurt(t, dmg)
			add_tilt(15)
			log_line("%s получает полный луч смерти в лицо (-%d)." % [t.name, dmg], "warn")
			s.shakeSeq += 1
		s.pendingCast = null
		return
	if s.braceCall:
		var soaked: bool = s.braceCall.braced.size() >= 3
		var dmg = int(round((38 if soaked else 100) * boss_dmg_mult()))
		for r in alive(): hurt(r, dmg)
		add_tilt(4 if soaked else 16)
		if not soaked: s.shakeSeq += 1
		log_line("Рейд приготовился вовремя — «Кровавый прилив» смягчён." if soaked else "Никто толком не приготовился — Прилив ударил в полную силу!", "ok" if soaked else "warn")
		s.braceCall = null
		return
	if s.danger:
		var zone: Dictionary = s.danger
		s.danger = null
		var base: int = {"meteor": 55, "cleave": 45, "devour": 75, "backstab": 50}[zone.kind]
		var dmg = int(round(base * boss_dmg_mult(true)))
		var hit = alive().filter(func(r): return ("%d,%d" % [r.row, r.col]) in zone.cells)
		for r in hit:
			hurt(r, dmg)
			add_tilt(6)
		s.impact = {"seq": s.impact.seq + 1, "cells": zone.cells, "kind": zone.kind}
		var near = alive().filter(func(r): return not (r in hit) and zone.cells.any(func(c):
			var p: PackedStringArray = c.split(",")
			return maxi(absi(int(p[0]) - r.row), absi(int(p[1]) - r.col)) == 1))
		if not near.is_empty(): s.dodge = {"seq": s.dodge.seq + 1, "ids": near.map(func(r): return r.id)}
		if not hit.is_empty(): s.shakeSeq += 1
		var what: String = {"meteor": "Огненный дождь", "cleave": "Сокрушающий взмах", "devour": "Пасть", "backstab": "Удар в спину"}[zone.kind]
		if not hit.is_empty(): log_line("%s накрывает: %s (-%d)." % [what, ", ".join(hit.map(func(r): return r.name)), dmg], "warn")
		else: log_line(what + " — мимо: отряд вовремя сменил позицию.", "ok")
		if zone.kind == "devour" and not hit.is_empty():
			var heal = minf(s.boss.maxHp - s.boss.hp, dmg * 2 * hit.size())
			s.boss.hp += heal
			log_line("%s проглатывает добычу и восстанавливает силы (+%d)." % [s.boss.name, heal], "warn")
		if zone.kind == "meteor" or zone.kind == "cleave": return
	if s.debt:
		var d: Dictionary = s.debt
		s.debt = null
		var t = _raider(d.targetId)
		if d.paid: log_line("Долг %s погашен — Ростовщик недовольно прячет расписку." % d.targetName, "ok")
		elif t and t.alive:
			var dmg = int(round(95 * boss_dmg_mult(true)))
			hurt(t, dmg); add_tilt(10); s.shakeSeq += 1
			log_line("Взыскание! %s не заплатил по расписке (-%d)." % [t.name, dmg], "warn")
	if s.execution:
		var ex: Dictionary = s.execution
		s.execution = null
		var t = _raider(ex.targetId)
		if t and t.alive:
			var covered: bool = t.defending or t.hp >= t.maxHp * 0.6
			var dmg = int(round((15 if covered else 70) * boss_dmg_mult(true)))
			hurt(t, dmg); s.shakeSeq += 1
			log_line(("Залп по %s — но приговорённый успел укрыться (-%d)." if covered else "Залп! Приказ о расстреле %s исполнен (-%d).") % [t.name, dmg], "ok" if covered else "warn")
	if s.quota:
		var q: Dictionary = s.quota
		s.quota = null
		if q.dealt >= q.need:
			s.stagger = 0.0; s.vulnerableRounds = 2
			log_line("План перевыполнен (%d/%d) — Держатель пакета в замешательстве! Бейте, пока открыт." % [q.dealt, q.need], "ok")
		else:
			var dmg = int(round(60 * boss_dmg_mult(true)))
			for r in alive(): hurt(r, dmg)
			add_tilt(12); s.shakeSeq += 1
			log_line("План провален (%d/%d) — штраф всему отряду (-%d)." % [q.dealt, q.need, dmg], "warn")

	_advance_leader()
	var al = alive()
	if al.is_empty(): return
	var t: Dictionary = s.bossMoveTimers
	var lead = _leader_rect()
	var kit = g.current_dungeon().get("bossKit")
	var moves: Array = (kit if kit != null else ["beam", "meteor", "poison", "chain", "brace"]).duplicate()
	moves.append("cleave")
	for k in moves: t[k] = maxi(0, t[k] - 1)
	if s.signature and s.signature != "feast":
		s.sigTimer -= 1
		if s.sigTimer <= 0 and _cast_signature(s.signature): s.sigTimer = SIG_COOLDOWN[s.signature]
	var eligible = func(k: String) -> bool:
		if t[k] > 0: return false
		match k:
			"beam": return s.encounterType == "boss"
			"poison": return s.phase >= 2 and s.poison == null
			"chain": return s.phase >= 2 and s.chain == null and al.size() >= 2
			"brace": return s.phase >= 2
			"freeze": return s.frozen == null
			"cleave": return s.danger == null and lead != null and al.any(func(r): return rect_dist(r.row, r.col, lead) <= 1)
			"meteor": return s.danger == null
		return true
	var chosen = null
	for i in moves.size():
		var k: String = moves[(s.bossCyclePos + i) % moves.size()]
		if eligible.call(k):
			chosen = k
			break
	s.bossCyclePos = (s.bossCyclePos + 1) % moves.size()
	if chosen == null:
		_basic_strike()
		return
	match chosen:
		"beam":
			var target: Dictionary = al.pick_random()
			s.pendingCast = {"targetId": target.id, "targetName": target.name}
			t.beam = 4
			log_line("%s: «Рейд-лидер, на мне луч, СНИМИ ЕГО!»" % target.name, "warn")
		"meteor":
			var occupied = []
			for r in al:
				if not (r.col in occupied): occupied.append(r.col)
			occupied.shuffle()
			var cols = occupied.slice(0, 2)
			while cols.size() < 2:
				var c = randi() % GRID_COLS
				if not (c in cols): cols.append(c)
			cols.sort()
			var cells = []
			for c in cols:
				for row in GRID_ROWS: cells.append("%d,%d" % [row, c])
			s.danger = {"kind": "meteor", "cells": cells, "cols": cols}
			log_line("Небо над колоннами %s наливается огнём — уйдите с отмеченных клеток!" % " и ".join(cols.map(func(c): return str(c + 1))), "warn")
			_basic_strike()
			t.meteor = 3
		"cleave":
			var cells = []
			for row in GRID_ROWS:
				for col in GRID_COLS:
					if lead and rect_dist(row, col, lead) == 1: cells.append("%d,%d" % [row, col])
			s.danger = {"kind": "cleave", "cells": cells, "cols": []}
			log_line(leader_name() + " раскручивает сокрушающий взмах вокруг себя — отступите или примите удар!", "warn")
			_basic_strike()
			t.cleave = 4
		"poison":
			var target: Dictionary = al.pick_random()
			s.poison = {"targetId": target.id, "roundsLeft": 3, "dmgPerTick": round(16 * boss_dmg_mult())}
			log_line("Босс отравляет %s — яд будет разъедать её каждый ход." % target.name, "warn")
			t.poison = 4
		"chain":
			var pool_c = al.duplicate()
			pool_c.shuffle()
			var a: Dictionary = pool_c[0]; var b2: Dictionary = pool_c[1]
			a.chainPartner = b2.id; b2.chainPartner = a.id
			s.chain = {"aId": a.id, "bId": b2.id, "roundsLeft": 3}
			log_line("Цепи сковали %s и %s — разорвите их!" % [a.name, b2.name], "warn")
			t.chain = 4
		"brace":
			s.braceCall = {"braced": {}}
			log_line("«Кровавый прилив» нарастает — отряду нужно приготовиться!", "warn")
			t.brace = 5
		"freeze":
			var target: Dictionary = al.pick_random()
			s.frozen = {"targetId": target.id, "targetName": target.name, "roundsLeft": 2}
			log_line("%s закован(а) в ледяной плен — расколите лёд или ждите оттепели." % target.name, "warn")
			t.freeze = 5
		"curse":
			var stacks = mini(4, (s.ashCurse.stacks if s.ashCurse else 0) + 1)
			s.ashCurse = {"stacks": stacks}
			log_line("Кардинал осыпает отряд пеплом — уязвимость ×%d, пока кто-то не сплотит отряд." % stacks, "warn")
			t.curse = 4


func _cast_signature(sig: String) -> bool:
	var s: Dictionary = sim
	var al = alive()
	if al.is_empty(): return false
	match sig:
		"devour":
			var lead = _leader_rect()
			var front = al.filter(func(r): return lead and rect_dist(r.row, r.col, lead) <= 1)
			var t: Dictionary = (front if not front.is_empty() else al).pick_random()
			s.danger = {"kind": "devour", "cells": ["%d,%d" % [t.row, t.col]], "cols": [t.col]}
			log_line("%s раскрывает пасть над %s — уведите с этой клетки!" % [s.boss.name, t.name], "warn")
			return true
		"backstab":
			var cells = []
			for col in GRID_COLS: cells.append("%d,%d" % [BACK_ROW, col])
			s.danger = {"kind": "backstab", "cells": cells, "cols": []}
			log_line("%s растворяется в тенях и заходит в тыл — задний ряд под ударом!" % s.boss.name, "warn")
			return true
		"iceShell":
			if s.iceShell: return false
			s.iceShell = true
			log_line("%s покрывается ледяным панцирем — урон по нему −75%%, пока его не расколют." % s.boss.name, "warn")
			return true
		"debt":
			var non_heal = al.filter(func(r): return r.role != "heal")
			var t: Dictionary = (non_heal if not non_heal.is_empty() else al).pick_random()
			s.debt = {"targetId": t.id, "targetName": t.name, "paid": false}
			log_line("%s выписывает долговую расписку на %s: ударь его до следующего хода — или взыскание!" % [s.boss.name, t.name], "warn")
			return true
		"execution":
			var t: Dictionary = al[0]
			for x in al:
				if x.hp / x.maxHp < t.hp / t.maxHp: t = x
			s.execution = {"targetId": t.id, "targetName": t.name}
			log_line("%s: «Расстрелять %s!» — подлечите выше 60%% или прикройте обороной." % [s.boss.name, t.name], "warn")
			return true
		"lava":
			if s.lava.size() >= LAVA_MAX_CELLS: return false
			var free = []
			for row in GRID_ROWS:
				for col in GRID_COLS:
					var k = "%d,%d" % [row, col]
					if not (k in s.lava) and not foe_at(row, col): free.append(k)
			free.shuffle()
			s.lava = s.lava + free.slice(0, 2)
			log_line("Извержение! Лава растекается по полю — стоять на ней больно.", "warn")
			return true
		"quota":
			var est = 0.0
			for r in al: est += r.dps * out_mult(r) * dps_mult() * ATTACK_TURN_SCALE
			s.quota = {"need": maxi(1, int(round(est * QUOTA_SHARE))), "dealt": 0}
			log_line("%s требует квартальный отчёт: нанесите %d урона до его следующего хода!" % [s.boss.name, s.quota.need], "warn")
			return true
		"raise":
			var up = s.minions.filter(func(m): return m.alive).size()
			var lead = _leader_rect()
			if lead == null or up >= MINION_MAX: return false
			var rc = al.map(func(r): return "%d,%d" % [r.row, r.col])
			var free = []
			for row in GRID_ROWS:
				for col in GRID_COLS:
					if rect_dist(row, col, lead) == 1 and not foe_at(row, col) and not (("%d,%d" % [row, col]) in rc): free.append({"row": row, "col": col})
			free.shuffle()
			free.sort_custom(func(a, b): return a.row > b.row)
			var n = mini(mini(MINION_PER_CAST, MINION_MAX - up), free.size())
			if n == 0: return false
			var hp = maxi(1, int(round(s.boss.maxHp * MINION_HP_SHARE)))
			for at in free.slice(0, n):
				s.minions.append({"id": MINION_ID0 + s.minions.size(), "role": "brute", "name": "Скелет", "maxHp": hp, "hp": float(hp), "alive": true, "row": at.row, "col": at.col})
			s.shakeSeq += 1
			log_line("%s поднимает мертвецов: %s из земли!" % [s.boss.name, "скелет встаёт" if n == 1 else "%d скелета встают" % n], "warn")
			return true
	return false


func _minion_turn() -> void:
	for m in sim.minions:
		if not m.alive: continue
		var al = alive()
		if al.is_empty(): return
		var f = {"id": m.id, "row": m.row, "col": m.col, "w": 1, "h": 1}
		if not al.any(func(r): return rect_dist(r.row, r.col, f) <= 1):
			var t: Dictionary = al[0]
			for r in al:
				if rect_dist(r.row, r.col, f) < rect_dist(t.row, t.col, f): t = r
			var to = _step_foe(f, 1, func(row, col): return float(rect_dist(t.row, t.col, {"row": row, "col": col, "w": 1, "h": 1})))
			m.row = to.row; m.col = to.col
			f.row = to.row; f.col = to.col
		var front = al.filter(func(r): return rect_dist(r.row, r.col, f) <= 1)
		if front.is_empty(): continue
		var tanks = front.filter(func(r): return r.role == "tank")
		var t: Dictionary = (tanks if not tanks.is_empty() else front).pick_random()
		var dmg = int(round((MINION_DMG + randf() * 5) * boss_dmg_mult()))
		hurt(t, dmg)
		log_line("%s бьёт %s (-%d)." % [m.name, t.name, dmg], "warn")


func _basic_strike() -> void:
	var al = alive()
	if al.is_empty(): return
	var lead = _leader_rect()
	var dist = func(r): return rect_dist(r.row, r.col, lead) if lead else 1
	var front = al.filter(func(r): return dist.call(r) <= 1)
	var tanks = front.filter(func(r): return r.role == "tank")
	var nearest: Dictionary = al[0]
	for r in al:
		if dist.call(r) < dist.call(nearest): nearest = r
	var pool_s: Array = tanks if not tanks.is_empty() else (front if not front.is_empty() else [nearest])
	var target: Dictionary = pool_s.pick_random()
	var exposed = front.is_empty()
	var dmg = int(round((20 + randf() * 12) * (1.3 if exposed else 1.0) * boss_dmg_mult()))
	hurt(target, dmg)
	if exposed: log_line("%s прорывается к %s (-%d) — никто не встал у него на пути." % [leader_name(), target.name, dmg], "warn")
	else: log_line("%s обрушивается на %s (-%d)." % [leader_name(), target.name, dmg], "warn")


# ── the end of a fight ──────────────────────────────────────────────────────
func end_game(win: bool) -> void:
	if g.in_arena:
		_end_arena(win)
		return
	if g.in_weekly:
		_end_weekly(win)
		return
	var s: Dictionary = sim
	s.over = true
	clear_timer()
	var is_boss: bool = s.encounterType == "boss"
	g.haptic(60 if win else 120)
	var loot = []
	var curio = null
	var gold_found = 0
	var reagent = null
	var dungeon: Dictionary = g.current_dungeon()
	var rdef = DB.reagents.REAGENT_BY_LOCATION.get(dungeon.locationId)
	if win and is_boss:
		for r in s.raiders: g.gain_xp(r.candidateId, 40)
		loot = _boss_loot(1 + randi() % 2)
		if not g.defeated.has(g.dungeon_id):
			for table in [DB.gear.UNIQUE_BOSS_LOOT, DB.gear.UNIQUE_BOSS_LOOT_EXTRA]:
				if table.has(g.dungeon_id): loot.append(_loot_item(table[g.dungeon_id]))
		curio = g.roll_curio(0.6)
		gold_found = 70 + randi() % 41
		g.stats_boss_wins += 1
		g.bump_daily("bossWin")
		if rdef:
			var qty = 2 + randi() % 2
			g.reagent_counts[rdef.id] = g.reagent_owned(rdef.id) + qty
			reagent = {"name": rdef.name, "icon": rdef.icon, "qty": qty}
	elif win:
		for r in s.raiders: g.gain_xp(r.candidateId, 15)
		g.ever_cleared_room = true
		g.stats_room_wins += 1
		g.bump_daily("roomWin")
		if randf() < DB.gear.TRASH_LOOT_CHANCE:
			loot = [_loot_item(DB.gear.TRASH_LOOT_TABLE.pick_random())]
		curio = g.roll_curio(0.2)
		gold_found = 12 + randi() % 11
		if rdef and randf() < DB.reagents.ROOM_REAGENT_CHANCE:
			g.reagent_counts[rdef.id] = g.reagent_owned(rdef.id) + 1
			reagent = {"name": rdef.name, "icon": rdef.icon, "qty": 1}
	else:
		g.stats_wipes += 1
	g.gold += gold_found
	if gold_found > 0: g.bump_daily("goldEarned", gold_found)
	g.trip.maxRound = maxi(g.trip.maxRound, s.round)
	if s.raiders.any(func(r): return not r.alive): g.trip.lost = true
	if skirmish == null: g.settle_contract(win, is_boss)
	if skirmish != null or g.from_world: g.w.fight_done()
	result = {"win": win, "isBoss": is_boss, "loot": loot, "curioFound": curio, "goldFound": gold_found, "reagentFound": reagent}
	g.screen = "results"
	g.notify()


var _banter_for = null
var _banter: Array = []


## Two lines of squad chatter for the result screen, fixed per result.
func banter() -> Array:
	if result == null or sim == null: return []
	if is_same(_banter_for, result): return _banter
	var rough: bool = sim.raiders.any(func(r): return not r.alive or r.hp / r.maxHp < 0.3)
	var moment = DB.bark_moment(result.win, result.isBoss, rough)
	var voiced = sim.raiders.filter(func(r): return DB.barks.has(str(r.candidateId)))
	var speakers = voiced.filter(func(r): return r.alive) if result.win else voiced
	var lines = []
	if not speakers.is_empty():
		var a: Dictionary = speakers.pick_random()
		lines.append({"id": a.candidateId, "name": a.name, "text": DB.barks[str(a.candidateId)][moment].pick_random()})
		var others = voiced.filter(func(r): return r.candidateId != a.candidateId and (r.alive or not result.win))
		if not others.is_empty():
			var b: Dictionary = others.pick_random()
			lines.append({"id": b.candidateId, "name": b.name, "text": DB.barks[str(b.candidateId)].reply.pick_random()})
	_banter_for = result
	_banter = lines
	return lines


func assign_loot(idx: int, raider_id: int) -> void:
	var item: Dictionary = result.loot[idx]
	if item.assigned != null: return
	var raider = _raider(raider_id)
	if raider == null: return
	item.assigned = raider_id
	g.ever_assigned_loot = true
	g.inventory[item.gearId] = g.item_owned(item.gearId) + 1
	var c = g.find_hero(raider.candidateId)
	if c:
		var slots = DB.slots_for_kind(item.slot)
		var target = null
		for sl in slots:
			if c.equipment[sl] == "none" and target == null: target = sl
		if target == null:
			for sl in slots:
				if DB.armour_of(c.equipment[sl]) == null and target == null: target = sl
		if target != null: c.equipment[target] = item.gearId
	g.adjust_morale(raider.candidateId, 20 if raider.trait == "legend" else 15)
	for o in sim.raiders:
		if o.id == raider.id: continue
		var p: int = {"egoist": 10, "ninjaLooter": 12, "legend": 8}.get(o.trait, 5)
		g.adjust_morale(o.candidateId, -p)
	g.notify()


func result_primary() -> void:
	var res: Dictionary = result
	if skirmish != null:
		g.w.after_fight(skirmish.id, res.win)
		skirmish = null
		g.enc_idx = 0; sim = null; result = null
		g.go_tab("world")
		return
	if g.in_arena:
		g.in_arena = false
		g.arena_opponent = null
		g.enc_idx = 0; sim = null; result = null
		g.return_to_camp("arena")
		return
	if g.in_weekly:
		g.in_weekly = false
		g.weekly_dmg_mult = 1.0
		g.enc_idx = 0; sim = null; result = null
		g.return_to_camp("home")
		return
	if res.win and not res.isBoss:
		g.enc_idx = mini(g.current_dungeon().encounters.size() - 1, g.enc_idx + 1)
		g.go("dungeon")
	else:
		if res.win and res.isBoss:
			g.defeated[g.dungeon_id] = true
			g.w.task_event("dungeon", g.dungeon_id)
		g.enc_idx = 0; sim = null; result = null
		var to_map: bool = g.from_world
		g.from_world = false
		g.return_to_camp("world" if to_map else "home")


func result_secondary() -> void:
	if skirmish != null:
		result_primary()
		return
	var was_arena: bool = g.in_arena
	g.in_arena = false
	g.arena_opponent = null
	if g.in_weekly:
		g.in_weekly = false
		g.weekly_dmg_mult = 1.0
	g.enc_idx = 0; sim = null; result = null
	g.return_to_camp("arena" if was_arena else "roster")
