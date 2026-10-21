extends Screen
## The guild in numbers: outcome of operations, the budget and morale over the last trips.


func build() -> void:
	var vm: Dictionary = Game.analytics()
	var p = make_page(0)
	p.add_child(UI.back_link())
	p.add_child(UI.space(14))
	p.add_child(UI.kicker("Отдел кадров"))
	p.add_child(UI.screen_title("Аналитика гильдии"))
	p.add_child(UI.space(18))
	p.add_child(UI.kicker("Исход операций", Color("#b8935c"), 12))
	p.add_child(UI.space(10))
	var row = UI.hbox(8)
	row.add_child(_stat("Win-rate", "—" if vm.winRatePct == null else "%d%%" % vm.winRatePct, UI.ACCENT))
	row.add_child(_stat("Боссы", str(vm.bossWins), UI.GOOD))
	row.add_child(_stat("Вайпы", str(vm.wipes), UI.DANGER))
	p.add_child(row)
	p.add_child(UI.space(8))
	var row2 = UI.hbox(8)
	row2.add_child(_stat("Комнаты", str(vm.roomWins), UI.TEXT))
	row2.add_child(_stat("Всего боёв", str(vm.totalFights), UI.TEXT))
	row2.add_child(_stat("KPI", "%d/%d" % [vm.kpiDone, vm.kpiTotal], UI.WARN))
	p.add_child(row2)
	p.add_child(UI.space(18))
	p.add_child(UI.kicker("Бюджет гильдии", Color("#b8935c"), 12))
	p.add_child(UI.space(10))
	p.add_child(_chart(vm.history.map(func(h): return float(h.gold)), UI.WARN, "%d золота сейчас" % vm.gold))
	p.add_child(UI.space(18))
	p.add_child(UI.kicker("Средняя мораль", Color("#b8935c"), 12))
	p.add_child(UI.space(10))
	p.add_child(_chart(vm.history.map(func(h): return float(h.avgMorale)), UI.GOOD, "%d%% сейчас" % vm.avgMorale, 100.0))


func _stat(title: String, value: String, color: Color) -> Control:
	var fr = UI.frame("plain", Vector4(12, 12, 12, 12))
	fr.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v = UI.vbox(2)
	v.add_child(UI.kicker(title, UI.TEXT_FAINT, 10.5))
	v.add_child(UI.label(value, 21, color, "medium"))
	fr.add_child(v)
	return fr


## A line over the last trips back to camp.
func _chart(values: Array, color: Color, caption: String, top := -1.0) -> Control:
	var fr = UI.frame("plain", Vector4(14, 14, 14, 14))
	var v = UI.vbox(8)
	v.add_child(UI.label(caption, 14, color, "medium"))
	var c = Control.new()
	c.custom_minimum_size = Vector2(0, UI.px(110))
	c.draw.connect(func():
		if values.size() < 2:
			c.draw_string(UI.FONTS.italic, Vector2(0, c.size.y * 0.5), "Данные появятся после нескольких походов.", HORIZONTAL_ALIGNMENT_LEFT, -1, UI.px(13), UI.TEXT_FAINT)
			return
		var hi: float = top if top > 0 else maxf(1.0, values.max())
		var pts = PackedVector2Array()
		for i in values.size():
			pts.append(Vector2(c.size.x * i / float(values.size() - 1), c.size.y * (1.0 - values[i] / hi)))
		for k in 4:
			var y = c.size.y * k / 3.0
			c.draw_line(Vector2(0, y), Vector2(c.size.x, y), Color(UI.BORDER, 0.6), 1)
		var fill = pts.duplicate()
		fill.append(Vector2(c.size.x, c.size.y)); fill.append(Vector2(0, c.size.y))
		c.draw_colored_polygon(fill, Color(color, 0.14))
		c.draw_polyline(pts, color, 3.0, true))
	v.add_child(c)
	fr.add_child(v)
	return fr
