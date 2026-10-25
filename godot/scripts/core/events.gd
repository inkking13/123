class_name Events
## The camp's HR scenarios (from the Expo game's data/events.ts): a situation,
## two choices, each with its consequence. Staff events carry consequences
## into later trips — a raise on the payroll, a feud, a go-slow strike.

const OFFICE := ["loot-conflict", "budget-hole", "anonymous-complaint", "team-building", "day-off", "mentorship", "equipment-contract", "quarterly-bonus"]
const STAFF := ["strike", "raise", "quarrel", "poaching"]

const RAISE_ASKS := {
	0: "Каелен кладёт на стол смету: масло для лампад, свечи для алтаря, полировка доспеха. «Свет, командир, тоже стоит денег».",
	4: "Векс втыкает кинжал в стол рядом с ведомостью. «Я делаю половину работы. Хочу хотя бы треть оплаты».",
	7: "Элара держит над ведомостью ладонь с крошечным огоньком. «Я просто грею руки, командир. Пока».",
	9: "Освальд молча кладёт на стол помятый наплечник. «Третий за поход. Латы, командир, сами не растут».",
	10: "Ирма показывает пустую сумку для бинтов. «Храм присылал мне мази бесплатно. Гильдия пока не присылает ничего».",
	11: "Джаспер высыпает на стол обломки стрел. «Хорошее древко не растёт на каждом дереве, командир. Только на некоторых. В лесу барона».",
	12: "Гаррет кладёт на стол смету на свечи, чернила и редкие тома. «Наука, командир, не терпит экономии».",
	13: "Мордрек напоминает, что мёртвые работают бесплатно, а он — нет. И что могилы, вообще-то, копает не сам.",
}
const QUARRELS := [
	"%s и %s выясняют, кто в последнем бою оставил спину открытой. Каждый уверен, что это был другой, и оба уже перешли на личности.",
	"%s и %s не поделили место у костра. Теперь спорят уже о том, кто кого спас в прошлом походе.",
	"У костра нашёлся походный дневник с подписью «%s». Читать его вслух взялся не кто иной, как %s. Нелестного там хватило на всех, но больше всего — про чтеца.",
]


static func _opt(label: String, apply: Callable) -> Dictionary:
	return {"label": label, "apply": apply}


static func _free_gear(g) -> Array:
	var rows = []
	for kind in DB.GEAR_KINDS:
		for o in DB.gear.GEAR[kind]:
			if o.id == "none": continue
			var free: int = g.item_owned(o.id) - g.worn_count(o.id)
			if g.item_owned(o.id) > 0 and free > 0: rows.append({"id": o.id, "name": o.name})
	return rows


static func build(g, id: String):
	match id:
		"loot-conflict":
			var sq: Array = g.squad()
			if sq.size() < 2: return null
			sq.shuffle()
			var a: Dictionary = sq[0]; var b: Dictionary = sq[1]
			return {"title": "Конфликт из-за трофея",
				"desc": "%s и %s сцепились из-за того, кому должен был достаться последний трофей. Дело дошло до тебя." % [a.name, b.name],
				"options": [
					_opt("Оштрафовать обоих", func():
						g.adjust_morale(a.id, -10); g.adjust_morale(b.id, -10); g.gold += 15
						return "%s и %s лишились части премии и заметно расстроены, зато в бюджет добавилось 15 золота." % [a.name, b.name]),
					_opt("Уладить за счёт гильдии (-20 золота)", func():
						g.gold = maxi(0, g.gold - 20); g.adjust_morale(a.id, 8); g.adjust_morale(b.id, 8)
						return "Гильдия выплатила компенсацию из бюджета. %s и %s остались довольны." % [a.name, b.name]),
				]}
		"budget-hole":
			if g.pool.is_empty(): return null
			var suspect: Dictionary = g.pool.pick_random()
			return {"title": "Дыра в бюджете",
				"desc": "Казначей гильдии обнаружил недостачу в отчётах — то ли ошибка, то ли кто-то нечист на руку.",
				"options": [
					_opt("Списать как есть", func():
						var loss: int = mini(g.gold, 10 + randi() % 15)
						g.gold -= loss
						return "Списали %d золота без разбирательств. Инцидент закрыт." % loss),
					_opt("Провести расследование", func():
						g.adjust_morale(suspect.id, -12)
						return "Расследование ткнуло пальцем в одного из своих — доказать ничего не удалось, но осадок остался. %s заметно расстроен(а)." % suspect.name),
				]}
		"anonymous-complaint":
			if g.pool.is_empty(): return null
			var t: Dictionary = g.pool.pick_random()
			return {"title": "Анонимная жалоба", "desc": "В ящик для жалоб подкинули анонимку. Фигурант: %s." % t.name,
				"options": [
					_opt("Провести беседу", func():
						g.adjust_morale(t.id, -5)
						return "%s: разговор прошёл неловко, настроение слегка испортилось — зато жалоб больше не будет, хотя бы какое-то время." % t.name),
					_opt("Проигнорировать", func():
						for c in g.pool: g.adjust_morale(c.id, -3)
						return "Слухи расползлись по гильдии — общий настрой немного просел."),
				]}
		"team-building":
			if g.pool.is_empty(): return null
			return {"title": "Идея тимбилдинга", "desc": "Кто-то предложил корпоратив для всей гильдии за счёт бюджета.",
				"options": [
					_opt("Одобрить (-25 золота)", func():
						g.gold = maxi(0, g.gold - 25)
						for c in g.pool: g.adjust_morale(c.id, 10)
						return "Гильдия неплохо провела время. Мораль всех выросла."),
					_opt("Отклонить", func():
						for c in g.pool: g.adjust_morale(c.id, -4)
						return "Идею зарубили. Коллектив немного расстроен."),
				]}
		"day-off":
			if g.pool.is_empty(): return null
			var t: Dictionary = g.pool.pick_random()
			return {"title": "Просьба об отгуле", "desc": "%s просит день отдыха после тяжёлой недели." % t.name,
				"options": [
					_opt("Дать отгул", func():
						g.adjust_morale(t.id, 15)
						return "%s вернулся(лась) отдохнувшим(ей) и в хорошем настроении." % t.name),
					_opt("Отказать — работы много", func():
						g.adjust_morale(t.id, -10)
						return "%s расстроен(а), но остался(ась) в строю." % t.name),
				]}
		"mentorship":
			if g.pool.size() < 2: return null
			var sorted: Array = g.pool.duplicate()
			sorted.sort_custom(func(x, y): return x.level < y.level)
			var student: Dictionary = sorted[0]; var mentor: Dictionary = sorted.back()
			if student.id == mentor.id or student.level >= mentor.level: return null
			return {"title": "Наставничество",
				"desc": "Один из ветеранов предлагает взять шефство над отстающим бойцом. Наставник: %s. Ученик: %s." % [mentor.name, student.name],
				"options": [
					_opt("Разрешить", func():
						g.gain_xp(student.id, 40); g.adjust_morale(mentor.id, 5)
						return "Ученик %s получил(а) солидный опыт. Наставник %s доволен(льна) своей работой." % [student.name, mentor.name]),
					_opt("Не отвлекать от дела", func():
						g.gold += 10
						return "Наставничество отменили — освободившееся время оценили в 10 золота для бюджета."),
				]}
		"equipment-contract":
			var rows = _free_gear(g)
			if rows.is_empty(): return null
			var row: Dictionary = rows.pick_random()
			return {"title": "Истёк контракт поставщика",
				"desc": "Поставщик снаряжения «%s» требует продлить контракт, иначе заберёт один экземпляр со склада." % row.name,
				"options": [
					_opt("Продлить (-15 золота)", func():
						g.gold = maxi(0, g.gold - 15)
						return "Контракт продлён, склад цел."),
					_opt("Расторгнуть", func():
						g.inventory[row.id] = maxi(0, g.item_owned(row.id) - 1)
						g.gold += 8
						return "Один «%s» ушёл обратно поставщику, но вернули 8 золота компенсации." % row.name),
				]}
		"quarterly-bonus":
			if g.pool.is_empty(): return null
			return {"title": "Квартальная премия", "desc": "Гильдия неожиданно вышла в плюс по итогам квартала — есть, что распределить.",
				"options": [
					_opt("Раздать всем поровну", func():
						for c in g.pool: g.adjust_morale(c.id, 12)
						return "Каждый получил свою долю. Мораль всей гильдии выросла."),
					_opt("Оставить в бюджете", func():
						g.gold += 40
						return "Премию решили придержать — в бюджете стало на 40 золота больше."),
				]}
		"strike":
			var sq: Array = g.squad()
			if g.strike_trips > 0 or sq.size() < 3: return null
			var sum = 0
			for c in sq: sum += c.morale
			var avg = float(sum) / sq.size()
			if avg >= 45: return null
			var bonus = 12 * sq.size()
			return {"title": "Забастовка",
				"desc": "Отряд собрался у палатки командира с плакатом «Рейд — не повод для переработки». Работать будут, но строго по инструкции, пока их не услышат.",
				"stakes": "Мораль отряда в среднем %d%%. Без уступок — два похода с −15%% урона." % int(round(avg)),
				"faces": sq.map(func(c): return c.id),
				"options": [
					_opt("Выплатить премию (−%d золота)" % bonus, func():
						var paid: int = mini(g.gold, bonus)
						g.gold -= paid
						for c in g.squad(): g.adjust_morale(c.id, 18)
						return "Премию раздали прямо у костра%s. Плакат пустили на растопку, отряд снова в строю." % (", сколько нашлось в казне" if paid < bonus else "")),
					_opt("Не уступать", func():
						g.strike_trips = 2
						for c in g.squad(): g.adjust_morale(c.id, -4)
						return "Отряд вышел на смену, но в бою делает ровно то, что написано в должностной инструкции. Ближайшие два похода урон ниже на 15%."),
				]}
		"raise":
			var asking: Array = g.squad().filter(func(c): return c.level >= 3 and not g.raises.has(c.id))
			if asking.is_empty(): return null
			var c: Dictionary = asking.pick_random()
			var amount = 4 + int(round(c.level * 1.5))
			return {"title": "Требование прибавки",
				"desc": RAISE_ASKS.get(c.id, "%s считает, что за уровень %d платят больше. Особенно в соседней гильдии." % [c.name, c.level]),
				"stakes": "Прибавка: +%d золота к каждой выплате. Отказ: мораль −20." % amount, "faces": [c.id],
				"options": [
					_opt("Поднять оклад (+%d за поход)" % amount, func():
						g.raises[c.id] = amount
						g.adjust_morale(c.id, 20)
						return "%s расписывается в новой ведомости и впервые за неделю улыбается. Расходы на зарплату выросли на %d золота за поход." % [c.name, amount]),
					_opt("Отказать", func():
						g.adjust_morale(c.id, -20)
						var h = g.find_hero(c.id)
						var m: int = h.morale if h else 0
						return "%s молча уходит. %s" % [c.name, "По гильдии ходят слухи, что резюме уже разослано." if m < 30 else "Обиду явно запомнили."]),
				]}
		"quarrel":
			if g.feud: return null
			var sq: Array = g.squad()
			if sq.size() < 2: return null
			sq.shuffle()
			var a: Dictionary = sq[0]; var b: Dictionary = sq[1]
			return {"title": "Ссора в отряде", "desc": QUARRELS.pick_random() % [a.name, b.name],
				"stakes": "Если не мирить: три похода они не прикрывают друг друга (−10% урона обоим, пока стоят в одном отряде).",
				"faces": [a.id, b.id],
				"options": [
					_opt("Провести медиацию (−25 золота)", func():
						g.gold = maxi(0, g.gold - 25)
						g.adjust_morale(a.id, 5); g.adjust_morale(b.id, 5)
						return "Приглашённый медиатор два часа говорил о «я-высказываниях». %s и %s помирились, лишь бы он ушёл." % [a.name, b.name]),
					_opt("Пусть разбираются сами", func():
						g.feud = {"a": a.id, "b": b.id, "trips": 3}
						return "%s и %s демонстративно не разговаривают. В бою каждый будет прикрывать кого угодно, только не другого. Можно просто не брать их в поход вместе." % [a.name, b.name]),
				]}
		"poaching":
			var stars: Array = g.squad().filter(func(c): return c.level >= 4)
			if stars.is_empty() or g.pool.size() <= 5: return null
			var c: Dictionary = stars.pick_random()
			var counter: int = 30 + c.level * 6
			return {"title": "Переманивают",
				"desc": "Гильдия «Золотой Грифон» прислала %s письмо с гербом и цифрой, которую %s показывает тебе как бы невзначай." % [c.name, c.name],
				"stakes": "Контроффер: −%d золота. Иначе %s может уйти, если мораль ниже 50%%." % [counter, c.name], "faces": [c.id],
				"options": [
					_opt("Сделать контроффер (−%d золота)" % counter, func():
						if g.gold < counter:
							g.adjust_morale(c.id, -10)
							return "В казне не нашлось %d золота. %s остаётся, но письмо с гербом теперь лежит на видном месте." % [counter, c.name]
						g.gold -= counter
						g.adjust_morale(c.id, 25)
						return "%s рвёт письмо «Грифона» и остаётся. Мораль заметно выросла." % c.name),
					_opt("Пусть решает", func():
						var h = g.find_hero(c.id)
						var m: int = h.morale if h else 0
						if m < 50 and g.can_fire():
							g.fire(c.id, "resigned")
							return "%s уходит в «Золотой Грифон». Остальные провожают взглядом и пересчитывают свои оклады." % c.name
						g.adjust_morale(c.id, 5)
						return "%s решает остаться: «Там скучно, а здесь хотя бы босс в огне». Лояльность немного выросла." % c.name),
				]}
	return null
