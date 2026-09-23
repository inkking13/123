import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { GhostLink } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';

export function ProfessionScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const cc = engine.pool.find((c) => c.id === engine.charId) || engine.pool[0];
  const vm = engine.professionVM(cc);

  if (!vm) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20 }}>
          <GhostLink label="Назад" icon="arrow-left" onPress={() => engine.go('char')} />
          <Text style={{ fontSize: 13, color: colors.textFaint, marginTop: 20, fontFamily: font.regular }}>
            У {cc.name} ещё нет профессии — выберите её на экране персонажа.
          </Text>
        </ScrollView>
      </View>
    );
  }

  const xpPct = vm.atMax ? 100 : (vm.xp / vm.xpPerLevel) * 100;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 40 }}>
        <GhostLink label={cc.name} icon="arrow-left" onPress={() => engine.go('char')} />
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, marginTop: 16, fontFamily: font.regular }}>Прокачка профессии</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 4 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(145,132,217,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={vm.icon} size={20} color={colors.accent} />
          </View>
          <Text style={{ fontSize: 28, fontFamily: font.medium, color: colors.text, letterSpacing: -0.5 }}>{vm.name}</Text>
        </View>
        <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 22, fontFamily: font.regular }}>{vm.desc}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: font.regular }}>
            Мастерство {vm.level}/{vm.maxLevel}{vm.atMax ? ' (предел)' : ''}
          </Text>
          <View style={{ flex: 1 }}>
            <ProgressBar pct={xpPct} color={colors.accent} height={4} />
          </View>
          <Text style={{ fontSize: 11, color: colors.textFaint, fontFamily: font.regular }}>
            {vm.atMax ? 'макс.' : `${vm.xp}/${vm.xpPerLevel}`}
          </Text>
        </View>

        <View style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 14, marginTop: 16, marginBottom: 14, backgroundColor: colors.surface }}>
          <Text style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.textFaint, marginBottom: 8, fontFamily: font.regular }}>Текущий бонус</Text>
          {vm.currentBonusLines.map((line, i) => (
            <Text key={i} style={{ fontSize: 13, color: colors.accentSoft, fontFamily: font.medium, marginBottom: 3 }}>{line}</Text>
          ))}
        </View>

        {vm.nextBonusLines ? (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 14, marginBottom: 22 }}>
            <Text style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.textFaint, marginBottom: 8, fontFamily: font.regular }}>На следующем уровне</Text>
            {vm.nextBonusLines.map((line, i) => (
              <Text key={i} style={{ fontSize: 13, color: colors.textMuted, fontFamily: font.regular, marginBottom: 3 }}>{line}</Text>
            ))}
          </View>
        ) : (
          <View style={{ borderWidth: 1, borderColor: colors.good, borderRadius: 8, padding: 14, marginBottom: 22, backgroundColor: 'rgba(122,168,116,0.1)' }}>
            <Text style={{ fontSize: 13, color: colors.good, fontFamily: font.medium }}>Мастерство достигло предела — дальше тренироваться некуда.</Text>
          </View>
        )}

        {!vm.atMax ? (
          <>
            <Pressable
              onPress={vm.onTrain}
              disabled={!vm.canAffordTrain}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                height: 50, borderRadius: 8, borderWidth: 1,
                borderColor: vm.canAffordTrain ? colors.accent : colors.border,
                backgroundColor: vm.canAffordTrain ? 'transparent' : 'transparent',
                opacity: vm.canAffordTrain ? 1 : 0.45,
              }}
            >
              <Icon name="coins" size={16} color={colors.warn} />
              <Text style={{ fontSize: 15, fontFamily: font.medium, color: colors.accentSoft }}>
                Тренироваться · {vm.trainCost} золота
              </Text>
            </Pressable>
            {!vm.canAffordTrain ? (
              <Text style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 8, textAlign: 'center', fontFamily: font.regular }}>
                Не хватает золота на тренировку.
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
