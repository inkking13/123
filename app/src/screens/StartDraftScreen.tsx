import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GameEngine } from '../engine/GameEngine';
import { colors, font, roleColor, roleName } from '../theme/theme';
import { PrimaryButton } from '../components/Buttons';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { Corners, Frame, ScreenTitle } from '../components/Frame';
import { TRAITS } from '../data/traits';
import { DRAFT_BUDGET, DRAFT_SIZE } from '../data/characters';
import { Role } from '../data/types';

// A new guild's first day: the budget buys five of the nine heroes on offer.
// Everyone can't be had — the strong ones cost more — and a party needs a
// tank and a healer. Whoever isn't picked waits on the hiring market.

const ROLES: { role: Role; title: string; hint: string }[] = [
  { role: 'tank', title: 'Танки', hint: 'Держат удар на себе. Нужен хотя бы один.' },
  { role: 'heal', title: 'Хилеры', hint: 'Лечат отряд. Без хилера поход закончится в первой комнате.' },
  { role: 'dps', title: 'Бойцы', hint: 'Наносят урон — чем больше, тем быстрее бой.' },
];

export function StartDraftScreen({ engine }: { engine: GameEngine }) {
  const insets = useSafeAreaInsets();
  const [picks, setPicks] = useState<number[]>([]);
  const heroes = engine.draftOptions();
  const byId = new Map(heroes.map((h) => [h.id, h]));
  const spent = picks.reduce((a, id) => a + (byId.get(id)?.hireCost ?? 0), 0);
  const left = DRAFT_BUDGET - spent;
  const problem = engine.draftProblem(picks);
  const toggle = (id: number) => setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= DRAFT_SIZE ? p : [...p, id]));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 190 + insets.bottom }}>
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.accent, fontFamily: font.medium }}>Отдел кадров · первый день</Text>
        <ScreenTitle style={{ marginTop: 4, marginBottom: 10 }}>Набор отряда</ScreenTitle>
        <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textMuted, marginBottom: 20, fontFamily: font.regular }}>
          Гильдия выделила {DRAFT_BUDGET} золота на первых сотрудников. Наймите пятерых — всех сильных бюджет не потянет. Остаток уйдёт в казну, остальные соискатели подождут на рынке труда.
        </Text>

        {ROLES.map(({ role, title, hint }) => (
          <View key={role} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: roleColor[role] }} />
              <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#b39462', fontFamily: font.medium }}>{title}</Text>
            </View>
            <Text style={{ fontSize: 11.5, color: colors.textDim, marginBottom: 10, fontFamily: font.regular }}>{hint}</Text>
            {heroes.filter((h) => h.role === role).map((h) => {
              const on = picks.includes(h.id);
              const cost = h.hireCost ?? 0;
              const blocked = !on && (cost > left || picks.length >= DRAFT_SIZE);
              return (
                <Pressable key={h.id} testID={'draft-' + h.id} onPress={() => !blocked && toggle(h.id)} style={{ marginBottom: 10, opacity: blocked ? 0.5 : 1 }}>
                  <View style={{
                    borderWidth: 1, borderRadius: 6, padding: 12, flexDirection: 'row', gap: 12,
                    borderColor: on ? colors.accentBright : colors.borderStrong,
                    backgroundColor: on ? 'rgba(201,163,107,0.14)' : 'rgba(22,19,16,0.9)',
                  }}>
                    <Avatar id={h.id} size={64} radius={6} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 16, fontFamily: font.semibold, color: '#f4e9cf' }}>{h.name}</Text>
                          <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: font.regular }}>{h.epithet} · {roleName[h.role]} · {h.attackRange === 'melee' ? 'ближний бой' : 'дальний бой'}</Text>
                        </View>
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 9, borderRadius: 13, borderWidth: 1,
                          borderColor: on ? colors.accentBright : '#5e4d37', backgroundColor: on ? colors.accent : 'rgba(0,0,0,0.3)',
                        }}>
                          {on ? <Icon name="check" size={13} color={colors.bg} /> : <Icon name="coins" size={13} color="#f0d58a" weight="fill" />}
                          <Text style={{ fontSize: 13, fontFamily: font.semibold, color: on ? colors.bg : '#f0d58a' }}>{on ? 'В отряде' : cost}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 6, fontFamily: font.regular }}>
                        HP {h.hp} · {h.role === 'heal' ? `хил ${h.healPower}` : `урон ${h.dps}`}/с · ГС {h.gs}
                      </Text>
                      <Text style={{ fontSize: 11.5, color: colors.textDim, marginTop: 3, fontFamily: font.regular }}>
                        <Text style={{ color: '#d9c595', fontFamily: font.medium }}>{TRAITS[h.trait].label}.</Text> {TRAITS[h.trait].desc}
                      </Text>
                      <Text numberOfLines={2} style={{ fontSize: 11.5, lineHeight: 16, color: colors.textFaint, marginTop: 4, fontFamily: font.regular }}>{h.bio}</Text>
                    </View>
                  </View>
                  <Corners color={on ? '#f0d28e' : '#8a7650'} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* The five slots, what's left of the budget, and the contract to sign. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
        <LinearGradient colors={['rgba(14,12,16,0)', 'rgba(14,12,16,0.96)']} style={{ height: 24 }} />
        <Frame tone="plain" style={{ marginHorizontal: 12, marginBottom: 10 + insets.bottom }} contentStyle={{ padding: 12, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#b39462', fontFamily: font.medium }}>Отряд {picks.length}/{DRAFT_SIZE}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 12, color: colors.textDim, fontFamily: font.regular }}>Бюджет</Text>
              <Icon name="coins" size={14} color="#f0d58a" weight="fill" />
              <Text style={{ fontSize: 14, fontFamily: font.semibold, color: left < 0 ? colors.danger : '#f0d58a' }}>{left}</Text>
              <Text style={{ fontSize: 12, color: colors.textFaint, fontFamily: font.regular }}>/ {DRAFT_BUDGET}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Array.from({ length: DRAFT_SIZE }).map((_, i) => {
              const id = picks[i];
              const h = id != null ? byId.get(id) : undefined;
              return (
                <Pressable key={i} onPress={() => id != null && toggle(id)} style={{
                  flex: 1, aspectRatio: 1, borderRadius: 6, borderWidth: 1, overflow: 'hidden',
                  borderColor: h ? roleColor[h.role] : '#4a4032', borderStyle: h ? 'solid' : 'dashed',
                  alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
                }}>
                  {h ? <Avatar id={h.id} size={60} radius={0} style={{ width: '100%', height: '100%' }} /> : <Icon name="plus" size={16} color="#5e4d37" />}
                </Pressable>
              );
            })}
          </View>
          <PrimaryButton
            label={problem ?? `Подписать контракты · в казну ${left}`}
            icon={problem ? undefined : 'scroll'}
            disabled={!!problem}
            onPress={() => engine.finishDraft(picks)}
            height={48}
          />
        </Frame>
      </View>
    </View>
  );
}
