import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, ink } from '../theme/theme';
import { Icon, IconName } from '../components/Icon';
import { TabBar, TAB_BAR_CONTENT_HEIGHT } from '../components/TabBar';
import { useEngineVersion } from '../engine/useEngine';
import { Parchment, ScreenTitle, WaxSeal } from '../components/Frame';

export function QuestsScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const quests = engine.questVM();
  const doneCount = quests.filter((q) => q.claimed).length;
  const dailies = engine.dailyQuestVM();
  const dailyDoneCount = dailies.filter((q) => q.claimed).length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + 24 }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.accent, fontFamily: font.medium }}>Отдел кадров</Text>
        <ScreenTitle style={{ marginTop: 4, marginBottom: 4 }}>KPI гильдии</ScreenTitle>
        <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 22, fontFamily: font.regular }}>
          Выполнено {doneCount}/{quests.length} · каждый закрытый показатель поднимает мораль всей гильдии.
        </Text>

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.accent, marginBottom: 10, fontFamily: font.medium }}>
          Ежедневные задачи · {dailyDoneCount}/{dailies.length}
        </Text>
        {dailies.map((q) => (
          <Contract key={q.id} name={q.name} desc={q.desc} claimed={q.claimed} achieved={q.achieved} onClaim={q.onClaim} icon="coins"
            reward={q.claimed ? 'Награда получена' : `${q.progress}/${q.target} · ${q.rewardDesc}`} />
        ))}

        <View style={{ height: 10 }} />
        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.accent, marginBottom: 10, fontFamily: font.medium }}>
          Постоянные KPI
        </Text>
        {quests.map((q) => (
          <Contract key={q.id} name={q.name} desc={q.desc} claimed={q.claimed} achieved={q.achieved} onClaim={q.onClaim} icon="scroll"
            reward={q.claimed ? 'Награда получена' : q.rewardDesc} />
        ))}
      </ScrollView>
      <TabBar engine={engine} />
    </View>
  );
}

/** One task as a contract pinned to the board: a parchment note in ink, sealed in wax once it's met. */
function Contract({ name, desc, reward, icon, claimed, achieved, onClaim }: {
  name: string; desc: string; reward: string; icon: IconName; claimed: boolean; achieved: boolean; onClaim: () => void;
}) {
  return (
    <Parchment style={{ marginBottom: 12, opacity: claimed ? 0.5 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ marginTop: 3 }}><Icon name={claimed ? 'check' : icon} size={16} color={claimed ? ink.faint : ink.muted} weight={claimed ? 'fill' : 'regular'} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontFamily: font.title, color: ink.text, letterSpacing: 0.2 }}>{name}</Text>
          <Text style={{ fontSize: 14, color: ink.muted, marginTop: 2, lineHeight: 19, fontFamily: font.regular }}>{desc}</Text>
          <Text style={{ fontSize: 13, color: claimed ? ink.faint : ink.red, marginTop: 6, fontFamily: font.italic }}>{reward}</Text>
        </View>
      </View>
      {achieved && !claimed ? (
        <Pressable onPress={onClaim} style={({ pressed }) => ({ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ fontSize: 15, fontFamily: font.title, color: ink.red }}>Забрать награду</Text>
          <WaxSeal size={36}><Icon name="coins" size={15} color="#f3dcc0" weight="fill" /></WaxSeal>
        </Pressable>
      ) : null}
    </Parchment>
  );
}
