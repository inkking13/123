extends Screen
## Making camp on the map, after Wartales: each hero takes a task for the
## night — rest, cook, train, work their trade, hunt, keep watch — then the
## camp is struck: eight hours, a meal, and what the tasks bring.


var view: CampView
var _panel: Control


func _enter_tree() -> void:
	view = CampView.new()
	get_tree().root.add_child.call_deferred(view)


func _exit_tree() -> void:
	if is_instance_valid(view): view.queue_free()


func build() -> void:
	var w = Game.w
	var squad: Array = Game.squad()
	if is_instance_valid(view) and view.is_inside_tree(): view.sync()
	# The camp shows above (on a wide window, left of) a dark panel with the plans.
	var p = UI.vbox(0)
	p.add_child(UI.back_link())
	p.add_child(UI.space(6))
	p.add_child(UI.kicker(DB.locations[w.location_index()].name))
	p.add_child(UI.screen_title("Привал"))
	p.add_child(UI.space(4))
	var cooks = squad.filter(func(c): return w.plan_of(c) == "cook").size() > 0
	var watch = squad.filter(func(c): return w.plan_of(c) == "watch").size() > 0
	var night: bool = w.is_night() or w.hours + 8.0 > 20.0
	var eat: int = squad.size() + (World.COOK_FOOD if cooks else 0)
	var end = fmod(w.hours + 8.0, 24.0)
	p.add_child(UI.label("С %02d:00 до %02d:00. Отряд съест %d пайков (есть %d)%s." % [int(w.hours), int(end), eat, w.food, ", включая котёл" if cooks else ""], 14, UI.WARN if w.food < eat else UI.TEXT_DIM, "regular", true))
	if w.safe_camp:
		p.add_child(UI.space(6))
		p.add_child(UI.label("Укрытая стоянка: здесь на лагерь не нападут, а сон крепче (мораль +2).", 13.5, UI.GOOD, "medium", true))
	elif night and not watch:
		p.add_child(UI.space(6))
		p.add_child(UI.label("Ночь, а дозорного нет — банды могут напасть на спящий лагерь.", 13.5, UI.DANGER, "medium", true))
	if w.well_fed > 0:
		p.add_child(UI.space(6))
		p.add_child(UI.label("Отряд ещё сыт после прошлого ужина: +10%% к урону на %d бой(я)." % w.well_fed, 13, UI.GOOD, "regular", true))
	p.add_child(UI.space(12))
	var list = UI.cards(10, 1)
	for c in squad: list.add_child(_hero(c))
	p.add_child(list)
	p.add_child(UI.space(14))
	p.add_child(UI.primary_button("Разбить лагерь", _strike, "campfire"))
	p.add_child(UI.space(8))
	p.add_child(UI.secondary_button("Идти дальше", func(): Game.go_tab("world")))
	p.add_child(UI.space(6))
	_panel = _sheet(p)
	add_child(_panel)
	add_child(Tabs.make())
	_measure.call_deferred()


## The dark sheet the plans sit on: the lower part of a phone's screen, or a
## column on the right of a wide window.
func _sheet(content: Control) -> Control:
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.063, 0.047, 0.035, 0.9)
	sb.border_color = Color(0.79, 0.64, 0.42, 0.45)
	sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(12))
	sb.content_margin_left = UI.px(16); sb.content_margin_right = UI.px(16)
	sb.content_margin_top = UI.px(12); sb.content_margin_bottom = UI.px(4)
	pn.add_theme_stylebox_override("panel", sb)
	pn.mouse_filter = Control.MOUSE_FILTER_STOP
	scroll = UI.scroll(content)
	pn.add_child(scroll)
	var vp = get_viewport_rect().size
	if App.wide:
		pn.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
		pn.offset_left = -UI.px(470); pn.offset_right = -UI.px(14)
		pn.offset_top = UI.px(14); pn.offset_bottom = -UI.px(14)
	else:
		pn.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		pn.offset_left = UI.px(8); pn.offset_right = -UI.px(8)
		pn.offset_bottom = -UI.px(Tabs.HEIGHT + 6) - App.inset_bottom()
		pn.offset_top = -vp.y * 0.56
	return pn


func _measure() -> void:
	if not is_instance_valid(view) or not is_instance_valid(_panel): return
	var vp = get_viewport_rect().size
	var r = _panel.get_global_rect()
	view.band_bottom = 0.0 if App.wide else vp.y - r.position.y
	view.band_right = vp.x - r.position.x if App.wide else 0.0


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
