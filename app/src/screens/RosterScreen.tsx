import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, roleColor, roleName } from '../theme/theme';
import { TRAITS } from '../data/traits';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { PrimaryButton } from '../components/Buttons';
import { TabBar, TAB_BAR_CONTENT_HEIGHT } from '../components/TabBar';
import { useEngineVersion } from '../engine/useEngine';

export function RosterScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const ready = engine.squadReady();
  const chosen = engine.squad();
  const tanks = chosen.filter((c) => c.role === 'tank').length;
  const heals = chosen.filter((c) => c.role === 'heal').length;
  const dps = chosen.filter((c) => c.role === 'dps').length;
  const warn = !ready ? '' : tanks === 0 ? 'Нет танка' : heals === 0 ? 'Нет хилера' : 'Состав готов';
  const warnColor = ready && (tanks === 0 || heals === 0) ? colors.danger : colors.good;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 16, paddingBottom: 210 }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>
          Личные дела · {engine.pool.length} в штате
        </Text>
        <Text style={{ fontSize: 30, fontFamily: font.medium, color: colors.text, marginTop: 4, letterSpacing: -0.6 }}>Отряд</Text>
        <Text style={{ fontSize: 13, color: colors.textDim, marginTop: 4, marginBottom: 18, fontFamily: font.regular }}>
          Выбери пятерых на смену. Без танка и хилера поход закончится в первой комнате.
        </Text>

        {engine.pool.map((c) => {
          const sel = engine.selected.has(c.id);
          const stats = c.role === 'heal'
            ? `HP ${c.hp} · хил ${c.healPower}/с · ГС ${c.gs}`
            : `HP ${c.hp} · урон ${c.dps}/с · ГС ${c.gs}`;
          const trait = TRAITS[c.trait];
          const moraleColor = c.morale >= 60 ? colors.good : c.morale >= 30 ? colors.warn : colors.danger;
          return (
            <View
              key={c.id}
              style={{
                flexDirection: 'row', gap: 12, padding: 12, borderRadius: 8, marginBottom: 8,
                alignItems: 'flex-start', borderWidth: 1,
                borderColor: sel ? colors.accent : colors.border,
                backgroundColor: sel ? colors.accentWash : 'transparent',
              }}
            >
              <Pressable onPress={() => engine.toggleSelect(c.id)} style={{ position: 'relative' }}>
                <Avatar id={c.id} size={56} radius={8} />
                {sel ? (
                  <View style={{
                    position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10,
                    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="check" size={12} color={colors.bg} weight="fill" />
                  </View>
                ) : null}
              </Pressable>
              <Pressable onPress={() => engine.toggleSelect(c.id)} style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ fontSize: 15, fontFamily: font.medium, color: colors.text }}>{c.name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, color: colors.textFaint, fontFamily: font.regular, flexShrink: 1 }}>· {c.epithet}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
                  <Text style={{
                    fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: roleColor[c.role],
                    borderWidth: 1, borderColor: roleColor[c.role] + '55', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1,
                    fontFamily: font.regular,
                  }}>{roleName[c.role]}</Text>
                  <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: font.regular }}>Ур. {c.level}</Text>
                  <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: font.regular }}>{stats}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <Text style={{
                    fontSize: 10.5, color: colors.textMuted, borderWidth: 1, borderColor: colors.borderStrong,
                    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, fontFamily: font.regular,
                  }}>{trait.label}</Text>
                  <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${c.morale}%`, backgroundColor: moraleColor }} />
                  </View>
                  <Text style={{ fontSize: 10.5, color: colors.textFaint, fontFamily: font.regular }}>{c.morale}%</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => engine.openChar(c.id)}
                style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="scroll" size={17} color={colors.textDim} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom }}>
        <LinearGradient colors={['rgba(22,24,38,0)', colors.bg]} style={{ height: 30 }} />
        <View style={{ backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: font.regular }}>
              {engine.selected.size}/5 · Танк {tanks} · Хилер {heals} · ДПС {dps}
            </Text>
            <Text style={{ fontSize: 12, color: warnColor, fontFamily: font.regular }}>{warn}</Text>
          </View>
          <PrimaryButton
            label="К снаряжению"
            icon="shield-chevron"
            disabled={!ready}
            onPress={() => { if (ready) engine.go('gear'); }}
          />
        </View>
      </View>

      <TabBar engine={engine} />
    </View>
  );
}
