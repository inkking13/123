import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine, Screen } from '../engine/GameEngine';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font, ink } from '../theme/theme';
import { Icon, IconName } from './Icon';

export const TAB_BAR_CONTENT_HEIGHT = 62;

// Which tab a screen belongs to, so a sub-screen keeps its tab lit.
const TAB_OF: Partial<Record<Screen, Screen>> = {
  roster: 'roster', char: 'roster', gear: 'roster', profession: 'roster',
  levelmap: 'levelmap', arena: 'arena', quests: 'quests',
};

export function TabBar({ engine }: { engine: GameEngine }) {
  const insets = useSafeAreaInsets();
  const lit = TAB_OF[engine.screen] ?? 'home';
  const hasReward = engine.questVM().some((q) => q.achieved && !q.claimed);
  const tab = (screen: Screen, label: string, icon: IconName, extra: { badge?: boolean; locked?: boolean } = {}) =>
    ({ screen, label, icon, active: lit === screen, ...extra });
  const left = [
    tab('home', 'Лагерь', 'campfire'),
    tab('roster', 'Отряд', 'users-three', { badge: !engine.squadReady() }),
  ];
  const right = [
    tab('arena', 'Арена', 'sword', { locked: !engine.isUnlocked('arena') }),
    tab('quests', 'KPI', 'scroll', { badge: hasReward && engine.isUnlocked('quests'), locked: !engine.isUnlocked('quests') }),
  ];
  const raidLit = lit === 'levelmap';
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: TAB_BAR_CONTENT_HEIGHT + insets.bottom }}>
      <LinearGradient colors={['#21180f', '#0c0806']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      {/* Gold rule along the top edge, brightest in the middle. */}
      <LinearGradient
        colors={['rgba(143,111,69,0.15)', '#8f6f45', 'rgba(143,111,69,0.15)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1 }}
      />
      <View style={{ flex: 1, flexDirection: 'row', paddingBottom: Math.max(6, insets.bottom), paddingHorizontal: 6 }}>
        {left.map((t) => <Tab key={t.screen} {...t} onTap={() => engine.goTab(t.screen)} />)}
        {/* The raised wax seal in the middle: straight to the next dungeon. */}
        <Pressable testID="tab-raid" onPress={() => engine.quickRaid()} onLongPress={() => engine.goTab('levelmap')} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          {({ pressed }) => (
            <>
              {/* Same height as the other icons, so the labels line up; the seal rises out of it. */}
              <View style={{ height: 23, justifyContent: 'flex-end', alignItems: 'center' }}>
                <View style={{ marginBottom: -4, width: 54, height: 54, borderRadius: 27, padding: 2, backgroundColor: '#140e09', transform: [{ scale: pressed ? 0.94 : 1 }, { rotate: '-6deg' }] }}>
                  <LinearGradient colors={raidLit ? ['#cf5a43', '#a0301f', ink.waxDark] : ['#b8402f', ink.wax, ink.waxDark]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1, borderRadius: 25, borderWidth: 1.5, borderColor: raidLit ? '#e9b48f' : 'rgba(255,190,160,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                    {/* The ring pressed into the wax around the crest. */}
                    <View style={{ position: 'absolute', top: 5, left: 5, right: 5, bottom: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(40,6,2,0.45)' }} />
                    <Icon name="sword" size={24} color="#f3dcc0" weight="fill" />
                  </LinearGradient>
                </View>
              </View>
              <Text style={{ fontSize: 12, letterSpacing: 0.3, fontFamily: font.title, color: colors.accentBright }}>В поход</Text>
            </>
          )}
        </Pressable>
        {right.map((t) => <Tab key={t.screen} {...t} onTap={() => engine.goTab(t.screen)} />)}
      </View>
    </View>
  );
}

function Tab({ label, icon, active, badge, locked, onTap }: { label: string; icon: IconName; active: boolean; badge?: boolean; locked?: boolean; onTap: () => void }) {
  return (
    <Pressable
      testID={'tab-' + label}
      onPress={locked ? undefined : onTap}
      disabled={locked}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}
    >
      {active ? (
        <>
          {/* The open tab: a lit bar on top and a warm glow behind its icon. */}
          <View style={{ position: 'absolute', top: 0, width: 34, height: 2, borderRadius: 1, backgroundColor: colors.accentBright }} />
          <LinearGradient
            colors={['rgba(226,189,124,0.2)', 'rgba(226,189,124,0)']}
            style={{ position: 'absolute', top: 0, left: 6, right: 6, bottom: 4, borderRadius: 8 }}
          />
        </>
      ) : null}
      <View style={{ opacity: locked ? 0.35 : 1 }}>
        <Icon name={icon} size={23} color={active ? colors.accentBright : '#8e7f69'} weight={active ? 'fill' : 'regular'} />
        {badge ? (
          <View style={{ position: 'absolute', top: -2, right: -5, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: '#140e09' }} />
        ) : null}
      </View>
      {locked ? (
        <View style={{ position: 'absolute', top: 8, right: '28%', width: 15, height: 15, borderRadius: 8, backgroundColor: '#140e09', borderWidth: 1, borderColor: '#4d3b29', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock-simple" size={9} color="#8e7f69" />
        </View>
      ) : null}
      <Text style={{ fontSize: 12, letterSpacing: 0.3, fontFamily: active ? font.title : font.caps, color: active ? colors.accentBright : locked ? '#5c5144' : '#8e7f69' }}>{label}</Text>
    </Pressable>
  );
}
