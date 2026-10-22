class_name WorldView
extends Node3D
## The open map in 3D, drawn from Game.w: the land's ground and road, woods
## and rocks, its town, dungeon gates, chests, gathering spots and signposts,
## the squad walking in file behind its leader, and the roaming bands. The sun
## follows the hour; at night a torch goes with the squad. Tap the ground to
## walk there, a place to go to it, a band to go at it. Drag turns the view,
## pinch or wheel zooms, Q/E turn, R straightens.

const FONT := preload("res://fonts/AlegreyaSC_700Bold.ttf")
const BODY_FONT := preload("res://fonts/Alegreya_500Medium.ttf")
const FILE_GAP := 1.5

signal place_tapped(id: String)

var env: Environment
var sun: DirectionalLight3D
var moon: DirectionalLight3D
var torch: OmniLight3D
var cam: Camera3D
var party: Array[Unit] = []
var band_units = {}     # band id -> [Unit]
var band_labels = {}
var place_nodes = {}    # place id -> Node3D (chests and herbs change look)
var marker: MeshInstance3D
var band_top = 0.0
var band_bottom = 0.0

var yaw = 0.6
var _yaw_target = 0.6
var pitch = 46.0
var _pitch_target = 46.0
var zoom = 1.0
var _zoom_target = 1.0
var _focus = Vector3.ZERO
var _trail: Array[Vector3] = []
var _moving = false
var _press_at = Vector2.ZERO
var _dragged = false
var _touches = {}
var _pinch0 = 0.0
var _zoom0 = 1.0


func _ready() -> void:
	var w = Game.w
	var th: Dictionary = w.theme()
	_build_env(th)
	_build_ground(th)
	_build_road(th)
	_build_woods(th)
	_build_places(th)
	_build_party()
	marker = _ring_mesh(0.7, Color(1, 0.85, 0.5, 0.8))
	marker.visible = false
	add_child(marker)
	cam = Camera3D.new()
	cam.fov = 50.0
	cam.far = 260.0
	add_child(cam)
	cam.make_current()
	_focus = Vector3(w.pos.x, 0, w.pos.y)
	apply_quality(Game.settings.quality)
	_process(0.0)


func apply_quality(q: String) -> void:
	sun.shadow_enabled = q != "low"
	env.glow_enabled = q == "high"


# ── the land ───────────────────────────────────────────────────────────────
func _build_env(th: Dictionary) -> void:
	var sky_mat = ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = th.sky.darkened(0.25)
	sky_mat.sky_horizon_color = th.fog
	sky_mat.ground_horizon_color = th.fog.darkened(0.2)
	sky_mat.ground_bottom_color = th.ground.darkened(0.5)
	var sky = Sky.new()
	sky.sky_material = sky_mat
	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = th.sky.lerp(th.fog, 0.5)
	env.ambient_light_energy = 0.45
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.95
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.08
	env.adjustment_saturation = 0.95
	env.fog_enabled = true
	env.fog_light_color = th.fog
	env.fog_density = 0.008
	env.glow_intensity = 0.6
	var we = WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.light_energy = 1.2
	sun.directional_shadow_max_distance = 45.0
	sun.shadow_blur = 1.5
	add_child(sun)
	moon = DirectionalLight3D.new()
	moon.light_color = Color(0.55, 0.65, 0.95)
	moon.rotation_degrees = Vector3(-55, -60, 0)
	add_child(moon)
	torch = OmniLight3D.new()
	torch.light_color = Color(1.0, 0.62, 0.3)
	torch.omni_range = 9.0
	torch.light_energy = 0.0
	add_child(torch)


## A flat field with patches of two tints, rising into hills past the edge.
func _build_ground(th: Dictionary) -> void:
	var n = 64
	var half = World.SIZE + 30.0
	var noise = FastNoiseLite.new()
	noise.seed = hash(Game.w.region)
	noise.frequency = 0.035
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts = []
	for j in n + 1:
		for i in n + 1:
			var x = -half + 2.0 * half * i / n
			var z = -half + 2.0 * half * j / n
			var edge = maxf(absf(x), absf(z)) - World.SIZE
			var y = 0.0
			if edge > 0: y = edge * 0.35 + noise.get_noise_2d(x * 2, z * 2) * edge * 0.25
			var t = clampf(noise.get_noise_2d(x, z) * 0.9 + 0.5, 0, 1)
			pts.append([Vector3(x, y, z), th.ground.lerp(th.ground2, t).darkened(clampf(edge * 0.01, 0, 0.3))])
	for j in n:
		for i in n:
			var a = j * (n + 1) + i
			for k in [a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1]:
				st.set_color(pts[k][1])
				st.add_vertex(pts[k][0])
	st.generate_normals()
	var mi = MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = _vc_material(0.95)
	add_child(mi)


func _build_road(th: Dictionary) -> void:
	var road: Array = Game.w.layout().road
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in road.size() - 1:
		var a: Vector2 = road[i]
		var b: Vector2 = road[i + 1]
		# A gentle bend through a midpoint, in short pieces.
		var mid = (a + b) * 0.5 + (b - a).orthogonal().normalized() * (a.distance_to(b) * 0.12 * (1 if i % 2 == 0 else -1))
		var prev = a
		for s in range(1, 13):
			var t = s / 12.0
			var p = a.lerp(mid, t).lerp(mid.lerp(b, t), t)
			_road_piece(st, prev, p, th.road)
			prev = p
	var mi = MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = _vc_material(1.0)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


func _road_piece(st: SurfaceTool, a: Vector2, b: Vector2, col: Color) -> void:
	var side = (b - a).orthogonal().normalized() * 1.6
	var y = 0.03
	var q = [Vector3(a.x + side.x, y, a.y + side.y), Vector3(a.x - side.x, y, a.y - side.y), Vector3(b.x - side.x, y, b.y - side.y), Vector3(b.x + side.x, y, b.y + side.y)]
	for k in [0, 2, 1, 0, 3, 2]:
		st.set_color(col)
		st.set_normal(Vector3.UP)
		st.add_vertex(q[k])


func _near_road(p: Vector2, gap: float) -> bool:
	var road: Array = Game.w.layout().road
	for i in road.size() - 1:
		if Geometry2D.get_closest_point_to_segment(p, road[i], road[i + 1]).distance_to(p) < gap: return true
	return false


## Woods and rocks, scattered clear of the road and the places.
func _build_woods(th: Dictionary) -> void:
	var rng = RandomNumberGenerator.new()
	rng.seed = hash(Game.w.region) + 3
	var places: Array = Game.w.layout().places
	var spots = []
	for _i in 1100:
		var p = Vector2(rng.randf_range(-World.SIZE - 20, World.SIZE + 20), rng.randf_range(-World.SIZE - 20, World.SIZE + 20))
		var inside = absf(p.x) < World.SIZE and absf(p.y) < World.SIZE
		if inside and rng.randf() < 0.3: continue
		if _near_road(p, 4.0) or places.any(func(q): return q.pos.distance_to(p) < 7.0): continue
		spots.append(p)
	var trees = spots.slice(0, int(spots.size() * 0.8))
	var rocks = spots.slice(int(spots.size() * 0.8))
	_scatter(_tree_mesh(th), trees, rng, 0.8, 1.5)
	_scatter(_rock_mesh(th), rocks, rng, 0.6, 1.6)
	var tufts = []
	for _i in 1600:
		var p = Vector2(rng.randf_range(-World.SIZE, World.SIZE), rng.randf_range(-World.SIZE, World.SIZE))
		if not _near_road(p, 2.0): tufts.append(p)
	_scatter(_tuft_mesh(th), tufts, rng, 0.6, 1.3)


func _scatter(mesh: Mesh, at: Array, rng: RandomNumberGenerator, lo: float, hi: float) -> void:
	var mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = at.size()
	for i in at.size():
		var p: Vector2 = at[i]
		var edge = maxf(absf(p.x), absf(p.y)) - World.SIZE
		var y = maxf(0.0, edge) * 0.35
		var t = Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(lo, hi)), Vector3(p.x, y, p.y))
		mm.set_instance_transform(i, t)
	var mmi = MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = _vc_material(0.9)
	add_child(mmi)


func _tree_mesh(th: Dictionary) -> Mesh:
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var bark = Color(0.28, 0.2, 0.14)
	var trunk = CylinderMesh.new(); trunk.top_radius = 0.12; trunk.bottom_radius = 0.2; trunk.height = 1.6; trunk.radial_segments = 6
	_append(st, trunk, Transform3D(Basis(), Vector3(0, 0.8, 0)), bark)
	match th.tree:
		"pine":
			for k in 3:
				var c = CylinderMesh.new(); c.top_radius = 0.0; c.bottom_radius = 1.3 - k * 0.32; c.height = 1.6; c.radial_segments = 7
				_append(st, c, Transform3D(Basis(), Vector3(0, 1.6 + k * 0.85, 0)), th.leaf.lightened(k * 0.06))
		"round":
			var s = SphereMesh.new(); s.radius = 1.2; s.height = 2.1; s.radial_segments = 8; s.rings = 5
			_append(st, s, Transform3D(Basis(), Vector3(0, 2.4, 0)), th.leaf)
			var s2 = SphereMesh.new(); s2.radius = 0.8; s2.height = 1.4; s2.radial_segments = 7; s2.rings = 4
			_append(st, s2, Transform3D(Basis(), Vector3(0.6, 2.9, 0.2)), th.leaf.lightened(0.08))
		_:
			for k in 3:
				var br = CylinderMesh.new(); br.top_radius = 0.02; br.bottom_radius = 0.08; br.height = 1.1; br.radial_segments = 5
				var basis = Basis(Vector3.UP, k * 2.1).rotated(Vector3(cos(k * 2.1), 0, sin(k * 2.1)), 0.7)
				_append(st, br, Transform3D(basis, Vector3(0, 1.3 + k * 0.15, 0)), bark.lightened(0.05))
	st.generate_normals()
	return st.commit()


func _tuft_mesh(th: Dictionary) -> Mesh:
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var col: Color = th.ground2.lerp(th.leaf, 0.5).darkened(0.1)
	for k in 4:
		var blade = CylinderMesh.new(); blade.top_radius = 0.0; blade.bottom_radius = 0.07; blade.height = 0.45; blade.radial_segments = 3
		var basis = Basis(Vector3(cos(k * 1.6), 0, sin(k * 1.6)), 0.35)
		_append(st, blade, Transform3D(basis, Vector3(cos(k * 1.6) * 0.12, 0.2, sin(k * 1.6) * 0.12)), col.lightened(k * 0.04))
	st.generate_normals()
	return st.commit()


func _rock_mesh(th: Dictionary) -> Mesh:
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var s = SphereMesh.new(); s.radius = 0.7; s.height = 0.9; s.radial_segments = 6; s.rings = 3
	_append(st, s, Transform3D(Basis().scaled(Vector3(1.2, 0.8, 1.0)), Vector3(0, 0.25, 0)), th.rock)
	var s2 = SphereMesh.new(); s2.radius = 0.45; s2.height = 0.6; s2.radial_segments = 5; s2.rings = 3
	_append(st, s2, Transform3D(Basis(), Vector3(0.6, 0.15, 0.3)), th.rock.darkened(0.1))
	st.generate_normals()
	return st.commit()


func _append(st: SurfaceTool, m: PrimitiveMesh, t: Transform3D, col: Color) -> void:
	var arr = m.get_mesh_arrays()
	var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	for i in idx:
		st.set_color(col)
		st.add_vertex(t * verts[i])


func _vc_material(rough: float) -> StandardMaterial3D:
	var m = StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.roughness = rough
	return m


func _solid(col: Color, rough := 0.9, emit := Color.BLACK) -> StandardMaterial3D:
	var m = StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = rough
	if emit != Color.BLACK:
		m.emission_enabled = true
		m.emission = emit
	return m


# ── places ─────────────────────────────────────────────────────────────────
func _build_places(th: Dictionary) -> void:
	for p in Game.w.layout().places:
		var root = Node3D.new()
		root.position = Vector3(p.pos.x, 0, p.pos.y)
		add_child(root)
		place_nodes[p.id] = root
		match p.kind:
			"town": _town(root, th)
			"dungeon": _gate(root, p)
			"chest": _chest(root)
			"herb": _herb(root, th)
			"road": _signpost(root, p)
	refresh_places()


func _label(root: Node3D, text: String, y: float, col: Color, size := 64) -> Label3D:
	var l = Label3D.new()
	l.text = text
	l.font = FONT
	l.font_size = size
	l.pixel_size = 0.012
	l.modulate = col
	l.outline_size = 14
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.position = Vector3(0, y, 0)
	root.add_child(l)
	return l


func _house(root: Node3D, at: Vector3, w: float, d: float, turn: float, wall: Color, roof: Color) -> void:
	var h = Node3D.new()
	h.position = at
	h.rotation.y = turn
	root.add_child(h)
	var body = MeshInstance3D.new()
	var b = BoxMesh.new(); b.size = Vector3(w, 1.8, d)
	body.mesh = b
	body.material_override = _solid(wall)
	body.position.y = 0.9
	h.add_child(body)
	var top = MeshInstance3D.new()
	var pr = PrismMesh.new(); pr.size = Vector3(w + 0.4, 1.3, d + 0.3)
	top.mesh = pr
	top.material_override = _solid(roof)
	top.position.y = 2.45
	h.add_child(top)
	var door = MeshInstance3D.new()
	var dm = BoxMesh.new(); dm.size = Vector3(0.6, 1.0, 0.05)
	door.mesh = dm
	door.material_override = _solid(Color(0.22, 0.14, 0.08))
	door.position = Vector3(0, 0.5, d * 0.5 + 0.02)
	h.add_child(door)
	var win = MeshInstance3D.new()
	var wm = BoxMesh.new(); wm.size = Vector3(0.45, 0.4, 0.05)
	win.mesh = wm
	win.material_override = _solid(Color(1, 0.75, 0.4), 0.5, Color(1.0, 0.6, 0.25))
	win.position = Vector3(w * 0.3, 1.2, d * 0.5 + 0.02)
	h.add_child(win)


func _town(root: Node3D, th: Dictionary) -> void:
	var wall = Color(0.62, 0.55, 0.45)
	var roof = Color(0.45, 0.2, 0.15) if th.tree != "pine" else Color(0.35, 0.3, 0.28)
	var spots = [[Vector3(-3.5, 0, -2.5), 0.3], [Vector3(3.2, 0, -3.0), -0.4], [Vector3(-4.0, 0, 3.0), 2.8], [Vector3(3.8, 0, 2.8), 3.5], [Vector3(0, 0, -5.5), 0.0]]
	for i in spots.size():
		_house(root, spots[i][0], 2.6 + (i % 2) * 0.6, 2.2, spots[i][1], wall.darkened(0.06 * i), roof)
	var well = MeshInstance3D.new()
	var c = CylinderMesh.new(); c.top_radius = 0.7; c.bottom_radius = 0.75; c.height = 0.7
	well.mesh = c
	well.material_override = _solid(th.rock)
	well.position.y = 0.35
	root.add_child(well)
	var lamp = OmniLight3D.new()
	lamp.light_color = Color(1.0, 0.65, 0.3)
	lamp.light_energy = 1.4
	lamp.omni_range = 10.0
	lamp.position = Vector3(0, 2.5, 0)
	root.add_child(lamp)
	_label(root, th.town, 5.2, Color(0.95, 0.86, 0.62))


## A dungeon's mouth: two standing stones under a lintel, a dark way in.
func _gate(root: Node3D, p: Dictionary) -> void:
	var stone = _solid(Color(0.36, 0.34, 0.32))
	for x in [-1.3, 1.3]:
		var post = MeshInstance3D.new()
		var b = BoxMesh.new(); b.size = Vector3(0.7, 3.0, 0.7)
		post.mesh = b; post.material_override = stone
		post.position = Vector3(x, 1.5, 0)
		root.add_child(post)
	var lintel = MeshInstance3D.new()
	var lb = BoxMesh.new(); lb.size = Vector3(3.6, 0.6, 0.9)
	lintel.mesh = lb; lintel.material_override = stone
	lintel.position = Vector3(0, 3.2, 0)
	root.add_child(lintel)
	var dark = MeshInstance3D.new()
	var db = BoxMesh.new(); db.size = Vector3(1.9, 2.9, 0.2)
	dark.mesh = db; dark.material_override = _solid(Color(0.02, 0.02, 0.03), 1.0)
	dark.position = Vector3(0, 1.45, 0)
	root.add_child(dark)
	for x in [-2.4, 2.4]:
		var br: Node3D = load("res://assets/models/decor-brazier.glb").instantiate()
		br.scale = Vector3.ONE * 0.7
		br.position = Vector3(x, 0.55, 1.2)
		root.add_child(br)
		_fire(root, Vector3(x, 1.3, 1.2))
	var flag: Node3D = load("res://assets/models/decor-banner.glb").instantiate()
	flag.scale = Vector3.ONE * 1.2
	flag.position = Vector3(-3.4, 1.05, -0.6)
	root.add_child(flag)
	var d = DB.dungeon(p.dungeon)
	var l = _label(root, d.name, 4.6, Color(0.95, 0.86, 0.62), 56)
	root.set_meta("label", l)


func _fire(root: Node3D, at: Vector3) -> void:
	var p = CPUParticles3D.new()
	p.amount = 16
	p.lifetime = 0.6
	p.position = at
	p.direction = Vector3.UP
	p.spread = 15.0
	p.gravity = Vector3(0, 1.4, 0)
	p.initial_velocity_min = 0.3
	p.initial_velocity_max = 0.7
	var grad = Gradient.new()
	grad.colors = PackedColorArray([Color(1.0, 0.85, 0.4, 1), Color(1.0, 0.4, 0.1, 0.7), Color(0.4, 0.1, 0.05, 0)])
	p.color_ramp = grad
	var q = QuadMesh.new(); q.size = Vector2(0.25, 0.25)
	var m = StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = Unit.radial(Color(1, 1, 1, 1), Color(1, 1, 1, 0))
	q.material = m
	p.mesh = q
	root.add_child(p)
	var l = OmniLight3D.new()
	l.light_color = Color(1.0, 0.55, 0.22)
	l.light_energy = 1.6
	l.omni_range = 6.0
	l.position = at + Vector3(0, 0.3, 0)
	root.add_child(l)


func _chest(root: Node3D) -> void:
	var box = MeshInstance3D.new()
	var b = BoxMesh.new(); b.size = Vector3(0.9, 0.55, 0.6)
	box.mesh = b
	box.material_override = _solid(Color(0.42, 0.26, 0.12))
	box.position.y = 0.28
	root.add_child(box)
	var band = MeshInstance3D.new()
	var bb = BoxMesh.new(); bb.size = Vector3(0.95, 0.1, 0.65)
	band.mesh = bb
	band.material_override = _solid(Color(0.85, 0.68, 0.3), 0.4)
	band.position.y = 0.45
	root.add_child(band)
	var shine = OmniLight3D.new()
	shine.light_color = Color(1.0, 0.85, 0.45)
	shine.light_energy = 0.9
	shine.omni_range = 3.0
	shine.position.y = 0.9
	root.add_child(shine)
	root.set_meta("shine", shine)


func _herb(root: Node3D, th: Dictionary) -> void:
	for k in 5:
		var s = MeshInstance3D.new()
		var sm = SphereMesh.new(); sm.radius = 0.35; sm.height = 0.5
		s.mesh = sm
		s.material_override = _solid(th.leaf.lightened(0.25), 0.8)
		s.position = Vector3(cos(k * 1.3) * 0.6, 0.2, sin(k * 1.3) * 0.6)
		root.add_child(s)
	var bloom = MeshInstance3D.new()
	var bm = SphereMesh.new(); bm.radius = 0.16; bm.height = 0.3
	bloom.mesh = bm
	bloom.material_override = _solid(Color(0.9, 0.85, 0.4), 0.5, Color(0.8, 0.7, 0.2))
	bloom.position.y = 0.55
	root.add_child(bloom)
	root.set_meta("bloom", bloom)


func _signpost(root: Node3D, p: Dictionary) -> void:
	var wood = _solid(Color(0.36, 0.25, 0.15))
	var pole = MeshInstance3D.new()
	var c = CylinderMesh.new(); c.top_radius = 0.08; c.bottom_radius = 0.1; c.height = 2.4
	pole.mesh = c; pole.material_override = wood
	pole.position.y = 1.2
	root.add_child(pole)
	var board = MeshInstance3D.new()
	var b = BoxMesh.new(); b.size = Vector3(1.4, 0.35, 0.08)
	board.mesh = b; board.material_override = wood
	board.position = Vector3(0.5 if p.id == "east" else -0.5, 2.0, 0)
	root.add_child(board)
	var name: String = DB.locations[Game.w.location_index(p.to)].name
	var l = _label(root, ("%s →" if p.id == "east" else "← %s") % name, 3.2, Color(0.9, 0.85, 0.7), 48)
	root.set_meta("label", l)


## Chests opened, spots picked, dungeons locked or cleared: the look of each place.
func refresh_places() -> void:
	var w = Game.w
	for p in w.layout().places:
		var root: Node3D = place_nodes[p.id]
		match p.kind:
			"chest":
				root.visible = not w.opened.has(p.id)
			"herb":
				(root.get_meta("bloom") as Node3D).visible = w.herb_ready(p.id)
			"dungeon":
				var l: Label3D = root.get_meta("label")
				var open: bool = Game.is_dungeon_unlocked(p.dungeon)
				var done: bool = Game.defeated.has(p.dungeon)
				l.modulate = Color(0.95, 0.86, 0.62) if open and not done else (Color(0.6, 0.8, 0.55) if done else Color(0.55, 0.52, 0.5))
				l.text = DB.dungeon(p.dungeon).name + (" ✓" if done else ("" if open else " (закрыто)"))
			"road":
				var l: Label3D = root.get_meta("label")
				l.modulate = Color(0.9, 0.85, 0.7) if w.region_open(p.to) else Color(0.55, 0.52, 0.5)


# ── the squad and the bands ────────────────────────────────────────────────
func _unit(spec: Dictionary, team: int, name: String) -> Unit:
	var u = Unit.new()
	var sp = spec.duplicate()
	sp.team = team; sp.name = name; sp.role = "melee"; sp.hp = 100; sp.atk = Vector2i(1, 1); sp.init = 1
	add_child(u)
	u.setup(sp)
	u.set_bar_visible(false)
	return u


func _build_party() -> void:
	var w = Game.w
	var squad: Array = Game.squad()
	for i in squad.size():
		var c: Dictionary = squad[i]
		var spec: Dictionary = BattleView.HEROES.get(c.id, {"body": "human"}).duplicate()
		var m = DB.armour_of(c.equipment.get("chest", "none"))
		var set_id = m.set.id if m else DB.armour.STARTING_OUTFITS.get(str(c.id))
		if set_id: spec.set = set_id
		var u = _unit(spec, 0, c.name)
		u.position = Vector3(w.pos.x - i * FILE_GAP, 0, w.pos.y)
		u.play_idle()
		party.append(u)
	# The file starts strung out behind the leader.
	for i in 40: _trail.append(Vector3(w.pos.x - i * 0.5, 0, w.pos.y))
	for i in party.size(): party[i].position = _along_trail(i * FILE_GAP)


func _band_units(b: Dictionary) -> Array:
	if band_units.has(b.id): return band_units[b.id]
	var kinds = ["brute", "archer", "shaman"]
	var list = []
	for k in b.size:
		var u = _unit(BattleView.FOES[kinds[k % kinds.size()]], 1, b.name)
		u.play_idle()
		list.append(u)
	band_units[b.id] = list
	var l = Label3D.new()
	l.font = BODY_FONT
	l.font_size = 44
	l.pixel_size = 0.012
	l.outline_size = 12
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.text = b.name
	add_child(l)
	band_labels[b.id] = l
	return list


func _sync_bands() -> void:
	var w = Game.w
	var live = {}
	for b in w.region_bands():
		live[b.id] = true
		var us = _band_units(b)
		var center = Vector3(b.pos.x, 0, b.pos.y)
		var moving: bool = b.chasing or b.pos.distance_to(b.to) > 0.2
		for k in us.size():
			var u: Unit = us[k]
			u.visible = true
			var want = center + Vector3(cos(k * 2.3) * 1.1, 0, sin(k * 2.3) * 1.1) * (0.0 if k == 0 else 1.0)
			var d = want - u.position
			if d.length() > 0.05:
				u.position += d * minf(1.0, get_process_delta_time() * 6.0)
				u.face(u.position + d)
			var was = u.get_meta("moving", false)
			if moving != was:
				if moving: u.play_run()
				else: u.play_idle()
				u.set_meta("moving", moving)
			u.set_ring(b.chasing, Color(1, 0.3, 0.25))
		var l: Label3D = band_labels[b.id]
		l.visible = true
		l.position = center + Vector3(0, 2.9, 0)
		l.modulate = Color(1, 0.45, 0.4) if b.chasing else Color(0.9, 0.8, 0.7)
	for id in band_units:
		if not live.has(id):
			for u in band_units[id]: u.visible = false
			band_labels[id].visible = false


func _sync_party(dt: float) -> void:
	var w = Game.w
	var lead = Vector3(w.pos.x, 0, w.pos.y)
	if _trail[0].distance_to(lead) > 0.25: _trail.push_front(lead)
	while _trail.size() > 60: _trail.pop_back()
	var moving = w.target != null
	for i in party.size():
		var u: Unit = party[i]
		var want: Vector3 = lead if i == 0 else _along_trail(i * FILE_GAP)
		var d = want - u.position
		if d.length() > 0.02:
			u.position = want if i == 0 else u.position + d * minf(1.0, dt * 8.0)
			if d.length() > 0.03: u.face(u.position + d)
	if moving != _moving:
		_moving = moving
		for u in party:
			if moving: u.play_run()
			else: u.play_idle()
	marker.visible = moving
	if moving: marker.position = Vector3(w.target.x, 0.05, w.target.y)


func _along_trail(dist: float) -> Vector3:
	var left = dist
	for i in _trail.size() - 1:
		var seg = _trail[i].distance_to(_trail[i + 1])
		if seg >= left: return _trail[i].lerp(_trail[i + 1], left / seg)
		left -= seg
	return _trail.back()


func _ring_mesh(r: float, col: Color) -> MeshInstance3D:
	var mi = MeshInstance3D.new()
	var t = TorusMesh.new(); t.inner_radius = r * 0.8; t.outer_radius = r; t.rings = 24
	mi.mesh = t
	var m = StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = col
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = m
	mi.scale.y = 0.1
	return mi


# ── the sky over the hour ──────────────────────────────────────────────────
func _sync_sky() -> void:
	var w = Game.w
	var h: float = w.hours
	var up = sin((h - 6.0) / 12.0 * PI)          # 1 at noon, below 0 at night
	var day = clampf(up * 1.6 + 0.25, 0.0, 1.0)
	sun.rotation_degrees = Vector3(-10 - 60 * maxf(up, 0.0), (h - 12.0) * 12.0, 0)
	sun.light_energy = 1.05 * day
	sun.light_color = Color(1.0, 0.72, 0.5).lerp(Color(1.0, 0.95, 0.85), clampf(up, 0, 1))
	moon.light_energy = 0.35 * (1.0 - day)
	env.ambient_light_energy = lerpf(0.18, 0.45, day)
	env.background_energy_multiplier = lerpf(0.18, 1.0, day)
	var th: Dictionary = w.theme()
	env.fog_light_color = Color(0.12, 0.14, 0.22).lerp(th.fog, day)
	torch.light_energy = 2.4 * (1.0 - day)


# ── frame, camera, touch ───────────────────────────────────────────────────
func _process(delta: float) -> void:
	if Game.w == null: return
	_sync_party(delta)
	_sync_bands()
	_sync_sky()
	var lead = Vector3(Game.w.pos.x, 0, Game.w.pos.y)
	_focus = _focus.lerp(lead, 1.0 - exp(-delta * 5.0))
	torch.position = lead + Vector3(0, 2.2, 0)
	zoom = lerpf(zoom, _zoom_target, 1.0 - exp(-delta * 10.0))
	yaw = lerp_angle(yaw, _yaw_target, 1.0 - exp(-delta * 10.0))
	pitch = lerpf(pitch, _pitch_target, 1.0 - exp(-delta * 10.0))
	var dist = 15.0 * zoom
	var pr = deg_to_rad(pitch)
	cam.position = _focus + Vector3(sin(yaw) * cos(pr), sin(pr), cos(yaw) * cos(pr)) * dist
	cam.look_at(_focus + Vector3(0, 0.8, 0))
	var vp = get_viewport().get_visible_rect().size
	if vp.y > 0 and not App.wide:
		var vfov = deg_to_rad(cam.fov)
		var view_h = 2.0 * dist * tan(vfov * 0.5)
		var mid = (band_top + (vp.y - band_bottom)) * 0.5 / vp.y
		cam.v_offset = (mid - 0.5) * view_h
	else:
		cam.v_offset = 0.0


func turn(deg: float) -> void:
	_yaw_target += deg_to_rad(deg)


func zoom_by(f: float) -> void:
	_zoom_target = clampf(_zoom_target * f, 0.5, 2.4)


func reset_camera() -> void:
	_yaw_target = yaw - wrapf(yaw - 0.6, -PI, PI)
	_pitch_target = 46.0
	_zoom_target = 1.0


func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventScreenTouch:
		if ev.pressed: _touches[ev.index] = ev.position
		else: _touches.erase(ev.index)
		if _touches.size() == 2:
			var p: Array = _touches.values()
			_pinch0 = p[0].distance_to(p[1])
			_zoom0 = _zoom_target
	elif ev is InputEventScreenDrag:
		_touches[ev.index] = ev.position
		if _touches.size() == 2 and _pinch0 > 0:
			var p: Array = _touches.values()
			_zoom_target = clampf(_zoom0 * _pinch0 / maxf(1.0, p[0].distance_to(p[1])), 0.5, 2.4)
			_dragged = true
	elif ev is InputEventMouseButton:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP: zoom_by(0.9)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN: zoom_by(1.1)
		elif ev.button_index == MOUSE_BUTTON_LEFT:
			if ev.pressed:
				_press_at = ev.position
				_dragged = false
			elif not _dragged and _touches.size() <= 1:
				_tap(ev.position)
	elif ev is InputEventMouseMotion and ev.button_mask & (MOUSE_BUTTON_MASK_RIGHT | MOUSE_BUTTON_MASK_MIDDLE):
		_drag(ev.relative)
	elif ev is InputEventMouseMotion and ev.button_mask & MOUSE_BUTTON_MASK_LEFT and _touches.size() <= 1:
		if ev.position.distance_to(_press_at) > 14: _dragged = true
		if _dragged: _drag(ev.relative)
	elif ev is InputEventKey and ev.pressed:
		var done = true
		match ev.keycode:
			KEY_Q: turn(-45.0)
			KEY_E: turn(45.0)
			KEY_R: reset_camera()
			KEY_EQUAL, KEY_KP_ADD: zoom_by(0.85)
			KEY_MINUS, KEY_KP_SUBTRACT: zoom_by(1.18)
			_: done = false
		if done: get_viewport().set_input_as_handled()


func _drag(rel: Vector2) -> void:
	_yaw_target -= rel.x * 0.006
	yaw = _yaw_target
	_pitch_target = clampf(_pitch_target + rel.y * 0.12, 28.0, 78.0)
	pitch = _pitch_target


## A tap: on a band, go at it; near a place, go to it; else walk there.
func _tap(at: Vector2) -> void:
	var w = Game.w
	var vp = get_viewport().get_visible_rect().size
	var reach = 60.0 * minf(vp.x, vp.y) / 720.0
	for b in w.region_bands():
		var c = Vector3(b.pos.x, 1.0, b.pos.y)
		if not cam.is_position_behind(c) and cam.unproject_position(c).distance_to(at) < reach:
			w.walk_to(b.pos)
			return
	var from = cam.project_ray_origin(at)
	var dir = cam.project_ray_normal(at)
	if dir.y > -1e-3: return
	var hit = from + dir * (-from.y / dir.y)
	var ground = Vector2(hit.x, hit.z)
	var best = null
	for p in w.layout().places:
		var screen_p = cam.unproject_position(Vector3(p.pos.x, 1.2, p.pos.y))
		if (p.pos.distance_to(ground) < 4.0 or screen_p.distance_to(at) < reach) and (best == null or p.pos.distance_to(ground) < best.pos.distance_to(ground)): best = p
	if best != null:
		var to: Vector2 = best.pos + (w.pos - best.pos).normalized() * (World.REACH * 0.7)
		w.walk_to(to, best.id)
		place_tapped.emit(best.id)
		return
	w.walk_to(ground)
