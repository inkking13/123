extends Screen
## A hero's file: portrait, level, stats, class, ability, gear, talents, specialization, profession, firing.

var confirm_fire = false
var gear_state = {}


func build() -> void:
	var cc = Game.find_hero(Game.char_id)
	if cc == null: cc = Game.pool[0]
	var p = make_page(0, 0, 0)
	# The portrait across the top, the name over its foot.
	var top = Control.new()
	top.custom_minimum_size = Vector2(0, UI.px(300))
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var pic = UI.portrait(cc.id, 300, 0)
	pic.set_anchors_preset(Control.PRESET_FULL_RECT)
	# The portrait is a wide banner: a wider window shows more of its height.
	if App.wide: top.custom_minimum_size.y = UI.px(400)
	pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	pic.material = null
	top.add_child(pic)
	var shade = UI.fade(Color(0.063, 0.047, 0.035, 0.1), Color(0.063, 0.047, 0.035, 0.95), 300)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	top.add_child(shade)
	var back = UI.ghost_link("", Game.back, "arrow-left")
	back.position = Vector2(UI.px(16), App.inset_top() + UI.px(12))
	back.custom_minimum_size = Vector2(UI.px(44), UI.px(44))
	top.add_child(back)
	var names = UI.vbox(2)
	names.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	names.grow_vertical = Control.GROW_DIRECTION_BEGIN
	names.offset_left = UI.px(20); names.offset_right = -UI.px(20); names.offset_bottom = -UI.px(12)
	var hc = DB.hero_class(cc.heroClass)
	names.add_child(UI.label(("%s · %s · %s · %s" % [hc.name, DB.spec_def(cc.heroClass, cc.spec).name, DB.ROLE_NAME[cc.role], cc.epithet]).to_upper(), 12, Color(hc.color), "medium"))
	names.add_child(UI.shadowed(UI.label(cc.name, 34, UI.TEXT, "title")))
	top.add_child(names)
	p.add_child(top)
	var body = UI.vbox(10)
	p.add_child(UI.margin(body, 20, 4, 20, 0))

	var maxl: int = DB.characters.MAX_LEVEL
	var per: int = DB.characters.XP_PER_LEVEL
	var at_max: bool = cc.level >= maxl
	var xp = UI.hbox(10)
	xp.add_child(UI.label("Уровень %d%s" % [cc.level, " (макс.)" if at_max else ""], 13, UI.TEXT_MUTED))
	var bar = UI.progress(100 if at_max else 100.0 * cc.xp / per, UI.ACCENT, 4)
	xp.add_child(UI.center(bar))
	bar.get_parent().size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.custom_minimum_size.x = UI.px(160)
	xp.add_child(UI.label("макс." if at_max else "%d/%d" % [cc.xp, per], 12, UI.TEXT_FAINT))
	body.add_child(xp)
	var stats = UI.hbox(8)
	for s in [["HP", cc.hp], ["Хил/с" if cc.role == "heal" else "Урон/с", cc.healPower if cc.role == "heal" else cc.dps], ["ГС", cc.gs]]:
		var fr = UI.frame("muted", Vector4(10, 10, 10, 10))
		fr.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var v = UI.vbox(2)
		v.add_child(UI.label(str(s[0]).to_upper(), 11, UI.TEXT_FAINT))
		v.add_child(UI.label(str(s[1]), 18, UI.TEXT, "medium"))
		fr.add_child(v)
		stats.add_child(fr)
	body.add_child(stats)
	body.add_child(UI.kicker("Характеристики", Color("#b8935c"), 12))
	var attrs: Dictionary = Game.attributes_for(cc)
	var grid = GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", UI.px(8))
	grid.add_theme_constant_override("v_separation", UI.px(8))
	for a in [["Сила", attrs.strength, "sword"], ["Ловкость", attrs.agility, "target"], ["Интеллект", attrs.intellect, "scroll"], ["Выносливость", attrs.stamina, "shield"], ["Инициатива", attrs.initiative, "path"]]:
		var fr = UI.frame("muted", Vector4(10, 8, 10, 8))
		fr.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var row = UI.hbox(8)
		row.add_child(UI.icon(a[2], 15, UI.ACCENT))
		var v = UI.vbox(0)
		v.add_child(UI.label(str(a[1]), 16, UI.TEXT, "medium"))
		v.add_child(UI.label(a[0], 10.5, UI.TEXT_FAINT))
		row.add_child(v)
		fr.add_child(row)
		grid.add_child(fr)
	body.add_child(grid)
	body.add_child(UI.space(6))
	body.add_child(ClassCard.make(cc.heroClass))
	var ab = DB.ability(cc.id)
	var abf = UI.frame("plain", Vector4(12, 12, 12, 12))
	var abr = UI.hbox(10)
	abr.add_child(UI.picture(DB.ability_art_path(cc.id), 44, 44, 8))
	var abv = UI.vbox(3)
	abv.add_child(UI.label(ab.name, 13.5, UI.ACCENT_SOFT, "medium"))
	abv.add_child(UI.label(ab.desc, 13, UI.TEXT_DIM, "regular", true))
	abr.add_child(UI.expand(abv))
	abf.add_child(abr)
	body.add_child(abf)
	var trf = UI.frame("plain", Vector4(12, 12, 12, 12))
	var trv = UI.vbox(3)
	trv.add_child(UI.label(DB.traits[cc.trait].label, 13.5, UI.ACCENT_SOFT, "medium"))
	trv.add_child(UI.label(DB.traits[cc.trait].desc, 13, UI.TEXT_DIM, "regular", true))
	trf.add_child(trv)
	body.add_child(trf)
	body.add_child(UI.label(cc.story, 14.5, UI.TEXT_MUTED, "regular", true))
	body.add_child(UI.space(10))

	if Game.is_unlocked("gear"):
		body.add_child(EquipmentPanel.make(cc, gear_state, refresh))
		var sets: Array = Game.set_bonuses_for(cc)
		if not sets.is_empty():
			body.add_child(UI.kicker("Комплект", Color("#b8935c"), 12))
			for s in sets:
				var a2: bool = s.count >= 2
				var fr = UI.frame("gold" if a2 else "plain", Vector4(12, 12, 12, 12))
				var v = UI.vbox(3)
				var h = UI.hbox(6)
				h.add_child(UI.expand(UI.label(s.set.name, 14.5, UI.TEXT, "medium")))
				h.add_child(UI.label("%d/3" % s.count, 12.5, UI.TEXT_FAINT))
				v.add_child(h)
				v.add_child(UI.label("2 предмета: " + s.set.bonus2.desc, 13, UI.ACCENT_SOFT if a2 else UI.TEXT_FAINT, "regular", true))
				v.add_child(UI.label("3 предмета: " + s.set.bonus3.desc, 13, UI.ACCENT_SOFT if s.count >= 3 else UI.TEXT_FAINT, "regular", true))
				fr.add_child(v)
				body.add_child(fr)

	if Game.is_unlocked("classes"):
		body.add_child(UI.kicker("Специализация", Color("#b8935c"), 12))
		body.add_child(UI.label("От неё зависят роль и заклинания. Сменить можно в любой момент между походами.", 12.5, UI.TEXT_FAINT, "regular", true))
		var specs = UI.cards(8, 3)
		for o in DB.specs_of(cc.heroClass):
			var sp: Dictionary = o
			specs.add_child(_option("%s · %s" % [sp.name, DB.ROLE_NAME[sp.role]], sp.desc, cc.spec == sp.id, false, func(): Game.set_spec(cc.id, sp.id), sp.icon))
		body.add_child(specs)
	if Game.is_unlocked("talents"):
		var free: int = Game.talent_points_total(cc) - Game.talent_points_spent(cc)
		var tf = UI.frame("gold" if free > 0 else "plain", Vector4(12, 12, 12, 12))
		var tr = UI.hbox(10)
		tr.add_child(UI.icon("tree", 20, UI.ACCENT))
		var tv = UI.vbox(2)
		tv.add_child(UI.label("Таланты", 15, UI.ACCENT_SOFT, "medium"))
		var split = DB.specs_of(cc.heroClass).map(func(sp): return "%s %d" % [sp.name, Game.tree_points(cc, sp.id)])
		tv.add_child(UI.label(" · ".join(split), 12.5, UI.TEXT_DIM, "regular", true))
		tr.add_child(UI.expand(tv))
		if free > 0: tr.add_child(UI.center(UI.label("+%d" % free, 16, UI.WARN, "semibold")))
		tr.add_child(UI.center(UI.icon("caret-right", 14, UI.ACCENT)))
		tf.add_child(tr)
		UI.tap(tf, func(): Game.go("talents"))
		body.add_child(tf)
	_spellbook(body, cc)
	if Game.is_unlocked("professions"):
		body.add_child(UI.kicker("Профессия", Color("#b8935c"), 12))
		body.add_child(UI.label("Выбор сделан навсегда — прокачивайте мастерство на отдельном экране." if cc.professionId != null else "Выберите ремесло один раз, навсегда — его можно будет прокачивать за золото.", 12.5, UI.TEXT_FAINT, "regular", true))
		for o in DB.professions.PROFESSIONS:
			var opt: Dictionary = o
			body.add_child(_option(opt.name, opt.desc, cc.professionId == opt.id, cc.professionId != null, func(): Game.choose_profession(cc.id, opt.id), opt.icon))
		if cc.professionId != null:
			var fr = UI.frame("plain", Vector4(12, 12, 12, 12))
			var row = UI.hbox(8)
			row.add_child(UI.icon("chart-line-up", 15, UI.ACCENT))
			row.add_child(UI.expand(UI.label("Прокачать профессию · %d/%d ур." % [cc.professionLevel, DB.professions.PROFESSION_MAX_LEVEL], 14, UI.ACCENT_SOFT, "medium")))
			row.add_child(UI.icon("caret-right", 14, UI.ACCENT))
			fr.add_child(row)
			UI.tap(fr, func(): Game.go("profession"))
			body.add_child(fr)

	var soon: Array = ["gear", "talents", "classes", "professions"].filter(func(f): return not Game.is_unlocked(f))
	if not soon.is_empty():
		var fr = UI.frame("muted", Vector4(12, 12, 12, 12))
		var v = UI.vbox(8)
		v.add_child(UI.kicker("Скоро", Color("#b8935c"), 12))
		for f in soon:
			var row = UI.hbox(8)
			row.add_child(UI.icon("lock-simple", 13, UI.BORDER_HOVER))
			row.add_child(UI.label("%s — %s" % [DB.features.FEATURES[f].title, DB.unlock_hint(f).replace("Откроется", "откроется")], 13, UI.TEXT_FAINT, "regular", true))
			v.add_child(row)
		fr.add_child(v)
		body.add_child(fr)

	body.add_child(UI.space(8))
	body.add_child(UI.kicker("Кадровые решения", Color("#b8935c"), 12))
	if not Game.can_fire():
		body.add_child(UI.label("В штате минимум допустимых сотрудников — увольнять больше некого.", 12.5, UI.TEXT_FAINT, "regular", true))
	elif not confirm_fire:
		var fb = PanelContainer.new()
		var sb = UI.frame_style("pill", Vector4(13, 13, 13, 13), 8)
		sb.border_color = UI.DANGER; sb.bg_color = Color(0, 0, 0, 0)
		fb.add_theme_stylebox_override("panel", sb)
		var row = UI.hbox(10, BoxContainer.ALIGNMENT_CENTER)
		row.add_child(UI.icon("trash-simple", 16, UI.DANGER))
		row.add_child(UI.label("Уволить " + cc.name, 15, UI.DANGER, "medium"))
		fb.add_child(row)
		UI.tap(fb, func():
			confirm_fire = true
			refresh())
		body.add_child(fb)
	else:
		var fr = UI.grim_sheet(Vector4(18, 18, 18, 16), UI.DANGER)
		var v = UI.vbox(10)
		v.add_child(UI.grim_head("warning", "Кадровое решение", "Уволить: " + cc.name, 34))
		v.add_child(UI.label("Это необратимо. %s покинет гильдию навсегда, а коллектив расстроится — небольшой удар по морали всех остальных." % cc.name, 13.5, UI.TEXT_MUTED, "regular", true))
		v.add_child(UI.grim_rule())
		var btns = UI.hbox(8)
		btns.add_child(UI.grim_action("Отмена", func():
			confirm_fire = false
			refresh()))
		btns.add_child(UI.grim_action("Точно уволить", func():
			confirm_fire = false
			Game.fire(cc.id)
			Game.go("roster"), true))
		v.add_child(btns)
		fr.add_child(v)
		body.add_child(fr)


func _option(name: String, desc: String, selected: bool, locked: bool, fn: Callable, icon := "") -> Control:
	var pn = PanelContainer.new()
	var sb = UI.frame_style("pill", Vector4(10, 10, 10, 10), 8)
	sb.border_color = UI.ACCENT if selected else UI.BORDER_STRONG
	sb.bg_color = Color(UI.ACCENT, 0.12) if selected else Color(0, 0, 0, 0)
	pn.add_theme_stylebox_override("panel", sb)
	if locked and not selected: pn.modulate.a = 0.4
	var row = UI.hbox(10)
	if icon != "": row.add_child(UI.icon(icon, 16, UI.ACCENT))
	var v = UI.vbox(2)
	v.add_child(UI.label(name, 14, UI.ACCENT_SOFT if selected else UI.TEXT, "medium"))
	v.add_child(UI.label(desc, 12.5, UI.TEXT_FAINT, "regular", true))
	row.add_child(UI.expand(v))
	pn.add_child(row)
	if not locked: UI.tap(pn, fn)
	return pn


## The class's spells: those the hero casts, and what the rest wait for.
func _spellbook(body: VBoxContainer, cc: Dictionary) -> void:
	var known: Array = Game.known_spells(cc).map(func(s): return s.id)
	var res: Dictionary = DB.resource_of(cc.heroClass)
	var head = UI.hbox(6)
	head.add_child(UI.expand(UI.kicker("Книга заклинаний", Color("#b8935c"), 12)))
	head.add_child(UI.label(res.name, 12, Color(res.color), "medium"))
	body.add_child(head)
	var list = UI.cards(8)
	for o in DB.spells_of(cc.heroClass):
		var sd: Dictionary = o
		var has: bool = sd.id in known
		var need = ""
		if not has:
			if sd.talent != null: need = "Талант в конце ветки «%s»" % DB.spec_def(cc.heroClass, sd.talent).name
			elif sd.spec != null and sd.spec != cc.spec: need = "Специализация «%s»" % DB.spec_def(cc.heroClass, sd.spec).name
			else: need = "С уровня %d" % sd.level
		var fr = UI.frame("plain" if has else "muted", Vector4(10, 10, 10, 10))
		var row = UI.hbox(10)
		var art := DB.spell_art_path(sd.id)
		if art != "": row.add_child(UI.center(UI.picture(art, 38, 38, 6, not has)))
		else:
			var ic = PanelContainer.new()
			var sb = StyleBoxFlat.new(); sb.bg_color = Color(0.07, 0.05, 0.035); sb.border_color = UI.ACCENT if has else UI.BORDER
			sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(6))
			ic.add_theme_stylebox_override("panel", sb)
			ic.custom_minimum_size = Vector2(UI.px(38), UI.px(38))
			ic.add_child(UI.center(UI.icon(sd.icon, 19, UI.ACCENT_SOFT if has else UI.TEXT_FAINT)))
			row.add_child(UI.center(ic))
		var v = UI.vbox(2)
		var top = UI.hbox(6)
		top.add_child(UI.expand(UI.label(sd.name, 14, UI.TEXT if has else UI.TEXT_FAINT, "medium")))
		var meta = []
		if int(sd.cost) > 0: meta.append("%d %s" % [sd.cost, res.name.to_lower()])
		if int(sd.cd) > 0: meta.append("КД %d" % sd.cd)
		if not meta.is_empty(): top.add_child(UI.label(" · ".join(meta), 11, Color(res.color) if has else UI.TEXT_FAINT))
		v.add_child(top)
		v.add_child(UI.label(sd.desc, 12, UI.TEXT_DIM if has else UI.TEXT_FAINT, "regular", true))
		if need != "": v.add_child(UI.label(need, 11, UI.WARN, "italic"))
		row.add_child(UI.expand(v))
		fr.add_child(row)
		list.add_child(fr)
	body.add_child(list)
