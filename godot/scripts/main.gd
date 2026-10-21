extends Node3D
## The prototype: one fight on the ruined keep from the game, five heroes
## against four skeletons, turn by turn. Tap an enemy to strike it; the
## alchemist taps an ally to heal. Built in code so it reads (and diffs) as text.

const TILE := 1.25
const GOLD := Color(0.94, 0.82, 0.55)
const FONT_SEMI := preload("res://fonts/Inter_600SemiBold.ttf")
const FONT_MED := preload("res://fonts/Inter_500Medium.ttf")
const POST := preload("res://shaders/post.gdshader")

const HEROES := [
	{"name": "Каелен", "body": "human", "set": "knight", "role": "melee", "hp": 240, "atk": Vector2i(14, 20), "init": 9, "right": "mace", "left": "roundShield"},
	{"name": "Борин", "body": "dwarf", "set": "templar", "role": "melee", "hp": 210, "atk": Vector2i(16, 24), "init": 8, "right": "handAxe", "left": "roundShield"},
	{"name": "Родерик", "body": "human", "set": "knight", "role": "melee", "hp": 180, "atk": Vector2i(22, 30), "init": 11, "right": "longsword", "left": "roundShield"},
	{"name": "Сильвана", "body": "elf", "set": "leather", "role": "ranged", "hp": 130, "atk": Vector2i(24, 32), "init": 14, "right": "bow"},
	{"name": "Тэдиус", "body": "human", "set": "arcane", "role": "heal", "hp": 120, "atk": Vector2i(8, 12), "init": 12, "right": "flask", "left": "flask", "glow": Color(0.42, 1.0, 0.6)},
]
const ENEMIES := [
	{"name": "Скелет", "body": "skeleton", "role": "melee", "hp": 150, "atk": Vector2i(14, 20), "init": 10, "right": "boneSword", "left": "skullShield"},
	{"name": "Скелет", "body": "skeleton", "role": "melee", "hp": 150, "atk": Vector2i(14, 20), "init": 7, "right": "boneSword", "left": "skullShield"},
	{"name": "Лучник", "body": "skeleton", "role": "ranged", "hp": 100, "atk": Vector2i(16, 22), "init": 13, "right": "bow"},
	{"name": "Маг", "body": "skeleton", "role": "magic", "hp": 110, "atk": Vector2i(20, 26), "init": 12, "right": "staff"},
]

var units: Array[Unit] = []
var order: Array[Unit] = []
var turn_i := 0
var current: Unit
var waiting := false
var busy := false
var high := true

var env: Environment
var sun: DirectionalLight3D
var fires: Array[OmniLight3D] = []
var clutter: Array[Node3D] = []
var cam: Camera3D
var yaw := 0.45
var yaw_target := 0.45
var cam_dist := 7.4
var cam_pitch := 47.0
var cam_target := Vector3(0, 0.4, -0.3)

var hint: Label
var order_box: HBoxContainer
var fps: Label
var quality_btn: Button
var result: PanelContainer
var result_label: Label


func _ready() -> void:
	randomize()
	_build_world()
	_build_arena()
	_build_camera()
	_spawn()
	_build_ui()
	_apply_quality()
	await get_tree().create_timer(0.6).timeout
	_start_round()
	_maybe_screenshot()


## For checking the look without a phone: `-- --shot=out.png [--low] [--yaw=0.5] [--fight]`
## renders a few seconds, saves the frame and quits.
func _maybe_screenshot() -> void:
	var path := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="): path = a.substr(7)
		if a == "--low":
			high = false
			_apply_quality()
		if a.begins_with("--yaw="): yaw_target = float(a.substr(6))
		if a.begins_with("--dist="): cam_dist = float(a.substr(7))
		if a.begins_with("--pitch="): cam_pitch = float(a.substr(8))
		if a.begins_with("--at="):
			var v := a.substr(5).split_floats(",")
			cam_target = Vector3(v[0], v[1], v[2])
	if path == "": return
	if "--fight" in OS.get_cmdline_user_args():
		await get_tree().create_timer(1.0).timeout
		while not waiting: await get_tree().create_timer(0.2).timeout
		_on_picked(_alive(1)[0])
		await get_tree().create_timer(1.1).timeout
	else:
		await get_tree().create_timer(3.0).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)
	print("saved ", path, " fps ", Engine.get_frames_per_second())
	get_tree().quit()


# ── world: sky, light, fog, grade ───────────────────────────────────────────
func _build_world() -> void:
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.22, 0.26, 0.34)
	sky_mat.sky_horizon_color = Color(0.58, 0.45, 0.36)
	sky_mat.ground_horizon_color = Color(0.32, 0.25, 0.2)
	sky_mat.ground_bottom_color = Color(0.1, 0.08, 0.07)
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.11, 0.1, 0.1)
	env.sky = sky
	# Dusk: a cool sky for the shade, warm sun and fire for the light.
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.75
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.05
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 0.9
	env.fog_enabled = true
	env.fog_light_color = Color(0.36, 0.3, 0.27)
	env.fog_density = 0.018
	env.fog_sky_affect = 0.0
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.05
	env.adjustment_saturation = 1.0
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	sun = DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.87, 0.72)
	sun.light_energy = 1.15
	sun.rotation_degrees = Vector3(-38, 35, 0)
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 30.0
	sun.shadow_blur = 1.5
	add_child(sun)
	# A dim cool fill from the other side so shadowed faces aren't black.
	var fill := DirectionalLight3D.new()
	fill.light_color = Color(0.55, 0.62, 0.8)
	fill.light_energy = 0.25
	fill.rotation_degrees = Vector3(-50, -140, 0)
	add_child(fill)

	# The grade: one full-screen pass over the 3D, under the interface.
	var layer := CanvasLayer.new()
	layer.layer = 1
	var rect := ColorRect.new()
	rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sm := ShaderMaterial.new()
	sm.shader = POST
	rect.material = sm
	layer.add_child(rect)
	add_child(layer)


# ── arena: the ruined keep and its braziers (positions from Stage.tsx) ──────
func _place(file: String, scale: float, floor_y: float, at: Vector2, turn: float, finish := "stone") -> Node3D:
	var n: Node3D = load("res://assets/models/%s.glb" % file).instantiate()
	var k := scale * TILE
	n.scale = Vector3.ONE * k
	n.rotation.y = turn
	n.position = Vector3(at.x * TILE, -floor_y * k, at.y * TILE)
	for m in n.find_children("*", "MeshInstance3D", true, false):
		for s in m.mesh.get_surface_count():
			var mat: Material = m.get_active_material(s)
			if mat is StandardMaterial3D:
				var d: StandardMaterial3D = mat.duplicate()
				d.roughness = 0.95
				d.metallic = 0.0
				d.roughness_texture = null
				d.metallic_texture = null
				m.set_surface_override_material(s, d)
	add_child(n)
	return n


func _build_arena() -> void:
	var keep := _place("battlefield", 7.0, -0.39, Vector2.ZERO, 0.0)
	keep.position.y -= 0.04
	for b in [[Vector2(-4.3, 2.6), 0.0], [Vector2(4.3, 2.6), 1.0], [Vector2(-4.3, -2.3), 2.0], [Vector2(4.3, -2.3), 3.0]]:
		var br := _place("decor-brazier", 0.54, -0.81, b[0], b[1])
		_add_fire(br.position + Vector3(0, 1.0, 0))
	for c in [["decor-bones", 0.5, -0.45, Vector2(-2.6, 4.0), 0.6], ["decor-weapons", 0.46, -0.46, Vector2(2.3, 4.1), -0.4],
			["decor-bones", 0.5, -0.45, Vector2(4.6, 0.3), 2.2], ["decor-weapons", 0.46, -0.46, Vector2(-4.7, 0.2), 1.3],
			["decor-grave", 0.42, -0.95, Vector2(-3.7, 4.7), 0.2], ["decor-pillar", 0.8, -0.82, Vector2(-4.6, 3.6), 0.5],
			["decor-pillar", 0.8, -0.82, Vector2(4.7, 4.4), 2.1], ["decor-grave", 0.42, -0.95, Vector2(4.4, -0.9), -0.6]]:
		clutter.append(_place(c[0], c[1], c[2], c[3], c[4]))
	for b in [[Vector2(-4.9, -3.6), 0.3], [Vector2(4.9, -3.6), -0.3]]:
		_place("decor-banner", 0.98, -0.89, b[0], b[1])
	_add_dust()


## A brazier's flame: additive sparks and a flickering warm light.
func _add_fire(at: Vector3) -> void:
	var p := CPUParticles3D.new()
	p.amount = 22
	p.lifetime = 0.7
	p.position = at
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 0.12
	p.direction = Vector3.UP
	p.spread = 12.0
	p.gravity = Vector3(0, 1.2, 0)
	p.initial_velocity_min = 0.3
	p.initial_velocity_max = 0.7
	p.scale_amount_min = 0.5
	p.scale_amount_max = 1.0
	var curve := Curve.new()
	curve.add_point(Vector2(0, 0.6))
	curve.add_point(Vector2(0.3, 1.0))
	curve.add_point(Vector2(1, 0.0))
	p.scale_amount_curve = curve
	var grad := Gradient.new()
	grad.colors = PackedColorArray([Color(1.0, 0.85, 0.4, 1), Color(1.0, 0.45, 0.12, 0.8), Color(0.5, 0.12, 0.05, 0)])
	grad.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
	p.color_ramp = grad
	var q := QuadMesh.new()
	q.size = Vector2(0.2, 0.2)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = Unit.radial(Color(1, 1, 1, 1), Color(1, 1, 1, 0))
	m.albedo_color = Color(1.5, 1.5, 1.5)
	q.material = m
	p.mesh = q
	add_child(p)
	var l := OmniLight3D.new()
	l.position = at + Vector3(0, 0.3, 0)
	l.light_color = Color(1.0, 0.55, 0.22)
	l.light_energy = 2.2
	l.omni_range = 5.5
	l.omni_attenuation = 1.2
	add_child(l)
	fires.append(l)


## Specks of dust drifting in the light.
func _add_dust() -> void:
	var p := CPUParticles3D.new()
	p.amount = 60
	p.lifetime = 9.0
	p.preprocess = 9.0
	p.position = Vector3(0, 1.6, 0)
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = Vector3(6, 1.5, 5)
	p.gravity = Vector3(0.05, 0.02, 0)
	p.initial_velocity_min = 0.02
	p.initial_velocity_max = 0.08
	p.spread = 180.0
	var q := QuadMesh.new()
	q.size = Vector2(0.035, 0.035)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.albedo_texture = Unit.radial(Color(1, 1, 1, 1), Color(1, 1, 1, 0))
	m.albedo_color = Color(1.0, 0.85, 0.6, 0.6)
	q.material = m
	p.mesh = q
	add_child(p)
	clutter.append(p)


# ── camera: a tilted view over the board; drag sideways to swing it ─────────
func _build_camera() -> void:
	cam = Camera3D.new()
	cam.keep_aspect = Camera3D.KEEP_WIDTH
	cam.fov = 56.0
	add_child(cam)
	_place_camera()


func _place_camera() -> void:
	var pitch := deg_to_rad(cam_pitch)
	var dist := cam_dist
	var target := cam_target
	var off := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist
	cam.position = target + off
	cam.look_at(target)


func _unhandled_input(ev: InputEvent) -> void:
	if ev is InputEventScreenDrag:
		yaw_target = clampf(yaw_target - ev.relative.x * 0.006, -1.5, 1.5)
	elif ev is InputEventMouseMotion and ev.button_mask & MOUSE_BUTTON_MASK_LEFT:
		yaw_target = clampf(yaw_target - ev.relative.x * 0.006, -1.5, 1.5)


func _process(delta: float) -> void:
	yaw = lerpf(yaw, yaw_target, 1.0 - exp(-delta * 8.0))
	_place_camera()
	var t := Time.get_ticks_msec() / 1000.0
	for i in fires.size():
		fires[i].light_energy = 2.2 + 0.35 * sin(t * 9.0 + i * 1.7) + 0.2 * sin(t * 23.0 + i)
	fps.text = "%d FPS" % Engine.get_frames_per_second()


# ── fighters ────────────────────────────────────────────────────────────────
func _spawn() -> void:
	# Heroes near the camera, the skeletons across the board: fighters in front, archers and casters behind.
	var hero_at := [Vector2(-1.35, 1.6), Vector2(0.0, 1.75), Vector2(1.35, 1.6), Vector2(-0.7, 2.9), Vector2(0.7, 2.9)]
	var foe_at := [Vector2(-0.7, -1.6), Vector2(0.7, -1.6), Vector2(-0.75, -2.9), Vector2(0.75, -2.9)]
	for i in HEROES.size():
		var u := _unit(HEROES[i], 0)
		u.home = Vector3(hero_at[i].x, 0, hero_at[i].y)
	for i in ENEMIES.size():
		var u := _unit(ENEMIES[i], 1)
		u.home = Vector3(foe_at[i].x, 0, foe_at[i].y)
	for u in units:
		u.position = u.home
		u.face_yaw = PI if u.team == 0 else 0.0
		u.rotation.y = u.face_yaw


func _unit(spec: Dictionary, team: int) -> Unit:
	var u := Unit.new()
	var s := spec.duplicate()
	s.team = team
	add_child(u)
	u.setup(s)
	u.picked.connect(_on_picked)
	units.append(u)
	return u


func _alive(team: int) -> Array[Unit]:
	var out: Array[Unit] = []
	for u in units:
		if u.alive and u.team == team: out.append(u)
	return out


# ── turns ───────────────────────────────────────────────────────────────────
func _start_round() -> void:
	order = []
	for u in units:
		if u.alive: order.append(u)
	var roll := {}
	for u in order: roll[u] = u.initiative + randi() % 4
	order.sort_custom(func(a, b): return roll[a] > roll[b])
	turn_i = 0
	_next_turn()


func _next_turn() -> void:
	if _check_end(): return
	while turn_i < order.size() and not order[turn_i].alive: turn_i += 1
	if turn_i >= order.size():
		_start_round()
		return
	current = order[turn_i]
	turn_i += 1
	_show_order()
	current.set_ring(true, GOLD)
	if current.team == 0:
		waiting = true
		for e in _alive(1): e.set_ring(true, Color(1, 0.35, 0.28))
		if current.role == "heal":
			for a in _alive(0):
				if a != current: a.set_ring(true, Color(0.4, 1, 0.5))
			hint.text = "%s: союзник — лечить, враг — бросить колбу" % current.display_name
		else:
			hint.text = "%s: выберите цель" % current.display_name
	else:
		hint.text = "Ход врага: %s" % current.display_name
		await get_tree().create_timer(0.45).timeout
		var heroes := _alive(0)
		var target: Unit = heroes.pick_random()
		await _act(current, target, current.role)


func _on_picked(u: Unit) -> void:
	if not waiting or busy or not u.alive: return
	if u.team == 1:
		await _act(current, u, "ranged" if current.role == "heal" else current.role)
	elif current.role == "heal" and u != current:
		await _act(current, u, "heal")


func _clear_rings() -> void:
	for u in units: u.set_ring(false)


func _act(actor: Unit, target: Unit, kind: String) -> void:
	waiting = false
	busy = true
	_clear_rings()
	actor.set_ring(true, GOLD)
	hint.text = ""
	match kind:
		"heal":
			actor.face(target.global_position)
			var d := actor.play_action("heal")
			await _wait(d * 0.55)
			_burst(target.chest(), Color(0.45, 1.0, 0.55))
			var amount := randi_range(38, 52)
			target.take(-amount)
			_number(target, "+%d" % amount, Color(0.55, 1.0, 0.55))
			await _wait(d * 0.45)
		"ranged", "magic":
			actor.face(target.global_position)
			var d := actor.play_action(kind)
			await _wait(d * 0.5)
			var col := Color(1.0, 0.85, 0.5) if kind == "ranged" else Color(0.75, 0.45, 1.0)
			if actor.role == "heal": col = Color(0.45, 1.0, 0.55)
			await _projectile(actor.chest(), target.chest(), col)
			_hit(target, randi_range(actor.atk.x, actor.atk.y))
			await _wait(d * 0.3)
		_:
			var to := target.global_position
			var stop := to + (actor.global_position - to).normalized() * 0.95
			actor.face(to)
			actor.play_run()
			var tw := create_tween()
			tw.tween_property(actor, "position", stop, 0.5).set_trans(Tween.TRANS_SINE)
			await tw.finished
			var d := actor.play_action("melee")
			await _wait(d * 0.5)
			_hit(target, randi_range(actor.atk.x, actor.atk.y))
			await _wait(d * 0.45)
			actor.face(actor.home)
			actor.play_run()
			tw = create_tween()
			tw.tween_property(actor, "position", actor.home, 0.5).set_trans(Tween.TRANS_SINE)
			await tw.finished
			actor.rotation.y = actor.face_yaw
	actor.play_idle()
	actor.set_ring(false)
	busy = false
	_next_turn()


func _wait(s: float) -> void:
	await get_tree().create_timer(max(s, 0.05)).timeout


func _hit(target: Unit, amount: int) -> void:
	target.take(amount)
	_number(target, str(amount), Color(1.0, 0.42, 0.32))
	if target.alive: target.play_hit()


func _check_end() -> bool:
	var win := _alive(1).is_empty()
	var lose := _alive(0).is_empty()
	if not (win or lose): return false
	_clear_rings()
	hint.text = ""
	result_label.text = "Победа!" if win else "Отряд пал"
	result.visible = true
	return true


# ── effects ─────────────────────────────────────────────────────────────────
func _number(target: Unit, text: String, color: Color) -> void:
	var l := Label3D.new()
	l.text = text
	l.font = FONT_SEMI
	l.font_size = 72
	l.outline_size = 18
	l.modulate = color
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.pixel_size = 0.004
	l.position = target.chest() + Vector3(0, 0.7, 0)
	add_child(l)
	var tw := create_tween().set_parallel()
	tw.tween_property(l, "position:y", l.position.y + 0.8, 0.9).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 0.9).set_delay(0.35)
	tw.chain().tween_callback(l.queue_free)


func _projectile(from: Vector3, to: Vector3, color: Color) -> void:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 0.09
	s.height = 0.18
	mi.mesh = s
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = color * 3.0
	mi.material_override = m
	mi.position = from
	add_child(mi)
	var l := OmniLight3D.new()
	l.light_color = color
	l.light_energy = 1.5
	l.omni_range = 2.5
	mi.add_child(l)
	var tw := create_tween()
	tw.tween_property(mi, "position", to, from.distance_to(to) / 12.0)
	await tw.finished
	_burst(to, color)
	mi.queue_free()


func _burst(at: Vector3, color: Color) -> void:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.explosiveness = 0.9
	p.amount = 24
	p.lifetime = 0.8
	p.position = at
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 0.25
	p.spread = 180.0
	p.gravity = Vector3(0, 0.8, 0)
	p.initial_velocity_min = 0.6
	p.initial_velocity_max = 1.6
	var q := QuadMesh.new()
	q.size = Vector2(0.12, 0.12)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.albedo_texture = Unit.radial(Color(1, 1, 1, 1), Color(1, 1, 1, 0))
	m.albedo_color = color * 2.0
	q.material = m
	p.mesh = q
	add_child(p)
	p.emitting = true
	get_tree().create_timer(1.2).timeout.connect(p.queue_free)


# ── interface ───────────────────────────────────────────────────────────────
func _label(text: String, size: int, color: Color, font: Font = FONT_MED) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("outline_size", 6)
	return l


func _panel_style(alpha := 0.82) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.065, 0.055, alpha)
	sb.border_color = Color(0.54, 0.46, 0.31)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 12
	sb.content_margin_bottom = 12
	return sb


func _button(text: String) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_override("font", FONT_SEMI)
	b.add_theme_font_size_override("font_size", 26)
	b.add_theme_color_override("font_color", GOLD)
	b.add_theme_stylebox_override("normal", _panel_style())
	b.add_theme_stylebox_override("hover", _panel_style())
	var pressed := _panel_style(0.95)
	pressed.border_color = GOLD
	b.add_theme_stylebox_override("pressed", pressed)
	b.focus_mode = Control.FOCUS_NONE
	return b


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 2
	add_child(layer)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)

	var top := VBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_left = 24
	top.offset_right = -24
	top.offset_top = 40
	top.add_theme_constant_override("separation", 10)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(top)
	var title := _label("ПРОТОТИП НА GODOT 4", 20, Color(0.79, 0.69, 0.43))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	top.add_child(title)
	order_box = HBoxContainer.new()
	order_box.alignment = BoxContainer.ALIGNMENT_CENTER
	order_box.add_theme_constant_override("separation", 8)
	order_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(order_box)
	hint = _label("", 28, Color(0.96, 0.91, 0.8), FONT_SEMI)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	top.add_child(hint)

	var bottom := HBoxContainer.new()
	bottom.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom.offset_left = 24
	bottom.offset_right = -24
	bottom.offset_top = -110
	bottom.offset_bottom = -36
	bottom.add_theme_constant_override("separation", 12)
	root.add_child(bottom)
	fps = _label("", 24, Color(0.75, 0.72, 0.65))
	fps.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bottom.add_child(fps)
	quality_btn = _button("")
	quality_btn.pressed.connect(func():
		high = not high
		_apply_quality())
	bottom.add_child(quality_btn)
	var again := _button("Заново")
	again.pressed.connect(func(): get_tree().reload_current_scene())
	bottom.add_child(again)

	result = PanelContainer.new()
	result.add_theme_stylebox_override("panel", _panel_style(0.92))
	result.set_anchors_preset(Control.PRESET_CENTER)
	result.grow_horizontal = Control.GROW_DIRECTION_BOTH
	result.grow_vertical = Control.GROW_DIRECTION_BOTH
	var rv := VBoxContainer.new()
	rv.add_theme_constant_override("separation", 18)
	result.add_child(rv)
	result_label = _label("", 52, Color(0.96, 0.88, 0.62), FONT_SEMI)
	result_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rv.add_child(result_label)
	var more := _button("Ещё бой")
	more.pressed.connect(func(): get_tree().reload_current_scene())
	rv.add_child(more)
	result.visible = false
	root.add_child(result)


func _show_order() -> void:
	for c in order_box.get_children(): c.queue_free()
	var shown := 0
	for i in range(turn_i - 1, order.size()):
		var u := order[i]
		if not u.alive: continue
		var col := Color(0.62, 0.85, 0.55) if u.team == 0 else Color(0.95, 0.5, 0.42)
		var l := _label(u.display_name, 22 if u == current else 18, col if u != current else GOLD, FONT_SEMI if u == current else FONT_MED)
		order_box.add_child(l)
		shown += 1
		if shown >= 5: break


## High: sun shadows, bloom, 2× MSAA, full resolution, ground clutter and dust.
## Low: none of those and 70% resolution — for a budget phone.
func _apply_quality() -> void:
	quality_btn.text = "Графика: " + ("высокая" if high else "низкая")
	sun.shadow_enabled = high
	env.glow_enabled = high
	var vp := get_viewport()
	vp.msaa_3d = Viewport.MSAA_2X if high else Viewport.MSAA_DISABLED
	vp.scaling_3d_scale = 1.0 if high else 0.7
	for c in clutter: c.visible = high
