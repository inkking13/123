class_name BattleView
extends Node3D
## The fight on the ruined keep, drawn from Game.b.sim every frame: heroes and
## foes stand on their grid cells and walk between them, play the battle's
## blows and spells, flinch, fall; the grid lights the cells a hero can reach
## and the ones about to be hit. Tap a foe to focus it, a lit cell to move.
## Drag sideways to swing the camera round, pinch or wheel to zoom.

const TILE := 1.25
const GOLD := Color(0.94, 0.82, 0.55)
const FONT := preload("res://fonts/Alegreya_800ExtraBold.ttf")

## How each hero is drawn: body, armour set, what they hold, and their clips.
const HEROES := {
	0: {"body": "human", "right": "mace", "left": "roundShield", "acts": {"melee": "Sword_Slash", "ability": "Shield_Push"}},
	1: {"body": "dwarf", "right": "runeAxe", "acts": {"melee": "Hammer_Swing", "ability": "Shield_Push"}},
	2: {"body": "elfMale", "right": "staff", "glow": Color(0.55, 1.0, 0.6)},
	3: {"body": "human", "right": "flask", "left": "flask", "glow": Color(0.42, 1.0, 0.6), "acts": {"ability": "cast2", "melee": "cast3"}},
	4: {"body": "human", "right": "dagger", "left": "dagger", "acts": {"melee": "Double_Combo_Attack", "ability": "Triple_Combo_Attack"}},
	5: {"body": "orc", "right": "greatAxe"},
	6: {"body": "elf", "right": "bow", "acts": {"melee": "Archery_Shot", "ranged": "Archery_Shot", "ability": "Archery_Shot"}},
	7: {"body": "elf", "right": "orb", "glow": Color(0.5, 1.0, 0.45), "acts": {"ability": "cast2", "heal": "cast1", "ranged": "cast6", "rally": "cast4"}},
	8: {"body": "human", "right": "longsword", "left": "roundShield", "acts": {"melee": "Thrust_Slash", "ability": "Shield_Push"}},
	9: {"body": "dwarf", "right": "warhammer", "acts": {"melee": "Hammer_Swing", "ability": "Charged_Slash"}},
	10: {"body": "elf", "right": "flask", "glow": Color(0.6, 0.9, 1.0), "acts": {"ability": "cast2", "heal": "cast1", "rally": "cast4"}},
	11: {"body": "dwarf", "right": "flask", "glow": Color(1.0, 0.7, 0.4)},
	12: {"body": "human", "right": "handAxe", "acts": {"melee": "Sword_Slash", "ability": "Charged_Slash"}},
	13: {"body": "elf", "right": "orb", "glow": Color(0.7, 0.45, 1.0), "acts": {"ability": "Ground_Slam", "ranged": "cast6", "heal": "cast1", "rally": "cast4"}},
}
const FOES := {
	"brute": {"body": "skeleton", "right": "boneSword", "left": "skullShield", "scale": 1.15},
	"archer": {"body": "skeleton", "right": "bow", "acts": {"melee": "Archery_Shot"}},
	"shaman": {"body": "skeleton", "right": "staff", "acts": {"melee": "Charged_Spell_Cast"}, "glow": Color(0.7, 0.45, 1.0)},
	"minion": {"body": "skeleton", "right": "boneSword", "scale": 0.9},
	"boss": {"body": "orc", "right": "greatAxe", "scale": 2.0, "acts": {"melee": "Heavy_Hammer_Swing"}},
}

var units = {}
var _hp = {}
var _dead = {}
var _moving = {}
var _fx_seq = -1
var _impact_seq = 0
var _shake_seq = 0
var _shake = 0.0

var env: Environment
var sun: DirectionalLight3D
var fires: Array[OmniLight3D] = []
var clutter: Array[Node3D] = []
var cam: Camera3D
var yaw = 0.5
var yaw_user = 0.0
var zoom = 1.0
var _zoom_target = 1.0
var _target = Vector3(0, 0.3, 0)
var _tiles = {}
var _tile_mat = {}
## The strip of screen the field shows through, in canvas pixels from the top and bottom.
var band_top = 0.0
var band_bottom = 0.0
var _touches = {}
var _pinch0 = 0.0
var _zoom0 = 1.0
var _press_at = Vector2.ZERO
var _dragged = false


func _ready() -> void:
	_build_world()
	_build_arena()
	_build_tiles()
	cam = Camera3D.new()
	cam.keep_aspect = Camera3D.KEEP_WIDTH
	cam.fov = 52.0
	add_child(cam)
	cam.make_current()
	apply_quality(Game.settings.quality)
	_sync(0.0, true)


func apply_quality(q: String) -> void:
	var high = q != "low"
	sun.shadow_enabled = high
	env.glow_enabled = q == "high"
	var vp = get_viewport()
	vp.msaa_3d = Viewport.MSAA_2X if q == "high" else Viewport.MSAA_DISABLED
	vp.scaling_3d_scale = 1.0
	for c in clutter: c.visible = high


# ── world ───────────────────────────────────────────────────────────────────
func _build_world() -> void:
	var sky_mat = ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.22, 0.26, 0.34)
	sky_mat.sky_horizon_color = Color(0.58, 0.45, 0.36)
	sky_mat.ground_horizon_color = Color(0.32, 0.25, 0.2)
	sky_mat.ground_bottom_color = Color(0.1, 0.08, 0.07)
	var sky = Sky.new()
	sky.sky_material = sky_mat
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.09, 0.075, 0.065)
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.8
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.05
	env.glow_intensity = 0.7
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 0.9
	env.fog_enabled = true
	env.fog_light_color = Color(0.36, 0.3, 0.27)
	env.fog_density = 0.016
	env.fog_sky_affect = 0.0
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.06
	env.adjustment_saturation = 0.92
	var we = WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.light_color = Color(1.0, 0.87, 0.72)
	sun.light_energy = 1.2
	sun.rotation_degrees = Vector3(-38, 35, 0)
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 30.0
	sun.shadow_blur = 1.5
	add_child(sun)
	var fill = DirectionalLight3D.new()
	fill.light_color = Color(0.6, 0.66, 0.82)
	fill.light_energy = 0.35
	fill.rotation_degrees = Vector3(-50, -140, 0)
	add_child(fill)


func _place(file: String, scale: float, floor_y: float, at: Vector2, turn: float) -> Node3D:
	var n: Node3D = load("res://assets/models/%s.glb" % file).instantiate()
	var k = scale * TILE
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
	var keep = _place("battlefield-mobile", 7.0, -0.39, Vector2.ZERO, 0.0)
	keep.position.y -= 0.04
	for b in [[Vector2(-4.6, 3.2), 0.0], [Vector2(4.6, 3.2), 1.0], [Vector2(-4.6, -3.3), 2.0], [Vector2(4.6, -3.3), 3.0]]:
		var br = _place("decor-brazier", 0.54, -0.81, b[0], b[1])
		_add_fire(br.position + Vector3(0, 1.0, 0))
	for c in [["decor-bones", 0.5, -0.45, Vector2(-2.6, 4.4), 0.6], ["decor-weapons", 0.46, -0.46, Vector2(2.3, 4.5), -0.4],
			["decor-bones", 0.5, -0.45, Vector2(4.9, 0.3), 2.2], ["decor-weapons", 0.46, -0.46, Vector2(-5.0, 0.2), 1.3],
			["decor-grave", 0.42, -0.95, Vector2(-3.7, 5.0), 0.2], ["decor-pillar", 0.8, -0.82, Vector2(-5.0, 4.0), 0.5],
			["decor-pillar", 0.8, -0.82, Vector2(5.0, 4.6), 2.1], ["decor-grave", 0.42, -0.95, Vector2(4.8, -1.2), -0.6]]:
		clutter.append(_place(c[0], c[1], c[2], c[3], c[4]))
	for b in [[Vector2(-5.2, -4.0), 0.3], [Vector2(5.2, -4.0), -0.3]]:
		_place("decor-banner", 0.98, -0.89, b[0], b[1])


func _add_fire(at: Vector3) -> void:
	var p = CPUParticles3D.new()
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
	var curve = Curve.new()
	curve.add_point(Vector2(0, 0.6))
	curve.add_point(Vector2(0.3, 1.0))
	curve.add_point(Vector2(1, 0.0))
	p.scale_amount_curve = curve
	var grad = Gradient.new()
	grad.colors = PackedColorArray([Color(1.0, 0.85, 0.4, 1), Color(1.0, 0.45, 0.12, 0.8), Color(0.5, 0.12, 0.05, 0)])
	grad.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
	p.color_ramp = grad
	p.mesh = _spark_quad(0.2, Color(1.5, 1.5, 1.5))
	add_child(p)
	var l = OmniLight3D.new()
	l.position = at + Vector3(0, 0.3, 0)
	l.light_color = Color(1.0, 0.55, 0.22)
	l.light_energy = 2.2
	l.omni_range = 5.5
	l.omni_attenuation = 1.2
	add_child(l)
	fires.append(l)


func _spark_quad(size: float, color: Color) -> QuadMesh:
	var q = QuadMesh.new()
	q.size = Vector2(size, size)
	var m = StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.vertex_color_use_as_albedo = true
	m.albedo_texture = Unit.radial(Color(1, 1, 1, 1), Color(1, 1, 1, 0))
	m.albedo_color = color
	q.material = m
	return q


# ── the grid ────────────────────────────────────────────────────────────────
static func cell_pos(row: float, col: float) -> Vector3:
	return Vector3((col - (Battle.GRID_COLS - 1) / 2.0) * TILE, 0, (row - (Battle.GRID_ROWS - 1) / 2.0) * TILE)


func _build_tiles() -> void:
	var tex = _tile_texture()
	for row in Battle.GRID_ROWS:
		for col in Battle.GRID_COLS:
			var mi = MeshInstance3D.new()
			var q = QuadMesh.new()
			q.size = Vector2(TILE * 0.92, TILE * 0.92)
			q.orientation = PlaneMesh.FACE_Y
			mi.mesh = q
			var m = StandardMaterial3D.new()
			m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			m.albedo_texture = tex
			m.albedo_color = Color(1, 1, 1, 0.08)
			m.cull_mode = BaseMaterial3D.CULL_DISABLED
			mi.material_override = m
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.position = cell_pos(row, col) + Vector3(0, 0.025, 0)
			add_child(mi)
			var key = "%d,%d" % [row, col]
			_tiles[key] = mi
			_tile_mat[key] = m


## A tile: a soft rounded frame with a faint fill.
func _tile_texture() -> Texture2D:
	var img = Image.create(64, 64, false, Image.FORMAT_RGBA8)
	for y in 64:
		for x in 64:
			var d = mini(mini(x, 63 - x), mini(y, 63 - y))
			var a = 0.18
			if d < 6: a = 0.95 - d * 0.1
			img.set_pixel(x, y, Color(1, 1, 1, a))
	return ImageTexture.create_from_image(img)


func _color_tiles(s: Dictionary) -> void:
	var reach = {}
	for c in Game.b.reachable_cells(): reach["%d,%d" % [c.row, c.col]] = true
	var danger = {}
	if s.danger:
		for k in s.danger.cells: danger[k] = true
	var lava = {}
	for k in s.lava: lava[k] = true
	var cur = Game.b.current_raider()
	var t = Time.get_ticks_msec() / 1000.0
	for key in _tiles:
		var col = Color(1, 1, 1, 0.07)
		if lava.has(key): col = Color(1.0, 0.45, 0.15, 0.55)
		if danger.has(key): col = Color(1.0, 0.25, 0.18, 0.45 + 0.2 * sin(t * 6.0))
		elif reach.has(key) and not Game.settings.auto: col = Color(0.62, 0.7, 1.0, 0.55)
		if cur and key == "%d,%d" % [cur.row, cur.col]: col = Color(GOLD, 0.7)
		_tile_mat[key].albedo_color = col


# ── units ───────────────────────────────────────────────────────────────────
func _spawn(key: String, spec: Dictionary, team: int, name: String) -> Unit:
	var u = Unit.new()
	var sp = spec.duplicate()
	sp.team = team
	sp.name = name
	sp.role = "melee"
	sp.hp = 100
	sp.atk = Vector2i(1, 1)
	sp.init = 1
	add_child(u)
	u.setup(sp)
	u.face_yaw = PI if team == 0 else 0.0
	u.rotation.y = u.face_yaw
	units[key] = u
	return u


func _armour_set(c: Dictionary):
	var m = DB.armour_of(c.equipment.get("chest", "none"))
	if m: return m.set.id
	return DB.armour.STARTING_OUTFITS.get(str(c.id))


func _foe_pos(e: Dictionary) -> Vector3:
	return cell_pos(e.row, e.col)


func _boss_pos(s: Dictionary) -> Vector3:
	return cell_pos(s.bossPos.row + (Battle.BOSS_H - 1) / 2.0, s.bossPos.col + (Battle.BOSS_W - 1) / 2.0)


## Makes sure every fighter in the battle has a figure, and where it should stand.
func _wanted(s: Dictionary) -> Dictionary:
	var out = {}
	for r in s.raiders:
		var key = "r%d" % r.id
		if not units.has(key):
			var spec: Dictionary = HEROES.get(r.candidateId, {"body": "human"}).duplicate()
			var hero = Game.find_hero(r.candidateId)
			var set_id = _armour_set(hero) if hero else null
			if set_id: spec.set = set_id
			_spawn(key, spec, 0, r.name)
		out[key] = {"pos": cell_pos(r.row, r.col), "ratio": r.hp / r.maxHp, "alive": r.alive}
	for e in s.enemies:
		var key = "e%d" % e.id
		if not units.has(key): _spawn(key, FOES[e.role], 1, e.name)
		out[key] = {"pos": _foe_pos(e), "ratio": e.hp / e.maxHp, "alive": e.alive}
	for m in s.minions:
		var key = "m%d" % m.id
		if not units.has(key): _spawn(key, FOES.minion, 1, m.name)
		out[key] = {"pos": _foe_pos(m), "ratio": m.hp / m.maxHp, "alive": m.alive}
	if s.bossPos:
		if not units.has("boss"): _spawn("boss", FOES.boss, 1, s.boss.name)
		out.boss = {"pos": _boss_pos(s), "ratio": s.boss.hp / s.boss.maxHp, "alive": s.boss.hp > 0}
	return out


func _sync(delta: float, snap := false) -> void:
	var s = Game.b.sim
	if s == null: return
	var want = _wanted(s)
	var cur = Game.b.current_raider()
	var focus = Game.b.focus_enemy()
	for key in want:
		var u: Unit = units[key]
		var w: Dictionary = want[key]
		# Health: numbers float off, a flinch on a hit, a fall at zero.
		var prev: float = _hp.get(key, w.ratio)
		if not snap and absf(prev - w.ratio) > 0.001 and u.alive:
			var amount = int(round((prev - w.ratio) * _max_of(key, s)))
			if amount > 0:
				_number(u, str(amount), Color(1.0, 0.42, 0.32))
				if w.alive and not _moving.has(key): u.play_hit()
			elif amount < 0:
				_number(u, "+%d" % -amount, Color(0.55, 1.0, 0.55))
		_hp[key] = w.ratio
		u.set_ratio(w.ratio)
		if not w.alive and u.alive:
			u.play_death()
			continue
		if not u.alive: continue
		# Walk to the cell.
		var d: Vector3 = w.pos - u.position
		d.y = 0
		if snap or d.length() < 0.03:
			u.position = w.pos
			if _moving.has(key):
				_moving.erase(key)
				u.play_idle()
				u.rotation.y = u.face_yaw
		else:
			if not _moving.has(key):
				_moving[key] = true
				u.play_run()
			u.face(w.pos)
			u.position += d.normalized() * minf(d.length(), delta * 3.2)
		var ring = false
		var ring_col = GOLD
		if cur and key == "r%d" % cur.id:
			ring = true
		elif focus and ((key == "e%d" % focus.id) or (key == "m%d" % focus.id)):
			ring = true
			ring_col = Color(1, 0.35, 0.28)
		elif key == "boss" and focus == null and cur:
			ring = true
			ring_col = Color(1, 0.35, 0.28)
		u.set_ring(ring, ring_col)
	if not snap: _play_fx(s)
	_color_tiles(s)
	if s.shakeSeq != _shake_seq:
		_shake_seq = s.shakeSeq
		_shake = 0.35


func _max_of(key: String, s: Dictionary) -> float:
	if key == "boss": return s.boss.maxHp
	var id = int(key.substr(1))
	var list: Array = s.raiders if key.begins_with("r") else (s.enemies if key.begins_with("e") else s.minions)
	for x in list:
		if x.id == id: return x.maxHp
	return 100.0


func _leader_key(s: Dictionary) -> String:
	if s.bossPos: return "boss"
	for e in s.enemies:
		if e.role == "brute" and e.alive: return "e%d" % e.id
	for e in s.enemies:
		if e.alive: return "e%d" % e.id
	return ""


func _target_key(s: Dictionary, id) -> String:
	if id == null: return ""
	if id == -1: return "boss"
	if id >= Battle.MINION_ID0: return "m%d" % id
	return "e%d" % id


## The battle's latest action, played out on the figures.
func _play_fx(s: Dictionary) -> void:
	var fx: Dictionary = s.fx
	if fx.seq == _fx_seq: return
	_fx_seq = fx.seq
	if fx.actor is String and fx.actor == "enemy":
		var lk = _leader_key(s)
		if lk != "" and units.has(lk):
			var lu: Unit = units[lk]
			if lu.alive:
				lu.play_action("melee")
				_back_to_idle(lu, 1.2)
		return
	if not (fx.actor is int) or fx.kind == null: return
	var key = "r%d" % fx.actor
	if not units.has(key): return
	var u: Unit = units[key]
	var tk = _target_key(s, fx.targetEnemy)
	var target: Unit = units.get(tk)
	if target and target.alive: u.face(target.global_position)
	var kind: String = fx.kind
	var clip = {"melee": "melee", "ranged": "ranged", "heal": "heal", "ability": "ability", "rally": "rally"}.get(kind, "melee")
	var dur = u.play_action(clip)
	_back_to_idle(u, dur)
	if fx.crit: _shake = maxf(_shake, 0.25)
	if (kind == "ranged" or kind == "ability") and target:
		var col = Color(1.0, 0.85, 0.5) if kind == "ranged" else Color(0.75, 0.45, 1.0)
		_projectile(u.chest(), target.chest(), col, dur * 0.45)
	if kind == "heal" and fx.targetRaider != null:
		var hu: Unit = units.get("r%d" % fx.targetRaider)
		if hu: _burst(hu.chest(), Color(0.45, 1.0, 0.55), dur * 0.5)
	if kind == "rally": _burst(u.chest() + Vector3(0, 0.4, 0), GOLD, 0.2)


func _back_to_idle(u: Unit, after: float) -> void:
	get_tree().create_timer(maxf(after, 0.3)).timeout.connect(func():
		if is_instance_valid(u) and u.alive: u.play_idle())


# ── effects ─────────────────────────────────────────────────────────────────
func _number(u: Unit, text: String, color: Color) -> void:
	var l = Label3D.new()
	l.text = text
	l.font = FONT
	l.font_size = 80
	l.outline_size = 20
	l.modulate = color
	l.outline_modulate = Color(0, 0, 0, 0.85)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.pixel_size = 0.0045
	l.position = u.chest() + Vector3(randf_range(-0.2, 0.2), 0.8, 0)
	add_child(l)
	var tw = create_tween().set_parallel()
	tw.tween_property(l, "position:y", l.position.y + 0.9, 1.0).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 1.0).set_delay(0.4)
	tw.chain().tween_callback(l.queue_free)


func _projectile(from: Vector3, to: Vector3, color: Color, delay: float) -> void:
	await get_tree().create_timer(maxf(0.05, delay)).timeout
	var mi = MeshInstance3D.new()
	var s = SphereMesh.new()
	s.radius = 0.09
	s.height = 0.18
	mi.mesh = s
	var m = StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = color * 3.0
	mi.material_override = m
	mi.position = from
	add_child(mi)
	var tw = create_tween()
	tw.tween_property(mi, "position", to, from.distance_to(to) / 12.0)
	await tw.finished
	_burst(to, color, 0.0)
	mi.queue_free()


func _burst(at: Vector3, color: Color, delay: float) -> void:
	if delay > 0: await get_tree().create_timer(delay).timeout
	var p = CPUParticles3D.new()
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
	p.mesh = _spark_quad(0.12, color * 2.0)
	add_child(p)
	p.emitting = true
	get_tree().create_timer(1.2).timeout.connect(p.queue_free)


func _impacts(s: Dictionary) -> void:
	if s.impact.seq == _impact_seq: return
	_impact_seq = s.impact.seq
	for k in s.impact.cells:
		var p: PackedStringArray = k.split(",")
		_burst(cell_pos(int(p[0]), int(p[1])) + Vector3(0, 0.3, 0), Color(1.0, 0.45, 0.2), 0.0)


# ── camera and touch ────────────────────────────────────────────────────────
func _process(delta: float) -> void:
	_sync(delta)
	var s = Game.b.sim
	if s: _impacts(s)
	var t = Time.get_ticks_msec() / 1000.0
	for i in fires.size():
		fires[i].light_energy = 2.2 + 0.35 * sin(t * 9.0 + i * 1.7) + 0.2 * sin(t * 23.0 + i)
	zoom = lerpf(zoom, _zoom_target, 1.0 - exp(-delta * 10.0))
	var heading = yaw + yaw_user
	var pitch = deg_to_rad(54.0)
	var dist = 13.2 * zoom
	cam.position = _target + Vector3(sin(heading) * cos(pitch), sin(pitch), cos(heading) * cos(pitch)) * dist
	cam.look_at(_target)
	# Put the board in the middle of the strip of screen the HUD leaves free.
	var vp = get_viewport().get_visible_rect().size
	# A phone frames the board's width; a wide window frames its height.
	cam.keep_aspect = Camera3D.KEEP_HEIGHT if App.wide else Camera3D.KEEP_WIDTH
	cam.fov = 44.0 if App.wide else 52.0
	if vp.y > 0:
		var aspect = vp.x / vp.y
		var vfov = deg_to_rad(cam.fov) if App.wide else 2.0 * atan(tan(deg_to_rad(cam.fov) * 0.5) / aspect)
		var view_h = 2.0 * dist * tan(vfov * 0.5)
		var mid = (band_top + (vp.y - band_bottom)) * 0.5 / vp.y
		cam.v_offset = (mid - 0.5) * view_h
	if _shake > 0:
		_shake = maxf(0, _shake - delta)
		cam.h_offset = sin(t * 90.0) * 0.12 * _shake
	else:
		cam.h_offset = 0


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
			_zoom_target = clampf(_zoom0 * _pinch0 / maxf(1.0, p[0].distance_to(p[1])), 0.55, 1.4)
			_dragged = true
	elif ev is InputEventMouseButton:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP: _zoom_target = clampf(_zoom_target * 0.92, 0.55, 1.4)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN: _zoom_target = clampf(_zoom_target * 1.08, 0.55, 1.4)
		elif ev.button_index == MOUSE_BUTTON_LEFT:
			if ev.pressed:
				_press_at = ev.position
				_dragged = false
			elif not _dragged and _touches.size() <= 1:
				_tap(ev.position)
	elif ev is InputEventMouseMotion and ev.button_mask & MOUSE_BUTTON_MASK_LEFT and _touches.size() <= 1:
		if ev.position.distance_to(_press_at) > 14: _dragged = true
		if _dragged: yaw_user = clampf(yaw_user - ev.relative.x * 0.006, -PI, PI)


func reset_camera() -> void:
	yaw_user = 0.0
	_zoom_target = 1.0


func turned() -> bool:
	return absf(yaw_user) > 0.05 or absf(_zoom_target - 1.0) > 0.03


## A tap on the field: a foe takes the focus, a lit cell takes the hero.
func _tap(at: Vector2) -> void:
	var s = Game.b.sim
	if s == null or s.over: return
	var best = ""
	var best_d = 70.0 * get_viewport().get_visible_rect().size.x / 720.0
	for key in units:
		if key.begins_with("r"): continue
		var u: Unit = units[key]
		if not u.alive or cam.is_position_behind(u.chest()): continue
		var d = cam.unproject_position(u.chest()).distance_to(at)
		var reach = best_d * (2.2 if key == "boss" else 1.0)
		if d < reach and (best == "" or d < best_d):
			best = key
			best_d = d
	if best != "":
		Game.b.set_focus(-1 if best == "boss" else int(best.substr(1)))
		return
	var from = cam.project_ray_origin(at)
	var dir = cam.project_ray_normal(at)
	if absf(dir.y) < 1e-4: return
	var hit = from + dir * (-from.y / dir.y)
	var col = int(round(hit.x / TILE + (Battle.GRID_COLS - 1) / 2.0))
	var row = int(round(hit.z / TILE + (Battle.GRID_ROWS - 1) / 2.0))
	if row < 0 or col < 0 or row >= Battle.GRID_ROWS or col >= Battle.GRID_COLS: return
	if s.movePhase: Game.b.move_raider(row, col)
