import { IconName } from '../components/Icon';

export interface TalentOption {
  id: 'a' | 'b';
  name: string;
  desc: string;
  icon: IconName;
  outputMult?: number;
  hpMult?: number;
  wardMult?: number;
  cdMult?: number;
}

export interface TalentTier {
  level: number;
  options: [TalentOption, TalentOption];
}

// One tree per character (keyed by candidate id) — a tier unlocks the moment
// the character reaches its level, and the pick is permanent (mirrors the
// game's other one-way choices: morale, loot rolls). Multipliers stack the
// same way gear does. Each character's tree is flavoured to their own story,
// but the numeric weight at each tier matches their role's baseline power
// budget, so no candidate is mechanically stronger just for being written
// with better lines. Icons follow a consistent grammar across every tree —
// sword/first-aid-kit for output, shield-chevron for HP, target for
// cooldown, shield for pure mitigation, fire for the reckless glass-cannon
// capstone, snowflake for its cold-blooded, more measured counterpart.
//
// Nine tiers span the full level 2–30 track: the original four (2/3/4/5)
// come fast, then three more (10/15/20/25) spread out the midgame, and a
// level-30 capstone caps the character off. Later tiers use smaller bonuses
// than the originals — you get more of them, but each one alone matters
// less, so a maxed-out build ends up meaningfully but not absurdly stronger
// than a level-5 one once everything stacks.
export const TALENT_TREE: Record<number, TalentTier[]> = {
  // 0 — Каелен, Инквизитор (tank): burned his own soul to fight darkness with darkness.
  0: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Гримуар праведных мук', desc: '+12% к максимальному HP — тьма закаляет плоть.', icon: 'shield-chevron', hpMult: 1.12 },
        { id: 'b', name: 'Чёрное клеймо', desc: '+10% к урону — каждый удар выжигает чужой грех.', icon: 'sword', outputMult: 1.10 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Взгляд инквизитора', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Кожа еретика', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Пепел души', desc: '+18% к максимальному HP — часть тьмы стала им самим.', icon: 'shield-chevron', hpMult: 1.18 },
        { id: 'b', name: 'Приговор', desc: '+15% к урону.', icon: 'sword', outputMult: 1.15 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Страж последнего суда', desc: '-20% к получаемому урону.', icon: 'shield', wardMult: 0.80 },
        { id: 'b', name: 'Безумие гримуара', desc: '+25% к урону, но -10% к HP — цена растёт быстрее силы.', icon: 'fire', outputMult: 1.25, hpMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Обугленные страницы', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
        { id: 'b', name: 'Второе клеймо', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Ритуал недоверия', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Плоть еретика', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Заклятая обложка', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
        { id: 'b', name: 'Приговор без пощады', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Второй допрос', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Броня из грехов', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Абсолютное отпущение', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
        { id: 'b', name: 'Гримуар без границ', desc: '+18% к урону, но -8% к HP.', icon: 'fire', outputMult: 1.18, hpMult: 0.92 },
      ],
    },
  ],
  // 1 — Борин, Воин (tank): last of his clan, wants nothing but a worthy fight.
  1: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Шкура ветерана', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
        { id: 'b', name: 'Твёрдая рука', desc: '+10% к урону.', icon: 'sword', outputMult: 1.10 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Клич клана', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Щит предков', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Последний из рода', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
        { id: 'b', name: 'Ярость мести', desc: '+15% к урону.', icon: 'sword', outputMult: 1.15 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Страж отряда', desc: '-20% к получаемому урону.', icon: 'shield', wardMult: 0.80 },
        { id: 'b', name: 'Достойная смерть', desc: '+25% к урону, но -10% к HP.', icon: 'fire', outputMult: 1.25, hpMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Шрамы предков', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
        { id: 'b', name: 'Клинок клана', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Боевой рёв', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Кожаный нагрудник', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Наследие рода', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
        { id: 'b', name: 'Топор мести', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Второе дыхание клана', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Щит последнего воина', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Несгибаемый страж', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
        { id: 'b', name: 'Ярость последнего из рода', desc: '+18% к урону, но -8% к HP.', icon: 'fire', outputMult: 1.18, hpMult: 0.92 },
      ],
    },
  ],
  // 2 — Фаэлар, Хранитель тлена (heal): decay druid, believes the dead keep secrets better than the living.
  2: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Дыхание тлена', desc: '+12% к лечению — гниение ускоряет исцеление.', icon: 'first-aid-kit', outputMult: 1.12 },
        { id: 'b', name: 'Кожа мертвеца', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Споры-паразиты', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Панцирь праха', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Круговорот распада', desc: '+18% к лечению.', icon: 'first-aid-kit', outputMult: 1.18 },
        { id: 'b', name: 'Второе разложение', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Милость могилы', desc: '+22% к лечению.', icon: 'first-aid-kit', outputMult: 1.22 },
        { id: 'b', name: 'Несокрушимый тлен', desc: '-20% к получаемому урону.', icon: 'shield', wardMult: 0.80 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Гниющий бальзам', desc: '+9% к лечению.', icon: 'first-aid-kit', outputMult: 1.09 },
        { id: 'b', name: 'Плотная кора', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Ускоренное гниение', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Могильный покров', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Симбиоз спор', desc: '+11% к лечению.', icon: 'first-aid-kit', outputMult: 1.11 },
        { id: 'b', name: 'Кости-опора', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Мгновенный распад', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Панцирь предков', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Дар последнего вздоха', desc: '+22% к лечению.', icon: 'first-aid-kit', outputMult: 1.22 },
        { id: 'b', name: 'Нетленный хранитель', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
  ],
  // 3 — Тэдиус, Алхимик (heal): obsessed with a "Elixir of Purity", ethics optional.
  3: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Экспериментальная доза', desc: '+12% к лечению.', icon: 'first-aid-kit', outputMult: 1.12 },
        { id: 'b', name: 'Закалённая печень', desc: '+12% к максимальному HP — яды почти не берут.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Быстрый синтез', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Противоядие', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Эликсир Чистоты (бета)', desc: '+18% к лечению.', icon: 'first-aid-kit', outputMult: 1.18 },
        { id: 'b', name: 'Мутация', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Последняя формула', desc: '+22% к лечению.', icon: 'first-aid-kit', outputMult: 1.22 },
        { id: 'b', name: 'Устойчивость к себе', desc: '-20% к получаемому урону.', icon: 'shield', wardMult: 0.80 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Улучшенная рецептура', desc: '+9% к лечению.', icon: 'first-aid-kit', outputMult: 1.09 },
        { id: 'b', name: 'Толстая кожа', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Быстрый замес', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Антидот широкого спектра', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Стабилизированный состав', desc: '+11% к лечению.', icon: 'first-aid-kit', outputMult: 1.11 },
        { id: 'b', name: 'Мутировавшая печень', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Мгновенный синтез', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Иммунитет ко всему', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Эликсир Чистоты (финал)', desc: '+22% к лечению.', icon: 'first-aid-kit', outputMult: 1.22 },
        { id: 'b', name: 'Непробиваемая шкура', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
  ],
  // 4 — Векс, Ассасин (dps): saved from the pyre, now poisons for the church that hates him.
  4: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Яд василиска', desc: '+12% к урону.', icon: 'sword', outputMult: 1.12 },
        { id: 'b', name: 'Тень отступления', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Быстрый клинок', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Растворение в тенях', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Двойная доза яда', desc: '+18% к урону.', icon: 'sword', outputMult: 1.18 },
        { id: 'b', name: 'Закалённые нервы', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Казнь из тени', desc: '+25% к урону, но +10% к получаемому урону.', icon: 'fire', outputMult: 1.25, wardMult: 1.10 },
        { id: 'b', name: 'Хладнокровный убийца', desc: '+15% к урону, -10% к получаемому урону.', icon: 'snowflake', outputMult: 1.15, wardMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Двойной клинок', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
        { id: 'b', name: 'Тень сноровки', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Молниеносный удар', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Слияние с тьмой', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Тройная доза', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
        { id: 'b', name: 'Закалённая кожа', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Рефлексы ассасина', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Иммунитет к боли', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Абсолютная казнь', desc: '+22% к урону, но +9% к получаемому урону.', icon: 'fire', outputMult: 1.22, wardMult: 1.09 },
        { id: 'b', name: 'Тень без страха', desc: '+16% к урону, -9% к получаемому урону.', icon: 'snowflake', outputMult: 1.16, wardMult: 0.91 },
      ],
    },
  ],
  // 5 — Громмаш, «Кровавый Череп» (dps): exiled orc, cursed to outlive everyone he'd rather die beside.
  5: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Кровавая булава', desc: '+12% к урону.', icon: 'sword', outputMult: 1.12 },
        { id: 'b', name: 'Проклятая живучесть', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Рёв клана', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Толстая шкура', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Жажда битвы', desc: '+18% к урону.', icon: 'sword', outputMult: 1.18 },
        { id: 'b', name: 'Долголетие', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Берсерк без страха', desc: '+25% к урону, но +10% к получаемому урону.', icon: 'fire', outputMult: 1.25, wardMult: 1.10 },
        { id: 'b', name: 'Ледяное спокойствие', desc: '+15% к урону, -10% к получаемому урону.', icon: 'snowflake', outputMult: 1.15, wardMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Раскроенный череп', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
        { id: 'b', name: 'Проклятая шкура', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Боевой клич орков', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Шкура из троллиных жил', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Жажда крови', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
        { id: 'b', name: 'Регенерация проклятия', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Второе дыхание берсерка', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Неубиваемая туша', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Резня без конца', desc: '+22% к урону, но +9% к получаемому урону.', icon: 'fire', outputMult: 1.22, wardMult: 1.09 },
        { id: 'b', name: 'Вечный воин', desc: '+16% к урону, -9% к получаемому урону.', icon: 'snowflake', outputMult: 1.16, wardMult: 0.91 },
      ],
    },
  ],
  // 6 — Сильвана, Шепчущая (dps): hunts both the blight and her own order's inquisitors.
  6: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Отравленная стрела', desc: '+12% к урону.', icon: 'sword', outputMult: 1.12 },
        { id: 'b', name: 'Сопротивление яду', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Быстрый выстрел', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Лесная тень', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Двойной наконечник', desc: '+18% к урону.', icon: 'sword', outputMult: 1.18 },
        { id: 'b', name: 'Стойкость охотницы', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Смертельный яд', desc: '+25% к урону, но +10% к получаемому урону.', icon: 'fire', outputMult: 1.25, wardMult: 1.10 },
        { id: 'b', name: 'Хладнокровный прицел', desc: '+15% к урону, -10% к получаемому урону.', icon: 'snowflake', outputMult: 1.15, wardMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Двойная тетива', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
        { id: 'b', name: 'Лесная выносливость', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Мгновенный выстрел', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Кора вместо кожи', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Тройной наконечник', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
        { id: 'b', name: 'Иммунитет к скверне', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Глаз ястреба', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Шкура древних', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Последняя стрела', desc: '+22% к урону, но +9% к получаемому урону.', icon: 'fire', outputMult: 1.22, wardMult: 1.09 },
        { id: 'b', name: 'Хладнокровная охотница', desc: '+16% к урону, -9% к получаемому урону.', icon: 'snowflake', outputMult: 1.16, wardMult: 0.91 },
      ],
    },
  ],
  // 7 — Элара, Ведьма (dps): burns life itself to cure the living, so she raises the dead instead.
  7: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Зелёное пламя', desc: '+12% к урону.', icon: 'sword', outputMult: 1.12 },
        { id: 'b', name: 'Костяная броня', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Быстрый ритуал', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Пепельный щит', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Пламя без предела', desc: '+18% к урону.', icon: 'sword', outputMult: 1.18 },
        { id: 'b', name: 'Армия костей', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Огонь душ', desc: '+25% к урону, но +10% к получаемому урону.', icon: 'fire', outputMult: 1.25, wardMult: 1.10 },
        { id: 'b', name: 'Ледяная ведьма', desc: '+15% к урону, -10% к получаемому урону.', icon: 'snowflake', outputMult: 1.15, wardMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Пламя без пощады', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
        { id: 'b', name: 'Костяной покров', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Мгновенный ритуал', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Пепельная защита', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Второе пламя', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
        { id: 'b', name: 'Армия предков', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Быстрое возрождение', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Кости вместо брони', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Последний вздох душ', desc: '+22% к урону, но +9% к получаемому урону.', icon: 'fire', outputMult: 1.22, wardMult: 1.09 },
        { id: 'b', name: 'Ледяная владычица смерти', desc: '+16% к урону, -9% к получаемому урону.', icon: 'snowflake', outputMult: 1.16, wardMult: 0.91 },
      ],
    },
  ],
  // 9 — Освальд, Контрактник (tank): blocks hits strictly within the paid-for clauses.
  9: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Строка мелким шрифтом', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
        { id: 'b', name: 'Неустойка', desc: '+10% к урону.', icon: 'sword', outputMult: 1.10 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Быстрое урегулирование', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Пункт об ответственности', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Продление гарантии', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
        { id: 'b', name: 'Штрафные санкции', desc: '+15% к урону.', icon: 'sword', outputMult: 1.15 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Полное страховое покрытие', desc: '-20% к получаемому урону.', icon: 'shield', wardMult: 0.80 },
        { id: 'b', name: 'Расторжение без возврата', desc: '+25% к урону, но -10% к HP.', icon: 'fire', outputMult: 1.25, hpMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Дополнительное приложение', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
        { id: 'b', name: 'Повышение тарифа', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Ускоренная медиация', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Пункт о форс-мажоре', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Расширенная гарантия', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
        { id: 'b', name: 'Двойная неустойка', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Апелляция по регламенту', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Пункт о полной защите', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Пожизненная страховка', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
        { id: 'b', name: 'Расторжение без права возврата', desc: '+18% к урону, но -8% к HP.', icon: 'fire', outputMult: 1.18, hpMult: 0.92 },
      ],
    },
  ],
  // 10 — Ирма, Полевой врач (heal): heals fast — but sign the waiver first.
  10: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Экспресс-приём', desc: '+12% к лечению.', icon: 'first-aid-kit', outputMult: 1.12 },
        { id: 'b', name: 'Аптечка первого разряда', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Ускоренное оформление', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Форма отказа от претензий', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Протокол экстренной помощи', desc: '+18% к лечению.', icon: 'first-aid-kit', outputMult: 1.18 },
        { id: 'b', name: 'Второе мнение', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Полис высшей категории', desc: '+22% к лечению.', icon: 'first-aid-kit', outputMult: 1.22 },
        { id: 'b', name: 'Пункт о неразглашении', desc: '-20% к получаемому урону.', icon: 'shield', wardMult: 0.80 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Повторный визит', desc: '+9% к лечению.', icon: 'first-aid-kit', outputMult: 1.09 },
        { id: 'b', name: 'Крепкая конституция', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Экспресс-диагностика', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Форма о полном покрытии', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Обновлённый протокол', desc: '+11% к лечению.', icon: 'first-aid-kit', outputMult: 1.11 },
        { id: 'b', name: 'Второй медосмотр', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Мгновенная реанимация', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Пункт о неразглашении v2', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Высшая категория допуска', desc: '+22% к лечению.', icon: 'first-aid-kit', outputMult: 1.22 },
        { id: 'b', name: 'Абсолютная страховка', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
  ],
  // 11 — Джаспер, Менестрель (dps): sure his ballads inspire the squad, not just annoy it.
  11: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Боевой куплет', desc: '+12% к урону.', icon: 'sword', outputMult: 1.12 },
        { id: 'b', name: 'Крепкие лёгкие', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Быстрый аккорд', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Заглушка от освистывания', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Гимн на бис', desc: '+18% к урону.', icon: 'sword', outputMult: 1.18 },
        { id: 'b', name: 'Луженая глотка', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Финальное крещендо', desc: '+25% к урону, но +10% к получаемому урону.', icon: 'fire', outputMult: 1.25, wardMult: 1.10 },
        { id: 'b', name: 'Тихая нота', desc: '+15% к урону, -10% к получаемому урону.', icon: 'snowflake', outputMult: 1.15, wardMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Второй куплет', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
        { id: 'b', name: 'Крепкие связки', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Быстрый рефрен', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Беруши от критиков', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Хор на бис', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
        { id: 'b', name: 'Несгибаемый голос', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Молниеносная импровизация', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Броня от освистывания', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Финал финалов', desc: '+22% к урону, но +9% к получаемому урону.', icon: 'fire', outputMult: 1.22, wardMult: 1.09 },
        { id: 'b', name: 'Тишина после бури', desc: '+16% к урону, -9% к получаемому урону.', icon: 'snowflake', outputMult: 1.16, wardMult: 0.91 },
      ],
    },
  ],
  // 12 — Гаррет, Коллектор (dps): an ex-knight who now breaks fingers, strictly per the approved price list.
  12: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Первое напоминание', desc: '+12% к урону.', icon: 'sword', outputMult: 1.12 },
        { id: 'b', name: 'Крепкие кулаки', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Быстрый визит', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Броневой жилет', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Повторная претензия', desc: '+18% к урону.', icon: 'sword', outputMult: 1.18 },
        { id: 'b', name: 'Закалённые костяшки', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Изъятие с процентами', desc: '+25% к урону, но +10% к получаемому урону.', icon: 'fire', outputMult: 1.25, wardMult: 1.10 },
        { id: 'b', name: 'Хладнокровное взыскание', desc: '+15% к урону, -10% к получаемому урону.', icon: 'snowflake', outputMult: 1.15, wardMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Второе предупреждение', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
        { id: 'b', name: 'Стальные костяшки', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Молниеносный визит', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Бронежилет второго класса', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Финальная претензия', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
        { id: 'b', name: 'Несокрушимый кулак', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Мгновенное изъятие', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Полная страховка от сдачи', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Изъятие без остатка', desc: '+22% к урону, но +9% к получаемому урону.', icon: 'fire', outputMult: 1.22, wardMult: 1.09 },
        { id: 'b', name: 'Хладнокровный кредитор', desc: '+16% к урону, -9% к получаемому урону.', icon: 'snowflake', outputMult: 1.16, wardMult: 0.91 },
      ],
    },
  ],
  // 13 — Мортана, Некромант-стажёр (dps): raises skeletons for unpaid overtime, unstable but enthusiastic.
  13: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Неоплачиваемый призыв', desc: '+12% к урону.', icon: 'sword', outputMult: 1.12 },
        { id: 'b', name: 'Костяная защита', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Ускоренный ритуал', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Щит стажёра', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Сверхурочный призыв', desc: '+18% к урону.', icon: 'sword', outputMult: 1.18 },
        { id: 'b', name: 'Крепче кости', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Восстание без согласования', desc: '+25% к урону, но +10% к получаемому урону.', icon: 'fire', outputMult: 1.25, wardMult: 1.10 },
        { id: 'b', name: 'Осторожный некромансер', desc: '+15% к урону, -10% к получаемому урону.', icon: 'snowflake', outputMult: 1.15, wardMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Второй призыв', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
        { id: 'b', name: 'Крепче прежнего', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Ускоренный ритуал v2', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Щит полного стажа', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Армия без выходных', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
        { id: 'b', name: 'Кости из стали', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Мгновенное восстание', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Страховка от расформирования', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Восстание без ограничений', desc: '+22% к урону, но +9% к получаемому урону.', icon: 'fire', outputMult: 1.22, wardMult: 1.09 },
        { id: 'b', name: 'Некромансер месяца', desc: '+16% к урону, -9% к получаемому урону.', icon: 'snowflake', outputMult: 1.16, wardMult: 0.91 },
      ],
    },
  ],
  // 8 — Родерик, Паладин (dps): a war hero whose faith cracked once he saw who he was really punishing.
  8: [
    {
      level: 2,
      options: [
        { id: 'a', name: 'Праведный гнев', desc: '+12% к урону.', icon: 'sword', outputMult: 1.12 },
        { id: 'b', name: 'Тяжёлые латы', desc: '+12% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.12 },
      ],
    },
    {
      level: 3,
      options: [
        { id: 'a', name: 'Быстрая молитва', desc: '-20% к перезарядке способности.', icon: 'target', cdMult: 0.80 },
        { id: 'b', name: 'Щит веры', desc: '-15% к получаемому урону.', icon: 'shield', wardMult: 0.85 },
      ],
    },
    {
      level: 4,
      options: [
        { id: 'a', name: 'Кара еретикам', desc: '+18% к урону.', icon: 'sword', outputMult: 1.18 },
        { id: 'b', name: 'Несокрушимая вера', desc: '+18% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.18 },
      ],
    },
    {
      level: 5,
      options: [
        { id: 'a', name: 'Слепая ярость', desc: '+25% к урону, но +10% к получаемому урону.', icon: 'fire', outputMult: 1.25, wardMult: 1.10 },
        { id: 'b', name: 'Сомнение и сталь', desc: '+15% к урону, -10% к получаемому урону.', icon: 'snowflake', outputMult: 1.15, wardMult: 0.90 },
      ],
    },
    {
      level: 10,
      options: [
        { id: 'a', name: 'Второе призвание', desc: '+9% к урону.', icon: 'sword', outputMult: 1.09 },
        { id: 'b', name: 'Тяжёлая кольчуга', desc: '+9% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.09 },
      ],
    },
    {
      level: 15,
      options: [
        { id: 'a', name: 'Мгновенная молитва', desc: '-15% к перезарядке способности.', icon: 'target', cdMult: 0.85 },
        { id: 'b', name: 'Щит сомнений', desc: '-11% к получаемому урону.', icon: 'shield', wardMult: 0.89 },
      ],
    },
    {
      level: 20,
      options: [
        { id: 'a', name: 'Гнев без границ', desc: '+11% к урону.', icon: 'sword', outputMult: 1.11 },
        { id: 'b', name: 'Несокрушимые латы', desc: '+11% к максимальному HP.', icon: 'shield-chevron', hpMult: 1.11 },
      ],
    },
    {
      level: 25,
      options: [
        { id: 'a', name: 'Второе покаяние', desc: '-12% к перезарядке способности.', icon: 'target', cdMult: 0.88 },
        { id: 'b', name: 'Броня разбитой веры', desc: '-9% к получаемому урону.', icon: 'shield', wardMult: 0.91 },
      ],
    },
    {
      level: 30,
      options: [
        { id: 'a', name: 'Последний крестовый поход', desc: '+22% к урону, но +9% к получаемому урону.', icon: 'fire', outputMult: 1.22, wardMult: 1.09 },
        { id: 'b', name: 'Сталь без веры', desc: '+16% к урону, -9% к получаемому урону.', icon: 'snowflake', outputMult: 1.16, wardMult: 0.91 },
      ],
    },
  ],
};
