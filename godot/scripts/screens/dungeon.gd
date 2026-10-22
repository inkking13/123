extends Screen
## Before each fight of a trip: where we are, who's waiting, the boss's trick, the squad's wounds.


func build() -> void:
	var dungeon: Dictionary = Game.current_dungeon()
	var enc: Dictionary = dungeon.encounters[Game.enc_idx]
	var p = make_page(0, 24, 16, false, NARROW_W)
	var steps = UI.hbox(4)
	for i in dungeon.encounters.size():
		var e: Dictionary = dungeon.encounters[i]
		var col = UI.vbox(6)
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var bar = ColorRect.new()
		bar.color = UI.BORDER_HOVER if i < Game.enc_idx else (UI.ACCENT if i == Game.enc_idx else UI.BORDER)
		bar.custom_minimum_size = Vector2(0, UI.px(3))
		col.add_child(bar)
		col.add_child(UI.label("Трон" if e.type == "boss" else "%d. %s" % [i + 1, e.name], 10.5, UI.ACCENT_SOFT if i == Game.enc_idx else UI.BORDER_HOVER, "regular", true))
		steps.add_child(col)
	p.add_child(steps)
	p.add_child(UI.space(20))
	p.add_child(UI.kicker(dungeon.name))
	p.add_child(UI.screen_title(enc.name))
	p.add_child(UI.space(8))
	p.add_child(UI.label(enc.desc, 14.5, UI.TEXT_MUTED, "regular", true))
	p.add_child(UI.space(18))
	var fr = UI.frame("plain", Vector4(14, 14, 14, 14))
	var v = UI.vbox(10)
	var head = UI.hbox(8)
	head.add_child(UI.expand(UI.label(enc.enemyName, 16, UI.DANGER, "medium", true)))
	head.add_child(UI.label("HP %d" % enc.hp, 13, UI.TEXT_DIM))
	v.add_child(head)
	var foes = UI.hbox(8)
	if enc.type == "boss":
		var path = DB.boss_art_path(dungeon.id)
		if path != "": foes.add_child(UI.picture(path, 96, 96, 8))
	else:
		var art = DB.room_art_for(dungeon)
		if art:
			for role in Battle.room_group_roles(Game.enc_idx):
				var c = UI.vbox(4)
				c.add_child(UI.picture(DB.monster_path(art[role]), 64, 64, 8))
				var l = UI.label(Battle.ENEMY_NAME[role], 11, UI.TEXT_DIM)
				l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				c.add_child(l)
				foes.add_child(c)
	v.add_child(foes)
	var sig = dungeon.get("signature")
	if enc.type == "boss" and sig != null:
		v.add_child(UI.rule(UI.BORDER))
		var info: Dictionary = DB.dungeons.SIGNATURE_INFO[sig]
		v.add_child(UI.kicker("Особый приём · " + info.name, UI.WARN, 11.5))
		v.add_child(UI.label(info.desc, 13.5, UI.TEXT_MUTED, "regular", true))
	fr.add_child(v)
	p.add_child(fr)
	p.add_child(UI.space(18))
	var c = Game.contract_here()
	if c:
		p.add_child(ContractNote.make(c, true, true))
		p.add_child(UI.space(12))
	p.add_child(UI.kicker("Состояние отряда", Color("#b8935c"), 12))
	p.add_child(UI.space(10))
	for m in Game.squad():
		var r = null
		if Game.b.sim:
			for x in Game.b.sim.raiders:
				if x.candidateId == m.id: r = x
		var pct = maxi(0, int(round(100.0 * r.hp / r.maxHp))) if r else 100
		var alive: bool = r.alive if r else true
		var row = UI.hbox(10)
		var pic = UI.portrait(m.id, 30, 6, not alive)
		row.add_child(pic)
		var n = UI.label(m.name, 14, UI.TEXT if alive else UI.BORDER_HOVER)
		n.custom_minimum_size.x = UI.px(90)
		row.add_child(n)
		var bar = UI.progress(pct if alive else 0, UI.GOOD if pct > 60 else (UI.WARN if pct > 30 else UI.DANGER), 5)
		row.add_child(UI.center(bar))
		bar.get_parent().size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bar.custom_minimum_size.x = UI.px(150)
		var pl = UI.label("%d%%" % (pct if alive else 0), 12, UI.TEXT_FAINT)
		pl.custom_minimum_size.x = UI.px(38)
		pl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		row.add_child(pl)
		p.add_child(row)
		p.add_child(UI.space(8))
	p.add_child(UI.space(8))
	p.add_child(UI.label("Отряд входит в «%s»." % dungeon.name if Game.enc_idx == 0 else "Раны прошлой схватки никуда не делись — отряд идёт дальше потрёпанным.", 13.5, UI.TEXT_FAINT, "italic", true))
	p.add_child(UI.space(90))
	var dock = UI.hbox(8)
	var bg = PanelContainer.new()
	var sb = StyleBoxFlat.new(); sb.bg_color = Color(0.063, 0.047, 0.035, 0.9)
	sb.content_margin_left = UI.px(16); sb.content_margin_right = UI.px(16); sb.content_margin_top = UI.px(8)
	sb.content_margin_bottom = UI.px(20) + App.inset_bottom()
	bg.add_theme_stylebox_override("panel", sb)
	bg.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bg.grow_vertical = Control.GROW_DIRECTION_BEGIN
	bg.add_child(dock)
	span_column(bg)
	add_child(bg)
	if Game.enc_idx == 0: dock.add_child(UI.secondary_button("Назад", Game.back, 50))
	dock.add_child(UI.expand(UI.primary_button("В тронный зал" if enc.type == "boss" else "Войти в бой", Game.b.start_encounter, "crown-simple" if enc.type == "boss" else "sword")))
