import { ItemIconId } from './itemIcons';

export interface ReagentDef {
  id: string;
  name: string;
  desc: string;
  icon: ItemIconId;
  locationId: string;
}

// One crafting reagent per location — drops off both trash and bosses in
// that location's three dungeons, feeding the profession recipes below.
export const REAGENTS: ReagentDef[] = [
  { id: 'scrap-metal', name: 'Ржавый Металлолом', desc: 'Гнутые пряжки и обломки клинков — кузнецу пригодится.', icon: 'shipastyy-tsep', locationId: 'outskirts' },
  { id: 'wolf-hide', name: 'Шкура Ледяного Волка', desc: 'Промёрзшая насквозь, но выделке поддаётся.', icon: 'kostyanye-naplechniki', locationId: 'icefrontier' },
  { id: 'ash-slate', name: 'Пепельный Сланец', desc: 'Спрессованный многолетним пожаром камень.', icon: 'urna-zabytogo-korolya', locationId: 'ashlands' },
  { id: 'silver-ingot', name: 'Слиток Конфискованного Серебра', desc: 'Изъят по описи — но опись потерялась.', icon: 'meshochek-zolota', locationId: 'debtprovince' },
  { id: 'dark-essence', name: 'Тёмная Эссенция', desc: 'Сгущённая тень — тяжелее, чем кажется на вид.', icon: 'essentsiya-pustoty', locationId: 'shadowguild' },
  { id: 'bone-dust', name: 'Костяная Пыль', desc: 'Перемолотые останки — почти неисчерпаемый ресурс.', icon: 'zagadochnyy-cherep', locationId: 'forgottenlegion' },
  { id: 'wyvern-scale', name: 'Чешуя Виверны', desc: 'Легче стали, но не уступает ей в прочности.', icon: 'golova-drevnego-drakona', locationId: 'dragonwastes' },
  { id: 'demonic-alloy', name: 'Демонический Сплав', desc: 'Ещё тёплый — будто выплавлен только что.', icon: 'roga-povelitelya-ada', locationId: 'hierarchy' },
];

export const REAGENT_BY_LOCATION: Record<string, ReagentDef> = Object.fromEntries(REAGENTS.map((r) => [r.locationId, r]));

export const ROOM_REAGENT_CHANCE = 0.6;
