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
const GRADE := preload("res://shaders/grade.gdshader")

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
var _blades: Array[Node3D] = []
var _folk = []           # townsfolk: {unit, to, wait}
var band_top = 0.0
var _tex = {}            # Meshy-painted surface textures, for lands that have them
var _tex_mean = {}       # each texture's average colour, to tint it to a given one
var _mats = {}           # textured materials, shared between props of one look
var _models = {}         # Meshy models baked to one mesh, by file and height
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
	if th.get("textured", false):
		for k in ["grass", "road", "rock", "wall", "roof", "water", "wood", "masonry", "soil", "hay", "canvas", "foliage", "cobblestone", "sand"]:
			var path = "res://assets/textures/world/%s.jpg" % k
			if ResourceLoader.exists(path):
				_tex[k] = load(path)
				_tex_mean[k] = _mean_colour(_tex[k])
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
	# A land's colour grade: the first land is muted and earthy, like an old painting.
	var grade: Dictionary = th.get("grade", {})
	# Done on screen under the interface, so it works on every renderer.
	if not grade.is_empty():
		var layer = CanvasLayer.new()
		layer.layer = -1
		add_child(layer)
		var rect = ColorRect.new()
		rect.set_anchors_preset(Control.PRESET_FULL_RECT)
		rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var m = ShaderMaterial.new()
		m.shader = GRADE
		for k in grade: m.set_shader_parameter(k, grade[k])
		rect.material = m
		layer.add_child(rect)
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
	var half = Game.w.size() + 30.0
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
			var edge = maxf(absf(x), absf(z)) - Game.w.size()
			var y = 0.0
			if edge > 0: y = edge * 0.35 + noise.get_noise_2d(x * 2, z * 2) * edge * 0.25
			var t = clampf(noise.get_noise_2d(x, z) * 0.9 + 0.5, 0, 1)
			var col: Color = th.ground.lerp(th.ground2, t)
			# On grass the tint only shades the painted texture: patches and darker hills.
			if _tex.has("grass"): col = Color.WHITE.lerp(Color(th.ground2.r / th.ground.r, th.ground2.g / th.ground.g, th.ground2.b / th.ground.b), t)
			pts.append([Vector3(x, y, z), col.darkened(clampf(edge * 0.01, 0, 0.3))])
	for j in n:
		for i in n:
			var a = j * (n + 1) + i
			for k in [a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1]:
				st.set_color(pts[k][1])
				st.add_vertex(pts[k][0])
	st.generate_normals()
	var mi = MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = _tex_material("grass", 0.95, 0.125, Color(0.77, 0.67, 0.71), true) if _tex.has("grass") else _vc_material(0.95)
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
			_road_piece(st, prev, p, Color.WHITE if _tex.has("road") else th.road)
			prev = p
	var mi = MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = _tex_material("road", 1.0, 0.25, Color(0.82, 0.85, 0.86), true) if _tex.has("road") else _vc_material(1.0)
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
		var p = Vector2(rng.randf_range(-Game.w.size() - 20, Game.w.size() + 20), rng.randf_range(-Game.w.size() - 20, Game.w.size() + 20))
		var inside = absf(p.x) < Game.w.size() and absf(p.y) < Game.w.size()
		if inside and rng.randf() < 0.3: continue
		if _near_road(p, 4.0) or places.any(func(q): return q.pos.distance_to(p) < _clear_of(q.kind)): continue
		if Game.w.has_big_town() and Game.w.layout().town.distance_to(p) < World.TOWN_RADIUS + 5.0: continue
		spots.append(p)
	var trees = spots.slice(0, int(spots.size() * 0.8))
	var rocks = spots.slice(int(spots.size() * 0.8))
	# A textured land mixes Meshy trees: mostly its own kind, some oaks,
	# birches and dead ones; rocks become mossy boulders, and bushes grow
	# among the grass.
	var main_tree = _model_mesh({"pine": "world-pine", "round": "world-tree"}.get(th.tree, ""), 4.4) if th.get("textured", false) else null
	if main_tree:
		var mix = [[main_tree, []], [_model_mesh("world-oak", 5.0), []], [_model_mesh("world-birch", 4.5), []], [_model_mesh("world-deadtree", 4.0), []]]
		for p in trees:
			var roll = rng.randf()
			var k = 0 if roll < 0.6 else (1 if roll < 0.78 else (2 if roll < 0.94 else 3))
			if mix[k][0] == null: k = 0
			mix[k][1].append(p)
		for m in mix:
			if m[0] and not m[1].is_empty(): _scatter(m[0], m[1], rng, 0.8, 1.4, m[0].surface_get_material(0))
	else: _scatter(_tree_mesh(th), trees, rng, 0.8, 1.5)
	var boulder = _model_mesh("world-boulder", 1.2) if main_tree else null
	if boulder: _scatter(boulder, rocks, rng, 0.6, 1.6, boulder.surface_get_material(0))
	else: _scatter(_rock_mesh(th), rocks, rng, 0.6, 1.6, _tex_material("rock", 0.9, 0.7, Color.WHITE, true) if _tex.has("rock") else null)
	var bush = _model_mesh("world-bush", 1.0) if main_tree else null
	if bush: _scatter(bush, spots.filter(func(q): return rng.randf() < 0.5).map(func(q): return q + Vector2(1.6, -1.1)), rng, 0.7, 1.4, bush.surface_get_material(0))
	var tufts = []
	for _i in 1600:
		var p = Vector2(rng.randf_range(-Game.w.size(), Game.w.size()), rng.randf_range(-Game.w.size(), Game.w.size()))
		if Game.w.has_big_town() and Game.w.layout().town.distance_to(p) < World.TOWN_RADIUS: continue
		if not _near_road(p, 2.0) and not places.any(func(q): return q.kind in ["lake", "farm", "town"] and (q.pos + (Vector2(0, -10) if q.kind == "lake" else Vector2.ZERO)).distance_to(p) < _clear_of(q.kind) * (0.6 if q.kind == "lake" else 1.0)): tufts.append(p)
	_scatter(_tuft_mesh(th), tufts, rng, 0.6, 1.3)


## How much room a place takes, kept clear of trees.
func _clear_of(kind: String) -> float:
	return {"farm": 19.0, "lake": 24.0, "town": 11.0, "graveyard": 11.0, "ruins": 10.0, "tower": 9.0}.get(kind, 7.0)


func _scatter(mesh: Mesh, at: Array, rng: RandomNumberGenerator, lo: float, hi: float, mat: Material = null) -> void:
	var mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = at.size()
	for i in at.size():
		var p: Vector2 = at[i]
		var edge = maxf(absf(p.x), absf(p.y)) - Game.w.size()
		var y = maxf(0.0, edge) * 0.35
		var t = Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(lo, hi)), Vector3(p.x, y, p.y))
		mm.set_instance_transform(i, t)
	var mmi = MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat if mat else _vc_material(0.9)
	add_child(mmi)


## A Meshy model as one mesh, standing on its base at the origin and scaled
## to `size` metres tall (or wide, `by_width`), or null when the land has
## none. Cached per file and size.
func _model_mesh(file: String, size: float, by_width := false) -> Mesh:
	var key = "%s %s %s" % [file, size, by_width]
	if _models.has(key): return _models[key]
	var path = "res://assets/models/%s.glb" % file
	if file == "" or not ResourceLoader.exists(path): return null
	var scene: Node3D = load(path).instantiate()
	var st = SurfaceTool.new()
	var mat: Material = null
	var todo: Array = [[scene, Transform3D()]]
	while not todo.is_empty():
		var it = todo.pop_back()
		var xf: Transform3D = it[1] * it[0].transform if it[0] != scene else Transform3D()
		if it[0] is MeshInstance3D and it[0].mesh:
			for k in it[0].mesh.get_surface_count():
				st.append_from(it[0].mesh, k, xf)
				if mat == null: mat = it[0].get_active_material(k)
		for c in it[0].get_children():
			if c is Node3D: todo.append([c, xf])
	scene.free()
	var raw = st.commit()
	if raw == null or raw.get_surface_count() == 0: return null
	var box = raw.get_aabb()
	var f = size / maxf(box.size.x if by_width else box.size.y, 0.01)
	var mid = box.get_center()
	st = SurfaceTool.new()
	st.append_from(raw, 0, Transform3D(Basis().scaled(Vector3.ONE * f), Vector3(-mid.x * f, -box.position.y * f, -mid.z * f)))
	var mesh = st.commit()
	mesh.surface_set_material(0, mat)
	_models[key] = mesh
	return mesh


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
	var col: Color = Color.WHITE if _tex.has("rock") else th.rock
	var s = SphereMesh.new(); s.radius = 0.7; s.height = 0.9; s.radial_segments = 6; s.rings = 3
	_append(st, s, Transform3D(Basis().scaled(Vector3(1.2, 0.8, 1.0)), Vector3(0, 0.25, 0)), col)
	var s2 = SphereMesh.new(); s2.radius = 0.45; s2.height = 0.6; s2.radial_segments = 5; s2.rings = 3
	_append(st, s2, Transform3D(Basis(), Vector3(0.6, 0.15, 0.3)), col.darkened(0.1))
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


## A painted texture laid on by position (triplanar), `scale` repeats per
## metre, so the land's meshes need no UVs. In world space it runs on across
## pieces (ground, road); otherwise it turns with the object (a house).
func _tex_material(name: String, rough: float, scale: float, tint := Color.WHITE, world := false) -> StandardMaterial3D:
	var m = StandardMaterial3D.new()
	m.albedo_texture = _tex[name]
	m.albedo_color = tint
	m.vertex_color_use_as_albedo = world
	m.uv1_triplanar = true
	m.uv1_world_triplanar = world
	m.uv1_scale = Vector3.ONE * scale
	m.roughness = rough
	return m


## The average colour of a texture, from a sparse grid of its pixels.
func _mean_colour(t: Texture2D) -> Color:
	var img = t.get_image()
	if img == null: return Color(0.5, 0.5, 0.5)
	if img.is_compressed() and img.decompress() != OK: return Color(0.5, 0.5, 0.5)
	var sum = Color(0, 0, 0, 0)
	var n = 0
	var step = maxi(1, img.get_width() / 48)
	for y in range(0, img.get_height(), step):
		for x in range(0, img.get_width(), step):
			sum += img.get_pixel(x, y)
			n += 1
	return Color(sum.r / n, sum.g / n, sum.b / n)


## Which painted surface a plain colour stands for: browns are wood, greys
## stone. Bright, dark and bold colours stay plain.
func _kind_of(col: Color) -> String:
	var hi = maxf(col.r, maxf(col.g, col.b))
	var lo = minf(col.r, minf(col.g, col.b))
	if hi < 0.12: return ""
	if hi - lo < 0.07 and hi < 0.7: return "masonry"
	if col.r > col.g and col.g >= col.b and col.r - col.b > 0.1 and hi < 0.6: return "wood"
	return ""


## How many times a texture repeats per metre on a prop.
const TEX_SCALE := {"wood": 0.8, "masonry": 0.6, "rock": 0.8, "wall": 0.5, "roof": 0.6, "soil": 0.5, "hay": 0.8, "canvas": 0.8, "foliage": 0.8}


## A plain colour, or on a textured land the painted surface it stands for
## (`kind`: "auto" guesses from the colour, "" keeps it plain), tinted so the
## prop keeps its own colour.
func _solid(col: Color, rough := 0.9, emit := Color.BLACK, kind := "auto") -> StandardMaterial3D:
	if emit == Color.BLACK and not _tex.is_empty():
		var k = _kind_of(col) if kind == "auto" else kind
		if _tex.has(k):
			var key = "%s %s %s" % [k, col.to_html(false), rough]
			if not _mats.has(key):
				var mean: Color = _tex_mean[k]
				var tint = Color(col.r / maxf(mean.r, 0.05), col.g / maxf(mean.g, 0.05), col.b / maxf(mean.b, 0.05))
				_mats[key] = _tex_material(k, rough, TEX_SCALE.get(k, 0.6), tint)
			return _mats[key]
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
			"farm": _farm(root, th)
			"tower": _tower(root, th)
			"lake": _lake(root, th)
			"graveyard": _graveyard(root, th)
			"camp": _campsite(root)
			"ruins": _ruins(root, th)
			"shrine": _shrine(root, th)
			"tavern": _tavern(root)
			"market": _market(root)
			"smith": _smithy(root)
			"board": _board(root)
			"barracks": _barracks(root)
		if World.SIGHTS.has(p.kind): _label(root, World.SIGHTS[p.kind].name, _sight_height(p.kind), Color(0.88, 0.82, 0.66), 46)
		var bdef = Game.w.building(p.kind)
		if not bdef.is_empty(): _label(root, bdef.name, 5.6, Color(0.95, 0.86, 0.62), 40)
	if Game.w.has_big_town(): _walled_town(th)
	_roadside(th)
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
	# On a land with house models, a Meshy cottage of about the same size.
	if _tex.has("wall"):
		var model = _model_mesh("world-house-a" if hash(at) % 2 == 0 else "world-house-b", w + 0.3, true)
		if model:
			var mi = MeshInstance3D.new()
			mi.mesh = model
			h.add_child(mi)
			return
	var body = MeshInstance3D.new()
	var b = BoxMesh.new(); b.size = Vector3(w, 1.8, d)
	body.mesh = b
	body.material_override = _tex_material("wall", 0.9, 0.5, Color.WHITE.lerp(wall, 0.3)) if _tex.has("wall") else _solid(wall)
	body.position.y = 0.9
	h.add_child(body)
	var top = MeshInstance3D.new()
	var pr = PrismMesh.new(); pr.size = Vector3(w + 0.4, 1.3, d + 0.3)
	top.mesh = pr
	top.material_override = _tex_material("roof", 0.85, 0.6, Color.WHITE.lerp(roof, 0.2)) if _tex.has("roof") else _solid(roof)
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
	well.material_override = _tex_material("rock", 0.9, 0.8) if _tex.has("rock") else _solid(th.rock)
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
	# Road dungeons get a guild gate with a banner; side ones a mossy old
	# entrance with a single fire.
	var side: bool = p.get("side", false)
	var stone = _solid(Color(0.27, 0.31, 0.25) if side else Color(0.36, 0.34, 0.32))
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
	for x in ([-2.4] if side else [-2.4, 2.4]):
		var br: Node3D = load("res://assets/models/decor-brazier.glb").instantiate()
		br.scale = Vector3.ONE * 0.7
		br.position = Vector3(x, 0.55, 1.2)
		root.add_child(br)
		_fire(root, Vector3(x, 1.3, 1.2))
	if not side:
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


# ── the lands' other sights ────────────────────────────────────────────────
func _sight_height(kind: String) -> float:
	return {"farm": 7.5, "tower": 9.5, "lake": 2.5, "graveyard": 3.5, "camp": 3.2, "ruins": 4.5, "shrine": 4.2}.get(kind, 3.5)


func _box(root: Node3D, size: Vector3, at: Vector3, col: Color, turn := 0.0, rough := 0.9, kind := "auto") -> MeshInstance3D:
	var mi = MeshInstance3D.new()
	var b = BoxMesh.new(); b.size = size
	mi.mesh = b
	mi.material_override = _solid(col, rough, Color.BLACK, kind)
	mi.position = at
	mi.rotation.y = turn
	root.add_child(mi)
	return mi


func _cyl(root: Node3D, r_top: float, r_bot: float, h: float, at: Vector3, col: Color, segs := 10, kind := "auto") -> MeshInstance3D:
	var mi = MeshInstance3D.new()
	var c = CylinderMesh.new(); c.top_radius = r_top; c.bottom_radius = r_bot; c.height = h; c.radial_segments = segs
	mi.mesh = c
	mi.material_override = _solid(col, 0.9, Color.BLACK, kind)
	mi.position = at
	root.add_child(mi)
	return mi


func _model(root: Node3D, file: String, scale: float, at: Vector3, turn := 0.0) -> Node3D:
	var n: Node3D = load("res://assets/models/%s.glb" % file).instantiate()
	n.scale = Vector3.ONE * scale
	n.position = at
	n.rotation.y = turn
	root.add_child(n)
	return n


## A Meshy prop on a textured land, `size` metres tall (or wide); false
## when there is none, so the caller builds its own shapes.
func _prop(root: Node3D, file: String, size: float, at: Vector3, turn := 0.0, by_width := false) -> bool:
	if _tex.is_empty(): return false
	var mesh = _model_mesh(file, size, by_width)
	if mesh == null: return false
	var mi = MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = at
	mi.rotation.y = turn
	root.add_child(mi)
	return true


func _fence(root: Node3D, a: Vector3, b: Vector3, wood: Color) -> void:
	var n = int(a.distance_to(b) / 1.5)
	for i in n + 1:
		var p = a.lerp(b, float(i) / maxf(1, n))
		_box(root, Vector3(0.12, 0.9, 0.12), p + Vector3(0, 0.45, 0), wood)
	var mid = (a + b) * 0.5
	var turn = atan2(b.x - a.x, b.z - a.z) + PI * 0.5
	for y in [0.35, 0.7]:
		_box(root, Vector3(a.distance_to(b), 0.08, 0.06), mid + Vector3(0, y, 0), wood, turn)


## A hamlet: two houses, fields in rows, haystacks, a fence and a windmill.
func _farm(root: Node3D, th: Dictionary) -> void:
	var wood = Color(0.4, 0.28, 0.16)
	_house(root, Vector3(-3, 0, -2), 2.8, 2.2, 0.4, Color(0.66, 0.58, 0.46), Color(0.48, 0.33, 0.18))
	_house(root, Vector3(1.5, 0, -4), 2.2, 2.0, -0.3, Color(0.6, 0.53, 0.42), Color(0.48, 0.33, 0.18))
	# Fields: rows of furrows and crop.
	for f in 2:
		var base = Vector3(3 + f * 6.5, 0, 3)
		for row in 6:
			var crop = Color(0.62, 0.55, 0.22) if f == 0 else Color(0.32, 0.42, 0.18)
			if row % 2 == 0: _box(root, Vector3(5.5, 0.25, 0.45), base + Vector3(0, 0.12, row * 0.9), crop, 0.0, 0.9, "hay" if f == 0 else "foliage")
			else: _box(root, Vector3(5.5, 0.25, 0.45), base + Vector3(0, 0.12, row * 0.9), Color(0.33, 0.25, 0.16), 0.0, 0.9, "soil")
	_fence(root, Vector3(-1, 0, 2.2), Vector3(16, 0, 2.2), wood)
	_fence(root, Vector3(-1, 0, 8.4), Vector3(16, 0, 8.4), wood)
	for h in [Vector3(-4, 0, 4), Vector3(-2.6, 0, 6)]:
		if _prop(root, "world-haystack", 2.0, h, h.x): continue
		_cyl(root, 0.6, 1.0, 1.4, h + Vector3(0, 0.7, 0), Color(0.78, 0.66, 0.32), 9, "hay")
		_cyl(root, 0.0, 0.62, 0.6, h + Vector3(0, 1.7, 0), Color(0.74, 0.62, 0.3), 9, "hay")
	# The windmill: a stone tower, a cap, four sails that turn.
	var mill = Node3D.new()
	mill.position = Vector3(-7, 0, -6)
	root.add_child(mill)
	_cyl(mill, 1.1, 1.6, 6.0, Vector3(0, 3.0, 0), Color(0.62, 0.58, 0.52), 8, "masonry")
	var cap = MeshInstance3D.new()
	var cm = CylinderMesh.new(); cm.top_radius = 0.0; cm.bottom_radius = 1.4; cm.height = 1.6; cm.radial_segments = 8
	cap.mesh = cm; cap.material_override = _solid(Color(0.4, 0.25, 0.15))
	cap.position.y = 6.8
	mill.add_child(cap)
	var hub = Node3D.new()
	hub.position = Vector3(0, 5.4, 1.4)
	mill.add_child(hub)
	for k in 4:
		var arm = Node3D.new()
		arm.rotation.z = k * PI * 0.5
		hub.add_child(arm)
		_box(arm, Vector3(0.18, 4.2, 0.1), Vector3(0, 2.1, 0), wood)
		_box(arm, Vector3(0.9, 3.0, 0.04), Vector3(0.5, 2.4, 0.06), Color(0.85, 0.8, 0.68), 0.0, 0.9, "canvas")
	_blades.append(hub)


func _tower(root: Node3D, th: Dictionary) -> void:
	var stone = th.rock.lerp(Color(0.55, 0.52, 0.48), 0.5).darkened(0.25)
	_cyl(root, 1.9, 2.3, 7.5, Vector3(0, 3.75, 0), stone, 10)
	for k in 8:
		if k == 5: continue
		var a = k * TAU / 8.0
		_box(root, Vector3(0.7, 0.8, 0.5), Vector3(cos(a) * 1.9, 7.9, sin(a) * 1.9), stone, -a)
	_box(root, Vector3(0.9, 1.6, 0.1), Vector3(0, 0.8, 2.25), Color(0.18, 0.12, 0.08))
	_box(root, Vector3(0.35, 0.6, 0.1), Vector3(0, 5.0, 2.0), Color(0.05, 0.04, 0.03))
	_model(root, "decor-banner", 1.0, Vector3(1.4, 8.0, 0), 0.5)
	var l = OmniLight3D.new()
	l.light_color = Color(1.0, 0.6, 0.3); l.light_energy = 1.0; l.omni_range = 6.0
	l.position = Vector3(0, 8.5, 0)
	root.add_child(l)


func _lake(root: Node3D, th: Dictionary) -> void:
	var water = MeshInstance3D.new()
	var c = CylinderMesh.new(); c.top_radius = 7.5; c.bottom_radius = 7.5; c.height = 0.06; c.radial_segments = 28
	water.mesh = c
	var m = StandardMaterial3D.new()
	m.albedo_color = Color(0.16, 0.3, 0.38)
	if _tex.has("water"):
		m.albedo_texture = _tex.water
		m.albedo_color = Color(0.85, 0.9, 0.95)
		m.uv1_triplanar = true
		m.uv1_world_triplanar = true
		m.uv1_scale = Vector3.ONE * 0.12
	m.roughness = 0.08
	m.metallic = 0.35
	water.material_override = m
	water.scale = Vector3(1.4, 1, 1.0)
	water.position = Vector3(0, 0.04, -10)
	root.add_child(water)
	var shore = MeshInstance3D.new()
	var sc = CylinderMesh.new(); sc.top_radius = 8.3; sc.bottom_radius = 8.3; sc.height = 0.03; sc.radial_segments = 28
	shore.mesh = sc
	shore.material_override = _tex_material("sand", 1.0, 0.3, Color(0.85, 0.85, 0.85)) if _tex.has("sand") else _solid(th.road.darkened(0.15))
	shore.scale = Vector3(1.4, 1, 1.0)
	shore.position = Vector3(0, 0.02, -10)
	root.add_child(shore)
	var rng = RandomNumberGenerator.new(); rng.seed = 11
	for k in 26:
		var a = rng.randf() * TAU
		var r = rng.randf_range(7.2, 8.4)
		_cyl(root, 0.0, 0.05, rng.randf_range(0.8, 1.5), Vector3(cos(a) * r * 1.4, 0.5, -10 + sin(a) * r), th.leaf.lightened(0.15), 4)
	# A little jetty out from the shore, and a boat tied to it.
	_box(root, Vector3(1.2, 0.12, 4.5), Vector3(0, 0.18, -3.4), Color(0.42, 0.3, 0.18))
	_box(root, Vector3(1.0, 0.35, 2.4), Vector3(1.4, 0.15, -5.2), Color(0.36, 0.24, 0.14), 0.3)


func _graveyard(root: Node3D, th: Dictionary) -> void:
	var stone = Color(0.45, 0.44, 0.42)
	for i in 8:
		var at = Vector3(-4.5 + (i % 4) * 3.0, 0, -2 + (i / 4) * 3.5)
		_model(root, "decor-grave", 0.42, at + Vector3(0, 0.38, 0), randf() * 0.4 - 0.2)
	_model(root, "decor-bones", 0.5, Vector3(3.5, 0.22, 3.5), 0.8)
	_box(root, Vector3(3.0, 2.6, 3.0), Vector3(0, 1.3, -6.5), stone)
	var roof = MeshInstance3D.new()
	var pr = PrismMesh.new(); pr.size = Vector3(3.4, 1.4, 3.4)
	roof.mesh = pr; roof.material_override = _solid(stone.darkened(0.2))
	roof.position = Vector3(0, 3.3, -6.5)
	root.add_child(roof)
	_box(root, Vector3(1.0, 1.7, 0.1), Vector3(0, 0.85, -4.98), Color(0.06, 0.05, 0.05))
	var wood = Color(0.25, 0.2, 0.16)
	_fence(root, Vector3(-7, 0, -8.5), Vector3(7, 0, -8.5), wood)
	_fence(root, Vector3(-7, 0, 6), Vector3(7, 0, 6), wood)
	var glow = OmniLight3D.new()
	glow.light_color = Color(0.5, 0.8, 0.6); glow.light_energy = 0.8; glow.omni_range = 7.0
	glow.position = Vector3(0, 1.0, 0)
	root.add_child(glow)


func _campsite(root: Node3D) -> void:
	if _prop(root, "world-tent", 2.8, Vector3(-2.4, 0, -1.8), 0.4, true):
		_prop(root, "world-barrels", 1.3, Vector3(2.4, 0, -1.4), 1.1)
	else: _tent(root)
	_campfire_ring(root)


func _tent(root: Node3D) -> void:
	var tent = MeshInstance3D.new()
	var pr = PrismMesh.new(); pr.size = Vector3(2.6, 1.8, 2.8)
	tent.mesh = pr; tent.material_override = _solid(Color(0.55, 0.47, 0.34), 0.9, Color.BLACK, "canvas")
	tent.position = Vector3(-2.2, 0.9, -1.5)
	tent.rotation.y = 0.4
	root.add_child(tent)


func _campfire_ring(root: Node3D) -> void:
	for k in 6:
		var a = k * TAU / 6.0
		_box(root, Vector3(0.5, 0.25, 0.35), Vector3(cos(a) * 0.8, 0.12, sin(a) * 0.8), Color(0.4, 0.38, 0.36), -a)
	_box(root, Vector3(0.25, 0.25, 1.6), Vector3(0.2, 0.15, 0), Color(0.35, 0.22, 0.12), 0.8)
	_box(root, Vector3(0.25, 0.25, 1.6), Vector3(-0.1, 0.15, 0), Color(0.35, 0.22, 0.12), -0.7)
	_fire(root, Vector3(0, 0.4, 0))
	for s in [Vector3(1.8, 0.25, 1.2), Vector3(1.6, 0.25, -1.6)]:
		_box(root, Vector3(1.6, 0.4, 0.4), s, Color(0.38, 0.26, 0.15), 0.5)


func _ruins(root: Node3D, th: Dictionary) -> void:
	var stone = th.rock.lerp(Color(0.5, 0.48, 0.44), 0.5).darkened(0.25)
	var walls = [[Vector3(-4, 1.2, -3), Vector3(7.0, 2.4, 0.8), 0.0], [Vector3(-7.2, 0.9, 0), Vector3(0.8, 1.8, 6.0), 0.0],
		[Vector3(3.5, 0.6, -3.2), Vector3(3.0, 1.2, 0.8), 0.1], [Vector3(5.8, 1.4, 1.0), Vector3(0.8, 2.8, 4.5), 0.0]]
	for wdef in walls:
		var long_x: bool = wdef[1].x > wdef[1].z
		var span: float = maxf(wdef[1].x, wdef[1].z)
		if _prop(root, "world-ruin-wall", span, Vector3(wdef[0].x, 0, wdef[0].z), wdef[2] + (0.0 if long_x else PI * 0.5), true): continue
		_box(root, wdef[1], wdef[0], stone, wdef[2])
	for k in 9:
		_box(root, Vector3(0.7, 0.5, 0.6), Vector3(randf_range(-5, 5), 0.25, randf_range(-2, 4)), stone.darkened(0.1), randf() * TAU)
	_model(root, "decor-pillar", 0.8, Vector3(-2, 0.65, 2.5), 0.3)
	_model(root, "decor-pillar", 0.8, Vector3(2.8, 0.65, 2.0), 1.6)
	_model(root, "decor-weapons", 0.5, Vector3(0.5, 0.25, 0.5), 0.4)
	_model(root, "decor-bones", 0.45, Vector3(-3.0, 0.2, 0.8), 2.0)


func _shrine(root: Node3D, th: Dictionary) -> void:
	var stone = Color(0.48, 0.46, 0.42)
	_box(root, Vector3(4.0, 0.3, 3.0), Vector3(0, 0.15, 0), stone.darkened(0.15))
	_box(root, Vector3(1.4, 1.0, 0.9), Vector3(0, 0.8, 0), stone)
	for x in [-1.5, 1.5]:
		_box(root, Vector3(0.5, 3.0, 0.5), Vector3(x, 1.8, -0.8), stone)
	_box(root, Vector3(3.8, 0.4, 0.8), Vector3(0, 3.4, -0.8), stone)
	var orb = MeshInstance3D.new()
	var sm = SphereMesh.new(); sm.radius = 0.25; sm.height = 0.5
	orb.mesh = sm
	orb.material_override = _solid(Color(1.0, 0.9, 0.6), 0.3, Color(1.0, 0.8, 0.45))
	orb.position = Vector3(0, 1.6, 0)
	root.add_child(orb)
	var l = OmniLight3D.new()
	l.light_color = Color(1.0, 0.85, 0.55); l.light_energy = 1.4; l.omni_range = 6.0
	l.position = Vector3(0, 1.8, 0)
	root.add_child(l)


# ── the walled town ────────────────────────────────────────────────────────
## The palisade with gates where the road comes in and out, the square and
## its well, houses between the buildings, townsfolk about and guards at the gates.
func _walled_town(th: Dictionary) -> void:
	var w = Game.w
	var lay: Dictionary = w.layout()
	var town: Vector2 = lay.town
	var root = Node3D.new()
	root.position = Vector3(town.x, 0, town.y)
	add_child(root)
	# Where the road meets the wall.
	var road: Array = lay.road
	var gates = []
	for i in road.size():
		if road[i] == town:
			if i > 0: gates.append((road[i - 1] - town).angle())
			if i < road.size() - 1: gates.append((road[i + 1] - town).angle())
	var logs = []
	var r = World.TOWN_RADIUS
	var n = int(TAU * r / 0.55)
	for k in n:
		var a = k * TAU / n
		if gates.any(func(g): return absf(wrapf(a - g, -PI, PI)) < 0.17): continue
		logs.append(Vector2(cos(a), sin(a)) * r)
	var mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	var log_mesh = CylinderMesh.new(); log_mesh.top_radius = 0.18; log_mesh.bottom_radius = 0.24; log_mesh.height = 3.2; log_mesh.radial_segments = 6
	mm.mesh = log_mesh
	mm.instance_count = logs.size()
	for i in logs.size():
		var h = 1.0 + (i % 3) * 0.06
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3(1, h, 1)), Vector3(logs[i].x, 1.6 * h, logs[i].y)))
	var mmi = MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = _solid(Color(0.36, 0.25, 0.15))
	root.add_child(mmi)
	var wood = Color(0.33, 0.22, 0.13)
	for gang in gates:
		var dir = Vector2(cos(gang), sin(gang))
		var side = dir.orthogonal()
		var at = dir * r
		for s in [-1.0, 1.0]:
			var p = at + side * 2.6 * s
			if _prop(root, "world-watchtower", 6.2, Vector3(p.x, 0, p.y), -gang + PI * 0.5): continue
			_box(root, Vector3(1.6, 5.0, 1.6), Vector3(p.x, 2.5, p.y), wood)
			var top = MeshInstance3D.new()
			var pr = PrismMesh.new(); pr.size = Vector3(2.0, 1.2, 2.0)
			top.mesh = pr; top.material_override = _solid(Color(0.42, 0.2, 0.14), 0.9, Color.BLACK, "roof")
			top.position = Vector3(p.x, 5.6, p.y)
			root.add_child(top)
		var beam = _box(root, Vector3(5.6, 0.5, 0.5), Vector3(at.x, 4.6, at.y), wood)
		beam.rotation.y = -gang + PI * 0.5
		_folk_unit(root, {"body": "human", "right": "longsword", "left": "roundShield", "set": "knight"}, at + side * 1.4 - dir * 1.2, gang, true)
	# The square and its well.
	var sq = MeshInstance3D.new()
	var sqm = CylinderMesh.new(); sqm.top_radius = 7.0; sqm.bottom_radius = 7.0; sqm.height = 0.04; sqm.radial_segments = 24
	sq.mesh = sqm
	sq.material_override = _tex_material("cobblestone", 1.0, 0.35, Color(0.85, 0.85, 0.85), true) if _tex.has("cobblestone") else _solid(th.road.darkened(0.1))
	sq.position.y = 0.035
	root.add_child(sq)
	if not _prop(root, "world-well", 2.6, Vector3.ZERO):
		_cyl(root, 0.8, 0.9, 0.8, Vector3(0, 0.4, 0), th.rock.darkened(0.1), 10)
		_box(root, Vector3(0.1, 1.6, 0.1), Vector3(-0.7, 1.3, 0), wood)
		_box(root, Vector3(0.1, 1.6, 0.1), Vector3(0.7, 1.3, 0), wood)
		var well_roof = MeshInstance3D.new()
		var wpr = PrismMesh.new(); wpr.size = Vector3(2.0, 0.6, 1.4)
		well_roof.mesh = wpr; well_roof.material_override = _solid(Color(0.42, 0.2, 0.14), 0.9, Color.BLACK, "roof")
		well_roof.position.y = 2.3
		root.add_child(well_roof)
	var lamp = OmniLight3D.new()
	lamp.light_color = Color(1.0, 0.65, 0.3); lamp.light_energy = 1.2; lamp.omni_range = 12.0
	lamp.position = Vector3(0, 3.0, 0)
	root.add_child(lamp)
	# Houses between the buildings.
	for h in [[Vector2(0, -12), 0.0], [Vector2(12, 0), 1.57], [Vector2(-13, -1), -1.57], [Vector2(4, 12), 3.14], [Vector2(-5, 13), 3.0]]:
		_house(root, Vector3(h[0].x, 0, h[0].y), 2.6, 2.2, h[1], Color(0.64, 0.56, 0.45), Color(0.45, 0.22, 0.15))
	# Townsfolk walk between the buildings.
	for k in 5:
		var start: Vector2 = w.TOWN_BUILDINGS[k % w.TOWN_BUILDINGS.size()].at * 0.6
		_folk_unit(root, {"body": ["human", "dwarf", "elf"][k % 3], "set": ["leather", "arcane"][k % 2]}, start, randf() * TAU, false)


func _folk_unit(root: Node3D, spec: Dictionary, at: Vector2, turn: float, guard: bool) -> void:
	var u = _unit(spec, 0, "")
	u.position = root.position + Vector3(at.x, 0, at.y)
	u.rotation.y = turn if guard else u.rotation.y
	u.play_idle()
	if not guard: _folk.append({"unit": u, "to": u.position, "wait": randf() * 3.0, "center": root.position})


func _sync_folk(dt: float) -> void:
	for f in _folk:
		var u: Unit = f.unit
		var d: Vector3 = f.to - u.position
		if d.length() < 0.2:
			f.wait -= dt
			if u.get_meta("moving", false):
				u.play_idle(); u.set_meta("moving", false)
			if f.wait <= 0:
				var b: Dictionary = World.TOWN_BUILDINGS.pick_random()
				f.to = f.center + Vector3(b.at.x * 0.75 + randf_range(-1.5, 1.5), 0, b.at.y * 0.75 + randf_range(-1.5, 1.5))
				f.wait = 2.0 + randf() * 5.0
		else:
			if not u.get_meta("moving", false):
				u.play_run(); u.set_meta("moving", true)
			u.position += d.normalized() * minf(d.length(), dt * 1.8)
			u.face(u.position + d)


func _tavern(root: Node3D) -> void:
	var plaster = Color(0.72, 0.64, 0.5)
	var beam = Color(0.28, 0.18, 0.1)
	_box(root, Vector3(6.0, 3.8, 4.4), Vector3(0, 1.9, 0), plaster, 0.0, 0.9, "wall")
	for x in [-2.9, -1.0, 1.0, 2.9]: _box(root, Vector3(0.18, 3.8, 4.5), Vector3(x, 1.9, 0), beam)
	_box(root, Vector3(6.1, 0.2, 4.5), Vector3(0, 1.9, 0), beam)
	var roof = MeshInstance3D.new()
	var pr = PrismMesh.new(); pr.size = Vector3(6.8, 2.2, 5.0)
	roof.mesh = pr; roof.material_override = _solid(Color(0.4, 0.2, 0.13), 0.9, Color.BLACK, "roof")
	roof.position.y = 4.9
	root.add_child(roof)
	_box(root, Vector3(1.0, 1.6, 0.1), Vector3(0, 0.8, 2.25), Color(0.2, 0.12, 0.07))
	for x in [-2.0, 2.0]:
		_box(root, Vector3(0.8, 0.6, 0.06), Vector3(x, 1.0, 2.23), Color(1, 0.75, 0.4), 0.0, 0.5)
		_box(root, Vector3(0.8, 0.6, 0.06), Vector3(x, 2.9, 2.23), Color(1, 0.75, 0.4), 0.0, 0.5)
	_box(root, Vector3(0.1, 0.1, 1.2), Vector3(1.2, 2.6, 2.8), beam)
	_box(root, Vector3(0.9, 0.6, 0.08), Vector3(1.2, 2.2, 3.3), Color(0.55, 0.38, 0.2))
	var l = OmniLight3D.new()
	l.light_color = Color(1.0, 0.65, 0.3); l.light_energy = 1.6; l.omni_range = 7.0
	l.position = Vector3(0, 2.0, 3.0)
	root.add_child(l)
	for x in [-2.4, 2.4]:
		_box(root, Vector3(1.6, 0.12, 0.4), Vector3(x, 0.45, 3.0), beam)
	for k in 3:
		_cyl(root, 0.3, 0.3, 0.75, Vector3(3.4, 0.38, 1.6 - k * 0.7), Color(0.42, 0.28, 0.15), 8)


func _stall(root: Node3D, at: Vector3, awning: Color) -> void:
	var wood = Color(0.38, 0.26, 0.15)
	for p in [Vector3(-1.2, 0, -0.8), Vector3(1.2, 0, -0.8), Vector3(-1.2, 0, 0.8), Vector3(1.2, 0, 0.8)]:
		_box(root, Vector3(0.12, 2.2, 0.12), at + p + Vector3(0, 1.1, 0), wood)
	var top = _box(root, Vector3(2.8, 0.08, 2.2), at + Vector3(0, 2.25, 0), awning, 0.0, 0.9, "canvas")
	top.rotation.x = 0.2
	_box(root, Vector3(2.4, 0.8, 0.6), at + Vector3(0, 0.4, 0.5), wood)
	for k in 3:
		var s = MeshInstance3D.new()
		var sm = SphereMesh.new(); sm.radius = 0.22; sm.height = 0.36
		s.mesh = sm
		s.material_override = _solid([Color(0.8, 0.45, 0.2), Color(0.6, 0.7, 0.3), Color(0.75, 0.2, 0.15)][k])
		s.position = at + Vector3(-0.7 + k * 0.7, 0.95, 0.5)
		root.add_child(s)


func _market(root: Node3D) -> void:
	_stall(root, Vector3(-3, 0, 0), Color(0.62, 0.18, 0.14))
	_stall(root, Vector3(0, 0, -1.5), Color(0.22, 0.4, 0.25))
	_stall(root, Vector3(3, 0, 0), Color(0.2, 0.3, 0.55))
	if _prop(root, "world-barrels", 1.3, Vector3(-1.0, 0, 2.4), 0.3):
		_prop(root, "world-cart", 2.4, Vector3(2.2, 0, 2.6), -0.5, true)
		return
	for k in 4:
		_box(root, Vector3(0.6, 0.6, 0.6), Vector3(-1.5 + k * 0.9, 0.3, 2.2), Color(0.5, 0.36, 0.2), k * 0.3)


func _smithy(root: Node3D) -> void:
	var wood = Color(0.3, 0.2, 0.12)
	for p in [Vector3(-2.2, 0, -1.6), Vector3(2.2, 0, -1.6), Vector3(-2.2, 0, 1.6), Vector3(2.2, 0, 1.6)]:
		_box(root, Vector3(0.22, 3.0, 0.22), p + Vector3(0, 1.5, 0), wood)
	var roof = MeshInstance3D.new()
	var pr = PrismMesh.new(); pr.size = Vector3(5.2, 1.2, 4.0)
	roof.mesh = pr; roof.material_override = _solid(Color(0.32, 0.3, 0.3))
	roof.position.y = 3.6
	root.add_child(roof)
	var stone = Color(0.4, 0.38, 0.36)
	_box(root, Vector3(1.6, 1.1, 1.4), Vector3(-1.2, 0.55, -0.7), stone)
	_box(root, Vector3(0.7, 3.6, 0.7), Vector3(-1.6, 2.3, -1.2), stone)
	_fire(root, Vector3(-1.2, 1.2, -0.7))
	_box(root, Vector3(0.5, 0.6, 0.35), Vector3(0.9, 0.3, 0.4), Color(0.2, 0.2, 0.22))
	_box(root, Vector3(0.9, 0.18, 0.4), Vector3(0.9, 0.7, 0.4), Color(0.25, 0.25, 0.28), 0.0, 0.3)
	_model(root, "decor-weapons", 0.45, Vector3(1.8, 0.25, -1.0), 0.3)


func _board(root: Node3D) -> void:
	var wood = Color(0.38, 0.26, 0.15)
	for x in [-1.1, 1.1]: _box(root, Vector3(0.18, 2.6, 0.18), Vector3(x, 1.3, 0), wood)
	_box(root, Vector3(2.4, 1.4, 0.12), Vector3(0, 1.6, 0), Color(0.45, 0.32, 0.18))
	var top = MeshInstance3D.new()
	var pr = PrismMesh.new(); pr.size = Vector3(2.8, 0.5, 0.6)
	top.mesh = pr; top.material_override = _solid(Color(0.4, 0.2, 0.13), 0.9, Color.BLACK, "roof")
	top.position.y = 2.75
	root.add_child(top)
	var rng = RandomNumberGenerator.new(); rng.seed = 5
	for k in 6:
		var note = _box(root, Vector3(0.38, 0.48, 0.02), Vector3(-0.85 + (k % 3) * 0.85 + rng.randf_range(-0.1, 0.1), 1.95 - (k / 3) * 0.6, 0.08), Color(0.92, 0.88, 0.75))
		note.rotation.z = rng.randf_range(-0.15, 0.15)


func _barracks(root: Node3D) -> void:
	_box(root, Vector3(8.0, 2.6, 3.6), Vector3(0, 1.3, -1.6), Color(0.5, 0.42, 0.33), 0.0, 0.9, "wall")
	var roof = MeshInstance3D.new()
	var pr = PrismMesh.new(); pr.size = Vector3(8.6, 1.4, 4.2)
	roof.mesh = pr; roof.material_override = _solid(Color(0.36, 0.2, 0.14), 0.9, Color.BLACK, "roof")
	roof.position = Vector3(0, 3.3, -1.6)
	root.add_child(roof)
	_box(root, Vector3(1.0, 1.7, 0.1), Vector3(0, 0.85, 0.22), Color(0.2, 0.12, 0.07))
	for x in [-2.5, 0.0, 2.5]:
		_cyl(root, 0.12, 0.12, 1.8, Vector3(x, 0.9, 2.8), Color(0.4, 0.28, 0.16), 6)
		_box(root, Vector3(1.0, 0.14, 0.14), Vector3(x, 1.4, 2.8), Color(0.4, 0.28, 0.16))
		_cyl(root, 0.28, 0.28, 0.7, Vector3(x, 1.7, 2.8), Color(0.75, 0.66, 0.42), 8)
	_model(root, "decor-banner", 0.9, Vector3(-4.6, 0.8, 0.4), 0.2)


## Milestones along the road; barrels, crates and a cart by the town.
func _roadside(th: Dictionary) -> void:
	var road: Array = Game.w.layout().road
	var stone = th.rock.lerp(Color(0.55, 0.52, 0.48), 0.4)
	var walked = 0.0
	for i in road.size() - 1:
		var a: Vector2 = road[i]
		var b: Vector2 = road[i + 1]
		var seg = a.distance_to(b)
		var side = (b - a).orthogonal().normalized() * 2.6
		var t = 20.0 - fmod(walked, 20.0)
		while t < seg:
			var p = a.lerp(b, t / seg) + side
			if Game.w.has_big_town() and p.distance_to(Game.w.layout().town) < World.TOWN_RADIUS + 2.0:
				t += 20.0
				continue
			var n = Node3D.new()
			add_child(n)
			_box(n, Vector3(0.4, 0.9, 0.3), Vector3(p.x, 0.45, p.y), stone)
			t += 20.0
		walked += seg
	if Game.w.has_big_town(): return
	var town: Vector2 = Game.w.layout().town
	var by = Node3D.new()
	by.position = Vector3(town.x, 0, town.y)
	add_child(by)
	for k in 5:
		_cyl(by, 0.32, 0.32, 0.8, Vector3(6.5 + (k % 2) * 0.7, 0.4, -1 + k * 0.6), Color(0.42, 0.28, 0.15), 8)
	for k in 3:
		_box(by, Vector3(0.7, 0.7, 0.7), Vector3(-6.5, 0.35 + (k / 2) * 0.7, 1 + (k % 2) * 0.75), Color(0.5, 0.36, 0.2), 0.2 * k)
	var cart = Node3D.new()
	cart.position = Vector3(5.5, 0, 5.5)
	cart.rotation.y = 0.6
	by.add_child(cart)
	_box(cart, Vector3(1.4, 0.5, 2.4), Vector3(0, 0.75, 0), Color(0.45, 0.3, 0.17))
	for w in [Vector3(-0.8, 0.45, 0.7), Vector3(0.8, 0.45, 0.7), Vector3(-0.8, 0.45, -0.7), Vector3(0.8, 0.45, -0.7)]:
		var wheel = _cyl(cart, 0.45, 0.45, 0.12, w, Color(0.3, 0.2, 0.12), 10)
		wheel.rotation.z = PI * 0.5


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
	for h in _blades: h.rotation.z += delta * 0.6
	_sync_folk(delta)
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
