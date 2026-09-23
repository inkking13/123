import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { GhostLink } from '../components/Buttons';
import { ItemIcon } from '../components/ItemIcon';
import { useEngineVersion } from '../engine/useEngine';

type Tab = 'gear' | 'curios';

export function InventoryScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('gear');
  const rows = engine.inventoryVM();
  const curios = engine.curioVM();
  const foundCount = curios.filter((c) => c.owned).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 40 }}>
        <GhostLink label="Лагерь" icon="arrow-left" onPress={() => engine.go('home')} />
        <Text style={{ fontSize: 28, fontFamily: font.medium, color: colors.text, marginTop: 10, marginBottom: 14, letterSpacing: -0.5 }}>Инвентарь</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {(['gear', 'curios'] as Tab[]).map((t) => (
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
                {t === 'gear' ? 'Снаряжение' : `Реликвии (${foundCount}/${curios.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'gear' ? (
          <>
            <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 18, fontFamily: font.regular }}>
              Общий склад гильдии. Предметы приходят с боссов — на всех может не хватить.
            </Text>
            {rows.length === 0 ? (
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular, textAlign: 'center' }}>
                  Склад пуст. Победите босса — добыча появится здесь.
                </Text>
              </View>
            ) : (
              rows.map((row) => (
                <View key={row.slot + row.name} style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: colors.surface }}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <ItemIcon id={row.icon} size={44} radius={8} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>{row.slotLabel}</Text>
                      <Text style={{ fontSize: 15, fontFamily: font.medium, color: colors.text, marginTop: 2 }}>{row.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 3, lineHeight: 17, fontFamily: font.regular }}>{row.desc}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 17, fontFamily: font.medium, color: row.free > 0 ? colors.good : colors.textFaint }}>{row.free}</Text>
                      <Text style={{ fontSize: 10, color: colors.textFaint, fontFamily: font.regular }}>из {row.owned} своб.</Text>
                    </View>
                  </View>
                  {row.wornBy.length > 0 ? (
                    <Text style={{ fontSize: 11.5, color: colors.accentSoft, marginTop: 8, fontFamily: font.regular }}>
                      Носят: {row.wornBy.join(', ')}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 18, fontFamily: font.regular }}>
              Трофеи и диковины без боевой пользы — просто то, что стоит найти. Падают с любого боя.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: '2%' }}>
              {curios.map((c) => (
                <View key={c.id} style={{ width: '23.5%', marginBottom: 14, alignItems: 'center' }}>
                  {c.owned ? (
                    <ItemIcon id={c.icon} size={72} radius={10} />
                  ) : (
                    <View style={{ width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20, color: colors.textFaint }}>?</Text>
                    </View>
                  )}
                  <Text numberOfLines={2} style={{ fontSize: 10, textAlign: 'center', marginTop: 5, color: c.owned ? colors.textMuted : colors.textFaint, fontFamily: font.regular }}>
                    {c.owned ? c.name : 'Не найдено'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
