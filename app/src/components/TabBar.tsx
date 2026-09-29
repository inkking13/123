import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font } from '../theme/theme';
import { Icon, IconName } from './Icon';

export const TAB_BAR_CONTENT_HEIGHT = 62;

export function TabBar({ engine }: { engine: GameEngine }) {
  const insets = useSafeAreaInsets();
  const screen = engine.screen;
  const hasReward = engine.questVM().some((q) => q.achieved && !q.claimed);
  const tabs: { label: string; icon: IconName; active: boolean; badge?: boolean; locked?: boolean; onTap: () => void }[] = [
    { label: 'Лагерь', icon: 'campfire', active: screen === 'home', onTap: () => engine.go('home') },
    { label: 'Отряд', icon: 'users-three', active: screen === 'roster', onTap: () => engine.go('roster') },
    { label: 'Поход', icon: 'path', active: screen === 'levelmap', onTap: () => engine.go('levelmap') },
    { label: 'Арена', icon: 'sword', active: screen === 'arena', locked: !engine.isUnlocked('arena'), onTap: () => engine.go('arena') },
    { label: 'KPI', icon: 'scroll', active: screen === 'quests', badge: hasReward && engine.isUnlocked('quests'), locked: !engine.isUnlocked('quests'), onTap: () => engine.go('quests') },
  ];
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: TAB_BAR_CONTENT_HEIGHT + insets.bottom }}>
      <LinearGradient colors={['#1d1914', '#0e0c10']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      {/* Gold rule along the top edge, brightest in the middle. */}
      <LinearGradient
        colors={['rgba(138,118,80,0.15)', '#8a7650', 'rgba(138,118,80,0.15)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 1 }}
      />
      <View style={{ flex: 1, flexDirection: 'row', paddingBottom: Math.max(6, insets.bottom), paddingHorizontal: 6 }}>
        {tabs.map((t) => (
          <Pressable
            key={t.label}
            testID={'tab-' + t.label}
            onPress={t.locked ? undefined : t.onTap}
            disabled={t.locked}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }}
          >
            {t.active ? (
              <>
                {/* The open tab: a lit bar on top and a warm glow behind its icon. */}
                <View style={{ position: 'absolute', top: 0, width: 34, height: 2, borderRadius: 1, backgroundColor: colors.accentBright }} />
                <LinearGradient
                  colors={['rgba(226,191,133,0.22)', 'rgba(226,191,133,0)']}
                  style={{ position: 'absolute', top: 0, left: 6, right: 6, bottom: 4, borderRadius: 8 }}
                />
              </>
            ) : null}
            <View style={{ opacity: t.locked ? 0.35 : 1 }}>
              <Icon name={t.icon} size={23} color={t.active ? colors.accentBright : '#8d8577'} weight={t.active ? 'fill' : 'regular'} />
              {t.badge ? (
                <View style={{ position: 'absolute', top: -2, right: -5, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger, borderWidth: 1.5, borderColor: '#15120f' }} />
              ) : null}
            </View>
            {t.locked ? (
              <View style={{ position: 'absolute', top: 8, right: '28%', width: 15, height: 15, borderRadius: 8, backgroundColor: '#15120f', borderWidth: 1, borderColor: '#4a4032', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="lock-simple" size={9} color="#8d8577" />
              </View>
            ) : null}
            <Text style={{ fontSize: 10.5, letterSpacing: 0.3, fontFamily: t.active ? font.semibold : font.regular, color: t.active ? colors.accentBright : t.locked ? '#5a554d' : '#8d8577' }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
