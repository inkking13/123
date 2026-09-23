import React from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { PrimaryButton } from '../components/Buttons';

export function TitleScreen({ engine }: { engine: GameEngine }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={['#262a60', 'rgba(38,42,96,0)']}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.3, y: 0.6 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%' }}
      />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 54 + insets.bottom, paddingTop: insets.top }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textDim, marginBottom: 16, fontFamily: font.regular }}>
          Отдел кадров · Гильдия наёмников
        </Text>
        <View style={{ width: 34, height: 3, backgroundColor: colors.accent, marginBottom: 18 }} />
        <Text style={{ fontSize: 44, lineHeight: 42, letterSpacing: -1.3, fontFamily: font.medium, color: colors.text }}>
          RAID{'\n'}COMMANDER
        </Text>
        <Text style={{ marginTop: 18, fontSize: 14, lineHeight: 22, color: colors.textMuted, maxWidth: 300, fontFamily: font.regular }}>
          Тебя наняли HR-директором гильдии наёмников — девять личных дел, зарплатная ведомость и подземелье, из которого не все возвращаются на работу в понедельник. Собеседования, повышения, увольнения — вся кадровая политика теперь на тебе.
        </Text>
        <PrimaryButton
          label="Приступить к обязанностям"
          trailingIcon="arrow-right"
          onPress={() => engine.go('home')}
          height={52}
          style={{ marginTop: 34 }}
        />
        <Text style={{ marginTop: 18, fontSize: 11, color: colors.textFaint, fontFamily: font.regular }}>
          Прототип · портретный режим · 9 личных дел
        </Text>
      </View>
    </View>
  );
}
