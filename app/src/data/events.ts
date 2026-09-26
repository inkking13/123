import type { GameEngine } from '../engine/GameEngine';
import { GEAR, SLOT_ORDER } from './gear';
import { GearSlotKey } from './types';

export interface EventOption {
  label: string;
  apply: (e: GameEngine) => string;
}
export interface BuiltEvent {
  title: string;
  desc: string;
  options: [EventOption, EventOption];
  /** Heroes the event is about, shown as portraits on the event screen. */
  faces?: number[];
  /** What the choices will cost or bring, spelled out under the text. */
  stakes?: string;
}
export interface OfficeEventDef {
  id: string;
  build: (e: GameEngine) => BuiltEvent | null;
  /** Staff events: checked before the generic office ones, once the personnel desk is open. */
  urgent?: boolean;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function freeGearEntries(e: GameEngine) {
  const rows: { slot: GearSlotKey; id: string; name: string; free: number }[] = [];
  for (const slot of SLOT_ORDER) {
    for (const o of GEAR[slot]) {
      if (o.id === 'none') continue;
      const owned = e.itemOwned(o.id);
      if (owned <= 0) continue;
      const wornBy = e.pool.filter((c) => c.equipment[slot] === o.id).length;
      const free = owned - wornBy;
      if (free > 0) rows.push({ slot, id: o.id, name: o.name, free });
    }
  }
  return rows;
}

export const OFFICE_EVENTS: OfficeEventDef[] = [
  {
    id: 'loot-conflict',
    build: (e) => {
      const squad = e.squad();
      if (squad.length < 2) return null;
      const shuffled = [...squad].sort(() => Math.random() - 0.5);
      const [a, b] = shuffled;
      return {
        title: 'Конфликт из-за трофея',
        desc: `${a.name} и ${b.name} сцепились из-за того, кому должен был достаться последний трофей. Дело дошло до тебя.`,
        options: [
          {
            label: 'Оштрафовать обоих',
            apply: (eng) => {
              eng.adjustMorale(a.id, -10); eng.adjustMorale(b.id, -10); eng.gold += 15;
              return `${a.name} и ${b.name} лишились части премии и заметно расстроены, зато в бюджет добавилось 15 золота.`;
            },
          },
          {
            label: 'Уладить за счёт гильдии (-20 золота)',
            apply: (eng) => {
              eng.gold = Math.max(0, eng.gold - 20); eng.adjustMorale(a.id, 8); eng.adjustMorale(b.id, 8);
              return `Гильдия выплатила компенсацию из бюджета. ${a.name} и ${b.name} остались довольны.`;
            },
          },
        ],
      };
    },
  },
  {
    id: 'budget-hole',
    build: (e) => {
      if (!e.pool.length) return null;
      const suspect = pick(e.pool);
      return {
        title: 'Дыра в бюджете',
        desc: 'Казначей гильдии обнаружил недостачу в отчётах — то ли ошибка, то ли кто-то нечист на руку.',
        options: [
          {
            label: 'Списать как есть',
            apply: (eng) => {
              const loss = Math.min(eng.gold, 10 + Math.floor(Math.random() * 15));
              eng.gold -= loss;
              return `Списали ${loss} золота без разбирательств. Инцидент закрыт.`;
            },
          },
          {
            label: 'Провести расследование',
            apply: (eng) => {
              eng.adjustMorale(suspect.id, -12);
              return `Расследование ткнуло пальцем в одного из своих — доказать ничего не удалось, но осадок остался. ${suspect.name} заметно расстроен(а).`;
            },
          },
        ],
      };
    },
  },
  {
    id: 'anonymous-complaint',
    build: (e) => {
      if (!e.pool.length) return null;
      const target = pick(e.pool);
      return {
        title: 'Анонимная жалоба',
        desc: `В ящик для жалоб подкинули анонимку. Фигурант: ${target.name}.`,
        options: [
          {
            label: 'Провести беседу',
            apply: (eng) => {
              eng.adjustMorale(target.id, -5);
              return `${target.name}: разговор прошёл неловко, настроение слегка испортилось — зато жалоб больше не будет, хотя бы какое-то время.`;
            },
          },
          {
            label: 'Проигнорировать',
            apply: (eng) => {
              for (const c of eng.pool) eng.adjustMorale(c.id, -3);
              return 'Слухи расползлись по гильдии — общий настрой немного просел.';
            },
          },
        ],
      };
    },
  },
  {
    id: 'team-building',
    build: (e) => {
      if (!e.pool.length) return null;
      return {
        title: 'Идея тимбилдинга',
        desc: 'Кто-то предложил корпоратив для всей гильдии за счёт бюджета.',
        options: [
          {
            label: 'Одобрить (-25 золота)',
            apply: (eng) => {
              eng.gold = Math.max(0, eng.gold - 25);
              for (const c of eng.pool) eng.adjustMorale(c.id, 10);
              return 'Гильдия неплохо провела время. Мораль всех выросла.';
            },
          },
          {
            label: 'Отклонить',
            apply: (eng) => {
              for (const c of eng.pool) eng.adjustMorale(c.id, -4);
              return 'Идею зарубили. Коллектив немного расстроен.';
            },
          },
        ],
      };
    },
  },
  {
    id: 'day-off',
    build: (e) => {
      if (!e.pool.length) return null;
      const target = pick(e.pool);
      return {
        title: 'Просьба об отгуле',
        desc: `${target.name} просит день отдыха после тяжёлой недели.`,
        options: [
          {
            label: 'Дать отгул',
            apply: (eng) => {
              eng.adjustMorale(target.id, 15);
              return `${target.name} вернулся(лась) отдохнувшим(ей) и в хорошем настроении.`;
            },
          },
          {
            label: 'Отказать — работы много',
            apply: (eng) => {
              eng.adjustMorale(target.id, -10);
              return `${target.name} расстроен(а), но остался(ась) в строю.`;
            },
          },
        ],
      };
    },
  },
  {
    id: 'mentorship',
    build: (e) => {
      if (e.pool.length < 2) return null;
      const sorted = [...e.pool].sort((a, b) => a.level - b.level);
      const student = sorted[0];
      const mentor = sorted[sorted.length - 1];
      if (student.id === mentor.id || student.level >= mentor.level) return null;
      return {
        title: 'Наставничество',
        desc: `Один из ветеранов предлагает взять шефство над отстающим бойцом. Наставник: ${mentor.name}. Ученик: ${student.name}.`,
        options: [
          {
            label: 'Разрешить',
            apply: (eng) => {
              eng.gainXp(student.id, 40); eng.adjustMorale(mentor.id, 5);
              return `Ученик ${student.name} получил(а) солидный опыт. Наставник ${mentor.name} доволен(льна) своей работой.`;
            },
          },
          {
            label: 'Не отвлекать от дела',
            apply: (eng) => {
              eng.gold += 10;
              return 'Наставничество отменили — освободившееся время оценили в 10 золота для бюджета.';
            },
          },
        ],
      };
    },
  },
  {
    id: 'equipment-contract',
    build: (e) => {
      const rows = freeGearEntries(e);
      if (!rows.length) return null;
      const row = pick(rows);
      return {
        title: 'Истёк контракт поставщика',
        desc: `Поставщик снаряжения «${row.name}» требует продлить контракт, иначе заберёт один экземпляр со склада.`,
        options: [
          {
            label: 'Продлить (-15 золота)',
            apply: (eng) => {
              eng.gold = Math.max(0, eng.gold - 15);
              return 'Контракт продлён, склад цел.';
            },
          },
          {
            label: 'Расторгнуть',
            apply: (eng) => {
              eng.inventoryCounts[row.id] = Math.max(0, (eng.inventoryCounts[row.id] || 0) - 1);
              eng.gold += 8;
              return `Один «${row.name}» ушёл обратно поставщику, но вернули 8 золота компенсации.`;
            },
          },
        ],
      };
    },
  },
  {
    id: 'quarterly-bonus',
    build: (e) => {
      if (!e.pool.length) return null;
      return {
        title: 'Квартальная премия',
        desc: 'Гильдия неожиданно вышла в плюс по итогам квартала — есть, что распределить.',
        options: [
          {
            label: 'Раздать всем поровну',
            apply: (eng) => {
              for (const c of eng.pool) eng.adjustMorale(c.id, 12);
              return 'Каждый получил свою долю. Мораль всей гильдии выросла.';
            },
          },
          {
            label: 'Оставить в бюджете',
            apply: (eng) => {
              eng.gold += 40;
              return 'Премию решили придержать — в бюджете стало на 40 золота больше.';
            },
          },
        ],
      };
    },
  },
];

// ── Staff events ───────────────────────────────────────────
// Heavier HR scenarios with consequences that follow the squad into the next
// trips: a permanent raise on the payroll, a feud that costs damage while the
// pair fights side by side, a go-slow strike across the whole squad.

const RAISE_ASKS: Record<number, string> = {
  0: 'Каелен кладёт на стол смету: святая вода, серебро, свечи для допросов. «Инквизиция стоит денег, командир».',
  2: 'Фаэлар говорит, что мёртвые хотя бы не задерживают жалование. Живые в его списке пока позади.',
  4: 'Векс втыкает кинжал в стол рядом с ведомостью. «Я делаю половину работы. Хочу хотя бы треть оплаты».',
  5: 'Громмаш сообщает, что орки берут за жестокость отдельно. И что он давно делает скидку.',
  6: 'Сильвана показывает, сколько стрел ушло за поход. Стрелы, по её словам, из проклятого тиса и сами не растут.',
  7: 'Элара вежливо напоминает, что лечит и сжигает одновременно — а платят ей за одно.',
  12: 'Гаррет, выбивающий долги для гильдии, выставил гильдии счёт. С процентами.',
  13: 'Мортана узнала, что стажировка должна когда-то заканчиваться. Желательно окладом.',
};
const QUARRELS = [
  (a: string, b: string) => `${a} и ${b} выясняют, кто в последнем бою оставил спину открытой. Каждый уверен, что это был другой, и оба уже перешли на личности.`,
  (a: string, b: string) => `${a} и ${b} не поделили место у костра. Теперь спорят уже о том, кто кого спас в прошлом походе.`,
  (a: string, b: string) => `У костра нашёлся походный дневник с подписью «${a}». Читать его вслух взялся не кто иной, как ${b}. Нелестного там хватило на всех, но больше всего — про чтеца.`,
];

function squadPair(e: GameEngine) {
  const squad = e.squad();
  if (squad.length < 2) return null;
  const [a, b] = [...squad].sort(() => Math.random() - 0.5);
  return { a, b };
}

export const STAFF_EVENTS: OfficeEventDef[] = [
  {
    id: 'strike',
    urgent: true,
    build: (e) => {
      if (e.strikeTrips > 0 || e.squad().length < 3) return null;
      const squad = e.squad();
      const avg = squad.reduce((s, c) => s + c.morale, 0) / squad.length;
      if (avg >= 45) return null;
      const bonus = 12 * squad.length;
      return {
        title: 'Забастовка',
        desc: 'Отряд собрался у палатки командира с плакатом «Рейд — не повод для переработки». Работать будут, но строго по инструкции, пока их не услышат.',
        stakes: `Мораль отряда в среднем ${Math.round(avg)}%. Без уступок — два похода с −15% урона.`,
        faces: squad.map((c) => c.id),
        options: [
          {
            label: `Выплатить премию (−${bonus} золота)`,
            apply: (eng) => {
              const paid = Math.min(eng.gold, bonus);
              eng.gold -= paid;
              for (const c of eng.squad()) eng.adjustMorale(c.id, 18);
              return `Премию раздали прямо у костра${paid < bonus ? ', сколько нашлось в казне' : ''}. Плакат пустили на растопку, отряд снова в строю.`;
            },
          },
          {
            label: 'Не уступать',
            apply: (eng) => {
              eng.strikeTrips = 2;
              for (const c of eng.squad()) eng.adjustMorale(c.id, -4);
              return 'Отряд вышел на смену, но в бою делает ровно то, что написано в должностной инструкции. Ближайшие два похода урон ниже на 15%.';
            },
          },
        ],
      };
    },
  },
  {
    id: 'raise',
    urgent: true,
    build: (e) => {
      const asking = e.squad().filter((c) => c.level >= 3 && !e.raises[c.id]);
      if (!asking.length) return null;
      const c = pick(asking);
      const amount = 4 + Math.round(c.level * 1.5);
      return {
        title: 'Требование прибавки',
        desc: RAISE_ASKS[c.id] ?? `${c.name} считает, что за уровень ${c.level} платят больше. Особенно в соседней гильдии.`,
        stakes: `Прибавка: +${amount} золота к каждой выплате. Отказ: мораль −20.`,
        faces: [c.id],
        options: [
          {
            label: `Поднять оклад (+${amount} за поход)`,
            apply: (eng) => {
              eng.raises[c.id] = amount;
              eng.adjustMorale(c.id, 20);
              return `${c.name} расписывается в новой ведомости и впервые за неделю улыбается. Расходы на зарплату выросли на ${amount} золота за поход.`;
            },
          },
          {
            label: 'Отказать',
            apply: (eng) => {
              eng.adjustMorale(c.id, -20);
              const m = eng.pool.find((x) => x.id === c.id)?.morale ?? 0;
              return `${c.name} молча уходит. ${m < 30 ? 'По гильдии ходят слухи, что резюме уже разослано.' : 'Обиду явно запомнили.'}`;
            },
          },
        ],
      };
    },
  },
  {
    id: 'quarrel',
    urgent: true,
    build: (e) => {
      if (e.feud) return null;
      const pair = squadPair(e);
      if (!pair) return null;
      const { a, b } = pair;
      const cost = 25;
      return {
        title: 'Ссора в отряде',
        desc: pick(QUARRELS)(a.name, b.name),
        stakes: `Если не мирить: три похода они не прикрывают друг друга (−10% урона обоим, пока стоят в одном отряде).`,
        faces: [a.id, b.id],
        options: [
          {
            label: `Провести медиацию (−${cost} золота)`,
            apply: (eng) => {
              eng.gold = Math.max(0, eng.gold - cost);
              eng.adjustMorale(a.id, 5); eng.adjustMorale(b.id, 5);
              return `Приглашённый медиатор два часа говорил о «я-высказываниях». ${a.name} и ${b.name} помирились, лишь бы он ушёл.`;
            },
          },
          {
            label: 'Пусть разбираются сами',
            apply: (eng) => {
              eng.feud = { a: a.id, b: b.id, trips: 3 };
              return `${a.name} и ${b.name} демонстративно не разговаривают. В бою каждый будет прикрывать кого угодно, только не другого. Можно просто не брать их в поход вместе.`;
            },
          },
        ],
      };
    },
  },
  {
    id: 'poaching',
    urgent: true,
    build: (e) => {
      const stars = e.squad().filter((c) => c.level >= 4);
      if (!stars.length || e.pool.length <= 5) return null;
      const c = pick(stars);
      const counter = 30 + c.level * 6;
      return {
        title: 'Переманивают',
        desc: `Гильдия «Золотой Грифон» прислала ${c.name} письмо с гербом и цифрой, которую ${c.name} показывает тебе как бы невзначай.`,
        stakes: `Контроффер: −${counter} золота. Иначе ${c.name} может уйти, если мораль ниже 50%.`,
        faces: [c.id],
        options: [
          {
            label: `Сделать контроффер (−${counter} золота)`,
            apply: (eng) => {
              if (eng.gold < counter) {
                eng.adjustMorale(c.id, -10);
                return `В казне не нашлось ${counter} золота. ${c.name} остаётся, но письмо с гербом теперь лежит на видном месте.`;
              }
              eng.gold -= counter;
              eng.adjustMorale(c.id, 25);
              return `${c.name} рвёт письмо «Грифона» и остаётся. Мораль заметно выросла.`;
            },
          },
          {
            label: 'Пусть решает',
            apply: (eng) => {
              const m = eng.pool.find((x) => x.id === c.id)?.morale ?? 0;
              if (m < 50 && eng.canFire()) {
                eng.fireCandidate(c.id, 'resigned');
                return `${c.name} уходит в «Золотой Грифон». Остальные провожают взглядом и пересчитывают свои оклады.`;
              }
              eng.adjustMorale(c.id, 5);
              return `${c.name} решает остаться: «Там скучно, а здесь хотя бы босс в огне». Лояльность немного выросла.`;
            },
          },
        ],
      };
    },
  },
];
