import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, roleColor } from '../theme/theme';
import { DUNGEONS, LOCATIONS } from '../data/dungeons';
import { Avatar } from '../components/Avatar';
import { Icon, IconName } from '../components/Icon';
import { TabBar } from '../components/TabBar';
import { useEngineVersion } from '../engine/useEngine';
import { FEATURES, FEATURE_ORDER, Feature, unlockHint } from '../data/features';

const DUNGEON_ICON: Record<string, IconName> = {
  wastes: 'trash-simple', road: 'path', groblot: 'skull',
  frostpass: 'drop', wolfrifts: 'target', icepeaks: 'snowflake',
  charfields: 'flame', parishruins: 'campfire', ashen: 'fire',
  mortgagedfarms: 'scroll', debtorsjail: 'shield-chevron', mines: 'coins',
  blackmarket: 'storefront', smugglercatacombs: 'path', nightsyndicate: 'sword',
  unmarkedgraves: 'skull', desertersfort: 'shield', deadlegion: 'users-three',
  burntcliffs: 'flame', wyvernlair: 'target', ancientpeak: 'fire',
  shareholderfloor: 'chart-line-up', councilantechamber: 'identification-card', boardroom: 'crown-simple',
};

/** A camp menu row; locked ones show what opens them instead of navigating. */
function MenuCard({ title, sub, icon, onPress, lockedHint, caret }: {
  title: string; sub: string; icon?: IconName; onPress: () => void; lockedHint?: string; caret?: boolean;
}) {
  const locked = !!lockedHint;
  return (
    <Pressable
      onPress={locked ? undefined : onPress}
      disabled={locked}
      style={({ pressed }) => ({
        borderWidth: 1, borderColor: locked ? colors.border : pressed ? colors.borderHover : colors.borderStrong,
        borderRadius: 8, padding: 14, backgroundColor: locked ? 'transparent' : colors.surface, marginBottom: 22,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: locked ? 0.55 : 1,
      })}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>{title}</Text>
        <Text style={{ fontSize: 13, color: locked ? colors.textFaint : colors.textMuted, marginTop: 4, fontFamily: font.regular }}>{locked ? lockedHint : sub}</Text>
      </View>
      <Icon name={locked ? 'lock-simple' : caret ? 'caret-right' : icon ?? 'caret-right'} size={locked || caret ? 16 : 18} color={locked ? colors.borderHover : colors.textDim} />
    </Pressable>
  );
}

/** Where "Посмотреть" leads for a freshly opened system. */
function openFeature(engine: GameEngine, f: Feature) {
  const first = engine.squad()[0];
  switch (f) {
    case 'gear': engine.go('gear'); break;
    case 'quests': engine.go('quests'); break;
    case 'shop': engine.go('shop'); break;
    case 'weekly': engine.go('weekly'); break;
    case 'achievements': engine.go('achievements'); break;
    case 'hire': engine.go('hire'); break;
    case 'personnel': engine.go('personnel'); break;
    case 'arena': engine.go('arena'); break;
    case 'analytics': engine.go('analytics'); break;
    default: if (first) engine.openChar(first.id); // talents, classes, professions live on the hero card
  }
}

function UnlockBanner({ engine, f }: { engine: GameEngine; f: Feature }) {
  const d = FEATURES[f];
  return (
    <View
      testID={'unlock-' + f}
      style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 10, padding: 14, marginBottom: 22, backgroundColor: colors.accentWash }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(145,132,217,0.22)' }}>
          <Icon name={d.icon} size={16} color={colors.accentSoft} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.accent, fontFamily: font.medium }}>Открыто новое</Text>
          <Text style={{ fontSize: 16, color: colors.text, fontFamily: font.medium }}>{d.title}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textMuted, fontFamily: font.regular }}>{d.intro}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Pressable
          testID="unlock-open"
          onPress={() => { engine.markUnlockSeen(f); openFeature(engine, f); }}
          style={{ flex: 1, height: 38, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 13, color: colors.bg, fontFamily: font.semibold }}>Посмотреть</Text>
        </Pressable>
        <Pressable
          testID="unlock-ok"
          onPress={() => engine.markUnlockSeen(f)}
          style={{ flex: 1, height: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: font.medium }}>Понятно</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function HomeScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const squad = engine.squad();
  const ready = engine.squadReady();
  const inventory = engine.inventoryVM();
  const freeItems = inventory.reduce((sum, r) => sum + Math.max(0, r.free), 0);
  const hireCount = engine.hireVM().length;
  const weeklyVM = engine.weeklyChallengeVM();
  // The nearest milestone still ahead, and what it opens — shown as one teaser
  // instead of a wall of locked cards.
  const upcoming = FEATURE_ORDER.filter((f) => !engine.isUnlocked(f));
  const need = (f: Feature) => (FEATURES[f].bosses ?? 0) * 100 + (FEATURES[f].rooms ?? 0);
  const nextNeed = upcoming.length ? Math.min(...upcoming.map(need)) : 0;
  const nextUp = upcoming.filter((f) => need(f) === nextNeed);
  const fresh = engine.newUnlocks()[0];

  const locationGroups = LOCATIONS.map((loc) => ({
    loc,
    dungeons: DUNGEONS.filter((d) => d.locationId === loc.id).map((d) => {
      const unlocked = engine.isDungeonUnlocked(d.id);
      return {
        key: d.id,
        name: d.name,
        meta: unlocked ? `${d.encounters.length} комнаты · рекоменд. ГС ${d.recommendedGs}` : 'Заблокировано',
        desc: unlocked ? d.desc : d.lockedDesc,
        icon: unlocked ? DUNGEON_ICON[d.id] : ('lock-simple' as const),
        iconColor: unlocked ? colors.danger : colors.borderHover,
        locked: !unlocked,
        onTap: () => {
          if (!unlocked) return;
          engine.selectDungeon(d.id);
          if (ready) engine.goDungeon(); else engine.go('roster');
        },
      };
    }),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 96 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Отдел кадров</Text>
            <Text style={{ fontSize: 30, fontFamily: font.medium, color: colors.text, marginTop: 4, letterSpacing: -0.6 }}>Лагерь</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="coins" size={15} color={colors.warn} />
              <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.warn }}>{engine.gold}</Text>
            </View>
            <Pressable
              onPress={() => engine.go('settings')}
              hitSlop={10}
              style={{
                width: 40, height: 40, borderRadius: 20,
                borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="gear" size={18} color={colors.textDim} />
            </Pressable>
          </View>
        </View>
        <View style={{ height: 22 }} />

        {fresh ? <UnlockBanner engine={engine} f={fresh} /> : null}

        {engine.payrollNotice ? (
          <Pressable
            onPress={() => engine.dismissPayrollNotice()}
            style={{
              borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 18,
              borderColor: engine.payrollNotice.shortfall ? colors.danger : colors.border,
              backgroundColor: engine.payrollNotice.shortfall ? 'rgba(209,104,92,0.1)' : colors.surface,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}
          >
            <Icon name="coins" size={16} color={engine.payrollNotice.shortfall ? colors.danger : colors.warn} />
            <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: engine.payrollNotice.shortfall ? colors.danger : colors.textMuted, fontFamily: font.regular }}>
              {engine.payrollNotice.shortfall
                ? `Бюджета не хватило на зарплату — выплачено только ${engine.payrollNotice.paid} из положенного. Гильдия недовольна.`
                : `Зарплата выплачена: -${engine.payrollNotice.paid} золота.`}
            </Text>
          </Pressable>
        ) : null}

        {engine.employeeOfMonthNotice ? (
          <Pressable
            onPress={() => engine.dismissEmployeeOfMonthNotice()}
            style={{
              borderWidth: 1, borderColor: colors.warn, borderRadius: 8, padding: 12, marginBottom: 18,
              backgroundColor: 'rgba(201,176,109,0.12)', flexDirection: 'row', alignItems: 'center', gap: 10,
            }}
          >
            <Icon name="trophy" size={16} color={colors.warn} />
            <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.warn, fontFamily: font.regular }}>
              Сотрудник месяца: {engine.employeeOfMonthNotice.name}. Премия по морали выплачена всей гильдии.
            </Text>
          </Pressable>
        ) : null}

        {engine.resignationNotice ? (
          <Pressable
            onPress={() => engine.dismissResignationNotice()}
            style={{
              borderWidth: 1, borderColor: colors.danger, borderRadius: 8, padding: 12, marginBottom: 18,
              backgroundColor: 'rgba(209,104,92,0.1)', flexDirection: 'row', alignItems: 'center', gap: 10,
            }}
          >
            <Icon name="warning" size={16} color={colors.danger} />
            <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.danger, fontFamily: font.regular }}>
              {engine.resignationNotice.name} написал(а) заявление по собственному желанию — мораль была слишком низкой.
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => engine.go('roster')}
          style={({ pressed }) => ({
            borderWidth: 1, borderColor: pressed ? colors.borderHover : colors.borderStrong,
            borderRadius: 8, padding: 14, backgroundColor: colors.surface, marginBottom: 22,
          })}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>Текущий отряд</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 12, color: colors.accent, fontFamily: font.regular }}>Изменить</Text>
              <Icon name="caret-right" size={13} color={colors.accent} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {squad.map((m) => (
              <View key={m.id} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Avatar id={m.id} size={64} radius={8} style={{ width: '100%', aspectRatio: 1, height: undefined }} />
                <Text numberOfLines={1} style={{ fontSize: 10, color: colors.textMuted, fontFamily: font.regular }}>{m.name}</Text>
                <View style={{ width: 16, height: 2, backgroundColor: roleColor[m.role] }} />
              </View>
            ))}
          </View>
        </Pressable>

        {engine.isUnlocked('gear') ? (
          <MenuCard title="Инвентарь" caret onPress={() => engine.go('inventory')} sub={inventory.length === 0 ? 'Склад пуст' : `${inventory.length} видов предметов · ${freeItems} свободно`} />
        ) : null}
        {engine.isUnlocked('shop') ? (
          <MenuCard title="Отдел закупок" icon="storefront" onPress={() => engine.go('shop')} sub="Купить и продать снаряжение за бюджет гильдии" />
        ) : null}
        {engine.isUnlocked('hire') ? (
          <MenuCard title="Найм героев" icon="door-open" onPress={() => engine.go('hire')} sub={hireCount === 0 ? 'Все соискатели наняты' : `${hireCount} соискател${hireCount === 1 ? 'ь' : hireCount < 5 ? 'я' : 'ей'} на рынке труда`} />
        ) : null}
        {engine.isUnlocked('analytics') ? (
          <MenuCard title="Аналитика гильдии" icon="chart-line-up" onPress={() => engine.go('analytics')} sub="Win-rate, бюджет, мораль и KPI в динамике" />
        ) : null}
        {engine.isUnlocked('personnel') ? (
          <MenuCard title="Личные дела" icon="identification-card" onPress={() => engine.go('personnel')} sub="Досье сотрудников и архив уволенных" />
        ) : null}
        {engine.isUnlocked('achievements') ? (
          <MenuCard title="Достижения" icon="trophy" onPress={() => engine.go('achievements')} sub={`${engine.achievementVM().filter((a) => a.claimed).length}/${engine.achievementVM().length} получено`} />
        ) : null}
        {engine.isUnlocked('weekly') ? (
          <MenuCard title="Испытание недели" icon="crown-simple" onPress={() => engine.go('weekly')} sub={weeklyVM.available ? (weeklyVM.claimed ? 'Награда уже получена' : weeklyVM.modifierName) : 'Откроется после первого босса'} />
        ) : null}

        {nextUp.length ? (
          <View testID="next-up" style={{ borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 8, padding: 14, marginBottom: 22, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="lock-simple" size={13} color={colors.textFaint} />
              <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>
                {unlockHint(nextUp[0])}
              </Text>
            </View>
            <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textMuted, fontFamily: font.regular }}>
              {nextUp.map((f) => FEATURES[f].title).join(', ')}
            </Text>
          </View>
        ) : null}

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 10, fontFamily: font.regular }}>Походы</Text>
        {locationGroups.map(({ loc, dungeons }) => {
          const locUnlocked = dungeons.some((d) => !d.locked);
          return (
            <View key={loc.id} style={{ marginBottom: 18 }}>
              <Text style={{ fontSize: 12.5, fontFamily: font.medium, color: locUnlocked ? colors.text : colors.textFaint, marginBottom: 8 }}>{loc.name}</Text>
              {dungeons.map((d) => (
                <Pressable
                  key={d.key}
                  onPress={d.onTap}
                  disabled={d.locked}
                  style={{
                    borderWidth: 1, borderColor: d.locked ? colors.border : colors.borderStrong,
                    borderRadius: 8, padding: 16, marginBottom: 10,
                    backgroundColor: d.locked ? 'transparent' : colors.surface, opacity: d.locked ? 0.5 : 1,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 17, fontFamily: font.medium, color: colors.text, letterSpacing: -0.2 }}>{d.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 4, fontFamily: font.regular }}>{d.meta}</Text>
                    </View>
                    <Icon name={d.icon} size={20} color={d.iconColor} />
                  </View>
                  <Text style={{ fontSize: 12.5, lineHeight: 19, color: colors.textMuted, marginTop: 10, fontFamily: font.regular }}>{d.desc}</Text>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
      <TabBar engine={engine} />
    </View>
  );
}
