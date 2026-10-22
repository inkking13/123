extends Screen
## After a fight: win or wipe, the squad's state, chatter, gold, relics, loot to share out.


func build() -> void:
	var res = Game.b.result
	var s = Game.b.sim
	if res == null or s == null: return
	var arena: bool = Game.in_arena
	var dungeon: Dictionary = Game.current_dungeon()
	var accent = UI.ACCENT if res.win else UI.DANGER
	var kicker: String = "Арена" if arena else (("%s" % dungeon.name if res.isBoss else "Комната %d из %d" % [Game.enc_idx + 1, dungeon.encounters.size()]) if res.win else "Поход окончен")
	var title: String = ("Победа" if res.win else "Поражение") if arena else ("Победа" if res.isBoss else "Комната зачищена") if res.win else "Вайп"
	var text: String
	if arena: text = "Соперник повержен. Гильдия забирает свою долю и расходится." if res.win else "Не в этот раз — отряд отступает зализывать раны. Рейтинг слегка просел."
	elif res.win: text = "Босс повержен. Раздели добычу, пока гильдия не разошлась." if res.isBoss else "Отряд идёт дальше. Раны остаются с вами до конца похода."
	else: text = "Рейд не пережил этот пул. Чиним броню и пробуем снова." if res.isBoss else "Отряд полёг ещё до трона. Придётся начать путь заново."
	var band = Game.b.skirmish
	if band != null:
		kicker = DB.locations[Game.w.location_index()].name
		title = "Отбились" if res.win else "Отступление"
		text = ("%s разбиты. Можно идти дальше." % band.name) if res.win else "Отряд не выстоял и отходит к городу, бросив часть припасов."
	var p = make_page(0, 32, 20, false, NARROW_W)
	var mark = ColorRect.new(); mark.color = accent; mark.custom_minimum_size = Vector2(UI.px(34), UI.px(3))
	mark.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	p.add_child(mark)
	p.add_child(UI.space(14))
	p.add_child(UI.kicker(kicker))
	p.add_child(UI.label(title, 36, accent, "title"))
	p.add_child(UI.space(6))
	p.add_child(UI.label(text, 14.5, UI.TEXT_MUTED, "regular", true))
	p.add_child(UI.space(18))
	var co = Game.contract_outcome
	if co:
		var note = ContractNote.make(co.contract, false, true, {"text": "Исполнено" if co.success else "Сорван", "ok": co.success})
		note.get_child(0).add_child(UI.label(co.note, 14.5, UI.INK_GREEN if co.success else UI.INK_RED, "italic", true))
		p.add_child(note)
		p.add_child(UI.space(16))
	for r in s.raiders:
		var row = UI.hbox(10)
		row.add_child(UI.portrait(r.candidateId, 30, 6, not r.alive))
		row.add_child(UI.expand(UI.label(r.name, 14, UI.TEXT if r.alive else UI.BORDER_HOVER)))
		var st: String = ("%d%% HP%s" % [maxi(0, int(round(100.0 * r.hp / r.maxHp))), (" · +%d XP" % (40 if res.isBoss else 15)) if res.win and not arena else ""]) if r.alive else "погиб(ла)"
		row.add_child(UI.label(st, 12.5, UI.TEXT_DIM))
		p.add_child(row)
		p.add_child(UI.space(8))
	var lines: Array = Game.b.banter()
	for i in lines.size():
		var l: Dictionary = lines[i]
		var row = UI.hbox(8)
		var bubble = PanelContainer.new()
		var sb = StyleBoxFlat.new()
		sb.bg_color = UI.SURFACE if i == 0 else Color(UI.ACCENT, 0.12)
		sb.border_color = UI.BORDER if i == 0 else UI.ACCENT
		sb.set_border_width_all(1); sb.set_corner_radius_all(UI.px(12))
		sb.content_margin_left = UI.px(12); sb.content_margin_right = UI.px(12); sb.content_margin_top = UI.px(8); sb.content_margin_bottom = UI.px(8)
		bubble.add_theme_stylebox_override("panel", sb)
		var bv = UI.vbox(2)
		bv.add_child(UI.label(l.name, 11.5, UI.TEXT_FAINT, "medium"))
		bv.add_child(UI.label(l.text, 14, UI.TEXT, "regular", true))
		bubble.add_child(bv)
		bubble.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var face = UI.portrait(l.id, 34, 17)
		if i == 0:
			row.add_child(face); row.add_child(bubble); row.add_child(UI.space(0, 40))
		else:
			row.add_child(UI.space(0, 40)); row.add_child(bubble); row.add_child(face)
		p.add_child(UI.space(6))
		p.add_child(row)
	if res.goldFound > 0:
		var g = UI.hbox(8)
		g.add_child(UI.icon("coins", 15, UI.WARN))
		g.add_child(UI.label("+%d золота" % res.goldFound, 14, UI.WARN, "medium"))
		p.add_child(UI.space(10))
		p.add_child(g)
	if arena and Game.arena_opponent:
		var a = UI.hbox(8)
		var col = UI.GOOD if res.win else UI.DANGER
		a.add_child(UI.icon("sword", 15, col))
		a.add_child(UI.label("%s рейтинга · сейчас %d" % [("+%d" % Game.arena_opponent.ratingWin) if res.win else ("-%d" % Game.arena_opponent.ratingLoss), Game.arena_rating], 14, col, "medium"))
		p.add_child(a)
	if res.curioFound:
		var curio = null
		for c in DB.curios:
			if c.name == res.curioFound: curio = c
		if curio:
			p.add_child(UI.space(18))
			var fr = UI.frame("gold", Vector4(12, 12, 12, 12))
			var row = UI.hbox(12)
			row.add_child(UI.picture(DB.item_icon_path(curio.icon), 52, 52, 8))
			var v = UI.vbox(2)
			v.add_child(UI.kicker("Найдена реликвия", UI.ACCENT_SOFT, 11))
			v.add_child(UI.label(curio.name, 15, UI.TEXT, "medium"))
			v.add_child(UI.label(curio.desc, 12.5, UI.TEXT_DIM, "regular", true))
			row.add_child(UI.expand(v))
			fr.add_child(row)
			p.add_child(fr)
	if res.reagentFound:
		p.add_child(UI.space(12))
		var fr = UI.frame("plain", Vector4(10, 10, 10, 10))
		var row = UI.hbox(10)
		row.add_child(UI.picture(DB.item_icon_path(res.reagentFound.icon), 32, 32, 6))
		row.add_child(UI.label("+%d · %s" % [res.reagentFound.qty, res.reagentFound.name], 13.5, UI.TEXT_MUTED, "regular", true))
		fr.add_child(row)
		p.add_child(fr)
	if not res.loot.is_empty():
		p.add_child(UI.space(18))
		p.add_child(UI.kicker("Дележ добычи", Color("#b8935c"), 12))
		p.add_child(UI.space(10))
		for i in res.loot.size():
			var item: Dictionary = res.loot[i]
			var fr = UI.frame("plain", Vector4(12, 12, 12, 12))
			var v = UI.vbox(8)
			var head = UI.hbox(10)
			head.add_child(UI.picture(DB.item_icon_path(DB.gear_in(item.slot, item.gearId).get("icon")), 40, 40, 7))
			var hv = UI.vbox(2)
			hv.add_child(UI.label(item.name, 15, UI.ACCENT_SOFT, "medium"))
			hv.add_child(UI.label(DB.slot_label(DB.slots_for_kind(item.slot)[0]).to_upper(), 11, UI.TEXT_FAINT))
			head.add_child(hv)
			v.add_child(head)
			if item.assigned != null:
				var who = Game.b._raider(item.assigned)
				var hero = Game.find_hero(who.candidateId) if who else null
				var worn: bool = hero != null and item.gearId in hero.equipment.values()
				v.add_child(UI.label(("Экипировано: " + who.name) if worn else ("Досталось: %s · лежит на складе, сет не снят" % who.name), 13.5, UI.TEXT_DIM, "regular", true))
			else:
				var flow = HFlowContainer.new()
				flow.add_theme_constant_override("h_separation", UI.px(6))
				flow.add_theme_constant_override("v_separation", UI.px(6))
				for r in s.raiders:
					if not r.alive: continue
					var rid: int = r.id
					var idx = i
					flow.add_child(UI.chip(r.name, false, func(): Game.b.assign_loot(idx, rid)))
				v.add_child(flow)
			fr.add_child(v)
			p.add_child(fr)
			p.add_child(UI.space(8))
	p.add_child(UI.space(20))
	var primary: String = "Вернуться на арену" if arena else (("Вернуться в лагерь" if res.isBoss else "Дальше") if res.win else "Начать поход заново")
	if band != null: primary = "Вернуться на карту"
	elif Game.from_world and (res.isBoss or not res.win): primary = "Вернуться на карту"
	p.add_child(UI.primary_button(primary, Game.b.result_primary))
	if not res.win and band == null:
		p.add_child(UI.space(8))
		p.add_child(UI.secondary_button("Сменить отряд", Game.b.result_secondary))
