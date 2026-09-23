import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, roleColor, roleName } from '../theme/theme';
import { TRAITS } from '../data/traits';
import { ABILITY_BY_CANDIDATE } from '../data/abilities';
import { MAX_LEVEL, XP_PER_LEVEL } from '../data/characters';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { ItemIcon } from '../components/ItemIcon';
import { ProgressBar } from '../components/ProgressBar';
import { useEngineVersion } from '../engine/useEngine';

export function CharacterScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const [confirmFire, setConfirmFire] = useState(false);
  const cc = engine.pool.find((c) => c.id === engine.charId) || engine.pool[0];
  const slots = engine.gearSlotsFor(cc);
  const atMax = cc.level >= MAX_LEVEL;
  const xpPct = atMax ? 100 : (cc.xp / XP_PER_LEVEL) * 100;
  const xpLabel = atMax ? 'макс.' : `${cc.xp}/${XP_PER_LEVEL}`;
  const stats = [
    { label: 'HP', value: String(cc.hp) },
    { label: cc.role === 'heal' ? 'Хил/с' : 'Урон/с', value: String(cc.role === 'heal' ? cc.healPower : cc.dps) },
    { label: 'ГС', value: String(cc.gs) },
  ];
  const ability = ABILITY_BY_CANDIDATE[cc.id];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView>
        <View style={{ height: 300 }}>
          <Avatar id={cc.id} size={402} radius={0} style={{ width: '100%', height: 300 }} />
          <LinearGradient
            colors={['rgba(22,24,38,0.55)', 'rgba(22,24,38,0.1)', colors.bg]}
            locations={[0, 0.45, 1]}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Pressable
            onPress={() => engine.go('roster')}
            style={{
              position: 'absolute', top: insets.top + 12, left: 16, width: 44, height: 44, borderRadius: 22,
              backgroundColor: 'rgba(22,24,38,0.6)', borderWidth: 1, borderColor: colors.borderStrong,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="arrow-left" size={18} color={colors.text} />
          </Pressable>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 12 }}>
            <Text style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: roleColor[cc.role], fontFamily: font.regular }}>
              {roleName[cc.role]} · {cc.epithet}
            </Text>
            <Text style={{ fontSize: 32, fontFamily: font.medium, color: colors.text, marginTop: 2, letterSpacing: -0.6 }}>{cc.name}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: font.regular }}>
              Уровень {cc.level}{atMax ? ' (макс.)' : ''}
            </Text>
            <View style={{ flex: 1 }}>
              <ProgressBar pct={xpPct} color={colors.accent} height={4} />
            </View>
            <Text style={{ fontSize: 11, color: colors.textFaint, fontFamily: font.regular }}>{xpLabel}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginVertical: 14 }}>
            {stats.map((s) => (
              <View key={s.label} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 }}>
                <Text style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>{s.label}</Text>
                <Text style={{ fontSize: 17, fontFamily: font.medium, color: colors.text, marginTop: 2 }}>{s.value}</Text>
              </View>
            ))}
          </View>

          <View style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: roleColor[cc.role] + '66', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              <Icon name={ability.icon} size={14} color={roleColor[cc.role]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontFamily: font.medium, color: colors.accentSoft }}>{ability.name}</Text>
              <Text style={{ fontSize: 12.5, color: colors.textDim, marginTop: 3, lineHeight: 18, fontFamily: font.regular }}>{ability.desc}</Text>
            </View>
          </View>

          <View style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, marginBottom: 18 }}>
            <Text style={{ fontSize: 12, fontFamily: font.medium, color: colors.accentSoft }}>{TRAITS[cc.trait].label}</Text>
            <Text style={{ fontSize: 12.5, color: colors.textDim, marginTop: 3, lineHeight: 18, fontFamily: font.regular }}>{TRAITS[cc.trait].desc}</Text>
          </View>

          <Text style={{ fontSize: 13.5, lineHeight: 22, color: colors.textMuted, marginBottom: 22, fontFamily: font.regular }}>{cc.story}</Text>

          <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 6, fontFamily: font.regular }}>Класс</Text>
          <Text style={{ fontSize: 11.5, color: colors.textFaint, marginBottom: 10, lineHeight: 16, fontFamily: font.regular }}>
            {cc.classId ? 'Выбор сделан навсегда — определяет базовый стиль боя.' : 'Выберите один раз, навсегда — определит базовый стиль боя.'}
          </Text>
          <View style={{ gap: 6, marginBottom: 18 }}>
            {engine.classOptionsVM(cc).map((o) => (
              <Pressable
                key={o.id}
                onPress={o.onPick}
                disabled={o.disabled}
                style={{
                  borderWidth: 1, borderRadius: 8, padding: 10,
                  borderColor: o.selected ? colors.accent : colors.borderStrong,
                  backgroundColor: o.selected ? colors.accentWash : 'transparent',
                  opacity: cc.classId && !o.selected ? 0.4 : 1,
                }}
              >
                <Text style={{ fontSize: 12.5, fontFamily: font.medium, color: o.selected ? colors.accentSoft : colors.text }}>{o.name}</Text>
                <Text style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 2, fontFamily: font.regular }}>{o.desc}</Text>
              </Pressable>
            ))}
          </View>

          {(() => {
            const tiers = engine.talentVM(cc);
            const learned = tiers.filter((t) => t.chosen).length;
            return (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>Дерево талантов</Text>
                  <Text style={{ fontSize: 11.5, color: colors.warn, fontFamily: font.medium }}>Изучено: {learned}/{tiers.length}</Text>
                </View>
                {tiers.map((tier, i) => {
                  const isLast = i === tiers.length - 1;
                  const prevChosen = i > 0 && tiers[i - 1].chosen;
                  return (
                    <View key={i} style={{ marginBottom: tier.unlocked ? 4 : 14 }}>
                      {!tier.unlocked ? (
                        <Text style={{ fontSize: 11, color: colors.textFaint, textAlign: 'center', marginBottom: 8, fontFamily: font.regular }}>
                          Открывается на уровне {tier.level}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {tier.options.map((o) => {
                          const learnedHere = o.selected;
                          const skipped = tier.chosen && !o.selected;
                          const nodeBg = learnedHere ? colors.warn : tier.unlocked ? colors.surface : colors.bgAlt;
                          const nodeBorder = learnedHere ? colors.warn : tier.unlocked ? colors.accent : colors.border;
                          const iconColor = learnedHere ? colors.bg : tier.unlocked ? colors.accentSoft : colors.borderHover;
                          const connectorAbove = prevChosen ? colors.good : colors.border;
                          const connectorBelow = tier.chosen ? colors.good : colors.border;
                          return (
                            <Pressable
                              key={o.id}
                              onPress={o.onPick}
                              disabled={o.disabled}
                              style={{ flex: 1, alignItems: 'center', opacity: skipped ? 0.35 : 1 }}
                            >
                              {i > 0 ? <View style={{ width: 2, height: 12, backgroundColor: connectorAbove }} /> : null}
                              <View
                                style={{
                                  width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                                  backgroundColor: nodeBg, borderWidth: 2.5, borderColor: nodeBorder,
                                }}
                              >
                                <Icon name={tier.unlocked ? (o.icon || 'target') : 'lock-simple'} size={22} color={iconColor} weight={learnedHere ? 'fill' : 'regular'} />
                              </View>
                              {!isLast ? <View style={{ width: 2, height: 12, backgroundColor: connectorBelow }} /> : null}
                              <Text numberOfLines={2} style={{ fontSize: 11, fontFamily: font.medium, color: learnedHere ? colors.warn : colors.text, textAlign: 'center', marginTop: 6 }}>
                                {o.name}
                              </Text>
                              <Text style={{ fontSize: 10, color: colors.textFaint, marginTop: 2, textAlign: 'center', lineHeight: 14, fontFamily: font.regular }}>
                                {o.desc}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </>
            );
          })()}

          <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 10, fontFamily: font.regular }}>Снаряжение</Text>
          {slots.map((slot) => (
            <View key={slot.label} style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, color: colors.textFaint, marginBottom: 6, fontFamily: font.regular }}>{slot.label}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {slot.options.map((o) => (
                  <Pressable
                    key={o.id}
                    onPress={o.onPick}
                    disabled={o.disabled}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      borderWidth: 1, borderColor: o.border, backgroundColor: o.bg, borderRadius: 8,
                      paddingHorizontal: 10, paddingVertical: 8, minHeight: 38, opacity: o.disabled ? 0.45 : 1,
                    }}
                  >
                    {o.icon ? <ItemIcon id={o.icon} size={28} radius={6} /> : null}
                    <View>
                      <Text style={{ fontSize: 12, color: o.color, fontFamily: font.regular }}>{o.name}</Text>
                      {o.stockLabel ? <Text style={{ fontSize: 9.5, color: colors.textFaint, marginTop: 1, fontFamily: font.regular }}>{o.stockLabel}</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 6, fontFamily: font.regular }}>{slot.desc}</Text>
            </View>
          ))}

          <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 10, marginTop: 8, fontFamily: font.regular }}>Кадровые решения</Text>
          {!engine.canFire() ? (
            <Text style={{ fontSize: 11.5, color: colors.textFaint, lineHeight: 16, fontFamily: font.regular }}>
              В штате минимум допустимых сотрудников — увольнять больше некого.
            </Text>
          ) : !confirmFire ? (
            <Pressable
              onPress={() => setConfirmFire(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center',
                borderWidth: 1, borderColor: colors.danger, borderRadius: 8, padding: 13,
              }}
            >
              <Icon name="trash-simple" size={16} color={colors.danger} />
              <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.danger }}>Уволить {cc.name}</Text>
            </Pressable>
          ) : (
            <View style={{ borderWidth: 1, borderColor: colors.danger, borderRadius: 8, padding: 14, backgroundColor: 'rgba(209,104,92,0.08)' }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                <Icon name="warning" size={18} color={colors.danger} />
                <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.textMuted, fontFamily: font.regular }}>
                  Это необратимо. {cc.name} покинет гильдию навсегда, а коллектив расстроится — небольшой удар по морали всех остальных.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setConfirmFire(false)}
                  style={{ flex: 1, height: 42, borderRadius: 7, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontFamily: font.medium, color: colors.textDim }}>Отмена</Text>
                </Pressable>
                <Pressable
                  onPress={() => { engine.fireCandidate(cc.id); setConfirmFire(false); engine.go('roster'); }}
                  style={{ flex: 1, height: 42, borderRadius: 7, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 13, fontFamily: font.medium, color: colors.bg }}>Точно уволить</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
