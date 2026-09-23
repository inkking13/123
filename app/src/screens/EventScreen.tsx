import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { Icon } from '../components/Icon';
import { PrimaryButton } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';

export function EventScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const ev = engine.activeEvent!;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 32, paddingHorizontal: 20, paddingBottom: Math.max(24, insets.bottom + 16) }}>
        <View style={{ width: 34, height: 3, backgroundColor: colors.accent, marginBottom: 16 }} />
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Отдел кадров</Text>
        <Text style={{ fontSize: 28, fontFamily: font.medium, color: colors.text, marginTop: 6, marginBottom: 14, letterSpacing: -0.5 }}>{ev.title}</Text>
        <Text style={{ fontSize: 14, lineHeight: 21, color: colors.textMuted, marginBottom: 26, fontFamily: font.regular }}>{ev.desc}</Text>

        {ev.resultText == null ? (
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() => engine.chooseEvent('a')}
              style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 14 }}
            >
              <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.text }}>{ev.labelA}</Text>
            </Pressable>
            <Pressable
              onPress={() => engine.chooseEvent('b')}
              style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 14 }}
            >
              <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.text }}>{ev.labelB}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 8, padding: 14, backgroundColor: colors.accentWash, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="scroll" size={16} color={colors.accentSoft} />
              <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: colors.text, fontFamily: font.regular }}>{ev.resultText}</Text>
            </View>
            <View style={{ flex: 1, minHeight: 20 }} />
            <PrimaryButton label="Продолжить" onPress={() => engine.dismissEvent()} style={{ marginTop: 20 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}
