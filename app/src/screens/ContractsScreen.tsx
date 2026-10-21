import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, ink } from '../theme/theme';
import { Icon } from '../components/Icon';
import { BackLink } from '../components/Buttons';
import { TabBar, TAB_BAR_CONTENT_HEIGHT } from '../components/TabBar';
import { useEngineVersion } from '../engine/useEngine';
import { ScreenTitle } from '../components/Frame';
import { ContractNote } from '../components/ContractNote';

/** An inked action along the foot of a contract. */
function InkAction({ label, onPress, red, testID, disabled }: { label: string; onPress: () => void; red?: boolean; testID?: string; disabled?: boolean }) {
  return (
    <Pressable testID={testID} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ flex: 1, height: 40, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}>
      <Text style={{ fontSize: 16, color: red ? ink.red : ink.muted, fontFamily: red ? font.title : font.caps }}>{label}</Text>
      {red ? <Icon name="arrow-right" size={15} color={ink.red} /> : null}
    </Pressable>
  );
}

export function ContractsScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const active = engine.activeContractVM();
  const board = engine.contractBoardVM();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: TAB_BAR_CONTENT_HEIGHT + insets.bottom + 24 }}>
        <BackLink engine={engine} />
        <ScreenTitle style={{ marginTop: 14, marginBottom: 4 }}>Контракты</ScreenTitle>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textDim, marginBottom: 18, fontFamily: font.regular }}>
          Заказчики платят сверх добычи — если отряд одолеет хозяина логова на их условиях. Гильдия держит один контракт за раз. Выполнено: {engine.contractsDone}.
        </Text>

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.accent, marginBottom: 10, fontFamily: font.medium }}>Взятый контракт</Text>
        {active ? (
          <ContractNote c={active} sealed>
            <View style={{ height: 1, backgroundColor: ink.rule, marginTop: 12 }} />
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              <InkAction testID="contract-go" label="В поход" red onPress={() => engine.goContract()} />
              <View style={{ width: 1, marginVertical: 8, backgroundColor: ink.rule }} />
              <InkAction testID="contract-drop" label="Отказаться" onPress={() => engine.abandonContract()} />
            </View>
          </ContractNote>
        ) : (
          <Text style={{ fontSize: 14, color: colors.textFaint, fontFamily: font.italic, marginBottom: 18 }}>Пока ничего. Выберите работу на доске ниже.</Text>
        )}

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.accent, marginTop: 8, marginBottom: 10, fontFamily: font.medium }}>Доска заказов</Text>
        {board.map((c) => (
          <ContractNote key={c.id} c={c}>
            <View style={{ height: 1, backgroundColor: ink.rule, marginTop: 12 }} />
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              <InkAction testID={'contract-take-' + c.id} label={active ? 'Сначала закройте взятый' : 'Взять контракт'} red={!active} disabled={!!active} onPress={() => engine.acceptContract(c.id)} />
            </View>
          </ContractNote>
        ))}
      </ScrollView>
      <TabBar engine={engine} />
    </View>
  );
}
