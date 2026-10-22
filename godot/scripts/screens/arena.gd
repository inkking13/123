extends Screen
## Friendly bouts with other guilds' squads for rating and gold.


func build() -> void:
	var vm: Dictionary = Game.arena_vm()
	var p = make_page(0)
	p.add_child(UI.kicker("Отдел кадров"))
	p.add_child(UI.screen_title("Арена"))
	p.add_child(UI.space(4))
	p.add_child(UI.label("Товарищеские поединки с соседними гильдиями — за рейтинг и золото. Никакого урона репутации при проигрыше.", 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(20))
	var row = UI.hbox(10)
	row.add_child(_stat("Рейтинг", str(vm.rating), vm.rank, UI.ACCENT))
	row.add_child(_stat("Счёт", "%d—%d" % [vm.wins, vm.losses], "побед—поражений", UI.TEXT))
	p.add_child(row)
	p.add_child(UI.space(20))
	if not vm.ready:
		p.add_child(empty_note("Соберите отряд из пяти бойцов, прежде чем выходить на арену."))
	elif vm.opponent:
		var opp: Dictionary = vm.opponent
		var fr = UI.frame("plain", Vector4(16, 16, 16, 16))
		var v = UI.vbox(6)
		var head = UI.hbox(10)
		head.add_child(UI.icon("sword", 20, UI.DANGER))
		var hv = UI.vbox(2)
		hv.add_child(UI.kicker("Соперник", UI.TEXT_FAINT, 10.5))
		hv.add_child(UI.label(opp.name, 16, UI.TEXT, "medium", true))
		head.add_child(UI.expand(hv))
		v.add_child(head)
		v.add_child(UI.label("Прочность отряда: %d HP" % opp.hp, 13.5, UI.TEXT_DIM))
		v.add_child(UI.label("Награда за победу: +%d золота, +%d рейтинга" % [opp.goldReward, opp.ratingWin], 13.5, UI.WARN, "regular", true))
		v.add_child(UI.space(10))
		v.add_child(UI.primary_button("Начать бой", Game.b.start_arena, "sword"))
		v.add_child(UI.secondary_button("Найти другого соперника", Game.reroll_arena))
		fr.add_child(v)
		p.add_child(fr)


func _stat(title: String, value: String, sub: String, color: Color) -> Control:
	var fr = UI.frame("plain", Vector4(14, 14, 14, 14))
	fr.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v = UI.vbox(2)
	v.add_child(UI.kicker(title, UI.TEXT_FAINT, 11))
	v.add_child(UI.label(value, 23, color, "medium"))
	v.add_child(UI.label(sub, 12.5, UI.TEXT_DIM))
	fr.add_child(v)
	return fr
