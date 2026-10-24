class_name WorldLife
extends Node3D
## The everyday life of a lively land, on top of what WorldView builds: stops
## by the road (a cart that lost a wheel, a woodpile, a travellers' camp),
## stumps and fallen logs in the woods, wildflowers, sheep, cows and hens on
## the farm, dogs in the town, ducks and a fisherman at the lake, folk on the
## road, birds over the woods and crows over the graveyard, smoke from the
## chimneys and fireflies at night. Kept light for weak phones: shared meshes,
## MultiMeshes for whatever stands still, and few lights.

const BIRD := preload("res://shaders/bird.gdshader")
## How far from the road its stops stand.
const STOP_GAP := 5.5

var view: WorldView
var _stops = []         # [Vector2 at, Vector2 road dir, String kind]
var _beasts = []        # {node, head, home, radius, to, wait, speed, graze}
var _walkers = []       # {unit, path, i, dir, wait}
var _flocks = []        # {mm, center, radius, height, speed, angle, birds}
var _ducks = []         # {node, center, radius, angle, speed}
var _fireflies: Array[CPUParticles3D] = []
var _time = 0.0
var _roamers = {}       # kind -> {root, units, last, moving}: the caravan, the patrol, the wolves


## Where the road's stops go; the woods keep clear of them.
func plan() -> Array:
	var road: Array = view._road_points()
	var places: Array = Game.w.layout().places
	var kinds = ["cart", "woodpile", "camp", "hay", "cairn", "cart", "woodpile"]
	var walked = 0.0
	var next = 14.0
	var side = 1.0
	for i in road.size() - 1:
		var a: Vector2 = road[i]
		var b: Vector2 = road[i + 1]
		var seg = a.distance_to(b)
		while next < walked + seg and _stops.size() < kinds.size():
			var dir = (b - a).normalized()
			var p = a.lerp(b, (next - walked) / seg) + dir.orthogonal() * STOP_GAP * side
			var clear = not places.any(func(q): return q.pos.distance_to(p) < 13.0)
			if Game.w.has_big_town() and p.distance_to(Game.w.layout().town) < World.TOWN_RADIUS + 7.0: clear = false
			if view.land.river_gap(p) < Land.RIVER_HALF + 5.0: clear = false
			if clear:
				_stops.append([p, dir * side, kinds[_stops.size()]])
				side = -side
				next += 21.0
			else: next += 6.0
		walked += seg
	return stops()


func stops() -> Array:
	return _stops.map(func(s): return s[0])


func build() -> void:
	var rng = RandomNumberGenerator.new()
	rng.seed = hash(Game.w.region) + 23
	for s in _stops: _stop(s[0], s[1], s[2], rng)
	_woods_floor(rng)
	_wildflowers(rng)
	var places = {}
	for p in Game.w.layout().places: places[p.kind] = p
	if places.has("farm"): _farm_life(places.farm, rng)
	if places.has("lake"): _lake_life(places.lake, rng)
	if places.has("graveyard"): _flock(_v3(places.graveyard.pos), 7.0, 6.5, 0.35, 6, Color(0.08, 0.08, 0.09), rng)
	if places.has("ruins"): _flock(_v3(places.ruins.pos), 9.0, 7.5, 0.3, 4, Color(0.1, 0.09, 0.09), rng)
	if Game.w.has_big_town(): _town_life(rng)
	# Small birds over the woods, now here, now there.
	for k in 3:
		var at = view._tree_spots[rng.randi() % view._tree_spots.size()] if not view._tree_spots.is_empty() else Vector2.ZERO
		_flock(_v3(at), rng.randf_range(10, 16), rng.randf_range(8, 10), rng.randf_range(0.4, 0.55), 7, Color(0.22, 0.2, 0.18), rng)
	_road_walkers(rng)
	# Fireflies at the edge of the woods too.
	for k in 2:
		if view._tree_spots.is_empty(): break
		var t: Vector2 = view._tree_spots[rng.randi() % view._tree_spots.size()]
		_fireflies.append(_fireflies_at(_v3(t, 1.0), Vector3(14, 1.4, 14)))


func _v3(p: Vector2, y := 0.0) -> Vector3:
	return Vector3(p.x, view.ground_y(p) + y, p.y)


# ── by the road ────────────────────────────────────────────────────────────
func _stop(at: Vector2, dir: Vector2, kind: String, rng: RandomNumberGenerator) -> void:
	var root = Node3D.new()
	root.position = _v3(at)
	# Faces the road: +Z points back to it.
	var back = -dir.orthogonal()
	root.rotation.y = atan2(back.x, back.y)
	add_child(root)
	var wood = Color(0.38, 0.26, 0.15)
	match kind:
		"cart":
			# A cart that lost a wheel, its load stacked beside it.
			var cart = Node3D.new()
			cart.rotation = Vector3(0, 0.4, 0.12)
			root.add_child(cart)
			if not view._prop(cart, "world-cart", 2.6, Vector3.ZERO, 0.0, true):
				view._box(cart, Vector3(1.4, 0.5, 2.4), Vector3(0, 0.75, 0), wood)
			view._prop(root, "world-barrels", 1.2, Vector3(1.9, 0, 0.6), rng.randf() * TAU)
			view._box(root, Vector3(0.7, 0.6, 0.7), Vector3(-1.6, 0.3, 0.9), Color(0.5, 0.36, 0.2), 0.3)
			view._box(root, Vector3(0.6, 0.5, 0.6), Vector3(-1.5, 0.85, 0.85), Color(0.48, 0.34, 0.19), 0.7)
			var wheel = view._cyl(root, 0.5, 0.5, 0.1, Vector3(0.3, 0.06, 1.6), Color(0.3, 0.2, 0.12), 10)
			wheel.rotation.x = PI * 0.5
		"woodpile":
			# Logs stacked against two stakes, a chopping block with an axe.
			for row in 3:
				for k in 4 - row:
					var log = view._cyl(root, 0.17, 0.17, 2.2, Vector3(-0.55 + k * 0.36 + row * 0.18, 0.17 + row * 0.3, 0), Color(0.42, 0.3, 0.18), 7, "wood")
					log.rotation.x = PI * 0.5
			for x in [-0.85, 0.95]: view._box(root, Vector3(0.1, 1.2, 0.1), Vector3(x, 0.6, 0), wood)
			view._cyl(root, 0.32, 0.36, 0.5, Vector3(1.8, 0.25, 0.9), Color(0.45, 0.32, 0.2), 9, "wood")
			var haft = view._box(root, Vector3(0.06, 0.8, 0.06), Vector3(1.8, 0.75, 0.9), Color(0.5, 0.36, 0.22), 0.0, 0.9, "")
			haft.rotation.z = 0.5
			view._fence(root, Vector3(-2.5, 0, -1.4), Vector3(2.5, 0, -1.4), wood)
		"camp":
			# Travellers resting: a tent, a fire with smoke, one of them by it.
			if not view._prop(root, "world-tent", 2.6, Vector3(-1.6, 0, -1.2), 0.3, true): view._tent(root)
			for k in 6:
				var a = k * TAU / 6.0
				view._box(root, Vector3(0.4, 0.2, 0.3), Vector3(1.0 + cos(a) * 0.6, 0.1, 0.6 + sin(a) * 0.6), Color(0.4, 0.38, 0.36), -a)
			view._fire(root, Vector3(1.0, 0.3, 0.6))
			_smoke(root, Vector3(1.0, 0.9, 0.6), 0.6)
			view._box(root, Vector3(1.4, 0.35, 0.35), Vector3(2.4, 0.18, 1.4), wood, 0.9)
			var u = view._unit({"body": "human", "set": "leather"}, 0, "")
			u.position = root.global_position + root.global_basis * Vector3(2.1, 0, 0.0)
			u.face(root.global_position + root.global_basis * Vector3(1.0, 0, 0.6))
			u.play_idle()
		"hay":
			# A hay rick by a bit of fence, a pitchfork leant on it.
			view._prop(root, "world-haystack", 2.2, Vector3(0, 0, -0.4), rng.randf() * TAU)
			view._prop(root, "world-haystack", 1.5, Vector3(1.9, 0, 0.3), rng.randf() * TAU)
			view._fence(root, Vector3(-2.6, 0, 1.0), Vector3(-0.6, 0, 2.2), wood)
			var fork = view._box(root, Vector3(0.05, 1.6, 0.05), Vector3(-1.1, 0.75, 0.4), Color(0.5, 0.38, 0.24), 0.0, 0.9, "")
			fork.rotation.x = -0.35
		"cairn":
			# A cairn of stones where the road bends, a ribbon of offerings on a stick.
			var stone = Color(0.48, 0.46, 0.43)
			for k in 7:
				var r = 0.5 - k * 0.055
				var s = view._box(root, Vector3(r * 1.6, 0.28, r * 1.3), Vector3(rng.randf_range(-0.05, 0.05), 0.14 + k * 0.25, rng.randf_range(-0.05, 0.05)), stone.darkened(k * 0.03), rng.randf() * TAU)
				s.rotation.z = rng.randf_range(-0.08, 0.08)
			view._box(root, Vector3(0.05, 1.8, 0.05), Vector3(0.7, 0.9, 0.2), wood)
			view._box(root, Vector3(0.04, 0.5, 0.12), Vector3(0.74, 1.5, 0.27), Color(0.55, 0.2, 0.15), 0.3, 0.9, "")


# ── woods and meadows ─────────────────────────────────────────────────────
func _woods_floor(rng: RandomNumberGenerator) -> void:
	var trees: Array = view._tree_spots
	if trees.is_empty(): return
	var bark = view._solid(Color(0.36, 0.26, 0.17), 0.95, Color.BLACK, "wood")
	var stumps = []
	var logs = []
	for k in 90:
		var t: Vector2 = trees[rng.randi() % trees.size()]
		var p = t + Vector2.from_angle(rng.randf() * TAU) * rng.randf_range(1.6, 2.6)
		if view._near_road(p, 3.0): continue
		if k % 3 == 0: logs.append(p)
		else: stumps.append(p)
	var stump = _stump_mesh()
	var log = _log_mesh()
	view._scatter(stump, stumps, rng, 0.7, 1.3, bark)
	view._scatter(log, logs, rng, 0.8, 1.4, bark)


func _stump_mesh() -> Mesh:
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var c = CylinderMesh.new(); c.top_radius = 0.26; c.bottom_radius = 0.34; c.height = 0.45; c.radial_segments = 7; c.rings = 1
	view._append(st, c, Transform3D(Basis(), Vector3(0, 0.22, 0)), Color.WHITE)
	for k in 3:
		var root = CylinderMesh.new(); root.top_radius = 0.06; root.bottom_radius = 0.12; root.height = 0.5; root.radial_segments = 4; root.rings = 1
		var a = k * TAU / 3.0 + 0.4
		_append_b(st, root, Transform3D(Basis(Vector3(-sin(a), 0, cos(a)), 1.2), Vector3(cos(a) * 0.32, 0.08, sin(a) * 0.32)))
	st.generate_normals()
	return st.commit()


func _log_mesh() -> Mesh:
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var c = CylinderMesh.new(); c.top_radius = 0.2; c.bottom_radius = 0.24; c.height = 2.6; c.radial_segments = 7; c.rings = 1
	_append_b(st, c, Transform3D(Basis(Vector3.FORWARD, PI * 0.5), Vector3(0, 0.2, 0)))
	var br = CylinderMesh.new(); br.top_radius = 0.02; br.bottom_radius = 0.07; br.height = 0.9; br.radial_segments = 4; br.rings = 1
	_append_b(st, br, Transform3D(Basis(Vector3.BACK, -0.8), Vector3(0.5, 0.5, 0.05)))
	st.generate_normals()
	return st.commit()


func _append_b(st: SurfaceTool, m: PrimitiveMesh, t: Transform3D, col := Color.WHITE) -> void:
	view._append(st, m, t, col)


## Wildflowers in the open grass: pale yellow, white and a little lilac.
func _wildflowers(rng: RandomNumberGenerator) -> void:
	var places: Array = Game.w.layout().places
	var at = []
	var half = Game.w.size()
	for _i in 140:
		# In clumps of a few, so meadows show patches rather than a sprinkle.
		var c = Vector2(rng.randf_range(-half, half), rng.randf_range(-half, half))
		if view._near_road(c, 2.5) or places.any(func(q): return q.pos.distance_to(c) < 8.0): continue
		if Game.w.has_big_town() and Game.w.layout().town.distance_to(c) < World.TOWN_RADIUS + 1.0: continue
		for k in rng.randi_range(3, 6): at.append(c + Vector2(rng.randf_range(-1.6, 1.6), rng.randf_range(-1.6, 1.6)))
	view._scatter(_flower_mesh(), at, rng, 1.2, 1.7, view.wind_material(view._vc_material(0.9), 0.3, 0.2))


func _flower_mesh() -> Mesh:
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var cols = [Color(0.86, 0.8, 0.45), Color(0.86, 0.84, 0.76), Color(0.62, 0.52, 0.7), Color(0.86, 0.8, 0.45), Color(0.78, 0.5, 0.36), Color(0.86, 0.84, 0.76)]
	var stem = Color(0.3, 0.38, 0.2)
	# A low leafy tuft the blooms rise out of.
	var base = SphereMesh.new(); base.radius = 0.5; base.height = 1.0; base.radial_segments = 6; base.rings = 2
	view._append(st, base, Transform3D(Basis().scaled(Vector3(0.42, 0.12, 0.42)), Vector3(0, 0.04, 0)), stem.darkened(0.1))
	for k in 6:
		var a = k * 1.05
		var p = Vector3(cos(a) * 0.12 * (1 + k % 2), 0, sin(a) * 0.12 * (1 + k % 2))
		var h = 0.14 + (k % 3) * 0.05
		var s = CylinderMesh.new(); s.top_radius = 0.008; s.bottom_radius = 0.012; s.height = h; s.radial_segments = 3; s.rings = 1
		view._append(st, s, Transform3D(Basis(), p + Vector3(0, h * 0.5, 0)), stem)
		var head = SphereMesh.new(); head.radius = 0.06; head.height = 0.06; head.radial_segments = 5; head.rings = 2
		view._append(st, head, Transform3D(Basis(), p + Vector3(0, h, 0)), cols[k])
	st.generate_normals()
	return st.commit()


# ── beasts ─────────────────────────────────────────────────────────────────
## A low-poly beast in two parts, a body and a head that dips to graze.
func _beast(kind: String, at: Vector3, home: Vector3, radius: float, rng: RandomNumberGenerator) -> void:
	var node = Node3D.new()
	node.position = at
	node.rotation.y = rng.randf() * TAU
	add_child(node)
	# The owner's Meshy beast when there is one: the whole body dips to graze.
	var head = animal(kind)
	if head:
		node.add_child(head)
	else:
		var parts = _beast_meshes(kind)
		var body = MeshInstance3D.new()
		body.mesh = parts[0]
		body.material_override = _beast_mat()
		node.add_child(body)
		head = Node3D.new()
		head.position = parts[2]
		node.add_child(head)
		var hm = MeshInstance3D.new()
		hm.mesh = parts[1]
		hm.material_override = body.material_override
		hm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		head.add_child(hm)
		head.set_meta("parts", true)
	var speed = {"sheep": 0.5, "cow": 0.4, "hen": 0.7, "dog": 1.6, "wolf": 2.2, "horse": 1.2}[kind]
	_beasts.append({"node": node, "head": head, "home": home, "radius": radius, "to": at, "wait": rng.randf() * 4.0, "speed": speed, "kind": kind, "phase": rng.randf() * TAU})


var _beast_cache = {}
var _beast_material: StandardMaterial3D
var _animals = {}       # kind -> [mesh, scale, lift], from the Meshy models

## How tall each beast stands, in metres, and how low a duck sits in the water.
const ANIMAL_HEIGHT := {"sheep": 0.95, "cow": 1.45, "dog": 0.62, "hen": 0.42, "duck": 0.36, "wolf": 0.85, "horse": 1.75}


## A beast from the owner's Meshy models, facing +Z and standing at the
## origin, or null when there is no model for it. The mesh keeps the
## imported levels of detail, so a far flock costs little.
static func animal_mesh(kind: String) -> Array:
	var path = "res://assets/models/world-%s.glb" % kind
	if not ResourceLoader.exists(path): return []
	var scene: Node3D = load(path).instantiate()
	var found: MeshInstance3D = null
	for c in scene.find_children("*", "MeshInstance3D", true, false):
		found = c
		break
	if found == null:
		scene.free()
		return []
	var mesh: Mesh = found.mesh
	var box = mesh.get_aabb()
	var k = ANIMAL_HEIGHT.get(kind, 1.0) / maxf(0.01, box.size.y)
	scene.free()
	return [mesh, k, -box.position.y * k]


func animal(kind: String) -> Node3D:
	if not _animals.has(kind): _animals[kind] = animal_mesh(kind)
	var a: Array = _animals[kind]
	if a.is_empty(): return null
	var mi = MeshInstance3D.new()
	mi.mesh = a[0]
	mi.scale = Vector3.ONE * a[1]
	mi.position.y = a[2]
	if kind in ["hen", "duck"]: mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


func _beast_mat() -> StandardMaterial3D:
	if _beast_material == null: _beast_material = view._vc_material(0.95)
	return _beast_material


## [body mesh, head mesh, where the neck is].
func _beast_meshes(kind: String) -> Array:
	if _beast_cache.has(kind): return _beast_cache[kind]
	var body = SurfaceTool.new(); body.begin(Mesh.PRIMITIVE_TRIANGLES)
	var head = SurfaceTool.new(); head.begin(Mesh.PRIMITIVE_TRIANGLES)
	var neck = Vector3.ZERO
	var legs = func(st: SurfaceTool, w: float, l: float, h: float, r: float, col: Color) -> void:
		for p in [Vector2(-w, -l), Vector2(w, -l), Vector2(-w, l), Vector2(w, l)]:
			var c = CylinderMesh.new(); c.top_radius = r; c.bottom_radius = r * 0.8; c.height = h; c.radial_segments = 4; c.rings = 1
			view._append(st, c, Transform3D(Basis(), Vector3(p.x, h * 0.5, p.y)), col)
	var ball = func(st: SurfaceTool, at: Vector3, size: Vector3, col: Color, segs := 7) -> void:
		var s = SphereMesh.new(); s.radius = 0.5; s.height = 1.0; s.radial_segments = segs; s.rings = 4
		view._append(st, s, Transform3D(Basis().scaled(size), at), col)
	match kind:
		"sheep":
			var wool = Color(0.78, 0.74, 0.66)
			var face = Color(0.16, 0.14, 0.13)
			legs.call(body, 0.16, 0.26, 0.38, 0.045, face)
			ball.call(body, Vector3(0, 0.55, 0), Vector3(0.55, 0.45, 0.85), wool)
			ball.call(body, Vector3(0, 0.66, -0.12), Vector3(0.46, 0.3, 0.5), wool.lightened(0.05))
			neck = Vector3(0, 0.62, 0.38)
			ball.call(head, Vector3(0, 0.02, 0.16), Vector3(0.2, 0.22, 0.32), face, 6)
			ball.call(head, Vector3(0, 0.1, 0.06), Vector3(0.26, 0.16, 0.2), wool, 6)
		"cow":
			var hide = Color(0.3, 0.19, 0.12)
			var patch = Color(0.8, 0.76, 0.68)
			legs.call(body, 0.22, 0.48, 0.62, 0.07, hide.darkened(0.2))
			var b = BoxMesh.new(); b.size = Vector3(0.62, 0.6, 1.5)
			view._append(body, b, Transform3D(Basis(), Vector3(0, 0.92, 0)), hide)
			var p = BoxMesh.new(); p.size = Vector3(0.64, 0.4, 0.5)
			view._append(body, p, Transform3D(Basis(), Vector3(0, 1.0, -0.2)), patch)
			var tail = CylinderMesh.new(); tail.top_radius = 0.02; tail.bottom_radius = 0.03; tail.height = 0.6; tail.radial_segments = 3; tail.rings = 1
			view._append(body, tail, Transform3D(Basis(Vector3.RIGHT, 0.2), Vector3(0, 0.9, -0.78)), hide.darkened(0.2))
			neck = Vector3(0, 1.05, 0.72)
			var h = BoxMesh.new(); h.size = Vector3(0.34, 0.36, 0.5)
			view._append(head, h, Transform3D(Basis(Vector3.RIGHT, 0.5), Vector3(0, -0.08, 0.2)), hide)
			var m = BoxMesh.new(); m.size = Vector3(0.3, 0.18, 0.16)
			view._append(head, m, Transform3D(Basis(Vector3.RIGHT, 0.5), Vector3(0, -0.24, 0.42)), patch.darkened(0.15))
			for s in [-1, 1]:
				var horn = CylinderMesh.new(); horn.top_radius = 0.0; horn.bottom_radius = 0.03; horn.height = 0.18; horn.radial_segments = 3; horn.rings = 1
				view._append(head, horn, Transform3D(Basis(Vector3.BACK, -0.9 * s), Vector3(0.18 * s, 0.12, 0.1)), Color(0.8, 0.76, 0.66))
		"hen":
			var feather = [Color(0.62, 0.44, 0.26), Color(0.82, 0.78, 0.7)][randi() % 2]
			legs.call(body, 0.04, 0.0, 0.12, 0.012, Color(0.75, 0.6, 0.3))
			ball.call(body, Vector3(0, 0.2, 0), Vector3(0.2, 0.2, 0.28), feather, 6)
			ball.call(body, Vector3(0, 0.28, -0.14), Vector3(0.1, 0.16, 0.1), feather.darkened(0.2), 5)
			neck = Vector3(0, 0.28, 0.1)
			ball.call(head, Vector3(0, 0.06, 0.03), Vector3(0.1, 0.12, 0.1), feather, 5)
			ball.call(head, Vector3(0, 0.13, 0.03), Vector3(0.03, 0.05, 0.06), Color(0.7, 0.18, 0.14), 4)
			ball.call(head, Vector3(0, 0.05, 0.09), Vector3(0.03, 0.03, 0.06), Color(0.8, 0.62, 0.25), 4)
		"dog":
			var fur = Color(0.4, 0.3, 0.2)
			legs.call(body, 0.1, 0.24, 0.32, 0.035, fur.darkened(0.15))
			ball.call(body, Vector3(0, 0.42, 0), Vector3(0.28, 0.28, 0.7), fur)
			var tail = CylinderMesh.new(); tail.top_radius = 0.015; tail.bottom_radius = 0.035; tail.height = 0.35; tail.radial_segments = 3; tail.rings = 1
			view._append(body, tail, Transform3D(Basis(Vector3.RIGHT, -0.7), Vector3(0, 0.55, -0.42)), fur)
			neck = Vector3(0, 0.52, 0.3)
			ball.call(head, Vector3(0, 0.06, 0.08), Vector3(0.22, 0.22, 0.24), fur, 6)
			ball.call(head, Vector3(0, 0.02, 0.22), Vector3(0.11, 0.1, 0.16), fur.darkened(0.25), 5)
			for s in [-1, 1]: ball.call(head, Vector3(0.08 * s, 0.17, 0.04), Vector3(0.05, 0.1, 0.04), fur.darkened(0.3), 4)
	body.generate_normals()
	head.generate_normals()
	var out = [body.commit(), head.commit(), neck]
	if kind != "hen": _beast_cache[kind] = out  # hens come in two colours
	return out


func _sync_beasts(dt: float) -> void:
	for b in _beasts:
		var n: Node3D = b.node
		var d: Vector3 = b.to - n.position
		d.y = 0
		var head: Node3D = b.head
		if d.length() < 0.1:
			b.wait -= dt
			# Grazing: the head down, now and then up to look about.
			var down = 0.6 if sin(_time * 0.4 + b.phase) > -0.3 else 0.0
			if b.kind == "hen": down = 0.9 if fmod(_time * 1.7 + b.phase, 1.6) < 0.25 else 0.0
			if b.kind == "dog": down = 0.0
			# A whole Meshy beast only dips a little; a built one lowers its head.
			if not head.has_meta("parts"): down *= 0.22
			head.rotation.x = lerpf(head.rotation.x, down, minf(1.0, dt * 3.0))
			n.position.y = view.ground_y(Vector2(n.position.x, n.position.z))
			if b.wait <= 0:
				var a = randf() * TAU
				b.to = b.home + Vector3(cos(a), 0, sin(a)) * sqrt(randf()) * b.radius
				b.wait = randf_range(3.0, 9.0) if b.kind != "dog" else randf_range(1.5, 5.0)
		else:
			head.rotation.x = lerpf(head.rotation.x, 0.0, minf(1.0, dt * 4.0))
			n.position += d.normalized() * minf(d.length(), dt * b.speed)
			var want = atan2(d.x, d.z)
			n.rotation.y = lerp_angle(n.rotation.y, want, minf(1.0, dt * 4.0))
			# A little bob in the stride.
			n.position.y = view.ground_y(Vector2(n.position.x, n.position.z)) + absf(sin(_time * (14.0 if b.kind == "hen" else 7.0) + b.phase)) * (0.03 if b.kind != "cow" else 0.02)


func _farm_life(farm: Dictionary, rng: RandomNumberGenerator) -> void:
	var at = _v3(farm.pos)
	# Sheep in a fold beside the fields, cows on the pasture, hens by the barn.
	var fold = at + Vector3(6.5, 0, 13.5)
	var wood = Color(0.4, 0.28, 0.16)
	var c = [fold + Vector3(-5, 0, -2.8), fold + Vector3(5, 0, -2.8), fold + Vector3(5, 0, 2.8), fold + Vector3(-5, 0, 2.8)]
	for k in 4:
		if k == 3: view._fence(self, c[3], c[3].lerp(c[0], 0.6), wood)
		else: view._fence(self, c[k], c[(k + 1) % 4], wood)
	for k in 6: _beast("sheep", fold + Vector3(rng.randf_range(-3.5, 3.5), 0, rng.randf_range(-2, 2)), fold, 3.0, rng)
	var pasture = at + Vector3(-11, 0, 9)
	for k in 2: _beast("cow", pasture + Vector3(rng.randf_range(-2, 2), 0, rng.randf_range(-2, 2)), pasture, 4.0, rng)
	var yard = at + Vector3(-1.5, 0, 0.3)
	for k in 5: _beast("hen", yard + Vector3(rng.randf_range(-1.5, 1.5), 0, rng.randf_range(-1, 1)), yard, 2.0, rng)
	# Smoke from the farmhouse, a cart and a woodpile in the yard.
	_smoke(self, at + Vector3(1.9, 3.4, -4.3), 0.8)
	view._prop(self, "world-cart", 2.4, at + Vector3(4.8, 0, -5.6), 2.2, true)
	view._prop(self, "world-barrels", 1.1, at + Vector3(3.6, 0, -2.6), 0.5)


func _lake_life(lake: Dictionary, rng: RandomNumberGenerator) -> void:
	var at = _v3(lake.pos)
	var water = at + Vector3(0, 0.07, -10)
	# Ducks paddling round, a fisherman at the end of the jetty.
	for k in 4:
		var n = Node3D.new()
		var mi = animal("duck")
		if mi:
			# Sat low in the water, its feet under.
			mi.position.y -= ANIMAL_HEIGHT.duck * 0.35
		else:
			mi = MeshInstance3D.new()
			mi.mesh = _duck_mesh()
			mi.material_override = _beast_mat()
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		n.add_child(mi)
		add_child(n)
		_ducks.append({"node": n, "center": water + Vector3(rng.randf_range(-3, 3), 0, rng.randf_range(-2, 2)), "radius": rng.randf_range(1.5, 3.5), "angle": rng.randf() * TAU, "speed": rng.randf_range(0.12, 0.22) * (1 if k % 2 == 0 else -1)})
	var u = view._unit({"body": "dwarf", "set": "leather"}, 0, "")
	u.position = at + Vector3(0.2, 0.24, -5.2)
	u.face(at + Vector3(0.2, 0.24, -10))
	u.play_idle()
	var rod = view._cyl(self, 0.01, 0.02, 2.6, at + Vector3(0.45, 1.3, -6.3), Color(0.45, 0.34, 0.2), 4, "")
	rod.rotation.x = -1.0
	var line = view._cyl(self, 0.004, 0.004, 1.3, at + Vector3(0.45, 1.25, -7.45), Color(0.8, 0.8, 0.75), 3, "")
	line.rotation.x = 0.0
	# A rack of fish drying by the shore, a boat drawn up on it, bushes and
	# cattails along the water.
	var wood = Color(0.4, 0.28, 0.17)
	var rack = at + Vector3(-4.5, 0, -1.2)
	for x in [-1.0, 1.0]: view._box(self, Vector3(0.1, 1.5, 0.1), rack + Vector3(x, 0.75, 0), wood)
	view._box(self, Vector3(2.2, 0.08, 0.08), rack + Vector3(0, 1.45, 0), wood)
	for k in 5:
		view._box(self, Vector3(0.1, 0.4, 0.05), rack + Vector3(-0.8 + k * 0.4, 1.2, 0), Color(0.62, 0.6, 0.52), 0.0, 0.5, "")
	# The boat lies keel up, like a little roof.
	var boat = MeshInstance3D.new()
	var hull = PrismMesh.new(); hull.size = Vector3(1.1, 0.5, 2.8)
	boat.mesh = hull
	boat.material_override = view._solid(Color(0.3, 0.2, 0.12))
	boat.position = at + Vector3(5.5, 0.25, -1.0)
	boat.rotation.y = 0.9
	add_child(boat)
	var cattails = []
	for k in 16:
		var a = rng.randf() * TAU
		var c = Vector2(lake.pos.x + cos(a) * 10.6, lake.pos.y - 10 + sin(a) * 7.6)
		if c.distance_to(lake.pos + Vector2(0, -3)) < 3.0: continue  # the jetty
		for j in 4: cattails.append(c + Vector2(rng.randf_range(-0.5, 0.5), rng.randf_range(-0.5, 0.5)))
	view._scatter(_cattail_mesh(), cattails, rng, 0.8, 1.3, view.wind_material(view._vc_material(0.9), 1.3, 0.08))
	# Fireflies over the reeds at night.
	_fireflies.append(_fireflies_at(at + Vector3(0, 0.7, -5), Vector3(26, 1.2, 14)))


func _duck_mesh() -> Mesh:
	if _beast_cache.has("duck"): return _beast_cache.duck
	var st = SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var s = SphereMesh.new(); s.radius = 0.5; s.height = 1.0; s.radial_segments = 6; s.rings = 3
	view._append(st, s, Transform3D(Basis().scaled(Vector3(0.34, 0.22, 0.52)), Vector3(0, 0.06, 0)), Color(0.45, 0.38, 0.3))
	view._append(st, s, Transform3D(Basis().scaled(Vector3(0.17, 0.18, 0.18)), Vector3(0, 0.25, 0.21)), Color(0.18, 0.32, 0.22))
	view._append(st, s, Transform3D(Basis().scaled(Vector3(0.08, 0.05, 0.12)), Vector3(0, 0.23, 0.33)), Color(0.85, 0.65, 0.25))
	st.generate_normals()
	_beast_cache.duck = st.commit()
	return _beast_cache.duck


func _cattail_mesh() -> Mesh:
	var st = SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for k in 3:
		var a = k * 2.1
		var p = Vector3(cos(a) * 0.12, 0, sin(a) * 0.12)
		var h = 1.0 + k * 0.2
		var s = CylinderMesh.new(); s.top_radius = 0.01; s.bottom_radius = 0.02; s.height = h; s.radial_segments = 3; s.rings = 1
		view._append(st, s, Transform3D(Basis(Vector3(sin(a), 0, -cos(a)), 0.08), p + Vector3(0, h * 0.5, 0)), Color(0.36, 0.42, 0.22))
		var top = CylinderMesh.new(); top.top_radius = 0.035; top.bottom_radius = 0.035; top.height = 0.2; top.radial_segments = 4; top.rings = 1
		view._append(st, top, Transform3D(Basis(), p + Vector3(0, h * 0.85, 0)), Color(0.34, 0.22, 0.13))
		var leaf = CylinderMesh.new(); leaf.top_radius = 0.0; leaf.bottom_radius = 0.03; leaf.height = 0.8; leaf.radial_segments = 3; leaf.rings = 1
		view._append(st, leaf, Transform3D(Basis(Vector3(-sin(a), 0, cos(a)), 0.3), p + Vector3(0, 0.38, 0)), Color(0.4, 0.46, 0.24))
	st.generate_normals()
	return st.commit()


func _fireflies_at(at: Vector3, box: Vector3) -> CPUParticles3D:
	var p = CPUParticles3D.new()
	p.amount = 28
	p.lifetime = 3.0
	p.position = at
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = box * 0.5
	p.direction = Vector3.UP
	p.spread = 180.0
	p.gravity = Vector3.ZERO
	p.initial_velocity_min = 0.05
	p.initial_velocity_max = 0.25
	var grad = Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.3, 0.7, 1.0])
	grad.colors = PackedColorArray([Color(0.55, 0.75, 0.15, 0), Color(0.55, 0.75, 0.15, 1), Color(0.5, 0.7, 0.12, 0.8), Color(0.5, 0.7, 0.12, 0)])
	p.color_ramp = grad
	var q = QuadMesh.new(); q.size = Vector2(0.22, 0.22)
	var m = StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA  # else the glow is a square
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = Unit.radial(Color(1, 1, 1, 1), Color(1, 1, 1, 0))
	q.material = m
	p.mesh = q
	p.visible = false
	add_child(p)
	return p


# ── the town ───────────────────────────────────────────────────────────────
func _town_life(rng: RandomNumberGenerator) -> void:
	var town = _v3(Game.w.layout().town)
	for k in 2: _beast("dog", town + Vector3(rng.randf_range(-5, 5), 0, rng.randf_range(-5, 5)), town, 9.0, rng)
	for k in 3: _beast("hen", town + Vector3(-12 + rng.randf_range(-1, 1), 0, 3 + rng.randf_range(-1, 1)), town + Vector3(-12, 0, 3), 1.8, rng)
	# Chimney smoke over the houses, the tavern and the forge.
	for h in [Vector2(0, -12), Vector2(12, 0), Vector2(-13, -1), Vector2(4, 12), Vector2(-5, 13)]:
		_smoke(self, town + Vector3(h.x, 3.6, h.y), 0.7)
	for p in Game.w.layout().places:
		match p.kind:
			"tavern": _smoke(self, _v3(p.pos, 6.2) + Vector3(1.8, 0, -0.8), 0.9)
			"smith": _smoke(self, _v3(p.pos, 4.6) + Vector3(-1.2, 0, -1.2), 1.1)
			"market":
				# Buyers at the counters (the awnings would hide the stallholders).
				var bodies = ["human", "dwarf", "elf"]
				var spots = [Vector3(-3.3, 0, 1.5), Vector3(0.3, 0, 0.1), Vector3(2.7, 0, 1.5)]
				for k in 3:
					var u = view._unit({"body": bodies[k], "set": ["leather", "arcane", "leather"][k]}, 0, "")
					u.position = _v3(p.pos) + spots[k]
					u.face(u.position + Vector3(0, 0, -1))
					u.play_idle()
	# Crates and barrels about the square.
	view._prop(self, "world-barrels", 1.2, town + Vector3(-4.5, 0, -10.5), 0.8)
	view._prop(self, "world-barrels", 1.1, town + Vector3(10.5, 0, 3.5), 2.0)
	for k in 3:
		view._box(self, Vector3(0.7, 0.7, 0.7), town + Vector3(-2.6 + (k % 2) * 0.75, 0.35 + (k / 2) * 0.7, -9.8), Color(0.5, 0.36, 0.2), 0.2 * k)


# ── folk on the road ───────────────────────────────────────────────────────
func _road_walkers(rng: RandomNumberGenerator) -> void:
	var road: Array = view._road_points()
	var specs = [{"body": "human", "set": "leather", "right": "staff"}, {"body": "dwarf", "set": "leather"}, {"body": "elf", "set": "arcane"}]
	for k in specs.size():
		var u = view._unit(specs[k], 0, "")
		var i = int(road.size() * (0.15 + 0.3 * k))
		# Each keeps to one side of the road, as travellers do.
		var dir = 1 if k % 2 == 0 else -1
		u.position = _v3(road[i] + (road[i + dir] - road[i]).normalized().orthogonal() * 0.8)
		u.play_idle()
		_walkers.append({"unit": u, "i": i, "dir": dir, "wait": rng.randf_range(0.5, 3.0), "moving": false, "side": 0.8})


func _sync_walkers(dt: float) -> void:
	var road: Array = view._road_points()
	for w in _walkers:
		var u: Unit = w.unit
		if w.wait > 0:
			w.wait -= dt
			if w.moving:
				u.play_idle(); w.moving = false
			continue
		var j = w.i + w.dir
		if j < 0 or j >= road.size():
			# The end of the road: a rest, then back the other way.
			w.dir = -w.dir
			w.wait = randf_range(4.0, 8.0)
			continue
		var seg: Vector2 = road[j] - road[w.i]
		var want = _v3(road[j] + seg.normalized().orthogonal() * w.side)
		var d = want - u.position
		d.y = 0
		if d.length() < 0.3:
			w.i = j
			if randf() < 0.012: w.wait = randf_range(2.0, 5.0)  # stops to look about
			continue
		if not w.moving:
			u.play_run(); w.moving = true
		u.position += d.normalized() * minf(d.length(), dt * 1.8)
		u.position.y = view.ground_y(Vector2(u.position.x, u.position.z))
		u.face(u.position + d)


# ── birds ──────────────────────────────────────────────────────────────────
## A flock wheeling round `center`: one MultiMesh, the wings beat in the shader.
func _flock(center: Vector3, radius: float, height: float, span: float, count: int, col: Color, rng: RandomNumberGenerator) -> void:
	var mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = _bird_mesh()
	mm.instance_count = count
	var mmi = MultiMeshInstance3D.new()
	mmi.multimesh = mm
	var m = ShaderMaterial.new()
	m.shader = BIRD
	m.set_shader_parameter("tint", col)
	mmi.material_override = m
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# Birds wheel far and wide; the box keeps them from being culled at the edges.
	mmi.custom_aabb = AABB(center - Vector3(radius + 6, height + 4, radius + 6), Vector3(radius + 6, height + 4, radius + 6) * 2.0)
	add_child(mmi)
	var birds = []
	for k in count: birds.append({"off": Vector3(rng.randf_range(-2.5, 2.5), rng.randf_range(-1.2, 1.2), rng.randf_range(-2.5, 2.5)), "lag": rng.randf_range(0, 0.5), "scale": span * rng.randf_range(0.85, 1.15)})
	_flocks.append({"mm": mm, "center": center, "radius": radius, "height": height, "speed": rng.randf_range(0.18, 0.3) * (1 if rng.randf() < 0.5 else -1), "angle": rng.randf() * TAU, "birds": birds})


func _bird_mesh() -> Mesh:
	if _beast_cache.has("bird"): return _beast_cache.bird
	# Two wings and a body in a shallow V, a metre across; +Z is ahead.
	var st = SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var tris = [
		[Vector3(0, 0, 0.25), Vector3(0, 0, -0.3), Vector3(-0.5, 0.06, -0.05)],
		[Vector3(0, 0, 0.25), Vector3(0.5, 0.06, -0.05), Vector3(0, 0, -0.3)],
		[Vector3(0, 0.02, 0.32), Vector3(0.06, 0, -0.1), Vector3(-0.06, 0, -0.1)],
	]
	for t in tris:
		for v in t:
			st.set_normal(Vector3.UP)
			st.add_vertex(v)
		for v in [t[0], t[2], t[1]]:
			st.set_normal(Vector3.DOWN)
			st.add_vertex(v)
	_beast_cache.bird = st.commit()
	return _beast_cache.bird


func _sync_flocks(dt: float) -> void:
	for f in _flocks:
		f.angle += dt * f.speed
		var mm: MultiMesh = f.mm
		for k in f.birds.size():
			var b = f.birds[k]
			var a: float = f.angle - b.lag * signf(f.speed)
			# The circle breathes in and out, so the flock does not run on rails.
			var r: float = f.radius * (1.0 + 0.25 * sin(a * 1.7 + k))
			var p: Vector3 = f.center + Vector3(cos(a) * r, f.height + sin(a * 2.3 + k) * 0.8, sin(a) * r) + b.off
			var ahead = Vector3(-sin(a), 0, cos(a)) * signf(f.speed)
			var basis = Basis.looking_at(-ahead, Vector3.UP).rotated(ahead, -0.35 * signf(f.speed))
			mm.set_instance_transform(k, Transform3D(basis.scaled(Vector3.ONE * b.scale), p))


# ── smoke ──────────────────────────────────────────────────────────────────
var _smoke_mesh: QuadMesh


## A thin column of grey smoke drifting off on the wind.
func _smoke(root: Node3D, at: Vector3, size: float) -> void:
	var p = CPUParticles3D.new()
	p.amount = 7
	p.lifetime = 5.0
	p.position = at
	p.direction = Vector3.UP
	p.spread = 8.0
	p.gravity = Vector3(0.18, 0.12, 0.08)
	p.initial_velocity_min = 0.35
	p.initial_velocity_max = 0.5
	p.scale_amount_min = size * 0.8
	p.scale_amount_max = size * 1.1
	var curve = Curve.new()
	curve.add_point(Vector2(0, 0.4))
	curve.add_point(Vector2(1, 2.2))
	p.scale_amount_curve = curve
	p.angle_min = 0.0
	p.angle_max = 360.0
	var grad = Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.15, 1.0])
	grad.colors = PackedColorArray([Color(0.7, 0.68, 0.64, 0), Color(0.62, 0.6, 0.57, 0.5), Color(0.6, 0.6, 0.6, 0)])
	p.color_ramp = grad
	if _smoke_mesh == null:
		_smoke_mesh = QuadMesh.new(); _smoke_mesh.size = Vector2(1, 1)
		var m = StandardMaterial3D.new()
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		m.vertex_color_use_as_albedo = true
		m.roughness = 1.0
		m.albedo_texture = Unit.radial(Color(1, 1, 1, 1), Color(1, 1, 1, 0))
		_smoke_mesh.material = m
	p.mesh = _smoke_mesh
	p.preprocess = 5.0
	root.add_child(p)


# ── frame ──────────────────────────────────────────────────────────────────
func _process(dt: float) -> void:
	if Game.w == null: return
	_time += dt
	_sync_beasts(dt)
	_sync_walkers(dt)
	_sync_flocks(dt)
	_sync_roamers(dt)
	for d in _ducks:
		d.angle += dt * d.speed
		var n: Node3D = d.node
		n.position = d.center + Vector3(cos(d.angle) * d.radius, sin(_time * 2.0 + d.radius) * 0.01, sin(d.angle) * d.radius)
		n.rotation.y = atan2(-sin(d.angle) * d.speed, cos(d.angle) * d.speed)
	var h: float = Game.w.hours
	var night = h > 20.5 or h < 5.0
	for f in _fireflies: f.visible = night


# ── the caravan, the patrol, the wolves ─────────────────────────────────────
## How each one looks, made on first sight: a horse drawing a cart with its
## trader walking beside it; three guards in a file; a pack of three wolves.
func _roamer_look(kind: String) -> Dictionary:
	var root = Node3D.new()
	add_child(root)
	var look = {"root": root, "units": [], "last": Vector2.INF, "moving": false, "beasts": []}
	match kind:
		"caravan":
			var horse = animal("horse")
			if horse:
				var holder = Node3D.new()
				holder.position.z = 1.6
				holder.add_child(horse)
				root.add_child(holder)
				look.beasts.append(holder)
			if not view._prop(root, "world-cart", 2.4, Vector3(0, 0, -1.1), 0.0, true):
				view._box(root, Vector3(1.4, 0.6, 2.2), Vector3(0, 0.7, -1.1), Color(0.45, 0.3, 0.17))
			var u = view._unit({"body": "human", "set": "leather", "right": "staff"}, 0, "")
			u.play_idle()
			look.units.append(u)
		"patrol":
			for k in 3:
				var u = view._unit({"body": "human", "right": "longsword", "left": "roundShield", "set": "knight"}, 0, "")
				u.play_idle()
				look.units.append(u)
		"wolves":
			for k in 3:
				var wolf = animal("wolf")
				if wolf == null: break
				var holder = Node3D.new()
				holder.position = Vector3(cos(k * 2.1) * 1.3, 0, sin(k * 2.1) * 1.3) * (0.0 if k == 0 else 1.0)
				holder.add_child(wolf)
				# Eyes that catch the light in the dark.
				for side in [-1.0, 1.0]:
					var eye = MeshInstance3D.new()
					var ball = SphereMesh.new(); ball.radius = 0.05; ball.height = 0.1; ball.radial_segments = 6; ball.rings = 3
					eye.mesh = ball
					var glow = StandardMaterial3D.new()
					glow.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
					glow.albedo_color = Color(1.0, 0.85, 0.35)
					eye.material_override = glow
					eye.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
					eye.position = Vector3(side * 0.07, ANIMAL_HEIGHT.wolf * 0.74, 0.5)
					holder.add_child(eye)
				root.add_child(holder)
				look.beasts.append(holder)
	_roamers[kind] = look
	return look


func _sync_roamers(dt: float) -> void:
	var w = Game.w
	for r in w.region_roamers():
		var look: Dictionary = _roamers[r.kind] if _roamers.has(r.kind) else _roamer_look(r.kind)
		var root: Node3D = look.root
		var shown = view.seen(r.pos) and (r.kind != "wolves" or w.wolves_out())
		root.visible = shown
		for u in look.units: u.visible = shown
		if not shown:
			look.last = r.pos
			continue
		var step: Vector2 = r.pos - look.last if look.last != Vector2.INF else Vector2.ZERO
		look.last = r.pos
		var moving = step.length() > 0.001
		root.position = _v3(r.pos)
		if moving: root.rotation.y = lerp_angle(root.rotation.y, atan2(step.x, step.y), minf(1.0, dt * 5.0))
		var ahead = Vector2(sin(root.rotation.y), cos(root.rotation.y))
		for k in look.beasts.size():
			var b: Node3D = look.beasts[k]
			# A stride's bob; the wolves lope.
			var bob = absf(sin(_time * (9.0 if r.kind == "wolves" else 5.0) + k * 1.7)) * (0.06 if r.kind == "wolves" else 0.03)
			b.position.y = (bob if moving else 0.0) + (view.ground_y(r.pos + ahead * b.position.z) - root.position.y if r.kind == "caravan" else 0.0)
		for k in look.units.size():
			var u: Unit = look.units[k]
			# The trader walks at the horse's side; the guards keep a file.
			var at: Vector2 = r.pos + ahead.orthogonal() * 1.3 + ahead * 0.8 if r.kind == "caravan" else r.pos - ahead * (k * 1.5)
			u.position = _v3(at)
			u.face(u.position + Vector3(ahead.x, 0, ahead.y))
		if moving != look.moving:
			look.moving = moving
			for u in look.units:
				if moving: u.play_run()
				else: u.play_idle()

