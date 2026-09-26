import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { PrimaryButton } from '../components/Buttons';
import { TiltArt } from '../components/TiltArt';
import { askMotionPermission } from '../components/useTilt';

// Key art: the logo sits across the middle (kept whole on phones), the knight right of centre.
const ART = require('../../assets/title/title-art.jpg');
const ART_ASPECT = 1600 / 893;
/** Horizontal point of the art kept in the middle of a narrow screen. */
const FOCUS_X = 0.5;

export function TitleScreen({ engine }: { engine: GameEngine }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }} onTouchStart={askMotionPermission}>
      <TiltArt testID="title-art" source={ART} aspect={ART_ASPECT} focusX={FOCUS_X} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%' }} />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 40 + insets.bottom, paddingTop: insets.top }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textDim, marginBottom: 14, fontFamily: font.regular }}>
          Отдел кадров · Гильдия наёмников
        </Text>
        <View style={{ width: 34, height: 3, backgroundColor: colors.accent, marginBottom: 14 }} />
        <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textMuted, maxWidth: 320, fontFamily: font.regular }}>
          Тебя наняли HR-директором гильдии наёмников — девять личных дел, зарплатная ведомость и подземелье, из которого не все возвращаются на работу в понедельник. Собеседования, повышения, увольнения — вся кадровая политика теперь на тебе.
        </Text>
        <PrimaryButton
          label="Приступить к обязанностям"
          trailingIcon="arrow-right"
          onPress={() => engine.go('home')}
          height={52}
          style={{ marginTop: 28 }}
        />
        <Text style={{ marginTop: 16, fontSize: 11, color: colors.textFaint, fontFamily: font.regular }}>
          Прототип · портретный режим · 9 личных дел
        </Text>
      </View>
    </View>
  );
}
