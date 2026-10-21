extends Screen
## The contract on the books and the board of offers.


func build() -> void:
	var active = Game.active_contract_vm()
	var board: Array = Game.contract_board()
	var p = make_page(0, 16)
	p.add_child(UI.back_link())
	p.add_child(UI.space(14))
	p.add_child(UI.screen_title("Контракты"))
	p.add_child(UI.space(4))
	p.add_child(UI.label("Заказчики платят сверх добычи — если отряд одолеет хозяина логова на их условиях. Гильдия держит один контракт за раз. Выполнено: %d." % Game.contracts_done, 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(18))
	p.add_child(UI.kicker("Взятый контракт", UI.ACCENT, 12))
	p.add_child(UI.space(10))
	if active:
		var note = ContractNote.make(active, true)
		var v: VBoxContainer = note.get_child(0)
		v.add_child(UI.space(8))
		v.add_child(UI.rule())
		var acts = UI.hbox(0)
		acts.add_child(UI.ink_action("В поход", Game.go_contract, true))
		acts.add_child(UI.ink_action("Отказаться", Game.abandon_contract))
		v.add_child(acts)
		p.add_child(note)
	else:
		p.add_child(UI.label("Пока ничего. Выберите работу на доске ниже.", 14, UI.TEXT_FAINT, "italic", true))
	p.add_child(UI.space(18))
	p.add_child(UI.kicker("Доска заказов", UI.ACCENT, 12))
	p.add_child(UI.space(10))
	for c in board:
		var id: String = c.id
		var note = ContractNote.make(c)
		var v: VBoxContainer = note.get_child(0)
		v.add_child(UI.space(8))
		v.add_child(UI.rule())
		v.add_child(UI.ink_action("Сначала закройте взятый" if active else "Взять контракт", func(): Game.accept_contract(id), active == null, active != null))
		p.add_child(note)
		p.add_child(UI.space(12))
