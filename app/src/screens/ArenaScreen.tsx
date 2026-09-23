import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { Icon } from '../components/Icon';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { TabBar, TAB_BAR_CONTENT_HEIGHT } from '../components/TabBar';
import { useEngineVersion } from '../engine/useEngine';

export function ArenaScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const vm = engine.arenaVM();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + 24 }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Отдел кадров</Text>
        <Text style={{ fontSize: 30, fontFamily: font.medium, color: colors.text, marginTop: 4, marginBottom: 4, letterSpacing: -0.6 }}>Арена</Text>
        <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 22, fontFamily: font.regular }}>
          Товарищеские поединки с соседними гильдиями — за рейтинг и золото. Никакого урона репутации при проигрыше.
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22 }}>
          <View style={{ flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 14, backgroundColor: colors.surface }}>
            <Text style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Рейтинг</Text>
            <Text style={{ fontSize: 22, fontFamily: font.medium, color: colors.accent, marginTop: 4 }}>{vm.rating}</Text>
            <Text style={{ fontSize: 11.5, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>{vm.rank}</Text>
          </View>
          <View style={{ flex: 1, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 14, backgroundColor: colors.surface }}>
            <Text style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Счёт</Text>
            <Text style={{ fontSize: 22, fontFamily: font.medium, color: colors.text, marginTop: 4 }}>{vm.wins}—{vm.losses}</Text>
            <Text style={{ fontSize: 11.5, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>побед—поражений</Text>
          </View>
        </View>

        {!vm.ready ? (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular, textAlign: 'center' }}>
              Соберите отряд из пяти бойцов, прежде чем выходить на арену.
            </Text>
          </View>
        ) : vm.opponent ? (
          <View style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 16, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(209,104,92,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="sword" size={18} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Соперник</Text>
                <Text style={{ fontSize: 15, fontFamily: font.medium, color: colors.text, marginTop: 2 }}>{vm.opponent.name}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 12.5, color: colors.textDim, marginBottom: 4, fontFamily: font.regular }}>Прочность отряда: {vm.opponent.hp} HP</Text>
            <Text style={{ fontSize: 12.5, color: colors.warn, fontFamily: font.regular }}>Награда за победу: +{vm.opponent.goldReward} золота, +{vm.opponent.ratingWin} рейтинга</Text>

            <PrimaryButton label="Начать бой" icon="sword" onPress={vm.onFight} style={{ marginTop: 16 }} />
            <SecondaryButton label="Найти другого соперника" onPress={vm.onReroll} style={{ marginTop: 8 }} />
          </View>
        ) : null}
      </ScrollView>
      <TabBar engine={engine} />
    </View>
  );
}
