class_name ContractNote
## A contract written out on parchment: who pays, where, on what terms and for how much.


static func make(c: Dictionary, sealed := false, compact := false, stamp = null) -> PanelContainer:
	var sheet = UI.parchment()
	var v = UI.vbox(4)
	sheet.add_child(v)
	var top = UI.hbox(12)
	var names = UI.vbox(0)
	names.add_child(UI.label(c.locationName, 12.5, UI.INK_RED, "caps"))
	names.add_child(UI.label(c.dungeonName, 20, UI.INK, "title", true))
	top.add_child(UI.expand(names))
	if sealed: top.add_child(UI.wax_seal(42, c.icon))
	v.add_child(top)
	if not compact: v.add_child(UI.label("«%s» — %s" % [c.clientLine, c.clientName], 14, UI.INK_MUTED, "italic", true))
	v.add_child(UI.space(4))
	v.add_child(UI.rule())
	v.add_child(UI.space(4))
	var terms = UI.hbox(8)
	terms.add_child(UI.icon(c.icon, 16, UI.INK))
	var tv = UI.vbox(1)
	tv.add_child(UI.label(c.termTitle, 16, UI.INK, "semibold"))
	tv.add_child(UI.label(c.termDesc, 14, UI.INK_MUTED, "regular", true))
	if c.progress: tv.add_child(UI.label(c.progress, 13.5, UI.INK_RED, "italic", true))
	terms.add_child(UI.expand(tv))
	var pay = UI.vbox(0)
	var pl = UI.label(str(c.pay), 20, UI.INK, "title")
	pl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	pay.add_child(pl)
	pay.add_child(UI.label("золота", 12, UI.INK_MUTED, "italic"))
	terms.add_child(pay)
	v.add_child(terms)
	if stamp != null:
		var col: Color = UI.INK_GREEN if stamp.ok else UI.INK_RED
		var text: String = stamp.text
		sheet.draw.connect(func():
			var f: Font = UI.FONTS.title
			var fs = UI.px(22)
			var w = f.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
			var at = Vector2(sheet.size.x - w - UI.px(30), sheet.size.y - UI.px(26))
			sheet.draw_set_transform(at + Vector2(w * 0.5, -fs * 0.3), deg_to_rad(-10), Vector2.ONE)
			var box = Rect2(Vector2(-w * 0.5 - UI.px(10), -fs * 0.75), Vector2(w + UI.px(20), fs * 1.25))
			sheet.draw_rect(box, Color(col, 0.85), false, 4)
			sheet.draw_string(f, Vector2(-w * 0.5, fs * 0.3), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(col, 0.85))
			sheet.draw_set_transform(Vector2.ZERO))
	return sheet
