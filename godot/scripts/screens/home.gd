extends Screen
## Camp: news, the squad round the fire, the next contract or dungeon, the camp's systems.

const GOLD_LINE := Color("#8f6f45")
const GOLD_DIM := Color("#4d3b29")


func build() -> void:
	# Art behind the top of camp; the page scrolls over it.
	var art = UI.cover("title/camp-art.jpg", 400 + App.inset_top() / UI.K)
	art.set_anchors_preset(Control.PRESET_TOP_WIDE)
	add_child(art)
	var shade = UI.fade(Color(0.055, 0.04, 0.027, 0.0), Color(UI.BG, 1), 200)
	shade.set_anchors_preset(Control.PRESET_TOP_WIDE)
	shade.offset_top = UI.px(220) + App.inset_top()
	add_child(shade)
	var p = make_page(0)
	var head = UI.hbox(8)
	var title = UI.vbox(2)
	title.add_child(UI.kicker("Отдел кадров"))
	title.add_child(UI.shadowed(UI.label("Лагерь", 34, Color("#f1e4c6"), "title")))
	title.add_child(UI.ornament(110))
	head.add_child(UI.expand(title))
	var gold = PanelContainer.new()
	var gsb = UI.frame_style("pill", Vector4(12, 0, 12, 0), 18)
	gsb.border_color = GOLD_LINE
	gold.add_theme_stylebox_override("panel", gsb)
	gold.custom_minimum_size = Vector2(0, UI.px(36))
	var gr = UI.hbox(6, BoxContainer.ALIGNMENT_CENTER)
	gr.add_child(UI.icon("coins", 17, UI.GOLD, "fill"))
	gr.add_child(UI.label(str(Game.gold), 16, UI.GOLD, "semibold"))
	gold.add_child(gr)
	head.add_child(UI.center(gold))
	var gear = PanelContainer.new()
	var gesb = UI.frame_style("pill", Vector4(0, 0, 0, 0), 18)
	gear.add_theme_stylebox_override("panel", gesb)
	gear.custom_minimum_size = Vector2(UI.px(36), UI.px(36))
	gear.add_child(UI.center(UI.icon("gear", 18, Color("#d9c595"))))
	UI.tap(gear, func(): Game.go("settings"))
	head.add_child(UI.center(gear))
	p.add_child(head)
	p.add_child(UI.space(16))

	# On a wide window: news, squad and the way on at left; the camp's systems at right.
	var cols = UI.split(p, 1.0, 24)
	var L: VBoxContainer = cols[0]
	var R: VBoxContainer = cols[1]
	var fresh: Array = Game.new_unlocks()
	if not fresh.is_empty():
		L.add_child(_unlock_letter(fresh[0]))
		L.add_child(UI.space(18))

	var notices = UI.vbox(6)
	if Game.payroll_notice:
		var n: Dictionary = Game.payroll_notice
		notices.add_child(_notice("coins", UI.DANGER if n.shortfall else UI.WARN, ("Бюджета не хватило на зарплату — выплачено только %d. Гильдия недовольна." % n.paid) if n.shortfall else ("Зарплата выплачена: -%d золота." % n.paid), "payroll_notice"))
	if Game.employee_notice:
		notices.add_child(_notice("trophy", UI.WARN, "Сотрудник месяца: %s. Премия по морали выплачена всей гильдии." % Game.employee_notice.name, "employee_notice"))
	if Game.resignation_notice:
		notices.add_child(_notice("warning", UI.DANGER, "%s написал(а) заявление по собственному желанию — мораль была слишком низкой." % Game.resignation_notice.name, "resignation_notice"))
	if notices.get_child_count() > 0:
		L.add_child(notices)
		L.add_child(UI.space(14))

	L.add_child(_squad_strip())
	L.add_child(UI.space(14))
	var next = _next_card()
	if next:
		L.add_child(next)
		L.add_child(UI.space(8))
	var map = UI.hbox(4, BoxContainer.ALIGNMENT_END)
	map.add_child(UI.icon("path", 13, Color("#d9c595")))
	map.add_child(UI.label("Карта походов", 13, Color("#d9c595"), "medium"))
	map.add_child(UI.icon("caret-right", 12, Color("#d9c595")))
	UI.tap(map, func(): Game.go("levelmap"))
	L.add_child(map)
	L.add_child(UI.space(18))

	var tiles = _tiles()
	if not tiles.is_empty():
		var grid = GridContainer.new()
		grid.columns = 3
		grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_theme_constant_override("h_separation", UI.px(8))
		grid.add_theme_constant_override("v_separation", UI.px(8))
		grid.mouse_filter = Control.MOUSE_FILTER_IGNORE
		for t in tiles: grid.add_child(_tile(t))
		R.add_child(grid)
		R.add_child(UI.space(22))

	var upcoming: Array = DB.features.FEATURE_ORDER.filter(func(f): return not Game.is_unlocked(f))
	if not upcoming.is_empty():
		var need = func(f): return int(DB.features.FEATURES[f].get("bosses", 0) if DB.features.FEATURES[f].get("bosses") != null else 0) * 100 + int(DB.features.FEATURES[f].get("rooms", 0) if DB.features.FEATURES[f].get("rooms") != null else 0)
		var lowest = 1 << 30
		for f in upcoming: lowest = mini(lowest, need.call(f))
		var next_up = upcoming.filter(func(f): return need.call(f) == lowest)
		var fr = UI.frame("muted", Vector4(14, 14, 14, 14))
		var v = UI.vbox(6)
		var hr = UI.hbox(6)
		hr.add_child(UI.icon("lock-simple", 13, UI.TEXT_DIM))
		hr.add_child(UI.kicker(DB.unlock_hint(next_up[0]), UI.TEXT_DIM))
		v.add_child(hr)
		v.add_child(UI.label(", ".join(next_up.map(func(f): return DB.features.FEATURES[f].title)), 14, UI.TEXT_MUTED, "regular", true))
		fr.add_child(v)
		R.add_child(fr)


func _notice(icon: String, color: Color, text: String, key: String) -> Control:
	var pn = PanelContainer.new()
	var sb = UI.frame_style("pill", Vector4(10, 8, 10, 8), 6)
	sb.border_color = color
	pn.add_theme_stylebox_override("panel", sb)
	var row = UI.hbox(9)
	row.add_child(UI.icon(icon, 15, color))
	row.add_child(UI.label(text, 13, color, "regular", true))
	row.add_child(UI.icon("x", 13, UI.TEXT_DIM))
	pn.add_child(row)
	UI.tap(pn, func(): Game.dismiss(key))
	return pn


## A newly opened system arrives as a sealed letter from the guild.
func _unlock_letter(f: String) -> Control:
	var d: Dictionary = DB.features.FEATURES[f]
	var sheet = UI.parchment()
	var v = UI.vbox(6)
	sheet.add_child(v)
	var top = UI.hbox(12)
	top.add_child(UI.wax_seal(38, d.icon))
	var tv = UI.vbox(0)
	tv.add_child(UI.label("Открыто новое", 12.5, UI.INK_RED, "caps"))
	tv.add_child(UI.label(d.title, 20, UI.INK, "title"))
	top.add_child(UI.expand(tv))
	v.add_child(top)
	v.add_child(UI.label(d.intro, 15, UI.INK_MUTED, "regular", true))
	v.add_child(UI.rule())
	var acts = UI.hbox(10)
	acts.add_child(UI.ink_action("Посмотреть", func():
		Game.mark_unlock_seen(f)
		_open_feature(f), true))
	var sep = ColorRect.new(); sep.color = UI.INK_RULE; sep.custom_minimum_size = Vector2(1, UI.px(24))
	acts.add_child(UI.center(sep))
	acts.add_child(UI.ink_action("Понятно", func(): Game.mark_unlock_seen(f)))
	v.add_child(acts)
	return sheet


func _open_feature(f: String) -> void:
	match f:
		"gear", "quests", "shop", "weekly", "achievements", "hire", "personnel", "arena", "analytics", "contracts": Game.go(f)
		_:
			var sq: Array = Game.squad()
			if not sq.is_empty(): Game.open_char(sq[0].id)


## The squad round the fire; tap to change it.
func _squad_strip() -> Control:
	var fr = UI.frame("plain", Vector4(12, 12, 12, 10))
	var v = UI.vbox(8)
	fr.add_child(v)
	var row = UI.hbox(8)
	for m in Game.squad():
		var cell = UI.vbox(4)
		cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var pic = UI.portrait(m.id, 58, 6)
		pic.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		pic.custom_minimum_size.y = UI.px(58)
		UI.keep_ratio(pic, 1.0, 120)
		cell.add_child(pic)
		var n = UI.label(m.name, 11.5, Color("#efe4c8"), "medium")
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		n.clip_text = true
		cell.add_child(n)
		var bar = ColorRect.new(); bar.color = DB.ROLE_COLOR[m.role]; bar.custom_minimum_size = Vector2(UI.px(14), 3)
		cell.add_child(UI.center(bar))
		row.add_child(cell)
	for i in range(Game.squad().size(), 5):
		var empty = UI.frame("muted", Vector4(0, 0, 0, 0))
		empty.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		empty.custom_minimum_size.y = UI.px(58)
		empty.add_child(UI.center(UI.icon("plus", 16, Color("#5e4d37"))))
		row.add_child(empty)
	v.add_child(row)
	var foot = UI.hbox(4, BoxContainer.ALIGNMENT_END)
	foot.add_child(UI.label("Отряд", 12, Color("#d9c595"), "medium"))
	foot.add_child(UI.icon("caret-right", 12, Color("#d9c595")))
	v.add_child(foot)
	UI.tap(fr, func(): Game.go("roster"))
	return fr


## The contract on the books if there is one, else the furthest open dungeon.
func _next_card() -> Control:
	var contract = Game.active_contract_vm()
	var next = null
	for l in DB.locations:
		for d in DB.dungeon_list:
			if d.locationId == l.id and Game.is_dungeon_unlocked(d.id): next = d
	if next == null: return null
	var sheet = UI.parchment(Vector4(16, 14, 16, 14))
	var row = UI.hbox(14)
	sheet.add_child(row)
	row.add_child(UI.wax_seal(48, contract.icon if contract else "sword"))
	var v = UI.vbox(1)
	v.add_child(UI.label(("Контракт · " + contract.termTitle) if contract else ("В поход" if Game.squad_ready() else "Собрать отряд и в поход"), 12.5, UI.INK_RED, "caps"))
	v.add_child(UI.label(contract.dungeonName if contract else next.name, 21, UI.INK, "title", true))
	v.add_child(UI.label(("%d золота · %s" % [contract.pay, contract.clientName]) if contract else ("%d комнаты · рекоменд. ГС %d" % [next.encounters.size(), next.recommendedGs]), 13.5, UI.INK_MUTED, "italic", true))
	row.add_child(UI.expand(v))
	row.add_child(UI.center(UI.icon("arrow-right", 22, UI.INK)))
	UI.tap(sheet, func():
		if contract: Game.go_contract()
		else:
			Game.select_dungeon(next.id)
			if Game.squad_ready(): Game.go_dungeon()
			else: Game.go("roster"))
	return sheet


func _tiles() -> Array:
	var t = []
	var ach: Array = Game.achievement_rows()
	var ach_ready = ach.filter(func(a): return a.achieved and not a.claimed).size()
	if Game.is_unlocked("gear"):
		t.append({"title": "Снаряжение", "icon": "shield", "go": "gear", "sub": "Одеть отряд"})
		var free = 0
		var inv = Game.inventory_rows()
		for r in inv: free += maxi(0, r.free)
		t.append({"title": "Инвентарь", "icon": "scroll", "go": "inventory", "sub": "Склад пуст" if inv.is_empty() else "%d свободно" % free})
	if Game.is_unlocked("contracts"):
		var ac = Game.active_contract
		t.append({"title": "Контракты", "icon": "scroll", "go": "contracts", "badge": 0 if ac else 1, "sub": ("Взят: " + DB.dungeon(ac.dungeonId).name) if ac else "Доска заказов"})
	if Game.is_unlocked("shop"): t.append({"title": "Закупки", "icon": "storefront", "go": "shop", "sub": "Купить и продать"})
	if Game.is_unlocked("hire"):
		var n = Game.hire_options().size()
		t.append({"title": "Найм", "icon": "door-open", "go": "hire", "sub": "Все наняты" if n == 0 else "%d на рынке" % n})
	if Game.is_unlocked("analytics"): t.append({"title": "Аналитика", "icon": "chart-line-up", "go": "analytics", "sub": "Win-rate, бюджет"})
	if Game.is_unlocked("personnel"): t.append({"title": "Личные дела", "icon": "identification-card", "go": "personnel", "sub": "Досье и архив"})
	if Game.is_unlocked("achievements"): t.append({"title": "Достижения", "icon": "trophy", "go": "achievements", "badge": ach_ready, "sub": "%d/%d получено" % [ach.filter(func(a): return a.claimed).size(), ach.size()]})
	if Game.is_unlocked("weekly"):
		var w = Game.weekly_vm()
		t.append({"title": "Испытание", "icon": "crown-simple", "go": "weekly", "badge": 1 if w.available and not w.claimed else 0, "sub": ("Награда получена" if w.claimed else w.modifierName) if w.available else "После первого босса"})
	return t


func _tile(t: Dictionary) -> Control:
	var fr = UI.frame("plain", Vector4(6, 10, 6, 10))
	fr.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fr.custom_minimum_size = Vector2(0, UI.px(92))
	var v = UI.vbox(5)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	fr.add_child(v)
	var disc = PanelContainer.new()
	var dsb = UI.frame_style("pill", Vector4(0, 0, 0, 0), 18)
	disc.add_theme_stylebox_override("panel", dsb)
	disc.custom_minimum_size = Vector2(UI.px(36), UI.px(36))
	disc.add_child(UI.center(UI.icon(t.icon, 18, Color("#e3cc93"))))
	v.add_child(UI.center(disc))
	var n = UI.label(t.title, 14, Color("#efe2c4"), "title")
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	n.clip_text = true
	v.add_child(n)
	var s = UI.label(t.sub, 12, UI.TEXT_DIM, "italic")
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	s.clip_text = true
	v.add_child(s)
	if t.get("badge", 0) > 0:
		var n_badge: int = t.badge
		fr.draw.connect(func():
			var at = Vector2(fr.size.x - UI.px(14), UI.px(14))
			fr.draw_circle(at, UI.px(9), UI.DANGER)
			var f: Font = UI.FONTS.semibold
			var fs = UI.px(11)
			var w = f.get_string_size(str(n_badge), HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
			fr.draw_string(f, at + Vector2(-w * 0.5, fs * 0.35), str(n_badge), HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE))
	UI.tap(fr, func(): Game.go(t.go))
	return fr
