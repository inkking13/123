import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, roleColor, roleName } from '../theme/theme';
import { GhostLink } from '../components/Buttons';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { useEngineVersion } from '../engine/useEngine';

export function HireScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const candidates = engine.hireVM();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <GhostLink label="Лагерь" icon="arrow-left" onPress={() => engine.go('home')} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="coins" size={16} color={colors.warn} />
            <Text style={{ fontSize: 15, fontFamily: font.medium, color: colors.warn }}>{engine.gold}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, marginTop: 10, fontFamily: font.regular }}>Отдел кадров</Text>
        <Text style={{ fontSize: 28, fontFamily: font.medium, color: colors.text, marginTop: 4, marginBottom: 14, letterSpacing: -0.5 }}>Найм героев</Text>
        <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 18, lineHeight: 19, fontFamily: font.regular }}>
          Соискатели с рынка труда. Найм — разовая трата из бюджета гильдии, дальше герой ведёт себя как обычный сотрудник.
        </Text>

        {candidates.length === 0 ? (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular, textAlign: 'center' }}>
              Рынок труда пуст — все соискатели уже наняты.
            </Text>
          </View>
        ) : (
          candidates.map((c) => (
            <View key={c.id} style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 14, marginBottom: 12, backgroundColor: colors.surface }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Avatar id={c.id} size={56} radius={8} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontFamily: font.medium, color: colors.text }}>{c.name}</Text>
                      <Text style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 1, fontFamily: font.regular }}>{c.epithet}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: font.regular }}>ГС {c.gs}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: roleColor[c.role] }} />
                    <Text style={{ fontSize: 11.5, color: colors.textMuted, fontFamily: font.regular }}>
                      {roleName[c.role]} · {c.attackRange === 'melee' ? 'ближний бой' : 'дальний бой'} · {c.role === 'heal' ? `хил ${c.healPower}` : `урон ${c.dps}`} · HP {c.hp}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textMuted, marginTop: 10, fontFamily: font.regular }}>{c.bio}</Text>
              <Pressable
                onPress={c.onHire}
                disabled={!c.affordable}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderWidth: 1, borderRadius: 8, height: 42, marginTop: 12,
                  borderColor: c.affordable ? colors.accent : colors.border,
                  backgroundColor: c.affordable ? colors.accentWash : 'transparent',
                  opacity: c.affordable ? 1 : 0.5,
                }}
              >
                <Icon name="coins" size={14} color={c.affordable ? colors.accentSoft : colors.textFaint} />
                <Text style={{ fontSize: 13.5, fontFamily: font.medium, color: c.affordable ? colors.accentSoft : colors.textFaint }}>
                  Нанять за {c.cost}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
