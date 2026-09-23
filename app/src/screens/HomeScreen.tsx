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

export function HomeScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const squad = engine.squad();
  const ready = engine.squadReady();
  const inventory = engine.inventoryVM();
  const freeItems = inventory.reduce((sum, r) => sum + Math.max(0, r.free), 0);
  const hireCount = engine.hireVM().length;
  const weeklyVM = engine.weeklyChallengeVM();

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

        <Pressable
          onPress={() => engine.go('inventory')}
          style={({ pressed }) => ({
            borderWidth: 1, borderColor: pressed ? colors.borderHover : colors.borderStrong,
            borderRadius: 8, padding: 14, backgroundColor: colors.surface, marginBottom: 22,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          })}
        >
          <View>
            <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>Инвентарь</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: font.regular }}>
              {inventory.length === 0 ? 'Склад пуст' : `${inventory.length} видов предметов · ${freeItems} свободно`}
            </Text>
          </View>
          <Icon name="caret-right" size={16} color={colors.textDim} />
        </Pressable>

        <Pressable
          onPress={() => engine.go('shop')}
          style={({ pressed }) => ({
            borderWidth: 1, borderColor: pressed ? colors.borderHover : colors.borderStrong,
            borderRadius: 8, padding: 14, backgroundColor: colors.surface, marginBottom: 22,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          })}
        >
          <View>
            <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>Отдел закупок</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: font.regular }}>Купить и продать снаряжение за бюджет гильдии</Text>
          </View>
          <Icon name="storefront" size={18} color={colors.textDim} />
        </Pressable>

        <Pressable
          onPress={() => engine.go('hire')}
          style={({ pressed }) => ({
            borderWidth: 1, borderColor: pressed ? colors.borderHover : colors.borderStrong,
            borderRadius: 8, padding: 14, backgroundColor: colors.surface, marginBottom: 22,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          })}
        >
          <View>
            <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>Найм героев</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: font.regular }}>
              {hireCount === 0 ? 'Все соискатели наняты' : `${hireCount} соискател${hireCount === 1 ? 'ь' : hireCount < 5 ? 'я' : 'ей'} на рынке труда`}
            </Text>
          </View>
          <Icon name="door-open" size={18} color={colors.textDim} />
        </Pressable>

        <Pressable
          onPress={() => engine.go('analytics')}
          style={({ pressed }) => ({
            borderWidth: 1, borderColor: pressed ? colors.borderHover : colors.borderStrong,
            borderRadius: 8, padding: 14, backgroundColor: colors.surface, marginBottom: 22,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          })}
        >
          <View>
            <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>Аналитика гильдии</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: font.regular }}>Win-rate, бюджет, мораль и KPI в динамике</Text>
          </View>
          <Icon name="chart-line-up" size={18} color={colors.textDim} />
        </Pressable>

        <Pressable
          onPress={() => engine.go('personnel')}
          style={({ pressed }) => ({
            borderWidth: 1, borderColor: pressed ? colors.borderHover : colors.borderStrong,
            borderRadius: 8, padding: 14, backgroundColor: colors.surface, marginBottom: 22,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          })}
        >
          <View>
            <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>Личные дела</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: font.regular }}>Досье сотрудников и архив уволенных</Text>
          </View>
          <Icon name="identification-card" size={18} color={colors.textDim} />
        </Pressable>

        <Pressable
          onPress={() => engine.go('achievements')}
          style={({ pressed }) => ({
            borderWidth: 1, borderColor: pressed ? colors.borderHover : colors.borderStrong,
            borderRadius: 8, padding: 14, backgroundColor: colors.surface, marginBottom: 22,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          })}
        >
          <View>
            <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>Достижения</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: font.regular }}>
              {engine.achievementVM().filter((a) => a.claimed).length}/{engine.achievementVM().length} получено
            </Text>
          </View>
          <Icon name="trophy" size={18} color={colors.textDim} />
        </Pressable>

        <Pressable
          onPress={() => engine.go('weekly')}
          style={({ pressed }) => ({
            borderWidth: 1, borderColor: pressed ? colors.borderHover : colors.borderStrong,
            borderRadius: 8, padding: 14, backgroundColor: colors.surface, marginBottom: 22,
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          })}
        >
          <View>
            <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>Испытание недели</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4, fontFamily: font.regular }}>
              {weeklyVM.available ? (weeklyVM.claimed ? 'Награда уже получена' : weeklyVM.modifierName) : 'Откроется после первого босса'}
            </Text>
          </View>
          <Icon name="chart-line-up" size={18} color={colors.textDim} />
        </Pressable>

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
