import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { Ornament } from '../components/Frame';
import { Icon } from '../components/Icon';
import { TiltArt } from '../components/TiltArt';
import { askMotionPermission } from '../components/useTilt';

// Key art: the logo sits across the middle (kept whole on phones), the knight right of centre.
const ART = require('../../assets/title/title-art.jpg');
const ART_ASPECT = 1600 / 893;
/** Horizontal point of the art kept in the middle of a narrow screen. */
const FOCUS_X = 0.5;

export function TitleScreen({ engine }: { engine: GameEngine }) {
  const insets = useSafeAreaInsets();
  const [confirmNew, setConfirmNew] = useState(false);
  // The text and buttons rise in under the art.
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(rise, { toValue: 1, duration: 700, delay: 150, useNativeDriver: true }).start(); }, [rise]);
  const saved = engine.hasSave;
  const progress = engine.statsBossWins > 0
    ? `Боссов побеждено: ${engine.statsBossWins} · золото ${engine.gold}`
    : `Комнат пройдено: ${engine.statsRoomWins} · золото ${engine.gold}`;
  const startNew = async () => { await engine.resetProgress(); engine.start(); };
  return (
    <View style={{ flex: 1 }} onTouchStart={askMotionPermission}>
      <TiltArt testID="title-art" source={ART} aspect={ART_ASPECT} focusX={FOCUS_X} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%' }} />
      <Animated.View
        style={{
          flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 28 + insets.bottom, paddingTop: insets.top,
          opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.accent, marginBottom: 8, fontFamily: font.medium }}>
            Отдел кадров · Гильдия наёмников
          </Text>
          <Ornament width={180} />
        </View>
        <Text style={{ fontSize: 13.5, lineHeight: 21, color: colors.textMuted, textAlign: 'center', fontFamily: font.regular }}>
          Тебя наняли HR-директором гильдии наёмников — девять личных дел, зарплатная ведомость и подземелье, из которого не все возвращаются на работу в понедельник.
        </Text>
        {confirmNew ? (
          <View style={{ marginTop: 24, gap: 10 }}>
            <Text style={{ fontSize: 13, lineHeight: 19, color: colors.danger, textAlign: 'center', fontFamily: font.regular }}>
              Весь прогресс, герои и золото пропадут. Начать заново?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <SecondaryButton label="Отмена" onPress={() => setConfirmNew(false)} style={{ flex: 1 }} />
              <SecondaryButton label="Начать заново" onPress={startNew} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 24, gap: 10 }}>
            <PrimaryButton
              label={saved && !engine.needsDraft() ? 'Продолжить' : 'Приступить к обязанностям'}
              trailingIcon="arrow-right"
              onPress={() => engine.start()}
              height={54}
            />
            {saved && !engine.needsDraft() ? <Text style={{ fontSize: 11.5, color: colors.textDim, textAlign: 'center', fontFamily: font.regular }}>{progress}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              {saved ? <SecondaryButton label="Новая игра" onPress={() => setConfirmNew(true)} style={{ flex: 1 }} /> : null}
              <SecondaryButton label="Настройки" onPress={() => engine.go('settings')} style={{ flex: 1 }} />
            </View>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 }}>
          <Icon name="users-three" size={12} color={colors.textFaint} />
          <Text style={{ fontSize: 11, color: colors.textFaint, fontFamily: font.regular }}>Прототип · 9 личных дел</Text>
        </View>
      </Animated.View>
    </View>
  );
}
