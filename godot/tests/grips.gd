extends Node3D
## How each hero holds their weapon: a sheet with a column per hero and a row
## per moment (idle, two steps of the run, three moments of the main blow).
## Needs a window, not --headless:
## `godot --path . res://tests/grips.tscn -- --out=grips.png [--yaw=30] [--heroes=0,4,8] [--cell=220]`

var HEROES := [0, 4, 8, 12, 9, 5, 2, 6, 7]
const ROWS := [["idle", 0.2], ["idle", 0.6], ["run", 0.25], ["run", 0.75], ["melee", 0.3], ["melee", 0.5], ["melee", 0.7]]
const STEP := 1.6

var _units: Array = []
var _cam: Camera3D
var _out = "grips.png"
var _yaw = 30.0
var _cell = 220


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="): _out = a.substr(6)
		if a.begins_with("--yaw="): _yaw = float(a.substr(6))
		if a.begins_with("--heroes="): HEROES = Array(a.substr(9).split(",")).map(func(x): return int(x))
		if a.begins_with("--cell="): _cell = int(a.substr(7))
	get_window().size = Vector2i(HEROES.size() * _cell, ROWS.size() * _cell * 12 / 11)
	var world = self
	var env = WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.82, 0.8, 0.74)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.75, 0.75, 0.75)
	world.add_child(env)
	var sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 30, 0)
	world.add_child(sun)
	for c in HEROES.size():
		for r in ROWS.size():
			var spec: Dictionary = BattleView.HEROES[HEROES[c]].duplicate()
			spec.merge({"name": "", "team": 0, "role": "melee", "hp": 1, "atk": Vector2i(1, 1), "init": 1})
			var u = Unit.new()
			world.add_child(u)
			u.setup(spec)
			u.set_bar_visible(false)
			u.set_process(false)
			u.position = Vector3(c * STEP, -r * STEP * 1.1, 0)
			u.rotation.y = deg_to_rad(_yaw)
			_units.append({"u": u, "row": ROWS[r]})
	_cam = Camera3D.new()
	_cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	_cam.size = ROWS.size() * STEP * 1.1
	_cam.position = Vector3((HEROES.size() - 1) * STEP / 2.0, -(ROWS.size() - 1) * STEP * 1.1 / 2.0 + 0.6, 20)
	world.add_child(_cam)
	_cam.current = true
	_shoot.call_deferred()


func _pose() -> void:
	for e in _units:
		var u: Unit = e.u
		var what: String = e.row[0]
		var clip: String = u._body.idle if what == "idle" else u._body.run if what == "run" else u._body.acts.get(what, u._body.acts.values()[0])
		if not u._anim.has_animation(clip): clip = u._body.acts.values()[0]
		u._anim.play(clip, 0.0)
		u._anim.seek(u._anim.get_animation(clip).length * e.row[1], true)
		u._idle_w = 1.0 if what == "idle" else Unit.RUN_STEADY if what == "run" else 0.0
		u._skel.force_update_all_bone_transforms()
		u._steady_props()


func _shoot() -> void:
	for i in 4:
		_pose()
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(_out)
	print("saved ", _out)
	get_tree().quit()
