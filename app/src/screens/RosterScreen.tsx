import React, { useState } from 'react';
import { XP_PER_LEVEL, MAX_LEVEL } from '../data/characters';
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
import { Corners, ScreenTitle } from '../components/Frame';

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
  const [role, setRole] = useState<'tank' | 'heal' | 'dps' | null>(null);
  const shown = engine.pool.filter((c) => !role || c.role === role);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 16, paddingBottom: 210 }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.accent, fontFamily: font.medium }}>
          Личные дела · {engine.pool.length} в штате
        </Text>
        <ScreenTitle style={{ marginTop: 4 }}>Отряд</ScreenTitle>
        <Text style={{ fontSize: 13, color: colors.textDim, marginTop: 4, marginBottom: 18, fontFamily: font.regular }}>
          Выбери пятерых на смену. Без танка и хилера поход закончится в первой комнате.
        </Text>

        {/* The five on shift: tap one to send them home. */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {Array.from({ length: 5 }).map((_, i) => {
            const m = chosen[i];
            return (
              <Pressable key={i} onPress={() => m && engine.toggleSelect(m.id)} style={{ flex: 1, aspectRatio: 0.8, borderRadius: 6, borderWidth: 1, borderColor: m ? roleColor[m.role] : colors.border, borderStyle: m ? 'solid' : 'dashed', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgAlt }}>
                {m ? (
                  <>
                    <Avatar id={m.id} size={64} radius={0} style={{ width: '100%', height: '100%' }} />
                    <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' }} />
                    <Text numberOfLines={1} style={{ position: 'absolute', bottom: 4, left: 2, right: 2, textAlign: 'center', fontSize: 10, color: '#f0e6cc', fontFamily: font.medium }}>{m.name}</Text>
                  </>
                ) : <Text style={{ fontSize: 18, color: colors.textFaint }}>+</Text>}
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
          {([null, 'tank', 'heal', 'dps'] as const).map((r) => (
            <Pressable key={r ?? 'all'} onPress={() => setRole(r)} style={{ paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1, justifyContent: 'center', borderColor: role === r ? (r ? roleColor[r] : colors.accent) : colors.border, backgroundColor: role === r ? colors.accentWash : 'transparent' }}>
              <Text style={{ fontSize: 11.5, fontFamily: font.medium, color: role === r ? (r ? roleColor[r] : colors.accentSoft) : colors.textDim }}>{r ? roleName[r] : `Все (${engine.pool.length})`}</Text>
            </Pressable>
          ))}
        </View>

        {shown.map((c) => {
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
                backgroundColor: sel ? colors.accentWash : 'rgba(18,16,20,0.55)',
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
                  {c.level < MAX_LEVEL ? (
                    <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
                      <View style={{ height: '100%', width: `${Math.min(100, (c.xp / XP_PER_LEVEL) * 100)}%`, backgroundColor: colors.accent }} />
                    </View>
                  ) : null}
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
                testID={`open-char-${c.id}`}
                onPress={() => engine.openChar(c.id)}
                style={{ width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="scroll" size={17} color={colors.textDim} />
              </Pressable>
              <Corners color="#8a7650" />
            </View>
          );
        })}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom }}>
        <LinearGradient colors={['rgba(14,15,24,0)', 'rgba(14,15,24,0.97)']} style={{ height: 30 }} />
        <View style={{ backgroundColor: 'rgba(14,15,24,0.97)', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: font.regular }}>
              {engine.selected.size}/5 · Танк {tanks} · Хилер {heals} · ДПС {dps}
            </Text>
            <Text style={{ fontSize: 12, color: warnColor, fontFamily: font.regular }}>{warn}</Text>
          </View>
          {engine.isUnlocked('gear') ? (
            <PrimaryButton
              label="К снаряжению"
              icon="shield-chevron"
              disabled={!ready}
              onPress={() => { if (ready) engine.go('gear'); }}
            />
          ) : (
            <PrimaryButton
              label="В поход"
              icon="path"
              disabled={!ready}
              onPress={() => { if (ready) engine.goDungeon(); }}
            />
          )}
        </View>
      </View>

      <TabBar engine={engine} />
    </View>
  );
}
