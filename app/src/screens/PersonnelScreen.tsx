import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine, PersonnelRosterEntry, DepartedEntry } from '../engine/GameEngine';
import { colors, font, roleColor, roleName } from '../theme/theme';
import { GhostLink } from '../components/Buttons';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { useEngineVersion } from '../engine/useEngine';

function RosterCard({ c }: { c: PersonnelRosterEntry }) {
  return (
    <View style={{
      flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: colors.border,
      borderRadius: 8, padding: 12, marginBottom: 10, backgroundColor: colors.surface,
    }}>
      <Avatar id={c.id} size={52} radius={8} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontFamily: font.medium, color: colors.text }}>{c.name}</Text>
            <Text style={{ fontSize: 11.5, color: colors.textFaint, fontFamily: font.regular, marginTop: 1 }}>{c.epithet}</Text>
          </View>
          <Text style={{ fontSize: 11, color: colors.textDim, fontFamily: font.regular }}>Ур. {c.level}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: roleColor[c.role] }} />
          <Text style={{ fontSize: 11.5, color: colors.textMuted, fontFamily: font.regular }}>
            {roleName[c.role]}{c.className ? ` · ${c.className}` : ''}{c.professionName ? ` · ${c.professionName}` : ''} · мораль {c.morale}%
          </Text>
        </View>
        <Text style={{ fontSize: 12, lineHeight: 17.5, color: colors.textMuted, marginTop: 8, fontFamily: font.regular }}>{c.story}</Text>
      </View>
    </View>
  );
}

function DepartedRow({ d }: { d: DepartedEntry }) {
  const fired = d.reason === 'fired';
  return (
    <View style={{
      borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12,
      marginBottom: 8, backgroundColor: 'transparent', opacity: 0.85,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.textMuted }}>{d.name}</Text>
          <Text style={{ fontSize: 11, color: colors.textFaint, fontFamily: font.regular, marginTop: 1 }}>{d.epithet} · {roleName[d.role]} · Ур. {d.level}</Text>
        </View>
        <View style={{
          borderWidth: 1, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3,
          borderColor: fired ? colors.danger : colors.warn,
        }}>
          <Text style={{ fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', color: fired ? colors.danger : colors.warn, fontFamily: font.regular }}>
            {fired ? 'Уволен(а)' : 'Ушёл(ушла) сам(а)'}
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textFaint, marginTop: 8, fontFamily: font.regular }}>{d.story}</Text>
    </View>
  );
}

export function PersonnelScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const vm = engine.personnelVM();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 40 }}>
        <GhostLink label="Лагерь" icon="arrow-left" onPress={() => engine.go('home')} />
        <Text style={{ fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textFaint, marginTop: 10, fontFamily: font.regular }}>Отдел кадров</Text>
        <Text style={{ fontSize: 28, fontFamily: font.medium, color: colors.text, marginTop: 4, marginBottom: 18, letterSpacing: -0.5 }}>Личные дела</Text>

        {(() => {
          const issues: { key: string; icon: 'warning' | 'coins'; text: string }[] = [];
          if (engine.strikeTrips > 0) issues.push({ key: 'strike', icon: 'warning', text: `Итальянская забастовка: −15% урона отряда ещё ${engine.strikeTrips} ${engine.strikeTrips === 1 ? 'поход' : 'похода'}.` });
          if (engine.feud) issues.push({ key: 'feud', icon: 'warning', text: `${engine.nameOf(engine.feud.a)} и ${engine.nameOf(engine.feud.b)} в ссоре: −10% урона обоим в одном отряде, ещё походов: ${engine.feud.trips}.` });
          const raises = Object.entries(engine.raises);
          if (raises.length) issues.push({ key: 'raises', icon: 'coins', text: 'Прибавки к окладу: ' + raises.map(([id, v]) => `${engine.nameOf(Number(id))} +${v}`).join(', ') + ' золота за поход.' });
          if (!issues.length) return null;
          return (
            <View testID="hr-issues" style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, marginBottom: 18, gap: 8, backgroundColor: colors.surface }}>
              <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>Открытые вопросы</Text>
              {issues.map((i) => (
                <View key={i.key} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Icon name={i.icon} size={14} color={i.icon === 'warning' ? colors.warn : colors.accentSoft} />
                  <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.textMuted, fontFamily: font.regular }}>{i.text}</Text>
                </View>
              ))}
            </View>
          );
        })()}
        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, marginBottom: 10, fontFamily: font.regular }}>
          Действующий состав ({vm.roster.length})
        </Text>
        {vm.roster.map((c) => <RosterCard key={c.id} c={c} />)}

        <View style={{ height: 12 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Icon name="scroll" size={13} color={colors.textDim} />
          <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textDim, fontFamily: font.regular }}>
            Архив ({vm.departed.length})
          </Text>
        </View>
        {vm.departed.length === 0 ? (
          <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textFaint, fontFamily: font.regular }}>
            Архив пуст — пока никто не покинул гильдию.
          </Text>
        ) : (
          vm.departed.map((d, i) => <DepartedRow key={i} d={d} />)
        )}
      </ScrollView>
    </View>
  );
}
