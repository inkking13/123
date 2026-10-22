extends Screen
## Gear for the squad: pick a hero along the top, dress them from the guild's stash.

var pick_id = null
var gear_state = {}


func build() -> void:
	var chosen: Array = Game.squad()
	var cur = null
	for c in chosen:
		if c.id == pick_id: cur = c
	if cur == null and not chosen.is_empty(): cur = chosen[0]
	var p = make_page(0, 24, 16)
	var head = UI.hbox(8)
	head.add_child(UI.back_link())
	head.add_child(UI.flex())
	head.add_child(UI.ghost_link("Инвентарь", func(): Game.go("inventory"), "scroll"))
	p.add_child(head)
	p.add_child(UI.space(10))
	p.add_child(UI.screen_title("Снаряжение"))
	p.add_child(UI.space(4))
	p.add_child(UI.label("Каждый слот меняет баланс между уроном, живучестью и перезарядкой. Предметы берутся из общего инвентаря гильдии — они не бесконечны.", 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(16))
	var tabs = UI.hbox(8)
	for c in chosen:
		var on: bool = cur != null and c.id == cur.id
		var col = UI.vbox(4)
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var pic = UI.portrait(c.id, 46, 6)
		if not on: pic.modulate.a = 0.6
		col.add_child(UI.center(pic))
		var n = UI.label(c.name, 11.5, UI.TEXT if on else UI.TEXT_FAINT)
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		n.clip_text = true
		col.add_child(n)
		var r = UI.label(DB.ROLE_NAME[c.role].to_upper(), 10, DB.ROLE_COLOR[c.role])
		r.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(r)
		var cid: int = c.id
		UI.tap(col, func():
			pick_id = cid
			gear_state = {}
			refresh())
		tabs.add_child(col)
	p.add_child(tabs)
	p.add_child(UI.space(14))
	if cur: p.add_child(EquipmentPanel.make(cur, gear_state, refresh))
	p.add_child(UI.space(90))
	var dock = PanelContainer.new()
	var sb = StyleBoxFlat.new(); sb.bg_color = Color(0.063, 0.047, 0.035, 0.97)
	sb.content_margin_left = UI.px(16); sb.content_margin_right = UI.px(16); sb.content_margin_top = UI.px(8); sb.content_margin_bottom = UI.px(14)
	dock.add_theme_stylebox_override("panel", sb)
	dock.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	dock.grow_vertical = Control.GROW_DIRECTION_BEGIN
	dock.offset_bottom = -UI.px(Tabs.HEIGHT) - App.inset_bottom()
	dock.add_child(UI.primary_button("В подземелье", Game.go_dungeon, "door-open"))
	add_child(dock)
