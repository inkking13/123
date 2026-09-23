import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { Icon } from '../components/Icon';
import { GhostLink } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';

export function AchievementsScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const achievements = engine.achievementVM();
  const doneCount = achievements.filter((a) => a.claimed).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 40 }}>
        <GhostLink label="Лагерь" icon="arrow-left" onPress={() => engine.go('home')} />
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, marginTop: 16, fontFamily: font.regular }}>Отдел кадров</Text>
        <Text style={{ fontSize: 30, fontFamily: font.medium, color: colors.text, marginTop: 4, marginBottom: 4, letterSpacing: -0.6 }}>Достижения</Text>
        <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 22, fontFamily: font.regular }}>
          Получено {doneCount}/{achievements.length} · разовые вехи за весь путь гильдии, не сбрасываются.
        </Text>

        {achievements.map((a) => (
          <View
            key={a.id}
            style={{
              borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 10,
              borderColor: a.claimed ? colors.border : a.achieved ? colors.good : colors.borderStrong,
              backgroundColor: a.claimed ? 'transparent' : a.achieved ? 'rgba(122,168,116,0.1)' : colors.surface,
              opacity: a.claimed ? 0.55 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{
                width: 26, height: 26, borderRadius: 13, marginTop: 1, alignItems: 'center', justifyContent: 'center',
                backgroundColor: a.claimed ? 'transparent' : 'rgba(122,168,116,0.14)',
                borderWidth: a.claimed ? 1 : 0, borderColor: colors.borderStrong,
              }}>
                <Icon name={a.claimed ? 'check' : 'trophy'} size={13} color={a.claimed ? colors.textFaint : colors.good} weight={a.claimed ? 'fill' : 'regular'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: font.medium, color: a.claimed ? colors.textFaint : colors.text }}>{a.name}</Text>
                <Text style={{ fontSize: 12.5, color: colors.textDim, marginTop: 3, lineHeight: 18, fontFamily: font.regular }}>{a.desc}</Text>
                <Text style={{ fontSize: 11.5, color: a.claimed ? colors.textFaint : colors.good, marginTop: 6, fontFamily: font.regular }}>
                  {a.claimed ? 'Награда получена' : a.rewardDesc}
                </Text>
              </View>
            </View>
            {a.achieved && !a.claimed ? (
              <Pressable
                onPress={a.onClaim}
                style={{ marginTop: 12, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.good, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 13, fontFamily: font.medium, color: colors.good }}>Забрать награду</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
