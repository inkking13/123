import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, roleColor } from '../theme/theme';
import { DUNGEONS, LOCATIONS } from '../data/dungeons';
import { Avatar } from '../components/Avatar';
import { Icon, IconName } from '../components/Icon';
import { TabBar, TAB_BAR_CONTENT_HEIGHT } from '../components/TabBar';
import { Corners, Frame, Ornament } from '../components/Frame';
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
  wastes: 'skull', road: 'path', groblot: 'skull',
  frostpass: 'drop', wolfrifts: 'target', icepeaks: 'snowflake',
  charfields: 'flame', parishruins: 'campfire', ashen: 'fire',
  mortgagedfarms: 'scroll', debtorsjail: 'shield-chevron', mines: 'coins',
  blackmarket: 'storefront', smugglercatacombs: 'path', nightsyndicate: 'sword',
  unmarkedgraves: 'skull', desertersfort: 'shield', deadlegion: 'users-three',
  burntcliffs: 'flame', wyvernlair: 'target', ancientpeak: 'fire',
  shareholderfloor: 'chart-line-up', councilantechamber: 'identification-card', boardroom: 'crown-simple',
};

/** A square camp menu tile: icon, title and a one-line status. */
function MenuTile({ title, sub, icon, onPress }: { title: string; sub: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: '48.5%' }}>
      {({ pressed }) => (
        <Frame pressed={pressed} contentStyle={{ padding: 12, minHeight: 86, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: pressed ? GOLD : GOLD_DIM, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15120e' }}>
            <Icon name={icon} size={19} color="#e3cc93" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 13.5, fontFamily: font.semibold, color: '#efe4c8' }}>{title}</Text>
            <Text numberOfLines={3} style={{ fontSize: 11, lineHeight: 15, color: colors.textDim, fontFamily: font.regular }}>{sub}</Text>
          </View>
        </Frame>
      )}
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
  const show3d = canRender3D() && !failed3d;
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
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.accent, fontFamily: font.medium }}>Отдел кадров</Text>
            <Text style={{ fontSize: 32, fontFamily: font.semibold, color: '#f4e9cf', marginTop: 2, letterSpacing: -0.6, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 8 }}>Лагерь</Text>
            <Ornament width={110} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {/* Treasury: a gold chip, tap for the ledger once analytics opens. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: GOLD, backgroundColor: 'rgba(20,16,12,0.85)' }}>
              <Icon name="coins" size={17} color="#f0d58a" weight="fill" />
              <Text style={{ fontSize: 15, fontFamily: font.semibold, color: '#f0d58a' }}>{engine.gold}</Text>
            </View>
            <Pressable
              onPress={() => engine.go('settings')}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20,16,12,0.85)',
                borderWidth: 1, borderColor: pressed ? GOLD : GOLD_DIM, alignItems: 'center', justifyContent: 'center',
              })}
            >
              <Icon name="gear" size={18} color="#d9c595" />
            </Pressable>
          </View>
        </View>
        {/* A window onto the art: the guild's heroes on the ridge. */}
        <View style={{ height: fresh ? 22 : 60 }} />

        {fresh ? <UnlockBanner engine={engine} f={fresh} /> : null}

        {engine.safeMode3d ? (
          <View style={{ borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 18, borderColor: colors.warn, backgroundColor: 'rgba(212,160,80,0.08)' }}>
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textMuted, fontFamily: font.regular, marginBottom: 10 }}>
              В прошлый раз игра закрылась при показе 3D, поэтому графика переключена на «Низкое». Вернуть её можно в настройках.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={() => engine.dismissSafeMode3d()} style={{ flex: 1, height: 34, borderRadius: 7, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12.5, color: colors.accentSoft, fontFamily: font.medium }}>Понятно</Text>
              </Pressable>
              <Pressable onPress={() => engine.go('settings')} style={{ flex: 1, height: 34, borderRadius: 7, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12.5, color: colors.textDim, fontFamily: font.medium }}>Настройки</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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
          <Corners color="#b39462" />
        </Pressable>

        {/* The next dungeon, one tap away. */}
        {nextDungeon ? (
          <Pressable onPress={nextDungeon.onTap} style={{ marginBottom: 8 }}>
            {({ pressed }) => (
              <Frame tone="gold" pressed={pressed} contentStyle={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: '#c9b06d', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}>
                  <Icon name="sword" size={22} color="#f0d58a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', color: '#c9b06d', fontFamily: font.medium }}>{ready ? 'В поход' : 'Собрать отряд и в поход'}</Text>
                  <Text style={{ fontSize: 18, fontFamily: font.semibold, color: '#f4e9cf', marginTop: 2 }}>{nextDungeon.name}</Text>
                  <Text style={{ fontSize: 11.5, color: '#b9ab8e', marginTop: 2, fontFamily: font.regular }}>{nextDungeon.meta}</Text>
                </View>
                <Icon name="arrow-right" size={22} color="#f0d58a" />
              </Frame>
            )}
          </Pressable>
        ) : null}
        <Pressable testID="all-dungeons" onPress={() => engine.go('levelmap')} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginBottom: 18 }}>
          <Icon name="path" size={13} color="#d9c595" />
          <Text style={{ fontSize: 12, color: '#d9c595', fontFamily: font.medium }}>Карта походов</Text>
          <Icon name="caret-right" size={12} color="#d9c595" />
        </Pressable>

        {tiles.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 22 }}>
            {tiles.map((t) => <MenuTile key={t.title} {...t} />)}
          </View>
        ) : null}

        {nextUp.length ? (
          <Frame tone="muted" style={{ marginBottom: 22 }} contentStyle={{ padding: 14, gap: 6 }}>
            <View testID="next-up" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="lock-simple" size={13} color={colors.textDim} />
              <Text style={{ fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.medium }}>
                {unlockHint(nextUp[0])}
              </Text>
            </View>
            <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textMuted, fontFamily: font.regular }}>
              {nextUp.map((f) => FEATURES[f].title).join(', ')}
            </Text>
          </Frame>
        ) : null}
      </ScrollView>
      <TabBar engine={engine} />
    </View>
  );
}
