extends Screen
## An incident report on a dark iron plate; the choices are numbered plates under it.


func build() -> void:
	var ev = Game.active_event
	if ev == null: return
	var p = make_page(0, 32, 20, false, NARROW_W)
	var mark = ColorRect.new(); mark.color = UI.ACCENT; mark.custom_minimum_size = Vector2(UI.px(34), UI.px(3))
	mark.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	p.add_child(mark)
	p.add_child(UI.space(14))
	p.add_child(UI.kicker("Отдел кадров"))
	p.add_child(UI.screen_title(ev.title))
	p.add_child(UI.space(14))
	var sheet = UI.grim_sheet(Vector4(18, 20, 18, 18))
	var v = UI.vbox(6)
	sheet.add_child(v)
	if not ev.faces.is_empty():
		var faces = UI.hbox(8)
		var big: bool = ev.faces.size() <= 2
		for id in ev.faces:
			var c = UI.vbox(4)
			c.add_child(UI.portrait(id, 66 if big else 50, 3))
			var n = UI.label(Game.name_of(id), 12.5, UI.TEXT_DIM, "italic")
			n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			c.add_child(n)
			faces.add_child(c)
		v.add_child(faces)
		v.add_child(UI.space(6))
	v.add_child(UI.label(ev.desc, 16, UI.TEXT, "regular", true))
	if ev.stakes and ev.resultText == null:
		var row = UI.hbox(8)
		row.add_child(UI.icon("warning", 15, UI.GRIM_KICKER))
		row.add_child(UI.label(ev.stakes, 14, UI.GRIM_KICKER, "italic", true))
		v.add_child(row)
	v.add_child(UI.space(6))
	v.add_child(UI.grim_rule())
	v.add_child(UI.space(4))
	if ev.resultText == null:
		var opts = [["a", ev.labelA], ["b", ev.labelB]]
		for i in 2:
			var key: String = opts[i][0]
			var row = UI.hbox(10)
			row.add_child(UI.label("%d." % (i + 1), 17, UI.GRIM_GOLD_BRIGHT, "title"))
			row.add_child(UI.label(opts[i][1], 15.5, UI.GRIM_TITLE, "semibold", true))
			var plate = UI.grim_action("", func(): Game.choose_event(key), false, false, 48)
			UI.clear(plate)
			plate.add_child(UI.margin(row, 2, 8, 2, 8))
			v.add_child(plate)
	else:
		var row = UI.hbox(10)
		row.add_child(UI.icon("scroll", 17, UI.GRIM_GOLD))
		row.add_child(UI.label(ev.resultText, 15.5, UI.TEXT, "italic", true))
		v.add_child(row)
	p.add_child(sheet)
	if ev.resultText != null:
		p.add_child(UI.space(24))
		p.add_child(UI.primary_button("Продолжить", Game.dismiss_event))
