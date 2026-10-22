extends Screen
## A hero's talents, the classic way: three trees (one per spec), a point a
## level from the second, ranks within each talent, deeper rows opening as
## points go into that tree, and a new spell at the foot of each.

var tab = ""
var picked = ""


func build() -> void:
	var c = Game.find_hero(Game.char_id)
	if c == null: return
	if tab == "": tab = c.spec
	var p = make_page(0)
	p.add_child(header_with_gold())
	p.add_child(UI.space(10))
	p.add_child(UI.kicker(c.name))
	p.add_child(UI.screen_title("Таланты"))
	p.add_child(UI.space(8))
	var total: int = Game.talent_points_total(c)
	var free: int = total - Game.talent_points_spent(c)
	var info = UI.hbox(10)
	info.add_child(UI.expand(UI.label("Свободно очков: %d из %d. Очко — за каждый уровень со второго." % [free, total], 13.5, UI.WARN if free > 0 else UI.TEXT_DIM, "regular", true)))
	var cost: int = Game.respec_cost(c)
	if Game.talent_points_spent(c) > 0:
		info.add_child(UI.center(pill_button("Сбросить · %d" % cost, Game.gold >= cost, func(): Game.reset_talents(c.id))))
	p.add_child(info)
	p.add_child(UI.space(14))
	var specs: Array = DB.specs_of(c.heroClass)
	if App.wide:
		var row = UI.hbox(12)
		for sp in specs: row.add_child(UI.expand(_tree(c, sp)))
		p.add_child(row)
	else:
		p.add_child(tab_row(specs.map(func(sp): return [sp.id, "%s %d" % [sp.name, Game.tree_points(c, sp.id)]]), tab, func(k):
			tab = k
			picked = ""
			refresh()))
		p.add_child(UI.space(12))
		for sp in specs:
			if sp.id == tab: p.add_child(_tree(c, sp))
	p.add_child(UI.space(12))
	if picked != "": p.add_child(_detail(c, picked))
	else:
		var hint = UI.label("Нажмите на талант, чтобы прочитать его и вложить очко.", 13, UI.TEXT_FAINT, "italic", true)
		hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		p.add_child(hint)


## One tree: the spec's name and points, then its rows.
func _tree(c: Dictionary, sp: Dictionary) -> Control:
	var fr = UI.frame("gold" if sp.id == c.spec else "plain", Vector4(12, 12, 12, 14))
	var v = UI.vbox(10)
	fr.add_child(v)
	var head = UI.hbox(8)
	head.add_child(UI.center(UI.icon(sp.icon, 18, UI.ACCENT)))
	var hv = UI.vbox(0)
	hv.add_child(UI.label(sp.name, 16, UI.ACCENT_SOFT, "title"))
	hv.add_child(UI.label(DB.ROLE_NAME[sp.role] + (" · текущая" if sp.id == c.spec else ""), 11, UI.TEXT_FAINT))
	head.add_child(UI.expand(hv))
	head.add_child(UI.center(UI.label(str(Game.tree_points(c, sp.id)), 20, UI.WARN, "title")))
	v.add_child(head)
	v.add_child(UI.rule(Color(UI.BORDER_STRONG, 0.6)))
	var talents: Array = DB.talent_tree(c.heroClass, sp.id)
	var tiers: Array = DB.specs.TALENT_TIERS
	for i in tiers.size():
		var row = UI.hbox(10, BoxContainer.ALIGNMENT_CENTER)
		var open: bool = Game.tree_points(c, sp.id) >= tiers[i]
		var lab = UI.label("%d" % tiers[i], 10.5, UI.TEXT_FAINT if open else UI.BORDER_HOVER)
		lab.custom_minimum_size.x = UI.px(18)
		lab.tooltip_text = "Ряд открывается, когда в ветку вложено %d очк." % tiers[i]
		lab.mouse_filter = Control.MOUSE_FILTER_PASS
		row.add_child(UI.center(lab))
		for t in talents.filter(func(x): return x.tier == i): row.add_child(_node(c, sp.id, t))
		row.add_child(UI.space(0, 18))
		v.add_child(row)
	return fr


## A talent: its icon, ranks so far, and whether a point can go in.
func _node(c: Dictionary, spec_id: String, t: Dictionary) -> Control:
	var rank: int = Game.talent_rank(c, t.id)
	var block: String = Game.talent_block(c, spec_id, t)
	var maxed: bool = rank >= int(t.max)
	var can: bool = block == ""
	var locked: bool = not can and rank == 0 and not maxed
	var capstone: bool = t.eff.has("grants")
	var col = UI.vbox(3)
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.05, 0.035, 0.95)
	sb.border_color = UI.GOLD if maxed else (UI.GOOD if can else (UI.ACCENT if rank > 0 else UI.BORDER))
	if t.id == picked: sb.border_color = Color.WHITE
	sb.set_border_width_all(3 if capstone else 2)
	sb.set_corner_radius_all(UI.px(27 if capstone else 7))
	pn.add_theme_stylebox_override("panel", sb)
	pn.custom_minimum_size = Vector2(UI.px(52), UI.px(52))
	var ic = UI.icon(t.icon, 24, UI.ACCENT_SOFT if not locked else UI.TEXT_FAINT, "fill" if maxed else "regular")
	if locked: ic.modulate.a = 0.5
	pn.add_child(UI.center(ic))
	pn.tooltip_text = "%s (%d/%d)\n%s" % [t.name, rank, t.max, "\n".join(DB.talent_lines(c.heroClass, t, maxi(1, rank)))]
	UI.tap(pn, func():
		picked = t.id
		refresh())
	col.add_child(UI.center(pn))
	var r = UI.label("%d/%d" % [rank, t.max], 10.5, UI.GOLD if maxed else (UI.GOOD if can else UI.TEXT_FAINT), "semibold")
	r.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(r)
	return col


## The picked talent: what it gives now and at the next rank, and the button.
func _detail(c: Dictionary, tid: String) -> Control:
	var t = DB.talent(tid)
	var spec_id: String = tid.split(".")[1]
	var rank: int = Game.talent_rank(c, tid)
	var block: String = Game.talent_block(c, spec_id, t)
	var sheet = UI.parchment(Vector4(16, 14, 16, 14))
	var v = UI.vbox(6)
	sheet.add_child(v)
	var top = UI.hbox(10)
	top.add_child(UI.center(UI.icon(t.icon, 22, UI.INK)))
	var tv = UI.vbox(0)
	tv.add_child(UI.label(t.name, 19, UI.INK, "title"))
	tv.add_child(UI.label("%s · ранг %d из %d" % [DB.spec_def(c.heroClass, spec_id).name, rank, t.max], 12.5, UI.INK_MUTED, "italic"))
	top.add_child(UI.expand(tv))
	v.add_child(top)
	if rank > 0:
		v.add_child(UI.label("Сейчас:", 12, UI.INK_RED, "caps"))
		for l in DB.talent_lines(c.heroClass, t, rank): v.add_child(UI.label("• " + l, 14, UI.INK, "regular", true))
	if rank < int(t.max):
		v.add_child(UI.label("Следующий ранг:" if rank > 0 else "Даёт:", 12, UI.INK_RED, "caps"))
		for l in DB.talent_lines(c.heroClass, t, rank + 1): v.add_child(UI.label("• " + l, 14, UI.INK, "regular", true))
	v.add_child(UI.rule())
	if block == "":
		v.add_child(UI.ink_action("Изучить (+1)", func(): Game.learn_talent(c.id, spec_id, tid), true))
	else:
		var l = UI.label(block, 13.5, UI.INK_MUTED, "italic")
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(l)
	return sheet
