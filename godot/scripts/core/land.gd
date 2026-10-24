class_name Land
extends RefCounted
## The lie of one land, the same every time: the road as walked (each leg
## bent through its middle), gentle hills kept flat along the road and round
## the places, and on some lands a river cut across it with a bridge where
## the road meets it. Heights come from a grid, sampled smoothly; past the
## land's edge the ground rises into the hills that close it in.

## How much room a place takes, kept clear of trees and of hills.
const CLEAR := {"farm": 19.0, "lake": 24.0, "town": 11.0, "graveyard": 11.0, "ruins": 10.0, "tower": 9.0}
const HILL_HEIGHT := 5.0
const RIVER_DEPTH := 1.3
const RIVER_HALF := 2.6        # half the width of the water
const DECK_Y := 0.32           # the bridge's planks above the road
const WATER_Y := -0.55

var size: float                # half the side of the land
var half: float                # half the side of the ground, past the edge
var cell: float
var n: int                     # grid points along a side
var heights := PackedFloat32Array()
var road: Array = []           # Vector2 points, the road as walked
var river: Array = []          # Vector2 points from one edge to the other, or empty
var bridges = []               # {at, dir, span}: where the road crosses the river
var hills := false


static func clear_of(kind: String) -> float:
	return CLEAR.get(kind, 7.0)


func _init(w, loc: String) -> void:
	var th: Dictionary = World.THEMES[loc]
	size = w.size(loc)
	half = size + 30.0
	var lay: Dictionary = w.layout(loc)
	road = _bend(lay.road)
	hills = th.get("hills", false)
	if th.get("river", false): _lay_river(lay, loc)
	cell = 2.0 if hills or not river.is_empty() else 4.0
	n = int(round(2.0 * half / cell)) + 1
	_build(lay, loc, th)


## Each leg bends gently through its midpoint, in short pieces.
func _bend(stops: Array) -> Array:
	var out = [stops[0]]
	for i in stops.size() - 1:
		var a: Vector2 = stops[i]
		var b: Vector2 = stops[i + 1]
		var mid = (a + b) * 0.5 + (b - a).orthogonal().normalized() * (a.distance_to(b) * 0.12 * (1 if i % 2 == 0 else -1))
		for s in range(1, 13):
			var t = s / 12.0
			out.append(a.lerp(mid, t).lerp(mid.lerp(b, t), t))
	return out


## A river across the land from the north edge to the south, finding its
## way between the places, the town, the band camps and where the squad
## comes in, winding a little as rivers do. The road crosses it on a bridge.
func _lay_river(lay: Dictionary, loc: String) -> void:
	var step := 4.0
	var m = int(2.0 * half / step) + 1
	var grid = AStarGrid2D.new()
	grid.region = Rect2i(0, 0, m, m)
	grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	grid.update()
	var wander = FastNoiseLite.new()
	wander.seed = hash(loc) + 101
	wander.frequency = 0.05
	var path: Array = road
	# The road's ends run on to the edge of the land, so the river cannot slip round them.
	var ends = []
	for e in [[road[0], road[1]], [road.back(), road[road.size() - 2]]]:
		var out: Vector2 = (e[0] - e[1]).normalized()
		ends.append([e[0], e[0] + out * half * 2.0])
	for j in m:
		for i in m:
			var p = Vector2(-half + i * step, -half + j * step)
			var solid = false
			for q in lay.places:
				var room = 4.0 if q.kind in ["chest", "herb"] else clear_of(q.kind) + 2.0
				if q.pos.distance_to(p) < room + RIVER_HALF: solid = true
			if lay.camps.any(func(c): return c.distance_to(p) < 8.0): solid = true
			if p.distance_to(lay.town) < World.TOWN_RADIUS + 5.0 or p.distance_to(lay.start) < 12.0: solid = true
			if ends.any(func(e): return Geometry2D.get_closest_point_to_segment(p, e[0], e[1]).distance_to(p) < 6.0): solid = true
			if solid:
				grid.set_point_solid(Vector2i(i, j))
				continue
			# Dearer near the road, so it crosses once and squarely; the noise makes it wind.
			var w = 1.0 + (wander.get_noise_2dv(p) * 0.5 + 0.5) * 3.0
			for k in path.size() - 1:
				if Geometry2D.get_closest_point_to_segment(p, path[k], path[k + 1]).distance_to(p) < 6.0:
					w += 6.0
					break
			grid.set_point_weight_scale(Vector2i(i, j), w)
	var rng = RandomNumberGenerator.new()
	rng.seed = hash(loc) + 102
	var best: Array = []
	for _try in 6:
		var a = Vector2i(rng.randi_range(m / 5, m * 4 / 5), 0)
		var b = Vector2i(rng.randi_range(m / 5, m * 4 / 5), m - 1)
		if grid.is_point_solid(a) or grid.is_point_solid(b): continue
		var ids = grid.get_id_path(a, b)
		if ids.is_empty(): continue
		if best.is_empty() or ids.size() < best.size(): best = ids
	if best.is_empty(): return
	var raw = []
	for id in best: raw.append(Vector2(-half + id.x * step, -half + id.y * step))
	# Softened corners, a few passes of averaging.
	for _pass in 3:
		var soft = [raw[0]]
		for k in range(1, raw.size() - 1): soft.append((raw[k - 1] + raw[k] * 2.0 + raw[k + 1]) * 0.25)
		soft.append(raw.back())
		raw = soft
	river = raw
	for i in road.size() - 1:
		for j in river.size() - 1:
			var hit = Geometry2D.segment_intersects_segment(road[i], road[i + 1], river[j], river[j + 1])
			if hit != null:
				var dir: Vector2 = (road[i + 1] - road[i]).normalized()
				# The span runs bank to bank, wider where the road crosses aslant.
				var slant = absf(dir.dot((river[j + 1] - river[j]).normalized().orthogonal()))
				bridges.append({"at": hit, "dir": dir, "span": (RIVER_HALF * 2.0 + 3.0) / maxf(slant, 0.5)})


func _build(lay: Dictionary, loc: String, th: Dictionary) -> void:
	var edge_noise = FastNoiseLite.new()
	edge_noise.seed = hash(loc)
	edge_noise.frequency = 0.035
	var hill_noise = FastNoiseLite.new()
	hill_noise.seed = hash(loc) + 55
	hill_noise.frequency = 0.016
	hill_noise.fractal_octaves = 3
	heights.resize(n * n)
	# How far each grid point lies from the road and from the river, stamped
	# outward from points a metre apart, and how flat the places want it.
	var far := 99.0
	var to_road = PackedFloat32Array(); to_road.resize(n * n); to_road.fill(far)
	var to_river = PackedFloat32Array(); to_river.resize(n * n); to_river.fill(far)
	var flat = PackedFloat32Array(); flat.resize(n * n); flat.fill(1.0)
	if hills:
		_stamp_dist(to_road, _dense(road), 16.0)
		for q in lay.places:
			var c = clear_of(q.kind)
			_stamp_flat(flat, q.pos, c + 1.0, c + 10.0)
		if th.get("bigTown", false):
			_stamp_flat(flat, lay.town, World.TOWN_RADIUS + 2.0, World.TOWN_RADIUS + 12.0)
		_stamp_flat(flat, lay.start, 4.0, 12.0)
	if not river.is_empty(): _stamp_dist(to_river, _dense(river), 12.0)
	for j in n:
		for i in n:
			var x = -half + i * cell
			var z = -half + j * cell
			var k = j * n + i
			var edge = maxf(absf(x), absf(z)) - size
			var y = 0.0
			if edge > 0: y = edge * 0.35 + edge_noise.get_noise_2d(x * 2, z * 2) * edge * 0.25
			if hills:
				var hn = hill_noise.get_noise_2d(x, z) * 0.5 + 0.5
				var hill = pow(maxf(0.0, hn - 0.38) / 0.62, 1.4) * HILL_HEIGHT
				var f = smoothstep(3.5, 15.0, to_road[k]) * flat[k] * smoothstep(4.0, 11.0, to_river[k])
				y += hill * f * (1.0 - smoothstep(0.0, 20.0, edge))
			if to_river[k] < 6.0:
				y -= RIVER_DEPTH * (1.0 - smoothstep(RIVER_HALF - 0.4, RIVER_HALF + 2.6, to_river[k]))
			heights[k] = y


## Points a metre apart along a line.
func _dense(pts: Array) -> Array:
	var out = []
	for i in pts.size() - 1:
		var steps = maxi(1, int(pts[i].distance_to(pts[i + 1])))
		for s in steps: out.append(pts[i].lerp(pts[i + 1], float(s) / steps))
	out.append(pts.back())
	return out


func _stamp_dist(grid: PackedFloat32Array, pts: Array, radius: float) -> void:
	var r = int(ceil(radius / cell))
	for p in pts:
		var ci = int(round((p.x + half) / cell))
		var cj = int(round((p.y + half) / cell))
		for j in range(maxi(0, cj - r), mini(n, cj + r + 1)):
			for i in range(maxi(0, ci - r), mini(n, ci + r + 1)):
				var d = Vector2(-half + i * cell, -half + j * cell).distance_to(p)
				var k = j * n + i
				if d < grid[k]: grid[k] = d


func _stamp_flat(grid: PackedFloat32Array, at: Vector2, inner: float, outer: float) -> void:
	var r = int(ceil(outer / cell))
	var ci = int(round((at.x + half) / cell))
	var cj = int(round((at.y + half) / cell))
	for j in range(maxi(0, cj - r), mini(n, cj + r + 1)):
		for i in range(maxi(0, ci - r), mini(n, ci + r + 1)):
			var k = j * n + i
			grid[k] = minf(grid[k], smoothstep(inner, outer, Vector2(-half + i * cell, -half + j * cell).distance_to(at)))


## The ground's height under a point: the hills and the river bed.
func ground(p: Vector2) -> float:
	var fx = clampf((p.x + half) / cell, 0.0, n - 1.001)
	var fz = clampf((p.y + half) / cell, 0.0, n - 1.001)
	var i = int(fx); var j = int(fz)
	var tx = fx - i; var tz = fz - j
	var k = j * n + i
	var a = lerpf(heights[k], heights[k + 1], tx)
	var b = lerpf(heights[k + n], heights[k + n + 1], tx)
	return lerpf(a, b, tz)


## Where a foot comes down: the ground, or the bridge's planks over the river.
func walk_y(p: Vector2) -> float:
	var y = ground(p)
	for b in bridges:
		var d: Vector2 = p - b.at
		var along = d.dot(b.dir)
		var side = d.dot(b.dir.orthogonal())
		if absf(along) < b.span * 0.5 and absf(side) < 1.9: return maxf(y, DECK_Y)
	return y


## How far a point lies from the river (99 on a land without one).
func river_gap(p: Vector2) -> float:
	if river.is_empty(): return 99.0
	var best = 99.0
	for i in river.size() - 1:
		best = minf(best, Geometry2D.get_closest_point_to_segment(p, river[i], river[i + 1]).distance_to(p))
	return best
