extends Screen
## The squad: who goes on the next trip, filters by role, each hero's file.

var role_filter = null


func build() -> void:
	var chosen: Array = Game.squad()
	var tanks = chosen.filter(func(c): return c.role == "tank").size()
	var heals = chosen.filter(func(c): return c.role == "heal").size()
	var ready = Game.squad_ready()
	var p = make_page(0, 24, 16)
	p.add_child(UI.kicker("Личные дела · %d в штате" % Game.pool.size()))
	p.add_child(UI.screen_title("Отряд"))
	p.add_child(UI.space(4))
	p.add_child(UI.label("Выбери пятерых на смену. Без танка и хилера поход закончится в первой комнате.", 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(16))
	# The five on shift: tap one to send them home.
	var slots = UI.hbox(8)
	for i in 5:
		var cell = PanelContainer.new()
		var sb = UI.frame_style("muted", Vector4(0, 0, 0, 0), 6)
		cell.add_theme_stylebox_override("panel", sb)
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cell.custom_minimum_size = Vector2(0, UI.px(76))
		UI.keep_ratio(cell, 1.15, 150)
		if i < chosen.size():
			var m: Dictionary = chosen[i]
			sb.border_color = DB.ROLE_COLOR[m.role]
			var pic = UI.portrait(m.id, 60, 5)
			pic.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			pic.size_flags_vertical = Control.SIZE_EXPAND_FILL
			cell.add_child(pic)
			# The name on a dark strip along the picture's foot.
			var n = UI.shadowed(UI.label(m.name, 11, Color("#f0e6cc"), "medium"))
			n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			n.clip_text = true
			var foot = UI.vbox(0)
			foot.add_child(UI.flex_v())
			var strip = UI.plate(n, Vector2(2, 1), 0.6, 0)
			var ssb: StyleBoxFlat = strip.get_theme_stylebox("panel")
			ssb.corner_radius_bottom_left = UI.px(5); ssb.corner_radius_bottom_right = UI.px(5)
			foot.add_child(strip)
			cell.add_child(foot)
			UI.tap(cell, func(): Game.toggle_select(m.id))
		else:
			cell.add_child(UI.center(UI.label("+", 20, UI.TEXT_FAINT)))
		slots.add_child(cell)
	p.add_child(slots)
	p.add_child(UI.space(14))
	var filters = UI.hbox(6)
	for r in [null, "tank", "heal", "dps"]:
		var label: String = ("Все (%d)" % Game.pool.size()) if r == null else DB.ROLE_NAME[r]
		filters.add_child(UI.chip(label, role_filter == r, func():
			role_filter = r
			refresh()))
	p.add_child(filters)
	p.add_child(UI.space(12))
	var list = UI.cards(8)
	p.add_child(list)
	for c in Game.pool:
		if role_filter != null and c.role != role_filter: continue
		list.add_child(_card(c))
	p.add_child(UI.space(120))
	# The tally and the way on.
	var dock = UI.vbox(10)
	var dm = UI.margin(dock, 16, 10, 16, 14)
	var bg = PanelContainer.new()
	var bsb = StyleBoxFlat.new(); bsb.bg_color = Color(0.063, 0.047, 0.035, 0.97)
	bg.add_theme_stylebox_override("panel", bsb)
	bg.add_child(dm)
	pin_bottom(bg)
	var tally = UI.hbox(6)
	tally.add_child(UI.expand(UI.label("%d/5 · Танк %d · Хилер %d · ДПС %d" % [chosen.size(), tanks, heals, chosen.size() - tanks - heals], 13, UI.TEXT_MUTED)))
	var warn = "" if not ready else ("Нет танка" if tanks == 0 else ("Нет хилера" if heals == 0 else "Состав готов"))
	tally.add_child(UI.label(warn, 13, UI.DANGER if ready and (tanks == 0 or heals == 0) else UI.GOOD))
	dock.add_child(tally)
	if Game.is_unlocked("gear"): dock.add_child(UI.primary_button("К снаряжению", func(): Game.go("gear"), "shield-chevron", "", 50, not ready))
	else: dock.add_child(UI.primary_button("В поход", Game.go_dungeon, "path", "", 50, not ready))


func _card(c: Dictionary) -> Control:
	var sel: bool = Game.selected.has(c.id)
	var card = PanelContainer.new()
	var sb = UI.frame_style("plain", Vector4(12, 12, 12, 12), 8)
	sb.border_color = UI.ACCENT if sel else UI.BORDER
	sb.bg_color = Color(0.78, 0.62, 0.37, 0.12) if sel else Color(0.07, 0.063, 0.078, 0.55)
	card.add_theme_stylebox_override("panel", sb)
	var row = UI.hbox(12)
	card.add_child(row)
	var pic = UI.portrait(c.id, 56, 8)
	row.add_child(pic)
	if sel:
		UI.overlay(pic, func(o):
			# A gold seal with a tick: on shift.
			var at = o.size - Vector2(UI.px(6), UI.px(6))
			var r = UI.px(10)
			o.draw_circle(at, r, UI.ACCENT)
			o.draw_arc(at, r, 0, TAU, 24, UI.BG, 2.0)
			o.draw_polyline(PackedVector2Array([at + Vector2(-0.45, 0.0) * r, at + Vector2(-0.1, 0.35) * r, at + Vector2(0.45, -0.3) * r]), UI.BG, 2.5))
	var info = UI.vbox(5)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var top = UI.hbox(6)
	top.add_child(UI.label(c.name, 16, UI.TEXT, "medium"))
	top.add_child(UI.center(UI.class_badge(c.heroClass)))
	info.add_child(top)
	var mid = UI.hbox(6)
	mid.add_child(UI.label(DB.ROLE_NAME[c.role].to_upper(), 11, DB.ROLE_COLOR[c.role], "medium"))
	mid.add_child(UI.label("Ур. %d" % c.level, 12, UI.TEXT_DIM))
	mid.add_child(UI.label(("HP %d · хил %d/с · ГС %d" % [c.hp, c.healPower, c.gs]) if c.role == "heal" else ("HP %d · урон %d/с · ГС %d" % [c.hp, c.dps, c.gs]), 12, UI.TEXT_DIM))
	info.add_child(mid)
	var bot = UI.hbox(8)
	bot.add_child(UI.label(DB.traits[c.trait].label, 11.5, UI.TEXT_MUTED))
	var mc = UI.GOOD if c.morale >= 60 else (UI.WARN if c.morale >= 30 else UI.DANGER)
	var bar = UI.progress(c.morale, mc, 3)
	bot.add_child(UI.center(bar))
	bar.get_parent().size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.custom_minimum_size.x = UI.px(80)
	bot.add_child(UI.label("%d%%" % c.morale, 11.5, UI.TEXT_FAINT))
	info.add_child(bot)
	row.add_child(info)
	var file = UI.frame("pill", Vector4(0, 0, 0, 0))
	file.custom_minimum_size = Vector2(UI.px(44), UI.px(44))
	file.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	file.add_child(UI.center(UI.icon("scroll", 17, UI.TEXT_DIM)))
	UI.tap(file, func(): Game.open_char(c.id))
	row.add_child(file)
	UI.tap(card, func(): Game.toggle_select(c.id))
	return card
