class_name App
extends Control
## The whole game's window: the leather background, the current screen, and
## the phone's back button (Esc on a computer). Rebuilds the screen (at most
## once a frame) when the Game changes, and when the window turns between
## tall (phone layout) and wide (computer layout).

const SCREENS := {
	"title": "res://scripts/screens/title.gd", "draft": "res://scripts/screens/draft.gd", "home": "res://scripts/screens/home.gd",
	"roster": "res://scripts/screens/roster.gd", "char": "res://scripts/screens/character.gd", "gear": "res://scripts/screens/gear.gd",
	"inventory": "res://scripts/screens/inventory.gd", "shop": "res://scripts/screens/shop.gd", "dungeon": "res://scripts/screens/dungeon.gd",
	"combat": "res://scripts/screens/combat.gd", "results": "res://scripts/screens/results.gd", "quests": "res://scripts/screens/quests.gd",
	"contracts": "res://scripts/screens/contracts.gd", "settings": "res://scripts/screens/settings.gd", "event": "res://scripts/screens/event.gd",
	"analytics": "res://scripts/screens/analytics.gd", "personnel": "res://scripts/screens/personnel.gd", "levelmap": "res://scripts/screens/levelmap.gd",
	"hire": "res://scripts/screens/hire.gd", "arena": "res://scripts/screens/arena.gd", "profession": "res://scripts/screens/profession.gd",
	"achievements": "res://scripts/screens/achievements.gd", "weekly": "res://scripts/screens/weekly.gd",
	"talents": "res://scripts/screens/talents.gd", "world": "res://scripts/screens/world.gd", "town": "res://scripts/screens/town.gd",
	"bivouac": "res://scripts/screens/bivouac.gd",
}

static var _insets = Vector2.ZERO
## A window wider than tall gets the computer layout: a side rail instead of
## the bottom bar, and screens laid out across.
static var wide = false

var current: Screen
var current_name = ""
var _bg: TextureRect
var _dirty = false


static func inset_top() -> float:
	return _insets.x


static func inset_bottom() -> float:
	return _insets.y


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	# Taps that miss every button go on to the 3D field or map underneath.
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	get_tree().set_auto_accept_quit(false)
	get_tree().set_quit_on_go_back(false)
	_measure_insets()
	theme = _theme()
	wide = _is_wide()
	get_viewport().size_changed.connect(_on_resize)
	var bg = TextureRect.new()
	bg.texture = load("res://assets/ui/leather-bg.jpg")
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	_bg = bg
	Game.changed.connect(func():
		if not _dirty:
			_dirty = true
			_update.call_deferred())
	_update()
	_maybe_shot.call_deferred()


## For checking screens without a phone:
## `-- --shot=out.png [--demo] [--go=home] [--wait=2] [--auto] [--scroll=px] [--click=x,y]`
## (on the open map also `[--hour=22] [--pos=x,y] [--zoom=1.8] [--yaw=90]`) sets up, renders, saves and quits.
func _maybe_shot() -> void:
	var path = ""
	var go = ""
	var wait = 1.5
	var down = 0
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--scroll="): down = int(a.substr(9))
		if a.begins_with("--shot="): path = a.substr(7)
		if a.begins_with("--go="): go = a.substr(5)
		if a.begins_with("--wait="): wait = float(a.substr(7))
		if a == "--demo": Demo.setup()
		if a == "--auto": Game.settings.auto = true
	if path == "": return
	if go != "": Demo.open(go)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--hour=") and Game.w: Game.w.hours = float(a.substr(7))
		if a.begins_with("--pos=") and Game.w:
			var xy = a.substr(6).split(",")
			Game.w.pos = Vector2(float(xy[0]), float(xy[1]))
			Game.w._grace = 9999.0
	await get_tree().create_timer(wait).timeout
	for a in OS.get_cmdline_user_args():
		# The open map's camera: `--zoom=1.8` out, `--yaw=90` turned, in degrees.
		if a.begins_with("--zoom=") or a.begins_with("--yaw="):
			for v in get_tree().root.find_children("*", "Node3D", true, false):
				if not v is WorldView: continue
				if a.begins_with("--zoom="): v.zoom = float(a.substr(7)); v._zoom_target = v.zoom
				else: v.yaw += deg_to_rad(float(a.substr(6))); v._yaw_target = v.yaw
			await get_tree().process_frame
		if a.begins_with("--click="):
			var xy = a.substr(8).split(",")
			var at = Vector2(float(xy[0]), float(xy[1]))
			for pressed in [true, false]:
				var ev = InputEventMouseButton.new()
				ev.button_index = MOUSE_BUTTON_LEFT
				ev.pressed = pressed
				ev.position = at
				ev.global_position = at
				Input.parse_input_event(ev)
				await get_tree().process_frame
			await get_tree().create_timer(1.0).timeout
			print("clicked: squad at ", Game.w.pos, " walking to ", Game.w.target)
	if down > 0 and current and current.scroll:
		current.scroll.scroll_vertical = down
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)
	print("saved ", path)
	get_tree().quit()


## The phone's status bar and gesture bar, in canvas pixels.
func _measure_insets() -> void:
	var safe = DisplayServer.get_display_safe_area()
	var screen = DisplayServer.screen_get_size()
	var view = get_viewport_rect().size
	if screen.y <= 0 or safe.size.y <= 0: return
	var k = view.y / screen.y
	_insets = Vector2(maxf(0, safe.position.y * k), maxf(0, (screen.y - safe.end.y) * k))


## Tooltips in the game's own ink and leather.
func _theme() -> Theme:
	var t = Theme.new()
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.05, 0.035, 0.97); sb.border_color = UI.BORDER_HOVER
	sb.set_border_width_all(2); sb.set_corner_radius_all(UI.px(6))
	sb.set_content_margin_all(UI.px(8))
	t.set_stylebox("panel", "TooltipPanel", sb)
	t.set_font("font", "TooltipLabel", UI.FONTS.regular)
	t.set_font_size("font_size", "TooltipLabel", UI.px(12.5))
	t.set_color("font_color", "TooltipLabel", UI.TEXT_MUTED)
	return t


func _is_wide() -> bool:
	var v = get_viewport_rect().size
	return v.x > v.y * 1.1


func _on_resize() -> void:
	var w = _is_wide()
	if w == wide: return
	wide = w
	_measure_insets()
	if current: current.refresh()


func _update() -> void:
	_dirty = false
	var scale = float(Game.settings.get("uiScale", 1.0))
	if not is_equal_approx(get_tree().root.content_scale_factor, scale):
		get_tree().root.content_scale_factor = scale
	if Game.screen != current_name:
		if current:
			current.queue_free()
		current_name = Game.screen
		# The fight shows its 3D field through the screen, under the panels.
		_bg.visible = not (current_name in ["combat", "world"])
		current = load(SCREENS[current_name]).new()
		add_child(current)
	current.refresh()


func _unhandled_input(ev: InputEvent) -> void:
	if not (ev is InputEventKey and ev.pressed and not ev.echo): return
	if ev.keycode == KEY_ESCAPE:
		Game.hardware_back()
		get_viewport().set_input_as_handled()
	elif ev.keycode in [KEY_ENTER, KEY_KP_ENTER] and not ev.alt_pressed and UI.default_action.is_valid():
		UI.default_action.call()
		get_viewport().set_input_as_handled()
	elif ev.keycode == KEY_F11 or (ev.keycode == KEY_ENTER and ev.alt_pressed):
		var full = DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)
		get_viewport().set_input_as_handled()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST or what == NOTIFICATION_WM_CLOSE_REQUEST:
		if what == NOTIFICATION_WM_CLOSE_REQUEST or not Game.hardware_back(): get_tree().quit()
