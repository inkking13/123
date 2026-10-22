extends Screen
## The land's town: market, tavern (hiring), the contract board, provisions,
## and a night at the inn. Back leads out onto the map.


func build() -> void:
	var w = Game.w
	var th: Dictionary = w.theme()
	var p = make_page(0, 24, 20, true, NARROW_W)
	p.add_child(header_with_gold())
	p.add_child(UI.space(10))
	p.add_child(UI.kicker(DB.locations[w.location_index()].name))
	p.add_child(UI.screen_title(th.town))
	p.add_child(UI.space(6))
	p.add_child(UI.label("Провизия: %d пайков · отряд: %s · день %d, %02d:00" % [w.food, w.fatigue_word().to_lower(), w.day, int(w.hours)], 13.5, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(16))
	var list = UI.cards(10, 1)
	list.add_child(_service("fork-knife", "Провизия", "%d пайков за %d золота. Отряд съедает по пайку на бойца каждые 8 часов пути." % [World.FOOD_PACK, World.FOOD_PACK_PRICE], "Купить · %d" % World.FOOD_PACK_PRICE, Game.gold >= World.FOOD_PACK_PRICE, w.buy_food))
	list.add_child(_service("bed", "Таверна: ночлег", "Ночь под крышей и горячий ужин без трат провизии: усталость уходит, мораль растёт.", "Ночлег · %d" % World.INN_PRICE, Game.gold >= World.INN_PRICE, w.rest_at_inn))
	if Game.is_unlocked("shop"): list.add_child(_service("storefront", "Рынок", "Купить снаряжение или продать лишнее со склада.", "На рынок", true, func(): Game.go("shop")))
	if Game.is_unlocked("hire"): list.add_child(_service("beer-stein", "Таверна: наёмники", "Соискатели ждут за кружкой — нанять в гильдию.", "К столам", true, func(): Game.go("hire")))
	if Game.is_unlocked("contracts"): list.add_child(_service("scroll", "Доска контрактов", "Заказы на подземелья этих и других земель.", "К доске", true, func(): Game.go("contracts")))
	p.add_child(list)
	p.add_child(UI.space(14))
	p.add_child(UI.secondary_button("Покинуть город", func(): Game.go_tab("world")))


func _service(icon: String, name: String, desc: String, action: String, can: bool, fn: Callable) -> Control:
	var fr = UI.frame("plain", Vector4(12, 12, 12, 12))
	var row = UI.hbox(12)
	row.add_child(UI.center(UI.icon(icon, 22, UI.ACCENT)))
	var v = UI.vbox(3)
	v.add_child(UI.label(name, 15.5, UI.TEXT, "medium"))
	v.add_child(UI.label(desc, 12.5, UI.TEXT_DIM, "regular", true))
	row.add_child(UI.expand(v))
	row.add_child(UI.center(pill_button(action, can, fn)))
	fr.add_child(row)
	return fr
