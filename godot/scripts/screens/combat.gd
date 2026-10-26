extends Screen
## The fight, laid out after Wartales: the 3D field fills the screen; across
## the top the foe and the turn order, along the bottom the hero acting, the
## skill bar and the pace. Taps on the field between them reach it.

const ACTION_ICON := {"attack": "sword", "heal": "first-aid-kit", "ability": "flame", "interrupt": "hand-palm", "breakChain": "shield-chevron",
	"breakIce": "snowflake", "brace": "shield", "rally": "megaphone", "defend": "shield", "breakShell": "snowflake", "valor": "crown-simple"}
const DANGER_TITLE := {"meteor": "Огненный дождь по колоннам %s", "cleave": "Сокрушающий взмах по клеткам вокруг врага",
	"devour": "Пасть раскрыта над отмеченной клеткой", "backstab": "Удар в спину по заднему ряду"}
const GOLD_LINE := Color(0.79, 0.64, 0.42, 0.45)
const GOLD_TEXT := Color("#e6cf9c")

var view: BattleView
var picking_heal = false
## The move waiting for an ally to aim at: "heal" or a spell ("spell:<id>").
var _pick_key = "heal"
## What keys 1–9 do this turn (the action tiles, or whom to heal).
var _hotkeys = []
## The skill bar's squares (points): smaller on a phone so a turn fits one row.
var SLOT = 58.0
var _cam: Control
var _top: Control
## Wide window: the foes listed down the right, under the top strip.
var _foes: Control
var _bottom: Control


func _enter_tree() -> void:
	view = BattleView.new()
	get_tree().root.add_child.call_deferred(view)


func _exit_tree() -> void:
	if is_instance_valid(view): view.queue_free()


func build() -> void:
	_hotkeys = []
	SLOT = 46.0
	var s = Game.b.sim
	if s == null: return
	var cur = Game.b.current_raider()
	if cur == null: picking_heal = false
	_top = _top_block(s)
	add_child(_top)
	if App.wide:
		_foes = _foe_list(s)
		if _foes: add_child(_foes)
	_bottom = _bottom_block(s, cur)
	add_child(_bottom)
	_cam = _camera_bar()
	add_child(_cam)
	if Game.b.boss_intro: add_child(_intro(Game.b.boss_intro))
	_measure.call_deferred()


# Wrapped labels start out tall at zero width; the bottom must shrink back
# once they know their width, or it swallows the battlefield.
func _process(_d: float) -> void:
	if is_instance_valid(_bottom) and is_instance_valid(_top): _measure()


## Tells the field which strip of screen it shows through.
func _measure() -> void:
	if not is_instance_valid(view) or not is_instance_valid(_top): return
	var h = _bottom.get_combined_minimum_size().y
	if _bottom.size.y > h + 0.5: _bottom.offset_top = _bottom.offset_bottom - h
	if is_instance_valid(_cam):
		# Up the right edge: mid-height on a wide window, over the bottom on a phone.
		var ch = _cam.get_combined_minimum_size().y
		var vp = get_viewport_rect().size
		var y = (vp.y - ch) * 0.5 if App.wide else _bottom.get_global_rect().position.y - ch
		_cam.position = Vector2(vp.x - _cam.size.x - UI.px(12), y)
	# The top root has no size of its own; let it span its plate, so the field and
	# the foe list know where it ends.
	_top.offset_bottom = _top.get_child(1).get_combined_minimum_size().y
	if is_instance_valid(_foes): _foes.position.y = _top.get_global_rect().end.y - UI.px(4)
	if App.wide:
		# The skill bar sits low and narrow; only the top plate needs the board nudged down.
		view.band_top = 0.0
		view.band_bottom = _top.get_global_rect().end.y * 0.7
		return
	view.band_top = _top.get_global_rect().end.y
	view.band_bottom = get_viewport_rect().size.y - _bottom.get_global_rect().position.y


# ── the top, Wartales-style: the foe's name and health, then who acts when ──
## The fight's own plates: blackened iron, a gilt hairline and small corner
## brackets, like the popups', but lighter so the field shows round them.
func _plate(child: Control, pad := Vector4(12, 10, 12, 10), alpha := 0.86) -> PanelContainer:
	var p = PanelContainer.new()
	var sb = UI.grim_style(pad)
	sb.bg_color = Color(UI.GRIM_FILL, alpha)
	sb.shadow_size = UI.px(6)
	p.add_theme_stylebox_override("panel", sb)
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	p.draw.connect(func():
		var r = Rect2(Vector2.ZERO, p.size)
		p.draw_rect(r.grow(-UI.px(4)), Color(UI.GRIM_GOLD, 0.35), false, 1.0)
		_corners(p, r.grow(-UI.px(2))))
	p.add_child(child)
	return p


static func _corners(c: CanvasItem, r: Rect2) -> void:
	var k = UI.px(10)
	for q in [[r.position, Vector2(1, 1)], [Vector2(r.end.x, r.position.y), Vector2(-1, 1)], [Vector2(r.position.x, r.end.y), Vector2(1, -1)], [r.end, Vector2(-1, -1)]]:
		var o: Vector2 = q[0]; var d: Vector2 = q[1]
		c.draw_polyline(PackedVector2Array([o + Vector2(0, d.y * k), o, o + Vector2(d.x * k, 0)]), UI.GRIM_GOLD, 2.0)


func _top_block(s: Dictionary) -> Control:
	var root = Control.new()
	root.set_anchors_preset(Control.PRESET_TOP_WIDE)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var shade = UI.fade(Color(0.03, 0.02, 0.015, 0.8), Color(0.03, 0.02, 0.015, 0.0), 10)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.custom_minimum_size = Vector2.ZERO
	root.add_child(shade)
	# One low strip across the whole screen: the sides' ribbons on the left,
	# the turn order in the middle, onslaught and tilt on the right. A phone
	# held upright is too narrow for that, so there the order drops below.
	var col = UI.vbox(4)
	var m = UI.margin(_plate(col, Vector4(12, 6, 12, 6) if App.wide else Vector4(10, 5, 10, 5), 0.8 if App.wide else 0.7), 8, 4 + App.inset_top() / UI.K, 8, 10)
	m.set_anchors_preset(Control.PRESET_TOP_WIDE)
	root.add_child(m)
	# Us against them, after Battlesmiths: the squad's health on a green
	# ribbon, the foe's on a red one, crossed swords between; the name above.
	var sides = UI.vbox(2)
	var name_row = UI.hbox(6, BoxContainer.ALIGNMENT_CENTER)
	if s.encounterType == "boss" and not Game.in_arena:
		var art = DB.boss_art_path(Game.dungeon_id)
		if art != "": name_row.add_child(UI.picture(art, 18, 18, 9))
	var title = UI.shadowed(UI.label((s.name + (" · фаза %d" % s.phase if s.encounterType == "boss" else "")).to_upper(), 11.5, UI.GRIM_TITLE, "title"))
	name_row.add_child(title)
	sides.add_child(name_row)
	var ours = 0.0; var ours_max = 0.0
	for r in s.raiders:
		ours += maxf(0, r.hp); ours_max += r.maxHp
	var vs = UI.hbox(0, BoxContainer.ALIGNMENT_CENTER)
	vs.add_child(UI.expand(_ribbon(ours, ours_max, Color("#6aa22a"), Color("#3d5f17"), false)))
	vs.add_child(_crossed_swords())
	vs.add_child(UI.expand(_ribbon(maxf(0, s.boss.hp), s.boss.maxHp, Color("#c0302f"), Color("#6d1416"), true)))
	sides.add_child(vs)
	var meters = UI.vbox(4)
	meters.alignment = BoxContainer.ALIGNMENT_CENTER
	meters.custom_minimum_size.x = UI.px(130 if App.wide else 110)
	var stunned: bool = s.stunned or s.vulnerableRounds > 0
	meters.add_child(_meter("Оглушён" if stunned else "Натиск", 100.0 if stunned else s.stagger, UI.WARN if stunned else UI.ACCENT, ""))
	var tilt_col = UI.DANGER if s.tilt >= 70 else (UI.WARN if s.tilt >= 40 else UI.GOOD)
	meters.add_child(_meter("Тилт", s.tilt, tilt_col, "%d%%" % round(s.tilt)))
	var line = UI.hbox(14 if App.wide else 10)
	if App.wide:
		sides.custom_minimum_size.x = UI.px(300)
		sides.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		sides.size_flags_stretch_ratio = 0.8
		line.add_child(sides)
		line.add_child(_rule())
		var order = _timeline(s)
		order.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		line.add_child(order)
		line.add_child(_rule())
		line.add_child(meters)
		col.add_child(line)
	else:
		line.add_child(UI.expand(sides))
		line.add_child(meters)
		col.add_child(line)
		col.add_child(_timeline(s))
	var banners = _banners(s)
	if not banners.is_empty():
		# Side by side under the strip rather than stacked down the field.
		var flow = HFlowContainer.new()
		flow.alignment = FlowContainer.ALIGNMENT_CENTER
		flow.add_theme_constant_override("h_separation", UI.px(6))
		flow.add_theme_constant_override("v_separation", UI.px(4))
		for b in banners:
			if App.wide: b.custom_minimum_size.x = UI.px(360)
			flow.add_child(b if App.wide else UI.expand(b))
		col.add_child(flow)
	if not App.wide:
		# The foes as chips just under the plate, over the field.
		var foes = _foe_chips(s)
		if foes:
			var outer = UI.vbox(4)
			var plate = m.get_child(0)
			m.remove_child(plate)
			outer.add_child(plate)
			outer.add_child(foes)
			m.add_child(outer)
	return root


## A thin gilt divider between the strip's parts.
func _rule() -> Control:
	var sep = ColorRect.new(); sep.color = GOLD_LINE; sep.custom_minimum_size = Vector2(1, UI.px(34))
	sep.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return UI.center(sep)


## One side's ribbon: a swallow-tailed banner filled as far as that side's
## health goes, the number on it in white; `right` mirrors it.
func _ribbon(hp: float, max_hp: float, fill: Color, rim: Color, right: bool) -> Control:
	var h = 26.0 if App.wide else 24.0
	var c = Control.new()
	c.custom_minimum_size = Vector2(UI.px(120), UI.px(h))
	c.mouse_filter = Control.MOUSE_FILTER_PASS
	c.tooltip_text = ("Враги" if right else "Отряд") + ": %d из %d" % [int(hp), int(max_hp)]
	var share = clampf(hp / maxf(1.0, max_hp), 0.0, 1.0)
	c.draw.connect(func():
		var w = c.size.x; var hh = c.size.y; var cut = hh * 0.45
		var shape = func(x0: float, x1: float) -> PackedVector2Array:
			# Swallow tail on the outer end, square on the inner one.
			var pts = PackedVector2Array([Vector2(x0, 0), Vector2(x1, 0), Vector2(x1, hh), Vector2(x0, hh), Vector2(x0 + cut, hh * 0.5)])
			if right:
				for i in pts.size(): pts[i] = Vector2(w - pts[i].x, pts[i].y)
			return pts
		c.draw_colored_polygon(shape.call(0.0, w), Color(rim, 0.95))
		var inner = shape.call(UI.px(2), w - UI.px(2))
		for i in inner.size(): inner[i].y = clampf(inner[i].y, UI.px(2), hh - UI.px(2))
		c.draw_colored_polygon(inner, Color(0.08, 0.06, 0.05, 0.92))
		# The fill runs from the inner end outwards.
		var fw = (w - UI.px(4) - cut) * share
		var x1 = w - UI.px(2); var x0 = x1 - fw
		var fp = PackedVector2Array([Vector2(x0, UI.px(3)), Vector2(x1, UI.px(3)), Vector2(x1, hh - UI.px(3)), Vector2(x0, hh - UI.px(3))])
		if right:
			for i in fp.size(): fp[i] = Vector2(w - fp[i].x, fp[i].y)
		c.draw_colored_polygon(fp, fill)
		c.draw_rect(Rect2(Vector2(minf(fp[0].x, fp[1].x), UI.px(3)), Vector2(fw, (hh - UI.px(6)) * 0.4)), Color(1, 1, 1, 0.12)))
	var row = UI.hbox(5, BoxContainer.ALIGNMENT_END if not right else BoxContainer.ALIGNMENT_BEGIN)
	row.set_anchors_preset(Control.PRESET_FULL_RECT)
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var icon = UI.icon("users-three" if not right else "skull", 13, Color.WHITE)
	var num = UI.shadowed(UI.label(str(int(hp)), 14 if App.wide else 12.5, Color.WHITE, "title"))
	if right:
		row.add_child(UI.space(10, 0)); row.add_child(UI.center(icon)); row.add_child(UI.center(num))
	else:
		row.add_child(UI.center(num)); row.add_child(UI.center(icon)); row.add_child(UI.space(10, 0))
	c.add_child(row)
	return c


## The diamond between the ribbons, with crossed swords on it.
func _crossed_swords() -> Control:
	var d = 34.0 if App.wide else 30.0
	var c = Control.new()
	c.custom_minimum_size = Vector2(UI.px(d), UI.px(d))
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func():
		var m = c.size * 0.5; var k = c.size.x * 0.5
		var pts = PackedVector2Array([m + Vector2(0, -k), m + Vector2(k, 0), m + Vector2(0, k), m + Vector2(-k, 0)])
		c.draw_colored_polygon(pts, Color("#3a2e26"))
		pts.append(pts[0])
		c.draw_polyline(pts, Color("#c9a35a"), 2.0)
		var inner = PackedVector2Array()
		for p in pts: inner.append(m + (p - m) * 0.78)
		c.draw_polyline(inner, Color("#c9a35a", 0.4), 1.0))
	var sw = UI.center(UI.icon("sword", d * 0.42, Color("#e7c06a")))
	sw.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.add_child(sw)
	return c


## Who acts, in order: faces with their health under them; the one acting now
## is larger and framed; the round and the enrage clock close the line.
func _timeline(s: Dictionary) -> Control:
	var row = UI.hbox(6, BoxContainer.ALIGNMENT_CENTER)
	var big = 36.0
	var small = 28.0
	for i in s.order.size():
		var entry: Dictionary = s.order[i]
		var active: bool = i == s.turnPos
		var size = big if active else small
		var cell = UI.vbox(3)
		cell.alignment = BoxContainer.ALIGNMENT_END
		if active: cell.add_child(_turn_marker(UI.DANGER if entry.kind == "boss" else UI.GOLD))
		if entry.kind == "boss":
			var disc = PanelContainer.new()
			var dsb = StyleBoxFlat.new(); dsb.set_corner_radius_all(UI.px(6))
			dsb.bg_color = Color(0.35, 0.08, 0.06, 0.85) if active else Color(0.1, 0.06, 0.05, 0.8)
			dsb.border_color = UI.DANGER if active else Color(UI.DANGER, 0.5); dsb.set_border_width_all(3 if active else 2)
			disc.add_theme_stylebox_override("panel", dsb)
			disc.custom_minimum_size = Vector2(UI.px(size), UI.px(size))
			disc.add_child(UI.center(UI.icon("skull", size * 0.5, UI.DANGER if active else Color(UI.DANGER, 0.8))))
			disc.tooltip_text = "Ход противника"
			cell.add_child(UI.center(disc))
			var pct: float = maxf(0, 100.0 * s.boss.hp / s.boss.maxHp)
			var hb = UI.progress(pct, UI.DANGER, 3)
			hb.custom_minimum_size.x = UI.px(size)
			cell.add_child(hb)
		else:
			var r = Game.b._raider(entry.id)
			if r == null: continue
			var pic = UI.portrait(r.candidateId, size, 6, not r.alive)
			if not r.alive or (not active and i < s.turnPos): pic.modulate.a = 0.45
			var col: Color = DB.ROLE_COLOR[r.role]
			var on = active
			UI.overlay(pic, func(o):
				var rr = Rect2(Vector2.ONE, o.size - Vector2(2, 2))
				o.draw_rect(rr, UI.GOLD if on else Color(col, 0.7), false, 3.0 if on else 1.5))
			pic.tooltip_text = "%s — %d/%d HP" % [r.name, maxi(0, int(r.hp)), r.maxHp]
			cell.add_child(UI.center(pic))
			var pct: float = maxf(0, 100.0 * r.hp / r.maxHp)
			var hb = UI.progress(pct, _hp_color(pct), 3)
			hb.custom_minimum_size.x = UI.px(size)
			cell.add_child(hb)
		row.add_child(cell)
	var sep = ColorRect.new(); sep.color = GOLD_LINE; sep.custom_minimum_size = Vector2(1, UI.px(30))
	row.add_child(UI.space(0, 4))
	row.add_child(UI.center(sep))
	var enraged: bool = s.round >= s.enrageAt
	var clock = UI.vbox(0)
	if enraged:
		clock.add_child(UI.label("Ярость", 11, UI.DANGER, "semibold"))
		clock.add_child(UI.label("×%.2f" % Game.b.enrage_mult(), 15, UI.DANGER, "title"))
	else:
		clock.add_child(UI.label("Раунд", 10, UI.TEXT_FAINT, "medium"))
		clock.add_child(UI.label(str(s.round), 17, UI.GRIM_TITLE, "title"))
		var left = UI.label("ярость через %d" % (s.enrageAt - s.round), 9.5, UI.TEXT_DIM)
		clock.add_child(left)
	for l in clock.get_children(): l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	clock.tooltip_text = "С %d-го раунда противник впадает в ярость и бьёт сильнее." % s.enrageAt
	clock.mouse_filter = Control.MOUSE_FILTER_PASS
	row.add_child(UI.center(clock))
	return row


## A small triangle over the face whose turn it is.
func _turn_marker(color: Color) -> Control:
	var c = Control.new()
	c.custom_minimum_size = Vector2(UI.px(12), UI.px(7))
	c.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func():
		var w = c.size.x; var h = c.size.y
		c.draw_colored_polygon(PackedVector2Array([Vector2(0, 0), Vector2(w, 0), Vector2(w * 0.5, h)]), color))
	return c


func _meter(label: String, pct: float, color: Color, value: String) -> Control:
	var v = UI.vbox(4)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var h = UI.hbox(4)
	h.add_child(UI.expand(UI.label(label.to_upper(), 10.5, UI.TEXT_MUTED, "medium")))
	if value != "": h.add_child(UI.label(value, 10.5, UI.TEXT_MUTED, "semibold"))
	v.add_child(h)
	v.add_child(UI.progress(pct, color, 5))
	return v


func _banner(tone: String, title: String, text: String) -> Control:
	var c: Color = {"danger": UI.DANGER, "warn": UI.WARN, "accent": UI.ACCENT}[tone]
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.063, 0.047, 0.035, 0.9)
	sb.border_color = c; sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(8))
	sb.content_margin_left = UI.px(10); sb.content_margin_right = UI.px(10); sb.content_margin_top = UI.px(8); sb.content_margin_bottom = UI.px(8)
	pn.add_theme_stylebox_override("panel", sb)
	pn.mouse_filter = Control.MOUSE_FILTER_STOP
	var v = UI.vbox(2)
	v.add_child(UI.label(title, 13, Color("#f0c3bc") if tone == "danger" else c, "medium", true))
	v.add_child(UI.label(text, 12, UI.TEXT_DIM, "regular", true))
	pn.add_child(v)
	return pn


func _banners(s: Dictionary) -> Array:
	var out = []
	if s.pendingCast: out.append(_banner("danger", "Луч смерти нацелен на %s" % s.pendingCast.targetName, "Прервите его на своём ходу, иначе он ударит на следующем ходу босса."))
	if s.danger:
		var t: String = DANGER_TITLE[s.danger.kind]
		if s.danger.kind == "meteor": t = t % " и ".join(s.danger.cols.map(func(c): return str(c + 1)))
		out.append(_banner("danger", t, "Ударит на следующем ходу противника по всем, кто останется на красных клетках."))
	if s.iceShell: out.append(_banner("accent", "Ледяной панцирь", "Урон по боссу −75%. Любой боец может потратить ход и расколоть его."))
	if s.debt: out.append(_banner("warn", "Долговая расписка: " + s.debt.targetName + (" — погашено" if s.debt.paid else ""), "Взыскания не будет." if s.debt.paid else "Этот боец должен ударить босса своим ходом, иначе получит «взыскание»."))
	if s.execution: out.append(_banner("danger", "Приказ о расстреле: " + s.execution.targetName, "Подлечите приговорённого выше 60% HP или пусть уйдёт в оборону — иначе залп на следующем ходу босса."))
	if s.quota: out.append(_banner("accent" if s.quota.dealt >= s.quota.need else "warn", "Квартальный план: %d / %d урона" % [mini(s.quota.dealt, s.quota.need), s.quota.need], "Выполните до хода босса — он растеряется. Провал — штраф всему отряду."))
	if s.chain: out.append(_banner("accent", "Цепь: %s ↔ %s" % [Game.b._raider(s.chain.aId).name, Game.b._raider(s.chain.bId).name], "Бьёт обоих каждый ход. Один из них может её разорвать."))
	if s.braceCall: out.append(_banner("warn", "«Кровавый прилив» нарастает", "Приготовились: %d/3 нужно, чтобы смягчить удар на следующем ходу босса." % s.braceCall.braced.size()))
	return out


# ── the bottom, Wartales-style: the hero acting, the skill bar, the pace ───
func _bottom_block(s: Dictionary, cur) -> Control:
	var pn = PanelContainer.new()
	pn.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	pn.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	pn.grow_vertical = Control.GROW_DIRECTION_BEGIN
	pn.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var shade = UI.fade(Color(0.03, 0.02, 0.015, 0.0), Color(0.03, 0.02, 0.015, 0.9), 10)
	shade.custom_minimum_size = Vector2.ZERO
	pn.add_child(shade)
	var v = UI.vbox(8)
	pn.add_child(UI.margin(v, 14, 34, 14, 12 + App.inset_bottom() / UI.K))
	var auto: bool = Game.settings.auto
	var hint = _hint(s, cur)
	var tip = _tip(s, cur)
	if App.wide:
		# Left: the log over the hero's card. Middle: what to do and the bar. Right: the pace.
		var row = UI.hbox(18)
		row.alignment = BoxContainer.ALIGNMENT_END
		var left = UI.vbox(8)
		left.custom_minimum_size.x = UI.px(300)
		left.alignment = BoxContainer.ALIGNMENT_END
		left.add_child(_plate(_log(s, 4), Vector4(10, 7, 10, 7), 0.62))
		if cur: left.add_child(_hero_card(s, cur))
		row.add_child(left)
		var mid = UI.vbox(8)
		mid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		mid.alignment = BoxContainer.ALIGNMENT_END
		if tip: mid.add_child(UI.center(_cap(tip, 560)))
		var bar = UI.vbox(6)
		if hint: bar.add_child(hint)
		bar.add_child(_center_bar(s, cur, auto))
		# As wide as the skills in one row, or as the middle allows; the flow wraps the rest.
		var n = maxi(Game.b.turn_actions().size(), 4) if cur and not s.movePhase and not auto else 4
		var room = get_viewport_rect().size.x / UI.K - 300 - 110 - 36 - 28 - 28
		bar.custom_minimum_size.x = UI.px(minf(n * (SLOT + 12 + 6), room))
		mid.add_child(UI.center(_plate(bar, Vector4(10, 6, 10, 4))))
		row.add_child(mid)
		var right = UI.vbox(8)
		right.alignment = BoxContainer.ALIGNMENT_END
		right.custom_minimum_size.x = UI.px(110)
		right.add_child(_pace_buttons())
		row.add_child(right)
		v.add_child(row)
	else:
		v.add_child(_plate(_log(s, 2), Vector4(10, 6, 10, 6), 0.62))
		if tip: v.add_child(tip)
		if hint: v.add_child(hint)
		var row = UI.hbox(10)
		if cur: row.add_child(UI.expand(_hero_card(s, cur)))
		else: row.add_child(UI.flex())
		row.add_child(_pace_buttons())
		v.add_child(row)
		v.add_child(_center_bar(s, cur, auto))
	return pn


## Keeps a wide child from stretching the whole middle.
func _cap(c: Control, w: float) -> Control:
	c.custom_minimum_size.x = UI.px(w)
	return c


func _log(s: Dictionary, n: int) -> Control:
	var v = UI.vbox(2)
	var lines: Array = s.log.slice(maxi(0, s.log.size() - n))
	for i in lines.size():
		var e: Dictionary = lines[i]
		var c = UI.GOOD if e.kind == "ok" else (UI.WARN if e.kind == "warn" else UI.TEXT_MUTED)
		var l = UI.shadowed(UI.label(e.text, 12, c, "regular", true))
		l.modulate.a = 0.55 + 0.45 * float(i + 1) / lines.size()
		v.add_child(l)
	return v


## What the player is being asked, under the bar's heading.
func _hint(s: Dictionary, cur) -> Control:
	if s.over or cur == null or Game.settings.auto: return null
	var t = ""
	if s.movePhase: t = "выберите клетку или пропустите" if not Game.b.reachable_cells().is_empty() else "нет свободных клеток рядом"
	elif picking_heal: t = "выберите, кого лечить" if _pick_key == "heal" else "выберите союзника"
	elif s.encounterType == "boss": t = "цель: скелет или босс" if s.minions.any(func(m): return m.alive) else "ближний бой вплотную к врагу"
	else: t = "нажмите на врага, чтобы выбрать цель"
	if not s.movePhase and not picking_heal and _out_of_reach(): t += " · часть ударов только вплотную"
	var l = UI.shadowed(UI.label("%s · %s" % [cur.name, t], 13, UI.ACCENT_SOFT, "medium", true))
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l


## The hero whose turn it is: face, name and class, health, valor.
func _hero_card(s: Dictionary, r: Dictionary) -> Control:
	var row = UI.hbox(10)
	var pn = _plate(row, Vector4(10, 9, 10, 9), 0.9)
	var size = 62.0 if App.wide else 46.0
	var pic = UI.portrait(r.candidateId, size, 6)
	var rc: Color = DB.ROLE_COLOR[r.role]
	UI.overlay(pic, func(o): o.draw_rect(Rect2(Vector2.ONE, o.size - Vector2(2, 2)), rc, false, 2.0))
	row.add_child(UI.center(pic))
	var v = UI.vbox(3)
	var hc = DB.hero_class(r.heroClass)
	var top = UI.hbox(6)
	top.add_child(UI.label(r.name, 16 if App.wide else 14.5, UI.GRIM_TITLE, "title"))
	if r.defending: top.add_child(UI.center(UI.icon("shield", 13, UI.ACCENT_SOFT, "fill")))
	v.add_child(top)
	v.add_child(UI.label("%s · %s" % [hc.name, DB.ROLE_NAME[r.role]], 11, Color(hc.color), "medium"))
	var pct: float = maxf(0, 100.0 * r.hp / r.maxHp)
	var hp = UI.hbox(6)
	hp.add_child(UI.progress(pct, _hp_color(pct), 7))
	hp.add_child(UI.label("%d/%d" % [maxi(0, int(r.hp)), r.maxHp], 11, UI.TEXT_DIM))
	v.add_child(hp)
	var res: Dictionary = r.res
	var rd: Dictionary = DB.specs.RESOURCES[res.kind]
	var rr = UI.hbox(6)
	rr.add_child(UI.progress(100.0 * res.val / res.max, Color(rd.color), 5))
	rr.add_child(UI.label("%d %s" % [int(res.val), rd.name.to_lower()], 10.5, Color(rd.color)))
	rr.tooltip_text = "%s: %d из %d. %s" % [rd.name, int(res.val), int(res.max), ("+%d в начале хода." % int(res.regen)) if res.regen > 0 else "Копится от ударов и полученного урона."]
	rr.mouse_filter = Control.MOUSE_FILTER_PASS
	v.add_child(rr)
	var foot = UI.hbox(8)
	var pips = UI.hbox(5)
	for i in Battle.VALOR_MAX: pips.add_child(UI.valor_pip(i < s.valor, 8))
	pips.tooltip_text = "Доблесть: %d из %d. Копится в бою, тратится на приёмы класса." % [s.valor, Battle.VALOR_MAX]
	pips.mouse_filter = Control.MOUSE_FILTER_PASS
	foot.add_child(UI.center(pips))
	for st in _statuses(s, r): foot.add_child(st)
	v.add_child(foot)
	row.add_child(UI.expand(v))
	return pn


## What is on the hero now: own buffs, the party's, healing over time, a shield.
func _statuses(s: Dictionary, r: Dictionary) -> Array:
	var out = []
	var n_own: int = r.buffs.size()
	var all: Array = r.buffs + s.partyBuffs
	for i in all.size():
		var b: Dictionary = all[i]
		var party: bool = i >= n_own
		var what = []
		if b.has("dmg"): what.append("урон %+d%%" % roundi((float(b.dmg) - 1.0) * 100))
		if b.has("crit"): what.append("крит +%d%%" % roundi(float(b.crit) * 100))
		if b.has("taken"): what.append("получаемый урон %+d%%" % roundi((float(b.taken) - 1.0) * 100))
		var icon = "sword" if b.has("dmg") else ("target" if b.has("crit") else ("shield" if b.has("taken") else "sparkle"))
		var tip = "%s%s: %s. Осталось ходов: %d." % [b.get("name", "Усиление"), " (на отряд)" if party else "", ", ".join(what), int(b.rounds)]
		out.append(_status_badge(icon, str(int(b.rounds)), UI.ACCENT_SOFT if party else UI.GOOD, tip))
	if not r.hots.is_empty():
		var left = 0
		var amt = 0.0
		for h in r.hots:
			left = maxi(left, int(h.rounds))
			amt += float(h.amt)
		out.append(_status_badge("heart", str(left), UI.GOOD, "Лечение со временем: +%d в начале хода, ещё %d." % [int(amt), left]))
	if r.absorb > 0:
		out.append(_status_badge("shield-check", str(int(r.absorb)), UI.ACCENT, "Щит поглотит %d урона." % int(r.absorb)))
	return out


func _status_badge(icon: String, text: String, color: Color, tip: String) -> Control:
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(color, 0.14); sb.border_color = Color(color, 0.55)
	sb.set_border_width_all(1); sb.set_corner_radius_all(UI.px(5))
	sb.content_margin_left = UI.px(4); sb.content_margin_right = UI.px(5); sb.content_margin_top = UI.px(1); sb.content_margin_bottom = UI.px(1)
	pn.add_theme_stylebox_override("panel", sb)
	var h = UI.hbox(3)
	h.add_child(UI.center(UI.icon(icon, 11, color, "fill")))
	h.add_child(UI.label(text, 10.5, color, "semibold"))
	pn.add_child(h)
	pn.tooltip_text = tip
	pn.mouse_filter = Control.MOUSE_FILTER_PASS
	return pn


## Speed and auto-battle, as two round buttons.
func _pace_buttons() -> Control:
	var v = UI.hbox(8, BoxContainer.ALIGNMENT_END) if not App.wide else UI.vbox(8)
	var fast: bool = Game.settings.speed >= 2
	v.add_child(UI.chip("×2" if fast else "×1", fast, Game.toggle_speed, "fast-forward"))
	v.add_child(UI.chip("Авто", Game.settings.auto, func():
		picking_heal = false
		Game.toggle_auto(), "robot"))
	for c in v.get_children(): c.tooltip_text = "Скорость (X)" if c == v.get_child(0) else "Автобой (A)"
	return v


## The middle of the bottom: the skill bar on the hero's turn, else what's going on.
func _center_bar(s: Dictionary, cur, auto: bool) -> Control:
	if s.over: return UI.space(4)
	if cur == null:
		var l = UI.shadowed(UI.label("Противник замахивается для мощного удара!" if s.windup else ("Ход противника…" if s.turnPos >= 0 and s.turnPos < s.order.size() and s.order[s.turnPos].kind == "boss" else "…"), 15, UI.TEXT_DIM, "italic"))
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.custom_minimum_size.y = UI.px(SLOT + 18)
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		return l
	if auto:
		var row = UI.hbox(12, BoxContainer.ALIGNMENT_CENTER)
		row.custom_minimum_size.y = UI.px(SLOT + 18)
		row.add_child(UI.center(UI.shadowed(UI.label("Автобой · ход: " + cur.name, 14, UI.TEXT_MUTED))))
		row.add_child(UI.center(_cap(UI.secondary_button("Взять управление", Game.toggle_auto, 40), 200)))
		return row
	if s.movePhase:
		var c = UI.center(_cap(UI.secondary_button("Пропустить перемещение" + (" · Пробел" if UI.HOVER else ""), Game.b.skip_move), 320))
		c.custom_minimum_size.y = UI.px(SLOT + 18)
		return c
	var bar = HFlowContainer.new()
	bar.alignment = FlowContainer.ALIGNMENT_CENTER
	bar.add_theme_constant_override("h_separation", UI.px(4 if not App.wide else 6))
	bar.add_theme_constant_override("v_separation", UI.px(8))
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if picking_heal:
		var key: String = _pick_key
		for t in Game.b.heal_targets(key != "heal"):
			var tid: int = t.id
			var r = Game.b._raider(tid)
			var heal = func():
				picking_heal = false
				Game.b.raider_action(key, tid)
			var pic = UI.portrait(r.candidateId, SLOT * 0.7, 6)
			bar.add_child(_slot(pic, "%s · %d%%" % [t.name, t.hpPct], "%s: %s (%d%% HP)" % ["Лечить" if key == "heal" else "Цель", t.name, t.hpPct], heal, false, UI.GOOD, t.hpPct))
		bar.add_child(_slot(UI.icon("x", SLOT * 0.36, UI.TEXT_DIM), "Отмена", "Отмена (Esc)", func():
			picking_heal = false
			refresh(), false, UI.BORDER_STRONG, -1, false))
		return bar
	if not App.wide:
		# A phone keeps the bar to one row that scrolls sideways, to leave the field in view.
		var row = UI.hbox(4)
		for a in Game.b.turn_actions(): row.add_child(_action_slot(a))
		var sc = ScrollContainer.new()
		sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
		sc.custom_minimum_size.y = UI.px(SLOT + 52)
		sc.add_child(row)
		# More to the right: the row fades out under a gilt chevron until it's scrolled to the end.
		var hold = Control.new()
		hold.custom_minimum_size.y = sc.custom_minimum_size.y
		hold.mouse_filter = Control.MOUSE_FILTER_IGNORE
		sc.set_anchors_preset(Control.PRESET_FULL_RECT)
		hold.add_child(sc)
		var more = Control.new()
		more.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
		more.offset_left = -UI.px(34)
		more.mouse_filter = Control.MOUSE_FILTER_IGNORE
		more.draw.connect(func():
			var w = more.size.x; var h = more.size.y
			more.draw_polygon(PackedVector2Array([Vector2(0, 0), Vector2(w, 0), Vector2(w, h), Vector2(0, h)]),
				PackedColorArray([Color(0.03, 0.02, 0.015, 0), Color(0.03, 0.02, 0.015, 0.95), Color(0.03, 0.02, 0.015, 0.95), Color(0.03, 0.02, 0.015, 0)]))
			var c = Vector2(w - UI.px(10), UI.px(SLOT * 0.5))
			more.draw_polyline(PackedVector2Array([c + Vector2(-UI.px(5), -UI.px(8)), c, c + Vector2(-UI.px(5), UI.px(8))]), UI.GOLD, 2.5))
		hold.add_child(more)
		var sync = func():
			var hs = sc.get_h_scroll_bar()
			more.visible = hs.max_value - hs.page > 1.0 and sc.scroll_horizontal < hs.max_value - hs.page - 2.0
		sc.get_h_scroll_bar().changed.connect(sync)
		sc.get_h_scroll_bar().value_changed.connect(func(_v): sync.call())
		return hold
	for a in Game.b.turn_actions(): bar.add_child(_action_slot(a))
	return bar


## One square of the bar: a picture, the key that presses it, a name under it.
func _slot(content: Control, name: String, tip: String, fn: Callable, disabled: bool, border: Color, hp_pct := -1.0, counts := true, note := "", corner := "", corner_col := Color.WHITE) -> Control:
	var v = UI.vbox(3)
	var lw = SLOT + (12 if App.wide else 22)
	v.custom_minimum_size.x = UI.px(lw)
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.036, 0.028, 0.96) if disabled else Color(0.11, 0.08, 0.055, 0.97)
	sb.border_color = Color(border, 0.3) if disabled else border
	sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(6))
	sb.shadow_color = Color(0, 0, 0, 0.5); sb.shadow_size = UI.px(3)
	pn.add_theme_stylebox_override("panel", sb)
	if not disabled:
		# Lit from above, like a plate catching torchlight.
		pn.draw.connect(func():
			var w = pn.size.x
			pn.draw_polygon(PackedVector2Array([Vector2(3, 3), Vector2(w - 3, 3), Vector2(w - 3, pn.size.y * 0.45), Vector2(3, pn.size.y * 0.45)]),
				PackedColorArray([Color(1, 0.85, 0.6, 0.09), Color(1, 0.85, 0.6, 0.09), Color(1, 0.85, 0.6, 0), Color(1, 0.85, 0.6, 0)])))
	pn.custom_minimum_size = Vector2(UI.px(SLOT), UI.px(SLOT))
	pn.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	pn.add_child(UI.center(content))
	if hp_pct >= 0:
		var hb = UI.progress(hp_pct, _hp_color(hp_pct), 4)
		hb.size_flags_vertical = Control.SIZE_SHRINK_END
		pn.add_child(UI.margin(hb, 5, 0, 5, 4))
	pn.tooltip_text = tip
	if disabled: content.modulate = Color(0.55, 0.52, 0.48, 0.6)
	var cb = Callable() if disabled else fn
	if counts: _hotkeys.append(cb)
	if counts and UI.HOVER and _hotkeys.size() <= 9:
		var k = UI.label(str(_hotkeys.size()), 9.5, UI.TEXT_FAINT if disabled else UI.GOLD, "semibold")
		k.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		k.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		var badge = PanelContainer.new()
		var bsb = StyleBoxFlat.new()
		bsb.bg_color = Color(0.03, 0.02, 0.015, 0.95); bsb.border_color = Color(UI.GRIM_GOLD, 0.3 if disabled else 0.8)
		bsb.set_border_width_all(1); bsb.set_corner_radius_all(UI.px(8))
		badge.add_theme_stylebox_override("panel", bsb)
		badge.custom_minimum_size = Vector2(UI.px(15), UI.px(15))
		badge.add_child(k)
		badge.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		badge.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
		pn.add_child(UI.margin(badge, -5, -5, 0, 0))
	# The price, bottom right, in the colour of what it costs.
	if corner != "":
		var cp = PanelContainer.new()
		var csb = StyleBoxFlat.new()
		csb.bg_color = Color(0.03, 0.02, 0.015, 0.9); csb.border_color = Color(corner_col, 0.7)
		csb.set_border_width_all(1); csb.set_corner_radius_all(UI.px(4))
		csb.content_margin_left = UI.px(3); csb.content_margin_right = UI.px(3)
		cp.add_theme_stylebox_override("panel", csb)
		cp.add_child(UI.label(corner, 9.5, corner_col, "semibold"))
		cp.size_flags_horizontal = Control.SIZE_SHRINK_END
		cp.size_flags_vertical = Control.SIZE_SHRINK_END
		cp.mouse_filter = Control.MOUSE_FILTER_IGNORE
		pn.add_child(UI.margin(cp, 0, 0, 2, 2))
	v.add_child(pn)
	var l = UI.shadowed(UI.label(name, 10 if App.wide else 10.5, UI.TEXT_FAINT if disabled else UI.TEXT_MUTED, "medium", true))
	l.autowrap_mode = TextServer.AUTOWRAP_WORD
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.custom_minimum_size.x = UI.px(lw)
	v.add_child(l)
	# Why it can't be pressed, so a phone without tooltips still knows.
	if note != "":
		var nl = UI.shadowed(UI.label(note, 9, Color(UI.DANGER, 0.9), "medium", true))
		nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		nl.custom_minimum_size.x = UI.px(lw)
		v.add_child(nl)
	if not disabled: UI.tap(pn, fn)
	return v


func _action_slot(a: Dictionary) -> Control:
	var valor: bool = a.get("valorCost") != null
	var holder = Control.new()
	holder.custom_minimum_size = Vector2(UI.px(SLOT * 0.62), UI.px(SLOT * 0.62))
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var art: String = a.get("abilityArt", "") if a.get("abilityArt") != null else a.get("spellArt", "")
	var pic: Control
	if art != "": pic = UI.picture(art, SLOT * 0.62, SLOT * 0.62, 5)
	else:
		var icon: String = a.get("spellIcon") if a.get("spellIcon") != null else (a.get("classIcon") if a.get("classIcon") != null else (a.abilityIcon if a.key == "ability" and a.get("abilityIcon") != null else ACTION_ICON.get(a.key, "sword")))
		pic = UI.center(UI.icon(icon, SLOT * 0.42, UI.VALOR if valor else GOLD_TEXT))
		pic.set_anchors_preset(Control.PRESET_FULL_RECT)
	holder.add_child(pic)
	var box = Control.new()
	box.custom_minimum_size = holder.custom_minimum_size
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(holder)
	# A cooldown reads as a big number over the dimmed picture.
	var cd: String = a.sub if a.sub != null and str(a.sub).begins_with("КД") else ""
	if cd != "":
		var n = UI.shadowed(UI.label(cd.substr(cd.find(":") + 1).strip_edges(), 20, UI.TEXT, "title"))
		n.set_anchors_preset(Control.PRESET_FULL_RECT)
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		n.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		box.add_child(n)
	if valor:
		var pips = UI.hbox(3, BoxContainer.ALIGNMENT_CENTER)
		for i in a.valorCost: pips.add_child(UI.valor_pip(true, 6))
		pips.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		pips.offset_top = UI.px(4); pips.offset_bottom = UI.px(12)
		box.add_child(pips)
	var key: String = a.key
	var needs: bool = a.needsTarget
	var fn = func():
		if needs:
			picking_heal = true
			_pick_key = key
			refresh()
		else: Game.b.raider_action(key)
	var border = UI.VALOR if valor else GOLD_LINE
	if a.key.begins_with("spell:"): border = Color(_res_color(), 0.75)
	if a.key == "defend": border = UI.BORDER_HOVER
	var cost: int = int(a.get("cost", 0)) if a.get("cost") != null else 0
	return _slot(box, a.label, _action_tip(a), fn, a.disabled, border, -1.0, true, _why_not(a), str(cost) if cost > 0 else "", _res_color())


## A word on why an action is greyed out; empty when it can be pressed or a
## cooldown number already says it.
func _why_not(a: Dictionary) -> String:
	if not a.disabled or (a.sub != null and str(a.sub).begins_with("КД")): return ""
	if a.get("short", false):
		var cur = Game.b.current_raider()
		return "мало: " + DB.specs.RESOURCES[cur.res.kind].name.to_lower() if cur else "не хватает"
	if a.key == "valor" and Game.b.sim.valor < int(a.valorCost): return "мало доблести"
	# Out of reach is said once, in the line over the bar (_hint), not under every blow.
	return ""


## Some blows are greyed out only because no foe is close enough.
func _out_of_reach() -> bool:
	return Game.b.turn_actions().any(func(a): return a.disabled and _why_not(a) == "" and not (a.sub != null and str(a.sub).begins_with("КД")) and not (a.key == "valor" and Game.b.sim.valor < int(a.valorCost)))


# ── who's standing ─────────────────────────────────────────────────────────
func _hp_color(pct: float) -> Color:
	return UI.GOOD if pct > 55 else (UI.WARN if pct > 25 else UI.DANGER)


## Wide window: the foes still up, top right, each with its health; the
## target is marked, a click makes another one the target.
func _foe_list(s: Dictionary) -> Control:
	var foes = (s.enemies + s.minions).filter(func(e): return e.alive)
	if foes.is_empty(): return null
	var v = UI.vbox(6)
	v.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	v.offset_left = -UI.px(14 + 230); v.offset_right = -UI.px(14); v.offset_top = UI.px(14)
	v.add_child(UI.shadowed(UI.kicker("Цели", UI.TEXT_FAINT, 10.5)))
	for e in foes:
		var on: bool = s.focusId != null and e.id == s.focusId
		var id: int = e.id
		var pn = PanelContainer.new()
		var sb = StyleBoxFlat.new()
		sb.bg_color = Color(0.25, 0.06, 0.04, 0.85) if on else Color(0.063, 0.047, 0.035, 0.8)
		sb.border_color = UI.DANGER if on else Color(UI.DANGER, 0.35)
		sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(6)); sb.set_content_margin_all(UI.px(7))
		pn.add_theme_stylebox_override("panel", sb)
		var cv = UI.vbox(4)
		var top = UI.hbox(6)
		if on: top.add_child(UI.center(UI.icon("crosshair", 13, UI.DANGER, "fill")))
		top.add_child(UI.expand(UI.label(e.name, 13, UI.TEXT if on else UI.TEXT_MUTED, "medium")))
		for d in s.dots.filter(func(x): return x.enemyId == id):
			top.add_child(_status_badge("drop", str(int(d.rounds)), UI.WARN, "%s: %d урона в ход, ещё %d." % [d.name, int(d.dmg), int(d.rounds)]))
		top.add_child(UI.label("%d/%d" % [maxi(0, int(e.hp)), e.maxHp], 11, UI.TEXT_DIM))
		cv.add_child(top)
		cv.add_child(UI.progress(100.0 * e.hp / e.maxHp, UI.DANGER, 5))
		pn.add_child(cv)
		pn.tooltip_text = "Нажмите, чтобы сделать целью"
		UI.tap(pn, func(): Game.b.set_focus(id))
		v.add_child(pn)
	return v


## Phone: the same foes as chips under the turn order.
func _foe_chips(s: Dictionary) -> Control:
	var foes = (s.enemies + s.minions).filter(func(e): return e.alive)
	if foes.is_empty(): return null
	var flow = HFlowContainer.new()
	flow.alignment = FlowContainer.ALIGNMENT_CENTER
	flow.add_theme_constant_override("h_separation", UI.px(6))
	flow.add_theme_constant_override("v_separation", UI.px(6))
	flow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for e in foes:
		var on: bool = s.focusId != null and e.id == s.focusId
		var id: int = e.id
		flow.add_child(UI.chip("%s %d" % [e.name, maxi(0, int(e.hp))], on, func(): Game.b.set_focus(id), "crosshair" if on else ""))
	return flow


## Turn, zoom and straighten the view. Drag on the field (right button on a
## computer) does the same; keys Q/E, +/−, PgUp/PgDn, R.
func _camera_bar() -> Control:
	var v = UI.vbox(6) if App.wide else UI.hbox(6)
	var d = 38.0 if App.wide else 32.0
	var btn = func(icon: String, tip: String, fn: Callable) -> Control:
		var pn = PanelContainer.new()
		var sb = StyleBoxFlat.new()
		sb.bg_color = Color(0.063, 0.047, 0.035, 0.82); sb.border_color = GOLD_LINE
		sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(d * 0.5))
		pn.add_theme_stylebox_override("panel", sb)
		pn.custom_minimum_size = Vector2(UI.px(d), UI.px(d))
		pn.add_child(UI.center(UI.icon(icon, d * 0.45, GOLD_TEXT)))
		pn.tooltip_text = tip
		UI.tap(pn, fn)
		return pn
	v.add_child(btn.call("arrow-counter-clockwise", "Повернуть влево (Q)", func(): view.rotate_by(-45.0)))
	v.add_child(btn.call("arrow-clockwise", "Повернуть вправо (E)", func(): view.rotate_by(45.0)))
	v.add_child(btn.call("magnifying-glass-plus", "Приблизить (+, колесо)", func(): view.zoom_by(0.85)))
	v.add_child(btn.call("magnifying-glass-minus", "Отдалить (−, колесо)", func(): view.zoom_by(1.18)))
	v.add_child(btn.call("camera-rotate", "Вернуть камеру (R)", func(): view.reset_camera()))
	return v


func _res_color() -> Color:
	var cur = Game.b.current_raider()
	return Color(DB.specs.RESOURCES[cur.res.kind].color) if cur else GOLD_LINE


func _action_tip(a: Dictionary) -> String:
	var cur = Game.b.current_raider()
	if a.key.begins_with("spell:"):
		return "%s — %s%s" % [a.label, a.desc, ("\n" + a.sub) if a.sub else ""]
	match a.key:
		"attack": return "Обычный удар по цели." + ("\n" + a.sub if a.sub else "")
		"heal": return "Лечит союзника на выбор."
		"ability":
			var d = DB.ability(cur.candidateId) if cur else {}
			return "%s — %s%s" % [a.label, d.get("desc", ""), ("\n" + a.sub) if a.sub else ""]
		"valor": return "%s — %s\nСтоит %d доблести." % [a.label, a.sub, a.valorCost]
		"rally": return "Поднимает дух отряда."
		"defend": return "Оборона: −40% урона до следующего хода."
	return a.label + (("\n" + a.sub) if a.sub else "")


func _unhandled_input(ev: InputEvent) -> void:
	if not (ev is InputEventKey and ev.pressed and not ev.echo): return
	var s = Game.b.sim
	if s == null: return
	var done = true
	if ev.keycode >= KEY_1 and ev.keycode <= KEY_9:
		var i: int = ev.keycode - KEY_1
		if i < _hotkeys.size() and _hotkeys[i].is_valid(): _hotkeys[i].call()
	elif ev.keycode == KEY_SPACE:
		if Game.b.boss_intro: Game.b.end_boss_intro()
		elif s.movePhase and Game.b.current_raider() and not Game.settings.auto: Game.b.skip_move()
	elif ev.keycode == KEY_A:
		picking_heal = false
		Game.toggle_auto()
	elif ev.keycode == KEY_X: Game.toggle_speed()
	elif ev.keycode == KEY_ESCAPE and picking_heal:
		picking_heal = false
		refresh()
	else: done = false
	if done: get_viewport().set_input_as_handled()


## First-fight coaching: one tip at a time, each shown once, when it's relevant.
func _tip(s: Dictionary, cur) -> Control:
	if s.over or Game.settings.auto: return null
	var tip = ""
	if s.windup and Game.tip_pending("windup"): tip = "windup"
	elif s.danger and Game.tip_pending("danger"): tip = "danger"
	elif cur and s.movePhase and Game.tip_pending("move"): tip = "move"
	elif cur and not s.movePhase and s.encounterType != "boss" and Game.tip_pending("focus"): tip = "focus"
	elif cur and not s.movePhase and not picking_heal and Game.tip_pending("act"): tip = "act"
	elif cur and not s.movePhase and not picking_heal and s.valor >= 2 and Game.tip_pending("valor"): tip = "valor"
	elif cur and not s.movePhase and Game.tip_pending("status") and s.raiders.any(func(r): return r.alive and (not r.buffs.is_empty() or not r.hots.is_empty() or r.absorb > 0)): tip = "status"
	if tip == "": return null
	var warn = tip == "danger" or tip == "windup"
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.82, 0.41, 0.36, 0.12) if warn else Color(UI.ACCENT, 0.12)
	sb.border_color = UI.DANGER if warn else UI.ACCENT; sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(8))
	sb.content_margin_left = UI.px(10); sb.content_margin_right = UI.px(10); sb.content_margin_top = UI.px(10); sb.content_margin_bottom = UI.px(10)
	pn.add_theme_stylebox_override("panel", sb)
	var row = UI.hbox(10)
	row.add_child(UI.icon("warning" if warn else "target", 16, UI.DANGER if warn else UI.ACCENT_SOFT))
	row.add_child(UI.label(DB.features.TIPS[tip], 13, UI.TEXT, "regular", true))
	row.add_child(UI.chip("Понятно", false, func(): Game.dismiss_tip(tip)))
	pn.add_child(row)
	return pn


## A boss fight opens on its title card; tap or wait to begin.
func _intro(bi: Dictionary) -> Control:
	var c = ColorRect.new()
	c.color = Color(0.03, 0.02, 0.04, 0.82)
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.mouse_filter = Control.MOUSE_FILTER_STOP
	var v = UI.vbox(10)
	v.set_anchors_preset(Control.PRESET_CENTER)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	var m = UI.margin(v, 28, 0, 28, 0)
	m.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.add_child(m)
	var place = UI.kicker(bi.place, UI.ACCENT, 12)
	place.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(place)
	var n = UI.shadowed(UI.label(bi.name, 36, Color("#f4e6d4"), "title", true))
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(n)
	v.add_child(UI.center(UI.ornament(200, UI.DANGER)))
	var line = UI.label(bi.line, 15, UI.TEXT_MUTED, "italic", true)
	line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(line)
	var hint = UI.label("Нажмите, чтобы начать", 12.5, UI.TEXT_FAINT)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(UI.space(14))
	v.add_child(hint)
	v.size_flags_vertical = Control.SIZE_EXPAND_FILL
	m.get_child(0).size_flags_vertical = Control.SIZE_EXPAND_FILL
	UI.tap(c, Game.b.end_boss_intro, false)
	return c
