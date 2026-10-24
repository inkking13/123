class_name Unit
extends Node3D
## One fighter on the board: a Meshy body from the game, its armour set, what
## it holds, its clips, a blob shadow, a health bar and the picking capsule.
## Ported from app/src/battle3d (MeshyModel.tsx, Wardrobe.tsx) so the heroes
## look the same in both versions.

signal picked(unit: Unit)

# ── bodies ──────────────────────────────────────────────────────────────────
# Meshy's combat set runs 2–4 s a clip; sped up so the blow lands inside a turn.
const COMBAT_SPEED := {"Attack": 2.0, "Double_Combo_Attack": 2.1, "Charged_Slash": 1.6, "Charged_Spell_Cast": 1.8,
	"Hit_Reaction": 1.4, "Dead": 1.3, "Thrust_Slash": 1.4, "Archery_Shot": 1.3}

const BODIES := {
	"human": {"file": "human", "height": 1.12, "fist": 0.11, "idle": "Idle", "run": "run", "hit": "Hit_Reaction", "death": "Dead",
		"acts": {"melee": "attack", "heal": "cast1", "ranged": "cast6"}, "wardrobe": "human",
		"speed": {"attack": 1.6, "cast1": 1.8, "cast6": 1.3}},
	"dwarf": {"file": "dwarf", "height": 1.0, "fist": 0.125, "idle": "idle", "run": "run", "hit": "Hit_Reaction", "death": "Dead",
		"acts": {"melee": "bash"}, "wardrobe": "dwarf", "speed": {"bash": 1.5}},
	"elf": {"file": "elf", "height": 1.2, "fist": 0.08, "idle": "Idle", "run": "run", "hit": "Hit_Reaction", "death": "Dead",
		"acts": {"ranged": "Archery_Shot", "melee": "Attack"}, "wardrobe": "elf", "speed": {}},
	"skeleton": {"file": "skeleton", "height": 1.2, "fist": 0.075, "idle": "idle", "run": "run", "hit": "Hit_Reaction", "death": "Dead",
		"acts": {"melee": "Thrust_Slash", "ranged": "Archery_Shot", "magic": "Charged_Spell_Cast"}, "speed": {"attack": 2.0}},
	"elfMale": {"file": "elf-male", "height": 1.2, "fist": 0.08, "idle": "Long_Breathe_and_Look_Around", "run": "Running", "hit": "Hit_Reaction", "death": "Dead",
		"acts": {"melee": "mage_soell_cast_3", "ranged": "mage_soell_cast_6", "heal": "mage_soell_cast_4", "ability": "Charged_Spell_Cast", "rally": "mage_soell_cast_7"},
		"wardrobe": "elf-male", "speed": {"mage_soell_cast_3": 1.6, "mage_soell_cast_4": 1.3, "mage_soell_cast_6": 1.3, "mage_soell_cast_7": 1.4}},
	"orc": {"file": "orc", "height": 1.3, "model_h": 2.0, "fist": 0.11, "idle": "Idle", "run": "RunFast", "hit": "Hit_Reaction", "death": "Dead",
		"acts": {"melee": "Heavy_Hammer_Swing", "ability": "Triple_Combo_Attack", "rally": "Chest_Pound_Taunt", "heal": "Chest_Pound_Taunt"},
		"wardrobe": "orc", "speed": {"Heavy_Hammer_Swing": 1.4, "Chest_Pound_Taunt": 1.6}},
}
const MODEL_H := 1.7
## Actions play their whole clip, sped up only as far as it takes to fit this long.
const ACTION_S := 2.2
## No clip runs faster than this: beyond it motion looks wound up.
const MAX_SPEED := 1.6

# ── held props ──────────────────────────────────────────────────────────────
# Baked in metres, grip at the origin, head or blade up +Y; shields face -X.
const PROPS := {
	"mace": {"file": "weapon-mace", "scale": 1.0, "how": "fist"},
	"handAxe": {"file": "weapon-hand-axe", "scale": 1.0, "how": "fist"},
	"longsword": {"file": "weapon-longsword", "scale": 1.0, "how": "fist"},
	"boneSword": {"file": "weapon-bone-sword", "scale": 1.0, "how": "fist"},
	"flask": {"file": "weapon-flask", "scale": 0.6, "how": "upright", "shine": true},
	"bow": {"file": "weapon-bow", "scale": 1.15, "how": "upright", "wood": true},
	"staff": {"file": "weapon-staff", "scale": 1.25, "how": "upright", "wood": true},
	"roundShield": {"file": "shield-round", "scale": 1.2, "how": "shield", "wood": true},
	"skullShield": {"file": "shield-skull", "scale": 1.35, "how": "shield"},
	"dagger": {"file": "weapon-dagger", "scale": 1.0, "how": "fist"},
	"greatAxe": {"file": "weapon-greataxe", "scale": 1.15, "how": "fist"},
	"warhammer": {"file": "weapon-warhammer", "scale": 0.85, "how": "fist"},
	"runeAxe": {"file": "rune-axe", "scale": 0.5, "how": "fist"},
	"orb": {"file": "weapon-orb", "scale": 0.6, "how": "upright", "shine": true},
}
## From the wrist to the middle of the fist, into the palm, out of the back of the hand (m).
const TO_FIST := 0.075
const TO_PALM := 0.025
const TO_BACK := 0.05

# ── armour ──────────────────────────────────────────────────────────────────
## Plain kit: the long cloak of each set stays off.
const PIECES := ["hood", "jacket", "shoulders", "belt", "gloves", "pants", "boots"]
## What of the body each piece covers; the body is cut away under it.
const COVERS := {"jacket": ["torso"], "shoulders": ["upperArm"], "gloves": ["hand", "forearm"],
	"pants": ["pelvis", "thigh"], "boots": ["foot", "shin"]}
const CLOSED_HELM := {"knight": true, "templar": true, "arcane": false, "leather": false}

# ── state ───────────────────────────────────────────────────────────────────
var display_name = ""
var team = 0 # 0 heroes, 1 enemies
var role = "melee" # melee, ranged, heal, magic
var max_hp = 100
var hp = 100
var atk = Vector2i(10, 15)
var initiative = 10
var home = Vector3.ZERO
var face_yaw = 0.0
var alive = true

var _body: Dictionary
var _visual: Node3D
var _skel: Skeleton3D
var _anim: AnimationPlayer
var _hips = -1
var _hips_xz = Vector2.ZERO
var _steady: Array = [] # {holder, hand, local, idle, upright}
var _idle_w = 1.0
var _bar_fill: MeshInstance3D
var _ring: MeshInstance3D
var _ring_mat: StandardMaterial3D


func setup(spec: Dictionary) -> void:
	display_name = spec.name
	team = spec.team
	role = spec.role
	max_hp = spec.hp
	hp = max_hp
	atk = spec.atk
	initiative = spec.init
	_body = BODIES[spec.body].duplicate(true)
	if spec.has("acts"): _body.acts.merge(spec.acts, true)
	_visual = Node3D.new()
	add_child(_visual)
	var k: float = _body.height / _body.get("model_h", MODEL_H) * spec.get("scale", 1.0)
	_body.height *= spec.get("scale", 1.0)
	_visual.scale = Vector3.ONE * k

	var model: Node3D = load("res://assets/models/%s.glb" % _body.file).instantiate()
	_visual.add_child(model)
	_skel = model.find_child("Skeleton3D", true, false)
	_anim = model.find_child("AnimationPlayer", true, false)
	_anim.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	_hips = _skel.find_bone("mixamorig_Hips")
	var body_mesh: MeshInstance3D = null
	for c in _skel.get_children():
		if c is MeshInstance3D:
			body_mesh = c
	_finish(body_mesh, "skin")

	for clip in [_body.idle, _body.run]:
		var a = _anim.get_animation(clip)
		if a: a.loop_mode = Animation.LOOP_LINEAR

	if spec.has("set"):
		_dress(body_mesh, spec.set)

	# The hands' turn at rest and in the first frame of idle aim what they hold.
	_anim.play(_body.idle)
	_anim.seek(0.0, true)
	_hips_xz = Vector2(_skel.get_bone_pose_position(_hips).x, _skel.get_bone_pose_position(_hips).z)
	var hand_r = _skel.find_bone("mixamorig_RightHand")
	var hand_l = _skel.find_bone("mixamorig_LeftHand")
	var right: String = spec.get("right", "")
	var left: String = spec.get("left", "")
	# Bows go in the left hand.
	if right == "bow":
		left = "bow"
		right = ""
	if right != "": _hold(right, hand_r, body_mesh, false, spec.get("glow", Color.WHITE))
	if left != "": _hold(left, hand_l, body_mesh, true, spec.get("glow", Color.WHITE))

	# Out of step with each other: each idle starts at its own point.
	var idle = _anim.get_animation(_body.idle)
	_anim.seek(randf() * idle.length, true)
	_anim.speed_scale = 1.0

	_add_shadow()
	_add_ring()
	_add_bar()
	_add_picker()


# ── materials ───────────────────────────────────────────────────────────────
## Matte skin and cloth, leather with a sheen, plate that catches the torches.
func _finish(mesh: MeshInstance3D, finish: String) -> void:
	var rough = {"skin": 0.7, "cloth": 0.92, "leather": 0.62, "metal": 0.4}
	var metal = {"skin": 0.0, "cloth": 0.0, "leather": 0.05, "metal": 0.45}
	for s in mesh.mesh.get_surface_count():
		var m = mesh.get_active_material(s)
		if m is StandardMaterial3D:
			var d: StandardMaterial3D = m.duplicate()
			d.roughness = rough[finish]
			d.metallic = metal[finish]
			d.roughness_texture = null
			d.metallic_texture = null
			mesh.set_surface_override_material(s, d)


func _piece_finish(set_id: String, piece: String) -> String:
	if piece == "cloak": return "cloth"
	if piece == "belt": return "leather"
	if set_id == "knight": return "metal"
	if set_id == "templar": return "cloth" if piece == "jacket" else "metal"
	if set_id == "arcane": return "leather" if piece == "gloves" or piece == "boots" else "cloth"
	return "leather"


# ── armour ──────────────────────────────────────────────────────────────────
## Moves the set's skinned pieces onto this body's skeleton (they bind by bone
## name) and cuts away the body under them.
func _dress(body_mesh: MeshInstance3D, set_id: String) -> void:
	var src: Node3D = load("res://assets/models/wardrobe/%s-%s.glb" % [set_id, _body.wardrobe]).instantiate()
	var hidden = {}
	var hood_back = INF
	var hood_top = -INF
	var open_hood = false
	for piece in PIECES:
		var m = src.find_child("armour_" + piece, true, false) as MeshInstance3D
		if m == null: continue
		m.owner = null
		m.get_parent().remove_child(m)
		_skel.add_child(m)
		m.skeleton = NodePath("..")
		_finish(m, _piece_finish(set_id, piece))
		for part in COVERS.get(piece, []): hidden[part] = true
		if piece == "hood":
			if CLOSED_HELM[set_id]:
				hidden["head"] = true
			else:
				var box = m.get_aabb()
				open_hood = true
				hood_back = box.position.z
				hood_top = box.end.y
	src.free()
	_cut_body(body_mesh, hidden, open_hood, hood_back, hood_top)


static func _part_of(bone: String) -> String:
	if bone.contains("Head") or bone.contains("Neck") or bone.contains("neck"): return "head"
	if bone.contains("Hand"): return "hand"
	if bone.contains("ForeArm"): return "forearm"
	if bone.ends_with("Arm"): return "upperArm"
	if bone.contains("Spine") or bone.contains("Shoulder"): return "torso"
	if bone.contains("Hips"): return "pelvis"
	if bone.contains("UpLeg"): return "thigh"
	if bone.contains("Foot") or bone.contains("Toe"): return "foot"
	if bone.ends_with("Leg"): return "shin"
	return "other"


## Drops the body's triangles where its strongest bone lies under armour.
## Under an open hood only the face shows: the back of the head and its hair go.
func _cut_body(mi: MeshInstance3D, hidden: Dictionary, open_hood: bool, hood_back: float, hood_top: float) -> void:
	if hidden.is_empty() and not open_hood: return
	var src: Mesh = mi.mesh
	var out = ArrayMesh.new()
	var mats: Array[Material] = []
	for s in src.get_surface_count():
		var arrays = src.surface_get_arrays(s)
		var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var bones: PackedInt32Array = arrays[Mesh.ARRAY_BONES]
		var weights: PackedFloat32Array = arrays[Mesh.ARRAY_WEIGHTS]
		var per = bones.size() / verts.size()
		var cut = PackedByteArray()
		cut.resize(verts.size())
		for i in verts.size():
			var best = 0
			for k in range(1, per):
				if weights[i * per + k] > weights[i * per + best]: best = k
			var part = _part_of(mi.skin.get_bind_name(bones[i * per + best]))
			var c = hidden.has(part)
			if not c and part == "head" and open_hood:
				c = verts[i].z < hood_back + 0.07 or verts[i].y > hood_top - 0.08
			cut[i] = 1 if c else 0
		var index: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
		var keep = PackedInt32Array()
		for t in range(0, index.size(), 3):
			if cut[index[t]] + cut[index[t + 1]] + cut[index[t + 2]] < 2:
				keep.append_array([index[t], index[t + 1], index[t + 2]])
		# A part wholly covered (hair under a closed helm) goes altogether.
		if keep.is_empty(): continue
		arrays[Mesh.ARRAY_INDEX] = keep
		var flags = Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS if per == 8 else 0
		out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays, [], {}, flags)
		mats.append(mi.get_active_material(s))
	mi.mesh = out
	for s in mats.size():
		mi.set_surface_override_material(s, mats[s])


# ── held props ──────────────────────────────────────────────────────────────
## Model-space turn of a bone in the skin's bind pose (arms down, thumbs forward).
func _rest_q(mesh: MeshInstance3D, bone: int) -> Quaternion:
	var name = _skel.get_bone_name(bone)
	for i in mesh.skin.get_bind_count():
		if mesh.skin.get_bind_name(i) == name:
			return mesh.skin.get_bind_pose(i).affine_inverse().basis.get_rotation_quaternion()
	return _skel.get_bone_global_rest(bone).basis.get_rotation_quaternion()


## The prop's turn and place in a hand bone (see gripIn in MeshyModel.tsx).
## The rigs have no finger bones and each clip twists the hand its own way,
## so the aim is set in the first frame of idle.
static func _grip(rest: Quaternion, pose: Quaternion, left: bool, how: String, to_fist: float) -> Dictionary:
	var to_bone = rest.inverse()
	var F := rest * Vector3.UP
	var T := (Vector3(0, 0, 1) - F * F.z).normalized()
	var P := F.cross(T) if left else T.cross(F)
	var to_idle = pose * to_bone
	var out = 1.0 if left else -1.0
	var x: Vector3
	var y: Vector3
	if how == "shield":
		x = P
		y = -F
	else:
		if how == "upright":
			y = to_idle.inverse() * Vector3(0.1 * out, 1, 0.1).normalized()
		else:
			# Carried up at the side, leaning out and a little forward, clear of the hip.
			y = to_idle.inverse() * Vector3(0.6 * out, 1, 0.3).normalized()
		x = y.cross(P)
		if x.length_squared() < 1e-4: x = y.cross(F)
		x = x.normalized()
	var basis = Basis(x, y, x.cross(y))
	var q = to_bone * basis.get_rotation_quaternion()
	var reach = TO_FIST if how == "shield" else to_fist
	var side = -TO_BACK if how == "shield" else TO_PALM
	var pos = Vector3(0, reach, 0) + to_bone * (P * side)
	return {"q": q, "pos": pos}


func _hold(prop: String, hand: int, body_mesh: MeshInstance3D, left: bool, glow: Color) -> void:
	var p: Dictionary = PROPS[prop]
	var model: Node3D = load("res://assets/models/%s.glb" % p.file).instantiate()
	for m in model.find_children("*", "MeshInstance3D", true, false):
		_finish(m, "leather" if p.get("wood", false) else "metal")
		if p.get("shine", false):
			for s in m.mesh.get_surface_count():
				var mat: StandardMaterial3D = m.get_active_material(s)
				mat.emission_enabled = true
				mat.emission = glow
				mat.emission_texture = mat.albedo_texture
				mat.emission_energy_multiplier = 0.7
	model.scale = Vector3.ONE * p.scale
	var rest = _rest_q(body_mesh, hand)
	var pose = _skel.get_bone_global_pose(hand).basis.get_rotation_quaternion()
	var g = _grip(rest, pose, left, p.how, _body.fist)
	var holder = Node3D.new()
	holder.add_child(model)
	_skel.add_child(holder)
	_steady.append({"holder": holder, "hand": hand, "grip": g.q, "pos": g.pos, "idle": pose * g.q, "upright": p.how == "upright"})


## Held things keep their idle stand while idle plays, so they follow the hand
## only in actions; a staff, bow or flask always stays upright.
func _steady_props() -> void:
	for s in _steady:
		var hand_pose = _skel.get_bone_global_pose(s.hand)
		var hq = hand_pose.basis.get_rotation_quaternion()
		var w = 1.0 if s.upright else _idle_w
		var target: Quaternion = (hq * s.grip).slerp(s.idle, w)
		var local = hq.inverse() * target
		s.holder.transform = Transform3D(hand_pose.basis, hand_pose.origin) * Transform3D(Basis(local), s.pos)


# ── per frame ───────────────────────────────────────────────────────────────
func _process(delta: float) -> void:
	_anim.advance(delta)
	# Meshy clips drift the hips; keep the body on its spot.
	if _hips >= 0:
		var p = _skel.get_bone_pose_position(_hips)
		_skel.set_bone_pose_position(_hips, Vector3(_hips_xz.x, p.y, _hips_xz.y))
	var idle_now: bool = alive and _anim.current_animation == _body.idle
	_idle_w = move_toward(_idle_w, 1.0 if idle_now else 0.0, delta * 5.0)
	_steady_props()
	if _ring.visible:
		var t = Time.get_ticks_msec() / 1000.0
		_ring_mat.albedo_color.a = 0.55 + 0.35 * sin(t * 5.0)


# ── clips ───────────────────────────────────────────────────────────────────
func _speed_of(clip: String) -> float:
	var wish: float = _body.speed.get(clip, COMBAT_SPEED.get(clip, 1.0))
	var a = _anim.get_animation(clip)
	if a == null: return 1.0
	if wish <= 1.0: return wish
	return max(min(wish, MAX_SPEED), a.length / ACTION_S)


## Plays an action clip once; returns how long it runs.
func play_action(kind: String) -> float:
	var clip: String = _body.acts.get(kind, _body.acts.values()[0])
	if not _anim.has_animation(clip):
		clip = _body.acts.values()[0]
		if not _anim.has_animation(clip): return 0.5
	var sp = _speed_of(clip)
	_anim.play(clip, 0.15, sp)
	return _anim.get_animation(clip).length / sp


func play_idle() -> void:
	if alive: _anim.play(_body.idle, 0.25)


func play_run() -> void:
	_anim.play(_body.run, 0.15, 1.2)


func play_hit() -> void:
	var sp = _speed_of(_body.hit)
	_anim.play(_body.hit, 0.1, sp)
	await get_tree().create_timer(_anim.get_animation(_body.hit).length / sp * 0.9).timeout
	if _anim.current_animation == _body.hit: play_idle()


func play_death() -> void:
	alive = false
	_anim.play(_body.death, 0.15, _speed_of(_body.death))
	set_bar_visible(false)
	set_ring(false)


# ── health, rings, picking ──────────────────────────────────────────────────
## Health as a share of the maximum, from the battle's state.
func set_ratio(r: float) -> void:
	r = clampf(r, 0.0, 1.0)
	_bar_fill.scale.x = max(r, 0.001)
	_bar_fill.position.x = -(1.0 - r) * 0.5 * 0.9


func take(amount: int) -> void:
	hp = clampi(hp - amount, 0, max_hp)
	var r = float(hp) / max_hp
	_bar_fill.scale.x = max(r, 0.001)
	_bar_fill.position.x = -(1.0 - r) * 0.5 * 0.9
	if hp == 0: play_death()


func set_bar_visible(v: bool) -> void:
	_bar_fill.get_parent().visible = v


func set_ring(on: bool, color := Color(1, 0.82, 0.45)) -> void:
	_ring.visible = on
	_ring_mat.albedo_color = Color(color, 0.8)


func face(target: Vector3) -> void:
	var d = target - global_position
	rotation.y = atan2(d.x, d.z)


static func radial(inner: Color, outer: Color, ring := false) -> GradientTexture2D:
	var g = Gradient.new()
	if ring:
		g.offsets = PackedFloat32Array([0.0, 0.72, 0.84, 1.0])
		g.colors = PackedColorArray([Color(outer, 0), Color(outer, 0), inner, Color(outer, 0)])
	else:
		g.offsets = PackedFloat32Array([0.0, 1.0])
		g.colors = PackedColorArray([inner, outer])
	var t = GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(1.0, 0.5)
	t.width = 128
	t.height = 128
	return t


func _flat_quad(size: float, tex: Texture2D, color: Color) -> MeshInstance3D:
	var mi = MeshInstance3D.new()
	var q = QuadMesh.new()
	q.size = Vector2(size, size)
	q.orientation = PlaneMesh.FACE_Y
	mi.mesh = q
	var m = StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_texture = tex
	m.albedo_color = color
	m.no_depth_test = false
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return mi


## A soft dark blob under the feet: grounds the figure where there is no ambient occlusion.
func _add_shadow() -> void:
	var s = _flat_quad(1.3, radial(Color(0, 0, 0, 0.62), Color(0, 0, 0, 0)), Color.WHITE)
	s.position.y = 0.02


func _add_ring() -> void:
	_ring = _flat_quad(1.25, radial(Color.WHITE, Color.WHITE, true), Color(1, 0.82, 0.45, 0.8))
	_ring.position.y = 0.03
	_ring_mat = _ring.material_override
	_ring_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_ring.visible = false


func _add_bar() -> void:
	var bar = Node3D.new()
	bar.position.y = _body.height + 0.32
	add_child(bar)
	for i in 2:
		var mi = MeshInstance3D.new()
		var q = QuadMesh.new()
		q.size = Vector2(0.9, 0.08) if i == 0 else Vector2(0.86, 0.05)
		mi.mesh = q
		var m = StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		m.no_depth_test = true
		m.render_priority = 1 + i
		m.albedo_color = Color(0.05, 0.04, 0.04, 0.85) if i == 0 else (Color(0.42, 0.78, 0.36) if team == 0 else Color(0.85, 0.27, 0.22))
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		bar.add_child(mi)
		if i == 1: _bar_fill = mi


func _add_picker() -> void:
	var body = StaticBody3D.new()
	var shape = CollisionShape3D.new()
	var cap = CapsuleShape3D.new()
	cap.radius = 0.45
	cap.height = _body.height + 0.3
	shape.shape = cap
	shape.position.y = cap.height * 0.5
	body.add_child(shape)
	add_child(body)
	body.input_event.connect(func(_cam, ev, _pos, _n, _idx):
		if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
			picked.emit(self))


## Where a blow or spell lands: chest height.
func chest() -> Vector3:
	return global_position + Vector3(0, _body.height * 0.62, 0)
