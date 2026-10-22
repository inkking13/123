extends Screen
## Milestones of the guild, each paying a little gold.


func build() -> void:
	var rows: Array = Game.achievement_rows()
	var p = make_page(0)
	p.add_child(UI.back_link())
	p.add_child(UI.space(14))
	p.add_child(UI.kicker("Отдел кадров"))
	p.add_child(UI.screen_title("Достижения"))
	p.add_child(UI.space(4))
	p.add_child(UI.label("Получено %d/%d" % [rows.filter(func(r): return r.claimed).size(), rows.size()], 14, UI.TEXT_DIM))
	p.add_child(UI.space(18))
	var list = UI.cards(10)
	p.add_child(list)
	for r in rows:
		var a: Dictionary = r.a
		var fr = UI.frame("gold" if r.achieved and not r.claimed else "plain", Vector4(14, 14, 14, 14))
		if r.claimed: fr.modulate.a = 0.55
		var v = UI.vbox(4)
		var head = UI.hbox(10)
		head.add_child(UI.icon("check" if r.claimed else "trophy", 16, UI.TEXT_FAINT if r.claimed else UI.WARN, "fill" if r.claimed else "regular"))
		head.add_child(UI.expand(UI.label(a.name, 15.5, UI.TEXT_FAINT if r.claimed else UI.TEXT, "medium", true)))
		v.add_child(head)
		v.add_child(UI.label(a.desc, 13.5, UI.TEXT_DIM, "regular", true))
		v.add_child(UI.label("Награда получена" if r.claimed else "+%d золота" % a.rewardGold, 13, UI.TEXT_FAINT if r.claimed else UI.WARN))
		if r.achieved and not r.claimed:
			v.add_child(UI.space(6))
			var id: String = a.id
			v.add_child(UI.secondary_button("Забрать награду", func(): Game.claim_achievement(id), 40))
		fr.add_child(v)
		list.add_child(fr)
