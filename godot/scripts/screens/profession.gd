extends Screen
## A hero's trade: train it for gold, craft from the reagents the dungeons drop.


func build() -> void:
	var c = Game.find_hero(Game.char_id)
	if c == null: c = Game.pool[0]
	var opt = DB.profession(c.professionId)
	var p = make_page(0)
	p.add_child(header_with_gold())
	p.add_child(UI.space(10))
	p.add_child(UI.kicker(c.name))
	p.add_child(UI.screen_title("Прокачка профессии"))
	p.add_child(UI.space(14))
	if opt.is_empty():
		p.add_child(empty_note("Профессия ещё не выбрана — выберите её в карточке героя."))
		return
	var maxl: int = DB.professions.PROFESSION_MAX_LEVEL
	var per: int = DB.professions.PROFESSION_XP_PER_LEVEL
	var at_max: bool = c.professionLevel >= maxl
	var fr = UI.frame("gold", Vector4(14, 14, 14, 14))
	var v = UI.vbox(8)
	var head = UI.hbox(10)
	head.add_child(UI.icon(opt.icon, 22, UI.ACCENT))
	var hv = UI.vbox(1)
	hv.add_child(UI.label(opt.name, 18, UI.TEXT, "title"))
	hv.add_child(UI.label("Уровень %d/%d" % [c.professionLevel, maxl], 13, UI.TEXT_DIM))
	head.add_child(UI.expand(hv))
	v.add_child(head)
	v.add_child(UI.label(opt.desc, 13.5, UI.TEXT_MUTED, "regular", true))
	var xp = UI.hbox(8)
	var bar = UI.progress(100 if at_max else 100.0 * c.professionXp / per, UI.ACCENT, 5)
	xp.add_child(UI.center(bar))
	bar.get_parent().size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.custom_minimum_size.x = UI.px(200)
	xp.add_child(UI.label("макс." if at_max else "%d/%d" % [c.professionXp, per], 12, UI.TEXT_FAINT))
	v.add_child(xp)
	v.add_child(UI.kicker("Текущий бонус", UI.TEXT_FAINT, 11))
	for l in Game.profession_bonus_lines(opt, c.professionLevel): v.add_child(UI.label(l, 13.5, UI.GOOD))
	if at_max:
		v.add_child(UI.label("Мастерство достигло предела — дальше тренироваться некуда.", 13.5, UI.TEXT_FAINT, "italic", true))
	else:
		v.add_child(UI.kicker("На следующем уровне", UI.TEXT_FAINT, 11))
		for l in Game.profession_bonus_lines(opt, c.professionLevel + 1): v.add_child(UI.label(l, 13.5, UI.ACCENT_SOFT))
		var cost = DB.profession_train_cost(c.professionLevel)
		var cid: int = c.id
		v.add_child(UI.space(4))
		v.add_child(UI.primary_button("Тренироваться · %d золота" % cost, func(): Game.train_profession(cid), "chart-line-up", "", 46, Game.gold < cost))
	fr.add_child(v)
	p.add_child(fr)
	p.add_child(UI.space(18))
	p.add_child(UI.kicker("Рецепты", Color("#b8935c"), 12))
	p.add_child(UI.space(10))
	for r in Game.recipes_for(c):
		var rc: Dictionary = r.recipe
		var card = UI.frame("plain", Vector4(12, 12, 12, 12))
		if not r.unlocked: card.modulate.a = 0.5
		var cv = UI.vbox(6)
		var row = UI.hbox(10)
		row.add_child(UI.picture(DB.item_icon_path(r.result.get("icon")), 44, 44, 8))
		var rv = UI.vbox(2)
		rv.add_child(UI.label(DB.slot_label(DB.slots_for_kind(rc.slot)[0]).to_upper(), 10.5, UI.TEXT_FAINT))
		rv.add_child(UI.label(rc.name, 15, UI.TEXT, "medium", true))
		rv.add_child(UI.label(r.result.get("desc", ""), 12.5, UI.TEXT_DIM, "regular", true))
		row.add_child(UI.expand(rv))
		cv.add_child(row)
		var need = UI.hbox(8)
		need.add_child(UI.picture(DB.item_icon_path(r.reagent.get("icon")), 24, 24, 4))
		need.add_child(UI.expand(UI.label("%s: %d/%d · %d золота" % [r.reagent.get("name", ""), r.owned, rc.reagentQty, rc.goldCost], 13, UI.TEXT_MUTED if r.owned >= rc.reagentQty else UI.DANGER, "regular", true)))
		cv.add_child(need)
		if not r.unlocked: cv.add_child(UI.label("Откроется на %d уровне мастерства" % rc.unlockLevel, 12.5, UI.TEXT_FAINT, "italic"))
		else:
			var cid: int = c.id
			var rid: String = rc.id
			var b = UI.secondary_button("Скрафтить", func(): Game.craft(cid, rid), 40)
			if not r.craftable: b.modulate.a = 0.4
			cv.add_child(b)
		card.add_child(cv)
		p.add_child(card)
		p.add_child(UI.space(10))
