import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, roleColor, roleName } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { EquipmentPanel } from '../components/EquipmentPanel';
import { GhostLink, PrimaryButton } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';

export function GearScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const chosen = engine.squad();
  const [pickId, setPickId] = useState<number | null>(null);
  const cur = chosen.find((c) => c.id === pickId) || chosen[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 16, paddingBottom: 110 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <GhostLink label="Отряд" icon="arrow-left" onPress={() => engine.go('roster')} />
          <GhostLink label="Инвентарь" icon="scroll" onPress={() => engine.go('inventory')} />
        </View>
        <Text style={{ fontSize: 28, fontFamily: font.medium, color: colors.text, marginTop: 10, marginBottom: 4, letterSpacing: -0.5 }}>Снаряжение</Text>
        <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 18, fontFamily: font.regular }}>
          Каждый слот меняет баланс между уроном, живучестью и перезарядкой. Предметы берутся из общего инвентаря гильдии — они не бесконечны.
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {chosen.map((c) => {
            const on = c.id === cur?.id;
            return (
              <Pressable key={c.id} testID={`gear-tab-${c.id}`} onPress={() => setPickId(c.id)} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ borderWidth: on ? 2 : 1, borderColor: on ? '#c9a36b' : colors.border, borderRadius: 8, padding: 1, opacity: on ? 1 : 0.6 }}>
                  <Avatar id={c.id} size={46} radius={6} />
                </View>
                <Text numberOfLines={1} style={{ fontSize: 10.5, color: on ? colors.text : colors.textFaint, fontFamily: font.regular }}>{c.name}</Text>
                <Text style={{ fontSize: 9, color: roleColor[c.role], textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: font.regular }}>{roleName[c.role]}</Text>
              </Pressable>
            );
          })}
        </View>
        {cur ? <EquipmentPanel key={cur.id} engine={engine} c={cur} /> : null}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <LinearGradient colors={['rgba(22,24,38,0)', colors.bg]} style={{ height: 30 }} />
        <View style={{ backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 4, paddingBottom: Math.max(20, insets.bottom + 12) }}>
          <PrimaryButton label="В подземелье" icon="door-open" onPress={() => engine.goDungeon()} />
        </View>
      </View>
    </View>
  );
}
