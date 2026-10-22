class_name Tabs
## The bottom bar: camp, squad, the raised wax seal that goes straight to the
## next dungeon (long press: the map), arena and KPI. On a wide window the same
## tabs stand in a rail down the left edge.

const HEIGHT := 62.0
const RAIL := 104.0
const TAB_OF := {"roster": "roster", "char": "roster", "talents": "roster", "gear": "roster", "profession": "roster", "levelmap": "levelmap", "arena": "arena", "quests": "quests"}


static func make() -> Control:
	if App.wide: return _rail()
	var root = Control.new()
	root.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	var h = UI.px(HEIGHT) + App.inset_bottom()
	root.offset_top = -h
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg = UI.fade(Color("#21180f"), Color("#0c0806"), HEIGHT)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(bg)
	var line = ColorRect.new()
	line.color = Color("#8f6f45")
	line.set_anchors_preset(Control.PRESET_TOP_WIDE)
	line.custom_minimum_size = Vector2(0, 2)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(line)
	var row = UI.hbox(0)
	row.set_anchors_preset(Control.PRESET_FULL_RECT)
	row.offset_bottom = -App.inset_bottom()
	row.offset_left = UI.px(6); row.offset_right = -UI.px(6)
	root.add_child(row)
	var lit: String = TAB_OF.get(Game.screen, "home")
	var reward = Game.quest_rows().any(func(q): return q.achieved and not q.claimed)
	row.add_child(_tab("home", "Лагерь", "campfire", lit))
	row.add_child(_tab("roster", "Отряд", "users-three", lit, not Game.squad_ready()))
	row.add_child(_seal(lit == "levelmap"))
	row.add_child(_tab("arena", "Арена", "sword", lit, false, not Game.is_unlocked("arena")))
	row.add_child(_tab("quests", "KPI", "scroll", lit, reward and Game.is_unlocked("quests"), not Game.is_unlocked("quests")))
	return root


static func _rail() -> Control:
	var root = Control.new()
	root.set_anchors_preset(Control.PRESET_LEFT_WIDE)
	root.offset_right = UI.px(RAIL)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bg = ColorRect.new()
	bg.color = Color(0.07, 0.05, 0.035, 0.94)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_STOP
	root.add_child(bg)
	var line = ColorRect.new()
	line.color = Color("#8f6f45")
	line.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
	line.offset_left = -2
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(line)
	var col = UI.vbox(28)
	col.set_anchors_preset(Control.PRESET_FULL_RECT)
	col.offset_top = UI.px(30); col.offset_bottom = -UI.px(24)
	root.add_child(col)
	var lit: String = TAB_OF.get(Game.screen, "home")
	var reward = Game.quest_rows().any(func(q): return q.achieved and not q.claimed)
	var seal = _seal(lit == "levelmap")
	seal.size_flags_horizontal = Control.SIZE_FILL
	seal.custom_minimum_size.y = UI.px(64)
	col.add_child(seal)
	col.add_child(_tab("home", "Лагерь", "campfire", lit))
	col.add_child(_tab("roster", "Отряд", "users-three", lit, not Game.squad_ready()))
	col.add_child(_tab("arena", "Арена", "sword", lit, false, not Game.is_unlocked("arena")))
	col.add_child(_tab("quests", "KPI", "scroll", lit, reward and Game.is_unlocked("quests"), not Game.is_unlocked("quests")))
	col.add_child(UI.flex_v())
	var gear = _tab("settings", "Настройки", "gear", "settings" if Game.screen == "settings" else lit)
	col.add_child(gear)
	return root


static func _tab(screen: String, label: String, icon: String, lit: String, badge := false, locked := false) -> Control:
	var active = screen == lit
	var col = UI.ACCENT_BRIGHT if active else (Color("#5c5144") if locked else Color("#8e7f69"))
	var v = UI.vbox(3)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var ic = UI.icon(icon, 23, col, "fill" if active else "regular")
	if locked: ic.modulate.a = 0.35
	var ic_box = UI.center(ic)
	if badge:
		var dot = Control.new()
		dot.custom_minimum_size = Vector2(UI.px(9), UI.px(9))
		dot.draw.connect(func(): dot.draw_circle(dot.size * 0.5, dot.size.x * 0.5, UI.DANGER))
		dot.position = Vector2(UI.px(26), 0)
		ic_box.add_child(dot)
	v.add_child(ic_box)
	var l = UI.label(label, 12, col, "title" if active else "caps")
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l)
	if active:
		v.draw.connect(func():
			var w = UI.px(34)
			if App.wide: v.draw_rect(Rect2(0, v.size.y * 0.5 - w * 0.5, 3, w), UI.ACCENT_BRIGHT)
			else: v.draw_rect(Rect2(v.size.x * 0.5 - w * 0.5, 0, w, 3), UI.ACCENT_BRIGHT))
	if not locked: UI.tap(v, func(): Game.go("settings") if screen == "settings" else Game.go_tab(screen))
	return v


static func _seal(lit: bool) -> Control:
	var v = UI.vbox(3)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var holder = Control.new()
	holder.custom_minimum_size = Vector2(0, UI.px(23))
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var seal = UI.wax_seal(54, "sword", -6)
	# On the bar the seal rises above it; in the rail it sits in line.
	var lift = 0 if App.wide else UI.px(31)
	if App.wide: holder.custom_minimum_size.y = UI.px(54)
	seal.position = Vector2(-UI.px(27), -lift)
	var c = UI.center(holder)
	holder.resized.connect(func(): seal.position = Vector2(holder.size.x * 0.5 - UI.px(27), -lift))
	holder.add_child(seal)
	v.add_child(c)
	var l = UI.label("В поход", 12, UI.ACCENT_BRIGHT, "title")
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l)
	# Tap: the next dungeon. Hold: the campaign map.
	var held = {"t": 0}
	v.mouse_filter = Control.MOUSE_FILTER_STOP
	v.gui_input.connect(func(ev: InputEvent):
		if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT:
			if ev.pressed: held.t = Time.get_ticks_msec()
			elif held.t > 0:
				var long = Time.get_ticks_msec() - held.t > 500
				held.t = 0
				if long: Game.go_tab("levelmap")
				else: Game.quick_raid())
	return v
