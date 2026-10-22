extends Screen
## Staff files: everyone on the books, open HR trouble, and who's left the guild.


func build() -> void:
	var p = make_page(0)
	p.add_child(UI.back_link())
	p.add_child(UI.space(14))
	p.add_child(UI.kicker("Отдел кадров"))
	p.add_child(UI.screen_title("Личные дела"))
	p.add_child(UI.space(18))
	var issues = []
	if Game.feud: issues.append("%s и %s в ссоре: −10%% урона обоим в одном отряде, ещё походов: %d." % [Game.name_of(Game.feud.a), Game.name_of(Game.feud.b), Game.feud.trips])
	if Game.strike_trips > 0: issues.append("Итальянская забастовка: −15%% урона отряда ещё %d %s." % [Game.strike_trips, "поход" if Game.strike_trips == 1 else "похода"])
	if not Game.raises.is_empty(): issues.append("Прибавки к окладу: " + ", ".join(Game.raises.keys().map(func(id): return "%s +%d" % [Game.name_of(id), Game.raises[id]])))
	if not issues.is_empty():
		p.add_child(UI.kicker("Открытые вопросы", UI.WARN, 12))
		p.add_child(UI.space(8))
		var list = UI.cards(6)
		p.add_child(list)
		for t in issues:
			var row = UI.hbox(8)
			row.add_child(UI.icon("warning", 14, UI.WARN))
			row.add_child(UI.label(t, 13.5, UI.TEXT_MUTED, "regular", true))
			list.add_child(row)
		p.add_child(UI.space(12))
	p.add_child(UI.kicker("В штате · %d" % Game.pool.size(), Color("#b8935c"), 12))
	p.add_child(UI.space(10))
	var list1 = UI.cards(10)
	p.add_child(list1)
	for c in Game.pool:
		var fr = UI.frame("plain", Vector4(12, 12, 12, 12))
		var v = UI.vbox(6)
		var head = UI.hbox(10)
		head.add_child(UI.portrait(c.id, 44, 6))
		var hv = UI.vbox(1)
		hv.add_child(UI.label(c.name, 16, UI.TEXT, "medium"))
		var sub: String = c.epithet
		sub += " · " + DB.spec_def(c.heroClass, c.spec).get("name", "")
		if c.professionId != null: sub += " · " + DB.profession(c.professionId).name
		hv.add_child(UI.label("%s · %s · Ур. %d" % [sub, DB.ROLE_NAME[c.role], c.level], 12.5, UI.TEXT_FAINT, "regular", true))
		head.add_child(UI.expand(hv))
		head.add_child(UI.label("%d%%" % c.morale, 14, UI.GOOD if c.morale >= 60 else (UI.WARN if c.morale >= 30 else UI.DANGER), "medium"))
		v.add_child(head)
		v.add_child(UI.label(c.story, 13, UI.TEXT_DIM, "regular", true))
		fr.add_child(v)
		list1.add_child(fr)
	if not Game.departed_log.is_empty():
		p.add_child(UI.space(8))
		p.add_child(UI.kicker("Архив", Color("#b8935c"), 12))
		p.add_child(UI.space(10))
		var list2 = UI.cards(8)
		p.add_child(list2)
		for d in Game.departed_log:
			var fr = UI.frame("muted", Vector4(12, 12, 12, 12))
			var v = UI.vbox(3)
			v.add_child(UI.label(d.name, 15, UI.TEXT_MUTED, "medium"))
			v.add_child(UI.label("%s · %s · Ур. %d · %s" % [d.epithet, DB.ROLE_NAME[d.role], d.level, "Уволен(а)" if d.reason == "fired" else "Ушёл(ушла) сам(а)"], 12.5, UI.TEXT_FAINT, "regular", true))
			fr.add_child(v)
			list2.add_child(fr)
