import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { GhostLink } from '../components/Buttons';
import { ItemIcon } from '../components/ItemIcon';
import { useEngineVersion } from '../engine/useEngine';
import { RARITY_COLOR } from '../data/gearInfo';

const RANK = ['unique', 'legendary', 'rare', 'magic', 'common'] as const;
const RARITY_NAME: Record<string, string> = { unique: 'Уникальные', legendary: 'Легендарные', rare: 'Редкие', magic: 'Магические', common: 'Обычные' };

function Chip({ label, active, color, onPress }: { label: string; active: boolean; color?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 10, height: 30, borderRadius: 15, borderWidth: 1, justifyContent: 'center', borderColor: active ? (color ?? colors.accent) : colors.border, backgroundColor: active ? colors.accentWash : 'transparent' }}>
      <Text style={{ fontSize: 11.5, fontFamily: font.medium, color: active ? (color ?? colors.accentSoft) : colors.textDim }}>{label}</Text>
    </Pressable>
  );
}

type Tab = 'gear' | 'curios' | 'reagents';

export function InventoryScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('gear');
  const [slot, setSlot] = useState<string | null>(null);
  const [rarity, setRarity] = useState<string | null>(null);
  const all = engine.inventoryVM();
  const slots = [...new Set(all.map((r) => r.slotLabel))];
  const rarities = RANK.filter((k) => all.some((r) => r.rarity === k));
  const rows = all
    .filter((r) => (!slot || r.slotLabel === slot) && (!rarity || r.rarity === rarity))
    .sort((a, b) => RANK.indexOf(a.rarity) - RANK.indexOf(b.rarity) || a.slotLabel.localeCompare(b.slotLabel) || a.name.localeCompare(b.name));
  const curios = engine.curioVM();
  const foundCount = curios.filter((c) => c.owned).length;
  const reagents = engine.reagentInventoryVM();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 40 }}>
        <GhostLink label="Лагерь" icon="arrow-left" onPress={() => engine.go('home')} />
        <Text style={{ fontSize: 28, fontFamily: font.medium, color: colors.text, marginTop: 10, marginBottom: 14, letterSpacing: -0.5 }}>Инвентарь</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {(['gear', 'reagents', 'curios'] as Tab[]).map((t) => (
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
                {t === 'gear' ? 'Снаряжение' : t === 'reagents' ? 'Материалы' : `Реликвии (${foundCount}/${curios.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'gear' ? (
          <>
            <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 12, fontFamily: font.regular }}>
              Общий склад гильдии. Предметы приходят с боссов — на всех может не хватить.
            </Text>
            {all.length ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
                  <Chip label={`Все (${all.length})`} active={!slot} onPress={() => setSlot(null)} />
                  {slots.map((sl) => <Chip key={sl} label={sl} active={slot === sl} onPress={() => setSlot(slot === sl ? null : sl)} />)}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 14 }}>
                  {rarities.map((k) => <Chip key={k} label={RARITY_NAME[k]} color={RARITY_COLOR[k]} active={rarity === k} onPress={() => setRarity(rarity === k ? null : k)} />)}
                </ScrollView>
              </>
            ) : null}
            {rows.length === 0 ? (
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular, textAlign: 'center' }}>
                  Склад пуст. Победите босса — добыча появится здесь.
                </Text>
              </View>
            ) : (
              rows.map((row) => (
                <View key={row.slot + row.name} style={{ borderWidth: 1, borderColor: colors.borderStrong, borderLeftWidth: 3, borderLeftColor: RARITY_COLOR[row.rarity], borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: colors.surface }}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <ItemIcon id={row.icon} size={44} radius={8} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>{row.slotLabel}</Text>
                      <Text style={{ fontSize: 15, fontFamily: font.medium, color: RARITY_COLOR[row.rarity], marginTop: 2 }}>{row.name}</Text>
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
        ) : tab === 'reagents' ? (
          <>
            <Text style={{ fontSize: 13, color: colors.textDim, marginBottom: 18, fontFamily: font.regular }}>
              Материалы для крафта — падают с врагов в подземельях, каждая земля даёт свой вид сырья.
            </Text>
            {reagents.length === 0 ? (
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular, textAlign: 'center' }}>
                  Материалов пока нет — они падают с побеждённых врагов в походах.
                </Text>
              </View>
            ) : (
              reagents.map((r) => (
                <View key={r.id} style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: colors.surface, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <ItemIcon id={r.icon} size={44} radius={8} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontFamily: font.medium, color: colors.text }}>{r.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 3, lineHeight: 17, fontFamily: font.regular }}>{r.desc}</Text>
                  </View>
                  <Text style={{ fontSize: 17, fontFamily: font.medium, color: colors.accentSoft }}>{r.owned}</Text>
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
