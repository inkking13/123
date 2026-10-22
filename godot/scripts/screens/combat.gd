extends Screen
## The fight: the 3D field behind, the state of the fight across the top, the
## hero's moves along the bottom. Taps on the field between them reach it.

const SIDE_W := 440.0
const ACTION_ICON := {"attack": "sword", "heal": "first-aid-kit", "ability": "flame", "interrupt": "hand-palm", "breakChain": "shield-chevron",
	"breakIce": "snowflake", "brace": "shield", "rally": "megaphone", "defend": "shield", "breakShell": "snowflake", "valor": "crown-simple"}
const DANGER_TITLE := {"meteor": "Огненный дождь по колоннам %s", "cleave": "Сокрушающий взмах по клеткам вокруг врага",
	"devour": "Пасть раскрыта над отмеченной клеткой", "backstab": "Удар в спину по заднему ряду"}
const GOLD_LINE := Color(0.79, 0.64, 0.42, 0.45)
const GOLD_TEXT := Color("#e6cf9c")

var view: BattleView
var picking_heal = false
## What keys 1–9 do this turn (the action tiles, or whom to heal).
var _hotkeys = []
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
	var s = Game.b.sim
	if s == null: return
	var cur = Game.b.current_raider()
	if cur == null: picking_heal = false
	_top = _top_panel(s)
	add_child(_top)
	_bottom = _bottom_panel(s, cur)
	add_child(_bottom)
	_cam = _camera_bar()
	add_child(_cam)
	if Game.b.boss_intro: add_child(_intro(Game.b.boss_intro))
	_measure.call_deferred()


# Wrapped labels start out tall at zero width; the panels must shrink back
# once they know their width, or they swallow the battlefield.
func _process(_d: float) -> void:
	if is_instance_valid(_bottom) and is_instance_valid(_top): _measure()


## Tells the field which strip of screen it shows through.
func _measure() -> void:
	if not is_instance_valid(view) or not is_instance_valid(_top): return
	var h = _bottom.get_combined_minimum_size().y
	if _bottom.size.y > h + 0.5: _bottom.offset_top = _bottom.offset_bottom - h
	if is_instance_valid(_cam):
		# Phone: up the right edge, just over the bottom panel. Wide: bottom-left corner.
		var ch = _cam.get_combined_minimum_size().y
		var bottom_y = get_viewport_rect().size.y - UI.px(14) if App.wide else _bottom.get_global_rect().position.y - UI.px(10)
		_cam.position = Vector2(UI.px(14) if App.wide else get_viewport_rect().size.x - _cam.size.x - UI.px(10), bottom_y - ch)
	if App.wide:
		# The panels sit in corners: the board takes the middle of the window.
		view.band_top = 0.0; view.band_bottom = 0.0
		return
	view.band_top = _top.get_global_rect().end.y
	view.band_bottom = get_viewport_rect().size.y - _bottom.get_global_rect().position.y


func _panel_style(alpha := 0.86) -> StyleBoxFlat:
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.063, 0.047, 0.035, alpha)
	sb.border_color = GOLD_LINE
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(UI.px(12))
	sb.content_margin_left = UI.px(10); sb.content_margin_right = UI.px(10)
	sb.content_margin_top = UI.px(10); sb.content_margin_bottom = UI.px(10)
	return sb


# ── the top: the foe, the turn order, the meters, what's coming ─────────────
func _top_panel(s: Dictionary) -> Control:
	var wrap = UI.vbox(8)
	if App.wide:
		# A card in the top-left corner; the field takes the rest of the window.
		wrap.set_anchors_preset(Control.PRESET_TOP_LEFT)
		wrap.offset_left = UI.px(14); wrap.offset_right = UI.px(14 + SIDE_W)
		wrap.offset_top = UI.px(14)
	else:
		wrap.set_anchors_preset(Control.PRESET_TOP_WIDE)
		wrap.offset_left = UI.px(10); wrap.offset_right = -UI.px(10)
		wrap.offset_top = App.inset_top() + UI.px(8)
	var pn = PanelContainer.new()
	pn.add_theme_stylebox_override("panel", _panel_style())
	pn.mouse_filter = Control.MOUSE_FILTER_STOP
	var v = UI.vbox(8)
	pn.add_child(v)
	var head = UI.hbox(10)
	if s.encounterType == "boss" and not Game.in_arena:
		var art = DB.boss_art_path(Game.dungeon_id)
		if art != "": head.add_child(UI.picture(art, 40, 40, 8))
	var hv = UI.vbox(4)
	var title = UI.hbox(6)
	title.add_child(UI.expand(UI.label(s.name + (" · фаза %d" % s.phase if s.encounterType == "boss" else ""), 15, GOLD_TEXT, "semibold")))
	var pct: float = maxf(0, 100.0 * s.boss.hp / s.boss.maxHp)
	title.add_child(UI.label("%d%%" % round(pct), 12, UI.TEXT_MUTED, "medium"))
	hv.add_child(title)
	hv.add_child(UI.progress(pct, UI.DANGER, 9))
	head.add_child(UI.expand(hv))
	v.add_child(head)
	# The turn queue: whoever acts now is bigger and ringed.
	var q = UI.hbox(6)
	for i in s.order.size():
		var entry: Dictionary = s.order[i]
		var active: bool = i == s.turnPos
		var size = 40.0 if active else 32.0
		if entry.kind == "boss":
			var disc = PanelContainer.new()
			var dsb = StyleBoxFlat.new(); dsb.set_corner_radius_all(UI.px(size * 0.5))
			dsb.bg_color = Color(0.82, 0.41, 0.36, 0.22) if active else Color(1, 1, 1, 0.03)
			dsb.border_color = UI.DANGER if active else UI.BORDER_STRONG; dsb.set_border_width_all(3 if active else 2)
			disc.add_theme_stylebox_override("panel", dsb)
			disc.custom_minimum_size = Vector2(UI.px(size), UI.px(size))
			disc.add_child(UI.center(UI.icon("skull", size * 0.45, UI.DANGER if active else UI.TEXT_FAINT)))
			q.add_child(UI.center(disc))
		else:
			var r = Game.b._raider(entry.id)
			if r == null: continue
			var pic = UI.portrait(r.candidateId, size, size * 0.5, not r.alive)
			if not r.alive or (not active and i < s.turnPos): pic.modulate.a = 0.5
			if active:
				var col: Color = DB.ROLE_COLOR[r.role]
				UI.overlay(pic, func(o): o.draw_arc(o.size * 0.5, o.size.x * 0.5 - 1, 0, TAU, 40, col, 3.0, true))
			q.add_child(UI.center(pic))
	q.add_child(UI.flex())
	var enraged: bool = s.round >= s.enrageAt
	var clock = UI.label(("Ярость\n×%.2f" % Game.b.enrage_mult()) if enraged else ("Раунд %d\nярость через %d" % [s.round, s.enrageAt - s.round]), 11.5, UI.DANGER if enraged else UI.TEXT_FAINT, "semibold" if enraged else "regular")
	clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	q.add_child(UI.center(clock))
	v.add_child(q)
	var meters = UI.hbox(12)
	var stunned: bool = s.stunned or s.vulnerableRounds > 0
	meters.add_child(_meter("Оглушён" if stunned else "Натиск", 100.0 if stunned else s.stagger, UI.WARN if stunned else UI.ACCENT, ""))
	var tilt_col = UI.DANGER if s.tilt >= 70 else (UI.WARN if s.tilt >= 40 else UI.GOOD)
	meters.add_child(_meter("Тилт", s.tilt, tilt_col, "%d%%" % round(s.tilt)))
	v.add_child(meters)
	var foes = _foe_row(s)
	if foes: v.add_child(foes)
	wrap.add_child(pn)
	if App.wide: wrap.add_child(_squad_panel(s))
	for b in _banners(s): wrap.add_child(b)
	return wrap


func _meter(label: String, pct: float, color: Color, value: String) -> Control:
	var v = UI.vbox(4)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var h = UI.hbox(4)
	h.add_child(UI.expand(UI.label(label.to_upper(), 10.5, UI.TEXT_FAINT, "medium")))
	if value != "": h.add_child(UI.label(value, 10.5, UI.TEXT_DIM))
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


# ── the bottom: the log, whose turn, valor, the moves ───────────────────────
func _bottom_panel(s: Dictionary, cur) -> Control:
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.063, 0.047, 0.035, 0.92)
	sb.border_color = UI.BORDER; sb.border_width_top = 2
	sb.content_margin_left = UI.px(14); sb.content_margin_right = UI.px(14)
	sb.content_margin_top = UI.px(10); sb.content_margin_bottom = UI.px(14) + App.inset_bottom()
	pn.add_theme_stylebox_override("panel", sb)
	if App.wide:
		# The log and the actions stand in the bottom-right corner.
		sb.set_border_width_all(2); sb.border_color = GOLD_LINE; sb.set_corner_radius_all(UI.px(12))
		sb.content_margin_bottom = UI.px(14)
		pn.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		pn.offset_left = -UI.px(14 + SIDE_W); pn.offset_right = -UI.px(14); pn.offset_bottom = -UI.px(14)
		pn.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	else:
		pn.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	pn.grow_vertical = Control.GROW_DIRECTION_BEGIN
	pn.mouse_filter = Control.MOUSE_FILTER_STOP
	var v = UI.vbox(8)
	pn.add_child(v)
	if not App.wide: v.add_child(_squad_strip(s))
	for e in s.log:
		var col = UI.GOOD if e.kind == "ok" else (UI.WARN if e.kind == "warn" else UI.TEXT_MUTED)
		v.add_child(UI.label(e.text, 12.5, col, "regular", true))
	if not s.over:
		var row = UI.hbox(8)
		var hint = ""
		if cur and not Game.settings.auto:
			if s.movePhase: hint = " · выберите клетку или пропустите" if not Game.b.reachable_cells().is_empty() else " · нет свободных клеток рядом"
			elif picking_heal: hint = " · выберите, кого лечить"
			elif s.encounterType == "boss": hint = " · цель: скелет или босс" if s.minions.any(func(m): return m.alive) else " · ближний бой вплотную к врагу"
			else: hint = " · нажмите на врага, чтобы выбрать цель"
		var who = RichTextLabel.new()
		who.bbcode_enabled = true
		who.fit_content = true
		who.scroll_active = false
		who.custom_minimum_size.x = UI.px(120)
		who.mouse_filter = Control.MOUSE_FILTER_IGNORE
		who.add_theme_font_override("normal_font", UI.FONTS.regular)
		who.add_theme_font_override("bold_font", UI.FONTS.semibold)
		who.add_theme_font_size_override("normal_font_size", UI.px(12.5))
		who.add_theme_font_size_override("bold_font_size", UI.px(13))
		who.add_theme_color_override("default_color", UI.TEXT_DIM)
		if cur and not Game.settings.auto: who.text = "[b][color=#e6cf9c]%s[/color][/b]%s" % [cur.name, hint]
		who.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(UI.expand(who))
		row.add_child(_valor(s.valor))
		row.add_child(UI.chip("×2" if Game.settings.speed >= 2 else "×1", Game.settings.speed >= 2, Game.toggle_speed, "fast-forward"))
		row.add_child(UI.chip("Авто", Game.settings.auto, func():
			picking_heal = false
			Game.toggle_auto(), "robot"))
		v.add_child(row)
	var tip = _tip(s, cur)
	if tip: v.add_child(tip)
	if cur == null:
		var l = UI.label("Противник замахивается для мощного удара!" if s.windup else ("Ход противника…" if s.turnPos >= 0 and s.turnPos < s.order.size() and s.order[s.turnPos].kind == "boss" else "…"), 14, UI.TEXT_FAINT)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.custom_minimum_size.y = UI.px(46)
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		v.add_child(l)
	elif Game.settings.auto:
		var row = UI.hbox(10)
		row.add_child(UI.expand(UI.label("Автобой · ход: " + cur.name, 14, UI.TEXT_MUTED)))
		row.add_child(UI.secondary_button("Взять управление", Game.toggle_auto, 40))
		v.add_child(row)
	elif s.movePhase:
		v.add_child(UI.secondary_button("Пропустить перемещение", Game.b.skip_move))
	elif picking_heal:
		var flow = HFlowContainer.new()
		flow.add_theme_constant_override("h_separation", UI.px(8))
		flow.add_theme_constant_override("v_separation", UI.px(8))
		for t in Game.b.heal_targets():
			var tid: int = t.id
			var heal = func():
				picking_heal = false
				Game.b.raider_action("heal", tid)
			_hotkeys.append(heal)
			var tag = ("%d · " % _hotkeys.size()) if UI.HOVER and _hotkeys.size() <= 9 else ""
			flow.add_child(UI.chip(tag + "%s · %d%%" % [t.name, t.hpPct], false, heal))
		v.add_child(flow)
		v.add_child(UI.ghost_link("Отмена", func():
			picking_heal = false
			refresh()))
	else:
		var grid = GridContainer.new()
		grid.columns = 4
		grid.add_theme_constant_override("h_separation", UI.px(8))
		grid.add_theme_constant_override("v_separation", UI.px(8))
		for a in Game.b.turn_actions(): grid.add_child(_action_tile(a))

		v.add_child(grid)
	return pn


# ── who's standing: the squad's health, the foes to pick from ───────────────
func _hp_color(pct: float) -> Color:
	return UI.GOOD if pct > 55 else (UI.WARN if pct > 25 else UI.DANGER)


## Taps a hero: while choosing whom to heal, heals them.
func _hero_tap(r: Dictionary) -> Callable:
	var id: int = r.id
	return func():
		if picking_heal and Game.b.heal_targets().any(func(t): return t.id == id):
			picking_heal = false
			Game.b.raider_action("heal", id)


## Wide window: the squad as a list under the foe's card.
func _squad_panel(s: Dictionary) -> Control:
	var pn = PanelContainer.new()
	pn.add_theme_stylebox_override("panel", _panel_style())
	pn.mouse_filter = Control.MOUSE_FILTER_STOP
	var v = UI.vbox(7)
	pn.add_child(v)
	var head = UI.hbox(6)
	head.add_child(UI.expand(UI.kicker("Отряд", UI.TEXT_FAINT, 10.5)))
	if picking_heal: head.add_child(UI.label("выберите, кого лечить", 11, UI.GOOD, "italic"))
	v.add_child(head)
	var cur = Game.b.current_raider()
	for r in s.raiders:
		var pct: float = maxf(0, 100.0 * r.hp / r.maxHp)
		var row = UI.hbox(8)
		var pic = UI.portrait(r.candidateId, 30, 15, not r.alive)
		if cur and r.id == cur.id:
			var col: Color = DB.ROLE_COLOR[r.role]
			UI.overlay(pic, func(o): o.draw_arc(o.size * 0.5, o.size.x * 0.5 - 1, 0, TAU, 32, col, 2.5, true))
		row.add_child(UI.center(pic))
		var info = UI.vbox(3)
		var top = UI.hbox(5)
		top.add_child(UI.expand(UI.label(r.name, 12.5, UI.TEXT if r.alive else UI.TEXT_FAINT, "medium")))
		if r.defending: top.add_child(UI.icon("shield", 12, UI.ACCENT_SOFT, "fill"))
		top.add_child(UI.label("%d/%d" % [maxi(0, int(r.hp)), r.maxHp] if r.alive else "пал", 11, UI.TEXT_DIM))
		info.add_child(top)
		info.add_child(UI.progress(pct, _hp_color(pct), 5))
		row.add_child(UI.expand(info))
		if picking_heal and r.alive and cur and r.id != cur.id: UI.tap(row, _hero_tap(r))
		v.add_child(row)
	return pn


## Phone: the squad as five small faces with health under each.
func _squad_strip(s: Dictionary) -> Control:
	var row = UI.hbox(6)
	var cur = Game.b.current_raider()
	for r in s.raiders:
		var pct: float = maxf(0, 100.0 * r.hp / r.maxHp)
		var cell = UI.vbox(3)
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var top = UI.hbox(4, BoxContainer.ALIGNMENT_CENTER)
		var pic = UI.portrait(r.candidateId, 24, 12, not r.alive)
		if cur and r.id == cur.id:
			var col: Color = DB.ROLE_COLOR[r.role]
			UI.overlay(pic, func(o): o.draw_arc(o.size * 0.5, o.size.x * 0.5 - 1, 0, TAU, 32, col, 2.5, true))
		top.add_child(pic)
		var n = UI.label(r.name, 11, UI.TEXT_MUTED if r.alive else UI.TEXT_FAINT, "medium")
		n.clip_text = true
		n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		top.add_child(n)
		if r.defending: top.add_child(UI.icon("shield", 10, UI.ACCENT_SOFT, "fill"))
		cell.add_child(top)
		cell.add_child(UI.progress(pct, _hp_color(pct), 4))
		if picking_heal and r.alive and cur and r.id != cur.id:
			cell.modulate = Color(1.15, 1.25, 1.1)
			UI.tap(cell, _hero_tap(r))
		row.add_child(cell)
	return row


## The foes still up, as chips: the ringed one is the target; tap to switch.
func _foe_row(s: Dictionary) -> Control:
	var foes = (s.enemies + s.minions).filter(func(e): return e.alive)
	if foes.is_empty(): return null
	var flow = HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", UI.px(6))
	flow.add_theme_constant_override("v_separation", UI.px(6))
	flow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for e in foes:
		var on: bool = s.focusId != null and e.id == s.focusId
		var id: int = e.id
		var chip = UI.chip("%s %d" % [e.name, maxi(0, int(e.hp))], on, func(): Game.b.set_focus(id), "crosshair" if on else "")
		chip.tooltip_text = "%s — %d/%d HP. Нажмите, чтобы сделать целью." % [e.name, maxi(0, int(e.hp)), e.maxHp]
		flow.add_child(chip)
	return flow


## Turn, zoom and straighten the view. Drag on the field (right button on a
## computer) does the same; keys Q/E, +/−, PgUp/PgDn, R.
func _camera_bar() -> Control:
	var v = UI.vbox(6)
	var btn = func(icon: String, tip: String, fn: Callable) -> Control:
		var pn = PanelContainer.new()
		var sb = StyleBoxFlat.new()
		sb.bg_color = Color(0.063, 0.047, 0.035, 0.82); sb.border_color = GOLD_LINE
		sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(19))
		pn.add_theme_stylebox_override("panel", sb)
		pn.custom_minimum_size = Vector2(UI.px(38), UI.px(38))
		pn.add_child(UI.center(UI.icon(icon, 17, GOLD_TEXT)))
		pn.tooltip_text = tip
		UI.tap(pn, fn)
		return pn
	v.add_child(btn.call("arrow-counter-clockwise", "Повернуть влево (Q)", func(): view.rotate_by(-45.0)))
	v.add_child(btn.call("arrow-clockwise", "Повернуть вправо (E)", func(): view.rotate_by(45.0)))
	v.add_child(btn.call("magnifying-glass-plus", "Приблизить (+, колесо)", func(): view.zoom_by(0.85)))
	v.add_child(btn.call("magnifying-glass-minus", "Отдалить (−, колесо)", func(): view.zoom_by(1.18)))
	v.add_child(btn.call("camera-rotate", "Вернуть камеру (R)", func(): view.reset_camera()))
	return v


func _valor(n: int) -> Control:
	var pn = PanelContainer.new()
	var sb = UI.frame_style("pill", Vector4(9, 0, 9, 0), 14)
	sb.border_color = Color(UI.VALOR, 0.4); sb.bg_color = Color(UI.VALOR, 0.07)
	pn.add_theme_stylebox_override("panel", sb)
	pn.custom_minimum_size.y = UI.px(28)
	pn.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var row = UI.hbox(6, BoxContainer.ALIGNMENT_CENTER)
	for i in Battle.VALOR_MAX: row.add_child(UI.center(UI.valor_pip(i < n)))
	pn.add_child(row)
	return pn


func _action_tile(a: Dictionary) -> Control:
	var valor: bool = a.get("valorCost") != null
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(UI.VALOR, 0.1) if valor else Color(0.79, 0.64, 0.42, 0.06)
	sb.border_color = UI.BORDER if a.disabled else (UI.VALOR if valor else GOLD_LINE)
	sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(10))
	sb.content_margin_left = UI.px(6); sb.content_margin_right = UI.px(6); sb.content_margin_top = UI.px(8); sb.content_margin_bottom = UI.px(8)
	pn.add_theme_stylebox_override("panel", sb)
	pn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if a.disabled: pn.modulate.a = 0.4
	var v = UI.vbox(4)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	var art: String = a.get("abilityArt", "") if a.get("abilityArt") != null else ""
	if art != "": v.add_child(UI.center(UI.picture(art, 30, 30, 7)))
	else:
		var icon: String = a.get("classIcon") if a.get("classIcon") != null else (a.abilityIcon if a.key == "ability" and a.get("abilityIcon") != null else ACTION_ICON.get(a.key, "sword"))
		v.add_child(UI.center(UI.icon(icon, 18, UI.TEXT_FAINT if a.disabled else (UI.VALOR if valor else GOLD_TEXT))))
	var l = UI.label(a.label, 12, UI.TEXT_FAINT if a.disabled else UI.TEXT, "medium", true)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l)
	if valor:
		var pips = UI.hbox(5, BoxContainer.ALIGNMENT_CENTER)
		for i in a.valorCost: pips.add_child(UI.valor_pip(true, 7))
		v.add_child(pips)
	elif a.sub != null:
		var sl = UI.label(a.sub, 10.5, UI.TEXT_FAINT)
		sl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		sl.clip_text = true
		v.add_child(sl)
	pn.add_child(v)
	pn.tooltip_text = _action_tip(a)
	var fn = Callable()
	if not a.disabled:
		var key: String = a.key
		var needs: bool = a.needsTarget
		fn = func():
			if needs:
				picking_heal = true
				refresh()
			else: Game.b.raider_action(key)
		UI.tap(pn, fn)
	_hotkeys.append(fn)
	if UI.HOVER and _hotkeys.size() <= 9:
		# The key that does it, in the corner.
		var k = UI.label(str(_hotkeys.size()), 10.5, UI.TEXT_FAINT, "semibold")
		k.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		k.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		k.position = Vector2(-UI.px(2), -UI.px(5))
		pn.add_child(k)
	return pn


func _action_tip(a: Dictionary) -> String:
	var cur = Game.b.current_raider()
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
