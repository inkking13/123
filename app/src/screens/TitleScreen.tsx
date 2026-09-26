import React, { useState } from 'react';
import { Image, LayoutChangeEvent, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { PrimaryButton } from '../components/Buttons';

// Key art: the logo sits across the middle (kept whole on phones), the knight right of centre.
const ART = require('../../assets/title/title-art.jpg');
const ART_ASPECT = 1600 / 893;
/** Horizontal point of the art kept in the middle of a narrow screen. */
const FOCUS_X = 0.5;

/** The art covering its box, cropped around FOCUS_X rather than the centre. */
function KeyArt() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const imgW = Math.max(box.w, box.h * ART_ASPECT);
  const imgH = imgW / ART_ASPECT;
  const left = Math.min(0, Math.max(box.w - imgW, box.w / 2 - imgW * FOCUS_X));
  return (
    <View onLayout={onLayout} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', overflow: 'hidden' }}>
      {box.w > 0 ? (
        <Image testID="title-art" source={ART} resizeMode="cover" style={{ position: 'absolute', left, top: 0, width: imgW, height: Math.max(imgH, box.h) }} />
      ) : null}
      <LinearGradient
        colors={['rgba(22,24,38,0)', 'rgba(22,24,38,0)', colors.bg]}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
    </View>
  );
}

export function TitleScreen({ engine }: { engine: GameEngine }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyArt />
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
