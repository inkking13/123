extends SceneTree
## Каелен side by side: the game's Meshy body (left) and a trial on the Quaternius
## body with Universal Animation Library clips (right), through one fight.
## Needs UAL1_Standard.glb and UAL2_Standard.glb in godot/tmp_ual/ (imported). Record:
## xvfb-run godot --rendering-driver opengl3 --path godot --resolution 1280x720 --fixed-fps 24 \
##   --write-movie /tmp/qhero/f.png -s res://tests/qhero.gd

const DIR := "res://assets/models/villagers/"
const MODEL_H := 1.8
const HEIGHT := 1.12
## What the fight shows: caption, old hero's call, new hero's clip, seconds.
const STEPS := [["Стойка", "idle", "Sword_Idle", 2.0], ["Удар", "melee", "Sword_Attack", 2.0],
	["Приём", "ability", "Sword_Regular_Combo", 2.6], ["Блок", "dodge", "Sword_Block", 1.6],
	["По нему попали", "hit", "Hit_Chest", 1.6], ["Уворот", "dodge", "Roll", 1.8],
	["Бег", "run", "Jog_Fwd", 2.0], ["Смерть", "death", "Death01", 2.6]]

var old: Unit
var anim: AnimationPlayer
var caption: Label3D


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	var env = WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color8(53, 50, 59)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.5, 0.5, 0.55)
	root.add_child(env)
	var sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40, 35, 0)
	sun.shadow_enabled = true
	root.add_child(sun)
	var fill = DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-15, 200, 0)
	fill.light_energy = 0.5
	root.add_child(fill)
	var floor = MeshInstance3D.new()
	var pm = PlaneMesh.new(); pm.size = Vector2(8, 5)
	floor.mesh = pm
	var fm = StandardMaterial3D.new(); fm.albedo_color = Color8(70, 66, 60)
	floor.material_override = fm
	root.add_child(floor)
	var cam = Camera3D.new()
	cam.position = Vector3(0, 0.95, 2.4)
	cam.fov = 40
	root.add_child(cam)
	cam.look_at(Vector3(0, 0.6, 0))

	old = Unit.new()
	root.add_child(old)
	var spec: Dictionary = {"body": "human", "right": "mace", "left": "roundShield", "acts": {"melee": "Sword_Slash", "ability": "Shield_Push"}}  # BattleView.HEROES[0]
	spec.merge({"name": "", "team": 0, "role": "melee", "hp": 1, "atk": Vector2i(1, 1), "init": 1, "set": "ranger", "ready": true})
	old.setup(spec)
	old.set_bar_visible(false)
	old.position = Vector3(-0.65, 0, 0)
	old.rotation_degrees.y = 25

	var hero = _quaternius()
	hero.position = Vector3(0.65, 0, 0)
	hero.rotation_degrees.y = -25

	for t in [["Сейчас (Meshy)", -0.65], ["Quaternius + UAL", 0.65]]:
		var l = _label(t[0], 0.05)
		l.position = Vector3(t[1], 1.25, 0)
	caption = _label("", 0.07)
	caption.position = Vector3(0, 1.4, 0)

	for s in STEPS:
		caption.text = s[0]
		_old_does(s[1])
		anim.play(s[2], 0.2)
		await create_timer(s[3]).timeout
	quit()


func _label(text: String, size: float) -> Label3D:
	var l = Label3D.new()
	l.text = text
	l.pixel_size = size / 32.0
	l.font_size = 32
	l.outline_size = 8
	root.add_child(l)
	return l


func _old_does(what: String) -> void:
	match what:
		"idle": old.play_idle()
		"melee", "ability": old.play_action(what)
		"hit": old.play_hit()
		"dodge": old.dodge()
		"run": old.play_run()
		"death": old.play_death()


## Каелен on the Quaternius body: head, ranger clothes, short hair and a beard,
## a mace in the right fist and a round shield on the left arm.
func _quaternius() -> Node3D:
	var holder = Node3D.new()
	root.add_child(holder)
	var model: Node3D = load(DIR + "head-male.glb").instantiate()
	model.scale = Vector3.ONE * HEIGHT / MODEL_H
	holder.add_child(model)
	var skel: Skeleton3D = model.find_child("Skeleton3D", true, false)
	for part in ["ranger1-male", "hair-brows-regular", "hair-buzzed", "hair-beard"]:
		var src: Node3D = load(DIR + part + ".glb").instantiate()
		for m in src.find_children("*", "MeshInstance3D", true, false):
			m.owner = null
			m.get_parent().remove_child(m)
			skel.add_child(m)
			m.skeleton = NodePath("..")
			if part.begins_with("hair-"):
				var mat: StandardMaterial3D = m.mesh.surface_get_material(0).duplicate()
				mat.albedo_color = Color(0.3, 0.2, 0.12)
				m.material_override = mat
		src.free()
	var lib = AnimationLibrary.new()
	for f in ["res://tmp_ual/UAL1_Standard.glb", "res://tmp_ual/UAL2_Standard.glb"]:
		var s: Node = load(f).instantiate()
		var ap: AnimationPlayer = s.find_child("AnimationPlayer", true, false)
		for n in ap.get_animation_list():
			if STEPS.any(func(st): return st[2] == n):
				var a: Animation = ap.get_animation(n).duplicate(true)
				a.loop_mode = Animation.LOOP_LINEAR if n in ["Sword_Idle", "Jog_Fwd"] else Animation.LOOP_NONE
				lib.add_animation(n, a)
		s.free()
	anim = AnimationPlayer.new()
	model.add_child(anim)
	anim.root_node = NodePath("..")
	anim.add_animation_library("", lib)
	# Props are in metres for a 1.7 m body; this one is 1.8 model units tall.
	var k = MODEL_H / Unit.MODEL_H
	_grip(skel, "r", "weapon-mace", 1.0 * k, false)
	_grip(skel, "l", "shield-round", 1.2 * k, true)
	return holder


## Hangs a prop on a hand by the hand's own knuckles: the shaft runs across the
## palm from the little finger to the index finger, the shield on the back of the hand.
func _grip(skel: Skeleton3D, side: String, file: String, scale: float, shield: bool) -> void:
	var at = func(b): return skel.get_bone_global_rest(skel.find_bone(b + "_" + side)).origin
	var hand: Vector3 = at.call("hand")
	var mid: Vector3 = at.call("middle_01")
	var across: Vector3 = (at.call("index_01") - at.call("pinky_01")).normalized()
	var along: Vector3 = (mid - hand).normalized()
	var n: Vector3 = along.cross(across).normalized()
	if n.dot(at.call("thumb_01") - hand) < 0: n = -n  # toward the palm
	var b: Basis
	var o: Vector3
	if shield:  # props' shields face -X
		var y = along
		b = Basis(n, y, n.cross(y))
		o = hand + along * 0.03 - n * 0.06
	else:
		var x = along.cross(across).normalized()
		b = Basis(x, across, x.cross(across))
		o = hand + along * 0.075 + n * 0.02
	var ba = BoneAttachment3D.new()
	ba.bone_name = "hand_" + side
	skel.add_child(ba)
	var prop: Node3D = load("res://assets/models/%s.glb" % file).instantiate()
	var rest = skel.get_bone_global_rest(skel.find_bone("hand_" + side))
	prop.transform = rest.affine_inverse() * Transform3D(b.orthonormalized().scaled(Vector3.ONE * scale), o)
	ba.add_child(prop)
