import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { Icon } from '../components/Icon';
import { TabBar, TAB_BAR_CONTENT_HEIGHT } from '../components/TabBar';
import { useEngineVersion } from '../engine/useEngine';

export function QuestsScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const quests = engine.questVM();
  const doneCount = quests.filter((q) => q.claimed).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + 24 }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Отдел кадров</Text>
        <Text style={{ fontSize: 30, fontFamily: font.medium, color: colors.text, marginTop: 4, marginBottom: 4, letterSpacing: -0.6 }}>KPI гильдии</Text>
        <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 22, fontFamily: font.regular }}>
          Выполнено {doneCount}/{quests.length} · каждый закрытый показатель поднимает мораль всей гильдии.
        </Text>

        {quests.map((q) => (
          <View
            key={q.id}
            style={{
              borderWidth: 1, borderRadius: 8, padding: 14, marginBottom: 10,
              borderColor: q.claimed ? colors.border : q.achieved ? colors.accent : colors.borderStrong,
              backgroundColor: q.claimed ? 'transparent' : q.achieved ? colors.accentWash : colors.surface,
              opacity: q.claimed ? 0.55 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{
                width: 26, height: 26, borderRadius: 13, marginTop: 1, alignItems: 'center', justifyContent: 'center',
                backgroundColor: q.claimed ? 'transparent' : 'rgba(145,132,217,0.14)',
                borderWidth: q.claimed ? 1 : 0, borderColor: colors.borderStrong,
              }}>
                <Icon name={q.claimed ? 'check' : 'scroll'} size={13} color={q.claimed ? colors.textFaint : colors.accent} weight={q.claimed ? 'fill' : 'regular'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontFamily: font.medium, color: q.claimed ? colors.textFaint : colors.text }}>{q.name}</Text>
                <Text style={{ fontSize: 12.5, color: colors.textDim, marginTop: 3, lineHeight: 18, fontFamily: font.regular }}>{q.desc}</Text>
                <Text style={{ fontSize: 11.5, color: q.claimed ? colors.textFaint : colors.accentSoft, marginTop: 6, fontFamily: font.regular }}>
                  {q.claimed ? 'Награда получена' : q.rewardDesc}
                </Text>
              </View>
            </View>
            {q.achieved && !q.claimed ? (
              <Pressable
                onPress={q.onClaim}
                style={{ marginTop: 12, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 13, fontFamily: font.medium, color: colors.accentSoft }}>Забрать награду</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <TabBar engine={engine} />
    </View>
  );
}
