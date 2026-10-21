extends Screen
## The hiring market: everyone not on the payroll, for a one-off fee.


func build() -> void:
	var p = make_page(0)
	p.add_child(header_with_gold())
	p.add_child(UI.space(10))
	p.add_child(UI.kicker("Отдел кадров"))
	p.add_child(UI.screen_title("Найм героев"))
	p.add_child(UI.space(4))
	p.add_child(UI.label("Соискатели с рынка труда. Найм — разовая трата из бюджета гильдии, дальше герой ведёт себя как обычный сотрудник.", 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(18))
	var opts: Array = Game.hire_options()
	if opts.is_empty(): p.add_child(empty_note("Все соискатели уже в штате."))
	for c in opts:
		var cost: int = c.get("hireCost", 0) if c.get("hireCost") != null else 0
		var fr = UI.frame("plain", Vector4(12, 12, 12, 12))
		var v = UI.vbox(8)
		var row = UI.hbox(12)
		row.add_child(UI.portrait(c.id, 56, 8))
		var info = UI.vbox(3)
		var top = UI.hbox(6)
		top.add_child(UI.expand(UI.label(c.name, 16, UI.TEXT, "medium")))
		top.add_child(UI.label("ГС %d" % c.gs, 12, UI.TEXT_DIM))
		info.add_child(top)
		info.add_child(UI.class_badge(c.heroClass))
		var role = UI.hbox(6)
		var dot = ColorRect.new(); dot.color = DB.ROLE_COLOR[c.role]; dot.custom_minimum_size = Vector2(UI.px(6), UI.px(6))
		role.add_child(UI.center(dot))
		role.add_child(UI.label("%s · %s · %s · HP %d" % [DB.ROLE_NAME[c.role], "ближний бой" if c.attackRange == "melee" else "дальний бой", ("хил %d" % c.healPower) if c.role == "heal" else ("урон %d" % c.dps), c.hp], 12.5, UI.TEXT_FAINT, "regular", true))
		info.add_child(role)
		row.add_child(UI.expand(info))
		v.add_child(row)
		v.add_child(UI.label(c.bio, 13.5, UI.TEXT_MUTED, "regular", true))
		var id: int = c.id
		var b = UI.secondary_button("Нанять за %d" % cost, func(): Game.hire(id), 42)
		if Game.gold < cost: b.modulate.a = 0.4
		v.add_child(b)
		fr.add_child(v)
		p.add_child(fr)
		p.add_child(UI.space(10))
