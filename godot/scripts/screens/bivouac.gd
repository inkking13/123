extends Screen
## Making camp on the map, after Wartales: each hero takes a task for the
## night — rest, cook, train, work their trade, hunt, keep watch — then the
## camp is struck: eight hours, a meal, and what the tasks bring.


func build() -> void:
	var w = Game.w
	var squad: Array = Game.squad()
	var p = make_page(0, 24, 20, true, Screen.WIDE_W)
	p.add_child(UI.back_link())
	p.add_child(UI.space(10))
	p.add_child(UI.kicker(DB.locations[w.location_index()].name))
	p.add_child(UI.screen_title("Привал"))
	p.add_child(UI.space(6))
	var cooks = squad.filter(func(c): return w.plan_of(c) == "cook").size() > 0
	var watch = squad.filter(func(c): return w.plan_of(c) == "watch").size() > 0
	var night: bool = w.is_night() or w.hours + 8.0 > 20.0
	var eat: int = squad.size() + (World.COOK_FOOD if cooks else 0)
	var end = fmod(w.hours + 8.0, 24.0)
	p.add_child(UI.label("С %02d:00 до %02d:00. Отряд съест %d пайков (есть %d)%s." % [int(w.hours), int(end), eat, w.food, ", включая котёл" if cooks else ""], 14, UI.WARN if w.food < eat else UI.TEXT_DIM, "regular", true))
	if night and not watch:
		p.add_child(UI.space(6))
		p.add_child(UI.label("Ночь, а дозорного нет — банды могут напасть на спящий лагерь.", 13.5, UI.DANGER, "medium", true))
	if w.well_fed > 0:
		p.add_child(UI.space(6))
		p.add_child(UI.label("Отряд ещё сыт после прошлого ужина: +10%% к урону на %d бой(я)." % w.well_fed, 13, UI.GOOD, "regular", true))
	p.add_child(UI.space(14))
	var list = UI.cards(10, 1)
	for c in squad: list.add_child(_hero(c))
	p.add_child(list)
	p.add_child(UI.space(16))
	p.add_child(UI.primary_button("Разбить лагерь", _strike, "campfire"))
	p.add_child(UI.space(8))
	p.add_child(UI.secondary_button("Идти дальше", func(): Game.go_tab("world")))


func _hero(c: Dictionary) -> Control:
	var w = Game.w
	var cur: String = w.plan_of(c)
	var fr = UI.frame("plain", Vector4(12, 12, 12, 12))
	var v = UI.vbox(8)
	var head = UI.hbox(10)
	head.add_child(UI.portrait(c.id, 40, 6))
	var hv = UI.vbox(1)
	hv.add_child(UI.label(c.name, 15.5, UI.TEXT, "medium"))
	hv.add_child(UI.label(w.activity(cur).desc, 12.5, UI.TEXT_DIM, "regular", true))
	head.add_child(UI.expand(hv))
	v.add_child(head)
	var flow = HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", UI.px(6))
	flow.add_theme_constant_override("v_separation", UI.px(6))
	flow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var cid: int = c.id
	for a in World.ACTIVITIES:
		if a.get("needs") == "profession" and c.professionId == null: continue
		var id: String = a.id
		var chip = UI.chip(a.name, cur == id, func(): w.set_plan(cid, id), a.icon)
		chip.tooltip_text = a.desc
		flow.add_child(chip)
	v.add_child(flow)
	fr.add_child(v)
	return fr


func _strike() -> void:
	var ambush = Game.w.make_camp()
	if ambush != null: Game.start_skirmish(ambush)
	else: Game.go_tab("world")
