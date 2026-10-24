extends Screen
## The open map's screen: the 3D land behind (WorldView), and over it the
## land, the day and hour, the squad's rations and tiredness, a word on what
## just happened, and — when the squad stands at a place — what can be done
## there. Making camp and the way back to the guild are always at hand.

var view: WorldView
var _view_region = ""
var _place = ""        # the place whose card is open
var _stamp = []
var _note_at = 0.0
var _top: Control
var _bottom: Control
var _mini: Minimap


func _enter_tree() -> void:
	_make_view()


func _exit_tree() -> void:
	if is_instance_valid(view): view.queue_free()


func _make_view() -> void:
	if is_instance_valid(view): view.queue_free()
	view = WorldView.new()
	_view_region = Game.w.region
	view.place_tapped.connect(func(_id): _place = "")
	get_tree().root.add_child.call_deferred(view)


func build() -> void:
	var w = Game.w
	if w.region != _view_region: _make_view()
	_top = _top_bar(w)
	add_child(_top)
	_mini = Minimap.new()
	_mini.view = view
	var side = UI.px(180 if App.wide else 112)
	_mini.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_mini.offset_left = -side - UI.px(14 if App.wide else 10)
	_mini.offset_right = -UI.px(14 if App.wide else 10)
	_mini.offset_top = UI.px(14)
	_mini.offset_bottom = _mini.offset_top + side
	add_child(_mini)
	_bottom = _bottom_bar(w)
	add_child(_bottom)
	add_child(Tabs.make())
	if w.event != null: add_child(_event_card(w))
	_measure.call_deferred()


func _measure() -> void:
	if not is_instance_valid(view) or not is_instance_valid(_top): return
	view.band_top = _top.get_global_rect().end.y
	# On a phone the map hangs under the top bar, at the right.
	if is_instance_valid(_mini) and not App.wide:
		var side = _mini.offset_bottom - _mini.offset_top
		_mini.offset_top = _top.get_global_rect().end.y + UI.px(8)
		_mini.offset_bottom = _mini.offset_top + side
	view.band_bottom = get_viewport_rect().size.y - _bottom.get_global_rect().position.y


# Walking, the clock and the bands run here; the screen redraws when
# something it shows has changed.
func _process(dt: float) -> void:
	var w = Game.w
	if Game.screen != "world": return
	var band = w.step(dt)
	if band != null:
		Game.start_skirmish(band)
		return
	var here = w.arrived()
	if here != "" and here != _place:
		_place = here
		w.goal = ""
	if w.log_note != "" and _note_at == 0.0: _note_at = Time.get_ticks_msec() / 1000.0
	if _note_at > 0 and Time.get_ticks_msec() / 1000.0 - _note_at > 5.0:
		w.log_note = ""
		_note_at = 0.0
	var chasing = w.region_bands().filter(func(b): return b.chasing).size()
	var stamp = [int(w.hours), w.day, w.food, int(w.fatigue / 10), w.hungry, _place, w.log_note, w.region, chasing, Game.gold, w.event != null, w.tasks.size(), w.weather()]
	if stamp != _stamp:
		var hour_changed = _stamp.is_empty() or stamp[0] != _stamp[0]
		_stamp = stamp
		if hour_changed: Game.notify()
		else: refresh()
	if is_instance_valid(_top): _measure()


func _panel(style_alpha := 0.86) -> PanelContainer:
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.063, 0.047, 0.035, style_alpha)
	sb.border_color = Color(0.79, 0.64, 0.42, 0.45)
	sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(10))
	sb.set_content_margin_all(UI.px(10))
	pn.add_theme_stylebox_override("panel", sb)
	pn.mouse_filter = Control.MOUSE_FILTER_STOP
	return pn


# ── the top: land, day and hour, rations, tiredness ─────────────────────────
func _top_bar(w) -> Control:
	var wrap = UI.vbox(6)
	if App.wide:
		wrap.set_anchors_preset(Control.PRESET_TOP_LEFT)
		wrap.offset_left = UI.px(Tabs.RAIL + 14); wrap.offset_right = UI.px(Tabs.RAIL + 14 + 420); wrap.offset_top = UI.px(14)
	else:
		wrap.set_anchors_preset(Control.PRESET_TOP_WIDE)
		wrap.offset_left = UI.px(10); wrap.offset_right = -UI.px(10); wrap.offset_top = App.inset_top() + UI.px(8)
	var pn = _panel()
	var v = UI.vbox(7)
	pn.add_child(v)
	var head = UI.hbox(8)
	var night: bool = w.is_night()
	head.add_child(UI.center(UI.icon("moon" if night else "sun", 18, Color(0.7, 0.78, 1.0) if night else UI.GOLD, "fill")))
	var hv = UI.vbox(0)
	hv.add_child(UI.label(DB.locations[w.location_index()].name, 17, Color("#f1e4c6"), "title"))
	hv.add_child(UI.label("День %d · %02d:00%s" % [w.day, int(w.hours), " · ночь: враги опаснее" if night else ""], 12, UI.TEXT_DIM))
	if w.weather_word() != "": hv.add_child(UI.label(w.weather_word()[0].to_upper() + w.weather_word().substr(1), 12, Color(0.72, 0.8, 0.88), "medium"))
	head.add_child(UI.expand(hv))
	var gold = UI.hbox(4)
	gold.add_child(UI.center(UI.icon("coins", 14, UI.GOLD, "fill")))
	gold.add_child(UI.center(UI.label(str(Game.gold), 14, UI.GOLD, "semibold")))
	head.add_child(gold)
	v.add_child(head)
	var stats = UI.hbox(14)
	var food = UI.hbox(6)
	food.add_child(UI.center(UI.icon("fork-knife", 15, UI.DANGER if w.food < w.squad_size() else UI.ACCENT_SOFT)))
	food.add_child(UI.center(UI.label("%d пайков" % w.food, 13, UI.DANGER if w.food < w.squad_size() else UI.TEXT_MUTED, "medium")))
	food.tooltip_text = "Каждые 8 часов пути каждый боец съедает паёк. Без еды отряд голодает: устаёт вдвое быстрее и бьёт слабее."
	food.mouse_filter = Control.MOUSE_FILTER_PASS
	stats.add_child(food)
	var fat = UI.vbox(3)
	fat.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var fh = UI.hbox(4)
	fh.add_child(UI.expand(UI.label(("Голод · " if w.hungry else "") + w.fatigue_word(), 12, UI.DANGER if w.hungry or w.fatigue >= 60 else UI.TEXT_DIM, "medium")))
	fh.add_child(UI.label("усталость %d%%" % int(w.fatigue), 11, UI.TEXT_FAINT))
	fat.add_child(fh)
	fat.add_child(UI.progress(w.fatigue, UI.DANGER if w.fatigue >= 60 else UI.WARN, 5))
	fat.tooltip_text = "Усталость растёт в пути. С 60% отряд бьёт на 10% слабее, с 85% — на 20%. Снимается привалом или ночлегом."
	fat.mouse_filter = Control.MOUSE_FILTER_PASS
	stats.add_child(fat)
	v.add_child(stats)
	wrap.add_child(pn)
	if w.log_note != "":
		var note = _panel(0.8)
		note.add_child(UI.label(w.log_note, 13, UI.ACCENT_SOFT, "italic", true))
		wrap.add_child(note)
	if not w.tasks.is_empty():
		var tp = _panel(0.78)
		var tv = UI.vbox(3)
		tv.add_child(UI.kicker("Поручения", UI.TEXT_FAINT, 10))
		for t in w.tasks:
			var ready: bool = w.task_ready(t)
			var line = "%s — %s" % [t.title, "сдать в городе" if ready else ("%d/%d" % [Game.reagent_owned(t.target) if t.kind == "gather" else int(t.have), int(t.need)])]
			tv.add_child(UI.label(line, 12, UI.GOOD if ready else UI.TEXT_MUTED, "regular", true))
		tp.add_child(tv)
		wrap.add_child(tp)
	var chasers = w.region_bands().filter(func(b): return b.chasing)
	if not chasers.is_empty():
		var warn = _panel(0.85)
		(warn.get_theme_stylebox("panel") as StyleBoxFlat).border_color = UI.DANGER
		warn.add_child(UI.label("%s заметили отряд и идут наперехват!" % chasers[0].name, 13, Color("#f0c3bc"), "medium", true))
		wrap.add_child(warn)
	return wrap


# ── the bottom: the place at hand, camp, the guild ─────────────────────────
func _bottom_bar(w) -> Control:
	var wrap = UI.vbox(8)
	wrap.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	wrap.grow_vertical = Control.GROW_DIRECTION_BEGIN
	if App.wide:
		wrap.offset_left = UI.px(Tabs.RAIL + 14); wrap.offset_right = -UI.px(14); wrap.offset_bottom = -UI.px(14)
	else:
		wrap.offset_left = UI.px(10); wrap.offset_right = -UI.px(10)
		wrap.offset_bottom = -UI.px(Tabs.HEIGHT + 10) - App.inset_bottom()
	var card = _place_card(w)
	if card: wrap.add_child(UI.center(_cap(card, 460)) if App.wide else card)
	var row = UI.hbox(8, BoxContainer.ALIGNMENT_CENTER)
	row.add_child(_round_btn("campfire", "Привал", "Разбить лагерь: 8 часов, по пайку на бойца, усталость уходит; у каждого героя своё дело.", func(): Game.go("bivouac")))
	row.add_child(_round_btn("house", "В гильдию", "Вернуться в лагерь гильдии (отряд останется здесь).", func(): Game.go_tab("home")))
	row.add_child(_round_btn("map-trifold", "Земли", "Карта всех земель.", func(): Game.go("levelmap")))
	if is_instance_valid(view):
		row.add_child(UI.space(0, 10))
		row.add_child(_round_btn("arrow-counter-clockwise", "", "Повернуть (Q)", func(): view.turn(-45.0)))
		row.add_child(_round_btn("arrow-clockwise", "", "Повернуть (E)", func(): view.turn(45.0)))
		row.add_child(_round_btn("magnifying-glass-plus", "", "Приблизить", func(): view.zoom_by(0.85)))
		row.add_child(_round_btn("magnifying-glass-minus", "", "Отдалить", func(): view.zoom_by(1.18)))
	wrap.add_child(row)
	return wrap


## A meeting on the road: what happened and the answers.
func _event_card(w) -> Control:
	var e: Dictionary = w.event
	var shade = UI.veil()
	var c = CenterContainer.new()
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.add_child(c)
	var sheet = UI.grim_sheet(Vector4(20, 18, 20, 18))
	sheet.custom_minimum_size.x = UI.px(minf(480.0, get_viewport_rect().size.x / UI.K - 30.0))
	c.add_child(sheet)
	var v = UI.vbox(10)
	sheet.add_child(v)
	v.add_child(UI.grim_head(e.icon, "В пути", e.title))
	v.add_child(UI.label(e.text, 15, UI.TEXT_MUTED, "regular", true))
	v.add_child(UI.grim_rule())
	for i in e.options.size():
		var o: Dictionary = e.options[i]
		var idx = i
		var can: bool = w.can_take(o)
		v.add_child(UI.grim_action(o.label + ("" if can else " — не хватает"), func():
			var band = w.answer(idx)
			if band != null: Game.start_skirmish(band)
			else: refresh(), i == 0, not can))
	return shade


func _cap(c: Control, wpt: float) -> Control:
	c.custom_minimum_size.x = UI.px(wpt)
	return c


func _round_btn(icon: String, label: String, tip: String, fn: Callable) -> Control:
	var v = UI.vbox(2)
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.063, 0.047, 0.035, 0.85); sb.border_color = Color(0.79, 0.64, 0.42, 0.55)
	sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(21))
	pn.add_theme_stylebox_override("panel", sb)
	var d = 42.0 if label != "" else 34.0
	pn.custom_minimum_size = Vector2(UI.px(d), UI.px(d))
	pn.add_child(UI.center(UI.icon(icon, d * 0.45, Color("#e6cf9c"))))
	pn.tooltip_text = tip
	UI.tap(pn, fn)
	v.add_child(UI.center(pn))
	if label != "":
		var l = UI.shadowed(UI.label(label, 11, UI.TEXT_MUTED, "medium"))
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(l)
	v.size_flags_vertical = Control.SIZE_SHRINK_END
	return v


## What the squad can do where it stands.
func _place_card(w):
	var id = _place
	if id == "":
		var near = w.near_place()
		if near == null or w.target != null: return null
		id = near.id
	var p = w.place(id)
	if p == null: return null
	var sheet = UI.grim_sheet(Vector4(16, 14, 16, 14))
	var v = UI.vbox(8)
	sheet.add_child(v)
	var title = ""
	var desc = ""
	var acts = []
	match p.kind:
		"town":
			title = w.theme().town
			desc = "Рынок, таверна, контракты, провизия и ночлег."
			acts.append(["Войти в город", func(): Game.go("town")])
		"dungeon":
			var d = DB.dungeon(p.dungeon)
			title = d.name
			if Game.is_dungeon_unlocked(p.dungeon):
				desc = "%d комнаты · рекоменд. ГС %d%s" % [d.encounters.size(), d.recommendedGs, " · уже зачищено" if Game.defeated.has(p.dungeon) else ""]
				acts.append(["Пройти снова" if Game.defeated.has(p.dungeon) else "Войти", func(): Game.enter_dungeon(p.dungeon)])
			else:
				desc = "Закрыто. " + (d.lockedDesc if d.lockedDesc != "" else "Сначала одолейте хозяина предыдущего подземелья.")
		"chest":
			title = "Сундук"
			desc = "Брошенный кем-то сундук. Может, внутри что-то осталось." if not w.opened.has(id) else "Пусто."
			if not w.opened.has(id): acts.append(["Открыть", func():
				w.open_chest(id)
				if is_instance_valid(view): view.refresh_places()])
		"herb":
			title = "Место для сбора"
			desc = "Сырьё этой земли, дичь и коренья. Час работы." if w.herb_ready(id) else "Здесь уже собрано — отрастёт через пару дней."
			if w.herb_ready(id): acts.append(["Собрать", func():
				w.gather(id)
				if is_instance_valid(view): view.refresh_places()])
		"tavern", "market", "smith", "board", "barracks":
			title = w.building(p.kind).name
			match p.kind:
				"tavern":
					desc = "Тёплый очаг, эль и комнаты наверху. За столами сидят наёмники без работы."
					acts.append(["Ночлег · %d" % World.INN_PRICE, func(): w.rest_at_inn(), Game.gold < World.INN_PRICE])
					if Game.is_unlocked("hire"): acts.append(["Наёмники", func(): Game.go("hire")])
				"market":
					desc = "Лавки под пёстрыми навесами: снедь, ткани, оружие с чужих плеч. Сейчас %d пайков." % w.food
					acts.append(["Провизия · %d" % World.FOOD_PACK_PRICE, func(): w.buy_food(), Game.gold < World.FOOD_PACK_PRICE])
					if Game.is_unlocked("shop"): acts.append(["Торговые ряды", func(): Game.go("shop")])
				"smith":
					desc = "Горн не гаснет с рассвета. Кузнец наточит клинки отряда: +10%% к урону на %d боя%s." % [World.SHARPEN_FIGHTS, (" (ещё %d)" % w.sharpened) if w.sharpened > 0 else ""]
					acts.append(["Заточка · %d" % World.SHARPEN_PRICE, func(): w.sharpen(), Game.gold < World.SHARPEN_PRICE])
					if Game.is_unlocked("gear"): acts.append(["Снаряжение", func(): Game.go("gear")])
				"board":
					desc = "Объявления о наградах, заказы горожан и контракты гильдий."
					acts.append(["Поручения", func(): Game.go("town")])
					if Game.is_unlocked("contracts"): acts.append(["Контракты", func(): Game.go("contracts")])
				"barracks":
					desc = "Стража гоняет новобранцев на плацу. За плату пустят и ваш отряд: +%d опыта каждому, 3 часа, отряд устанет." % World.DRILL_XP
					if w.used_today("town:barracks"): desc = "Сегодня отряд уже тренировался со стражей."
					else: acts.append(["Учения · %d" % World.DRILL_PRICE, func(): w.drill(), Game.gold < World.DRILL_PRICE])
		"farm", "tower", "lake", "graveyard", "camp", "ruins", "shrine":
			title = World.SIGHTS[p.kind].name
			desc = w.sight_desc(p.kind)
			var redraw = func():
				if is_instance_valid(view): view.refresh_places()
			match p.kind:
				"farm":
					if w.used_today(id): desc = "Сегодня хуторяне уже всё продали — приходите завтра."
					else: acts.append(["Купить · %d" % World.FARM_PRICE, func(): w.farm_buy(id)])
				"tower":
					if w.used_today(id): desc = "Сегодня отряд уже поднимался на башню."
					else: acts.append(["Подняться (1 ч)", func(): w.tower_look(id)])
				"lake":
					if w.used_today(id): desc = "Рыба на сегодня ушла на глубину."
					else: acts.append(["Рыбачить (2 ч)", func(): w.fish(id)])
				"graveyard":
					if w.opened.has(id): desc = "Склепы пусты, могилы раскопаны."
					else: acts.append(["Обыскать склепы", func():
						var band = w.search_graves(id)
						redraw.call()
						if band != null: Game.start_skirmish(band)])
				"camp":
					acts.append(["Разбить лагерь здесь", func():
						w.safe_camp = true
						Game.go("bivouac")])
				"ruins":
					if w.opened.has(id): desc = "Всё ценное отсюда уже унесли."
					else: acts.append(["Обыскать (1 ч)", func():
						w.search_ruins(id)
						redraw.call()])
				"shrine":
					if w.used_today(id): desc = "Сегодня отряд уже молился здесь."
					else: acts.append(["Помолиться (1 ч)", func(): w.pray(id)])
		"road":
			var name: String = DB.locations[w.location_index(p.to)].name
			title = "Дорога: " + name
			if w.region_open(p.to):
				desc = "Около шести часов пути."
				acts.append(["Отправиться", func():
					_place = ""
					w.travel(p.to)])
			else:
				desc = "Закрыто: одолейте хозяина последнего подземелья этих земель."
	var top = UI.hbox(8)
	top.add_child(UI.expand(UI.shadowed(UI.label(title, 19, UI.GRIM_TITLE, "title", true))))
	var close = UI.center(UI.icon("x", 17, UI.GRIM_GOLD))
	close.custom_minimum_size = Vector2(UI.px(34), UI.px(34))
	top.add_child(UI.tap(close, func():
		_place = ""
		w.goal = ""
		refresh()))
	v.add_child(top)
	v.add_child(UI.label(desc, 13.5, UI.TEXT_MUTED, "italic", true))
	if not acts.is_empty():
		v.add_child(UI.grim_rule())
		var row = UI.hbox(8)
		for a in acts: row.add_child(UI.grim_action(a[0], a[1], a == acts[0], a.size() > 2 and a[2], 40))
		v.add_child(row)
	return sheet
