import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { Icon, IconName } from './Icon';

export const TAB_BAR_CONTENT_HEIGHT = 58;

export function TabBar({ engine }: { engine: GameEngine }) {
  const insets = useSafeAreaInsets();
  const screen = engine.screen;
  const hasReward = engine.questVM().some((q) => q.achieved && !q.claimed);
  const tabs: { label: string; icon: IconName; active: boolean; badge?: boolean; onTap: () => void }[] = [
    { label: 'Лагерь', icon: 'campfire', active: screen === 'home', onTap: () => engine.go('home') },
    { label: 'Отряд', icon: 'users-three', active: screen === 'roster', onTap: () => engine.go('roster') },
    { label: 'Поход', icon: 'path', active: screen === 'levelmap', onTap: () => engine.go('levelmap') },
    { label: 'Арена', icon: 'sword', active: screen === 'arena', onTap: () => engine.go('arena') },
    { label: 'KPI', icon: 'scroll', active: screen === 'quests', badge: hasReward, onTap: () => engine.go('quests') },
  ];
  return (
    <View
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
        paddingBottom: Math.max(8, insets.bottom), paddingTop: 8, paddingHorizontal: 12,
        flexDirection: 'row', backgroundColor: 'rgba(22,24,38,0.92)',
        borderTopWidth: 1, borderTopColor: colors.border,
      }}
    >
      {tabs.map((t) => (
        <Pressable key={t.label} onPress={t.onTap} style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 }}>
          <View>
            <Icon name={t.icon} size={20} color={t.active ? colors.accent : colors.textFaint} />
            {t.badge ? (
              <View style={{ position: 'absolute', top: -2, right: -4, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }} />
            ) : null}
          </View>
          <Text style={{ fontSize: 10, letterSpacing: 0.2, fontFamily: font.regular, color: t.active ? colors.accent : colors.textFaint }}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
