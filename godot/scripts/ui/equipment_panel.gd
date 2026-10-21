class_name EquipmentPanel
## Diablo-style character sheet: the hero framed in the middle, worn pieces
## round them, the guild stash for the tapped slot, and a rarity-coloured
## tooltip comparing the picked piece with the worn one.
## `state` is the owning screen's {slot, item} pick, kept across rebuilds.

const GOLD := Color("#8f6f45")
const GOLD_DIM := Color("#4a3f2c")
const PANEL_BG := Color("#12100d")
const CELL_BG := Color("#1a1712")
const LEFT := ["helm", "shoulders", "chest", "belt", "pants", "boots"]
const RIGHT := ["necklace", "cloak", "gloves", "ring1", "ring2"]
const GOOD_TEXT := Color("#9fd4a8")
const BAD_TEXT := Color("#e0857a")


static func make(c: Dictionary, state: Dictionary, on_change: Callable) -> Control:
	var vm: Dictionary = Game.equipment_vm(c)
	var by = {}
	for s in vm.slots: by[s.slot] = s
	if not state.has("slot"): state.slot = "weapon"
	var slot: Dictionary = by[state.slot]
	var picked = null
	for i in slot.stash:
		if i.item.id == state.get("item"): picked = i
	if picked == null: picked = slot.equipped if slot.equipped else (slot.stash[0] if not slot.stash.is_empty() else null)

	var panel = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = PANEL_BG; sb.border_color = GOLD; sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(6))
	sb.content_margin_left = UI.px(12); sb.content_margin_right = UI.px(12); sb.content_margin_top = UI.px(12); sb.content_margin_bottom = UI.px(12)
	panel.add_theme_stylebox_override("panel", sb)
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.draw.connect(func(): panel.draw_rect(Rect2(Vector2.ZERO, panel.size).grow(-UI.px(3)), GOLD_DIM, false, 1.5))
	var v = UI.vbox(10)
	panel.add_child(v)
	var head = UI.hbox(8)
	head.add_child(UI.expand(UI.rule(GOLD)))
	head.add_child(UI.label("СНАРЯЖЕНИЕ", 12.5, Color("#d9c595"), "semibold"))
	head.add_child(UI.expand(UI.rule(GOLD)))
	for r in [head.get_child(0), head.get_child(2)]: r.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	v.add_child(head)

	var pick_slot = func(k: String):
		state.slot = k
		state.erase("item")
		on_change.call()
	var cell = func(k: String, w := 48.0, h := 48.0) -> Control:
		var col = UI.vbox(2)
		col.add_child(_slot_cell(k, by[k].equipped, w, h, state.slot == k, func(): pick_slot.call(k)))
		var l = UI.label(by[k].label, 10, Color("#a8966c"))
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(l)
		return col
	var body = UI.hbox(10, BoxContainer.ALIGNMENT_CENTER)
	var left = UI.vbox(6)
	for k in LEFT: left.add_child(cell.call(k))
	body.add_child(left)
	var mid = UI.vbox(6)
	var pic = UI.portrait(c.id, 132, 4)
	pic.custom_minimum_size = Vector2(UI.px(132), UI.px(172))
	pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var frame = UI.vbox(0)
	frame.add_child(pic)
	var nm = UI.label(c.name, 14, Color("#efe4c8"), "semibold")
	nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	frame.add_child(nm)
	var lv = UI.label("Ур. %d" % c.level, 11, DB.ROLE_COLOR[c.role])
	lv.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	frame.add_child(lv)
	mid.add_child(frame)
	var hands = UI.hbox(6)
	hands.add_child(cell.call("weapon", 63, 52))
	hands.add_child(cell.call("offhand", 63, 52))
	mid.add_child(hands)
	var accs = UI.hbox(6)
	accs.add_child(cell.call("acc1", 63, 48))
	accs.add_child(cell.call("acc2", 63, 48))
	mid.add_child(accs)
	body.add_child(mid)
	var right = UI.vbox(6)
	for k in RIGHT: right.add_child(cell.call(k))
	body.add_child(right)
	v.add_child(body)

	var totals = HFlowContainer.new()
	totals.alignment = FlowContainer.ALIGNMENT_CENTER
	totals.add_theme_constant_override("h_separation", UI.px(6))
	totals.add_theme_constant_override("v_separation", UI.px(6))
	if vm.totals.is_empty():
		totals.add_child(UI.label("Снаряжение не даёт бонусов", 12, UI.TEXT_FAINT))
	for t in vm.totals:
		var chip = PanelContainer.new()
		var csb = StyleBoxFlat.new(); csb.bg_color = CELL_BG; csb.border_color = GOLD_DIM; csb.set_border_width_all(1); csb.set_corner_radius_all(3)
		csb.content_margin_left = UI.px(8); csb.content_margin_right = UI.px(8); csb.content_margin_top = UI.px(3); csb.content_margin_bottom = UI.px(3)
		chip.add_theme_stylebox_override("panel", csb)
		chip.add_child(UI.label(t.text, 12, GOOD_TEXT if t.good else BAD_TEXT))
		totals.add_child(chip)
	v.add_child(totals)
	v.add_child(UI.rule(GOLD_DIM))
	v.add_child(UI.label("ТАЙНИК ГИЛЬДИИ · %s" % slot.label.to_upper(), 11, Color("#a8966c"), "medium"))
	if slot.stash.is_empty():
		v.add_child(UI.label("Пусто — добывайте предметы в подземельях или у торговца.", 13, UI.TEXT_FAINT, "regular", true))
	else:
		var flow = HFlowContainer.new()
		flow.add_theme_constant_override("h_separation", UI.px(6))
		flow.add_theme_constant_override("v_separation", UI.px(6))
		for i in slot.stash:
			var it: Dictionary = i
			flow.add_child(_stash_cell(it, picked != null and picked.item.id == it.item.id, func():
				state.item = it.item.id
				on_change.call()))
		v.add_child(flow)
	if picked: v.add_child(_tooltip(c, slot, picked))
	return panel


static func _item_pic(item: Dictionary, size: float) -> TextureRect:
	return UI.picture(DB.item_icon_path(item.get("icon")), size, size, 3)


static func _slot_cell(slot: String, it, w: float, h: float, active: bool, fn: Callable) -> Control:
	var tint: Color = DB.rarity_color(it.rarity) if it else GOLD_DIM
	var p = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = CELL_BG; sb.border_color = Color("#f1e3c0") if active else tint; sb.set_border_width_all(3 if active else 2); sb.set_corner_radius_all(UI.px(4))
	p.add_theme_stylebox_override("panel", sb)
	p.custom_minimum_size = Vector2(UI.px(w), UI.px(h))
	var size = minf(w, h) - 14
	if it:
		p.add_child(UI.center(_item_pic(it.item, size)))
	else:
		var ic = UI.icon(DB.gear_info.SLOT_SILHOUETTE[slot], size * 0.5, GOLD)
		ic.modulate.a = 0.35
		p.add_child(UI.center(ic))
	UI.tap(p, fn)
	return p


static func _stash_cell(it: Dictionary, active: bool, fn: Callable) -> Control:
	var tint = DB.rarity_color(it.rarity)
	var p = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = CELL_BG; sb.border_color = Color("#f1e3c0") if active else Color(tint, 0.4 if not it.available else 0.8); sb.set_border_width_all(3 if active else 2); sb.set_corner_radius_all(UI.px(4))
	p.add_theme_stylebox_override("panel", sb)
	p.custom_minimum_size = Vector2(UI.px(56), UI.px(56))
	if not it.available: p.modulate.a = 0.5
	p.add_child(UI.center(_item_pic(it.item, 44)))
	var n: int = it.free
	var worn: bool = it.worn
	p.draw.connect(func():
		if worn: p.draw_circle(Vector2(UI.px(9), UI.px(9)), UI.px(7), UI.GOOD)
		if n > 0:
			var f: Font = UI.FONTS.bold
			p.draw_string_outline(f, Vector2(p.size.x - UI.px(10), p.size.y - UI.px(4)), str(n), HORIZONTAL_ALIGNMENT_LEFT, -1, UI.px(11), 4, Color.BLACK)
			p.draw_string(f, Vector2(p.size.x - UI.px(10), p.size.y - UI.px(4)), str(n), HORIZONTAL_ALIGNMENT_LEFT, -1, UI.px(11), Color("#f1e3c0")))
	UI.tap(p, fn)
	return p


static func _tooltip(c: Dictionary, slot: Dictionary, it: Dictionary) -> Control:
	var tint = DB.rarity_color(it.rarity)
	var p = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color("#0d0c0a"); sb.border_color = Color(tint, 0.6); sb.set_border_width_all(1); sb.border_width_top = 5; sb.set_corner_radius_all(UI.px(4))
	sb.content_margin_left = UI.px(12); sb.content_margin_right = UI.px(12); sb.content_margin_top = UI.px(12); sb.content_margin_bottom = UI.px(12)
	p.add_theme_stylebox_override("panel", sb)
	var v = UI.vbox(4)
	p.add_child(v)
	var top = UI.hbox(12)
	top.add_child(_item_pic(it.item, 52))
	var names = UI.vbox(2)
	names.add_child(UI.label(it.item.name, 17, tint, "semibold", true))
	names.add_child(UI.label("%s · %s" % [DB.gear_info.RARITY_NAME[it.rarity], slot.label], 12.5, UI.TEXT_DIM))
	if it.setName: names.add_child(UI.label("Комплект: " + it.setName, 12.5, Color(DB.gear_info.SET_COLOR)))
	top.add_child(UI.expand(names))
	v.add_child(top)
	v.add_child(UI.space(4))
	v.add_child(UI.rule(GOLD_DIM))
	if it.stats.is_empty(): v.add_child(UI.label("Без характеристик", 13, UI.TEXT_FAINT))
	for l in it.stats: v.add_child(UI.label(l.text, 13.5, GOOD_TEXT if l.good else BAD_TEXT))
	if not it.compare.is_empty():
		v.add_child(UI.space(4))
		v.add_child(UI.label(("Против надетого" if slot.equipped else "Против пустого слота").to_upper(), 11, UI.TEXT_FAINT))
		for l in it.compare: v.add_child(UI.label(l.text, 13.5, GOOD_TEXT if l.good else BAD_TEXT))
	v.add_child(UI.space(4))
	v.add_child(UI.label(it.item.desc, 12.5, UI.TEXT_DIM, "italic", true))
	var foot = UI.hbox(10)
	var status: String = "Надето" if it.worn else (("В тайнике: %d" % it.free) if it.available else "Всё занято: " + ", ".join(it.wornBy))
	foot.add_child(UI.label(status, 12.5, UI.TEXT_FAINT if it.available or it.worn else UI.DANGER, "regular", true))
	var btn = PanelContainer.new()
	var bsb = StyleBoxFlat.new(); bsb.set_corner_radius_all(UI.px(4))
	bsb.content_margin_left = UI.px(16); bsb.content_margin_right = UI.px(16)
	if it.worn:
		bsb.bg_color = Color(0, 0, 0, 0); bsb.border_color = GOLD; bsb.set_border_width_all(1)
	else:
		bsb.bg_color = Color("#a3884f") if it.available else Color("#3a3428")
	btn.add_theme_stylebox_override("panel", bsb)
	btn.custom_minimum_size = Vector2(0, UI.px(34))
	var bl = UI.label("Снять" if it.worn else "Надеть", 14, Color("#e6d6b0") if it.worn else (Color("#15120c") if it.available else UI.TEXT_FAINT), "semibold")
	bl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	btn.add_child(bl)
	var slot_key: String = slot.slot
	var gear_id: String = it.item.id
	if it.worn: UI.tap(btn, func(): Game.equip(c, slot_key, "none"))
	elif it.available: UI.tap(btn, func(): Game.equip(c, slot_key, gear_id))
	foot.add_child(btn)
	v.add_child(foot)
	return p
