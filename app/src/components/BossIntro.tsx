import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font } from '../theme/theme';

// Title card for a boss fight: the place, the boss's name in large letters
// and its description, over darkened edges while the 3D camera circles the
// boss. Closes itself after a few seconds, or on a tap.

export const BOSS_INTRO_MS = 3600;

export function BossIntro({ name, place, line, onDone }: { name: string; place: string; line: string; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    Animated.timing(out, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => onDone());
  };
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const id = setTimeout(finish, BOSS_INTRO_MS);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const nameScale = t.interpolate({ inputRange: [0, 1], outputRange: [1.18, 1] });
  const rise = t.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const lineOpacity = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: out, zIndex: 50 }}>
      <Pressable testID="boss-intro" onPress={finish} style={{ flex: 1 }}>
        <LinearGradient colors={['rgba(8,6,12,0.92)', 'rgba(8,6,12,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%' }} />
        <LinearGradient colors={['rgba(8,6,12,0)', 'rgba(8,6,12,0.94)']} locations={[0, 0.45]} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '52%' }} />
        <View style={{ position: 'absolute', left: 24, right: 24, bottom: '14%', alignItems: 'center' }}>
          <Animated.Text style={{ opacity: t, transform: [{ translateY: rise }], fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: colors.danger, fontFamily: font.medium, textAlign: 'center' }}>
            {place}
          </Animated.Text>
          <View style={{ width: 46, height: 2, backgroundColor: colors.danger, marginVertical: 12, opacity: 0.8 }} />
          <Animated.Text
            numberOfLines={2}
            style={{
              opacity: t, transform: [{ scale: nameScale }],
              fontSize: 36, lineHeight: 40, letterSpacing: 0.5, color: '#f4e6d4', fontFamily: font.bold, textAlign: 'center',
              textShadowColor: 'rgba(200,40,30,0.55)', textShadowRadius: 18,
            }}
          >
            {name}
          </Animated.Text>
          <Animated.Text style={{ opacity: lineOpacity, marginTop: 14, fontSize: 13.5, lineHeight: 20, color: colors.textMuted, fontFamily: font.regular, fontStyle: 'italic', textAlign: 'center', maxWidth: 320 }}>
            {line}
          </Animated.Text>
          <Text style={{ marginTop: 22, fontSize: 11, color: colors.textFaint, fontFamily: font.regular }}>Нажмите, чтобы начать бой</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
