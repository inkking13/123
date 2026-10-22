extends Screen
## The trader: buy into the guild's stash, sell what nobody wears.

var tab = "buy"


func build() -> void:
	var p = make_page(0)
	p.add_child(header_with_gold())
	p.add_child(UI.space(10))
	p.add_child(UI.screen_title("Отдел закупок"))
	p.add_child(UI.space(14))
	p.add_child(tab_row([["buy", "Купить"], ["sell", "Продать"]], tab, func(k):
		tab = k
		refresh()))
	p.add_child(UI.space(18))
	if tab == "buy":
		p.add_child(UI.label("Купленный предмет уходит в общий склад гильдии — экипировать его можно на экране снаряжения.", 14, UI.TEXT_DIM, "regular", true))
		p.add_child(UI.space(18))
		var list = UI.cards(10)
		p.add_child(list)
		for r in Game.shop_rows(false):
			var row: Dictionary = r
			list.add_child(item_card(DB.item_icon_path(row.item.get("icon")), DB.slot_label(row.slot), row.item.name, row.item.desc, UI.TEXT, pill_button(str(row.price), row.affordable, func(): Game.buy_item(row.slot, row.item.id), "coins")))
	else:
		p.add_child(UI.label("Продать можно только то, что сейчас не надето ни на ком. Цена — половина от стоимости покупки.", 14, UI.TEXT_DIM, "regular", true))
		p.add_child(UI.space(18))
		var rows = Game.shop_rows(true)
		if rows.is_empty(): p.add_child(empty_note("Нечего продавать — весь свободный инвентарь пуст."))
		var list1 = UI.cards(10)
		p.add_child(list1)
		for r in rows:
			var row: Dictionary = r
			list1.add_child(item_card(DB.item_icon_path(row.item.get("icon")), DB.slot_label(row.slot), row.item.name, "Свободно: %d" % row.free, UI.TEXT, pill_button("+%d" % row.price, true, func(): Game.sell_item(row.slot, row.item.id), "coins")))
