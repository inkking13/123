extends Screen
## A cleared boss again, under a rotating handicap, once a week.


func build() -> void:
	var vm: Dictionary = Game.weekly_vm()
	var p = make_page(0)
	p.add_child(UI.back_link())
	p.add_child(UI.space(14))
	p.add_child(UI.kicker("Отдел кадров"))
	p.add_child(UI.screen_title("Испытание недели"))
	p.add_child(UI.space(4))
	p.add_child(UI.label("Повторный контракт на уже зачищенного босса с особыми условиями — награда весомее, риск выше. Обновляется раз в неделю.", 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(20))
	if not vm.available:
		p.add_child(empty_note("Испытание откроется после первой победы над любым боссом — сюда возвращаются за добавкой, а не начинают путь."))
		return
	if not vm.ready:
		p.add_child(empty_note("Соберите отряд из пяти бойцов, прежде чем принимать испытание."))
		return
	var fr = UI.frame("plain", Vector4(16, 16, 16, 16))
	var v = UI.vbox(8)
	var head = UI.hbox(10)
	head.add_child(UI.icon("skull", 20, UI.DANGER))
	var hv = UI.vbox(2)
	hv.add_child(UI.kicker(vm.locationName, UI.TEXT_FAINT, 10.5))
	hv.add_child(UI.label(vm.bossName, 16, UI.TEXT, "medium", true))
	head.add_child(UI.expand(hv))
	v.add_child(head)
	v.add_child(UI.label(vm.dungeonName, 13, UI.TEXT_DIM))
	var mod = PanelContainer.new()
	var sb = UI.frame_style("pill", Vector4(12, 12, 12, 12), 8)
	sb.border_color = UI.WARN; sb.bg_color = Color(0.79, 0.69, 0.43, 0.1)
	mod.add_theme_stylebox_override("panel", sb)
	var mv = UI.vbox(4)
	var mh = UI.hbox(6)
	mh.add_child(UI.icon("chart-line-up", 13, UI.WARN))
	mh.add_child(UI.label(vm.modifierName, 14, UI.WARN, "medium"))
	mv.add_child(mh)
	mv.add_child(UI.label(vm.modifierDesc, 13, UI.TEXT_MUTED, "regular", true))
	mod.add_child(mv)
	v.add_child(mod)
	v.add_child(UI.space(6))
	if vm.claimed: v.add_child(empty_note("Награда уже получена на этой неделе"))
	else: v.add_child(UI.primary_button("Принять испытание", Game.b.start_weekly, "sword"))
	fr.add_child(v)
	p.add_child(fr)
