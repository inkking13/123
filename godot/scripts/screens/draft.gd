extends Screen
## A new guild's first day: the budget buys five of the nine heroes on offer.

const ROLES := [["tank", "Танки", "Держат удар на себе. Нужен хотя бы один."], ["heal", "Хилеры", "Лечат отряд. Без хилера поход закончится в первой комнате."], ["dps", "Бойцы", "Наносят урон — чем больше, тем быстрее бой."]]

var picks: Array = []


func _toggle(id: int) -> void:
	if id in picks: picks.erase(id)
	elif picks.size() < DB.characters.DRAFT_SIZE: picks.append(id)
	refresh()


func build() -> void:
	var budget: int = DB.characters.DRAFT_BUDGET
	var size: int = DB.characters.DRAFT_SIZE
	var spent = 0
	for id in picks: spent += DB.candidates[id].hireCost
	var left = budget - spent
	var problem = Game.draft_problem(picks)
	var p = make_page(0, 24, 20, false)
	p.add_child(UI.kicker("Отдел кадров · первый день"))
	p.add_child(UI.screen_title("Набор отряда"))
	p.add_child(UI.space(8))
	p.add_child(UI.label("Гильдия выделила %d золота на первых сотрудников. Наймите пятерых — всех сильных бюджет не потянет. Остаток уйдёт в казну, остальные соискатели подождут на рынке труда." % budget, 14, UI.TEXT_MUTED, "regular", true))
	p.add_child(UI.space(18))
	for role in ROLES:
		var head = UI.hbox(8)
		var dot = ColorRect.new(); dot.color = DB.ROLE_COLOR[role[0]]; dot.custom_minimum_size = Vector2(UI.px(8), UI.px(8))
		head.add_child(UI.center(dot))
		head.add_child(UI.kicker(role[1], Color("#b8935c"), 12))
		p.add_child(head)
		p.add_child(UI.label(role[2], 12.5, UI.TEXT_DIM, "regular", true))
		p.add_child(UI.space(8))
		var list = UI.cards(10)
		p.add_child(list)
		for h in DB.characters.POOL:
			if h.role != role[0]: continue
			var on: bool = h.id in picks
			var blocked: bool = not on and (h.hireCost > left or picks.size() >= size)
			list.add_child(_card(h, on, blocked))
		p.add_child(UI.space(6))
	p.add_child(UI.space(190))
	# The five slots, what's left of the budget, and the contract to sign.
	var dock = UI.frame("plain", Vector4(12, 12, 12, 12))
	dock.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	dock.grow_vertical = Control.GROW_DIRECTION_BEGIN
	dock.offset_left = UI.px(12); dock.offset_right = -UI.px(12); dock.offset_bottom = -UI.px(10) - App.inset_bottom()
	span_column(dock)
	add_child(dock)
	var v = UI.vbox(10)
	dock.add_child(v)
	var top = UI.hbox(5)
	top.add_child(UI.expand(UI.kicker("Отряд %d/%d" % [picks.size(), size], Color("#b8935c"), 12)))
	top.add_child(UI.label("Бюджет", 13, UI.TEXT_DIM))
	top.add_child(UI.icon("coins", 14, UI.GOLD, "fill"))
	top.add_child(UI.label(str(left), 15, UI.DANGER if left < 0 else UI.GOLD, "semibold"))
	top.add_child(UI.label("/ %d" % budget, 13, UI.TEXT_FAINT))
	v.add_child(top)
	var slots = UI.hbox(8)
	for i in size:
		var cell = PanelContainer.new()
		var sb = UI.frame_style("muted", Vector4(0, 0, 0, 0), 6)
		cell.add_theme_stylebox_override("panel", sb)
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cell.custom_minimum_size = Vector2(0, UI.px(58))
		UI.keep_ratio(cell, 1.0, 110)
		if i < picks.size():
			var id: int = picks[i]
			sb.border_color = DB.ROLE_COLOR[DB.candidates[id].role]
			var pic = UI.portrait(id, 56, 5)
			pic.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			pic.size_flags_vertical = Control.SIZE_EXPAND_FILL
			cell.add_child(pic)
			UI.tap(cell, func(): _toggle(id))
		else:
			cell.add_child(UI.center(UI.icon("plus", 16, Color("#5e4d37"))))
		slots.add_child(cell)
	v.add_child(slots)
	v.add_child(UI.primary_button(problem if problem else "Подписать контракты · в казну %d" % left, func(): Game.finish_draft(picks), "" if problem else "scroll", "", 48, problem != null))


func _card(h: Dictionary, on: bool, blocked: bool) -> Control:
	var card = PanelContainer.new()
	var sb = UI.frame_style("plain", Vector4(12, 12, 12, 12), 6)
	sb.border_color = UI.ACCENT_BRIGHT if on else UI.BORDER_STRONG
	sb.bg_color = Color(0.79, 0.64, 0.42, 0.14) if on else Color(0.086, 0.075, 0.063, 0.9)
	card.add_theme_stylebox_override("panel", sb)
	if blocked: card.modulate.a = 0.5
	var row = UI.hbox(12)
	card.add_child(row)
	row.add_child(UI.portrait(h.id, 64, 6))
	var info = UI.vbox(3)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(info)
	var top = UI.hbox(6)
	var names = UI.vbox(0)
	names.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	names.add_child(UI.label(h.name, 17, Color("#f4e9cf"), "semibold"))
	var sub = UI.hbox(4)
	sub.add_child(UI.class_badge(h.heroClass, 13))
	sub.add_child(UI.label("· %s · %s" % [DB.ROLE_NAME[h.role], "ближний бой" if h.attackRange == "melee" else "дальний бой"], 13, UI.TEXT_FAINT))
	names.add_child(sub)
	top.add_child(names)
	var price = PanelContainer.new()
	var psb = UI.frame_style("pill", Vector4(9, 2, 9, 2), 13)
	psb.border_color = UI.ACCENT_BRIGHT if on else Color("#5e4d37")
	psb.bg_color = UI.ACCENT if on else Color(0, 0, 0, 0.3)
	price.add_theme_stylebox_override("panel", psb)
	var pr = UI.hbox(4)
	pr.add_child(UI.icon("check" if on else "coins", 13, UI.BG if on else UI.GOLD, "regular" if on else "fill"))
	pr.add_child(UI.label("В отряде" if on else str(h.hireCost), 14, UI.BG if on else UI.GOLD, "semibold"))
	price.add_child(pr)
	top.add_child(price)
	info.add_child(top)
	info.add_child(UI.label("HP %d · %s/с · ГС %d" % [h.hp, ("хил %d" % h.healPower) if h.role == "heal" else ("урон %d" % h.dps), h.gs], 13, UI.TEXT_MUTED))
	var tr: Dictionary = DB.traits[h.trait]
	info.add_child(UI.label("%s. %s" % [tr.label, tr.desc], 12.5, UI.TEXT_DIM, "regular", true))
	info.add_child(UI.label(h.bio, 12.5, UI.TEXT_FAINT, "italic", true))
	if not blocked: UI.tap(card, func(): _toggle(h.id))
	return card
