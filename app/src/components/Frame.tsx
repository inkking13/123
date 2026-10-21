import React from 'react';
import { ImageBackground, StyleProp, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { font, ink } from '../theme/theme';

// The game's panel: a dark leather plate in a thin tooled rim, with a cream
// hairline set inside it and small ochre corners, like a ledger's binding.
// Every camp card, tile and button sits in one so the menus read as one set.
// Documents (contracts, letters, notices) go on a Parchment sheet instead.

export type FrameTone = 'plain' | 'gold' | 'muted';

const TONES: Record<FrameTone, { rim: string; corner: string; fill: [string, string] }> = {
  plain: { rim: '#4d3b29', corner: '#b8935c', fill: ['rgba(40,30,21,0.95)', 'rgba(19,14,10,0.95)'] },
  gold: { rim: '#8f6f45', corner: '#e6c27f', fill: ['#432d17', '#1d140b'] },
  muted: { rim: '#2f251b', corner: '#5c4a35', fill: ['rgba(26,20,15,0.72)', 'rgba(14,11,8,0.72)'] },
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
        {/* The tooled line pressed in just inside the rim. */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderRadius: 3, borderWidth: 1, borderColor: tone === 'muted' ? 'rgba(236,217,176,0.06)' : 'rgba(236,217,176,0.13)' }} />
        {children}
      </LinearGradient>
      <Corners color={t.corner} />
    </View>
  );
}

/** A thin gold rule with a diamond in the middle, to set off a heading. */
export function Ornament({ width = 120, color = '#8f6f45' }: { width?: number; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', width }}>
      <LinearGradient colors={['rgba(138,118,80,0)', color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
      <View style={{ width: 6, height: 6, marginHorizontal: 5, transform: [{ rotate: '45deg' }], borderWidth: 1, borderColor: color, backgroundColor: 'rgba(138,118,80,0.3)' }} />
      <LinearGradient colors={[color, 'rgba(138,118,80,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, height: 1 }} />
    </View>
  );
}

/** A screen's big heading in inked small capitals, with the ornament rule under it. */
export function ScreenTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={{ fontSize: 30, fontFamily: font.title, color: '#f1e4c6', letterSpacing: 0.4, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 8 }}>{children}</Text>
      <Ornament width={120} />
    </View>
  );
}

export const PAPER = require('../../assets/ui/parchment.jpg');

/** A sheet of parchment with browned edges: write on it with the `ink` colours. */
export function Parchment({ children, style, contentStyle, pressed }: {
  children?: React.ReactNode; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; pressed?: boolean;
}) {
  return (
    <View style={[{ borderRadius: 3, shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 5 }, style]}>
      <ImageBackground source={PAPER} resizeMode="stretch" imageStyle={{ borderRadius: 3, opacity: pressed ? 0.85 : 1 }} style={[{ borderRadius: 3, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 14 }, contentStyle]}>
        {children}
      </ImageBackground>
    </View>
  );
}

/** A red wax seal, for a sheet's mark or a call to action pressed onto paper. */
export function WaxSeal({ size = 34, children }: { size?: number; children?: React.ReactNode }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, padding: 2, backgroundColor: ink.waxDark, transform: [{ rotate: '-8deg' }] }}>
      <LinearGradient colors={['#b8402f', ink.wax, ink.waxDark]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,190,160,0.25)' }}>
        {children}
      </LinearGradient>
    </View>
  );
}

/** A heading set in ink on parchment, with a hand-drawn rule under it. */
export function InkHeading({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginBottom: 8 }, style]}>
      <Text style={{ fontFamily: font.title, fontSize: 19, color: ink.text, letterSpacing: 0.3 }}>{children}</Text>
      <View style={{ height: 1, marginTop: 3, backgroundColor: ink.rule, width: '70%' }} />
    </View>
  );
}
