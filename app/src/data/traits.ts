import { TraitId } from './types';

export const TRAITS: Record<TraitId, { label: string; desc: string }> = {
  steady: { label: 'Стабильный', desc: 'Без сюрпризов — делает свою работу.' },
  novice: { label: 'Новичок', desc: 'Слабый старт, но разгоняется по ходу боя.' },
  egoist: { label: 'Эгоист', desc: 'Выкладывается процентов на 85 — думает в основном о себе.' },
  clicker: { label: 'Кликер', desc: 'Иногда жмёт не в ту кнопку — способность может прогореть впустую.' },
  legend: { label: 'Легенда', desc: '+20% к эффективности, но ждёт свою долю лута.' },
  ninjaLooter: { label: 'Хапуга', desc: 'Болезненно реагирует, если лут достаётся не ему.' },
};
