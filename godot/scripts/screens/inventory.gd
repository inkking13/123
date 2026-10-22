extends Screen
## The guild's stash: gear (filter by slot and rarity), crafting materials, relics.

const RANK := ["unique", "legendary", "rare", "magic", "common"]

var tab = "gear"
var slot_filter = null
var rarity_filter = null


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
	p.add_child(UI.label("Общий склад гильдии. Предметы приходят с боссов — на всех может не хватить.", 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(12))
	var all = Game.inventory_rows()
	if not all.is_empty():
		var chips = HFlowContainer.new()
		chips.add_theme_constant_override("h_separation", UI.px(6))
		chips.add_theme_constant_override("v_separation", UI.px(6))
		chips.add_child(UI.chip("Все (%d)" % all.size(), slot_filter == null, func():
			slot_filter = null
			refresh()))
		var seen = []
		for r in all:
			var l = DB.slot_label(r.slot)
			if l in seen: continue
			seen.append(l)
			chips.add_child(UI.chip(l, slot_filter == l, func():
				slot_filter = null if slot_filter == l else l
				refresh()))
		for k in RANK:
			if all.any(func(r): return DB.rarity_of(r.item) == k):
				chips.add_child(UI.chip(DB.gear_info.RARITY_NAME[k], rarity_filter == k, func():
					rarity_filter = null if rarity_filter == k else k
					refresh()))
		p.add_child(chips)
		p.add_child(UI.space(14))
	var rows = all.filter(func(r): return (slot_filter == null or DB.slot_label(r.slot) == slot_filter) and (rarity_filter == null or DB.rarity_of(r.item) == rarity_filter))
	rows.sort_custom(func(a, b): return RANK.find(DB.rarity_of(a.item)) < RANK.find(DB.rarity_of(b.item)))
	if rows.is_empty():
		p.add_child(empty_note("Склад пуст. Победите босса — добыча появится здесь."))
	var list = UI.cards(10)
	p.add_child(list)
	for r in rows:
		var rar = DB.rarity_of(r.item)
		var right = UI.vbox(0)
		var n = UI.label(str(r.free), 18, UI.GOOD if r.free > 0 else UI.TEXT_FAINT, "medium")
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		right.add_child(n)
		right.add_child(UI.label("из %d своб." % r.owned, 11, UI.TEXT_FAINT))
		var card = item_card(DB.item_icon_path(r.item.get("icon")), DB.slot_label(r.slot), r.item.name, r.item.desc, DB.rarity_color(rar), right, DB.rarity_color(rar))
		if not r.wornBy.is_empty():
			var v: VBoxContainer = card.get_child(0).get_child(1)
			v.add_child(UI.label("Носят: " + ", ".join(r.wornBy), 12.5, UI.ACCENT_SOFT, "regular", true))
		list.add_child(card)


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
