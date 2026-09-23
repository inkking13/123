import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { GEAR, SLOT_LABEL } from '../data/gear';
import { CURIOS } from '../data/curios';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { ItemIcon } from '../components/ItemIcon';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';

export function ResultsScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    entrance.setValue(0);
    Animated.timing(entrance, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [engine.result, entrance]);
  const insets = useSafeAreaInsets();
  const res = engine.result!;
  const s = engine.sim!;
  const isArena = engine.inArena;
  const dungeon = isArena ? null : engine.currentDungeon();
  const accent = res.win ? colors.accent : colors.danger;
  const kicker = isArena
    ? 'Арена'
    : res.win ? (res.isBoss ? dungeon!.name : `Комната ${engine.encIdx + 1} из ${dungeon!.encounters.length}`) : 'Поход окончен';
  const title = isArena ? (res.win ? 'Победа' : 'Поражение') : res.win ? (res.isBoss ? 'Победа' : 'Комната зачищена') : 'Вайп';
  const text = isArena
    ? (res.win ? 'Соперник повержен. Гильдия забирает свою долю и расходится.' : 'Не в этот раз — отряд отступает зализывать раны. Рейтинг слегка просел.')
    : res.win
      ? (res.isBoss ? 'Босс повержен. Раздели добычу, пока гильдия не разошлась.' : 'Отряд идёт дальше. Раны остаются с вами до конца похода.')
      : (res.isBoss ? 'Рейд не пережил этот пул. Чиним броню и пробуем снова.' : 'Отряд полёг ещё до трона. Придётся начать путь заново.');
  const primaryLabel = isArena ? 'Вернуться на арену' : res.win ? (res.isBoss ? 'Вернуться в лагерь' : 'Дальше') : 'Начать поход заново';
  const alive = s.raiders.filter((r) => r.alive);
  const curio = res.curioFound ? CURIOS.find((c) => c.name === res.curioFound) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 32, paddingHorizontal: 20, paddingBottom: Math.max(24, insets.bottom + 16) }}>
        <Animated.View
          style={{
            opacity: entrance,
            transform: [
              { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
              { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          }}
        >
          <View style={{ width: 34, height: 3, backgroundColor: accent, marginBottom: 16 }} />
          <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>{kicker}</Text>
          <Text style={{ fontSize: 34, fontFamily: font.medium, color: accent, marginTop: 6, marginBottom: 10, letterSpacing: -0.5 }}>{title}</Text>
          <Text style={{ fontSize: 13.5, lineHeight: 20, color: colors.textMuted, marginBottom: 22, fontFamily: font.regular }}>{text}</Text>
        </Animated.View>

        {s.raiders.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Avatar id={r.candidateId} size={30} radius={6} opacity={r.alive ? 1 : 0.35} />
            <Text style={{ fontSize: 13, flex: 1, color: r.alive ? colors.text : colors.borderHover, fontFamily: font.regular }}>{r.name}</Text>
            <Text style={{ fontSize: 11.5, color: colors.textDim, fontFamily: font.regular }}>
              {r.alive
                ? `${Math.max(0, Math.round((r.hp / r.maxHp) * 100))}% HP${res.win && !isArena ? ' · +' + (res.isBoss ? 40 : 15) + ' XP' : ''}`
                : 'погиб(ла)'}
            </Text>
          </View>
        ))}

        {res.goldFound > 0 ? (
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="coins" size={15} color={colors.warn} />
            <Text style={{ fontSize: 13, color: colors.warn, fontFamily: font.medium }}>+{res.goldFound} золота</Text>
          </View>
        ) : null}

        {isArena ? (
          <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="sword" size={15} color={res.win ? colors.good : colors.danger} />
            <Text style={{ fontSize: 13, color: res.win ? colors.good : colors.danger, fontFamily: font.medium }}>
              {res.win ? `+${engine.arenaOpponent?.ratingWin ?? 0}` : `-${engine.arenaOpponent?.ratingLoss ?? 0}`} рейтинга · сейчас {engine.arenaRating}
            </Text>
          </View>
        ) : null}

        {curio ? (
          <View style={{ marginTop: 22, borderWidth: 1, borderColor: colors.accent, borderRadius: 8, padding: 12, backgroundColor: colors.accentWash, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <ItemIcon id={curio.icon} size={52} radius={8} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.accentSoft, fontFamily: font.regular }}>Найдена реликвия</Text>
              <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.text, marginTop: 2 }}>{curio.name}</Text>
              <Text style={{ fontSize: 11.5, color: colors.textDim, marginTop: 3, lineHeight: 16, fontFamily: font.regular }}>{curio.desc}</Text>
            </View>
          </View>
        ) : null}

        {res.reagentFound ? (
          <View style={{ marginTop: 12, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 10, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <ItemIcon id={res.reagentFound.icon} size={32} radius={6} />
            <Text style={{ fontSize: 12.5, color: colors.textMuted, fontFamily: font.regular }}>
              +{res.reagentFound.qty} · {res.reagentFound.name}
            </Text>
          </View>
        ) : null}

        {res.loot.length > 0 ? (
          <View style={{ marginTop: 22 }}>
            <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 10, fontFamily: font.regular }}>Дележ добычи</Text>
            {res.loot.map((item, i) => {
              const assignedRaider = item.assigned !== null ? s.raiders.find((r) => r.id === item.assigned) : null;
              return (
                <View key={i} style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <ItemIcon id={GEAR[item.slot].find((o) => o.id === item.gearId)?.icon} size={40} radius={7} />
                    <View>
                      <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.accentSoft }}>{item.name}</Text>
                      <Text style={{ fontSize: 10.5, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textFaint, marginTop: 2, fontFamily: font.regular }}>{SLOT_LABEL[item.slot]}</Text>
                    </View>
                  </View>
                  {item.assigned !== null ? (
                    <Text style={{ fontSize: 12.5, color: colors.textDim, fontFamily: font.regular }}>Экипировано: {assignedRaider?.name}</Text>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {alive.map((r) => (
                        <Pressable
                          key={r.id}
                          onPress={() => engine.assignLoot(i, r.id)}
                          style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8 }}
                        >
                          <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: font.regular }}>{r.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={{ flex: 1, minHeight: 20 }} />
        <PrimaryButton label={primaryLabel} onPress={engine.resultPrimary} style={{ marginTop: 20 }} />
        {!res.win ? <SecondaryButton label="Сменить отряд" onPress={engine.resultSecondary} style={{ marginTop: 8 }} /> : null}
      </ScrollView>
    </View>
  );
}
