extends SceneTree
## A row of villagers in every outfit and hairstyle, for a screenshot:
## xvfb-run godot --rendering-driver opengl3 --path godot -s res://tests/villagers.gd
## writes user://villagers-front.png and -back.png. CLIP=Walk_Loop plays a clip on all.

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var vp = SubViewport.new()
	vp.size = Vector2i(3600, 1400)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	var env = WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color8(53, 50, 59)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.5, 0.5, 0.55)
	vp.add_child(env)
	var sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-35, 30, 0)
	vp.add_child(sun)
	var fill = DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-15, 180, 0)
	fill.light_energy = 0.6
	vp.add_child(fill)
	var looks = []
	for h in Villager.HAIR.male.size(): looks.append({"sex": "male", "outfit": Villager.OUTFITS[h % 4], "hair": h, "colour": h})
	for h in Villager.HAIR.female.size():
		for o in [h, h + 1]: looks.append({"sex": "female", "outfit": Villager.OUTFITS[o % 4], "hair": h, "colour": (o + 3) % 7})
	var clip = OS.get_environment("CLIP")
	var folk = []
	for i in looks.size():
		var v = Villager.new()
		vp.add_child(v)
		v.setup(looks[i])
		if clip != "": v.play(clip)
		v.position.x = (i - (looks.size() - 1) / 2.0) * 0.6
		folk.append(v)
	var cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.keep_aspect = Camera3D.KEEP_WIDTH
	cam.size = looks.size() * 0.6 + 0.1
	cam.position = Vector3(0, 0.62, 5)
	vp.add_child(cam)
	for side in ["front", "back"]:
		for v in folk: v.rotation_degrees.y = 0 if side == "front" else 180
		for f in 30: await process_frame
		var path = "user://villagers-%s%s.png" % [side, "-" + clip if clip != "" else ""]
		vp.get_texture().get_image().save_png(path)
		print("saved ", ProjectSettings.globalize_path(path))
	quit()
