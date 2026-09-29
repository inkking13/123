import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { font } from '../theme/theme';

// The game's panel: a dark gradient plate in a thin bronze rim with brighter
// gold corners, like the trim on the equipment screen. Every camp card,
// tile and button sits in one so the menus read as one set.

export type FrameTone = 'plain' | 'gold' | 'muted';

const TONES: Record<FrameTone, { rim: string; corner: string; fill: [string, string] }> = {
  plain: { rim: '#4a4032', corner: '#b39462', fill: ['rgba(34,30,26,0.94)', 'rgba(18,16,20,0.94)'] },
  gold: { rim: '#8a7650', corner: '#e9c97f', fill: ['#3d2c1a', '#1c150f'] },
  muted: { rim: '#2e2923', corner: '#5a4d3a', fill: ['rgba(22,20,20,0.7)', 'rgba(14,13,16,0.7)'] },
};

/** Four small L-shaped gold corners over a frame's rim. */
export function Corners({ color, size = 9, inset = -1 }: { color: string; size?: number; inset?: number }) {
  const s = { position: 'absolute' as const, width: size, height: size, borderColor: color };
  return (
    <>
      <View pointerEvents="none" style={[s, { top: inset, left: inset, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 3 }]} />
      <View pointerEvents="none" style={[s, { top: inset, right: inset, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 3 }]} />
      <View pointerEvents="none" style={[s, { bottom: inset, left: inset, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 3 }]} />
      <View pointerEvents="none" style={[s, { bottom: inset, right: inset, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 3 }]} />
    </>
  );
}

export function Frame({ children, tone = 'plain', pressed, style, contentStyle }: {
  children?: React.ReactNode; tone?: FrameTone; pressed?: boolean;
  style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = TONES[tone];
  return (
    <View style={[{ borderWidth: 1, borderColor: pressed ? t.corner : t.rim, borderRadius: 6 }, style]}>
      <LinearGradient colors={t.fill} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={[{ borderRadius: 5, overflow: 'hidden' }, contentStyle]}>
        {/* A faint top highlight, as if the plate catches the fire. */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 1, backgroundColor: 'rgba(255,225,170,0.10)' }} />
        {children}
      </LinearGradient>
      <Corners color={t.corner} />
    </View>
  );
}

/** A thin gold rule with a diamond in the middle, to set off a heading. */
export function Ornament({ width = 120, color = '#8a7650' }: { width?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', width }}>
      <LinearGradient colors={['rgba(138,118,80,0)', color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
      <View style={{ width: 6, height: 6, marginHorizontal: 5, transform: [{ rotate: '45deg' }], borderWidth: 1, borderColor: color, backgroundColor: 'rgba(138,118,80,0.3)' }} />
      <LinearGradient colors={[color, 'rgba(138,118,80,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
    </View>
  );
}

/** A screen's big heading, lit like the camp's, with the ornament rule under it. */
export function ScreenTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={{ fontSize: 28, fontFamily: font.semibold, color: '#f4e9cf', letterSpacing: -0.5, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 8 }}>{children}</Text>
      <Ornament width={110} />
    </View>
  );
}
