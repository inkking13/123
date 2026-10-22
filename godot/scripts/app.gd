class_name App
extends Control
## The whole game's window: the leather background, the current screen, and
## the phone's back button. Rebuilds the screen (at most once a frame) when
## the Game changes.

const SCREENS := {
	"title": "res://scripts/screens/title.gd", "draft": "res://scripts/screens/draft.gd", "home": "res://scripts/screens/home.gd",
	"roster": "res://scripts/screens/roster.gd", "char": "res://scripts/screens/character.gd", "gear": "res://scripts/screens/gear.gd",
	"inventory": "res://scripts/screens/inventory.gd", "shop": "res://scripts/screens/shop.gd", "dungeon": "res://scripts/screens/dungeon.gd",
	"combat": "res://scripts/screens/combat.gd", "results": "res://scripts/screens/results.gd", "quests": "res://scripts/screens/quests.gd",
	"contracts": "res://scripts/screens/contracts.gd", "settings": "res://scripts/screens/settings.gd", "event": "res://scripts/screens/event.gd",
	"analytics": "res://scripts/screens/analytics.gd", "personnel": "res://scripts/screens/personnel.gd", "levelmap": "res://scripts/screens/levelmap.gd",
	"hire": "res://scripts/screens/hire.gd", "arena": "res://scripts/screens/arena.gd", "profession": "res://scripts/screens/profession.gd",
	"achievements": "res://scripts/screens/achievements.gd", "weekly": "res://scripts/screens/weekly.gd",
}

static var _insets = Vector2.ZERO

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
	get_tree().set_auto_accept_quit(false)
	get_tree().set_quit_on_go_back(false)
	_measure_insets()
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
## `-- --shot=out.png [--demo] [--go=home] [--wait=2] [--auto]` sets up, renders, saves and quits.
func _maybe_shot() -> void:
	var path = ""
	var go = ""
	var wait = 1.5
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="): path = a.substr(7)
		if a.begins_with("--go="): go = a.substr(5)
		if a.begins_with("--wait="): wait = float(a.substr(7))
		if a == "--demo": Demo.setup()
		if a == "--auto": Game.settings.auto = true
	if path == "": return
	if go != "": Demo.open(go)
	await get_tree().create_timer(wait).timeout
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


func _update() -> void:
	_dirty = false
	if Game.screen != current_name:
		if current:
			current.queue_free()
		current_name = Game.screen
		# The fight shows its 3D field through the screen, under the panels.
		_bg.visible = current_name != "combat"
		current = load(SCREENS[current_name]).new()
		add_child(current)
	current.refresh()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST or what == NOTIFICATION_WM_CLOSE_REQUEST:
		if what == NOTIFICATION_WM_CLOSE_REQUEST or not Game.hardware_back(): get_tree().quit()
