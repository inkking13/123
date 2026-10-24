class_name Screen
extends Control
## One screen of the game. `build()` fills it from the Game's state; the app
## calls `refresh()` whenever the Game changes, which rebuilds the content and
## keeps the scroll where it was.

const WIDE_W := 1000.0
const NARROW_W := 620.0

var scroll: ScrollContainer
var _col = Vector2.ZERO
var page: VBoxContainer


func _init() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func build() -> void:
	pass


func refresh() -> void:
	var at = scroll.scroll_vertical if scroll else 0
	UI.clear(self)
	UI.default_action = Callable()
	scroll = null
	page = null
	build()
	if scroll:
		scroll.scroll_vertical = at
		# The new content has no size yet: set it again once laid out.
		scroll.set_deferred("scroll_vertical", at)


## The usual page: a scrolling column with the phone's insets and room for the
## tab bar. On a wide window the column sits right of the rail, at most
## `wide_w` points across (narrow forms and letters ask for less).
func make_page(sep := 0.0, top := 24.0, side := 20.0, tab_bar := true, wide_w := WIDE_W) -> VBoxContainer:
	page = UI.vbox(sep)
	var m: MarginContainer
	if App.wide:
		var rail = Tabs.RAIL if tab_bar else 0.0
		var vw = get_viewport_rect().size.x / UI.K
		var col = minf(vw - rail - 64.0, wide_w)
		var left = rail + (vw - rail - col) * 0.5
		_col = Vector2(left, vw - left - col)
		m = UI.margin(page, left, top + 12.0, vw - left - col, 40.0)
	else:
		var bottom = (Tabs.HEIGHT + 24.0) if tab_bar else 24.0
		m = UI.margin(page, side, App.inset_top() / UI.K + top, side, bottom + App.inset_bottom() / UI.K)
	scroll = UI.scroll(m)
	add_child(scroll)
	if tab_bar: add_child(Tabs.make())
	return page


## A dark sheet over a 3D scene (the camp, the muster): the lower `share`
## of a phone's screen above the tab bar, or a column on the right of a wide
## window. `content` scrolls; `dock`, if any, stays at the sheet's foot.
func scene_sheet(content: Control, dock: Control = null, share := 0.56) -> PanelContainer:
	var pn = PanelContainer.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.063, 0.047, 0.035, 0.9)
	sb.border_color = Color(0.79, 0.64, 0.42, 0.45)
	sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(12))
	sb.content_margin_left = UI.px(16); sb.content_margin_right = UI.px(16)
	sb.content_margin_top = UI.px(12); sb.content_margin_bottom = UI.px(10 if dock else 4)
	pn.add_theme_stylebox_override("panel", sb)
	pn.mouse_filter = Control.MOUSE_FILTER_STOP
	scroll = UI.scroll(content)
	if dock:
		var v = UI.vbox(10)
		scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
		v.add_child(scroll)
		v.add_child(dock)
		pn.add_child(v)
	else: pn.add_child(scroll)
	var vp = get_viewport_rect().size
	if App.wide:
		pn.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
		pn.offset_left = -UI.px(470); pn.offset_right = -UI.px(14)
		pn.offset_top = UI.px(14); pn.offset_bottom = -UI.px(14)
	else:
		pn.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		pn.offset_left = UI.px(8); pn.offset_right = -UI.px(8)
		pn.offset_bottom = -UI.px(Tabs.HEIGHT + 6) - App.inset_bottom()
		pn.offset_top = -vp.y * share
	add_child(pn)
	_fit_scene.call_deferred(pn)
	return pn


## Tells the 3D view behind which part of the screen the sheet covers, so it
## keeps its subject in what is left open.
func _fit_scene(pn: Control) -> void:
	if not is_instance_valid(pn): return
	var vp = get_viewport_rect().size
	var r = pn.get_global_rect()
	for v in get_tree().root.get_children():
		if v is CampView:
			v.band_bottom = 0.0 if App.wide else vp.y - r.position.y
			v.band_right = vp.x - r.position.x if App.wide else 0.0
			v.band_left = UI.px(Tabs.RAIL) if App.wide else 0.0


## Pins a bar (the way on, a tally) to the bottom: above the tab bar on a
## phone, under the page's column on a wide window.
func pin_bottom(bar: Control) -> void:
	bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bar.grow_vertical = Control.GROW_DIRECTION_BEGIN
	if App.wide:
		bar.offset_left = UI.px(_col.x); bar.offset_right = -UI.px(_col.y)
		bar.offset_bottom = -UI.px(16)
	else:
		bar.offset_bottom = -UI.px(Tabs.HEIGHT) - App.inset_bottom()
	add_child(bar)


## On a wide window, lines a bar pinned to the screen's edge up with the page's column.
func span_column(bar: Control) -> void:
	if App.wide:
		bar.offset_left = UI.px(_col.x); bar.offset_right = -UI.px(_col.y)


## A row of equal tab buttons; `pick` gets the chosen key.
func tab_row(options: Array, current: String, pick: Callable) -> HBoxContainer:
	var row = UI.hbox(8)
	for o in options:
		var key: String = o[0]
		var on = key == current
		var pn = PanelContainer.new()
		var sb = UI.frame_style("pill", Vector4(6, 0, 6, 0), 8)
		sb.border_color = UI.ACCENT if on else UI.BORDER_STRONG
		sb.bg_color = Color(UI.ACCENT, 0.12) if on else Color(0, 0, 0, 0)
		pn.add_theme_stylebox_override("panel", sb)
		pn.custom_minimum_size = Vector2(0, UI.px(38))
		pn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var l = UI.label(o[1], 13.5, UI.ACCENT_SOFT if on else UI.TEXT_DIM, "medium")
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		pn.add_child(l)
		UI.tap(pn, func(): pick.call(key))
		row.add_child(pn)
	return row


## An item as a card: icon, slot, name and a line under it, with something on the right.
func item_card(icon_path: String, kicker: String, name: String, desc: String, name_color: Color = UI.TEXT, right: Control = null, accent = null) -> PanelContainer:
	var fr = UI.frame("plain", Vector4(12, 12, 12, 12))
	if accent != null:
		var sb: StyleBoxFlat = fr.get_theme_stylebox("panel")
		sb.border_width_left = 6
		sb.border_color = accent
	var row = UI.hbox(10)
	row.add_child(UI.picture(icon_path, 44, 44, 8))
	var v = UI.vbox(2)
	if kicker != "": v.add_child(UI.label(kicker.to_upper(), 10.5, UI.TEXT_FAINT))
	v.add_child(UI.label(name, 15.5, name_color, "medium", true))
	if desc != "": v.add_child(UI.label(desc, 12.5, UI.TEXT_DIM, "regular", true))
	row.add_child(UI.expand(v))
	if right: row.add_child(UI.center(right))
	fr.add_child(row)
	return fr


func empty_note(text: String) -> Control:
	var fr = UI.frame("muted", Vector4(20, 20, 20, 20))
	var l = UI.label(text, 14, UI.TEXT_FAINT, "regular", true)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	fr.add_child(l)
	return fr


## A small price/action button on a card.
func pill_button(text: String, on: bool, fn: Callable) -> PanelContainer:
	var pn = PanelContainer.new()
	var sb = UI.frame_style("pill", Vector4(12, 8, 12, 8), 7)
	sb.border_color = UI.ACCENT if on else UI.BORDER
	sb.bg_color = Color(UI.ACCENT, 0.12) if on else Color(0, 0, 0, 0)
	pn.add_theme_stylebox_override("panel", sb)
	pn.add_child(UI.label(text, 14, UI.ACCENT_SOFT if on else UI.TEXT_FAINT, "medium"))
	if on: UI.tap(pn, fn)
	else: pn.modulate.a = 0.5
	return pn


## Back link and the treasury, across the top of a camp screen.
func header_with_gold() -> HBoxContainer:
	var head = UI.hbox(8)
	head.add_child(UI.back_link())
	head.add_child(UI.flex())
	head.add_child(UI.icon("coins", 15, UI.WARN, "fill"))
	head.add_child(UI.label(str(Game.gold), 16, UI.WARN, "medium"))
	return head
