import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { Avatar } from '../components/Avatar';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';
import { SIGNATURE_INFO } from '../data/dungeons';

export function DungeonScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const dungeon = engine.currentDungeon();
  const enc = dungeon.encounters[engine.encIdx];
  const chosen = engine.squad();
  const canGoBackToGear = engine.encIdx === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 16, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', gap: 4, marginBottom: 20 }}>
          {dungeon.encounters.map((e, i) => (
            <View key={e.name} style={{ flex: 1 }}>
              <View style={{
                height: 3, borderRadius: 2,
                backgroundColor: i < engine.encIdx ? colors.borderHover : i === engine.encIdx ? colors.accent : colors.border,
              }} />
              <Text style={{ fontSize: 9.5, marginTop: 6, letterSpacing: 0.4, color: i === engine.encIdx ? colors.accentSoft : colors.borderHover, fontFamily: font.regular }}>
                {e.type === 'boss' ? 'Трон' : `${i + 1}. ${e.name}`}
              </Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>{dungeon.name}</Text>
        <Text style={{ fontSize: 28, fontFamily: font.medium, color: colors.text, marginTop: 4, marginBottom: 8, letterSpacing: -0.5 }}>{enc.name}</Text>
        <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textMuted, marginBottom: 18, fontFamily: font.regular }}>{enc.desc}</Text>

        <View style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 14, marginBottom: 18, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontFamily: font.medium, color: colors.danger }}>{enc.enemyName}</Text>
            <Text style={{ fontSize: 12, color: colors.textDim, fontFamily: font.regular }}>HP {enc.hp}</Text>
          </View>
          {enc.type === 'boss' && dungeon.signature ? (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.warn, fontFamily: font.medium }}>
                Особый приём · {SIGNATURE_INFO[dungeon.signature].name}
              </Text>
              <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textMuted, marginTop: 4, fontFamily: font.regular }}>{SIGNATURE_INFO[dungeon.signature].desc}</Text>
            </View>
          ) : null}
        </View>

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 10, fontFamily: font.regular }}>Состояние отряда</Text>
        {chosen.map((c) => {
          const r = engine.sim ? engine.sim.raiders.find((x) => x.candidateId === c.id) : null;
          const pct = r ? Math.max(0, Math.round((r.hp / r.maxHp) * 100)) : 100;
          const isAlive = r ? r.alive : true;
          const barColor = pct > 60 ? colors.good : pct > 30 ? colors.warn : colors.danger;
          return (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <Avatar id={c.id} size={30} radius={6} opacity={isAlive ? 1 : 0.35} />
              <Text style={{ fontSize: 13, width: 86, color: isAlive ? colors.text : colors.borderHover, fontFamily: font.regular }}>{c.name}</Text>
              <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${isAlive ? pct : 0}%`, backgroundColor: barColor }} />
              </View>
              <Text style={{ fontSize: 11, color: colors.textFaint, width: 38, textAlign: 'right', fontFamily: font.regular }}>{isAlive ? pct : 0}%</Text>
            </View>
          );
        })}
        <Text style={{ marginTop: 16, fontSize: 12.5, color: colors.textFaint, lineHeight: 19, fontStyle: 'italic', fontFamily: font.regular }}>
          {engine.encIdx === 0 ? `Отряд входит в «${dungeon.name}».` : 'Раны прошлой схватки никуда не делись — отряд идёт дальше потрёпанным.'}
        </Text>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <LinearGradient colors={['rgba(22,24,38,0)', colors.bg]} style={{ height: 30 }} />
        <View style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 4, paddingBottom: Math.max(20, insets.bottom + 12) }}>
          {canGoBackToGear ? <SecondaryButton label="Назад" onPress={() => engine.go('gear')} /> : null}
          <PrimaryButton
            label={enc.type === 'boss' ? 'В тронный зал' : 'Войти в бой'}
            icon={enc.type === 'boss' ? 'crown-simple' : 'sword'}
            onPress={engine.startEncounter}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}
