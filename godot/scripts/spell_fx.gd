class_name SpellFx
extends RefCounted
## Spells drawn on the battlefield. Each spell is put together from a few light
## pieces: light gathering in the hand, a bolt with a trail, a thrown hammer or
## shield, a flash, a column of light, a sigil on the ground, a ring sweeping
## out, a slash, an aura, a bubble. All of them are additive quads on one shader
## (vfx.gdshader) and a few dozen CPU particles, light enough for a budget phone.

const SHADER := preload("res://shaders/vfx.gdshader")
enum { GLOW, RING, SIGIL, SLASH, BEAM, BUBBLE }

const HOLY := Color(1.0, 0.78, 0.36)
const HOLY_WHITE := Color(1.0, 0.94, 0.78)
const UNHOLY := Color(0.55, 1.0, 0.3)
const PLAGUE := Color(0.45, 0.95, 0.25)
const FROST := Color(0.5, 0.8, 1.0)
const BLOOD := Color(1.0, 0.14, 0.1)
const STEEL := Color(1.0, 0.92, 0.8)
const RAGE := Color(1.0, 0.42, 0.12)
const BONE := Color(0.9, 0.88, 0.78)
const SHADOW := Color(0.55, 0.3, 0.9)

## Low graphics: half the particles and no flash lights.
static var low := false
static var _meshes := {}


## Plays a spell's own look; false if it has none, so the caller draws the plain one.
## `dur` is how long the caster's clip runs; the spell lets go a little before halfway,
## and never later than about a second in, however slow the clip.
static func play(v: Node3D, id: String, caster: Unit, target: Unit, healed: Unit, foes: Array, allies: Array, dur: float) -> bool:
	low = Game.settings.quality == "low"
	var go = minf(dur * 0.45, 1.0)
	var hit = minf(dur * 0.5, 1.1)
	var tg: Unit = target if target and target.alive else (foes[0] if not foes.is_empty() else null)
	var ally: Unit = healed if healed else caster
	match id:
		# ── paladin: gold Light ──────────────────────────────────────────────
		"judgement":
			charge(v, caster, HOLY, go)
			if tg:
				beam(v, _feet(v, tg), HOLY_WHITE, 0.35, 0.7, go)
				sigil(v, _feet(v, tg), HOLY, 0.8, 1.0, go)
				flash(v, _chest(v, tg), HOLY, 1.6, 0.5, go + 0.08)
				sparks(v, _chest(v, tg), HOLY, 18, 0.12, 0.7, 2.2, -3.0, go + 0.08)
		"flash-of-light":
			charge(v, caster, HOLY_WHITE, go)
			flash(v, _chest(v, ally), HOLY_WHITE, 1.4, 0.5, go)
			ring(v, _feet(v, ally), HOLY, 0.9, 0.6, go)
			motes(v, _feet(v, ally), HOLY_WHITE, 14, 0.9, 0.4, 0.5, 1.6, 0.1, go)
		"hammer-of-justice":
			charge(v, caster, HOLY, go)
			if tg: _hammer(v, caster, tg, go)
		"holy-shock":
			charge(v, caster, HOLY_WHITE, go)
			_holy_shock(v, caster, ally, go)
		"avengers-shield":
			if tg: _avengers_shield(v, caster, tg, foes, go)
		"templars-verdict":
			if tg:
				beam(v, _feet(v, tg), HOLY_WHITE, 0.28, 0.5, hit - 0.1)
				slash(v, _chest(v, tg), HOLY, 2.0, -0.6, 0.4, hit)
				flash(v, _chest(v, tg), HOLY, 1.8, 0.5, hit)
				sparks(v, _chest(v, tg), HOLY, 22, 0.12, 0.7, 2.6, -4.0, hit)
				shake(v, 0.28, hit)
		"lay-on-hands":
			charge(v, caster, HOLY_WHITE, go)
			beam(v, _feet(v, ally), HOLY_WHITE, 0.45, 1.4, go)
			sigil(v, _feet(v, ally), HOLY, 1.0, 1.8, go)
			flash(v, _chest(v, ally), HOLY_WHITE, 2.2, 0.7, go + 0.1)
			motes(v, _feet(v, ally), HOLY, 24, 1.2, 1.2, 0.6, 1.4, 0.12, go)
		"consecration":
			charge(v, caster, HOLY, go)
			sigil(v, _feet(v, caster), HOLY, 1.1, 1.6, go)
			for f in foes:
				sigil(v, _feet(v, f), HOLY, 0.85, 2.2, go + 0.15)
				motes(v, _feet(v, f), HOLY, 10, 0.9, 1.6, 0.55, 1.2, 0.1, go + 0.15)
		"light-of-dawn":
			charge(v, caster, HOLY_WHITE, go)
			ring(v, _feet(v, caster), HOLY, 5.0, 1.0, go)
			flash(v, _chest(v, caster), HOLY_WHITE, 1.3, 0.5, go)
			for a in allies:
				flash(v, _chest(v, a), HOLY, 1.0, 0.5, go + 0.25, false)
				motes(v, _feet(v, a), HOLY_WHITE, 8, 0.8, 0.5, 0.4, 1.5, 0.09, go + 0.25)
		"ardent-defender":
			aura(v, caster, HOLY, go)
			bubble(v, caster, HOLY, 1.4, go)
		"avenging-wrath":
			aura(v, caster, HOLY, go)
			beam(v, _feet(v, caster), HOLY_WHITE, 0.45, 0.9, go)
			sparks(v, _chest(v, caster), HOLY, 30, 0.14, 1.0, 3.0, 1.0, go, 0.3)

		# ── necromancer: rot, frost and blood ────────────────────────────────
		"death-coil":
			charge(v, caster, UNHOLY, go)
			if tg: _bolt_hit(v, caster, tg, UNHOLY, 0.24, 10.0, go, SHADOW)
		"icy-touch":
			charge(v, caster, FROST, go)
			if tg: _icy(v, caster, tg, go, 0.2)
		"mind-freeze":
			if tg: _icy(v, caster, tg, go * 0.7, 0.13)
		"death-strike":
			if tg:
				slash(v, _chest(v, tg), UNHOLY, 1.7, 0.5, 0.35, hit)
				flash(v, _chest(v, tg), BLOOD, 1.2, 0.4, hit)
				drain(v, tg, caster, BLOOD, hit + 0.15)
		"scourge-strike":
			charge(v, caster, UNHOLY, go)
			if tg:
				slash(v, _chest(v, tg), UNHOLY, 1.9, -0.4, 0.4, go)
				flash(v, _chest(v, tg), UNHOLY, 1.6, 0.45, go + 0.05)
				sparks(v, _chest(v, tg), BONE, 16, 0.1, 0.7, 2.4, -6.0, go + 0.05)
				ring(v, _feet(v, tg), UNHOLY, 1.0, 0.6, go + 0.05)
		"festering-plague":
			charge(v, caster, PLAGUE, go)
			if tg: _plague_bolt(v, caster, tg, go)
		"bone-shield":
			aura(v, caster, BONE, go)
			orbit(v, caster, BONE, 6, 1.8, go)
		"outbreak":
			charge(v, caster, PLAGUE, go)
			ring(v, _feet(v, caster), PLAGUE, 6.0, 1.1, go)
			for f in foes:
				motes(v, _chest(v, f), PLAGUE, 12, 1.0, 1.4, 0.4, 0.35, 0.22, go + 0.35)
				flash(v, _chest(v, f), PLAGUE, 1.0, 0.45, go + 0.35, false)
		"vampiric-blood":
			aura(v, caster, BLOOD, go)
			converge(v, caster, BLOOD, go, 0.9)
			flash(v, _chest(v, caster), BLOOD, 1.6, 0.6, go + 0.6)
		"army-of-the-dead":
			charge(v, caster, UNHOLY, go)
			sigil(v, _feet(v, caster), UNHOLY, 1.1, 1.8, go)
			for i in foes.size():
				var f: Unit = foes[i]
				var d = go + 0.2 + i * 0.12
				sigil(v, _feet(v, f), SHADOW, 0.7, 1.6, d)
				motes(v, _feet(v, f), UNHOLY, 14, 0.9, 1.2, 0.45, 2.4, 0.16, d)
				flash(v, _chest(v, f), UNHOLY, 1.3, 0.5, d + 0.4, false)
				sparks(v, _feet(v, f) + Vector3(0, 0.2, 0), BONE, 10, 0.09, 0.7, 2.0, -5.0, d + 0.35)
			shake(v, 0.3, go + 0.6)
		"epidemic":
			charge(v, caster, PLAGUE, go)
			if tg: _epidemic(v, caster, tg, foes, go)

		# ── warrior: steel and rage ──────────────────────────────────────────
		"heroic-strike":
			if tg:
				slash(v, _chest(v, tg), STEEL, 1.8, 0.4, 0.35, hit)
				sparks(v, _chest(v, tg), STEEL, 16, 0.09, 0.5, 3.0, -6.0, hit)
				flash(v, _chest(v, tg), STEEL, 1.0, 0.3, hit, false)
		"battle-shout":
			ring(v, _feet(v, caster), RAGE, 4.5, 0.9, go)
			ring(v, _feet(v, caster), STEEL, 3.0, 0.7, go + 0.15)
			flash(v, _chest(v, caster), RAGE, 1.3, 0.4, go)
			for a in allies:
				if a != caster: motes(v, _feet(v, a), RAGE, 8, 0.8, 0.5, 0.4, 1.6, 0.1, go + 0.3)
			shake(v, 0.15, go)
		"pummel":
			if tg:
				flash(v, _chest(v, tg), STEEL, 1.0, 0.3, hit, false)
				sparks(v, _chest(v, tg), STEEL, 12, 0.08, 0.4, 2.5, -6.0, hit)
				ring(v, _chest(v, tg) - Vector3(0, 0.5, 0), STEEL, 0.6, 0.35, hit)
		"mortal-strike":
			if tg:
				slash(v, _chest(v, tg), BLOOD, 2.2, -0.9, 0.45, hit)
				flash(v, _chest(v, tg), RAGE, 1.4, 0.4, hit)
				sparks(v, _chest(v, tg), BLOOD, 22, 0.1, 0.8, 2.6, -7.0, hit)
				shake(v, 0.25, hit)
		"bloodthirst":
			if tg:
				slash(v, _chest(v, tg), BLOOD, 1.8, 0.6, 0.35, hit)
				sparks(v, _chest(v, tg), BLOOD, 16, 0.1, 0.7, 2.2, -7.0, hit)
				drain(v, tg, caster, BLOOD, hit + 0.1)
		"shield-slam":
			if tg:
				flash(v, _chest(v, tg), STEEL, 1.8, 0.4, hit)
				ring(v, _feet(v, tg), STEEL, 1.4, 0.5, hit)
				sparks(v, _chest(v, tg), STEEL, 22, 0.09, 0.6, 3.2, -6.0, hit)
				shake(v, 0.3, hit)
		"shield-wall":
			aura(v, caster, STEEL, go)
			bubble(v, caster, FROST, 1.6, go)
		"execute":
			if tg:
				slash(v, _chest(v, tg), BLOOD, 2.4, PI * 0.5, 0.5, hit)
				flash(v, _chest(v, tg), BLOOD, 2.0, 0.5, hit)
				sparks(v, _chest(v, tg), BLOOD, 28, 0.11, 0.9, 3.0, -7.0, hit)
				shake(v, 0.4, hit)
		"whirlwind":
			whirl(v, caster, STEEL, 1.6, 2.0, 0.8, go * 0.6)
			for f in foes: flash(v, _chest(v, f), STEEL, 0.9, 0.3, go + 0.2, false)
		"bladestorm":
			whirl(v, caster, STEEL, 1.9, 4.0, 1.4, go * 0.5)
			whirl(v, caster, RAGE, 1.4, 3.0, 1.2, go * 0.5 + 0.15)
			for f in foes:
				sparks(v, _chest(v, f), STEEL, 12, 0.08, 0.5, 2.6, -6.0, go + 0.3)
			shake(v, 0.2, go + 0.3)
		"recklessness":
			aura(v, caster, RAGE, go)
			motes(v, _feet(v, caster), RAGE, 22, 0.7, 1.2, 0.45, 2.2, 0.14, go, true)
			flash(v, _chest(v, caster), RAGE, 1.6, 0.5, go)
		"shockwave":
			ring(v, _feet(v, caster), STEEL, 6.0, 0.8, hit)
			ring(v, _feet(v, caster), RAGE, 4.0, 0.7, hit + 0.1)
			sparks(v, _feet(v, caster) + Vector3(0, 0.15, 0), BONE, 22, 0.14, 0.8, 3.0, -2.0, hit, 0.6)
			for f in foes: flash(v, _chest(v, f), STEEL, 1.1, 0.35, hit + 0.3, false)
			shake(v, 0.45, hit)
		# ── mage ─────────────────────────────────────────────────────────────
		"fireball":
			if tg:
				var fb = FireballVFX.spawn_and_launch(v, caster.hand(), tg.chest(), go)
				fb.impact_reached.connect(func(_at): shake(v, 0.22))
		"frostbolt":
			if tg:
				var fb = FireballVFX.spawn_and_launch(v, caster.hand(), tg.chest(), go, Callable(), "frost", 0.5, 18.0)
				fb.impact_reached.connect(func(_at):
					if not is_instance_valid(tg): return
					ring(v, _feet(v, tg), FROST, 1.0, 0.8)
					sparks(v, _chest(v, tg), Color(0.85, 0.95, 1.0), 18, 0.08, 0.8, 2.4, -7.0))
		"comet-storm":
			charge(v, caster, SHADOW, go)
			for i in foes.size():
				_comet(v, foes[i], go + 0.1 + i * 0.22)
		_:
			return false
	return true


## Pieces are built at load so the phone compiles them before the first fight.
static func warm(v: Node3D, at: Vector3) -> void:
	for shape in [GLOW, RING, SIGIL, SLASH]:
		var q = _quad(v, at, 0.01, shape, Color.BLACK, 0.0, shape == RING or shape == SIGIL)
		v.get_tree().create_timer(0.3).timeout.connect(q.queue_free)
	var p = _particles(v, at, Color.BLACK, 1, 0.01, 0.1)
	p.emitting = true
	v.get_tree().create_timer(0.3).timeout.connect(p.queue_free)
	var s = Game.b.sim
	if s and s.raiders.any(func(r): return r.heroClass == "mage"): FireballVFX.warm(v, v.to_global(at))


## Drops the cached particle meshes and the fireball's shared pieces when the field goes.
static func forget() -> void:
	_meshes.clear()
	FireballVFX.forget()


# ── where things land ───────────────────────────────────────────────────────
static func _chest(v: Node3D, u: Unit) -> Vector3:
	return v.to_local(u.chest())


static func _feet(v: Node3D, u: Unit) -> Vector3:
	return v.to_local(u.global_position) + Vector3(0, 0.05, 0)


static func _wait(v: Node3D, delay: float) -> bool:
	if delay > 0.0: await v.get_tree().create_timer(delay).timeout
	return is_instance_valid(v) and v.is_inside_tree()


static func shake(v: Node3D, amount: float, delay := 0.0) -> void:
	if not await _wait(v, delay): return
	v.set("_shake", maxf(v.get("_shake"), amount))


# ── the pieces ──────────────────────────────────────────────────────────────
static func _mat(shape: int, color: Color, energy: float, billboard: bool) -> ShaderMaterial:
	var m = ShaderMaterial.new()
	m.shader = SHADER
	m.set_shader_parameter("shape", shape)
	m.set_shader_parameter("color", Vector3(color.r, color.g, color.b))
	m.set_shader_parameter("energy", energy)
	m.set_shader_parameter("billboard", billboard)
	return m


static func _quad(v: Node3D, at: Vector3, size: float, shape: int, color: Color, energy: float, flat: bool) -> MeshInstance3D:
	var mi = MeshInstance3D.new()
	var q = QuadMesh.new()
	q.size = Vector2(size, size)
	if flat: q.orientation = PlaneMesh.FACE_Y
	mi.mesh = q
	mi.material_override = _mat(shape, color, energy, not flat)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = at
	v.add_child(mi)
	return mi


## Runs a piece's life from 0 to 1, growing it from `from` to full size, then drops it.
static func _live(v: Node3D, mi: GeometryInstance3D, life: float, from := 1.0) -> void:
	var m: ShaderMaterial = mi.material_override
	var tw = v.create_tween()
	tw.tween_method(func(x): m.set_shader_parameter("t", x), 0.0, 1.0, life)
	if from != 1.0:
		var full = mi.scale
		mi.scale = full * from
		tw.parallel().tween_property(mi, "scale", full, life * 0.5).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.tween_callback(mi.queue_free)


static func _spark_mesh(size: float) -> QuadMesh:
	var key = snappedf(size, 0.01)
	if _meshes.has(key): return _meshes[key]
	var q = QuadMesh.new()
	q.size = Vector2(size, size)
	var m = _mat(GLOW, Color.WHITE, 2.0, true)
	m.set_shader_parameter("particle", true)
	m.set_shader_parameter("t", 0.2)
	q.material = m
	_meshes[key] = q
	return q


static func _particles(v: Node3D, at: Vector3, color: Color, amount: int, size: float, life: float) -> CPUParticles3D:
	var p = CPUParticles3D.new()
	p.amount = maxi(2, amount / 2 if low else amount)
	p.lifetime = life
	p.position = at
	p.mesh = _spark_mesh(size)
	var grad = Gradient.new()
	grad.offsets = PackedFloat32Array([0.0, 0.6, 1.0])
	grad.colors = PackedColorArray([color, Color(color, 0.7), Color(color, 0.0)])
	p.color_ramp = grad
	var curve = Curve.new()
	curve.add_point(Vector2(0, 1.0))
	curve.add_point(Vector2(1, 0.35))
	p.scale_amount_curve = curve
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.emitting = false
	v.add_child(p)
	return p


## A burst of light, with a short-lived lamp so the figures around catch it.
static func flash(v: Node3D, at: Vector3, color: Color, size: float, life := 0.45, delay := 0.0, lamp := true) -> void:
	if not await _wait(v, delay): return
	_live(v, _quad(v, at, size, GLOW, color, 2.2, false), life, 0.35)
	_live(v, _quad(v, at, size * 0.45, GLOW, color.lerp(Color.WHITE, 0.6), 2.5, false), life * 0.7, 0.3)
	if lamp and not low:
		var l = OmniLight3D.new()
		l.position = at
		l.light_color = color
		l.light_energy = 3.0
		l.omni_range = 3.5
		l.shadow_enabled = false
		v.add_child(l)
		var tw = v.create_tween()
		tw.tween_property(l, "light_energy", 0.0, life)
		tw.tween_callback(l.queue_free)


## Sparks thrown out at once.
static func sparks(v: Node3D, at: Vector3, color: Color, amount: int, size: float, life: float, speed: float, gravity: float, delay := 0.0, radius := 0.15) -> void:
	if not await _wait(v, delay): return
	var p = _particles(v, at, color, amount, size, life)
	p.one_shot = true
	p.explosiveness = 0.95
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = radius
	p.direction = Vector3.UP
	p.spread = 180.0
	p.gravity = Vector3(0, gravity, 0)
	p.initial_velocity_min = speed * 0.4
	p.initial_velocity_max = speed
	p.damping_min = 1.0
	p.damping_max = 2.0
	p.emitting = true
	v.get_tree().create_timer(life + 0.3).timeout.connect(p.queue_free)


## Motes drifting up for a while, from a disc (or a ring) on the ground.
static func motes(v: Node3D, at: Vector3, color: Color, amount: int, life: float, time: float, radius: float, rise: float, size: float, delay := 0.0, ring_only := false) -> void:
	if not await _wait(v, delay): return
	var p = _particles(v, at, color, amount, size, life)
	if ring_only:
		p.emission_shape = CPUParticles3D.EMISSION_SHAPE_RING
		p.emission_ring_axis = Vector3.UP
		p.emission_ring_radius = radius
		p.emission_ring_inner_radius = radius * 0.8
		p.emission_ring_height = 0.05
	else:
		p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
		p.emission_sphere_radius = radius
	p.direction = Vector3.UP
	p.spread = 15.0
	p.gravity = Vector3(0, rise * 0.5, 0)
	p.initial_velocity_min = rise * 0.5
	p.initial_velocity_max = rise
	p.emitting = true
	await v.get_tree().create_timer(time).timeout
	if not is_instance_valid(p): return
	p.emitting = false
	v.get_tree().create_timer(life + 0.2).timeout.connect(p.queue_free)


## Light pulled into the caster's hand while the cast winds up.
static func charge(v: Node3D, u: Unit, color: Color, time: float) -> void:
	if time < 0.15 or not is_instance_valid(u): return
	var at = v.to_local(u.hand())
	var g = _quad(v, at, 0.55, GLOW, color, 2.0, false)
	var m: ShaderMaterial = g.material_override
	var tw = v.create_tween()
	tw.tween_method(func(x): m.set_shader_parameter("t", x), 0.1, 0.32, time)
	tw.parallel().tween_property(g, "scale", Vector3.ONE, time).from(Vector3.ONE * 0.2)
	tw.tween_callback(g.queue_free)
	var p = _particles(v, at, color, 14, 0.09, 0.35)
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 0.6
	p.gravity = Vector3.ZERO
	p.radial_accel_min = -9.0
	p.radial_accel_max = -6.0
	p.emitting = true
	await v.get_tree().create_timer(time).timeout
	if not is_instance_valid(p): return
	p.emitting = false
	v.get_tree().create_timer(0.5).timeout.connect(p.queue_free)


## Life pulled from all round into a figure.
static func converge(v: Node3D, u: Unit, color: Color, delay: float, time: float) -> void:
	if not await _wait(v, delay) or not is_instance_valid(u): return
	var p = _particles(v, _chest(v, u), color, 22, 0.12, 0.45)
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 1.2
	p.gravity = Vector3.ZERO
	p.radial_accel_min = -12.0
	p.radial_accel_max = -8.0
	p.emitting = true
	await v.get_tree().create_timer(time).timeout
	if not is_instance_valid(p): return
	p.emitting = false
	v.get_tree().create_timer(0.6).timeout.connect(p.queue_free)


## A glowing ball flying from one point to another, leaving a trail. Returns on arrival.
static func bolt(v: Node3D, from: Vector3, to: Vector3, color: Color, size: float, speed: float) -> void:
	var n = Node3D.new()
	n.position = from
	v.add_child(n)
	var outer = _quad(v, Vector3.ZERO, size * 2.2, GLOW, color, 2.2, false)
	var core = _quad(v, Vector3.ZERO, size, GLOW, color.lerp(Color.WHITE, 0.7), 2.6, false)
	for q in [outer, core]:
		q.reparent(n, false)
		q.material_override.set_shader_parameter("t", 0.2)
	var trail = _particles(v, Vector3.ZERO, color, 24, size * 1.1, 0.3)
	trail.reparent(n, false)
	trail.local_coords = false
	trail.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	trail.emission_sphere_radius = size * 0.3
	trail.gravity = Vector3.ZERO
	trail.spread = 180.0
	trail.initial_velocity_min = 0.1
	trail.initial_velocity_max = 0.4
	trail.emitting = true
	var tw = v.create_tween()
	tw.tween_property(n, "position", to, maxf(0.08, from.distance_to(to) / speed))
	await tw.finished
	if not is_instance_valid(n): return
	outer.visible = false
	core.visible = false
	trail.emitting = false
	v.get_tree().create_timer(0.4).timeout.connect(n.queue_free)


## A held weapon thrown spinning at a target, with a glow and a trail. Returns on arrival.
static func thrown(v: Node3D, prop: String, from: Vector3, to: Vector3, color: Color, speed: float) -> void:
	var n = Node3D.new()
	n.position = from
	v.add_child(n)
	var p: Dictionary = Unit.PROPS[prop]
	var model: Node3D = load("res://assets/models/%s.glb" % p.file).instantiate()
	model.scale = Vector3.ONE * p.scale
	var spinner = Node3D.new()
	spinner.add_child(model)
	n.add_child(spinner)
	var g = _quad(v, Vector3.ZERO, 0.9, GLOW, color, 1.6, false)
	g.reparent(n, false)
	g.material_override.set_shader_parameter("t", 0.2)
	var trail = _particles(v, Vector3.ZERO, color, 24, 0.14, 0.35)
	trail.reparent(n, false)
	trail.local_coords = false
	trail.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	trail.emission_sphere_radius = 0.15
	trail.gravity = Vector3.ZERO
	trail.emitting = true
	var t = maxf(0.12, from.distance_to(to) / speed)
	var d = to - from
	n.rotation.y = atan2(d.x, d.z)
	var tw = v.create_tween()
	tw.tween_property(n, "position", to, t)
	tw.parallel().tween_property(spinner, "rotation:x", -TAU * 3.0 * t, t).as_relative()
	await tw.finished
	if not is_instance_valid(n): return
	spinner.visible = false
	g.visible = false
	trail.emitting = false
	v.get_tree().create_timer(0.45).timeout.connect(n.queue_free)


## A column of light coming down onto a spot.
static func beam(v: Node3D, at: Vector3, color: Color, radius: float, life: float, delay := 0.0) -> void:
	if not await _wait(v, delay): return
	var mi = MeshInstance3D.new()
	var c = CylinderMesh.new()
	c.top_radius = radius
	c.bottom_radius = radius
	c.height = 6.0
	c.cap_top = false
	c.cap_bottom = false
	c.radial_segments = 14
	c.rings = 1
	mi.mesh = c
	mi.material_override = _mat(BEAM, color, 1.3, false)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = at + Vector3(0, 3.0, 0)
	v.add_child(mi)
	var m: ShaderMaterial = mi.material_override
	var tw = v.create_tween()
	tw.tween_method(func(x): m.set_shader_parameter("t", x), 0.0, 1.0, life)
	tw.parallel().tween_property(mi, "scale", Vector3.ONE, life * 0.25).from(Vector3(0.15, 1, 0.15)).set_ease(Tween.EASE_OUT)
	tw.tween_callback(mi.queue_free)


## A turning circle of marks on the ground.
static func sigil(v: Node3D, at: Vector3, color: Color, radius: float, life: float, delay := 0.0) -> void:
	if not await _wait(v, delay): return
	_live(v, _quad(v, at + Vector3(0, 0.02, 0), radius * 2.0, SIGIL, color, 1.8, true), life, 0.6)


## A ring running out over the ground.
static func ring(v: Node3D, at: Vector3, color: Color, radius: float, life: float, delay := 0.0) -> void:
	if not await _wait(v, delay): return
	_live(v, _quad(v, at + Vector3(0, 0.04, 0), radius * 2.0, RING, color, 1.4, true), life)


## A crescent cut through the air, turned by `angle` in the screen plane.
static func slash(v: Node3D, at: Vector3, color: Color, size: float, angle: float, life: float, delay := 0.0) -> void:
	if not await _wait(v, delay): return
	var q = _quad(v, at, size, SLASH, color, 2.4, false)
	q.material_override.set_shader_parameter("spin", angle)
	_live(v, q, life)


## Blades sweeping round the caster on the ground.
static func whirl(v: Node3D, u: Unit, color: Color, radius: float, turns: float, life: float, delay := 0.0) -> void:
	if not await _wait(v, delay) or not is_instance_valid(u): return
	var q = _quad(v, _feet(v, u) + Vector3(0, 0.5, 0), radius * 2.0, SLASH, color, 2.2, true)
	var m: ShaderMaterial = q.material_override
	m.set_shader_parameter("t", 0.38)
	var tw = v.create_tween()
	tw.tween_method(func(x): m.set_shader_parameter("spin", x), 0.0, -TAU * turns, life)
	tw.parallel().tween_method(func(x): m.set_shader_parameter("energy", x), 2.2, 0.0, life * 0.35).set_delay(life * 0.65)
	tw.tween_callback(q.queue_free)


## A glow rising round the caster: a ring at the feet, motes going up, a flash.
static func aura(v: Node3D, u: Unit, color: Color, delay := 0.0) -> void:
	if not await _wait(v, delay) or not is_instance_valid(u): return
	ring(v, _feet(v, u), color, 1.0, 0.6)
	motes(v, _feet(v, u), color, 16, 0.9, 0.9, 0.5, 1.6, 0.1, 0.0, true)
	flash(v, _chest(v, u), color, 1.3, 0.5, 0.0, false)


## A see-through shell over a figure, following it.
static func bubble(v: Node3D, u: Unit, color: Color, life: float, delay := 0.0) -> void:
	if not await _wait(v, delay) or not is_instance_valid(u): return
	var mi = MeshInstance3D.new()
	var s = SphereMesh.new()
	s.radius = 0.8
	s.height = 2.0
	s.radial_segments = 20
	s.rings = 10
	mi.mesh = s
	mi.material_override = _mat(BUBBLE, color, 0.8, false)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.position = Vector3(0, 0.95, 0)
	u.add_child(mi)
	_live(v, mi, life, 0.5)


## Shards circling a figure.
static func orbit(v: Node3D, u: Unit, color: Color, count: int, life: float, delay := 0.0) -> void:
	if not await _wait(v, delay) or not is_instance_valid(u): return
	var pivot = Node3D.new()
	pivot.position = Vector3(0, 1.0, 0)
	u.add_child(pivot)
	var mats = []
	for i in count:
		var a = TAU * i / count
		var q = _quad(v, Vector3.ZERO, 0.32, GLOW, color, 2.0, false)
		q.reparent(pivot, false)
		q.position = Vector3(cos(a) * 0.75, sin(a * 2.0) * 0.25, sin(a) * 0.75)
		mats.append(q.material_override)
	var tw = v.create_tween()
	var fade = func(x):
		for m in mats: m.set_shader_parameter("t", x)
	tw.tween_method(fade, 0.0, 1.0, life)
	tw.parallel().tween_property(pivot, "rotation:y", TAU * 1.5, life)
	tw.tween_callback(pivot.queue_free)


## Drops of life drawn out of one figure into another.
static func drain(v: Node3D, from: Unit, to: Unit, color: Color, delay := 0.0) -> void:
	if not await _wait(v, delay): return
	for i in 3:
		if not is_instance_valid(from) or not is_instance_valid(to): return
		bolt(v, _chest(v, from), _chest(v, to), color, 0.1, 6.0)
		await v.get_tree().create_timer(0.1).timeout
	await v.get_tree().create_timer(0.35).timeout
	if is_instance_valid(to): flash(v, _chest(v, to), color, 1.0, 0.4, 0.0, false)


# ── spells that chain their pieces ──────────────────────────────────────────
static func _bolt_hit(v: Node3D, from: Unit, to: Unit, color: Color, size: float, speed: float, delay: float, rim := Color.BLACK) -> void:
	if not await _wait(v, delay): return
	await bolt(v, v.to_local(from.hand()), _chest(v, to), color, size, speed)
	if not is_instance_valid(to): return
	flash(v, _chest(v, to), color, 1.5, 0.45)
	sparks(v, _chest(v, to), color, 16, 0.11, 0.6, 2.2, -2.0)
	if rim != Color.BLACK: ring(v, _feet(v, to), rim, 0.9, 0.55)


static func _icy(v: Node3D, from: Unit, to: Unit, delay: float, size: float) -> void:
	if not await _wait(v, delay): return
	await bolt(v, v.to_local(from.hand()), _chest(v, to), FROST, size, 13.0)
	if not is_instance_valid(to): return
	flash(v, _chest(v, to), FROST, 1.3, 0.4)
	sparks(v, _chest(v, to), Color(0.85, 0.95, 1.0), 18, 0.08, 0.7, 2.4, -6.0)
	ring(v, _feet(v, to), FROST, 0.8, 0.7)


static func _plague_bolt(v: Node3D, from: Unit, to: Unit, delay: float) -> void:
	if not await _wait(v, delay): return
	await bolt(v, v.to_local(from.hand()), _chest(v, to), PLAGUE, 0.2, 9.0)
	if not is_instance_valid(to): return
	flash(v, _chest(v, to), PLAGUE, 1.2, 0.4, 0.0, false)
	motes(v, _chest(v, to), PLAGUE, 14, 1.0, 1.6, 0.4, 0.3, 0.24)


static func _hammer(v: Node3D, from: Unit, to: Unit, delay: float) -> void:
	if not await _wait(v, delay): return
	await thrown(v, "warhammer", v.to_local(from.hand()), _chest(v, to), HOLY, 11.0)
	if not is_instance_valid(to): return
	flash(v, _chest(v, to), HOLY, 1.8, 0.45)
	sparks(v, _chest(v, to), HOLY, 20, 0.11, 0.6, 2.8, -5.0)
	ring(v, _feet(v, to), HOLY, 1.1, 0.5)
	shake(v, 0.2)
	# Stunned: little lights going round the head.
	orbit(v, to, HOLY_WHITE, 3, 1.2)


static func _holy_shock(v: Node3D, from: Unit, to: Unit, delay: float) -> void:
	if not await _wait(v, delay): return
	if to != from: await bolt(v, v.to_local(from.hand()), _chest(v, to), HOLY_WHITE, 0.2, 14.0)
	if not is_instance_valid(to): return
	flash(v, _chest(v, to), HOLY, 1.6, 0.5)
	sparks(v, _chest(v, to), HOLY_WHITE, 18, 0.1, 0.6, 3.0, -1.0)


static func _avengers_shield(v: Node3D, from: Unit, first: Unit, foes: Array, delay: float) -> void:
	if not await _wait(v, delay): return
	var path: Array = [first]
	for f in foes:
		if f != first and path.size() < 3: path.append(f)
	var at = v.to_local(from.hand())
	for u in path:
		if not is_instance_valid(u): return
		var to = _chest(v, u)
		await thrown(v, "roundShield", at, to, HOLY, 12.0)
		flash(v, to, HOLY, 1.4, 0.4, 0.0, u == first)
		sparks(v, to, HOLY, 12, 0.1, 0.5, 2.4, -5.0)
		at = to
	if is_instance_valid(from): thrown(v, "roundShield", at, v.to_local(from.hand()), HOLY, 14.0)


## A comet out of the sky onto a foe.
static func _comet(v: Node3D, u: Unit, delay: float) -> void:
	if not await _wait(v, delay) or not is_instance_valid(u): return
	var to = u.chest()
	var fb = FireballVFX.spawn_and_launch(v, to + Vector3(-1.4, 7.0, 0.9), to, 0.08, Callable(), "comet", 0.0, 16.0)
	fb.impact_reached.connect(func(_at): shake(v, 0.18))


static func _epidemic(v: Node3D, from: Unit, first: Unit, foes: Array, delay: float) -> void:
	if not await _wait(v, delay): return
	await bolt(v, v.to_local(from.hand()), _chest(v, first), PLAGUE, 0.22, 10.0)
	if not is_instance_valid(first): return
	flash(v, _chest(v, first), PLAGUE, 1.5, 0.45)
	ring(v, _feet(v, first), UNHOLY, 1.6, 0.7)
	for f in foes:
		if f == first or not is_instance_valid(f): continue
		bolt(v, _chest(v, first), _chest(v, f), PLAGUE, 0.14, 9.0)
	await v.get_tree().create_timer(0.35).timeout
	for f in foes:
		if not is_instance_valid(f) or f == first: continue
		flash(v, _chest(v, f), PLAGUE, 1.1, 0.4, 0.0, false)
		motes(v, _chest(v, f), PLAGUE, 8, 0.9, 1.0, 0.35, 0.3, 0.2)
