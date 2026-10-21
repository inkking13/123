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

/** A compact camp menu tile, three to a row: icon, title, one status line and a badge when something waits there. */
function MenuTile({ title, sub, icon, badge, onPress }: { title: string; sub: string; icon: IconName; badge?: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: '31.8%' }}>
      {({ pressed }) => (
        <Frame pressed={pressed} contentStyle={{ paddingVertical: 10, paddingHorizontal: 6, minHeight: 92, alignItems: 'center', gap: 5 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: pressed ? GOLD : GOLD_DIM, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15120e' }}>
            <Icon name={icon} size={18} color="#e3cc93" />
          </View>
          <Text numberOfLines={1} style={{ fontSize: 12, fontFamily: font.semibold, color: '#efe4c8', textAlign: 'center' }}>{title}</Text>
          <Text numberOfLines={1} style={{ fontSize: 10, color: colors.textDim, fontFamily: font.regular, textAlign: 'center' }}>{sub}</Text>
          {badge ? (
            <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: '#15120f', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 10, lineHeight: 12, color: '#fff', fontFamily: font.semibold }}>{badge}</Text>
            </View>
          ) : null}
        </Frame>
      )}
    </Pressable>
  );
}

/** A one-line camp notice; tap to dismiss. */
function Notice({ icon, color, text, onClose }: { icon: IconName; color: string; text: string; onClose: () => void }) {
  return (
    <Pressable onPress={onClose} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: color, backgroundColor: 'rgba(14,12,16,0.88)' }}>
      <Icon name={icon} size={15} color={color} />
      <Text numberOfLines={2} style={{ flex: 1, fontSize: 12, lineHeight: 16, color, fontFamily: font.regular }}>{text}</Text>
      <Icon name="x" size={13} color={colors.textDim} />
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
  const tiles: { title: string; sub: string; icon: IconName; badge?: number; onPress: () => void }[] = [];
  const achievements = engine.achievementVM();
  const achReady = achievements.filter((a) => a.achieved && !a.claimed).length;
  if (engine.isUnlocked('gear')) {
    tiles.push({ title: 'Снаряжение', icon: 'shield', onPress: () => engine.go('gear'), sub: 'Одеть отряд' });
    tiles.push({ title: 'Инвентарь', icon: 'scroll', onPress: () => engine.go('inventory'), sub: inventory.length === 0 ? 'Склад пуст' : freeItems + ' свободно' });
  }
  if (engine.isUnlocked('shop')) tiles.push({ title: 'Закупки', icon: 'storefront', onPress: () => engine.go('shop'), sub: 'Купить и продать' });
  if (engine.isUnlocked('hire')) tiles.push({ title: 'Найм', icon: 'door-open', onPress: () => engine.go('hire'), sub: hireCount === 0 ? 'Все наняты' : hireCount + ' на рынке' });
  if (engine.isUnlocked('analytics')) tiles.push({ title: 'Аналитика', icon: 'chart-line-up', onPress: () => engine.go('analytics'), sub: 'Win-rate, бюджет' });
  if (engine.isUnlocked('personnel')) tiles.push({ title: 'Личные дела', icon: 'identification-card', onPress: () => engine.go('personnel'), sub: 'Досье и архив' });
  if (engine.isUnlocked('achievements')) tiles.push({ title: 'Достижения', icon: 'trophy', onPress: () => engine.go('achievements'), badge: achReady, sub: achievements.filter((a) => a.claimed).length + '/' + achievements.length + ' получено' });
  if (engine.isUnlocked('weekly')) tiles.push({ title: 'Испытание', icon: 'crown-simple', onPress: () => engine.go('weekly'), badge: weeklyVM.available && !weeklyVM.claimed ? 1 : 0, sub: weeklyVM.available ? (weeklyVM.claimed ? 'Награда получена' : weeklyVM.modifierName) : 'После первого босса' });

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
        <View style={{ height: fresh ? 14 : 18 }} />

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

        {engine.payrollNotice || engine.employeeOfMonthNotice || engine.resignationNotice ? (
          <View style={{ gap: 6, marginBottom: 14 }}>
            {engine.payrollNotice ? (
              <Notice
                icon="coins"
                color={engine.payrollNotice.shortfall ? colors.danger : colors.warn}
                onClose={() => engine.dismissPayrollNotice()}
                text={engine.payrollNotice.shortfall
                  ? `Бюджета не хватило на зарплату — выплачено только ${engine.payrollNotice.paid}. Гильдия недовольна.`
                  : `Зарплата выплачена: -${engine.payrollNotice.paid} золота.`}
              />
            ) : null}
            {engine.employeeOfMonthNotice ? (
              <Notice icon="trophy" color={colors.warn} onClose={() => engine.dismissEmployeeOfMonthNotice()} text={`Сотрудник месяца: ${engine.employeeOfMonthNotice.name}. Премия по морали выплачена всей гильдии.`} />
            ) : null}
            {engine.resignationNotice ? (
              <Notice icon="warning" color={colors.danger} onClose={() => engine.dismissResignationNotice()} text={`${engine.resignationNotice.name} написал(а) заявление по собственному желанию — мораль была слишком низкой.`} />
            ) : null}
          </View>
        ) : null}

        {/* The squad round the fire; tap to change it. */}
        <Pressable onPress={() => engine.go('roster')} style={{ borderWidth: 1, borderColor: GOLD_DIM, borderRadius: 6, overflow: 'hidden', marginBottom: 14, backgroundColor: '#0d0b10' }}>
          {show3d ? (
            <CampScene3D ids={squad.map((m) => m.id)} gear={campGear} height={180} quality={engine.settings.quality} onFail={() => setFailed3d(true)} />
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: '2.3%', rowGap: 8, marginBottom: 22 }}>
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
