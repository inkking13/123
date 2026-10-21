import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, ink } from '../theme/theme';
import { Icon } from '../components/Icon';
import { PrimaryButton } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';
import { Avatar } from '../components/Avatar';
import { Parchment, ScreenTitle } from '../components/Frame';

export function EventScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const ev = engine.activeEvent!;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 32, paddingHorizontal: 20, paddingBottom: Math.max(24, insets.bottom + 16) }}>
        <View style={{ width: 34, height: 3, backgroundColor: colors.accent, marginBottom: 16 }} />
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.accent, fontFamily: font.medium }}>Отдел кадров</Text>
        <ScreenTitle style={{ marginTop: 6, marginBottom: 14 }}>{ev.title}</ScreenTitle>
        {/* The incident report on a parchment sheet; the choices are inked onto it as numbered lines. */}
        <Parchment contentStyle={{ paddingHorizontal: 18, paddingVertical: 18 }}>
          {ev.faces.length ? (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {ev.faces.map((id) => (
                <View key={id} style={{ alignItems: 'center', width: ev.faces.length > 2 ? 54 : 72 }}>
                  <View style={{ borderWidth: 1, borderColor: ink.text, borderRadius: 4, padding: 1 }}>
                    <Avatar id={id} size={ev.faces.length > 2 ? 50 : 66} radius={3} />
                  </View>
                  <Text numberOfLines={1} style={{ fontSize: 12.5, color: ink.muted, marginTop: 4, fontFamily: font.italic }}>{engine.nameOf(id)}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={{ fontSize: 16, lineHeight: 23, color: ink.text, marginBottom: ev.stakes ? 12 : 4, fontFamily: font.regular }}>{ev.desc}</Text>
          {ev.stakes && ev.resultText == null ? (
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
              <Icon name="warning" size={15} color={ink.red} />
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: ink.red, fontFamily: font.italic }}>{ev.stakes}</Text>
            </View>
          ) : null}
          <View style={{ height: 1, backgroundColor: ink.rule, marginVertical: 12 }} />
          {ev.resultText == null ? (
            <View style={{ gap: 4 }}>
              {([['a', ev.labelA], ['b', ev.labelB]] as const).map(([k, label], i) => (
                <Pressable key={k} onPress={() => engine.chooseEvent(k)} style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 3, backgroundColor: pressed ? 'rgba(90,60,30,0.14)' : 'transparent' })}>
                  <Text style={{ fontSize: 16, fontFamily: font.title, color: ink.red }}>{i + 1}.</Text>
                  <Text style={{ flex: 1, fontSize: 16, lineHeight: 21, fontFamily: font.semibold, color: ink.text }}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="scroll" size={17} color={ink.muted} />
              <Text style={{ flex: 1, fontSize: 15.5, lineHeight: 22, color: ink.text, fontFamily: font.italic }}>{ev.resultText}</Text>
            </View>
          )}
        </Parchment>
        {ev.resultText != null ? (
          <>
            <View style={{ flex: 1, minHeight: 20 }} />
            <PrimaryButton label="Продолжить" onPress={() => engine.dismissEvent()} style={{ marginTop: 20 }} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
