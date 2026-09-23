import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { Icon } from '../components/Icon';
import { GhostLink, PrimaryButton } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';

export function WeeklyChallengeScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const vm = engine.weeklyChallengeVM();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 40 }}>
        <GhostLink label="Лагерь" icon="arrow-left" onPress={() => engine.go('home')} />
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, marginTop: 16, fontFamily: font.regular }}>Отдел кадров</Text>
        <Text style={{ fontSize: 30, fontFamily: font.medium, color: colors.text, marginTop: 4, marginBottom: 4, letterSpacing: -0.6 }}>Испытание недели</Text>
        <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 22, fontFamily: font.regular }}>
          Повторный контракт на уже зачищенного босса с особыми условиями — награда весомее, риск выше. Обновляется раз в неделю.
        </Text>

        {!vm.available ? (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular, textAlign: 'center' }}>
              Испытание откроется после первой победы над любым боссом — сюда возвращаются за добавкой, а не начинают путь.
            </Text>
          </View>
        ) : !vm.ready ? (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular, textAlign: 'center' }}>
              Соберите отряд из пяти бойцов, прежде чем принимать испытание.
            </Text>
          </View>
        ) : (
          <View style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 16, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(209,104,92,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="skull" size={18} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>{vm.locationName}</Text>
                <Text style={{ fontSize: 15, fontFamily: font.medium, color: colors.text, marginTop: 2 }}>{vm.bossName}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12, color: colors.textDim, marginBottom: 8, fontFamily: font.regular }}>{vm.dungeonName}</Text>

            <View style={{ borderWidth: 1, borderColor: colors.warn, borderRadius: 8, padding: 12, marginBottom: 14, backgroundColor: 'rgba(201,176,109,0.1)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Icon name="chart-line-up" size={13} color={colors.warn} />
                <Text style={{ fontSize: 12.5, fontFamily: font.medium, color: colors.warn }}>{vm.modifierName}</Text>
              </View>
              <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textMuted, fontFamily: font.regular }}>{vm.modifierDesc}</Text>
            </View>

            {vm.claimed ? (
              <View style={{ height: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular }}>Награда уже получена на этой неделе</Text>
              </View>
            ) : (
              <PrimaryButton label="Принять испытание" icon="sword" onPress={vm.onFight} />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
