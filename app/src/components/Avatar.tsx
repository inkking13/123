import React from 'react';
import { Image, Text, View, StyleProp, ViewStyle } from 'react-native';
import { portraitSource, portraitFallback } from '../data/portraits';
import { colors, font } from '../theme/theme';

export function Avatar({
  id, size, radius = 8, opacity = 1, grayscale = false, style,
}: {
  id: number;
  size: number;
  radius?: number;
  opacity?: number;
  grayscale?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const source = portraitSource(id);
  const fallback = !source ? portraitFallback(id) : null;
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.surface, opacity }, style]}>
      {source ? (
        <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : fallback ? (
        <View style={{ width: '100%', height: '100%', backgroundColor: fallback.color, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: size * 0.42, color: 'rgba(0,0,0,0.55)', fontFamily: font.medium }}>{fallback.letter}</Text>
        </View>
      ) : null}
      {grayscale ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bgAlt, opacity: 0.55 }} />
      ) : null}
    </View>
  );
}
