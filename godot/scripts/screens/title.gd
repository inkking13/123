extends Screen
## The title: key art, the pitch, continue / new game / settings.

var confirm_new = false


func build() -> void:
	var art = UI.cover("title/title-art.jpg", 0)
	art.set_anchors_preset(Control.PRESET_TOP_WIDE)
	art.anchor_bottom = 0.6
	add_child(art)
	var fade = UI.fade(Color(UI.BG, 0), Color(UI.BG, 1), 120)
	fade.set_anchors_preset(Control.PRESET_TOP_WIDE)
	fade.anchor_top = 0.6; fade.anchor_bottom = 0.6
	fade.offset_top = -UI.px(120)
	add_child(fade)
	var col = UI.vbox(10)
	col.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	col.grow_vertical = Control.GROW_DIRECTION_BEGIN
	var m = UI.margin(col, 24, 0, 24, 28 + App.inset_bottom() / UI.K)
	m.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	m.grow_vertical = Control.GROW_DIRECTION_BEGIN
	add_child(m)
	var k = UI.kicker("Отдел кадров · Гильдия наёмников", UI.ACCENT, 11)
	k.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(k)
	col.add_child(UI.center(UI.ornament(180)))
	var pitch = UI.label("Тебя наняли HR-директором гильдии наёмников — девять личных дел, зарплатная ведомость и подземелье, из которого не все возвращаются на работу в понедельник.", 14.5, UI.TEXT_MUTED, "regular", true)
	pitch.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(pitch)
	col.add_child(UI.space(10))
	var saved = Game.has_save and not Game.needs_draft()
	if confirm_new:
		var w = UI.label("Весь прогресс, герои и золото пропадут. Начать заново?", 14, UI.DANGER, "regular", true)
		w.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(w)
		var row = UI.hbox(10)
		row.add_child(UI.expand(UI.secondary_button("Отмена", func():
			confirm_new = false
			refresh())))
		row.add_child(UI.expand(UI.secondary_button("Начать заново", func():
			confirm_new = false
			Game.reset_progress())))
		col.add_child(row)
	else:
		col.add_child(UI.primary_button("Продолжить" if saved else "Приступить к обязанностям", Game.start, "", "arrow-right", 54))
		if saved:
			var progress = ("Боссов побеждено: %d · золото %d" % [Game.stats_boss_wins, Game.gold]) if Game.stats_boss_wins > 0 else ("Комнат пройдено: %d · золото %d" % [Game.stats_room_wins, Game.gold])
			var p = UI.label(progress, 12.5, UI.TEXT_DIM)
			p.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			col.add_child(p)
		var row = UI.hbox(10)
		if Game.has_save: row.add_child(UI.expand(UI.secondary_button("Новая игра", func():
			confirm_new = true
			refresh())))
		row.add_child(UI.expand(UI.secondary_button("Настройки", func(): Game.go("settings"))))
		col.add_child(row)
	var foot = UI.hbox(6, BoxContainer.ALIGNMENT_CENTER)
	foot.add_child(UI.icon("users-three", 12, UI.TEXT_FAINT))
	foot.add_child(UI.label("Godot 4 · %d личных дел" % DB.all_candidates.size(), 12, UI.TEXT_FAINT))
	col.add_child(UI.space(4))
	col.add_child(foot)
