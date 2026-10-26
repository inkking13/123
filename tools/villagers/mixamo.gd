extends SceneTree
## Moves Mixamo clips onto the Quaternius bodies' skeleton and adds them to
## the villagers' AnimationLibrary (run anims.gd first; it rebuilds the file).
## Download each clip from mixamo.com as FBX, Without Skin, 30 fps, save it
## into godot/tmp_mixamo/ under the name below, import, then run:
## godot --headless --path godot -s ../tools/villagers/mixamo.gd

## file -> clip name, and whether it loops.
const CLIPS := {
	"bow-draw": ["Bow_Draw", false],          # Standing Draw Arrow: an arrow from the quiver, nocked
	"bow-aim": ["Bow_Aim", true],             # Standing Aim Idle 01: holding the drawn bow on the mark
	"bow-shoot": ["Bow_Shoot", false],        # Standing Aim Recoil: the loose
	"bow-overdraw": ["Bow_Overdraw", false],  # Standing Aim Overdraw: a long draw for a power shot
	# The casters' spells, so they do not all cast alike, and the daggers' own blow.
	"spell-1h-forward": ["Spell_Cast_Forward", false],  # Standing 1H Magic Attack 01: one hand thrust out
	"spell-1h-sweep": ["Spell_Cast_Sweep", false],      # Standing 1H Magic Attack 02: one hand swept across
	"spell-2h-forward": ["Spell_Cast_Both", false],     # Standing 2H Magic Attack 01: both hands thrust out
	"spell-2h-area": ["Spell_Cast_Ground", false],      # Standing 2H Magic Area Attack 01: both hands down at the ground
	"dagger-stab": ["Dagger_Double_Stab", false],       # Double Dagger Stab
}

## Mixamo bone (without "mixamorig_") -> ours. Mixamo's eyes, jaw, ends and
## the source character's cloth and armour bones are left out.
const MAP := {
	"Hips": "pelvis", "Spine": "spine_01", "Spine1": "spine_02", "Spine2": "spine_03", "Neck": "neck_01", "Head": "Head",
	"LeftShoulder": "clavicle_l", "LeftArm": "upperarm_l", "LeftForeArm": "lowerarm_l", "LeftHand": "hand_l",
	"RightShoulder": "clavicle_r", "RightArm": "upperarm_r", "RightForeArm": "lowerarm_r", "RightHand": "hand_r",
	"LeftUpLeg": "thigh_l", "LeftLeg": "calf_l", "LeftFoot": "foot_l", "LeftToeBase": "ball_l",
	"RightUpLeg": "thigh_r", "RightLeg": "calf_r", "RightFoot": "foot_r", "RightToeBase": "ball_r",
}
const FINGERS := {"Thumb": "thumb", "Index": "index", "Middle": "middle", "Ring": "ring", "Pinky": "pinky"}


func _initialize() -> void:
	var path = "res://assets/models/villagers/anims.res"
	var lib: AnimationLibrary = load(path)
	var model: Node3D = load("res://assets/models/villagers/head-male.glb").instantiate()
	root.add_child(model)
	var sk: Skeleton3D = model.find_child("Skeleton3D", true, false)
	# Our clips' tracks, to write the new ones the same way.
	var idle: Animation = lib.get_animation("Idle")
	for file in CLIPS:
		var src: Node = load("res://tmp_mixamo/%s.fbx" % file).instantiate()
		root.add_child(src)
		var a = _retarget(src, sk, idle)
		a.loop_mode = Animation.LOOP_LINEAR if CLIPS[file][1] else Animation.LOOP_NONE
		if lib.has_animation(CLIPS[file][0]): lib.remove_animation(CLIPS[file][0])
		lib.add_animation(CLIPS[file][0], a)
		print(CLIPS[file][0], ": ", snappedf(a.length, 0.01), "s")
		src.queue_free()
	# Whole shots for a fight, one clip each: nock and loose; a long draw and loose.
	lib.add_animation("Bow_Fire", _join(lib.get_animation("Bow_Draw"), lib.get_animation("Bow_Shoot")))
	lib.add_animation("Bow_Power", _join(lib.get_animation("Bow_Overdraw"), lib.get_animation("Bow_Shoot")))
	ResourceSaver.save(lib, path, ResourceSaver.FLAG_COMPRESS)
	quit()


## Each bone turns, in model space, by as much as its Mixamo bone turns from
## that rig's own rest: our bodies keep their rest posture (the source
## character stoops, ours stand up), and both rigs face +Z with the arms out.
## The hips' travel is scaled by hip height.
func _retarget(src: Node, sk: Skeleton3D, like: Animation) -> Animation:
	var ss: Skeleton3D = src.find_child("Skeleton3D", true, false)
	var ap: AnimationPlayer = src.find_child("AnimationPlayer", true, false)
	var clip: Animation = ap.get_animation(ap.get_animation_list()[0])
	ap.play(ap.get_animation_list()[0])
	var pairs = {}  # our bone -> Mixamo bone
	for i in ss.get_bone_count():
		var n = ss.get_bone_name(i).trim_prefix("mixamorig_").trim_prefix("mixamorig:")
		if MAP.has(n): pairs[sk.find_bone(MAP[n])] = i
		for f in FINGERS:
			for side in [["Left", "l"], ["Right", "r"]]:
				for k in 3:
					if n == "%sHand%s%d" % [side[0], f, k + 1]:
						pairs[sk.find_bone("%s_0%d_%s" % [FINGERS[f], k + 1, side[1]])] = i
	var hips_src = ss.find_bone("mixamorig_Hips")
	var hips = sk.find_bone("pelvis")
	var scale = sk.get_bone_global_rest(hips).origin.y / ss.get_bone_global_rest(hips_src).origin.y

	var out = Animation.new()
	out.length = clip.length
	var tracks = []
	for i in like.get_track_count():
		var tp = like.track_get_type(i)
		if tp != Animation.TYPE_ROTATION_3D and tp != Animation.TYPE_POSITION_3D: continue
		var p: NodePath = like.track_get_path(i)
		var b = sk.find_bone(p.get_concatenated_subnames())
		if b < 0: continue
		var j = out.add_track(tp)
		out.track_set_path(j, p)
		tracks.append([j, b, tp])

	var frames = roundi(clip.length * 30)
	for f in frames + 1:
		var t = clip.length * f / frames
		ap.seek(t, true)
		var glob = {}  # our bone -> pose in model space
		for b in sk.get_bone_count():
			var parent = sk.get_bone_parent(b)
			var pg: Transform3D = glob[parent] if parent >= 0 else Transform3D()
			var g: Transform3D = pg * sk.get_bone_rest(b)
			if pairs.has(b):
				var i = pairs[b]
				var turn: Basis = _gp(ss, i).basis.orthonormalized() * ss.get_bone_global_rest(i).basis.orthonormalized().inverse()
				g.basis = turn * sk.get_bone_global_rest(b).basis
			if b == hips:
				var moved = _gp(ss, hips_src).origin - ss.get_bone_global_rest(hips_src).origin
				g.origin = sk.get_bone_global_rest(b).origin + moved * scale
			glob[b] = g
		for tr in tracks:
			var b = tr[1]
			var parent = sk.get_bone_parent(b)
			var local: Transform3D = (glob[parent] if parent >= 0 else Transform3D()).affine_inverse() * glob[b]
			if tr[2] == Animation.TYPE_ROTATION_3D:
				out.rotation_track_insert_key(tr[0], t, local.basis.get_rotation_quaternion())
			else:
				out.position_track_insert_key(tr[0], t, local.origin)
	return out


## `b` played straight after `a` (both written from the same tracks).
func _join(a: Animation, b: Animation) -> Animation:
	var out: Animation = a.duplicate(true)
	out.length = a.length + b.length
	for i in b.get_track_count():
		var j = out.find_track(b.track_get_path(i), b.track_get_type(i))
		for k in b.track_get_key_count(i):
			out.track_insert_key(j, a.length + b.track_get_key_time(i, k), b.track_get_key_value(i, k))
	return out


## A bone's pose in skeleton space, from the local poses (the skeleton's own
## cache is not refreshed outside a running frame).
func _gp(sk: Skeleton3D, i: int) -> Transform3D:
	var t = sk.get_bone_pose(i)
	var p = sk.get_bone_parent(i)
	while p >= 0:
		t = sk.get_bone_pose(p) * t
		p = sk.get_bone_parent(p)
	return t
