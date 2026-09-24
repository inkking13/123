import React from 'react';
import { Image, View, StyleProp, ViewStyle } from 'react-native';
import { portraitSource } from '../data/portraits';
import { colors } from '../theme/theme';

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
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.surface, opacity }, style]}>
      {source ? (
        <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : null}
      {grayscale ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bgAlt, opacity: 0.55 }} />
      ) : null}
    </View>
  );
}
