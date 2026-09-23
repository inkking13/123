import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { SLOT_LABEL } from '../data/gear';
import { GhostLink } from '../components/Buttons';
import { ItemIcon } from '../components/ItemIcon';
import { Icon } from '../components/Icon';
import { useEngineVersion } from '../engine/useEngine';

type Tab = 'buy' | 'sell';

export function ShopScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('buy');
  const buyRows = engine.shopBuyVM();
  const sellRows = engine.shopSellVM();

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
        <Text style={{ fontSize: 28, fontFamily: font.medium, color: colors.text, marginTop: 10, marginBottom: 14, letterSpacing: -0.5 }}>Отдел закупок</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {(['buy', 'sell'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1, height: 38, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
                borderColor: tab === t ? colors.accent : colors.borderStrong,
                backgroundColor: tab === t ? colors.accentWash : 'transparent',
              }}
            >
              <Text style={{ fontSize: 12.5, fontFamily: font.medium, color: tab === t ? colors.accentSoft : colors.textDim }}>
                {t === 'buy' ? 'Купить' : 'Продать'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'buy' ? (
          <>
            <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 18, fontFamily: font.regular }}>
              Купленный предмет уходит в общий склад гильдии — экипировать его можно на экране снаряжения.
            </Text>
            {buyRows.map((row) => (
              <View key={row.slot + row.id} style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: colors.surface, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <ItemIcon id={row.icon} size={44} radius={8} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>{SLOT_LABEL[row.slot]}</Text>
                  <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.text, marginTop: 2 }}>{row.name}</Text>
                  <Text style={{ fontSize: 11.5, color: colors.textDim, marginTop: 2, lineHeight: 16, fontFamily: font.regular }}>{row.desc}</Text>
                </View>
                <Pressable
                  onPress={row.onBuy}
                  disabled={!row.affordable}
                  style={{
                    borderWidth: 1, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
                    borderColor: row.affordable ? colors.accent : colors.border,
                    backgroundColor: row.affordable ? colors.accentWash : 'transparent',
                    opacity: row.affordable ? 1 : 0.5,
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: font.medium, color: row.affordable ? colors.accentSoft : colors.textFaint }}>{row.price}</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : (
          <>
            <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 18, fontFamily: font.regular }}>
              Продать можно только то, что сейчас не надето ни на ком. Цена — половина от стоимости покупки.
            </Text>
            {sellRows.length === 0 ? (
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular, textAlign: 'center' }}>
                  Нечего продавать — весь свободный инвентарь пуст.
                </Text>
              </View>
            ) : (
              sellRows.map((row) => (
                <View key={row.slot + row.id} style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: colors.surface, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <ItemIcon id={row.icon} size={44} radius={8} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>{SLOT_LABEL[row.slot]}</Text>
                    <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.text, marginTop: 2 }}>{row.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 2, fontFamily: font.regular }}>Свободно: {row.free}</Text>
                  </View>
                  <Pressable
                    onPress={row.onSell}
                    style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: font.medium, color: colors.textMuted }}>+{row.sellPrice}</Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
