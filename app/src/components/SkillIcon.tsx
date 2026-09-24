import React from 'react';
import { Image, View, ViewStyle } from 'react-native';
import { SKILL_ART, SkillArtId } from '../data/skillArt';

export function SkillIcon({ id, size, radius = 8, dim = false, style }: { id: SkillArtId; size: number; radius?: number; dim?: boolean; style?: ViewStyle }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }, style]}>
      <Image source={SKILL_ART[id]} style={{ width: size, height: size, opacity: dim ? 0.45 : 1 }} resizeMode="cover" />
    </View>
  );
}
