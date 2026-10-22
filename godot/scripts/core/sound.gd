extends Node
## Sound and music (the Sound autoload). Effects play from a small pool of
## players with a touch of random pitch, the same one twice within 40 ms plays
## once; music cross-fades between camp, battle and boss. The fight is heard
## by watching the battle's state change, like the 3D view does: who acts,
## blows landing, deaths, the wind-up, the stun, the end. Off in settings,
## off here.

const SFX := ["swing", "hit", "crit", "bow", "arrowHit", "cast", "boom", "heal", "rally", "enemySwing", "windup",
	"boneDeath", "heroDown", "dodge", "step", "stun", "victory", "defeat", "levelUp", "click", "coin", "page"]
const MUSIC := {"camp": "music-camp", "battle": "music-battle", "boss": "music-boss"}
const SFX_DB := -2.0
const MUSIC_DB := -11.0
const FADE := 1.4
const POOL := 10

var _streams = {}
var _pool: Array[AudioStreamPlayer] = []
var _next = 0
var _last = {}
var _tracks = {}
var _music: AudioStreamPlayer
var _music_old: AudioStreamPlayer
var _want = ""
var _playing = ""
var _snap = null
var _gold = -1
var _levels = -1
var _screen = ""
var _step_t = 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in POOL:
		var p = AudioStreamPlayer.new()
		add_child(p)
		_pool.append(p)
	_music = AudioStreamPlayer.new()
	_music_old = AudioStreamPlayer.new()
	add_child(_music)
	add_child(_music_old)


func _stream(name: String) -> AudioStream:
	if not _streams.has(name):
		var path = "res://assets/audio/%s.mp3" % name
		_streams[name] = load(path) if ResourceLoader.exists(path) else null
	return _streams[name]


## Plays an effect: `delay` in ms to land with what is on screen, `rate`
## shifts the pitch, `volume` 0..1.
func sfx(name: String, volume := 1.0, rate := 1.0, delay := 0.0, spread := 0.06) -> void:
	if not Game.settings.get("sound", true): return
	var now = Time.get_ticks_msec() + delay
	if now - _last.get(name, -1e9) < 40: return
	_last[name] = now
	if delay > 0:
		get_tree().create_timer(delay / 1000.0, true, false, true).timeout.connect(func(): _play(name, volume, rate, spread))
	else:
		_play(name, volume, rate, spread)


func _play(name: String, volume: float, rate: float, spread: float) -> void:
	var s = _stream(name)
	if s == null: return
	var p: AudioStreamPlayer = _pool[_next]
	_next = (_next + 1) % POOL
	p.stream = s
	p.volume_db = SFX_DB + linear_to_db(maxf(0.01, volume))
	p.pitch_scale = rate * (1.0 + (randf() - 0.5) * spread)
	p.play()


## Which track should play ("" for none); cross-fades when it changes.
func music(name: String) -> void:
	_want = name
	_sync_music()


func _sync_music() -> void:
	var name = _want if Game.settings.get("music", true) else ""
	if name == _playing: return
	_playing = name
	var old = _music
	_music = _music_old
	_music_old = old
	if _music_old.playing:
		var t = create_tween()
		t.tween_property(_music_old, "volume_db", -60.0, FADE)
		t.tween_callback(_music_old.stop)
	if name == "": return
	if not _tracks.has(name):
		var s = load("res://assets/audio/%s.mp3" % MUSIC[name])
		if s is AudioStreamMP3: s.loop = true
		_tracks[name] = s
	_music.stream = _tracks[name]
	_music.volume_db = -60.0
	_music.play()
	create_tween().tween_property(_music, "volume_db", MUSIC_DB, FADE)


# ── what the game is doing, heard ──────────────────────────────────────────
func _process(dt: float) -> void:
	if not is_instance_valid(Game) or Game.pool == null: return
	var scr: String = Game.screen
	match scr:
		"combat", "results":
			var s = Game.b.sim
			music("boss" if s and s.encounterType == "boss" and not (s.over and not s.victory) else "battle")
		"title": music("camp")
		_: music("camp")
	if scr != _screen:
		if _screen != "" and not (scr in ["combat", "results"]): sfx("page", 0.35)
		if scr == "results" and Game.b.result and not Game.b.result.win: sfx("defeat", 0.9, 1.0, 0.0, 0.0)
		_screen = scr
	# Gold and levels earned anywhere.
	if _gold >= 0 and Game.gold > _gold and scr != "combat": sfx("coin", 0.7)
	_gold = Game.gold
	var lv = 0
	for c in Game.pool: lv += int(c.level)
	if _levels >= 0 and lv > _levels: sfx("levelUp", 0.8, 1.0, 300.0)
	_levels = lv
	# Footsteps on the map.
	if scr == "world" and Game.w.target != null:
		_step_t -= dt
		if _step_t <= 0:
			_step_t = 0.42
			sfx("step", 0.35, 1.0, 0.0, 0.15)
	_combat(scr)


func _combat_snap(s: Dictionary) -> Dictionary:
	var foes = s.enemies + s.minions
	var foe_hp = 0.0 if not s.enemies.is_empty() else float(s.boss.hp)
	var alive_foes = {}
	for e in foes:
		if e.alive:
			foe_hp += e.hp
			alive_foes["e%d" % e.id] = true
	if s.enemies.is_empty() and s.boss.hp > 0: alive_foes["boss"] = true
	var heroes = {}
	var alive_heroes = {}
	for r in s.raiders:
		heroes[r.id] = r.hp
		if r.alive: alive_heroes[r.id] = true
	return {"fx": s.fx.seq, "impact": s.impact.seq, "dodge": s.dodge.seq, "move": s.moveFx.seq if s.moveFx else 0,
		"foeHp": foe_hp, "heroHp": heroes, "foes": alive_foes, "heroes": alive_heroes,
		"windup": s.windup, "stunned": s.stunned, "victory": s.victory}


func _combat(scr: String) -> void:
	var s = Game.b.sim
	if scr != "combat" or s == null:
		_snap = null
		return
	var now = _combat_snap(s)
	var was = _snap
	_snap = now
	if was == null: return
	var f: Dictionary = s.fx
	var hero = null
	if f.actor is int:
		for r in s.raiders:
			if r.id == f.actor: hero = r
	var archer: bool = hero != null and BattleView.HEROES.get(hero.candidateId, {}).get("right", "") == "bow"
	var delay = 450.0 if f.kind in ["ranged", "ability"] else 260.0
	if now.fx != was.fx:
		match f.kind:
			"melee": sfx("swing")
			"ranged": sfx("bow") if archer else sfx("cast", 0.6, 1.5)
			"ability": sfx("cast")
			"heal": sfx("heal", 1.0, 1.0, delay)
			"rally": sfx("rally")
			"enemy": sfx("enemySwing")
	if now.foeHp < was.foeHp:
		if f.crit and f.actor is int: sfx("crit", 1.0, 1.0, delay)
		elif f.kind == "ability": sfx("boom", 0.8, 1.0, delay)
		elif archer: sfx("arrowHit", 1.0, 1.0, delay)
		else: sfx("hit", 1.0, 1.0, delay)
	var hurt = 0
	for id in now.heroHp:
		if now.heroHp[id] < was.heroHp.get(id, now.heroHp[id]): hurt += 1
	if hurt > 0: sfx("hit", minf(1.0, 0.6 + hurt * 0.15), 0.8, 160.0 if f.kind == "enemy" and now.fx != was.fx else 0.0)
	if now.impact != was.impact and not s.impact.cells.is_empty(): sfx("boom")
	if now.dodge != was.dodge: sfx("dodge")
	if now.move != was.move:
		sfx("step")
		sfx("step", 1.0, 0.9, 260.0)
	if now.windup and not was.windup: sfx("windup")
	if now.stunned and not was.stunned: sfx("stun")
	var fell = was.foes.keys().filter(func(k): return not now.foes.has(k))
	if not fell.is_empty(): sfx("boneDeath", 1.0 if "boss" in fell else 0.85, 0.7 if "boss" in fell else 1.0, delay + 120.0)
	if was.heroes.keys().any(func(id): return not now.heroes.has(id)): sfx("heroDown", 1.0, 1.0, 150.0)
	if now.victory and not was.victory: sfx("victory", 1.0, 1.0, 350.0, 0.0)
