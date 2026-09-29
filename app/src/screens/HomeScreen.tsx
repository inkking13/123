import React, { useMemo, useState } from 'react';
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
import { TiltArt } from '../components/TiltArt';
import { askMotionPermission } from '../components/useTilt';
import { LinearGradient } from 'expo-linear-gradient';
import { CampScene3D } from '../battle3d/CampScene3D';
import { canRender3D } from '../battle3d/Battle3D';
import { gearLookOf } from '../battle3d/gearLooks';

// The key art without its logo: burning castle on the left, the guild's heroes on the right.
const CAMP_ART = require('../../assets/title/camp-art.jpg');

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

/** A square camp menu tile: icon, title and a one-line status. */
function MenuTile({ title, sub, icon, onPress }: { title: string; sub: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: '48.5%', borderWidth: 1, borderColor: pressed ? GOLD : GOLD_DIM, borderRadius: 6,
        backgroundColor: pressed ? 'rgba(201,176,109,0.10)' : 'rgba(24,21,17,0.92)', padding: 12, gap: 8, minHeight: 92,
      })}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: GOLD_DIM, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1712' }}>
        <Icon name={icon} size={17} color="#d9c595" />
      </View>
      <Text style={{ fontSize: 13, fontFamily: font.semibold, color: '#efe4c8' }}>{title}</Text>
      <Text numberOfLines={2} style={{ fontSize: 11, lineHeight: 15, color: colors.textDim, fontFamily: font.regular }}>{sub}</Text>
    </Pressable>
  );
}
const GOLD = '#8a7650';
const GOLD_DIM = '#4a4032';

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
      style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 10, padding: 14, marginBottom: 22, backgroundColor: 'rgba(30,28,52,0.96)' }}
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

  const [failed3d, setFailed3d] = useState(false);
  const show3d = engine.settings.view3d && canRender3D() && !failed3d;
  const gearKey = squad.map((m) => m.id + ':' + JSON.stringify(m.equipment)).join('|');
  const campGear = useMemo(() => Object.fromEntries(squad.map((m) => [m.id, gearLookOf(m.equipment)])), [gearKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiles: { title: string; sub: string; icon: IconName; onPress: () => void }[] = [];
  if (engine.isUnlocked('gear')) {
    tiles.push({ title: 'Снаряжение', icon: 'shield', onPress: () => engine.go('gear'), sub: 'Надеть добычу на героев' });
    tiles.push({ title: 'Инвентарь', icon: 'scroll', onPress: () => engine.go('inventory'), sub: inventory.length === 0 ? 'Склад пуст' : inventory.length + ' видов · ' + freeItems + ' свободно' });
  }
  if (engine.isUnlocked('shop')) tiles.push({ title: 'Отдел закупок', icon: 'storefront', onPress: () => engine.go('shop'), sub: 'Купить и продать' });
  if (engine.isUnlocked('hire')) tiles.push({ title: 'Найм героев', icon: 'door-open', onPress: () => engine.go('hire'), sub: hireCount === 0 ? 'Все наняты' : hireCount + ' на рынке труда' });
  if (engine.isUnlocked('analytics')) tiles.push({ title: 'Аналитика', icon: 'chart-line-up', onPress: () => engine.go('analytics'), sub: 'Win-rate, бюджет, мораль' });
  if (engine.isUnlocked('personnel')) tiles.push({ title: 'Личные дела', icon: 'identification-card', onPress: () => engine.go('personnel'), sub: 'Досье и архив' });
  if (engine.isUnlocked('achievements')) tiles.push({ title: 'Достижения', icon: 'trophy', onPress: () => engine.go('achievements'), sub: engine.achievementVM().filter((a) => a.claimed).length + '/' + engine.achievementVM().length + ' получено' });
  if (engine.isUnlocked('weekly')) tiles.push({ title: 'Испытание недели', icon: 'crown-simple', onPress: () => engine.go('weekly'), sub: weeklyVM.available ? (weeklyVM.claimed ? 'Награда получена' : weeklyVM.modifierName) : 'После первого босса' });

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

  // The furthest open dungeon: where the next push goes.
  const nextDungeon = [...locationGroups.flatMap((g) => g.dungeons)].reverse().find((d) => !d.locked);

  return (
    <View style={{ flex: 1 }} onTouchStart={askMotionPermission}>
      {/* Art behind the top of camp; the page scrolls over it. */}
      <TiltArt testID="camp-art" source={CAMP_ART} aspect={1600 / 893} focusX={0.66} fadeFrom={0.5} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 400 + insets.top }} />
      <LinearGradient pointerEvents="none" colors={['rgba(22,24,38,0.75)', 'rgba(22,24,38,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120 + insets.top }} />
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
        {/* A window onto the art: the guild's heroes on the ridge. */}
        <View style={{ height: fresh ? 22 : 60 }} />

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

        {/* The squad round the fire; tap to change it. */}
        <Pressable onPress={() => engine.go('roster')} style={{ borderWidth: 1, borderColor: GOLD_DIM, borderRadius: 6, overflow: 'hidden', marginBottom: 14, backgroundColor: '#0d0b10' }}>
          {show3d ? (
            <CampScene3D ids={squad.map((m) => m.id)} gear={campGear} height={230} quality={engine.settings.quality} onFail={() => setFailed3d(true)} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 44 }}>
              {squad.map((m) => (
                <View key={m.id} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <Avatar id={m.id} size={64} radius={8} style={{ width: '100%', aspectRatio: 1, height: undefined }} />
                </View>
              ))}
            </View>
          )}
          <LinearGradient pointerEvents="none" colors={['rgba(13,11,16,0)', 'rgba(13,11,16,0.92)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64 }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {squad.map((m) => (
                <View key={m.id} style={{ alignItems: 'center' }}>
                  <Text numberOfLines={1} style={{ fontSize: 10, color: '#efe4c8', fontFamily: font.medium, textShadowColor: '#000', textShadowRadius: 3 }}>{m.name}</Text>
                  <View style={{ width: 14, height: 2, marginTop: 2, backgroundColor: roleColor[m.role] }} />
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, color: '#d9c595', fontFamily: font.medium }}>Отряд</Text>
              <Icon name="caret-right" size={12} color="#d9c595" />
            </View>
          </View>
        </Pressable>

        {/* The next dungeon, one tap away. */}
        {nextDungeon ? (
          <Pressable
            onPress={nextDungeon.onTap}
            style={({ pressed }) => ({ borderWidth: 1, borderColor: pressed ? '#c9b06d' : GOLD, borderRadius: 6, marginBottom: 14, overflow: 'hidden' })}
          >
            <LinearGradient colors={['#3a2a18', '#1e160f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: GOLD, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="path" size={20} color="#f0d58a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: '#c9b06d', fontFamily: font.regular }}>В поход</Text>
                <Text style={{ fontSize: 17, fontFamily: font.semibold, color: '#f4e9cf', marginTop: 2 }}>{nextDungeon.name}</Text>
                <Text style={{ fontSize: 11.5, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>{nextDungeon.meta}</Text>
              </View>
              <Icon name="arrow-right" size={20} color="#f0d58a" />
            </LinearGradient>
          </Pressable>
        ) : null}

        {tiles.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 22 }}>
            {tiles.map((t) => <MenuTile key={t.title} {...t} />)}
          </View>
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
