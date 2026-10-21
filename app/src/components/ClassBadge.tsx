import React from 'react';
import { Text, View } from 'react-native';
import { HERO_CLASSES, HeroClassId } from '../data/heroClasses';
import { colors, font } from '../theme/theme';
import { Icon } from './Icon';
import { Corners } from './Frame';

/** The class's icon and name in its colour, for a line under a hero's name. */
export function ClassBadge({ id }: { id: HeroClassId }) {
  const c = HERO_CLASSES[id];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={c.icon} size={12} color={c.color} />
      <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.color, fontFamily: font.semibold }}>{c.name}</Text>
    </View>
  );
}

/** What the class does in a fight: its always-on trait and its valor move. */
export function ClassCard({ id }: { id: HeroClassId }) {
  const c = HERO_CLASSES[id];
  return (
    <View style={{ borderWidth: 1, borderColor: c.color + '88', borderRadius: 8, padding: 12, marginBottom: 10, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.color, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <Icon name={c.icon} size={22} color={c.color} weight="fill" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.medium }}>Класс</Text>
          <Text style={{ fontSize: 20, color: c.color, fontFamily: font.title }}>{c.name}</Text>
        </View>
      </View>
      <View>
        <Text style={{ fontSize: 13.5, color: colors.accentSoft, fontFamily: font.semibold }}>{c.passiveName}</Text>
        <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textDim, fontFamily: font.regular }}>{c.passive}</Text>
      </View>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13.5, color: '#f0c46a', fontFamily: font.semibold }}>{c.valorName}</Text>
          <View style={{ flexDirection: 'row', gap: 4, marginLeft: 2 }}>
            {Array.from({ length: c.valorCost }).map((_, i) => (
              <View key={i} style={{ width: 7, height: 7, transform: [{ rotate: '45deg' }], backgroundColor: '#f0c46a' }} />
            ))}
          </View>
        </View>
        <Text style={{ fontSize: 13, lineHeight: 18, color: colors.textDim, fontFamily: font.regular }}>Приём доблести: {c.valorDesc}</Text>
      </View>
      <Corners color={c.color} />
    </View>
  );
}
