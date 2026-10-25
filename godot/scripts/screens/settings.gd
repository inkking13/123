extends Screen
## Sound, music, vibration, graphics quality, tips, and wiping the save.

const QUALITY := [["low", "Низкое"], ["medium", "Среднее"], ["high", "Высокое"]]
const SCALES := [[0.85, "85%"], [1.0, "100%"], [1.15, "115%"], [1.3, "130%"]]

var confirm_reset = false


func build() -> void:
	var p = make_page(0, 24, 20, false, NARROW_W)
	p.add_child(UI.back_link())
	p.add_child(UI.space(10))
	p.add_child(UI.screen_title("Настройки"))
	p.add_child(UI.space(16))
	p.add_child(UI.kicker("Обратная связь", Color("#b8935c"), 12))
	p.add_child(UI.space(10))
	p.add_child(_toggle("speaker-high", "sound", "Звуки", "Удары, заклинания, лечение, победа и поражение."))
	p.add_child(_toggle("music-notes", "music", "Музыка", "Своя мелодия в лагере, в бою и на боссе."))
	p.add_child(_toggle("vibrate", "haptics", "Вибрация в бою", "Удары, крит, смерть бойца, победа и поражение."))
	p.add_child(UI.space(10))
	p.add_child(UI.kicker("Качество графики", Color("#b8935c"), 12))
	p.add_child(UI.space(10))
	var fr = UI.frame("plain", Vector4(12, 12, 12, 12))
	var v = UI.vbox(10)
	var row = UI.hbox(8)
	for q in QUALITY:
		var key: String = q[0]
		row.add_child(UI.expand(UI.chip(q[1], Game.settings.quality == key, func(): Game.set_quality(key))))
	v.add_child(row)
	v.add_child(UI.label("Тени от солнца, сглаживание и мелкие детали поля боя. Если игра тормозит, выберите «Низкое».", 13, UI.TEXT_DIM, "regular", true))
	fr.add_child(v)
	p.add_child(fr)
	p.add_child(UI.space(10))
	if not OS.has_feature("mobile"):
		p.add_child(UI.kicker("Экран", Color("#b8935c"), 12))
		p.add_child(UI.space(10))
		var sf = UI.frame("plain", Vector4(12, 12, 12, 12))
		var sv = UI.vbox(10)
		sv.add_child(UI.label("Масштаб интерфейса", 15, UI.TEXT, "medium"))
		var sr = UI.hbox(8)
		var cur = float(Game.settings.get("uiScale", 1.0))
		for sc in SCALES:
			var scale_v: float = sc[0]
			sr.add_child(UI.expand(UI.chip(sc[1], is_equal_approx(cur, scale_v), func(): Game.set_ui_scale(scale_v))))
		sv.add_child(sr)
		sv.add_child(UI.label("Клавиши: Esc — назад, Enter — главная кнопка экрана, F11 — полный экран. В бою: 1–9 — действия, Пробел — пропустить перемещение, A — автобой, X — скорость; колесо мыши — масштаб поля.", 13, UI.TEXT_DIM, "regular", true))
		sf.add_child(sv)
		p.add_child(sf)
		p.add_child(UI.space(10))
	var tips = UI.frame("plain", Vector4(12, 12, 12, 12))
	var tr = UI.hbox(12)
	tr.add_child(UI.icon("target", 18, UI.ACCENT))
	var tv = UI.vbox(2)
	tv.add_child(UI.label("Показать подсказки в бою заново", 15, UI.TEXT, "medium"))
	tv.add_child(UI.label("Подсказки появятся в следующем бою." if Game.seen_tips.is_empty() else "Как ходить, выбирать цель, уходить с красных клеток.", 13, UI.TEXT_DIM, "regular", true))
	tr.add_child(UI.expand(tv))
	tips.add_child(tr)
	UI.tap(tips, Game.reset_tips)
	p.add_child(tips)
	p.add_child(UI.space(18))
	p.add_child(UI.kicker("Прогресс", Color("#b8935c"), 12))
	p.add_child(UI.space(10))
	var info = UI.frame("muted", Vector4(14, 14, 14, 14))
	info.add_child(UI.label("Уровни, снаряжение, таланты, подземелья и реликвии сохраняются автоматически и переживают перезапуск игры.", 13.5, UI.TEXT_MUTED, "regular", true))
	p.add_child(info)
	p.add_child(UI.space(10))
	if not confirm_reset:
		var b = UI.secondary_button("Сбросить прогресс", func():
			confirm_reset = true
			refresh())
		var sb: StyleBoxFlat = b.get_theme_stylebox("panel")
		sb.border_color = UI.DANGER
		(b.get_child(0) as Label).add_theme_color_override("font_color", UI.DANGER)
		p.add_child(b)
	else:
		var w = UI.grim_sheet(Vector4(18, 18, 18, 16), UI.DANGER)
		var wv = UI.vbox(10)
		wv.add_child(UI.grim_head("warning", "Сброс прогресса", "Сжечь архив гильдии?", 34))
		wv.add_child(UI.label("Все герои, золото, снаряжение и пройденные подземелья пропадут. Это нельзя отменить.", 13.5, UI.TEXT_MUTED, "regular", true))
		wv.add_child(UI.grim_rule())
		var br = UI.hbox(8)
		br.add_child(UI.grim_action("Отмена", func():
			confirm_reset = false
			refresh()))
		br.add_child(UI.grim_action("Точно сбросить", func():
			confirm_reset = false
			Game.reset_progress(), true))
		wv.add_child(br)
		w.add_child(wv)
		p.add_child(w)


func _toggle(icon: String, key: String, title: String, text: String) -> Control:
	var on: bool = Game.settings[key]
	var fr = UI.frame("plain", Vector4(12, 12, 12, 12))
	var row = UI.hbox(12)
	var disc = PanelContainer.new()
	disc.add_theme_stylebox_override("panel", UI.frame_style("pill", Vector4(0, 0, 0, 0), 18))
	disc.custom_minimum_size = Vector2(UI.px(36), UI.px(36))
	disc.add_child(UI.center(UI.icon(icon, 17, UI.ACCENT_SOFT if on else UI.TEXT_FAINT)))
	row.add_child(disc)
	var v = UI.vbox(2)
	v.add_child(UI.label(title, 15, UI.TEXT, "medium"))
	v.add_child(UI.label(text, 13, UI.TEXT_DIM, "regular", true))
	row.add_child(UI.expand(v))
	var sw = Control.new()
	sw.custom_minimum_size = Vector2(UI.px(46), UI.px(26))
	sw.draw.connect(func():
		var r = Rect2(Vector2.ZERO, sw.size)
		var sb = StyleBoxFlat.new(); sb.bg_color = UI.ACCENT if on else UI.BORDER; sb.set_corner_radius_all(int(sw.size.y * 0.5))
		sw.draw_style_box(sb, r)
		var x = sw.size.x - sw.size.y * 0.5 if on else sw.size.y * 0.5
		sw.draw_circle(Vector2(x, sw.size.y * 0.5), sw.size.y * 0.4, Color("#f4e9cf")))
	row.add_child(UI.center(sw))
	fr.add_child(row)
	UI.tap(fr, func(): Game.toggle_setting(key))
	return fr
