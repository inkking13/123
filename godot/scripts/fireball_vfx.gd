extends Node3D
class_name FireballVFX
## The mage's Fireball, from the owner's FireballVFX: fire gathers in the hand,
## flies in an arc with a comet trail and smoke, and bursts on the target with
## a ring of fire and a scorch mark on the stones.
## Made lighter for a budget phone: shaders, noise and particle meshes are built
## once and shared, the spheres have fewer faces, there are about half the
## particles and no turbulence; low graphics halves them again and drops the light.
## `FireballVFX.spawn_and_launch(parent, from, to)` plays it once.

@export_group("Flight")
@export var flight_speed: float = 14.0 ## m/s
@export var arc_height: float = 1.6 ## How high the arc rises over the field
@export var cast_duration: float = 0.45 ## Fire gathering in the hand before the throw

@export_group("Colours (dark fantasy)")
@export var core_color: Color = Color(1.0, 0.92, 0.65, 1.0)
@export var fire_color: Color = Color(1.0, 0.38, 0.05, 1.0)
@export var dark_flame_color: Color = Color(0.55, 0.08, 0.02, 1.0)
@export var smoke_color: Color = Color(0.12, 0.1, 0.1, 0.5)
@export var burst_glow: float = 1.0 ## How bright the burst is; pale colours need less

signal impact_reached(target_position: Vector3)
signal vfx_finished()

const CORE_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, blend_add, shadows_disabled;

uniform sampler2D noise_tex : repeat_enable, filter_linear_mipmap;
uniform vec4 core_color : source_color = vec4(1.0, 0.95, 0.7, 1.0);
uniform vec4 mid_color : source_color = vec4(1.0, 0.4, 0.05, 1.0);
uniform vec4 edge_color : source_color = vec4(0.6, 0.08, 0.01, 1.0);
uniform float displacement_strength = 0.14;
uniform float scroll_speed = 2.4;
uniform float emission_boost = 3.5;
uniform bool is_corona = false;

void vertex() {
	vec2 uv_scroll = UV + vec2(TIME * scroll_speed * 0.4, TIME * scroll_speed);
	float n = textureLod(noise_tex, uv_scroll, 0.0).r;
	// Stretched back along Z, like a comet.
	vec3 stretch = VERTEX;
	if (stretch.z > 0.0) {
		stretch.z *= 1.35;
	}
	VERTEX = stretch + NORMAL * (n - 0.35) * displacement_strength;
}

void fragment() {
	vec2 uv1 = UV * 1.4 + vec2(TIME * scroll_speed * 0.5, TIME * scroll_speed);
	vec2 uv2 = UV * 2.3 - vec2(TIME * scroll_speed * 0.3, TIME * scroll_speed * 0.8);
	float combined_noise = (texture(noise_tex, uv1).r + texture(noise_tex, uv2).r) * 0.5;
	float fresnel = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.0);
	vec3 col = mix(core_color.rgb, mid_color.rgb, clamp(fresnel * 1.3 + (1.0 - combined_noise) * 0.5, 0.0, 1.0));
	col = mix(col, edge_color.rgb, clamp(pow(fresnel, 1.5) + (0.6 - combined_noise), 0.0, 1.0));
	float alpha = 1.0;
	if (is_corona) {
		alpha = clamp((combined_noise * 1.3 - fresnel * 0.7), 0.0, 1.0) * 0.75;
	} else {
		alpha = clamp(combined_noise + 0.45, 0.0, 1.0);
	}
	ALBEDO = col * emission_boost;
	ALPHA = alpha;
}
"""

const RING_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, blend_add, shadows_disabled;

uniform sampler2D noise_tex : repeat_enable;
uniform vec4 ring_color : source_color = vec4(1.0, 0.45, 0.08, 1.0);
uniform float alpha : hint_range(0.0, 1.0) = 1.0;

void fragment() {
	vec2 centered = UV * 2.0 - 1.0;
	float dist = length(centered);
	float n = texture(noise_tex, UV * 2.5 + vec2(TIME * 1.5)).r;
	// A ring with a ragged, burning edge.
	float ring = smoothstep(0.55, 0.78, dist + n * 0.15) * (1.0 - smoothstep(0.82, 1.0, dist + n * 0.1));
	ALBEDO = ring_color.rgb * 3.8;
	ALPHA = ring * alpha;
}
"""

## Low graphics: half the particles again and no light.
static var low := false
## Shaders, textures and particle meshes every fireball shares, so the phone builds them once.
static var _shared := {}

var _projectile_root: Node3D
var _core_mesh: MeshInstance3D
var _outer_corona_mesh: MeshInstance3D
var _omni_light: OmniLight3D
var _flame_trail: GPUParticles3D
var _smoke_trail: GPUParticles3D
var _ember_sparks: GPUParticles3D

var _explosion_root: Node3D
var _explosion_fire: GPUParticles3D
var _explosion_sparks: GPUParticles3D
var _explosion_debris: GPUParticles3D
var _shockwave_mesh: MeshInstance3D
var _scorch_decal_mesh: MeshInstance3D

var _is_flying: bool = false
var _start_pos: Vector3
var _target_pos: Vector3
var _flight_progress: float = 0.0
var _flight_duration: float = 0.5
var _time_alive: float = 0.0


## Colours for the other spells built on this one.
const PALETTES := {
	"fire": [Color(1.0, 0.92, 0.65), Color(1.0, 0.38, 0.05), Color(0.55, 0.08, 0.02), Color(0.12, 0.1, 0.1, 0.5), 1.0],
	"frost": [Color(0.55, 0.82, 1.0), Color(0.2, 0.5, 0.95), Color(0.05, 0.15, 0.45), Color(0.35, 0.5, 0.7, 0.15), 0.2],
	"comet": [Color(1.0, 0.9, 1.0), Color(0.65, 0.35, 1.0), Color(0.2, 0.06, 0.45), Color(0.15, 0.1, 0.22, 0.45), 0.35],
}


## Sets the colours from PALETTES before it is added to the tree.
func paint(palette: String) -> FireballVFX:
	var c: Array = PALETTES[palette]
	core_color = c[0]
	fire_color = c[1]
	dark_flame_color = c[2]
	smoke_color = c[3]
	burst_glow = c[4]
	return self


## Plays one fireball from `from_pos` to `to_pos` (world space); `cast` is how long it gathers in the hand.
static func spawn_and_launch(parent: Node, from_pos: Vector3, to_pos: Vector3, cast := 0.45, on_hit_callback: Callable = Callable(), palette := "fire", arc := 1.6, speed := 14.0) -> FireballVFX:
	var vfx := FireballVFX.new().paint(palette)
	vfx.cast_duration = cast
	vfx.arc_height = arc
	vfx.flight_speed = speed
	parent.add_child(vfx)
	if on_hit_callback.is_valid():
		vfx.impact_reached.connect(on_hit_callback)
	vfx.launch(from_pos, to_pos)
	return vfx


## Builds every piece once, out of sight, so the first real cast doesn't stall on shader compiles.
static func warm(parent: Node, at: Vector3) -> void:
	var vfx := FireballVFX.new()
	parent.add_child(vfx)
	vfx.global_position = at
	vfx._projectile_root.scale = Vector3.ONE * 0.001
	vfx._omni_light.visible = false
	vfx._explosion_root.visible = true
	vfx._explosion_root.scale = Vector3.ONE * 0.001
	for p in [vfx._flame_trail, vfx._smoke_trail, vfx._ember_sparks, vfx._explosion_fire, vfx._explosion_sparks, vfx._explosion_debris]:
		p.emitting = true
	parent.get_tree().create_timer(0.3).timeout.connect(vfx.queue_free)


static func forget() -> void:
	_shared.clear()


func _ready() -> void:
	low = Game.settings.quality == "low"
	_build_vfx_hierarchy()


func _process(delta: float) -> void:
	_time_alive += delta
	# The light flickers like live flame on the stones.
	if is_instance_valid(_omni_light) and _omni_light.visible:
		var flicker := sin(_time_alive * 28.0) * 0.25 + cos(_time_alive * 43.0) * 0.15
		_omni_light.light_energy = max(0.0, _omni_light.get_meta("base_energy", 4.0) + flicker)
	# Flight along a parabola.
	if _is_flying:
		_flight_progress += delta / _flight_duration
		if _flight_progress >= 1.0:
			_flight_progress = 1.0
			_is_flying = false
			_projectile_root.global_position = _target_pos
			_trigger_impact()
		else:
			var current_pos := _start_pos.lerp(_target_pos, _flight_progress)
			current_pos.y += 4.0 * arc_height * _flight_progress * (1.0 - _flight_progress)
			# The core faces along the path.
			var next_t := minf(1.0, _flight_progress + 0.05)
			var next_pos := _start_pos.lerp(_target_pos, next_t)
			next_pos.y += 4.0 * arc_height * next_t * (1.0 - next_t)
			if next_pos.distance_squared_to(current_pos) > 0.0001:
				_projectile_root.look_at_from_position(current_pos, next_pos, Vector3.UP)
			else:
				_projectile_root.global_position = current_pos


## Gathers in the hand, then flies to the target and bursts.
func launch(from_pos: Vector3, to_pos: Vector3) -> void:
	_start_pos = from_pos
	_target_pos = to_pos
	global_position = from_pos
	_flight_duration = maxf(0.18, _start_pos.distance_to(_target_pos) / maxf(1.0, flight_speed))
	# Cast: the fire gathers.
	_projectile_root.global_position = _start_pos
	_projectile_root.scale = Vector3.ONE * 0.05
	_omni_light.set_meta("base_energy", 0.0)
	_flame_trail.emitting = true
	_smoke_trail.emitting = false
	_ember_sparks.emitting = true
	var cast_tween := create_tween().set_parallel(true)
	cast_tween.tween_property(_projectile_root, "scale", Vector3.ONE, cast_duration).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	cast_tween.tween_method(func(val: float): _omni_light.set_meta("base_energy", val), 0.0, 4.5, cast_duration)
	await cast_tween.finished
	# Flight.
	_smoke_trail.emitting = true
	_flight_progress = 0.0
	_is_flying = true


func _trigger_impact() -> void:
	impact_reached.emit(_target_pos)
	_core_mesh.visible = false
	_outer_corona_mesh.visible = false
	_flame_trail.emitting = false
	_smoke_trail.emitting = false
	_ember_sparks.emitting = false
	_explosion_root.global_position = _target_pos
	_explosion_root.visible = true
	_explosion_fire.restart()
	_explosion_sparks.restart()
	_explosion_debris.restart()
	# A bright flash on the arena, fading.
	_omni_light.global_position = _target_pos
	_omni_light.omni_range = 9.5
	_omni_light.set_meta("base_energy", 11.0 * burst_glow)
	# The ring of fire and the scorch mark. The burst is at chest height; they lie on the floor.
	var floor_y = _target_pos.y - get_parent().to_global(Vector3.ZERO).y
	_shockwave_mesh.position.y = 0.05 - floor_y
	_scorch_decal_mesh.position.y = 0.02 - floor_y
	_shockwave_mesh.scale = Vector3(0.1, 1.0, 0.1)
	var shock_mat := _shockwave_mesh.material_override as ShaderMaterial
	shock_mat.set_shader_parameter("alpha", 1.0)
	_scorch_decal_mesh.scale = Vector3(0.01, 1.0, 0.01)
	var scorch_mat := _scorch_decal_mesh.material_override as StandardMaterial3D
	scorch_mat.albedo_color.a = 0.85
	var impact_tween := create_tween().set_parallel(true)
	impact_tween.tween_property(_shockwave_mesh, "scale", Vector3(4.2, 1.0, 4.2), 0.38).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	impact_tween.tween_method(func(a: float): shock_mat.set_shader_parameter("alpha", a), 1.0, 0.0, 0.38)
	impact_tween.tween_property(_scorch_decal_mesh, "scale", Vector3(2.8, 1.0, 2.8), 0.15).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	impact_tween.tween_property(scorch_mat, "albedo_color:a", 0.0, 2.2).set_delay(0.8)
	impact_tween.tween_method(func(e: float): _omni_light.set_meta("base_energy", e), 11.0 * burst_glow, 0.0, 0.65).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	await get_tree().create_timer(3.1).timeout
	vfx_finished.emit()
	queue_free()


# ── building the pieces ─────────────────────────────────────────────────────
func _build_vfx_hierarchy() -> void:
	_projectile_root = Node3D.new()
	_projectile_root.name = "ProjectileRoot"
	add_child(_projectile_root)
	var noise_tex := _noise_texture()
	var radial_grad_tex := _radial_texture()
	# The white-hot core, and a larger ragged corona round it.
	_core_mesh = MeshInstance3D.new()
	_core_mesh.mesh = _sphere(0.28)
	_core_mesh.material_override = _fireball_material(noise_tex, false)
	_core_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_projectile_root.add_child(_core_mesh)
	_outer_corona_mesh = MeshInstance3D.new()
	_outer_corona_mesh.mesh = _sphere(0.40)
	_outer_corona_mesh.material_override = _fireball_material(noise_tex, true)
	_outer_corona_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_projectile_root.add_child(_outer_corona_mesh)
	_omni_light = OmniLight3D.new()
	_omni_light.light_color = fire_color.lerp(Color.WHITE, 0.2)
	_omni_light.light_energy = 4.0
	_omni_light.omni_range = 6.0
	_omni_light.omni_attenuation = 1.4
	_omni_light.shadow_enabled = false
	_omni_light.visible = not low
	_projectile_root.add_child(_omni_light)
	_flame_trail = _flame_trail_particles(radial_grad_tex)
	_projectile_root.add_child(_flame_trail)
	_smoke_trail = _smoke_trail_particles(radial_grad_tex)
	_projectile_root.add_child(_smoke_trail)
	_ember_sparks = _ember_particles(radial_grad_tex)
	_projectile_root.add_child(_ember_sparks)
	# The burst, hidden until the hit.
	_explosion_root = Node3D.new()
	_explosion_root.name = "ExplosionRoot"
	_explosion_root.visible = false
	add_child(_explosion_root)
	_explosion_fire = _explosion_fire_particles(radial_grad_tex)
	_explosion_root.add_child(_explosion_fire)
	_explosion_sparks = _explosion_sparks_particles(radial_grad_tex)
	_explosion_root.add_child(_explosion_sparks)
	_explosion_debris = _explosion_smoke_particles(radial_grad_tex)
	_explosion_root.add_child(_explosion_debris)
	# A ring running over the floor, so the reach reads from above.
	_shockwave_mesh = MeshInstance3D.new()
	_shockwave_mesh.mesh = _plane()
	_shockwave_mesh.position = Vector3(0, 0.05, 0)
	var ring := ShaderMaterial.new()
	ring.shader = _shader("ring", RING_SHADER)
	ring.set_shader_parameter("noise_tex", noise_tex)
	ring.set_shader_parameter("ring_color", Color(fire_color * burst_glow, 1.0))
	ring.set_shader_parameter("alpha", 0.0)
	_shockwave_mesh.material_override = ring
	_shockwave_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_explosion_root.add_child(_shockwave_mesh)
	# Soot on the stones.
	_scorch_decal_mesh = MeshInstance3D.new()
	_scorch_decal_mesh.mesh = _plane()
	_scorch_decal_mesh.position = Vector3(0, 0.02, 0)
	var scorch_mat := StandardMaterial3D.new()
	scorch_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	scorch_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	scorch_mat.albedo_color = Color(0.05, 0.03, 0.02, 0.85)
	scorch_mat.albedo_texture = radial_grad_tex
	_scorch_decal_mesh.material_override = scorch_mat
	_scorch_decal_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_explosion_root.add_child(_scorch_decal_mesh)


static func _cached(key: String, make: Callable):
	if not _shared.has(key): _shared[key] = make.call()
	return _shared[key]


static func _shader(key: String, code: String) -> Shader:
	return _cached("shader:" + key, func():
		var s := Shader.new()
		s.code = code
		return s)


static func _sphere(radius: float) -> SphereMesh:
	return _cached("sphere:%s" % radius, func():
		var s := SphereMesh.new()
		s.radius = radius
		s.height = radius * 2.0
		s.radial_segments = 16
		s.rings = 8
		return s)


static func _plane() -> PlaneMesh:
	return _cached("plane", func():
		var q := PlaneMesh.new()
		q.size = Vector2(1.0, 1.0)
		return q)


static func _noise_texture() -> NoiseTexture2D:
	return _cached("noise", func():
		var noise := FastNoiseLite.new()
		noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
		noise.frequency = 0.07
		noise.fractal_type = FastNoiseLite.FRACTAL_FBM
		noise.fractal_octaves = 3
		var tex := NoiseTexture2D.new()
		tex.width = 128
		tex.height = 128
		tex.seamless = true
		tex.generate_mipmaps = true
		tex.noise = noise
		return tex)


static func _radial_texture() -> GradientTexture2D:
	return _cached("radial", func():
		var grad := Gradient.new()
		grad.offsets = PackedFloat32Array([0.0, 0.35, 0.7, 1.0])
		grad.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.8), Color(1, 1, 1, 0.25), Color(1, 1, 1, 0)])
		var tex := GradientTexture2D.new()
		tex.width = 64
		tex.height = 64
		tex.fill = GradientTexture2D.FILL_RADIAL
		tex.fill_from = Vector2(0.5, 0.5)
		tex.fill_to = Vector2(0.5, 0.0)
		tex.gradient = grad
		return tex)


func _fireball_material(noise_tex: Texture2D, is_outer_corona: bool) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = _shader("core", CORE_SHADER)
	mat.set_shader_parameter("noise_tex", noise_tex)
	mat.set_shader_parameter("core_color", core_color)
	mat.set_shader_parameter("mid_color", fire_color)
	mat.set_shader_parameter("edge_color", dark_flame_color)
	mat.set_shader_parameter("displacement_strength", 0.22 if is_outer_corona else 0.11)
	mat.set_shader_parameter("scroll_speed", 3.1 if is_outer_corona else 2.2)
	mat.set_shader_parameter("emission_boost", 2.6 if is_outer_corona else 4.2)
	mat.set_shader_parameter("is_corona", is_outer_corona)
	return mat


static func _quad(tex: Texture2D, size: float, additive: bool) -> QuadMesh:
	return _cached("quad:%s:%s" % [size, additive], func():
		var quad := QuadMesh.new()
		quad.size = Vector2(size, size)
		if additive:
			# Glowing bits share the spell shader: soft round sprites that keep their fade on every renderer.
			var glow := ShaderMaterial.new()
			glow.shader = SpellFx.SHADER
			glow.set_shader_parameter("shape", SpellFx.GLOW)
			glow.set_shader_parameter("billboard", true)
			glow.set_shader_parameter("particle", true)
			glow.set_shader_parameter("t", 0.2)
			glow.set_shader_parameter("energy", 1.6)
			quad.material = glow
			return quad
		var mat := StandardMaterial3D.new()
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD if additive else BaseMaterial3D.BLEND_MODE_MIX
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.vertex_color_use_as_albedo = true
		mat.albedo_texture = tex
		mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		mat.billboard_keep_scale = true
		mat.disable_receive_shadows = true
		quad.material = mat
		return quad)


static func _ramp(colors: Array, offsets: Array) -> GradientTexture1D:
	var grad := Gradient.new()
	grad.offsets = PackedFloat32Array(offsets)
	grad.colors = PackedColorArray(colors)
	var tex := GradientTexture1D.new()
	tex.gradient = grad
	return tex


static func _scale_curve(start_val: float, peak_val: float, end_val: float) -> CurveTexture:
	var curve := Curve.new()
	curve.max_value = maxf(1.0, maxf(start_val, maxf(peak_val, end_val)))
	curve.add_point(Vector2(0.0, start_val))
	curve.add_point(Vector2(0.25, peak_val))
	curve.add_point(Vector2(1.0, end_val))
	var tex := CurveTexture.new()
	tex.curve = curve
	return tex


## A particle system with `amount` cut for the phone (and again on low graphics).
func _particles(pname: String, amount: int, lifetime: float, quad: QuadMesh) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.name = pname
	# Not until launch has put the fireball in the hand, or the first puffs come out at the field's centre.
	p.emitting = false
	p.amount = maxi(4, amount / 2 if low else amount)
	p.lifetime = lifetime
	p.local_coords = false
	p.draw_pass_1 = quad
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	p.visibility_aabb = AABB(Vector3(-6, -3, -6), Vector3(12, 8, 12))
	return p


func _palette() -> String:
	return "%s/%s/%s/%s/%s" % [core_color.to_html(), fire_color.to_html(), dark_flame_color.to_html(), smoke_color.to_html(), burst_glow]


func _process_material(key: String, make: Callable) -> ParticleProcessMaterial:
	return _cached("pm:%s:%s" % [key, _palette()], make)


func _flame_trail_particles(tex: Texture2D) -> GPUParticles3D:
	var p := _particles("FlameTrailParticles", 40, 0.45, _quad(tex, 0.65, true))
	p.process_material = _process_material("flame", func():
		var mat := ParticleProcessMaterial.new()
		mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
		mat.emission_sphere_radius = 0.16
		mat.direction = Vector3(0, 1, 0)
		mat.spread = 35.0
		mat.initial_velocity_min = 0.4
		mat.initial_velocity_max = 1.2
		mat.gravity = Vector3(0, 2.2, 0)
		mat.damping_min = 1.5
		mat.damping_max = 3.0
		mat.angle_min = -180.0
		mat.angle_max = 180.0
		mat.angular_velocity_min = -90.0
		mat.angular_velocity_max = 90.0
		mat.scale_curve = _scale_curve(0.85, 1.15, 0.1)
		mat.color_ramp = _ramp([Color(core_color, 0.95), Color(fire_color, 0.85), Color(dark_flame_color, 0.45), Color(dark_flame_color * 0.35, 0.0)], [0.0, 0.3, 0.7, 1.0])
		return mat)
	return p


func _smoke_trail_particles(tex: Texture2D) -> GPUParticles3D:
	var p := _particles("SmokeTrailParticles", 20, 0.85, _quad(tex, 0.6, false))
	p.process_material = _process_material("smoke", func():
		var mat := ParticleProcessMaterial.new()
		mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
		mat.emission_sphere_radius = 0.22
		mat.direction = Vector3(0, 1, 0)
		mat.spread = 45.0
		mat.initial_velocity_min = 0.3
		mat.initial_velocity_max = 0.9
		mat.gravity = Vector3(0, 1.6, 0)
		mat.scale_curve = _scale_curve(0.4, 1.0, 1.65)
		mat.color_ramp = _ramp([Color(dark_flame_color, 0.0), smoke_color, Color(0.08, 0.07, 0.07, 0.25), Color(0.05, 0.05, 0.05, 0.0)], [0.0, 0.2, 0.65, 1.0])
		return mat)
	return p


func _ember_particles(tex: Texture2D) -> GPUParticles3D:
	var p := _particles("EmberSparks", 24, 0.6, _quad(tex, 0.14, true))
	p.process_material = _process_material("embers", func():
		var mat := ParticleProcessMaterial.new()
		mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
		mat.emission_sphere_radius = 0.28
		mat.spread = 180.0
		mat.initial_velocity_min = 1.2
		mat.initial_velocity_max = 3.2
		mat.gravity = Vector3(0, -3.5, 0)
		# Turbulence costs a weak GPU too much; a little damping keeps the embers wandering.
		mat.damping_min = 0.5
		mat.damping_max = 1.5
		mat.scale_curve = _scale_curve(1.0, 0.8, 0.0)
		mat.color_ramp = _ramp([Color(core_color, 1.0), Color(fire_color, 1.0), Color(dark_flame_color, 0.0)], [0.0, 0.6, 1.0])
		return mat)
	return p


func _explosion_fire_particles(tex: Texture2D) -> GPUParticles3D:
	var p := _particles("ExplosionFire", 32, 0.65, _quad(tex, 1.25, true))
	p.emitting = false
	p.one_shot = true
	p.explosiveness = 0.92
	p.process_material = _process_material("burst", func():
		var mat := ParticleProcessMaterial.new()
		mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
		mat.emission_sphere_radius = 0.35
		mat.direction = Vector3(0, 1, 0)
		mat.spread = 85.0
		mat.initial_velocity_min = 2.5
		mat.initial_velocity_max = 6.5
		mat.gravity = Vector3(0, 2.0, 0)
		mat.damping_min = 4.5
		mat.damping_max = 7.5
		mat.scale_curve = _scale_curve(0.5, 1.35, 0.2)
		mat.color_ramp = _ramp([Color(core_color.lerp(Color.WHITE, 0.4), burst_glow), Color(fire_color, 0.95 * burst_glow), Color(dark_flame_color, 0.6 * burst_glow), Color(dark_flame_color * 0.25, 0.0)], [0.0, 0.25, 0.65, 1.0])
		return mat)
	return p


func _explosion_sparks_particles(tex: Texture2D) -> GPUParticles3D:
	var p := _particles("ExplosionSparks", 40, 0.95, _quad(tex, 0.18, true))
	p.emitting = false
	p.one_shot = true
	p.explosiveness = 0.95
	p.process_material = _process_material("sparks", func():
		var mat := ParticleProcessMaterial.new()
		mat.direction = Vector3(0, 1, 0)
		mat.spread = 80.0
		mat.initial_velocity_min = 5.0
		mat.initial_velocity_max = 12.0
		mat.gravity = Vector3(0, -14.0, 0)
		mat.damping_min = 1.0
		mat.damping_max = 2.5
		mat.scale_curve = _scale_curve(1.2, 0.9, 0.0)
		mat.color_ramp = _ramp([Color(core_color, 1.0), Color(fire_color, 1.0), Color(dark_flame_color, 0.0)], [0.0, 0.55, 1.0])
		return mat)
	return p


func _explosion_smoke_particles(tex: Texture2D) -> GPUParticles3D:
	var p := _particles("ExplosionSmoke", 18, 1.4, _quad(tex, 0.9, false))
	p.emitting = false
	p.one_shot = true
	p.explosiveness = 0.85
	p.process_material = _process_material("burst-smoke", func():
		var mat := ParticleProcessMaterial.new()
		mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
		mat.emission_sphere_radius = 0.5
		mat.direction = Vector3(0, 1, 0)
		mat.spread = 75.0
		mat.initial_velocity_min = 1.2
		mat.initial_velocity_max = 3.8
		mat.gravity = Vector3(0, 1.8, 0)
		mat.damping_min = 2.0
		mat.damping_max = 4.0
		mat.scale_curve = _scale_curve(0.6, 1.2, 1.9)
		mat.color_ramp = _ramp([Color(dark_flame_color, 0.0), Color(smoke_color, 0.45), Color(0.08, 0.07, 0.07, 0.25), Color(0.05, 0.05, 0.05, 0.0)], [0.0, 0.18, 0.65, 1.0])
		return mat)
	return p
