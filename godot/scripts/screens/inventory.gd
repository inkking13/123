extends Screen
## The guild's stash: gear (filter by slot and rarity), crafting materials, relics.

const RANK := ["unique", "legendary", "rare", "magic", "common"]

var tab = "gear"
var slot_filter = null
var rarity_filter = null
var free_only = false
## The item open in the sheet over the stash ("" for none).
var picked = ""


func build() -> void:
	var p = make_page(0)
	p.add_child(UI.back_link())
	p.add_child(UI.space(10))
	p.add_child(UI.screen_title("Инвентарь"))
	p.add_child(UI.space(14))
	var found = DB.curios.filter(func(c): return Game.curios_owned.has(c.id)).size()
	p.add_child(tab_row([["gear", "Снаряжение"], ["reagents", "Материалы"], ["curios", "Реликвии (%d/%d)" % [found, DB.curios.size()]]], tab, func(k):
		tab = k
		refresh()))
	p.add_child(UI.space(18))
	match tab:
		"gear": _gear(p)
		"reagents": _reagents(p)
		_: _curios(p)


func _gear(p: VBoxContainer) -> void:
	p.add_child(UI.label("Общий склад гильдии. Нажмите на предмет, чтобы надеть его на героя или продать лишнее.", 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(12))
	var all = Game.inventory_rows()
	if not all.is_empty():
		# Slots in one row that scrolls sideways; rarity and "free only" under it.
		var slots = UI.hbox(6)
		slots.add_child(UI.chip("Все (%d)" % all.size(), slot_filter == null, func():
			slot_filter = null
			refresh()))
		var seen = []
		for r in all:
			var l = DB.slot_label(r.slot)
			if l in seen: continue
			seen.append(l)
			slots.add_child(UI.chip(l, slot_filter == l, func():
				slot_filter = null if slot_filter == l else l
				refresh()))
		p.add_child(_sideways(slots))
		p.add_child(UI.space(8))
		var rest = UI.hbox(6)
		rest.add_child(UI.chip("Свободные", free_only, func():
			free_only = not free_only
			refresh(), "check" if free_only else ""))
		for k in RANK:
			if all.any(func(r): return DB.rarity_of(r.item) == k):
				rest.add_child(UI.chip(DB.gear_info.RARITY_NAME[k], rarity_filter == k, func():
					rarity_filter = null if rarity_filter == k else k
					refresh()))
		p.add_child(_sideways(rest))
		p.add_child(UI.space(14))
	var rows = all.filter(func(r): return (slot_filter == null or DB.slot_label(r.slot) == slot_filter) and (rarity_filter == null or DB.rarity_of(r.item) == rarity_filter) and (not free_only or r.free > 0))
	rows.sort_custom(func(a, b):
		var ra = RANK.find(DB.rarity_of(a.item)); var rb = RANK.find(DB.rarity_of(b.item))
		return ra < rb if ra != rb else a.item.name < b.item.name)
	if rows.is_empty():
		p.add_child(empty_note("Склад пуст. Победите босса — добыча появится здесь." if all.is_empty() else "Под эти фильтры ничего не подходит."))
		return
	# A grid of tiles: a whole stash in view instead of a long list of cards.
	var grid = GridContainer.new()
	grid.columns = 8 if App.wide else 4
	grid.add_theme_constant_override("h_separation", UI.px(8))
	grid.add_theme_constant_override("v_separation", UI.px(12))
	for r in rows: grid.add_child(_tile(r))
	p.add_child(grid)
	var pick = null
	for r in all:
		if r.item.id == picked: pick = r
	if pick: add_child(_sheet(pick))
	else: picked = ""


## A row of chips that scrolls sideways when it doesn't fit.
func _sideways(row: Control) -> Control:
	var sc = ScrollContainer.new()
	sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	sc.custom_minimum_size.y = UI.px(30)
	sc.add_child(row)
	return sc


## One item: its picture in a rarity frame, how many are free, a dot if someone wears it.
func _tile(r: Dictionary) -> Control:
	var rar = DB.rarity_of(r.item)
	var tint = DB.rarity_color(rar)
	var v = UI.vbox(5)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = EquipmentPanel.CELL_BG
	sb.border_color = Color(tint, 0.85 if r.free > 0 else 0.45)
	sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(6))
	pn.add_theme_stylebox_override("panel", sb)
	pn.custom_minimum_size = Vector2(UI.px(70), UI.px(70))
	pn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	sb.set_content_margin_all(UI.px(2))
	var pic = UI.picture(DB.item_icon_path(r.item.get("icon")), 64, 64, 4)
	if r.free <= 0: pic.modulate = Color(0.6, 0.58, 0.55)
	pn.add_child(UI.center(pic))
	var free: int = r.free
	var worn: bool = not r.wornBy.is_empty()
	UI.overlay(pn, func(o):
		if worn:
			o.draw_circle(Vector2(UI.px(10), UI.px(10)), UI.px(5.5), UI.GOOD)
			o.draw_arc(Vector2(UI.px(10), UI.px(10)), UI.px(5.5), 0, TAU, 16, Color.BLACK, 1.5)
		var f: Font = UI.FONTS.bold
		var t = "×%d" % free
		var at = Vector2(o.size.x - UI.px(6) - f.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, UI.px(13)).x, o.size.y - UI.px(6))
		o.draw_string_outline(f, at, t, HORIZONTAL_ALIGNMENT_LEFT, -1, UI.px(13), 6, Color.BLACK)
		o.draw_string(f, at, t, HORIZONTAL_ALIGNMENT_LEFT, -1, UI.px(13), Color("#f1e3c0") if free > 0 else UI.TEXT_FAINT))
	v.add_child(pn)
	var l = UI.label(r.item.name, 11, tint if r.free > 0 else Color(tint, 0.6), "medium", true)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.custom_minimum_size.x = UI.px(74)
	v.add_child(l)
	var id: String = r.item.id
	UI.tap(pn, func():
		picked = id
		refresh())
	return v


## The picked item, in a sheet over the stash: what it gives, who wears it,
## a tap on a hero of the squad to put it on (or take it off), and the sale.
func _sheet(r: Dictionary) -> Control:
	var o: Dictionary = r.item
	var rar = DB.rarity_of(o)
	var tint = DB.rarity_color(rar)
	var shade = ColorRect.new()
	shade.color = Color(0.02, 0.015, 0.01, 0.6)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	UI.tap(shade, func():
		picked = ""
		refresh(), false)
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color("#0d0c0a"); sb.border_color = Color(tint, 0.7)
	sb.set_border_width_all(1); sb.border_width_top = 5
	sb.set_corner_radius_all(UI.px(10))
	sb.set_content_margin_all(UI.px(14))
	pn.add_theme_stylebox_override("panel", sb)
	pn.mouse_filter = Control.MOUSE_FILTER_STOP
	pn.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	pn.grow_vertical = Control.GROW_DIRECTION_BEGIN
	if App.wide:
		var vw = get_viewport_rect().size.x
		var w = UI.px(520)
		pn.offset_left = (vw - w) * 0.5; pn.offset_right = -(vw - w) * 0.5
		pn.offset_bottom = -UI.px(24)
	else:
		pn.offset_left = UI.px(10); pn.offset_right = -UI.px(10)
		pn.offset_bottom = -UI.px(Tabs.HEIGHT + 30) - App.inset_bottom()
	shade.add_child(pn)
	var v = UI.vbox(6)
	pn.add_child(v)
	var top = UI.hbox(12)
	top.add_child(UI.picture(DB.item_icon_path(o.get("icon")), 56, 56, 4))
	var names = UI.vbox(2)
	names.add_child(UI.label(o.name, 17, tint, "semibold", true))
	names.add_child(UI.label("%s · %s" % [DB.gear_info.RARITY_NAME[rar], DB.slot_label(r.slot)], 12.5, UI.TEXT_DIM))
	var set_name = DB.set_name_of(o.id)
	if set_name: names.add_child(UI.label("Комплект: " + set_name, 12.5, Color(DB.gear_info.SET_COLOR)))
	top.add_child(UI.expand(names))
	var close = UI.icon("x", 18, UI.TEXT_DIM)
	var cb = UI.center(close)
	cb.custom_minimum_size = Vector2(UI.px(36), UI.px(36))
	cb.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	UI.tap(cb, func():
		picked = ""
		refresh())
	top.add_child(cb)
	v.add_child(top)
	v.add_child(UI.rule(EquipmentPanel.GOLD_DIM))
	var stats = DB.stat_lines(o)
	if stats.is_empty(): v.add_child(UI.label("Без характеристик", 13, UI.TEXT_FAINT))
	for l in stats: v.add_child(UI.label(l.text, 13.5, EquipmentPanel.GOOD_TEXT if l.good else EquipmentPanel.BAD_TEXT))
	# The description mostly repeats the numbers; it's shown only for a piece without any.
	if stats.is_empty() and o.get("desc", "") != "": v.add_child(UI.label(o.desc, 12.5, UI.TEXT_DIM, "italic", true))
	v.add_child(UI.space(4))
	v.add_child(UI.label(("Свободно %d из %d" % [r.free, r.owned]) + ((" · носят: " + ", ".join(r.wornBy)) if not r.wornBy.is_empty() else ""), 12.5, UI.ACCENT_SOFT, "regular", true))
	# The squad: tap to put it on; a hero who wears it takes it off.
	v.add_child(UI.space(2))
	v.add_child(UI.kicker("Надеть на героя", UI.TEXT_FAINT, 10.5))
	var heroes = UI.hbox(8)
	var kind = DB.slot_kind(r.slot)
	for c in Game.squad():
		heroes.add_child(_hero_pick(c, kind, o, r.free))
	v.add_child(_sideways(heroes))
	var price = Game.sell_price(o) if o.get("price") != null and o.price > 0 else 0
	if price > 0:
		v.add_child(UI.space(2))
		var sell = UI.hbox(8)
		sell.add_child(UI.expand(UI.label("Продать один свободный" if r.free > 0 else "Продать нельзя — все надеты", 12.5, UI.TEXT_DIM if r.free > 0 else UI.TEXT_FAINT)))
		var slot: String = r.slot
		var id: String = o.id
		sell.add_child(pill_button("+%d" % price, r.free > 0, func(): Game.sell_item(slot, id), "coins"))
		v.add_child(sell)
	return shade


func _hero_pick(c: Dictionary, kind: String, o: Dictionary, free: int) -> Control:
	var slots: Array = DB.slots_for_kind(kind)
	var wearing = ""
	for s in slots:
		if c.equipment.get(s) == o.id: wearing = s
	# Into an empty slot of that kind if there is one, else over the first.
	var target: String = slots[0]
	for s in slots:
		if c.equipment.get(s, "none") == "none":
			target = s
			break
	var can = wearing != "" or free > 0
	var cell = UI.vbox(3)
	var pic = UI.portrait(c.id, 46, 6)
	if not can: pic.modulate.a = 0.4
	var on = wearing != ""
	UI.overlay(pic, func(ov):
		ov.draw_rect(Rect2(Vector2.ONE, ov.size - Vector2(2, 2)), UI.GOOD if on else Color(DB.ROLE_COLOR[c.role], 0.6), false, 3.0 if on else 1.5))
	cell.add_child(UI.center(pic))
	var cap = UI.label(c.name, 10.5, UI.TEXT if on else (UI.TEXT_MUTED if can else UI.TEXT_FAINT), "medium")
	cap.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	cap.custom_minimum_size.x = UI.px(54)
	cap.clip_text = true
	cell.add_child(cap)
	var what = UI.label("снять" if on else ("надеть" if can else "нет свободных"), 9.5, UI.GOOD if on else (UI.ACCENT if can else UI.TEXT_FAINT))
	what.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	cell.add_child(what)
	var id: String = o.id
	if on: UI.tap(cell, func(): Game.equip(c, wearing, "none"))
	elif can: UI.tap(cell, func(): Game.equip(c, target, id))
	return cell


func _reagents(p: VBoxContainer) -> void:
	p.add_child(UI.label("Материалы для крафта — падают с врагов в подземельях, каждая земля даёт свой вид сырья.", 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(18))
	var any = false
	var list1 = UI.cards(10)
	p.add_child(list1)
	for r in DB.reagents.REAGENTS:
		var n = Game.reagent_owned(r.id)
		if n <= 0: continue
		any = true
		list1.add_child(item_card(DB.item_icon_path(r.icon), "", r.name, r.desc, UI.TEXT, UI.label(str(n), 18, UI.ACCENT_SOFT, "medium")))
	if not any: p.add_child(empty_note("Материалов пока нет — они падают с побеждённых врагов в походах."))


func _curios(p: VBoxContainer) -> void:
	p.add_child(UI.label("Трофеи и диковины без боевой пользы — просто то, что стоит найти. Падают с любого боя.", 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(18))
	var grid = GridContainer.new()
	grid.columns = 8 if App.wide else 4
	grid.add_theme_constant_override("h_separation", UI.px(8))
	grid.add_theme_constant_override("v_separation", UI.px(14))
	for c in DB.curios:
		var owned: bool = Game.curios_owned.has(c.id)
		var v = UI.vbox(5)
		v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if owned: v.add_child(UI.center(UI.picture(DB.item_icon_path(c.icon), 72, 72, 10)))
		else:
			var box = UI.frame("muted", Vector4(0, 0, 0, 0))
			box.custom_minimum_size = Vector2(UI.px(72), UI.px(72))
			box.add_child(UI.center(UI.label("?", 22, UI.TEXT_FAINT)))
			v.add_child(UI.center(box))
		var l = UI.label(c.name if owned else "Не найдено", 11, UI.TEXT_MUTED if owned else UI.TEXT_FAINT, "regular", true)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(l)
		grid.add_child(v)
	p.add_child(grid)


func close_overlay() -> bool:
	if picked == "": return false
	picked = ""
	refresh()
	return true
