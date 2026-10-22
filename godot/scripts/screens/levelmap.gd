extends Screen
## The campaign map: each land a parchment sheet with ink sketches, the road
## between its three dungeons, and the one to go to next sealed in wax.

const VBOX := Vector2(300, 460)
const NODE_POS := [Vector2(90, 365), Vector2(210, 235), Vector2(90, 75)]
const SKETCHES := [[235, 70, "peak", 1.1], [268, 92, "peak", 0.8], [40, 200, "tree", 1.0], [58, 222, "tree", 0.8], [250, 380, "hills", 1.0],
	[165, 150, "hills", 0.8], [30, 440, "peak", 0.7], [270, 300, "tree", 0.9], [175, 430, "tree", 0.75]]
const ICON := {
	"wastes": "skull", "road": "path", "groblot": "skull", "frostpass": "drop", "wolfrifts": "target", "icepeaks": "snowflake",
	"charfields": "flame", "parishruins": "campfire", "ashen": "fire", "mortgagedfarms": "scroll", "debtorsjail": "shield-chevron", "mines": "coins",
	"blackmarket": "storefront", "smugglercatacombs": "path", "nightsyndicate": "sword", "unmarkedgraves": "skull", "desertersfort": "shield",
	"deadlegion": "users-three", "burntcliffs": "flame", "wyvernlair": "target", "ancientpeak": "fire", "shareholderfloor": "chart-line-up",
	"councilantechamber": "identification-card", "boardroom": "crown-simple",
}


func build() -> void:
	var p = make_page(0, 24.0, 20.0, true, NARROW_W)
	p.add_child(UI.kicker("Отдел кадров"))
	p.add_child(UI.screen_title("Карта походов"))
	p.add_child(UI.space(4))
	p.add_child(UI.label("Восемь земель гильдии, по три командировки в каждой — от разминки до самого верха. Каждая открывается победой над предыдущей.", 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(18))
	var current = null
	for d in DB.dungeon_list:
		if current == null and Game.is_dungeon_unlocked(d.id) and not Game.defeated.has(d.id): current = d.id
	for gi in DB.locations.size():
		var loc: Dictionary = DB.locations[gi]
		var nodes: Array = DB.dungeon_list.filter(func(d): return d.locationId == loc.id)
		var open = nodes.any(func(d): return Game.is_dungeon_unlocked(d.id))
		p.add_child(UI.kicker("%d. %s" % [gi + 1, loc.name], UI.ACCENT if open else UI.TEXT_FAINT, 12.5))
		p.add_child(UI.label(loc.desc, 13, UI.TEXT_DIM, "regular", true))
		p.add_child(UI.space(12))
		p.add_child(_sheet(nodes, open, current))
		p.add_child(UI.space(26))


func _sketch(kind: String) -> Array:
	match kind:
		"peak": return [[Vector2(-16, 10), Vector2(0, -14), Vector2(16, 10)], [Vector2(0, -14), Vector2(4, -2), Vector2(2, 4), Vector2(7, 10)], [Vector2(4, -4), Vector2(9, 2)], [Vector2(6, -8), Vector2(12, 0)]]
		"tree": return [[Vector2(0, 10), Vector2(0, 0)], [Vector2(-7, 2), Vector2(-9, -6), Vector2(-4, -12), Vector2(0, -13), Vector2(4, -12), Vector2(9, -6), Vector2(7, 2), Vector2(0, 4), Vector2(-7, 2)]]
	return [[Vector2(-20, 6), Vector2(-14, -1), Vector2(-7, -2), Vector2(0, 6), Vector2(5, 1), Vector2(11, 0), Vector2(18, 6)]]


func _sheet(nodes: Array, open: bool, current) -> Control:
	var box = Control.new()
	box.custom_minimum_size = Vector2(0, 0)
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if not open: box.modulate.a = 0.55
	box.resized.connect(func(): box.custom_minimum_size.y = box.size.x * VBOX.y / VBOX.x)
	box.custom_minimum_size.y = UI.px(530)
	var tint: Color = Color(1, 1, 1, 0)
	box.draw.connect(func():
		var k = box.size.x / VBOX.x
		box.draw_texture_rect(UI.PAPER, Rect2(Vector2.ZERO, box.size), false)
		for s in SKETCHES:
			var at = Vector2(s[0], s[1]) * k
			for line in _sketch(s[2]):
				var pts = PackedVector2Array()
				for q in line: pts.append(at + q * s[3] * k)
				box.draw_polyline(pts, Color(UI.INK_MUTED, 0.55), 1.4 * k, true)
		for i in range(1, nodes.size()):
			var a: Vector2 = NODE_POS[i - 1] * k
			var b: Vector2 = NODE_POS[mini(i, NODE_POS.size() - 1)] * k
			var cleared: bool = Game.defeated.has(nodes[i - 1].id)
			var next_open: bool = Game.is_dungeon_unlocked(nodes[i].id)
			var col = UI.INK if cleared else (UI.INK_RED if next_open else UI.INK_FAINT)
			col.a = 0.85 if cleared or next_open else 0.5
			var mid = (a.y + b.y) * 0.5
			var pts = PackedVector2Array()
			for t in 25:
				var u = t / 24.0
				pts.append(a.bezier_interpolate(Vector2(a.x, mid), Vector2(b.x, mid), b, u))
			if cleared: box.draw_polyline(pts, col, 2.5 * k, true)
			else:
				for j in range(0, pts.size() - 1, 2): box.draw_line(pts[j], pts[j + 1], col, 2.5 * k, true))
	for i in nodes.size():
		var d: Dictionary = nodes[i]
		var unlocked = Game.is_dungeon_unlocked(d.id)
		var cleared: bool = Game.defeated.has(d.id)
		var here: bool = d.id == current
		var col = UI.vbox(2)
		col.custom_minimum_size = Vector2(UI.px(110), 0)
		var node: Control
		if here: node = UI.wax_seal(56, ICON.get(d.id, "skull"))
		else:
			node = Control.new()
			node.custom_minimum_size = Vector2(UI.px(60), UI.px(60))
			var ic = UI.icon("check" if cleared else (ICON.get(d.id, "skull") if unlocked else "lock-simple"), 24 if unlocked else 20, UI.INK_GREEN if cleared else (UI.INK_RED if unlocked else UI.INK_FAINT), "fill" if cleared else "regular")
			node.add_child(ic)
			ic.position = Vector2(UI.px(30), UI.px(30)) - ic.custom_minimum_size * 0.5
			node.draw.connect(func():
				var c = node.size * 0.5
				node.draw_circle(c, node.size.x * 0.5, Color(0.965, 0.918, 0.808, 0.55))
				node.draw_arc(c, node.size.x * 0.5 - 2, 0, TAU, 48, UI.INK if unlocked else UI.INK_FAINT, 3.0, true))
		col.add_child(UI.center(node))
		if here:
			var hl = UI.label("Вы здесь", 11.5, UI.INK_RED, "title")
			hl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			col.add_child(hl)
		var tag = PanelContainer.new()
		var sb = StyleBoxFlat.new(); sb.bg_color = Color(0.925, 0.871, 0.745, 0.82); sb.set_corner_radius_all(UI.px(6))
		sb.content_margin_left = UI.px(6); sb.content_margin_right = UI.px(6); sb.content_margin_top = UI.px(2); sb.content_margin_bottom = UI.px(2)
		tag.add_theme_stylebox_override("panel", sb)
		tag.custom_minimum_size.x = UI.px(112)
		var tv = UI.vbox(0)
		var n = UI.label(d.name, 14, UI.INK if unlocked else UI.INK_FAINT, "title", true)
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		tv.add_child(n)
		var s = UI.label("реком. ГС %d" % d.recommendedGs if unlocked else "закрыто", 12, UI.INK_MUTED, "italic")
		s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		tv.add_child(s)
		tag.add_child(tv)
		col.add_child(UI.center(tag))
		box.add_child(col)
		var pos: Vector2 = NODE_POS[mini(i, NODE_POS.size() - 1)]
		box.resized.connect(func():
			var k = box.size.x / VBOX.x
			col.size = col.get_combined_minimum_size()
			col.position = Vector2(pos.x * k - col.size.x * 0.5, pos.y * k - UI.px(30)))
		if unlocked:
			var did: String = d.id
			UI.tap(col, func():
				Game.head_for(did))
	return box
