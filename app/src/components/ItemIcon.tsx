import React from 'react';
import { Image, View } from 'react-native';
import { ItemIconId, ITEM_ICONS } from '../data/itemIcons';
import { colors } from '../theme/theme';

// The source art is a square tile (painted icon + rune/skull frame). A small
// inset + rounded mask hides the occasional stray pixel row from the sheet's
// own layout without needing per-icon pixel-perfect crops.
export function ItemIcon({ id, size, radius = 8 }: { id?: ItemIconId; size: number; radius?: number }) {
  if (!id) {
    return <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.surface }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.bgAlt }}>
      <Image
        source={ITEM_ICONS[id]}
        style={{ width: '112%', height: '112%', marginLeft: '-6%', marginTop: '-6%' }}
        resizeMode="cover"
      />
    </View>
  );
}
