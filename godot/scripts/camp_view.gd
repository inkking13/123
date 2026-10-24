class_name CampView
extends Node3D
## The camp on a halt, in 3D behind the halt's screen: a clearing in the
## woods, the fire in the middle with a pot on a tripod, tents and a cart,
## and each hero at what they took on: asleep on a bedroll, stirring the pot,
## at the training dummy, at the workbench, off at the treeline to hunt or on
## watch by a torch. The view turns slowly round the fire; drag turns it,
## pinch or wheel zooms.
##
## With `muster` set it is the guild's camp by day as the squad is picked:
## the five stand in a row before the fire, a ring marks each empty place,
## and whoever joins gives a cheer.

## Where each task is done; a second hero at the same task stands beside the first.
const SPOTS := {
	"cook": [Vector3(1.1, 0, -0.9), Vector3(-1.2, 0, -0.8)],
	"train": [Vector3(3.9, 0, 1.4), Vector3(4.2, 0, 2.9)],
	"craft": [Vector3(-4.3, 0, 2.6), Vector3(-5.6, 0, 3.0)],
	"hunt": [Vector3(-7.0, 0, -5.0), Vector3(-5.8, 0, -6.2)],
	"watch": [Vector3(2.6, 0, -6.4), Vector3(4.2, 0, -5.8)],
}
## Heroes stand a head taller here than on the map, among full-size tents.
const HERO_SCALE := 1.45
const DUMMY := Vector3(5.4, 0, 1.6)
const BENCH := Vector3(-5.0, 0, 1.6)

var kit: WorldView      # out of the tree: the map's props and materials
var life: WorldLife     # smoke and fireflies
var env: Environment
var cam: Camera3D
var fire_light: OmniLight3D
var heroes = {}         # hero id -> {unit, label, act, next, bedroll}
var band_bottom = 0.0   # the screen's panel under the view (px), on a phone
var band_right = 0.0    # the panel on the right, on a wide window
var band_left = 0.0     # and the rail of tabs on its left

var yaw = 0.0
var _yaw_target = 0.0
var zoom = 1.0
var _zoom_target = 1.0
var _dragged = false
var _held = false
var _touches = {}
var _pinch0 = 0.0
var _zoom0 = 1.0
var _time = 0.0
var _flames: Array[MeshInstance3D] = []
var _night = false
var muster = false
var _rings: Array[MeshInstance3D] = []
var _ring_labels: Array[Label3D] = []


func _ready() -> void:
	var th: Dictionary = Game.w.theme()
	kit = WorldView.new()
	kit.load_textures(th)
	life = WorldLife.new()
	life.view = kit
	add_child(life)
	var h: float = Game.w.hours
	_night = (h >= 18.0 or h < 6.0) and not muster
	_build_env(th)
	_build_ground(th)
	_build_woods(th)
	_build_camp()
	if muster: _build_muster()
	else:
		yaw = 0.35; _yaw_target = yaw
	cam = Camera3D.new()
	cam.fov = 48.0
	cam.far = 120.0
	add_child(cam)
	cam.make_current()
	sync()
	_process(0.0)


func _exit_tree() -> void:
	if is_instance_valid(kit): kit.free()


# ── the clearing ───────────────────────────────────────────────────────────
func _build_env(th: Dictionary) -> void:
	var sky_mat = ProceduralSkyMaterial.new()
	if _night:
		sky_mat.sky_top_color = Color(0.05, 0.06, 0.12)
		sky_mat.sky_horizon_color = Color(0.16, 0.14, 0.18)
	else:
		# Late afternoon: a warm, low sky.
		sky_mat.sky_top_color = th.sky.darkened(0.3)
		sky_mat.sky_horizon_color = Color(0.7, 0.64, 0.56)
	sky_mat.ground_horizon_color = sky_mat.sky_horizon_color.darkened(0.3)
	sky_mat.ground_bottom_color = Color(0.05, 0.05, 0.04)
	var sky = Sky.new()
	sky.sky_material = sky_mat
	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.32, 0.36, 0.5) if _night else th.sky.lerp(Color(0.75, 0.68, 0.58), 0.3)
	env.ambient_light_energy = 0.32 if _night else 0.4
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.0
	env.fog_enabled = true
	env.fog_light_color = Color(0.08, 0.09, 0.14) if _night else Color(0.58, 0.58, 0.55)
	env.fog_density = 0.03 if _night else 0.018
	env.glow_enabled = Game.settings.quality == "high"
	env.glow_intensity = 0.7
	var we = WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var grade: Dictionary = th.get("grade", {})
	if not grade.is_empty():
		var layer = CanvasLayer.new()
		layer.layer = -1
		add_child(layer)
		var rect = ColorRect.new()
		rect.set_anchors_preset(Control.PRESET_FULL_RECT)
		rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var m = ShaderMaterial.new()
		m.shader = WorldView.GRADE
		for k in grade: m.set_shader_parameter(k, grade[k])
		rect.material = m
		layer.add_child(rect)
	var sun = DirectionalLight3D.new()
	sun.light_color = Color(0.55, 0.65, 0.95) if _night else Color(1.0, 0.88, 0.72)
	sun.light_energy = 0.3 if _night else 0.95
	sun.rotation_degrees = Vector3(-50, -40, 0) if _night else Vector3(-35, 130, 0)
	sun.shadow_enabled = not _night and Game.settings.quality != "low"
	sun.directional_shadow_max_distance = 30.0
	add_child(sun)


func _build_ground(th: Dictionary) -> void:
	var g = MeshInstance3D.new()
	var pm = PlaneMesh.new(); pm.size = Vector2(90, 90)
	g.mesh = pm
	g.material_override = kit._tex_material("grass", 0.95, 0.125, Color(0.8, 0.95, 0.62), true) if kit._tex.has("grass") else kit._solid(th.ground)
	add_child(g)
	# Trodden earth round the fire, and the ash and soil right under it.
	for d in [[5.0, "forest_floor", Color(0.7, 0.72, 0.62), 0.01], [1.5, "soil", Color(0.45, 0.42, 0.4), 0.02]]:
		var mi = MeshInstance3D.new()
		var c = CylinderMesh.new(); c.top_radius = d[0]; c.bottom_radius = d[0]; c.height = 0.02; c.radial_segments = 28; c.rings = 1
		mi.mesh = c
		mi.material_override = kit._tex_material(d[1], 1.0, 0.3, d[2], true) if kit._tex.has(d[1]) else kit._solid(th.road.darkened(0.2))
		mi.position.y = d[3]
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)


## The woods all round, kept back from the fire; boulders and bushes between.
func _build_woods(th: Dictionary) -> void:
	var rng = RandomNumberGenerator.new(); rng.seed = 41
	var kinds = [[kit._model_mesh("world-tree-fir", 4.6), Color(0.82, 0.86, 0.74), []], [kit._model_mesh("world-linden", 4.0), Color(0.86, 0.9, 0.76), []], [kit._model_mesh("world-tree-oldoak", 6.0), Color(0.86, 0.9, 0.76), []]]
	var rocks = []
	var bushes = []
	for k in 70:
		var a = rng.randf() * TAU
		var r = rng.randf_range(12.5, 32.0)
		var p = Vector2(cos(a), sin(a)) * r
		var roll = rng.randf()
		kinds[0 if roll < 0.6 else (1 if roll < 0.9 else 2)][2].append(p)
		if rng.randf() < 0.4: bushes.append(p + Vector2(1.4, -0.9))
		if rng.randf() < 0.2: rocks.append(p + Vector2(-1.2, 1.3))
	for k in kinds:
		if k[0] == null:
			continue
		var leaves: BaseMaterial3D = k[0].surface_get_material(0).duplicate()
		leaves.albedo_color = k[1]
		_multi(k[0], k[2], rng, 0.85, 1.35, leaves)
	var bush = kit._model_mesh("world-bush", 1.0)
	if bush: _multi(bush, bushes, rng, 0.8, 1.4, bush.surface_get_material(0))
	var boulder = kit._model_mesh("world-boulder", 1.1)
	if boulder: _multi(boulder, rocks, rng, 0.6, 1.4, boulder.surface_get_material(0))
	var tufts = []
	for k in 260:
		var a = rng.randf() * TAU
		var t = Vector2(cos(a), sin(a)) * rng.randf_range(3.5, 14.0)
		if muster and t.y > 3.6: continue  # between the row and the camera
		tufts.append(t)
	_multi(kit._tuft_mesh(th), tufts, rng, 0.6, 1.3, kit._vc_material(0.9))


func _multi(mesh: Mesh, at: Array, rng: RandomNumberGenerator, lo: float, hi: float, mat: Material) -> void:
	if at.is_empty(): return
	var mm = MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = at.size()
	for i in at.size():
		mm.set_instance_transform(i, Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(lo, hi)), Vector3(at[i].x, 0, at[i].y)))
	var mmi = MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat
	add_child(mmi)


# ── the camp ───────────────────────────────────────────────────────────────
func _build_camp() -> void:
	var wood = Color(0.38, 0.26, 0.15)
	var stone = Color(0.3, 0.29, 0.28)
	# The fire: a ring of stones, crossed logs, flames, smoke and its light.
	for k in 9:
		var a = k * TAU / 9.0
		kit._box(self, Vector3(0.42, 0.24, 0.32), Vector3(cos(a) * 0.75, 0.12, sin(a) * 0.75), stone.darkened((k % 3) * 0.06), -a)
	for a in [0.4, 1.5, 2.6]:
		var log = kit._cyl(self, 0.09, 0.11, 1.1, Vector3(0, 0.16, 0), Color(0.3, 0.2, 0.12), 6)
		log.rotation = Vector3(PI * 0.5 - 0.25, a, 0)
	kit._fire(self, Vector3(0, 0.3, 0))
	kit._fire(self, Vector3(0.15, 0.25, -0.1))
	# A camp fire burns bigger than a brazier.
	for c in get_children():
		if c is CPUParticles3D:
			c.scale_amount_min = 2.6; c.scale_amount_max = 3.6
			c.amount = 30
			c.lifetime = 0.9
			c.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
			c.emission_sphere_radius = 0.22
			c.initial_velocity_min = 0.5; c.initial_velocity_max = 1.0
			c.gravity = Vector3(0, 1.8, 0)
	# Tongues of flame that hold up on any renderer, the sparks above them.
	var flame = StandardMaterial3D.new()
	flame.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flame.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	flame.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	flame.albedo_color = Color(1.0, 0.5, 0.14, 0.9) if _night else Color(1.0, 0.42, 0.1, 0.55)
	for k in 4:
		var t = MeshInstance3D.new()
		var cone = CylinderMesh.new(); cone.top_radius = 0.0; cone.bottom_radius = 0.2 - k * 0.025; cone.height = 0.9 - k * 0.12; cone.radial_segments = 6; cone.rings = 1
		t.mesh = cone
		t.material_override = flame
		t.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		t.position = Vector3(cos(k * 2.2) * 0.14 * signf(k), 0.2 + cone.height * 0.5, sin(k * 2.2) * 0.14 * signf(k))
		add_child(t)
		_flames.append(t)
	life._smoke(self, Vector3(0, 1.4, 0), 0.7)
	fire_light = OmniLight3D.new()
	fire_light.light_color = Color(1.0, 0.6, 0.28)
	fire_light.light_energy = 3.6 if _night else 0.8
	fire_light.omni_range = 14.0
	fire_light.position = Vector3(0, 1.0, 0)
	add_child(fire_light)
	# The pot hangs on a tripod over it.
	for k in 3:
		var a = k * TAU / 3.0 + 0.3
		var leg = kit._cyl(self, 0.025, 0.035, 2.4, Vector3(cos(a) * 0.5, 1.05, sin(a) * 0.5), wood, 5)
		leg.look_at_from_position(leg.position, Vector3(0, 2.1, 0), Vector3.UP)
		leg.rotate_object_local(Vector3.RIGHT, -PI * 0.5)
	var pot = MeshInstance3D.new()
	var pm = SphereMesh.new(); pm.radius = 0.24; pm.height = 0.38; pm.radial_segments = 10; pm.rings = 5
	pot.mesh = pm
	pot.material_override = kit._solid(Color(0.13, 0.12, 0.12), 0.5, Color.BLACK, "")
	pot.position = Vector3(0, 1.15, 0)
	add_child(pot)
	kit._cyl(self, 0.005, 0.005, 0.8, Vector3(0, 1.65, 0), Color(0.2, 0.2, 0.2), 3, "")
	# Logs to sit on round the fire.
	for s in [[Vector3(-1.9, 0.18, -1.2), 0.9], [Vector3(1.9, 0.18, -1.3), -0.9], [Vector3(0.1, 0.18, -2.3), 0.0]]:
		var seat = kit._cyl(self, 0.2, 0.22, 1.6, s[0], Color(0.4, 0.28, 0.17), 7)
		seat.rotation = Vector3(0, s[1], PI * 0.5)
	# Tents, the cart with the stores, firewood.
	if not kit._prop(self, "world-tent", 2.8, Vector3(-3.4, 0, -3.4), 0.7, true): kit._tent(self)
	kit._prop(self, "world-tent", 2.6, Vector3(3.6, 0, -3.8), -0.6, true)
	kit._prop(self, "world-cart", 2.6, Vector3(-6.8, 0, -0.8), 1.3, true)
	kit._prop(self, "world-barrels", 1.2, Vector3(-6.4, 0, 1.4), 0.4)
	for row in 2:
		for k in 3 - row:
			var l = kit._cyl(self, 0.14, 0.14, 1.4, Vector3(5.6 + k * 0.3 + row * 0.15, 0.14 + row * 0.26, -1.8), Color(0.42, 0.3, 0.18), 6, "wood")
			l.rotation.x = PI * 0.5
	# The training dummy: a post, a crossbar, a sack for a head.
	kit._box(self, Vector3(0.14, 1.7, 0.14), DUMMY + Vector3(0, 0.85, 0), wood)
	kit._box(self, Vector3(1.0, 0.1, 0.1), DUMMY + Vector3(0, 1.3, 0), wood)
	var sack = MeshInstance3D.new()
	var sm = SphereMesh.new(); sm.radius = 0.2; sm.height = 0.42; sm.radial_segments = 8; sm.rings = 4
	sack.mesh = sm
	sack.material_override = kit._solid(Color(0.66, 0.58, 0.42), 0.9, Color.BLACK, "canvas")
	sack.position = DUMMY + Vector3(0, 1.85, 0)
	add_child(sack)
	kit._box(self, Vector3(0.5, 0.6, 0.3), DUMMY + Vector3(0, 1.0, 0), Color(0.62, 0.54, 0.4), 0.0, 0.9, "canvas")
	# The workbench: a trestle table, tools and a block anvil.
	kit._box(self, Vector3(1.8, 0.1, 0.8), BENCH + Vector3(0, 0.8, 0), Color(0.45, 0.32, 0.19), 0.2)
	for p in [Vector3(-0.75, 0, -0.3), Vector3(0.75, 0, -0.3), Vector3(-0.75, 0, 0.3), Vector3(0.75, 0, 0.3)]:
		kit._box(self, Vector3(0.08, 0.8, 0.08), BENCH + p.rotated(Vector3.UP, 0.2) + Vector3(0, 0.4, 0), wood)
	kit._model(self, "decor-weapons", 0.4, BENCH + Vector3(0.2, 0.85, 0), 0.4)
	kit._cyl(self, 0.22, 0.26, 0.5, BENCH + Vector3(1.0, 0.25, 1.0), Color(0.4, 0.3, 0.2), 8, "wood")
	kit._box(self, Vector3(0.4, 0.18, 0.2), BENCH + Vector3(1.0, 0.58, 1.0), Color(0.22, 0.22, 0.24), 0.3, 0.3, "")
	# The watch post: a torch on a stake at the camp's edge.
	kit._box(self, Vector3(0.08, 1.8, 0.08), Vector3(3.4, 0.9, -6.9), wood)
	kit._fire(self, Vector3(3.4, 1.9, -6.9))
	# Fireflies at the treeline at night.
	if _night:
		var f = life._fireflies_at(Vector3(0, 1.0, 0), Vector3(22, 1.6, 22))
		life._fireflies.append(f)


# ── the heroes ─────────────────────────────────────────────────────────────
## Puts each hero of the squad where their task for the night is.
func sync() -> void:
	if muster:
		_sync_muster()
		return
	var w = Game.w
	var squad: Array = Game.squad()
	var count = {}
	var keep = {}
	for c in squad:
		var act: String = w.plan_of(c)
		var n: int = count.get(act, 0)
		count[act] = n + 1
		keep[c.id] = true
		var h = heroes.get(c.id)
		if h == null:
			h = _new_hero(c)
			heroes[c.id] = h
		h.label.text = "%s · %s" % [c.name, w.activity(act).name]
		if h.act != act or h.slot != n: _place(h, act, n)
	for id in heroes.keys():
		if not keep.has(id):
			heroes[id].unit.queue_free(); heroes[id].label.queue_free()
			if heroes[id].bedroll: heroes[id].bedroll.queue_free()
			heroes.erase(id)


func _new_hero(c: Dictionary) -> Dictionary:
	var u = Unit.new()
	var sp = WorldView.hero_spec(c)
	sp.scale = HERO_SCALE; sp.team = 0; sp.name = c.name; sp.role = "melee"; sp.hp = 100; sp.atk = Vector2i(1, 1); sp.init = 1
	add_child(u)
	u.setup(sp)
	u.set_bar_visible(false)
	var l = _label3d(30)
	return {"unit": u, "label": l, "act": "", "slot": -1, "next": 0.0, "bedroll": null}


func _label3d(size: int) -> Label3D:
	var l = Label3D.new()
	l.font = WorldView.BODY_FONT
	l.font_size = size
	l.pixel_size = 0.008
	l.outline_size = 12
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	add_child(l)
	return l


# ── the muster ─────────────────────────────────────────────────────────────
## Where the n-th of the five stands, in a row before the fire.
func _muster_spot(n: int) -> Vector3:
	return Vector3((n - 2) * 1.55, 0, 2.9 - absf(n - 2) * 0.3)


func _build_muster() -> void:
	# The guild's banners either side of the row.
	for x in [-4.6, 4.6]: kit._model(self, "decor-banner", 1.3, Vector3(x, 1.14, 1.4), 0.0)
	for n in 5:
		var r = kit._ring_mesh(0.55, Color(0.95, 0.8, 0.5, 0.75))
		r.position = _muster_spot(n) + Vector3(0, 0.04, 0)
		add_child(r)
		_rings.append(r)
		var l = _label3d(44)
		l.text = "+"
		l.modulate = Color(0.95, 0.85, 0.6, 0.8)
		l.position = _muster_spot(n) + Vector3(0, 0.6, 0)
		_ring_labels.append(l)


func _sync_muster() -> void:
	var squad: Array = Game.squad()
	var keep = {}
	for n in squad.size():
		var c: Dictionary = squad[n]
		keep[c.id] = true
		var h = heroes.get(c.id)
		var fresh = h == null
		if fresh:
			h = _new_hero(c)
			heroes[c.id] = h
		h.label.text = c.name
		h.label.font_size = 26
		h.label.modulate = DB.ROLE_COLOR[c.role].lightened(0.35)
		if h.slot != n:
			h.slot = n
			h.act = "muster"
			var u: Unit = h.unit
			u.position = _muster_spot(n)
			u.face(u.position + Vector3(0, 0, 5))
			h.label.position = u.position + Vector3(0, 2.15, 0)
			# Whoever joins after the scene is up steps in with a cheer.
			if fresh and is_inside_tree() and _time > 0.2:
				var t = u.cheer()
				get_tree().create_timer(t * 0.95).timeout.connect(func(): if is_instance_valid(u): u.play_idle())
			else: u.play_idle()
	for id in heroes.keys():
		if not keep.has(id):
			heroes[id].unit.queue_free(); heroes[id].label.queue_free()
			heroes.erase(id)
	for n in 5:
		_rings[n].visible = n >= squad.size()
		_ring_labels[n].visible = n >= squad.size()


func _place(h: Dictionary, act: String, n: int) -> void:
	var u: Unit = h.unit
	h.act = act
	h.slot = n
	h.next = randf_range(0.3, 1.5)
	if h.bedroll:
		h.bedroll.queue_free()
		h.bedroll = null
	var at: Vector3
	var look: Vector3
	match act:
		"rest":
			# Asleep on a bedroll, feet to the fire.
			var a = PI * 0.62 + n * 0.62
			at = Vector3(cos(a), 0, sin(a)) * 2.7
			var roll = kit._box(self, Vector3(0.9, 0.06, 2.2), at + Vector3(0, 0.03, 0), Color(0.62, 0.52, 0.38), 0.0, 0.9, "canvas")
			roll.rotation.y = atan2(at.x, at.z)
			h.bedroll = roll
			look = Vector3.ZERO
		"cook", "train", "craft", "hunt", "watch":
			var spots: Array = SPOTS[act]
			at = spots[n % spots.size()] + Vector3(0.9, 0, 0.6) * float(n / spots.size())
			look = {"cook": Vector3.ZERO, "train": DUMMY, "craft": BENCH}.get(act, at * 2.0)
		_:
			at = Vector3(cos(n), 0, sin(n)) * 2.4
			look = Vector3.ZERO
	u.position = at
	u.face(look)
	if act == "rest": u.lie_down()
	else: u.play_idle()
	h.label.position = at + Vector3(0, 0.8 if act == "rest" else 2.4, 0)
	h.label.modulate = Color(0.95, 0.88, 0.7) if act != "watch" else Color(0.85, 0.9, 1.0)


func _sync_heroes(dt: float) -> void:
	for id in heroes:
		var h = heroes[id]
		if not h.act in ["train", "craft"]: continue
		h.next -= dt
		if h.next <= 0:
			# A blow at the dummy, or at the work on the bench.
			var u: Unit = h.unit
			var t = u.play_action("melee")
			h.next = t + (randf_range(0.6, 1.4) if h.act == "train" else randf_range(1.5, 3.0))
			get_tree().create_timer(t).timeout.connect(func(): if is_instance_valid(u) and h.act in ["train", "craft"]: u.play_idle())


# ── frame, camera, touch ───────────────────────────────────────────────────
func _process(dt: float) -> void:
	_time += dt
	_sync_heroes(dt)
	# The fire breathes.
	if fire_light:
		var base = 3.6 if _night else 0.8
		fire_light.light_energy = base * (0.85 + 0.1 * sin(_time * 7.3) + 0.06 * sin(_time * 13.1 + 1.0))
	for k in _flames.size():
		var f = _flames[k]
		f.scale = Vector3(1.0 + 0.12 * sin(_time * 9.0 + k), 0.8 + 0.3 * absf(sin(_time * (6.0 + k * 1.3) + k * 2.0)), 1.0 + 0.12 * cos(_time * 8.0 + k))
	if muster:
		# Facing the row, swaying a little.
		if not _held: _yaw_target = lerp_angle(_yaw_target, sin(_time * 0.2) * 0.12, minf(1.0, dt))
	elif not _held: _yaw_target += dt * 0.035
	zoom = lerpf(zoom, _zoom_target, 1.0 - exp(-dt * 10.0))
	yaw = lerp_angle(yaw, _yaw_target, 1.0 - exp(-dt * 8.0))
	var vp = get_viewport().get_visible_rect().size
	# A phone held upright sees a narrow slice: it gets a taller view instead
	# of stepping back into the trees.
	cam.fov = 68.0 if vp.x < vp.y else 48.0
	var dist = (9.5 if muster else 11.5) * zoom * (1.15 if muster and vp.x < vp.y else 1.0)
	var pr = deg_to_rad((24.0 if vp.x < vp.y else 18.0) if muster else 34.0)
	var focus = Vector3(0, 1.1, 2.4) if muster else Vector3(0, 0.6, 0)
	cam.position = focus + Vector3(sin(yaw) * cos(pr), sin(pr), cos(yaw) * cos(pr)) * dist
	cam.look_at(focus)
	# Keep the fire in the middle of what the screen's panels leave open.
	if vp.y > 0:
		var view_h = 2.0 * dist * tan(deg_to_rad(cam.fov) * 0.5)
		cam.v_offset = -band_bottom * 0.5 / vp.y * view_h
		cam.h_offset = (band_right - band_left) * 0.5 / vp.y * view_h


func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventScreenTouch:
		if ev.pressed: _touches[ev.index] = ev.position
		else: _touches.erase(ev.index)
		_held = not _touches.is_empty()
		if _touches.size() == 2:
			var p: Array = _touches.values()
			_pinch0 = p[0].distance_to(p[1])
			_zoom0 = _zoom_target
	elif ev is InputEventScreenDrag:
		_touches[ev.index] = ev.position
		if _touches.size() == 2 and _pinch0 > 0:
			var p: Array = _touches.values()
			_zoom_target = clampf(_zoom0 * _pinch0 / maxf(1.0, p[0].distance_to(p[1])), 0.6, 1.6)
	elif ev is InputEventMouseButton:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP: _zoom_target = clampf(_zoom_target * 0.9, 0.6, 1.6)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN: _zoom_target = clampf(_zoom_target * 1.1, 0.6, 1.6)
		elif ev.button_index == MOUSE_BUTTON_LEFT: _held = ev.pressed
	elif ev is InputEventMouseMotion and ev.button_mask & MOUSE_BUTTON_MASK_LEFT and _touches.size() <= 1:
		_yaw_target -= ev.relative.x * 0.006
