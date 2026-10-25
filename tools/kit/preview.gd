# Lays .glb files out in a row under a sun and saves a picture of them.
#   xvfb-run godot --path godot --rendering-driver opengl3 -s ../tools/kit/preview.gd -- OUT.png A.glb B.glb ...
extends SceneTree

var shots := 0
var out := ""
var yaw := 35.0


func _initialize() -> void:
	var args = OS.get_cmdline_user_args()
	out = args[0]
	var files = args.slice(1)
	if out.ends_with(".back.png"): yaw = 215.0
	var world = Node3D.new()
	root.add_child(world)
	var env = WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.55, 0.65, 0.75)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.6, 0.6, 0.65)
	world.add_child(env)
	var sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 30, 0)
	sun.shadow_enabled = true
	world.add_child(sun)
	var ground = MeshInstance3D.new()
	var pm = PlaneMesh.new(); pm.size = Vector2(200, 200)
	ground.mesh = pm
	var gm = StandardMaterial3D.new(); gm.albedo_color = Color(0.35, 0.42, 0.25)
	ground.material_override = gm
	world.add_child(ground)
	var x = 0.0
	var widest = 0.0
	for f in files:
		var doc = GLTFDocument.new()
		var st = GLTFState.new()
		if doc.append_from_file(f, st) != OK: continue
		var n: Node3D = doc.generate_scene(st)
		var box = _aabb(n)
		n.position = Vector3(x - box.position.x, -box.position.y, -box.get_center().z)
		world.add_child(n)
		x += box.size.x + 1.5
		widest = maxf(widest, maxf(box.size.y, box.size.z))
	var cam = Camera3D.new()
	var mid = Vector3(x * 0.5, widest * 0.35, 0)
	var dist = maxf(x * 0.75, widest * 1.6)
	cam.look_at_from_position(mid + Basis(Vector3.UP, deg_to_rad(yaw)) * Vector3(0, dist * 0.45, dist), mid)
	world.add_child(cam)
	cam.current = true


func _aabb(n: Node) -> AABB:
	var box := AABB()
	var first = true
	for m in n.find_children("*", "MeshInstance3D", true, false):
		var b = (m as MeshInstance3D).global_transform * (m as MeshInstance3D).get_aabb() if m.is_inside_tree() else _xf(m, n) * m.get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box


func _xf(m: Node3D, top: Node) -> Transform3D:
	var t = m.transform
	var p = m.get_parent()
	while p and p != top:
		t = p.transform * t
		p = p.get_parent()
	return t


func _process(_dt: float) -> bool:
	shots += 1
	if shots == 30:
		root.get_viewport().get_texture().get_image().save_png(out)
		return true
	return false
