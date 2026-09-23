import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, roleColor, roleName } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { ItemIcon } from '../components/ItemIcon';
import { GhostLink, PrimaryButton } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';

export function GearScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const chosen = engine.squad();

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

        {chosen.map((c) => {
          const slots = engine.gearSlotsFor(c);
          return (
            <View key={c.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: colors.surface }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Avatar id={c.id} size={38} radius={8} />
                <View>
                  <Text style={{ fontSize: 15, fontFamily: font.medium, color: colors.text }}>{c.name}</Text>
                  <Text style={{ fontSize: 11, color: roleColor[c.role], letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: font.regular }}>{roleName[c.role]}</Text>
                </View>
              </View>
              {slots.map((slot) => (
                <View key={slot.label} style={{ marginBottom: 9 }}>
                  <Text style={{ fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textFaint, marginBottom: 5, fontFamily: font.regular }}>{slot.label}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                    {slot.options.map((o) => (
                      <Pressable
                        key={o.id}
                        onPress={o.onPick}
                        disabled={o.disabled}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 6,
                          borderWidth: 1, borderColor: o.border, backgroundColor: o.bg, borderRadius: 7,
                          paddingHorizontal: 8, paddingVertical: 6, opacity: o.disabled ? 0.45 : 1,
                        }}
                      >
                        {o.icon ? <ItemIcon id={o.icon} size={26} radius={5} /> : null}
                        <View>
                          <Text style={{ fontSize: 11.5, color: o.color, fontFamily: font.regular }}>{o.name}</Text>
                          {o.stockLabel ? <Text style={{ fontSize: 9, color: colors.textFaint, marginTop: 1, fontFamily: font.regular }}>{o.stockLabel}</Text> : null}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
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
