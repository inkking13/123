extends SceneTree
## Item icons for armour sets, 176² like the others. Copy into the project and
## run: SETS=a,b xvfb-run godot --rendering-driver opengl3 --path godot -s res://icons.gd

const ITEMS := {"hood": ["hood", "collar"], "jacket": ["jacket", "shoulders", "belt", "cloak"],
	"gloves": ["gloves", "sleeves"], "pants": ["pants", "boots"]}

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var vp = SubViewport.new()
	vp.size = Vector2i(352, 352)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.transparent_bg = false
	root.add_child(vp)
	var env = WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color8(53, 50, 59)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.55, 0.55, 0.6)
	vp.add_child(env)
	var sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-30, 35, 0)
	vp.add_child(sun)
	var fill = DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-10, -140, 0)
	fill.light_energy = 0.5
	vp.add_child(fill)
	var cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	vp.add_child(cam)
	var ids: Array = JSON.parse_string(FileAccess.get_file_as_string("res://data/armourSets.json")).ARMOUR_IDS
	for set_id in OS.get_environment("SETS").split(","):
		for item in ITEMS:
			if not ("set-%s-%s" % [set_id, item]) in ids: continue  # a set without that item
			if item == "hood" or item == "gloves":
				await _worn(vp, cam, set_id, item)
				continue
			var src: Node3D = load("res://assets/models/wardrobe/%s-human.glb" % set_id).instantiate()
			vp.add_child(src)
			var box = AABB()
			var first = true
			for m in src.find_children("armour_*", "MeshInstance3D", true, false):
				var piece = m.name.trim_prefix("armour_")
				var parts: Array = ITEMS[item]
				var hood_down = set_id == "wanderer" and item == "hood"
				if hood_down: parts = ["jacket", "collar"]
				m.visible = piece in parts
				if not m.visible: continue
				var b: AABB = m.get_aabb()
				if item == "gloves":  # one hand, the left one, turned to show its back
					b = AABB(b.position + Vector3(b.size.x / 2, 0, 0), b.size * Vector3(0.5, 1, 1))
				if hood_down:  # the hood worn down, from behind
					b = AABB(b.position + Vector3(0, b.size.y * 0.62, 0), b.size * Vector3(1, 0.38, 1))
				box = b if first else box.merge(b)
				first = false
			var c = box.get_center()
			var yaw = 25.0 if item != "gloves" else -20.0
			if set_id == "wanderer" and item == "hood": yaw = 155.0
			if set_id == "chainmail" and item == "hood": yaw = 55.0
			cam.rotation_degrees = Vector3(-8, yaw, 0)
			cam.position = c + cam.global_transform.basis.z * 3.0
			cam.size = max(box.size.y, max(box.size.x, box.size.z)) * 1.12
			for f in 6: await process_frame
			var img = vp.get_texture().get_image()
			img.resize(176, 176, Image.INTERPOLATE_LANCZOS)
			img.save_jpg("res://assets/items/armour/a-%s-%s.jpg" % [set_id, item], 0.9)
			src.queue_free()
			await process_frame
	quit()


## Helms and gloves are shown worn, so open faces and bare hands are not holes.
func _worn(vp, cam, set_id, item) -> void:
	var u = Unit.new()
	vp.add_child(u)
	u.setup({"name": "x", "team": 0, "role": "melee", "hp": 10, "atk": Vector2i(1, 2), "init": 1, "body": "human", "set": set_id})
	for c in u.get_children():
		if not (c is Node3D) or c.find_child("Skeleton3D", true, false) == null: c.visible = false
	var anim: AnimationPlayer = u.find_child("AnimationPlayer", true, false)
	anim.seek(0.0, true)
	anim.pause()
	var skel: Skeleton3D = u.find_child("Skeleton3D", true, false)
	if item == "gloves":  # the hand alone: the rest of the outfit stays off
		for m in skel.get_children():
			if m.name.begins_with("armour_") and not (m.name in ["armour_gloves", "armour_sleeves"]): m.visible = false
	var bone = "mixamorig_Head" if item == "hood" else "mixamorig_LeftForeArm"
	var at: Vector3 = (skel.global_transform * skel.get_bone_global_pose(skel.find_bone(bone))).origin
	var yaw = 30.0
	if item == "hood" and set_id == "wanderer": yaw = 160.0  # the hood worn down, from behind
	if item == "gloves": yaw = 60.0
	cam.rotation_degrees = Vector3(-6, yaw, 0)
	var aim = at + (Vector3(0, 0.04, 0) if item == "hood" else Vector3(0.03, -0.1, 0))
	if item == "hood" and set_id == "wanderer": aim = at + Vector3(0, -0.06, 0)
	cam.position = aim + cam.global_transform.basis.z * 3.0
	cam.size = 0.42 if item == "hood" else 0.36
	for f in 6: await process_frame
	var img = vp.get_texture().get_image()
	img.resize(176, 176, Image.INTERPOLATE_LANCZOS)
	img.save_jpg("res://assets/items/armour/a-%s-%s.jpg" % [set_id, item], 0.9)
	u.queue_free()
	await process_frame
