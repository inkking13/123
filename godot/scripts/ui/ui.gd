class_name UI
## The interface kit, after the Expo game's components: leather plates in a
## tooled rim, parchment sheets written in ink, wax seals, the book face
## Alegreya. Screens are built in code from these, in phone points: one point
## of the Expo layout is K pixels of the 720-wide canvas.

const K := 1.85

const BG := Color("#120e0b")
const SURFACE := Color("#1f1812")
const BORDER := Color("#3b2e22")
const BORDER_STRONG := Color("#5c4730")
const BORDER_HOVER := Color("#8a6c45")
const TEXT := Color("#ede2c8")
const TEXT_MUTED := Color("#c7b796")
const TEXT_DIM := Color("#a6967a")
const TEXT_FAINT := Color("#7e705c")
const ACCENT := Color("#c79d5e")
const ACCENT_BRIGHT := Color("#e2bd7c")
const ACCENT_SOFT := Color("#efdbb2")
const DANGER := Color("#c4503f")
const GOOD := Color("#93ad7f")
const WARN := Color("#d0a955")
const GOLD := Color("#f0d58a")
const VALOR := Color("#f0c46a")
const INK := Color("#2a1d12")
const INK_MUTED := Color("#5b4530")
const INK_FAINT := Color("#806849")
const INK_RULE := Color(0.235, 0.157, 0.086, 0.35)
const INK_RED := Color("#8c2a1d")
const INK_GREEN := Color("#3f5a2a")
const WAX := Color("#9b2c20")
const WAX_DARK := Color("#5e1710")
const SEAL_TEXT := Color("#f3dcc0")

## Alegreya's own figures are old-style (a "0" reads as an "o"); the game is
## full of numbers, so every face is set with lining figures.
static var FONTS := {
	"regular": lining(preload("res://fonts/Alegreya_400Regular.ttf")),
	"italic": lining(preload("res://fonts/Alegreya_400Regular_Italic.ttf")),
	"medium": lining(preload("res://fonts/Alegreya_500Medium.ttf")),
	"semibold": lining(preload("res://fonts/Alegreya_700Bold.ttf")),
	"bold": lining(preload("res://fonts/Alegreya_800ExtraBold.ttf")),
	"title": lining(preload("res://fonts/AlegreyaSC_700Bold.ttf")),
	"caps": lining(preload("res://fonts/AlegreyaSC_500Medium.ttf")),
}
const PAPER := preload("res://assets/ui/parchment.jpg")
const ROUNDED := preload("res://shaders/rounded.gdshader")

## A mouse that hovers (a computer, not a phone) lights what it points at.
## (Not is_touchscreen_available(): mouse-to-touch emulation makes that true everywhere.)
static var HOVER = not (OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios"))
## The screen's main call to action, for Enter: the first enabled primary button built.
static var default_action = Callable()

static var _icons = {}
static var _icon_cache = {}
static var _tex_cache = {}


static func lining(base: Font) -> FontVariation:
	var f = FontVariation.new()
	f.base_font = base
	f.opentype_features = {TextServerManager.get_primary_interface().name_to_tag("lnum"): 1}
	return f


static func px(v: float) -> int:
	return int(round(v * K))


# ── text ────────────────────────────────────────────────────────────────────
static func label(text: String, size: float, color: Color = TEXT, font := "regular", wrap := false) -> Label:
	var l = Label.new()
	l.text = text
	l.add_theme_font_override("font", FONTS[font])
	l.add_theme_font_size_override("font_size", px(size))
	l.add_theme_color_override("font_color", color)
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


## Text that sits on a picture or the 3D field: a thin dark rim and a soft
## shadow keep it legible over light and busy ground alike.
static func shadowed(l: Label) -> Label:
	l.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.015, 0.85))
	l.add_theme_constant_override("outline_size", maxi(3, px(2.2)))
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.7))
	l.add_theme_constant_override("shadow_offset_y", 2)
	l.add_theme_constant_override("shadow_outline_size", 6)
	return l


## A dark, rounded plate for text over the 3D field (the log, a hint, the round).
static func plate(child: Control, pad := Vector2(10, 6), alpha := 0.62, radius := 8.0) -> PanelContainer:
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.03, 0.02, alpha)
	sb.set_corner_radius_all(px(radius))
	sb.content_margin_left = px(pad.x); sb.content_margin_right = px(pad.x)
	sb.content_margin_top = px(pad.y); sb.content_margin_bottom = px(pad.y)
	pn.add_theme_stylebox_override("panel", sb)
	pn.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pn.add_child(child)
	return pn


## A small uppercase heading in the accent colour ("ОТДЕЛ КАДРОВ").
static func kicker(text: String, color: Color = ACCENT, size := 11.5) -> Label:
	var l = label(text.to_upper(), size, color, "medium")
	l.add_theme_constant_override("line_spacing", 0)
	return l


static func screen_title(text: String) -> VBoxContainer:
	var v = vbox(2)
	v.add_child(shadowed(label(text, 30, Color("#f1e4c6"), "title")))
	v.add_child(ornament(120))
	return v


## A thin gold rule with a diamond in the middle.
static func ornament(width: float, color := Color("#8f6f45")) -> Control:
	var c = Control.new()
	c.custom_minimum_size = Vector2(px(width), px(10))
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func():
		var w = c.size.x; var h = c.size.y * 0.5
		var d = px(3.5)
		var clear = Color(color, 0)
		c.draw_polyline_colors(PackedVector2Array([Vector2(0, h), Vector2(w * 0.5 - d * 2, h)]), PackedColorArray([clear, color]), 1.5)
		c.draw_polyline_colors(PackedVector2Array([Vector2(w * 0.5 + d * 2, h), Vector2(w, h)]), PackedColorArray([color, clear]), 1.5)
		var pts = PackedVector2Array([Vector2(w * 0.5, h - d), Vector2(w * 0.5 + d, h), Vector2(w * 0.5, h + d), Vector2(w * 0.5 - d, h)])
		c.draw_colored_polygon(pts, Color(color, 0.35))
		pts.append(pts[0])
		c.draw_polyline(pts, color, 1.5))
	return c


# ── icons: Phosphor paths drawn from data/icons.json ────────────────────────
static func icon_texture(name: String, weight := "regular", size := 48) -> Texture2D:
	var key = "%s/%s/%d" % [name, weight, size]
	if _icon_cache.has(key): return _icon_cache[key]
	if _icons.is_empty():
		_icons = JSON.parse_string(FileAccess.get_file_as_string("res://data/icons.json"))
	var paths: Array = _icons.get(name, _icons["x"]).get(weight, [])
	var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="#ffffff">'
	for d in paths: svg += '<path d="%s"/>' % d
	svg += "</svg>"
	var img = Image.new()
	img.load_svg_from_string(svg, size / 256.0)
	var tex = ImageTexture.create_from_image(img)
	_icon_cache[key] = tex
	return tex


static func icon(name: String, size: float, color: Color = TEXT, weight := "regular") -> TextureRect:
	var t = TextureRect.new()
	var s = px(size)
	t.texture = icon_texture(name, weight, maxi(16, int(pow(2, ceil(log(s * 1.5) / log(2))))))
	t.custom_minimum_size = Vector2(s, s)
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.modulate = color
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t


# ── layout ──────────────────────────────────────────────────────────────────
static func vbox(sep: float = 0) -> VBoxContainer:
	var v = VBoxContainer.new()
	v.add_theme_constant_override("separation", px(sep))
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return v


static func hbox(sep: float = 0, align := BoxContainer.ALIGNMENT_BEGIN) -> HBoxContainer:
	var h = HBoxContainer.new()
	h.add_theme_constant_override("separation", px(sep))
	h.alignment = align
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return h


static func margin(child: Control, l: float, t: float, r: float, b: float) -> MarginContainer:
	var m = MarginContainer.new()
	m.add_theme_constant_override("margin_left", px(l))
	m.add_theme_constant_override("margin_top", px(t))
	m.add_theme_constant_override("margin_right", px(r))
	m.add_theme_constant_override("margin_bottom", px(b))
	m.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if child: m.add_child(child)
	return m


static func space(h: float, w: float = 0) -> Control:
	var c = Control.new()
	c.custom_minimum_size = Vector2(px(w), px(h))
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


static func expand(c: Control) -> Control:
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return c


static func flex() -> Control:
	var c = Control.new()
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


static func flex_v() -> Control:
	var c = Control.new()
	c.size_flags_vertical = Control.SIZE_EXPAND_FILL
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c


## A list of cards: one column on a phone, `wide_cols` side by side on a wide window.
static func cards(sep: float = 10, wide_cols := 2) -> GridContainer:
	var g = GridContainer.new()
	g.columns = wide_cols if App.wide else 1
	g.add_theme_constant_override("h_separation", px(sep))
	g.add_theme_constant_override("v_separation", px(sep))
	g.mouse_filter = Control.MOUSE_FILTER_IGNORE
	g.child_entered_tree.connect(func(c):
		if c is Control: c.size_flags_horizontal = Control.SIZE_EXPAND_FILL)
	return g


## Two columns on a wide window, side by side; on a phone both are the page itself.
static func split(page: VBoxContainer, left_weight := 1.0, sep := 20.0) -> Array:
	if not App.wide: return [page, page]
	var row = hbox(sep)
	var l = vbox(0); l.size_flags_horizontal = Control.SIZE_EXPAND_FILL; l.size_flags_stretch_ratio = left_weight
	var r = vbox(0); r.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(l); row.add_child(r)
	page.add_child(row)
	return [l, r]


static func center(c: Control) -> CenterContainer:
	var cc = CenterContainer.new()
	cc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cc.add_child(c)
	return cc


static func rule(color: Color = INK_RULE, thickness := 1.0) -> ColorRect:
	var r = ColorRect.new()
	r.color = color
	r.custom_minimum_size = Vector2(0, maxf(1.0, thickness * K * 0.6))
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r


static func scroll(content: Control) -> ScrollContainer:
	var s = ScrollContainer.new()
	s.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	s.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER
	if HOVER:
		# A computer gets a thin gold scroll bar to grab.
		s.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
		var bar = s.get_v_scroll_bar()
		var track = StyleBoxFlat.new(); track.bg_color = Color(0, 0, 0, 0.18); track.content_margin_left = px(4); track.content_margin_right = px(4)
		var grab = StyleBoxFlat.new(); grab.bg_color = Color(BORDER_HOVER, 0.75); grab.set_corner_radius_all(px(3))
		var grab_hi = grab.duplicate(); grab_hi.bg_color = ACCENT
		bar.add_theme_stylebox_override("scroll", track)
		bar.add_theme_stylebox_override("grabber", grab)
		bar.add_theme_stylebox_override("grabber_highlight", grab_hi)
		bar.add_theme_stylebox_override("grabber_pressed", grab_hi)
	s.set_anchors_preset(Control.PRESET_FULL_RECT)
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.add_child(content)
	return s


# ── plates and sheets ───────────────────────────────────────────────────────
const TONES := {
	"plain": {"rim": Color("#4d3b29"), "corner": Color("#b8935c"), "fill": Color(0.13, 0.1, 0.07, 0.95), "line": Color(0.925, 0.85, 0.69, 0.13)},
	"gold": {"rim": Color("#8f6f45"), "corner": Color("#e6c27f"), "fill": Color("#2f2012"), "line": Color(0.925, 0.85, 0.69, 0.16)},
	"muted": {"rim": Color("#2f251b"), "corner": Color("#5c4a35"), "fill": Color(0.08, 0.06, 0.045, 0.72), "line": Color(0.925, 0.85, 0.69, 0.06)},
	"pill": {"rim": Color("#4d3b29"), "corner": Color(0, 0, 0, 0), "fill": Color(0.07, 0.05, 0.035, 0.85), "line": Color(0, 0, 0, 0)},
}


static func frame_style(tone := "plain", pad := Vector4(12, 12, 12, 12), radius := 6.0, pressed := false) -> StyleBoxFlat:
	var t: Dictionary = TONES[tone]
	var sb = StyleBoxFlat.new()
	sb.bg_color = t.fill
	sb.border_color = t.corner if pressed else t.rim
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(px(radius))
	sb.content_margin_left = px(pad.x)
	sb.content_margin_top = px(pad.y)
	sb.content_margin_right = px(pad.z)
	sb.content_margin_bottom = px(pad.w)
	sb.anti_aliasing = true
	return sb


## A leather plate in a tooled rim with a cream hairline inside and small ochre corners.
static func frame(tone := "plain", pad := Vector4(12, 12, 12, 12)) -> PanelContainer:
	var p = PanelContainer.new()
	p.add_theme_stylebox_override("panel", frame_style(tone, pad))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var t: Dictionary = TONES[tone]
	p.draw.connect(func():
		var r = Rect2(Vector2.ZERO, p.size)
		var i = px(3)
		p.draw_rect(r.grow(-i), t.line, false, 1.5)
		_corners(p, r, t.corner))
	return p


static func _corners(c: CanvasItem, r: Rect2, color: Color, size := 9.0) -> void:
	if color.a == 0: return
	var s = px(size); var w = 3.0
	var tl = r.position; var br = r.end
	for p in [[tl, Vector2(1, 1)], [Vector2(br.x, tl.y), Vector2(-1, 1)], [Vector2(tl.x, br.y), Vector2(1, -1)], [br, Vector2(-1, -1)]]:
		var o: Vector2 = p[0]; var d: Vector2 = p[1]
		c.draw_polyline(PackedVector2Array([o + Vector2(0, d.y * s), o, o + Vector2(d.x * s, 0)]), color, w)


static func parchment_style(pad := Vector4(16, 14, 16, 14)) -> StyleBoxTexture:
	var sb = StyleBoxTexture.new()
	sb.texture = PAPER
	sb.content_margin_left = px(pad.x)
	sb.content_margin_top = px(pad.y)
	sb.content_margin_right = px(pad.z)
	sb.content_margin_bottom = px(pad.w)
	return sb


## A sheet of parchment with browned edges: write on it in ink.
static func parchment(pad := Vector4(16, 14, 16, 14)) -> PanelContainer:
	var p = PanelContainer.new()
	p.add_theme_stylebox_override("panel", parchment_style(pad))
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return p


## A red wax seal with an icon pressed into it.
static func wax_seal(size: float, icon_name: String, rotation := -8.0) -> Control:
	var c = Control.new()
	var s = px(size)
	c.custom_minimum_size = Vector2(s, s)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func():
		var ctr = c.size * 0.5
		var r = minf(c.size.x, c.size.y) * 0.5
		c.draw_circle(ctr, r, WAX_DARK)
		c.draw_circle(ctr, r * 0.9, WAX)
		c.draw_circle(ctr - Vector2(r, r) * 0.18, r * 0.55, Color(0.78, 0.3, 0.22, 0.35))
		c.draw_arc(ctr, r * 0.72, 0, TAU, 48, Color(0.16, 0.02, 0.01, 0.45), 1.5)
		c.draw_arc(ctr, r * 0.9, 0, TAU, 48, Color(1, 0.75, 0.63, 0.25), 1.5))
	var ic = icon(icon_name, size * 0.45, SEAL_TEXT, "fill")
	var half = ic.custom_minimum_size * 0.5
	ic.anchor_left = 0.5; ic.anchor_right = 0.5; ic.anchor_top = 0.5; ic.anchor_bottom = 0.5
	ic.offset_left = -half.x; ic.offset_right = half.x; ic.offset_top = -half.y; ic.offset_bottom = half.y
	ic.rotation_degrees = rotation
	ic.pivot_offset = half
	c.add_child(ic)
	return c


static func progress(pct: float, color: Color, height := 5.0) -> Control:
	var c = Control.new()
	c.custom_minimum_size = Vector2(0, px(height))
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func():
		var r = Rect2(Vector2.ZERO, c.size)
		var rad = c.size.y * 0.5
		var bg = StyleBoxFlat.new(); bg.bg_color = Color(0.23, 0.18, 0.13, 0.9); bg.set_corner_radius_all(int(rad))
		c.draw_style_box(bg, r)
		var w = c.size.x * clampf(pct / 100.0, 0, 1)
		if w > 1:
			var fg = StyleBoxFlat.new(); fg.bg_color = color; fg.set_corner_radius_all(int(rad))
			c.draw_style_box(fg, Rect2(0, 0, w, c.size.y)))
	return c


# ── pictures ────────────────────────────────────────────────────────────────
static func tex(path: String) -> Texture2D:
	if path == "": return null
	if not _tex_cache.has(path):
		var full = "res://assets/" + path
		_tex_cache[path] = load(full) if ResourceLoader.exists(full) else null
	return _tex_cache[path]


## A picture with rounded corners, optionally greyed out.
static func picture(path: String, w: float, h: float = -1, radius := 6.0, gray := false) -> TextureRect:
	var t = TextureRect.new()
	t.texture = tex(path)
	if h < 0: h = w
	t.custom_minimum_size = Vector2(px(w), px(h))
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	# Never squashed: a box of another shape crops the picture instead.
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	t.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var m = ShaderMaterial.new()
	m.shader = ROUNDED
	m.set_shader_parameter("radius_px", float(px(radius)))
	m.set_shader_parameter("gray", 1.0 if gray else 0.0)
	t.material = m
	t.resized.connect(func(): m.set_shader_parameter("size_px", t.size))
	return t


## Keeps a box that stretches across `ratio` times as tall as it is wide
## (at most `max_h` points), so a portrait in it stays a portrait.
static func keep_ratio(c: Control, ratio: float, max_h := 1e6) -> Control:
	c.resized.connect(func():
		var h = minf(round(c.size.x * ratio), px(max_h))
		if absf(c.custom_minimum_size.y - h) > 0.5: c.custom_minimum_size.y = h)
	return c


## Something drawn over a picture (a ring, a mark). Drawn on a layer of its
## own, since the picture's rounding shader would paint it over.
static func overlay(pic: Control, fn: Callable) -> Control:
	var o = Control.new()
	o.set_anchors_preset(Control.PRESET_FULL_RECT)
	o.mouse_filter = Control.MOUSE_FILTER_IGNORE
	o.draw.connect(func(): fn.call(o))
	pic.add_child(o)
	return o


static func portrait(cid: int, size: float, radius := 6.0, gray := false) -> TextureRect:
	return picture(DB.portrait_path(cid), size, size, radius, gray)


# ── touch ───────────────────────────────────────────────────────────────────
## Makes any control a button that still lets its scroll view drag: a tap is a
## press and release without moving far. `pressed_fx` dims it while held.
static func tap(c: Control, fn: Callable, pressed_fx := true) -> Control:
	c.mouse_filter = Control.MOUSE_FILTER_PASS
	var state = {"at": Vector2.ZERO, "down": false, "base": c.modulate, "over": false}
	var rest = func(): c.modulate = Color(state.base.r * 1.14, state.base.g * 1.1, state.base.b * 1.02, state.base.a) if state.over else state.base
	if HOVER:
		c.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		c.mouse_entered.connect(func():
			if not state.over: state.base = c.modulate
			state.over = true
			if not state.down: rest.call())
		c.mouse_exited.connect(func():
			state.over = false
			if not state.down: rest.call())
	c.gui_input.connect(func(ev: InputEvent):
		if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT:
			if ev.pressed:
				state.at = ev.global_position
				state.down = true
				if not state.over: state.base = c.modulate
				if pressed_fx: c.modulate = Color(0.82, 0.78, 0.72, state.base.a)
			elif state.down:
				state.down = false
				rest.call()
				if ev.global_position.distance_to(state.at) < px(10):
					Sound.sfx("click", 0.45)
					fn.call()
		elif ev is InputEventMouseMotion and state.down and ev.global_position.distance_to(state.at) >= px(10):
			state.down = false
			rest.call())
	return c


# ── buttons ─────────────────────────────────────────────────────────────────
## The main call to action: a strip of parchment with the order inked on it.
static func primary_button(text: String, fn: Callable, icon_name := "", trailing := "", height := 50.0, disabled := false) -> PanelContainer:
	var p = parchment(Vector4(20, 0, 20, 0))
	p.custom_minimum_size = Vector2(0, px(height))
	var row = hbox(8, BoxContainer.ALIGNMENT_CENTER)
	if icon_name != "": row.add_child(icon(icon_name, 18, INK))
	var l = label(text, 17, INK, "title")
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(l)
	if trailing != "":
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(icon(trailing, 18, INK))
	p.add_child(row)
	if disabled: p.modulate = Color(1, 1, 1, 0.45)
	else:
		tap(p, fn)
		if not default_action.is_valid(): default_action = fn
	return p


static func secondary_button(text: String, fn: Callable, height := 46.0) -> PanelContainer:
	var p = PanelContainer.new()
	var sb = frame_style("pill", Vector4(18, 0, 18, 0), 6)
	sb.border_color = BORDER_STRONG
	p.add_theme_stylebox_override("panel", sb)
	p.custom_minimum_size = Vector2(0, px(height))
	var l = label(text, 15, TEXT_MUTED, "caps")
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	p.add_child(l)
	tap(p, fn)
	return p


## Back links and small header actions: a dark pill in a bronze rim.
static func ghost_link(text: String, fn: Callable, icon_name := "") -> PanelContainer:
	var p = PanelContainer.new()
	var sb = frame_style("pill", Vector4(11, 0, 11, 0), 15)
	p.add_theme_stylebox_override("panel", sb)
	p.custom_minimum_size = Vector2(0, px(30))
	p.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	var row = hbox(6)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	if icon_name != "": row.add_child(icon(icon_name, 13, Color("#dcc699")))
	var l = label(text, 13.5, Color("#dcc699"), "medium")
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(l)
	p.add_child(row)
	tap(p, fn)
	return p


static func back_link() -> PanelContainer:
	return ghost_link(Game.back_label(), Game.back, "arrow-left")


## An inked action on a parchment sheet ("Посмотреть →", "Понятно").
static func ink_action(text: String, fn: Callable, red := false, disabled := false) -> Control:
	var row = hbox(6, BoxContainer.ALIGNMENT_CENTER)
	row.custom_minimum_size = Vector2(0, px(40))
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var l = label(text, 16, INK_RED if red else INK_MUTED, "title" if red else "caps")
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(l)
	if red: row.add_child(icon("arrow-right", 15, INK_RED))
	if disabled: row.modulate = Color(1, 1, 1, 0.35)
	else: tap(row, fn)
	return row


## A toggle pill (battle speed, auto-play, filters).
static func chip(text: String, on: bool, fn: Callable, icon_name := "") -> PanelContainer:
	var p = PanelContainer.new()
	var sb = frame_style("pill", Vector4(10, 0, 10, 0), 14)
	sb.border_color = ACCENT if on else BORDER_STRONG
	# A dark fill even when off, so a chip over the 3D field stays legible.
	sb.bg_color = Color(ACCENT, 0.16) if on else Color(0.04, 0.03, 0.02, 0.55)
	p.add_theme_stylebox_override("panel", sb)
	p.custom_minimum_size = Vector2(0, px(28))
	p.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var row = hbox(5, BoxContainer.ALIGNMENT_CENTER)
	if icon_name != "": row.add_child(icon(icon_name, 13, ACCENT_SOFT if on else TEXT_MUTED))
	var l = label(text, 12.5, TEXT if on else TEXT_MUTED, "medium")
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(l)
	p.add_child(row)
	tap(p, fn)
	return p


## A heading in ink on parchment, with a hand-drawn rule under it.
static func ink_heading(text: String) -> VBoxContainer:
	var v = vbox(3)
	v.add_child(label(text, 19, INK, "title"))
	var r = rule()
	r.size_flags_horizontal = Control.SIZE_FILL
	v.add_child(r)
	return v


## A valor point: a small gold diamond, hollow when spent.
static func valor_pip(lit: bool, size := 9.0) -> Control:
	var c = Control.new()
	c.custom_minimum_size = Vector2(px(size), px(size))
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func():
		var h = c.size * 0.5
		var pts = PackedVector2Array([Vector2(h.x, 0), Vector2(c.size.x, h.y), Vector2(h.x, c.size.y), Vector2(0, h.y)])
		if lit: c.draw_colored_polygon(pts, VALOR)
		pts.append(pts[0])
		c.draw_polyline(pts, VALOR if lit else Color(VALOR, 0.35), 1.5))
	return c


static func class_badge(class_id: String, size := 12.5) -> HBoxContainer:
	var hc = DB.hero_class(class_id)
	var row = hbox(4)
	var col = Color(hc.color)
	row.add_child(icon(hc.icon, size - 0.5, col))
	row.add_child(label(hc.name, size, col, "semibold"))
	return row


static func clear(n: Node) -> void:
	for c in n.get_children():
		n.remove_child(c)
		c.queue_free()


## A wide picture that fills its box, cropped to keep its shape (key art).
static func cover(path: String, h: float, focus_x := 0.5) -> TextureRect:
	var t = TextureRect.new()
	t.texture = tex(path)
	t.custom_minimum_size = Vector2(0, px(h))
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t


## A vertical fade to the given colour, for laying text over art.
static func fade(top: Color, bottom: Color, h: float) -> TextureRect:
	var g = Gradient.new()
	g.colors = PackedColorArray([top, bottom])
	var gt = GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0, 0)
	gt.fill_to = Vector2(0, 1)
	gt.width = 4
	gt.height = 64
	var t = TextureRect.new()
	t.texture = gt
	t.custom_minimum_size = Vector2(0, px(h))
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_SCALE
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t
