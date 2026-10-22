extends Screen
## The guild's KPI and the day's tasks, as contracts pinned to the board.


func build() -> void:
	var quests: Array = Game.quest_rows()
	var dailies: Array = Game.daily_rows()
	var p = make_page(0)
	p.add_child(UI.kicker("Отдел кадров"))
	p.add_child(UI.screen_title("KPI гильдии"))
	p.add_child(UI.space(4))
	p.add_child(UI.label("Выполнено %d/%d · каждый закрытый показатель поднимает мораль всей гильдии." % [quests.filter(func(q): return q.claimed).size(), quests.size()], 14, UI.TEXT_DIM, "regular", true))
	p.add_child(UI.space(18))
	p.add_child(UI.kicker("Ежедневные задачи · %d/%d" % [dailies.filter(func(q): return q.claimed).size(), dailies.size()], UI.ACCENT, 12))
	p.add_child(UI.space(10))
	var list = UI.cards(12)
	p.add_child(list)
	for d in dailies:
		var t: Dictionary = d.t
		list.add_child(_contract(t.name, t.desc, "Награда получена" if d.claimed else "%d/%d · +%d золота" % [d.progress, t.target, t.rewardGold], "coins", d.claimed, d.achieved, func(): Game.claim_daily(t.id)))
	p.add_child(UI.space(8))
	p.add_child(UI.kicker("Постоянные KPI", UI.ACCENT, 12))
	p.add_child(UI.space(10))
	var list1 = UI.cards(12)
	p.add_child(list1)
	for r in quests:
		var q: Dictionary = r.q
		list1.add_child(_contract(q.name, q.desc, "Награда получена" if r.claimed else q.rewardDesc, "scroll", r.claimed, r.achieved, func(): Game.claim_quest(q.id)))


## One task as a contract pinned to the board: a parchment note in ink, sealed in wax once it's met.
func _contract(name: String, desc: String, reward: String, icon: String, claimed: bool, achieved: bool, claim: Callable) -> Control:
	var sheet = UI.parchment()
	if claimed: sheet.modulate.a = 0.5
	var v = UI.vbox(2)
	var row = UI.hbox(10)
	row.add_child(UI.icon("check" if claimed else icon, 16, UI.INK_FAINT if claimed else UI.INK_MUTED, "fill" if claimed else "regular"))
	var tv = UI.vbox(2)
	tv.add_child(UI.label(name, 17, UI.INK, "title", true))
	tv.add_child(UI.label(desc, 14, UI.INK_MUTED, "regular", true))
	tv.add_child(UI.label(reward, 13, UI.INK_FAINT if claimed else UI.INK_RED, "italic", true))
	row.add_child(UI.expand(tv))
	v.add_child(row)
	if achieved and not claimed:
		var act = UI.hbox(10, BoxContainer.ALIGNMENT_END)
		act.add_child(UI.label("Забрать награду", 15, UI.INK_RED, "title"))
		act.add_child(UI.wax_seal(36, "coins"))
		UI.tap(act, claim)
		v.add_child(act)
	sheet.add_child(v)
	return sheet
