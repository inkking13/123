class_name Minimap
extends Control
## The whole land in a round frame, turned with the camera so that up on it
## is ahead on the screen: the road, the river, the places and bands the
## squad has seen, the haze over the rest, the squad and where it walks.
## A tap on it sends the squad there.

var view: WorldView
var _stamp = []

const KIND_COLOR := {"town": Color(0.95, 0.8, 0.45), "dungeon": Color(0.85, 0.35, 0.3), "chest": Color(0.95, 0.68, 0.3),
	"herb": Color(0.5, 0.82, 0.45), "road": Color(0.85, 0.82, 0.7)}


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	tooltip_text = "Карта земли. Нажми, чтобы идти туда."


func _process(_dt: float) -> void:
	var w = Game.w
	if w == null or not is_instance_valid(view): return
	var stamp = [snappedf(view.yaw, 0.02), w.pos.snapped(Vector2(0.5, 0.5)), w.explore_seq, w.target, int(w.hours), w.region_bands().map(func(b): return b.pos.snapped(Vector2.ONE)),
		w.region_roamers().map(func(r): return r.pos.snapped(Vector2.ONE * 2.0))]
	if stamp != _stamp:
		_stamp = stamp
		queue_redraw()


func _radius() -> float:
	return minf(size.x, size.y) * 0.5


## From the land to the frame, and back: turned with the camera.
func _to_map(p: Vector2) -> Vector2:
	var y: float = view.yaw
	var k = (_radius() - 4.0) / (Game.w.size() * 1.42)
	return size * 0.5 + Vector2(p.dot(Vector2(cos(y), -sin(y))), p.dot(Vector2(sin(y), cos(y)))) * k


func _to_land(m: Vector2) -> Vector2:
	var y: float = view.yaw
	var k = (_radius() - 4.0) / (Game.w.size() * 1.42)
	var d = (m - size * 0.5) / k
	return Vector2(cos(y), -sin(y)) * d.x + Vector2(sin(y), cos(y)) * d.y


func _draw() -> void:
	var w = Game.w
	if w == null or not is_instance_valid(view): return
	var c = size * 0.5
	var r = _radius()
	var lively: bool = w.theme().get("lively", false)
	draw_circle(c, r, Color(0.06, 0.045, 0.035, 0.9))
	var half: float = w.size()
	var th: Dictionary = w.theme()
	draw_colored_polygon(PackedVector2Array([_to_map(Vector2(-half, -half)), _to_map(Vector2(half, -half)), _to_map(Vector2(half, half)), _to_map(Vector2(-half, half))]), th.ground.lightened(0.18))
	var land: Land = view.land
	if land and not land.river.is_empty():
		draw_polyline(PackedVector2Array(land.river.map(func(p): return _to_map(p))), Color(0.35, 0.55, 0.68), maxf(2.0, r * 0.04))
	draw_polyline(PackedVector2Array(w.road_path().map(func(p): return _to_map(p))), Color(0.78, 0.66, 0.46), maxf(1.5, r * 0.03))
	# The haze over what has not been seen.
	if lively:
		var n = w.fog_cells()
		var cells: PackedByteArray = w.explored_cells()
		var cell = World.FOG_CELL
		for j in n:
			for i in n:
				if cells[j * n + i] != 0: continue
				var a = Vector2(-half + i * cell, -half + j * cell)
				draw_colored_polygon(PackedVector2Array([_to_map(a), _to_map(a + Vector2(cell, 0)), _to_map(a + Vector2(cell, cell)), _to_map(a + Vector2(0, cell))]), Color(0.16, 0.15, 0.14, 0.88))
	var dot = maxf(2.5, r * 0.045)
	for p in w.layout().places:
		if lively and not w.is_explored(p.pos): continue
		if p.kind == "chest" and w.opened.has(p.id): continue
		var col: Color = KIND_COLOR.get(p.kind, Color(0.72, 0.7, 0.62))
		if p.kind == "town": draw_rect(Rect2(_to_map(p.pos) - Vector2.ONE * dot * 1.3, Vector2.ONE * dot * 2.6), col)
		else: draw_circle(_to_map(p.pos), dot * (0.8 if p.kind in ["chest", "herb"] else 1.0), col)
	for b in w.region_bands():
		if lively and not w.is_explored(b.pos) and not b.chasing: continue
		draw_circle(_to_map(b.pos), dot * 1.1, Color(0.95, 0.3, 0.25))
	for ro in w.region_roamers():
		if ro.kind == "wolves" and not w.wolves_out(): continue
		if not w.is_explored(ro.pos): continue
		draw_circle(_to_map(ro.pos), dot * 0.9, {"caravan": Color(0.95, 0.85, 0.5), "patrol": Color(0.55, 0.7, 0.95), "wolves": Color(0.75, 0.75, 0.78)}[ro.kind])
	if w.target != null:
		draw_arc(_to_map(w.target), dot * 1.3, 0, TAU, 16, Color(1, 0.85, 0.5, 0.9), 1.5)
	# The squad: an arrow pointing ahead, which on this map is always up.
	var at = _to_map(w.pos)
	var s = dot * 2.0
	draw_colored_polygon(PackedVector2Array([at + Vector2(0, -s), at + Vector2(s * 0.7, s * 0.6), at + Vector2(0, s * 0.25), at + Vector2(-s * 0.7, s * 0.6)]), Color(1.0, 0.92, 0.7))
	# North, marked on the rim.
	var north = (_to_map(Vector2(0, -half)) - c).normalized() * (r - dot * 1.6) + c
	draw_string(UI.FONTS.medium, north - Vector2(dot, -dot), "С", HORIZONTAL_ALIGNMENT_CENTER, dot * 2.0, int(dot * 2.4), Color(0.9, 0.82, 0.62))
	draw_arc(c, r - 1.0, 0, TAU, 48, Color(0.79, 0.64, 0.42, 0.6), 2.0)


func _gui_input(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT and ev.pressed:
		if ev.position.distance_to(size * 0.5) > _radius(): return
		var p = _to_land(ev.position)
		var half: float = Game.w.size()
		Game.w.walk_to(Vector2(clampf(p.x, -half + 1, half - 1), clampf(p.y, -half + 1, half - 1)))
		accept_event()
