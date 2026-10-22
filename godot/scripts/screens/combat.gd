extends Screen
## The fight, laid out after Wartales: the 3D field fills the screen; across
## the top the foe and the turn order, along the bottom the hero acting, the
## skill bar and the pace. Taps on the field between them reach it.

## The top's width on a wide window (points).
const TOP_W := 560.0
const ACTION_ICON := {"attack": "sword", "heal": "first-aid-kit", "ability": "flame", "interrupt": "hand-palm", "breakChain": "shield-chevron",
	"breakIce": "snowflake", "brace": "shield", "rally": "megaphone", "defend": "shield", "breakShell": "snowflake", "valor": "crown-simple"}
const DANGER_TITLE := {"meteor": "Огненный дождь по колоннам %s", "cleave": "Сокрушающий взмах по клеткам вокруг врага",
	"devour": "Пасть раскрыта над отмеченной клеткой", "backstab": "Удар в спину по заднему ряду"}
const GOLD_LINE := Color(0.79, 0.64, 0.42, 0.45)
const GOLD_TEXT := Color("#e6cf9c")

var view: BattleView
var picking_heal = false
## The move waiting for an ally to aim at: "heal" or a spell ("spell:<id>").
var _pick_key = "heal"
## What keys 1–9 do this turn (the action tiles, or whom to heal).
var _hotkeys = []
## The skill bar's squares (points): smaller on a phone so a turn fits one row.
var SLOT = 58.0
var _cam: Control
var _top: Control
var _bottom: Control


func _enter_tree() -> void:
	view = BattleView.new()
	get_tree().root.add_child.call_deferred(view)


func _exit_tree() -> void:
	if is_instance_valid(view): view.queue_free()


func build() -> void:
	_hotkeys = []
	SLOT = 58.0 if App.wide else 46.0
	var s = Game.b.sim
	if s == null: return
	var cur = Game.b.current_raider()
	if cur == null: picking_heal = false
	_top = _top_block(s)
	add_child(_top)
	if App.wide:
		var foes = _foe_list(s)
		if foes: add_child(foes)
	_bottom = _bottom_block(s, cur)
	add_child(_bottom)
	_cam = _camera_bar()
	add_child(_cam)
	if Game.b.boss_intro: add_child(_intro(Game.b.boss_intro))
	_measure.call_deferred()


# Wrapped labels start out tall at zero width; the bottom must shrink back
# once they know their width, or it swallows the battlefield.
func _process(_d: float) -> void:
	if is_instance_valid(_bottom) and is_instance_valid(_top): _measure()


## Tells the field which strip of screen it shows through.
func _measure() -> void:
	if not is_instance_valid(view) or not is_instance_valid(_top): return
	var h = _bottom.get_combined_minimum_size().y
	if _bottom.size.y > h + 0.5: _bottom.offset_top = _bottom.offset_bottom - h
	if is_instance_valid(_cam):
		# Up the right edge: mid-height on a wide window, over the bottom on a phone.
		var ch = _cam.get_combined_minimum_size().y
		var vp = get_viewport_rect().size
		var y = (vp.y - ch) * 0.5 if App.wide else _bottom.get_global_rect().position.y - ch
		_cam.position = Vector2(vp.x - _cam.size.x - UI.px(12), y)
	if App.wide:
		view.band_top = 0.0; view.band_bottom = 0.0
		return
	view.band_top = _top.get_global_rect().end.y
	view.band_bottom = get_viewport_rect().size.y - _bottom.get_global_rect().position.y


# ── the top, Wartales-style: the foe's name and health, then who acts when ──
func _top_block(s: Dictionary) -> Control:
	# A panel, so the shade behind grows with what the top holds.
	var root = PanelContainer.new()
	root.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	root.set_anchors_preset(Control.PRESET_TOP_WIDE)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var shade = UI.fade(Color(0.03, 0.02, 0.015, 0.85), Color(0.03, 0.02, 0.015, 0.0), 10)
	shade.custom_minimum_size = Vector2.ZERO
	root.add_child(shade)
	var col = UI.vbox(7)
	var m = UI.margin(col, 12, 10 + App.inset_top() / UI.K, 12, 22)
	if App.wide:
		m.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		m.custom_minimum_size.x = UI.px(TOP_W)
	root.add_child(m)
	# Name and health of what we fight.
	var name_row = UI.hbox(8, BoxContainer.ALIGNMENT_CENTER)
	if s.encounterType == "boss" and not Game.in_arena:
		var art = DB.boss_art_path(Game.dungeon_id)
		if art != "": name_row.add_child(UI.picture(art, 30, 30, 15))
	var title = UI.shadowed(UI.label(s.name + (" · фаза %d" % s.phase if s.encounterType == "boss" else ""), 18, Color("#f1e4c6"), "title"))
	name_row.add_child(title)
	col.add_child(name_row)
	var pct: float = maxf(0, 100.0 * s.boss.hp / s.boss.maxHp)
	var bar_row = UI.hbox(8)
	bar_row.add_child(UI.progress(pct, UI.DANGER, 10))
	bar_row.add_child(UI.shadowed(UI.label("%d%%" % round(pct), 12.5, UI.TEXT_MUTED, "semibold")))
	col.add_child(bar_row)
	var meters = UI.hbox(14)
	var stunned: bool = s.stunned or s.vulnerableRounds > 0
	meters.add_child(_meter("Оглушён" if stunned else "Натиск", 100.0 if stunned else s.stagger, UI.WARN if stunned else UI.ACCENT, ""))
	var tilt_col = UI.DANGER if s.tilt >= 70 else (UI.WARN if s.tilt >= 40 else UI.GOOD)
	meters.add_child(_meter("Тилт", s.tilt, tilt_col, "%d%%" % round(s.tilt)))
	col.add_child(meters)
	col.add_child(_timeline(s))
	if not App.wide:
		var foes = _foe_chips(s)
		if foes: col.add_child(foes)
	for b in _banners(s): col.add_child(b)
	return root


## Who acts, in order: faces with their health under them; the one acting now
## is larger and framed; the round and the enrage clock close the line.
func _timeline(s: Dictionary) -> Control:
	var row = UI.hbox(6, BoxContainer.ALIGNMENT_CENTER)
	var big = 46.0 if App.wide else 40.0
	var small = 34.0 if App.wide else 30.0
	for i in s.order.size():
		var entry: Dictionary = s.order[i]
		var active: bool = i == s.turnPos
		var size = big if active else small
		var cell = UI.vbox(3)
		cell.alignment = BoxContainer.ALIGNMENT_END
		if entry.kind == "boss":
			var disc = PanelContainer.new()
			var dsb = StyleBoxFlat.new(); dsb.set_corner_radius_all(UI.px(6))
			dsb.bg_color = Color(0.35, 0.08, 0.06, 0.85) if active else Color(0.1, 0.06, 0.05, 0.8)
			dsb.border_color = UI.DANGER if active else Color(UI.DANGER, 0.5); dsb.set_border_width_all(3 if active else 2)
			disc.add_theme_stylebox_override("panel", dsb)
			disc.custom_minimum_size = Vector2(UI.px(size), UI.px(size))
			disc.add_child(UI.center(UI.icon("skull", size * 0.5, UI.DANGER if active else Color(UI.DANGER, 0.8))))
			disc.tooltip_text = "Ход противника"
			cell.add_child(UI.center(disc))
			var pct: float = maxf(0, 100.0 * s.boss.hp / s.boss.maxHp)
			var hb = UI.progress(pct, UI.DANGER, 3)
			hb.custom_minimum_size.x = UI.px(size)
			cell.add_child(hb)
		else:
			var r = Game.b._raider(entry.id)
			if r == null: continue
			var pic = UI.portrait(r.candidateId, size, 6, not r.alive)
			if not r.alive or (not active and i < s.turnPos): pic.modulate.a = 0.45
			var col: Color = DB.ROLE_COLOR[r.role]
			var on = active
			UI.overlay(pic, func(o):
				var rr = Rect2(Vector2.ONE, o.size - Vector2(2, 2))
				o.draw_rect(rr, UI.GOLD if on else Color(col, 0.7), false, 3.0 if on else 1.5))
			pic.tooltip_text = "%s — %d/%d HP" % [r.name, maxi(0, int(r.hp)), r.maxHp]
			cell.add_child(UI.center(pic))
			var pct: float = maxf(0, 100.0 * r.hp / r.maxHp)
			var hb = UI.progress(pct, _hp_color(pct), 3)
			hb.custom_minimum_size.x = UI.px(size)
			cell.add_child(hb)
		row.add_child(cell)
	var sep = ColorRect.new(); sep.color = GOLD_LINE; sep.custom_minimum_size = Vector2(1, UI.px(30))
	row.add_child(UI.space(0, 4))
	row.add_child(UI.center(sep))
	var enraged: bool = s.round >= s.enrageAt
	var clock = UI.shadowed(UI.label(("Ярость ×%.2f" % Game.b.enrage_mult()) if enraged else ("Раунд %d\nярость через %d" % [s.round, s.enrageAt - s.round]), 11.5, UI.DANGER if enraged else UI.TEXT_MUTED, "semibold" if enraged else "medium"))
	clock.add_theme_constant_override("line_spacing", -UI.px(2))
	row.add_child(UI.center(UI.plate(clock, Vector2(7, 4), 0.6, 6)))
	return row


func _meter(label: String, pct: float, color: Color, value: String) -> Control:
	var v = UI.vbox(4)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var h = UI.hbox(4)
	h.add_child(UI.expand(UI.shadowed(UI.label(label.to_upper(), 10.5, UI.TEXT_MUTED, "medium"))))
	if value != "": h.add_child(UI.shadowed(UI.label(value, 10.5, UI.TEXT_MUTED, "medium")))
	v.add_child(h)
	v.add_child(UI.progress(pct, color, 5))
	return v


func _banner(tone: String, title: String, text: String) -> Control:
	var c: Color = {"danger": UI.DANGER, "warn": UI.WARN, "accent": UI.ACCENT}[tone]
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.063, 0.047, 0.035, 0.9)
	sb.border_color = c; sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(8))
	sb.content_margin_left = UI.px(10); sb.content_margin_right = UI.px(10); sb.content_margin_top = UI.px(8); sb.content_margin_bottom = UI.px(8)
	pn.add_theme_stylebox_override("panel", sb)
	pn.mouse_filter = Control.MOUSE_FILTER_STOP
	var v = UI.vbox(2)
	v.add_child(UI.label(title, 13, Color("#f0c3bc") if tone == "danger" else c, "medium", true))
	v.add_child(UI.label(text, 12, UI.TEXT_DIM, "regular", true))
	pn.add_child(v)
	return pn


func _banners(s: Dictionary) -> Array:
	var out = []
	if s.pendingCast: out.append(_banner("danger", "Луч смерти нацелен на %s" % s.pendingCast.targetName, "Прервите его на своём ходу, иначе он ударит на следующем ходу босса."))
	if s.danger:
		var t: String = DANGER_TITLE[s.danger.kind]
		if s.danger.kind == "meteor": t = t % " и ".join(s.danger.cols.map(func(c): return str(c + 1)))
		out.append(_banner("danger", t, "Ударит на следующем ходу противника по всем, кто останется на красных клетках."))
	if s.iceShell: out.append(_banner("accent", "Ледяной панцирь", "Урон по боссу −75%. Любой боец может потратить ход и расколоть его."))
	if s.debt: out.append(_banner("warn", "Долговая расписка: " + s.debt.targetName + (" — погашено" if s.debt.paid else ""), "Взыскания не будет." if s.debt.paid else "Этот боец должен ударить босса своим ходом, иначе получит «взыскание»."))
	if s.execution: out.append(_banner("danger", "Приказ о расстреле: " + s.execution.targetName, "Подлечите приговорённого выше 60% HP или пусть уйдёт в оборону — иначе залп на следующем ходу босса."))
	if s.quota: out.append(_banner("accent" if s.quota.dealt >= s.quota.need else "warn", "Квартальный план: %d / %d урона" % [mini(s.quota.dealt, s.quota.need), s.quota.need], "Выполните до хода босса — он растеряется. Провал — штраф всему отряду."))
	if s.chain: out.append(_banner("accent", "Цепь: %s ↔ %s" % [Game.b._raider(s.chain.aId).name, Game.b._raider(s.chain.bId).name], "Бьёт обоих каждый ход. Один из них может её разорвать."))
	if s.braceCall: out.append(_banner("warn", "«Кровавый прилив» нарастает", "Приготовились: %d/3 нужно, чтобы смягчить удар на следующем ходу босса." % s.braceCall.braced.size()))
	return out


# ── the bottom, Wartales-style: the hero acting, the skill bar, the pace ───
func _bottom_block(s: Dictionary, cur) -> Control:
	var pn = PanelContainer.new()
	pn.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	pn.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	pn.grow_vertical = Control.GROW_DIRECTION_BEGIN
	pn.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var shade = UI.fade(Color(0.03, 0.02, 0.015, 0.0), Color(0.03, 0.02, 0.015, 0.9), 10)
	shade.custom_minimum_size = Vector2.ZERO
	pn.add_child(shade)
	var v = UI.vbox(8)
	pn.add_child(UI.margin(v, 14, 34, 14, 12 + App.inset_bottom() / UI.K))
	var auto: bool = Game.settings.auto
	var hint = _hint(s, cur)
	var tip = _tip(s, cur)
	if App.wide:
		# Left: the log over the hero's card. Middle: what to do and the bar. Right: the pace.
		var row = UI.hbox(18)
		row.alignment = BoxContainer.ALIGNMENT_END
		var left = UI.vbox(8)
		left.custom_minimum_size.x = UI.px(330)
		left.alignment = BoxContainer.ALIGNMENT_END
		left.add_child(_log(s, 4))
		if cur: left.add_child(_hero_card(s, cur))
		row.add_child(left)
		var mid = UI.vbox(8)
		mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		mid.alignment = BoxContainer.ALIGNMENT_END
		if tip: mid.add_child(UI.center(_cap(tip, 560)))
		if hint: mid.add_child(hint)
		mid.add_child(_center_bar(s, cur, auto))
		row.add_child(mid)
		var right = UI.vbox(8)
		right.alignment = BoxContainer.ALIGNMENT_END
		right.custom_minimum_size.x = UI.px(120)
		right.add_child(_pace_buttons())
		row.add_child(right)
		v.add_child(row)
	else:
		v.add_child(_log(s, 2))
		if tip: v.add_child(tip)
		if hint: v.add_child(hint)
		var row = UI.hbox(10)
		if cur: row.add_child(UI.expand(_hero_card(s, cur)))
		else: row.add_child(UI.flex())
		row.add_child(_pace_buttons())
		v.add_child(row)
		v.add_child(_center_bar(s, cur, auto))
	return pn


## Keeps a wide child from stretching the whole middle.
func _cap(c: Control, w: float) -> Control:
	c.custom_minimum_size.x = UI.px(w)
	return c


func _log(s: Dictionary, n: int) -> Control:
	var v = UI.vbox(2)
	var lines: Array = s.log.slice(maxi(0, s.log.size() - n))
	if lines.is_empty(): return v
	for i in lines.size():
		var e: Dictionary = lines[i]
		var c = UI.GOOD if e.kind == "ok" else (UI.WARN if e.kind == "warn" else UI.TEXT)
		var l = UI.label(e.text, 12.5, c, "regular", true)
		# The older line fades a little; the newest reads in full.
		l.modulate.a = 0.7 + 0.3 * float(i + 1) / lines.size()
		v.add_child(l)
	return UI.plate(v, Vector2(10, 6), 0.6)


## What the player is being asked, under the bar's heading.
func _hint(s: Dictionary, cur) -> Control:
	if s.over or cur == null or Game.settings.auto: return null
	var t = ""
	if s.movePhase: t = "выберите клетку или пропустите" if not Game.b.reachable_cells().is_empty() else "нет свободных клеток рядом"
	elif picking_heal: t = "выберите, кого лечить" if _pick_key == "heal" else "выберите союзника"
	elif s.encounterType == "boss": t = "цель: скелет или босс" if s.minions.any(func(m): return m.alive) else "ближний бой вплотную к врагу"
	else: t = "нажмите на врага, чтобы выбрать цель"
	var row = UI.hbox(6)
	row.add_child(UI.label(cur.name, 13.5, UI.ACCENT_BRIGHT, "semibold"))
	row.add_child(UI.label("·  " + t, 13.5, UI.TEXT, "medium"))
	return UI.center(UI.plate(row, Vector2(12, 5), 0.6, 14))


## The hero whose turn it is: face, name and class, health, valor.
func _hero_card(s: Dictionary, r: Dictionary) -> Control:
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.063, 0.047, 0.035, 0.88); sb.border_color = GOLD_LINE
	sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(8))
	sb.set_content_margin_all(UI.px(8))
	pn.add_theme_stylebox_override("panel", sb)
	pn.mouse_filter = Control.MOUSE_FILTER_STOP
	var row = UI.hbox(10)
	var size = 62.0 if App.wide else 46.0
	var pic = UI.portrait(r.candidateId, size, 6)
	var rc: Color = DB.ROLE_COLOR[r.role]
	UI.overlay(pic, func(o): o.draw_rect(Rect2(Vector2.ONE, o.size - Vector2(2, 2)), rc, false, 2.0))
	row.add_child(UI.center(pic))
	var v = UI.vbox(3)
	var hc = DB.hero_class(r.heroClass)
	var top = UI.hbox(6)
	top.add_child(UI.label(r.name, 16 if App.wide else 14.5, Color("#f1e4c6"), "title"))
	if r.defending: top.add_child(UI.center(UI.icon("shield", 13, UI.ACCENT_SOFT, "fill")))
	v.add_child(top)
	v.add_child(UI.label("%s · %s" % [hc.name, DB.ROLE_NAME[r.role]], 11, Color(hc.color), "medium"))
	var pct: float = maxf(0, 100.0 * r.hp / r.maxHp)
	var hp = UI.hbox(6)
	hp.add_child(UI.progress(pct, _hp_color(pct), 7))
	hp.add_child(UI.label("%d/%d" % [maxi(0, int(r.hp)), r.maxHp], 11, UI.TEXT_DIM))
	v.add_child(hp)
	var res: Dictionary = r.res
	var rd: Dictionary = DB.specs.RESOURCES[res.kind]
	var rr = UI.hbox(6)
	rr.add_child(UI.progress(100.0 * res.val / res.max, Color(rd.color), 5))
	rr.add_child(UI.label("%d %s" % [int(res.val), rd.name.to_lower()], 10.5, Color(rd.color)))
	rr.tooltip_text = "%s: %d из %d. %s" % [rd.name, int(res.val), int(res.max), ("+%d в начале хода." % int(res.regen)) if res.regen > 0 else "Копится от ударов и полученного урона."]
	rr.mouse_filter = Control.MOUSE_FILTER_PASS
	v.add_child(rr)
	var pips = UI.hbox(5)
	for i in Battle.VALOR_MAX: pips.add_child(UI.valor_pip(i < s.valor, 8))
	pips.tooltip_text = "Доблесть: %d из %d. Копится в бою, тратится на приёмы класса." % [s.valor, Battle.VALOR_MAX]
	pips.mouse_filter = Control.MOUSE_FILTER_PASS
	v.add_child(pips)
	row.add_child(UI.expand(v))
	pn.add_child(row)
	return pn


## Speed and auto-battle, as two round buttons.
func _pace_buttons() -> Control:
	var v = UI.hbox(8, BoxContainer.ALIGNMENT_END) if not App.wide else UI.vbox(8)
	var fast: bool = Game.settings.speed >= 2
	v.add_child(UI.chip("×2" if fast else "×1", fast, Game.toggle_speed, "fast-forward"))
	v.add_child(UI.chip("Авто", Game.settings.auto, func():
		picking_heal = false
		Game.toggle_auto(), "robot"))
	for c in v.get_children(): c.tooltip_text = "Скорость (X)" if c == v.get_child(0) else "Автобой (A)"
	return v


## The middle of the bottom: the skill bar on the hero's turn, else what's going on.
func _center_bar(s: Dictionary, cur, auto: bool) -> Control:
	if s.over: return UI.space(4)
	if cur == null:
		var l = UI.shadowed(UI.label("Противник замахивается для мощного удара!" if s.windup else ("Ход противника…" if s.turnPos >= 0 and s.turnPos < s.order.size() and s.order[s.turnPos].kind == "boss" else "…"), 15, UI.TEXT_MUTED, "italic"))
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.custom_minimum_size.y = UI.px(SLOT + 18)
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		return l
	if auto:
		var row = UI.hbox(12, BoxContainer.ALIGNMENT_CENTER)
		row.custom_minimum_size.y = UI.px(SLOT + 18)
		row.add_child(UI.center(UI.shadowed(UI.label("Автобой · ход: " + cur.name, 14, UI.TEXT_MUTED))))
		row.add_child(UI.center(_cap(UI.secondary_button("Взять управление", Game.toggle_auto, 40), 200)))
		return row
	if s.movePhase:
		var c = UI.center(_cap(UI.secondary_button("Пропустить перемещение" + (" · Пробел" if UI.HOVER else ""), Game.b.skip_move), 320))
		c.custom_minimum_size.y = UI.px(SLOT + 18)
		return c
	var bar = HFlowContainer.new()
	bar.alignment = FlowContainer.ALIGNMENT_CENTER
	bar.add_theme_constant_override("h_separation", UI.px(4 if not App.wide else 8))
	bar.add_theme_constant_override("v_separation", UI.px(8))
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if picking_heal:
		var key: String = _pick_key
		for t in Game.b.heal_targets(key != "heal"):
			var tid: int = t.id
			var r = Game.b._raider(tid)
			var heal = func():
				picking_heal = false
				Game.b.raider_action(key, tid)
			var pic = UI.portrait(r.candidateId, SLOT * 0.7, 6)
			bar.add_child(_slot(pic, "%s · %d%%" % [t.name, t.hpPct], "%s: %s (%d%% HP)" % ["Лечить" if key == "heal" else "Цель", t.name, t.hpPct], heal, false, UI.GOOD, t.hpPct))
		bar.add_child(_slot(UI.icon("x", SLOT * 0.36, UI.TEXT_DIM), "Отмена", "Отмена (Esc)", func():
			picking_heal = false
			refresh(), false, UI.BORDER_STRONG, -1, false))
		return bar
	if not App.wide:
		# A phone keeps the bar to one row that scrolls sideways, to leave the field in view.
		var row = UI.hbox(4)
		for a in Game.b.turn_actions(): row.add_child(_action_slot(a))
		var sc = ScrollContainer.new()
		sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
		sc.custom_minimum_size.y = UI.px(SLOT + 40)
		sc.add_child(row)
		return sc
	for a in Game.b.turn_actions(): bar.add_child(_action_slot(a))
	return bar


## One square of the bar: a picture, the key that presses it, a name under it.
func _slot(content: Control, name: String, tip: String, fn: Callable, disabled: bool, border: Color, hp_pct := -1.0, counts := true) -> Control:
	var v = UI.vbox(3)
	v.custom_minimum_size.x = UI.px(SLOT + 22)
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.05, 0.035, 0.94)
	sb.border_color = Color(border, 0.35) if disabled else border
	sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(7))
	pn.add_theme_stylebox_override("panel", sb)
	pn.custom_minimum_size = Vector2(UI.px(SLOT), UI.px(SLOT))
	pn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	pn.add_child(UI.center(content))
	if hp_pct >= 0:
		var hb = UI.progress(hp_pct, _hp_color(hp_pct), 4)
		hb.size_flags_vertical = Control.SIZE_SHRINK_END
		pn.add_child(UI.margin(hb, 5, 0, 5, 4))
	pn.tooltip_text = tip
	if disabled: content.modulate = Color(0.55, 0.52, 0.48, 0.6)
	var cb = Callable() if disabled else fn
	if counts: _hotkeys.append(cb)
	if counts and UI.HOVER and _hotkeys.size() <= 9:
		var k = UI.label(str(_hotkeys.size()), 10, UI.TEXT_FAINT if disabled else UI.ACCENT_SOFT, "semibold")
		k.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		k.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		pn.add_child(UI.margin(k, 5, 2, 0, 0))
	v.add_child(pn)
	var l = UI.shadowed(UI.label(name, 11, UI.TEXT_FAINT if disabled else UI.TEXT, "medium", true))
	l.autowrap_mode = TextServer.AUTOWRAP_WORD
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.custom_minimum_size.x = UI.px(SLOT + 22)
	v.add_child(l)
	if not disabled: UI.tap(pn, fn)
	return v


func _action_slot(a: Dictionary) -> Control:
	var valor: bool = a.get("valorCost") != null
	var holder = Control.new()
	holder.custom_minimum_size = Vector2(UI.px(SLOT * 0.62), UI.px(SLOT * 0.62))
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var art: String = a.get("abilityArt", "") if a.get("abilityArt") != null else ""
	var pic: Control
	if art != "": pic = UI.picture(art, SLOT * 0.62, SLOT * 0.62, 5)
	else:
		var icon: String = a.get("spellIcon") if a.get("spellIcon") != null else (a.get("classIcon") if a.get("classIcon") != null else (a.abilityIcon if a.key == "ability" and a.get("abilityIcon") != null else ACTION_ICON.get(a.key, "sword")))
		pic = UI.center(UI.icon(icon, SLOT * 0.42, UI.VALOR if valor else GOLD_TEXT))
		pic.set_anchors_preset(Control.PRESET_FULL_RECT)
	holder.add_child(pic)
	var box = Control.new()
	box.custom_minimum_size = holder.custom_minimum_size
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(holder)
	# A cooldown reads as a big number over the dimmed picture.
	var cd: String = a.sub if a.sub != null and str(a.sub).begins_with("КД") else ""
	if cd != "":
		var n = UI.shadowed(UI.label(cd.substr(cd.find(":") + 1).strip_edges(), 20, UI.TEXT, "title"))
		n.set_anchors_preset(Control.PRESET_FULL_RECT)
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		n.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		box.add_child(n)
	if valor:
		var pips = UI.hbox(3, BoxContainer.ALIGNMENT_CENTER)
		for i in a.valorCost: pips.add_child(UI.valor_pip(true, 6))
		pips.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		pips.offset_top = UI.px(4); pips.offset_bottom = UI.px(12)
		box.add_child(pips)
	var key: String = a.key
	var needs: bool = a.needsTarget
	var fn = func():
		if needs:
			picking_heal = true
			_pick_key = key
			refresh()
		else: Game.b.raider_action(key)
	var border = UI.VALOR if valor else GOLD_LINE
	if a.key.begins_with("spell:"): border = Color(_res_color(), 0.75)
	if a.key == "defend": border = UI.BORDER_HOVER
	return _slot(box, a.label, _action_tip(a), fn, a.disabled, border)


# ── who's standing ─────────────────────────────────────────────────────────
func _hp_color(pct: float) -> Color:
	return UI.GOOD if pct > 55 else (UI.WARN if pct > 25 else UI.DANGER)


## Wide window: the foes still up, top right, each with its health; the
## target is marked, a click makes another one the target.
func _foe_list(s: Dictionary) -> Control:
	var foes = (s.enemies + s.minions).filter(func(e): return e.alive)
	if foes.is_empty(): return null
	var v = UI.vbox(6)
	v.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	v.offset_left = -UI.px(14 + 230); v.offset_right = -UI.px(14); v.offset_top = UI.px(14)
	v.add_child(UI.shadowed(UI.kicker("Цели", UI.TEXT_FAINT, 10.5)))
	for e in foes:
		var on: bool = s.focusId != null and e.id == s.focusId
		var id: int = e.id
		var pn = PanelContainer.new()
		var sb = StyleBoxFlat.new()
		sb.bg_color = Color(0.25, 0.06, 0.04, 0.85) if on else Color(0.063, 0.047, 0.035, 0.8)
		sb.border_color = UI.DANGER if on else Color(UI.DANGER, 0.35)
		sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(6)); sb.set_content_margin_all(UI.px(7))
		pn.add_theme_stylebox_override("panel", sb)
		var cv = UI.vbox(4)
		var top = UI.hbox(6)
		if on: top.add_child(UI.center(UI.icon("crosshair", 13, UI.DANGER, "fill")))
		top.add_child(UI.expand(UI.label(e.name, 13, UI.TEXT if on else UI.TEXT_MUTED, "medium")))
		top.add_child(UI.label("%d/%d" % [maxi(0, int(e.hp)), e.maxHp], 11, UI.TEXT_DIM))
		cv.add_child(top)
		cv.add_child(UI.progress(100.0 * e.hp / e.maxHp, UI.DANGER, 5))
		pn.add_child(cv)
		pn.tooltip_text = "Нажмите, чтобы сделать целью"
		UI.tap(pn, func(): Game.b.set_focus(id))
		v.add_child(pn)
	return v


## Phone: the same foes as chips under the turn order.
func _foe_chips(s: Dictionary) -> Control:
	var foes = (s.enemies + s.minions).filter(func(e): return e.alive)
	if foes.is_empty(): return null
	var flow = HFlowContainer.new()
	flow.alignment = FlowContainer.ALIGNMENT_CENTER
	flow.add_theme_constant_override("h_separation", UI.px(6))
	flow.add_theme_constant_override("v_separation", UI.px(6))
	flow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for e in foes:
		var on: bool = s.focusId != null and e.id == s.focusId
		var id: int = e.id
		flow.add_child(UI.chip("%s %d" % [e.name, maxi(0, int(e.hp))], on, func(): Game.b.set_focus(id), "crosshair" if on else ""))
	return flow


## Turn, zoom and straighten the view. Drag on the field (right button on a
## computer) does the same; keys Q/E, +/−, PgUp/PgDn, R.
func _camera_bar() -> Control:
	var v = UI.vbox(6) if App.wide else UI.hbox(6)
	var d = 38.0 if App.wide else 32.0
	var btn = func(icon: String, tip: String, fn: Callable) -> Control:
		var pn = PanelContainer.new()
		var sb = StyleBoxFlat.new()
		sb.bg_color = Color(0.063, 0.047, 0.035, 0.82); sb.border_color = GOLD_LINE
		sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(d * 0.5))
		pn.add_theme_stylebox_override("panel", sb)
		pn.custom_minimum_size = Vector2(UI.px(d), UI.px(d))
		pn.add_child(UI.center(UI.icon(icon, d * 0.45, GOLD_TEXT)))
		pn.tooltip_text = tip
		UI.tap(pn, fn)
		return pn
	v.add_child(btn.call("arrow-counter-clockwise", "Повернуть влево (Q)", func(): view.rotate_by(-45.0)))
	v.add_child(btn.call("arrow-clockwise", "Повернуть вправо (E)", func(): view.rotate_by(45.0)))
	v.add_child(btn.call("magnifying-glass-plus", "Приблизить (+, колесо)", func(): view.zoom_by(0.85)))
	v.add_child(btn.call("magnifying-glass-minus", "Отдалить (−, колесо)", func(): view.zoom_by(1.18)))
	v.add_child(btn.call("camera-rotate", "Вернуть камеру (R)", func(): view.reset_camera()))
	return v


func _res_color() -> Color:
	var cur = Game.b.current_raider()
	return Color(DB.specs.RESOURCES[cur.res.kind].color) if cur else GOLD_LINE


func _action_tip(a: Dictionary) -> String:
	var cur = Game.b.current_raider()
	if a.key.begins_with("spell:"):
		return "%s — %s%s" % [a.label, a.desc, ("\n" + a.sub) if a.sub else ""]
	match a.key:
		"attack": return "Обычный удар по цели." + ("\n" + a.sub if a.sub else "")
		"heal": return "Лечит союзника на выбор."
		"ability":
			var d = DB.ability(cur.candidateId) if cur else {}
			return "%s — %s%s" % [a.label, d.get("desc", ""), ("\n" + a.sub) if a.sub else ""]
		"valor": return "%s — %s\nСтоит %d доблести." % [a.label, a.sub, a.valorCost]
		"rally": return "Поднимает дух отряда."
		"defend": return "Оборона: −40% урона до следующего хода."
	return a.label + (("\n" + a.sub) if a.sub else "")


func _unhandled_input(ev: InputEvent) -> void:
	if not (ev is InputEventKey and ev.pressed and not ev.echo): return
	var s = Game.b.sim
	if s == null: return
	var done = true
	if ev.keycode >= KEY_1 and ev.keycode <= KEY_9:
		var i: int = ev.keycode - KEY_1
		if i < _hotkeys.size() and _hotkeys[i].is_valid(): _hotkeys[i].call()
	elif ev.keycode == KEY_SPACE:
		if Game.b.boss_intro: Game.b.end_boss_intro()
		elif s.movePhase and Game.b.current_raider() and not Game.settings.auto: Game.b.skip_move()
	elif ev.keycode == KEY_A:
		picking_heal = false
		Game.toggle_auto()
	elif ev.keycode == KEY_X: Game.toggle_speed()
	elif ev.keycode == KEY_ESCAPE and picking_heal:
		picking_heal = false
		refresh()
	else: done = false
	if done: get_viewport().set_input_as_handled()


## First-fight coaching: one tip at a time, each shown once, when it's relevant.
func _tip(s: Dictionary, cur) -> Control:
	if s.over or Game.settings.auto: return null
	var tip = ""
	if s.windup and Game.tip_pending("windup"): tip = "windup"
	elif s.danger and Game.tip_pending("danger"): tip = "danger"
	elif cur and s.movePhase and Game.tip_pending("move"): tip = "move"
	elif cur and not s.movePhase and s.encounterType != "boss" and Game.tip_pending("focus"): tip = "focus"
	elif cur and not s.movePhase and not picking_heal and Game.tip_pending("act"): tip = "act"
	elif cur and not s.movePhase and not picking_heal and s.valor >= 2 and Game.tip_pending("valor"): tip = "valor"
	if tip == "": return null
	var warn = tip == "danger" or tip == "windup"
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.82, 0.41, 0.36, 0.12) if warn else Color(UI.ACCENT, 0.12)
	sb.border_color = UI.DANGER if warn else UI.ACCENT; sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(8))
	sb.content_margin_left = UI.px(10); sb.content_margin_right = UI.px(10); sb.content_margin_top = UI.px(10); sb.content_margin_bottom = UI.px(10)
	pn.add_theme_stylebox_override("panel", sb)
	var row = UI.hbox(10)
	row.add_child(UI.icon("warning" if warn else "target", 16, UI.DANGER if warn else UI.ACCENT_SOFT))
	row.add_child(UI.label(DB.features.TIPS[tip], 13, UI.TEXT, "regular", true))
	row.add_child(UI.chip("Понятно", false, func(): Game.dismiss_tip(tip)))
	pn.add_child(row)
	return pn


## A boss fight opens on its title card; tap or wait to begin.
func _intro(bi: Dictionary) -> Control:
	var c = ColorRect.new()
	c.color = Color(0.03, 0.02, 0.04, 0.82)
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.mouse_filter = Control.MOUSE_FILTER_STOP
	var v = UI.vbox(10)
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	var m = UI.margin(v, 28, 0, 28, 0)
	m.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.add_child(m)
	var place = UI.kicker(bi.place, UI.ACCENT, 12)
	place.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(place)
	var n = UI.shadowed(UI.label(bi.name, 36, Color("#f4e6d4"), "title", true))
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(n)
	v.add_child(UI.center(UI.ornament(200, UI.DANGER)))
	var line = UI.label(bi.line, 15, UI.TEXT_MUTED, "italic", true)
	line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(line)
	var hint = UI.label("Нажмите, чтобы начать", 12.5, UI.TEXT_FAINT)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(UI.space(14))
	v.add_child(hint)
	v.size_flags_vertical = Control.SIZE_EXPAND_FILL
	m.get_child(0).size_flags_vertical = Control.SIZE_EXPAND_FILL
	UI.tap(c, Game.b.end_boss_intro, false)
	return c
