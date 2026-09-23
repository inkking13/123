import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { colors } from '../theme/theme';

export function ProgressBar({
  pct, color, height = 4, trackColor = colors.border, radius,
}: { pct: number; color: string; height?: number; trackColor?: string; radius?: number }) {
  const r = radius ?? height / 2;
  const clamped = Math.max(0, Math.min(100, pct));
  const anim = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: clamped, duration: 320, useNativeDriver: false }).start();
  }, [clamped, anim]);

  return (
    <View style={{ height, borderRadius: r, backgroundColor: trackColor, overflow: 'hidden', width: '100%' }}>
      <Animated.View
        style={{
          height: '100%',
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          backgroundColor: color,
          borderRadius: r,
        }}
      />
    </View>
  );
}
