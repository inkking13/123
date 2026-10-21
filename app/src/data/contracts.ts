import { IconName } from '../components/Icon';

// Contracts, as in Wartales: work the guild takes on from someone who pays for
// it. Each names a dungeon and terms the squad must keep there; the pay comes
// on top of the usual loot when the boss falls with the terms kept. One is on
// the books at a time, picked from a short board that refills as they close.

export type ContractTerm = 'clear' | 'noLoss' | 'swift' | 'valor';

export interface ContractTermDef {
  title: string;
  /** The condition, as the client puts it. */
  desc: string;
  icon: IconName;
  /** Pay multiplier for the harder terms. */
  payMult: number;
}

/** Every fight of the trip over in this many rounds or fewer. */
export const SWIFT_ROUNDS = 7;
/** Valor spent over the whole trip. */
export const VALOR_NEEDED = 6;

export const CONTRACT_TERMS: Record<ContractTerm, ContractTermDef> = {
  clear: { title: 'Зачистка', desc: 'Пройти поход и одолеть хозяина логова.', icon: 'skull', payMult: 1 },
  noLoss: { title: 'Без потерь', desc: 'Одолеть хозяина логова, не потеряв ни одного бойца.', icon: 'users-three', payMult: 1.5 },
  swift: { title: 'Без промедления', desc: `Каждый бой похода — не дольше ${SWIFT_ROUNDS} раундов.`, icon: 'fast-forward', payMult: 1.4 },
  valor: { title: 'Во славу', desc: `Потратить за поход не меньше ${VALOR_NEEDED} очков доблести.`, icon: 'crown-simple', payMult: 1.3 },
};

/** Who's paying, and how they'd put it. */
export const CLIENTS: { name: string; line: string }[] = [
  { name: 'Староста Лесной Пади', line: 'Люди боятся выходить за частокол. Сделайте так, чтобы перестали.' },
  { name: 'Купеческая гильдия', line: 'Обозы встают, товар гниёт. Время — деньги, ваши в том числе.' },
  { name: 'Настоятель обители', line: 'Обитель заплатит, если о деле не будут судачить в каждой таверне.' },
  { name: 'Барон фон Штрельц', line: 'Мне нужен результат, а не героические истории. Результат я оплачу.' },
  { name: 'Вдова мельника', line: 'Всё, что скопили, — ваше. Только чтобы оно больше не вернулось.' },
  { name: 'Капитан стражи', line: 'Мои люди туда не пойдут. Ваши — за деньги — пойдут.' },
  { name: 'Ростовщик Хальм', line: 'Должники прячутся там, где им самое место. Выкурите то, что их охраняет.' },
  { name: 'Совет рудокопов', line: 'Шахта стоит, пока там хозяйничают твари. Каждый день простоя — убыток.' },
];

export interface Contract {
  id: string;
  dungeonId: string;
  term: ContractTerm;
  client: number;
  pay: number;
}
