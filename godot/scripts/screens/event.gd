extends Screen
## An incident report on parchment; the choices are inked onto it as numbered lines.


func build() -> void:
	var ev = Game.active_event
	if ev == null: return
	var p = make_page(0, 32, 20, false)
	var mark = ColorRect.new(); mark.color = UI.ACCENT; mark.custom_minimum_size = Vector2(UI.px(34), UI.px(3))
	mark.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	p.add_child(mark)
	p.add_child(UI.space(14))
	p.add_child(UI.kicker("Отдел кадров"))
	p.add_child(UI.screen_title(ev.title))
	p.add_child(UI.space(14))
	var sheet = UI.parchment(Vector4(18, 18, 18, 18))
	var v = UI.vbox(6)
	sheet.add_child(v)
	if not ev.faces.is_empty():
		var faces = UI.hbox(8)
		var big: bool = ev.faces.size() <= 2
		for id in ev.faces:
			var c = UI.vbox(4)
			c.add_child(UI.portrait(id, 66 if big else 50, 3))
			var n = UI.label(Game.name_of(id), 12.5, UI.INK_MUTED, "italic")
			n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			c.add_child(n)
			faces.add_child(c)
		v.add_child(faces)
		v.add_child(UI.space(6))
	v.add_child(UI.label(ev.desc, 16, UI.INK, "regular", true))
	if ev.stakes and ev.resultText == null:
		var row = UI.hbox(8)
		row.add_child(UI.icon("warning", 15, UI.INK_RED))
		row.add_child(UI.label(ev.stakes, 14, UI.INK_RED, "italic", true))
		v.add_child(row)
	v.add_child(UI.space(6))
	v.add_child(UI.rule())
	v.add_child(UI.space(6))
	if ev.resultText == null:
		var opts = [["a", ev.labelA], ["b", ev.labelB]]
		for i in 2:
			var key: String = opts[i][0]
			var row = UI.hbox(10)
			row.add_child(UI.label("%d." % (i + 1), 16, UI.INK_RED, "title"))
			row.add_child(UI.label(opts[i][1], 16, UI.INK, "semibold", true))
			var holder = UI.margin(row, 6, 9, 6, 9)
			UI.tap(holder, func(): Game.choose_event(key))
			v.add_child(holder)
	else:
		var row = UI.hbox(10)
		row.add_child(UI.icon("scroll", 17, UI.INK_MUTED))
		row.add_child(UI.label(ev.resultText, 15.5, UI.INK, "italic", true))
		v.add_child(row)
	p.add_child(sheet)
	if ev.resultText != null:
		p.add_child(UI.space(24))
		p.add_child(UI.primary_button("Продолжить", Game.dismiss_event))
