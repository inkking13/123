import React from 'react';
import { View } from 'react-native';
import { colors } from '../theme/theme';

export function ProgressBar({
  pct, color, height = 4, trackColor = colors.border, radius,
}: { pct: number; color: string; height?: number; trackColor?: string; radius?: number }) {
  const r = radius ?? height / 2;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ height, borderRadius: r, backgroundColor: trackColor, overflow: 'hidden', width: '100%' }}>
      <View style={{ height: '100%', width: `${clamped}%`, backgroundColor: color, borderRadius: r }} />
    </View>
  );
}
