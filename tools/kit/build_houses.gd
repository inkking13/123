# Builds whole houses out of the Medieval Village MegaKit pieces and saves
# each as one light .glb (one mesh, one surface per material) for the map.
#
#   python3 -I gltf2glb.py <kit>/X.gltf <pieces>/X.glb --max 1024   (every piece)
#   godot --headless --path godot -s ../tools/kit/build_houses.gd -- <pieces> <out dir>
#
# The kit's grid: a wall is 2 m wide and 3 m high, its outer face toward +z.
# A house is W x D cells (x across, z deep), its front (door) facing +z.
extends SceneTree

const STOREY := 3.0

var src := ""
var _cache := {}


func _initialize() -> void:
	var args = OS.get_cmdline_user_args()
	src = args[0]
	var out: String = args[1]
	for h in HOUSES:
		var parts: Array = []
		_house(parts, h)
		_save(parts, out.path_join("kit-%s.glb" % h.name))
	quit()


# Each house: cells across (w) and deep (d), storeys of wall kinds from the
# ground up, the roof, and extras.
var HOUSES = [
	{"name": "cottage", "w": 2, "d": 2, "floors": ["plaster_base"], "roof": "Roof_RoundTiles_4x4", "gable": "Roof_Front_Brick4", "chimney": Vector3(2.9, 0, 1.0), "door": "Door_1_Round", "shutters": true},
	{"name": "cottage-stone", "w": 2, "d": 3, "floors": ["stone"], "roof": "Roof_RoundTiles_4x6", "gable": "Roof_Front_Brick4", "chimney": Vector3(1.0, 0, 1.0), "door": "Door_1_Round", "shutters": true},
	{"name": "house", "w": 2, "d": 3, "floors": ["stone", "timber"], "roof": "Roof_RoundTiles_4x6", "gable": "Roof_Front_Brick4", "chimney": Vector3(2.9, 0, 3.0), "door": "Door_1_Round", "shutters": true},
	{"name": "townhouse", "w": 3, "d": 3, "floors": ["plaster_base", "timber"], "roof": "Roof_RoundTiles_6x6", "gable": "Roof_Front_Brick6", "chimney": Vector3(4.6, 0, 1.0), "door": "Door_1_Round", "shutters": true, "balcony": true},
	{"name": "tavern", "w": 4, "d": 4, "floors": ["stone", "timber"], "roof": "Roof_RoundTiles_8x8", "gable": "Roof_Front_Brick8", "chimney": Vector3(6.8, 0, 1.0), "door": "Door_1_Round", "shutters": false, "balcony": true},
	{"name": "barracks", "w": 3, "d": 5, "floors": ["stone"], "roof": "Roof_RoundTiles_6x10", "gable": "Roof_Front_Brick6", "chimney": Vector3(1.0, 0, 3.0), "door": "Door_1_Round", "shutters": true},
]

const WALLS = {
	"plaster_base": {"plain": "Wall_Plaster_Straight_Base", "window": "Wall_Plaster_Window_Wide_Flat", "win": "Window_Wide_Flat1", "door": "Wall_Plaster_Door_Round", "shut": "WindowShutters_Wide_Flat_Open"},
	"stone": {"plain": "Wall_UnevenBrick_Straight", "window": "Wall_UnevenBrick_Window_Wide_Flat", "win": "Window_Wide_Flat1", "door": "Wall_UnevenBrick_Door_Round", "shut": "WindowShutters_Wide_Flat_Closed"},
	"timber": {"plain": "Wall_Plaster_WoodGrid", "window": "Wall_Plaster_Window_Wide_Flat", "win": "Window_Wide_Flat1", "door": "Wall_Plaster_Door_Flat", "shut": "WindowShutters_Wide_Flat_Open"},
}


func _house(parts: Array, h: Dictionary) -> void:
	var w: int = h.w
	var d: int = h.d
	var top = h.floors.size() * STOREY
	for f in h.floors.size():
		var kind: Dictionary = WALLS[h.floors[f]]
		var y = f * STOREY
		# Each side: [cells, start, step, facing].
		var sides = [
			[w, Vector3(1, y, d * 2), Vector3(2, 0, 0), 0.0],          # front
			[w, Vector3(w * 2 - 1, y, 0), Vector3(-2, 0, 0), 180.0],   # back
			[d, Vector3(w * 2, y, d * 2 - 1), Vector3(0, 0, -2), 90.0],  # right
			[d, Vector3(0, y, 1), Vector3(0, 0, 2), -90.0],             # left
		]
		for s in sides.size():
			var side = sides[s]
			for i in side[0]:
				var at: Vector3 = side[1] + side[2] * i
				var mid = i == side[0] / 2 if side[0] % 2 == 1 else i == side[0] / 2 - 1
				if s == 0 and f == 0 and mid:
					parts.append([kind.door, at, side[3]])
					parts.append([h.door, at + _turn(Vector3(-0.53, 0, -0.1), side[3]), side[3]])
				elif (i + s + f) % 2 == 0 or (s == 0 and f > 0):
					parts.append([kind.window, at, side[3]])
					parts.append([kind.win, at, side[3]])
					if h.shutters: parts.append([kind.shut, at, side[3]])
				else:
					parts.append([kind.plain, at, side[3]])
		for c in [[Vector3(0, y, 0), 0.0], [Vector3(w * 2, y, 0), 0.0], [Vector3(0, y, d * 2), 0.0], [Vector3(w * 2, y, d * 2), 0.0]]:
			parts.append(["Corner_Exterior_Wood", c[0], c[1]])
	if h.get("balcony", false) and h.floors.size() > 1:
		for i in w:
			parts.append(["Balcony_Cross_Straight", Vector3(1 + i * 2, STOREY, d * 2 - 1), 0.0])
	parts.append([h.roof, Vector3(w, top, d), 0.0])
	parts.append([h.gable, Vector3(w, top, d * 2), 0.0])
	parts.append([h.gable, Vector3(w, top, 0), 180.0])
	if h.has("chimney"):
		parts.append(["Prop_Chimney2", h.chimney + Vector3(0, top - 1.5, 0), 0.0])


func _turn(v: Vector3, deg: float) -> Vector3:
	return Basis(Vector3.UP, deg_to_rad(deg)) * v


func _piece(name: String) -> Node3D:
	if not _cache.has(name):
		var doc = GLTFDocument.new()
		var state = GLTFState.new()
		var err = doc.append_from_file(src.path_join(name + ".glb"), state)
		if err != OK:
			push_error("no piece " + name)
			_cache[name] = null
		else:
			_cache[name] = doc.generate_scene(state)
	return _cache[name]


func _save(parts: Array, out: String) -> void:
	var tools = {}   # material name -> [SurfaceTool, Material]
	for p in parts:
		var scene = _piece(p[0])
		if scene == null: continue
		var place = Transform3D(Basis(Vector3.UP, deg_to_rad(p[2])), p[1])
		var todo: Array = [[scene, Transform3D()]]
		while not todo.is_empty():
			var it = todo.pop_back()
			var xf: Transform3D = it[1] * it[0].transform if it[0] != scene else Transform3D()
			if it[0] is MeshInstance3D and it[0].mesh:
				var mesh: Mesh = it[0].mesh
				for k in mesh.get_surface_count():
					var mat: Material = it[0].get_active_material(k)
					var key = mat.resource_name if mat else "none"
					if not tools.has(key):
						var st = SurfaceTool.new()
						st.begin(Mesh.PRIMITIVE_TRIANGLES)
						tools[key] = [st, mat]
					tools[key][0].append_from(mesh, k, place * xf)
			for c in it[0].get_children():
				if c is Node3D: todo.append([c, xf])
	var mesh = ArrayMesh.new()
	var tris = 0
	for key in tools:
		var st: SurfaceTool = tools[key][0]
		st.index()
		st.commit(mesh)
		var m: Material = tools[key][1]
		if m: m.resource_name = key
		mesh.surface_set_material(mesh.get_surface_count() - 1, m)
		tris += mesh.surface_get_array_index_len(mesh.get_surface_count() - 1) / 3
	var root = Node3D.new()
	root.name = out.get_file().get_basename()
	var mi = MeshInstance3D.new()
	mi.name = "house"
	mi.mesh = mesh
	root.add_child(mi)
	var doc = GLTFDocument.new()
	doc.image_format = "JPEG"
	doc.lossy_quality = 0.85
	var state = GLTFState.new()
	doc.append_from_scene(root, state)
	doc.write_to_filesystem(state, out)
	print("%s: %d tris, %d materials" % [out.get_file(), tris, tools.size()])
	root.free()
