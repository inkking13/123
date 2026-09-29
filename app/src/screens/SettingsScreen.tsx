import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine } from '../engine/GameEngine';
import { colors, font } from '../theme/theme';
import { GhostLink, PrimaryButton } from '../components/Buttons';
import { Icon, IconName } from '../components/Icon';
import { useEngineVersion } from '../engine/useEngine';
import { Quality, QUALITY_HINT, QUALITY_LABEL } from '../battle3d/quality';
import { Corners, ScreenTitle } from '../components/Frame';

function Toggle({ icon, on, onPress, title, text }: { icon: IconName; on: boolean; onPress: () => void; title: string; text: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 14, marginBottom: 10,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{
        width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
        backgroundColor: on ? colors.accentWash : 'transparent', borderWidth: 1, borderColor: on ? colors.accent : colors.borderStrong,
      }}
      >
        <Icon name={icon} size={16} color={on ? colors.accentSoft : colors.textFaint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>{text}</Text>
      </View>
      <View style={{ width: 44, height: 26, borderRadius: 13, padding: 2, justifyContent: 'center', backgroundColor: on ? colors.accent : colors.border }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text, alignSelf: on ? 'flex-end' : 'flex-start' }} />
      </View>
      <Corners color="#8a7650" />
    </Pressable>
  );
}

export function SettingsScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 20, paddingBottom: 40 }}>
        <GhostLink label="Лагерь" icon="arrow-left" onPress={() => engine.go('home')} />
        <ScreenTitle style={{ marginTop: 10, marginBottom: 22 }}>Настройки</ScreenTitle>

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#b39462', marginBottom: 10, fontFamily: font.medium }}>
          Обратная связь
        </Text>
        <Toggle icon="speaker-high" on={engine.settings.sound} onPress={() => engine.toggleSound()} title="Звуки" text="Удары, заклинания, лечение, победа и поражение." />
        <Toggle icon="music-notes" on={engine.settings.music} onPress={() => engine.toggleMusic()} title="Музыка" text="Своя мелодия в лагере, в бою и на боссе." />
        <Pressable
          onPress={() => engine.toggleHaptics()}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 14, marginBottom: 22,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{
            width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
            backgroundColor: engine.settings.haptics ? colors.accentWash : 'transparent',
            borderWidth: 1, borderColor: engine.settings.haptics ? colors.accent : colors.borderStrong,
          }}
          >
            <Icon name="vibrate" size={16} color={engine.settings.haptics ? colors.accentSoft : colors.textFaint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.text }}>Вибрация в бою</Text>
            <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>
              Удары, крит, смерть бойца, победа и поражение. Только на телефоне — в вебе не ощущается.
            </Text>
          </View>
          <View style={{
            width: 44, height: 26, borderRadius: 13, padding: 2, justifyContent: 'center',
            backgroundColor: engine.settings.haptics ? colors.accent : colors.border,
          }}
          >
            <View style={{
              width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text,
              alignSelf: engine.settings.haptics ? 'flex-end' : 'flex-start',
            }}
            />
          </View>
          <Corners color="#8a7650" />
        </Pressable>

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#b39462', marginBottom: 10, fontFamily: font.medium }}>
          Качество графики
        </Text>
        <View style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, marginBottom: 22, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['low', 'medium', 'high'] as Quality[]).map((q) => {
              const on = engine.settings.quality === q;
              return (
                <Pressable
                  key={q}
                  testID={'quality-' + q}
                  onPress={() => engine.setQuality(q)}
                  style={{
                    flex: 1, height: 36, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
                    borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentWash : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: font.medium, color: on ? colors.text : colors.textDim }}>{QUALITY_LABEL[q]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontSize: 12, lineHeight: 17, color: colors.textDim, marginTop: 10, fontFamily: font.regular }}>
            {QUALITY_HINT[engine.settings.quality]} Если игра тормозит, выберите «Низкое».
          </Text>
          <Corners color="#8a7650" />
        </View>

        <Pressable
          testID="reset-tips"
          onPress={() => engine.resetTips()}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 14, marginBottom: 22,
            backgroundColor: colors.surface,
          }}
        >
          <Icon name="target" size={18} color={colors.accentSoft} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.text }}>Показать подсказки в бою заново</Text>
            <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>
              {engine.seenTips.size === 0 ? 'Подсказки появятся в следующем бою.' : 'Как ходить, выбирать цель, уходить с красных клеток.'}
            </Text>
          </View>
          <Corners color="#8a7650" />
        </Pressable>

        <Text style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#b39462', marginBottom: 10, fontFamily: font.medium }}>
          Прогресс
        </Text>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <Text style={{ fontSize: 12.5, lineHeight: 19, color: colors.textMuted, fontFamily: font.regular }}>
            Уровни, снаряжение, таланты, подземелья и реликвии сохраняются автоматически и переживают перезапуск игры.
          </Text>
        </View>

        {!confirmReset ? (
          <Pressable
            onPress={() => setConfirmReset(true)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center',
              borderWidth: 1, borderColor: colors.danger, borderRadius: 8, padding: 13,
            }}
          >
            <Icon name="trash-simple" size={16} color={colors.danger} />
            <Text style={{ fontSize: 14, fontFamily: font.medium, color: colors.danger }}>Сбросить прогресс</Text>
          </Pressable>
        ) : (
          <View style={{ borderWidth: 1, borderColor: colors.danger, borderRadius: 8, padding: 14, backgroundColor: 'rgba(209,104,92,0.08)' }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
              <Icon name="warning" size={18} color={colors.danger} />
              <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: colors.textMuted, fontFamily: font.regular }}>
                Это необратимо. Все уровни, снаряжение, подземелья и реликвии будут утеряны, отряд гильдии начнёт с нуля.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setConfirmReset(false)}
                style={{ flex: 1, height: 42, borderRadius: 7, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 13, fontFamily: font.medium, color: colors.textDim }}>Отмена</Text>
              </Pressable>
              <Pressable
                onPress={() => { engine.resetProgress(); setConfirmReset(false); }}
                style={{ flex: 1, height: 42, borderRadius: 7, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 13, fontFamily: font.medium, color: colors.bg }}>Точно сбросить</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
