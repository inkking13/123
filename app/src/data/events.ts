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
}
export interface OfficeEventDef {
  id: string;
  build: (e: GameEngine) => BuiltEvent | null;
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
