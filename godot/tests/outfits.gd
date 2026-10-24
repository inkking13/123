extends SceneTree
## Every body in one armour set, front and back, for a screenshot:
## SETS=peasant,ranger xvfb-run godot --rendering-driver opengl3 --path godot -s res://tests/outfits.gd
## writes user://outfit-<set>-front.png and -back.png. BODIES=human,orc picks the bodies.

var BODIES = (OS.get_environment("BODIES") if OS.get_environment("BODIES") != "" else "human,elfMale,elf,dwarf,orc").split(",")

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var vp = SubViewport.new()
	vp.size = Vector2i(1600, 900)
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
	var cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 1.75
	cam.position = Vector3(0, 0.62, 5)
	vp.add_child(cam)
	for set_id in OS.get_environment("SETS").split(","):
		var units = []
		for i in BODIES.size():
			var u = Unit.new()
			vp.add_child(u)
			u.setup({"name": "", "team": 0, "role": "melee", "hp": 1, "atk": Vector2i(1, 1), "init": 1,
				"body": BODIES[i], "set": set_id})
			u.position.x = (i - (BODIES.size() - 1) / 2.0) * 0.8
			u._bar_fill.get_parent().visible = false
			units.append(u)
		cam.keep_aspect = Camera3D.KEEP_WIDTH
		cam.size = BODIES.size() * 0.8 + 0.1
		cam.position = Vector3(0, 0.72, 5)
		for side in ["front", "back"]:
			for u in units: u.rotation_degrees.y = 0 if side == "front" else 180
			for f in 30: await process_frame
			var path = "user://outfit-%s-%s.png" % [set_id, side]
			vp.get_texture().get_image().save_png(path)
			print("saved ", ProjectSettings.globalize_path(path))
		for u in units: u.queue_free()
		await process_frame
	quit()
