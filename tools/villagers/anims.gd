extends SceneTree
## Picks the villagers' and heroes' clips out of the Universal Animation Library (Quaternius,
## CC0) into one small AnimationLibrary. Copy UAL1_Standard.glb and
## UAL2_Standard.glb into godot/tmp_ual/, import, then run:
## godot --headless --path godot -s ../tools/villagers/anims.gd

const CLIPS := ["Idle", "Walk", "Idle_Talking", "Idle_FoldArms", "Farm_Harvest", "Farm_Watering", "Sitting_Idle",
	"TreeChopping", "Walk_Carry", "Yes",
	# The heroes' fight: stances, blows, shield work, spells, throws, hits, a roll, falls.
	"Sword_Idle", "Idle_Shield", "Spell_Simple_Idle", "Jog_Fwd", "Sword_Attack", "Sword_Regular_A", "Sword_Regular_B",
	"Sword_Regular_Combo", "Sword_Heavy_Combo", "Sword_Dash", "Shield_OneShot", "Shield_Dash", "Spell_Simple_Shoot",
	"OverhandThrow", "Punch_Jab", "Punch_Cross", "Melee_Hook", "Consume", "Jump", "Hit_Chest", "Hit_Head", "Roll",
	"Death01", "Sword_Regular_C", "Sword_Block", "Hit_Knockback",
	# More of the map's everyday life: mending, dancing, sitting and talking, sowing, picking things up.
	"Fixing_Kneeling", "Dance", "Sitting_Talking", "Farm_PlantSeed", "PickUp_Table", "Interact"]
## The importer drops the clips' "_Loop" suffix; these all loop.
const LOOPS := ["Idle", "Walk", "Idle_Talking", "Idle_FoldArms", "Farm_Harvest", "Farm_Watering", "Sitting_Idle",
	"TreeChopping", "Walk_Carry", "Yes", "Sword_Idle", "Idle_Shield", "Spell_Simple_Idle", "Jog_Fwd",
	"Fixing_Kneeling", "Dance", "Sitting_Talking", "Farm_PlantSeed", "PickUp_Table"]

func _initialize() -> void:
	var lib = AnimationLibrary.new()
	for f in ["res://tmp_ual/UAL1_Standard.glb", "res://tmp_ual/UAL2_Standard.glb"]:
		var scene: Node = load(f).instantiate()
		var ap: AnimationPlayer = scene.find_child("AnimationPlayer", true, false)
		for name in ap.get_animation_list():
			if not name in CLIPS: continue
			var a: Animation = ap.get_animation(name).duplicate(true)
			if name in LOOPS: a.loop_mode = Animation.LOOP_LINEAR
			# Only the bones; no scale tracks, which the clips do not change.
			for t in range(a.get_track_count() - 1, -1, -1):
				if a.track_get_type(t) == Animation.TYPE_SCALE_3D: a.remove_track(t)
			lib.add_animation(name, a)
		scene.free()
	lib.add_animation("Bow_Shot", _bow_shot(lib.get_animation("Spell_Simple_Shoot")))
	print("clips: ", lib.get_animation_list())
	ResourceSaver.save(lib, "res://assets/models/villagers/anims.res", ResourceSaver.FLAG_COMPRESS)
	quit()


## A bow shot made from the simple spell's cast: the left arm still thrusts the
## bow out, and the right hand draws the string back to the cheek (two-bone IK
## on the right arm), holds the aim, looses and drops back. Slower than the
## cast, as a draw is.
const BOW_LEN := 1.15
const DRAWN := 0.45
const LOOSE := 0.85


func _bow_shot(src: Animation) -> Animation:
	var model: Node3D = load("res://assets/models/villagers/head-male.glb").instantiate()
	var sk: Skeleton3D = model.find_child("Skeleton3D", true, false)
	var ap = AnimationPlayer.new()
	model.add_child(ap)
	ap.root_node = NodePath("..")
	var tmp = AnimationLibrary.new()
	tmp.add_animation("src", src)
	ap.add_animation_library("", tmp)
	root.add_child(model)
	ap.play("src")
	# The cast's peak: where the left hand reaches furthest from the chest.
	var peak = 0.0
	var best = -1.0
	for k in 26:
		var t = src.length * k / 25.0
		ap.seek(t, true)
		var d = _gp(sk, sk.find_bone("hand_l")).origin.distance_to(_gp(sk, sk.find_bone("spine_03")).origin)
		if d > best:
			best = d
			peak = t
	var out = Animation.new()
	out.length = BOW_LEN
	var tracks = []
	for i in src.get_track_count():
		var path: NodePath = src.track_get_path(i)
		var j = out.add_track(src.track_get_type(i))
		out.track_set_path(j, path)
		tracks.append([j, sk.find_bone(path.get_concatenated_subnames()), src.track_get_type(i)])
	var up_arm = sk.find_bone("upperarm_r")
	var low_arm = sk.find_bone("lowerarm_r")
	var frames = int(BOW_LEN * 30)
	for f in frames + 1:
		var t = BOW_LEN * f / frames
		# Raise to the peak while drawing, hold it, then ease out of the cast.
		var st = peak * minf(t / DRAWN, 1.0) if t < LOOSE else lerpf(peak, src.length, (t - LOOSE) / (BOW_LEN - LOOSE))
		ap.seek(st, true)
		var w = clampf(t / DRAWN, 0.0, 1.0) if t < LOOSE else clampf(1.0 - (t - LOOSE - 0.1) / 0.2, 0.0, 1.0)
		var rot = {}
		if w > 0.0:
			var g = func(b): return _gp(sk, sk.find_bone(b)).origin
			var head: Vector3 = g.call("Head")
			var bow: Vector3 = g.call("hand_l")
			var up = (head - g.call("pelvis")).normalized()
			var right = (g.call("clavicle_r") - g.call("clavicle_l")).normalized()
			var aim = bow - head
			aim = (aim - up * aim.dot(up)).normalized()
			var shoulder = _gp(sk, up_arm).origin
			# The string hand at the cheek; just after the loose it flies back a little.
			var target = head + aim * 0.02 - up * 0.08 + right * 0.08
			if t >= LOOSE: target += -aim * 0.1 * clampf((t - LOOSE) / 0.08, 0.0, 1.0)
			var pole = shoulder - aim * 0.3 + right * 0.2 - up * 0.15
			rot = _two_bone(sk, up_arm, low_arm, shoulder, target, pole)
		for tr in tracks:
			if tr[1] < 0: continue
			if tr[2] == Animation.TYPE_POSITION_3D:
				out.position_track_insert_key(tr[0], t, sk.get_bone_pose_position(tr[1]))
			elif tr[2] == Animation.TYPE_ROTATION_3D:
				var q: Quaternion = sk.get_bone_pose_rotation(tr[1])
				if rot.has(tr[1]): q = q.slerp(rot[tr[1]], w)
				out.rotation_track_insert_key(tr[0], t, q)
	model.queue_free()
	return out


## Local rotations that bend `a` (upper) and `b` (lower) so the end of `b`
## reaches `target`, the elbow toward `pole`.
func _two_bone(sk: Skeleton3D, a: int, b: int, s: Vector3, target: Vector3, pole: Vector3) -> Dictionary:
	var c = sk.find_bone("hand_r")
	var l1 = sk.get_bone_rest(b).origin.length()
	var l2 = sk.get_bone_rest(c).origin.length()
	var d = clampf(s.distance_to(target), 0.05, l1 + l2 - 0.001)
	var dir = (target - s).normalized()
	var along = (l1 * l1 - l2 * l2 + d * d) / (2.0 * d)
	var h = sqrt(maxf(l1 * l1 - along * along, 0.0))
	var p = pole - s
	var perp = (p - dir * p.dot(dir)).normalized()
	var elbow = s + dir * along + perp * h
	var out = {}
	var ga: Transform3D = _gp(sk, a)
	var want_a = Basis(Quaternion(ga.basis.y.normalized(), (elbow - s).normalized())) * ga.basis
	var pa: Transform3D = _gp(sk, sk.get_bone_parent(a))
	var la = (pa.basis.inverse() * want_a).get_rotation_quaternion()
	sk.set_bone_pose_rotation(a, la)
	var gb: Transform3D = _gp(sk, b)
	var want_b = Basis(Quaternion(gb.basis.y.normalized(), (target - gb.origin).normalized())) * gb.basis
	var lb = (_gp(sk, a).basis.inverse() * want_b).get_rotation_quaternion()
	out[a] = la
	out[b] = lb

	return out


## A bone's pose in skeleton space, worked out from the local poses (the
## skeleton's own cache is not refreshed outside a running frame).
func _gp(sk: Skeleton3D, i: int) -> Transform3D:
	var t = sk.get_bone_pose(i)
	var p = sk.get_bone_parent(i)
	while p >= 0:
		t = sk.get_bone_pose(p) * t
		p = sk.get_bone_parent(p)
	return t
