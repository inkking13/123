import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine, TurnActionKey } from '../engine/GameEngine';
import { colors, font, roleColor } from '../theme/theme';
import { EnemyRole } from '../combat/types';
import { Avatar } from '../components/Avatar';
import { Icon, IconName } from '../components/Icon';
import { SkillIcon } from '../components/SkillIcon';
import { ProgressBar } from '../components/ProgressBar';
import { SecondaryButton } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';
import { BOSS_ART, MONSTER_ART, roomArtFor } from '../data/monsterArt';
import { BATTLE_THEMES } from '../components/BattleBackdrop';
import { Battle3D, canRender3D } from '../battle3d/Battle3D';
import { ARENA_CHAMPION, MONSTER_LOOKS, ROOM_BODIES } from '../battle3d/monsterLooks';
import { gearLookOf } from '../battle3d/gearLooks';
import { TIPS, Tip } from '../data/features';
import { BossIntro } from '../components/BossIntro';
import { useCombatSounds } from '../audio/useCombatSounds';

const ACTION_ICON: Record<TurnActionKey, IconName> = {
  attack: 'sword',
  heal: 'first-aid-kit',
  ability: 'flame',
  interrupt: 'hand-palm',
  breakChain: 'shield-chevron',
  breakIce: 'snowflake',
  brace: 'shield',
  rally: 'megaphone',
  defend: 'shield',
  breakShell: 'snowflake',
};

const DANGER_TITLE = {
  meteor: (cols: number[]) => 'Огненный дождь по колоннам ' + cols.map((c) => c + 1).join(' и '),
  cleave: () => 'Сокрушающий взмах по клеткам вокруг врага',
  devour: () => 'Пасть раскрыта над отмеченной клеткой',
  backstab: () => 'Удар в спину по заднему ряду',
};

function Banner({ tone, title, text }: { tone: 'danger' | 'warn' | 'accent'; title: string; text: string }) {
  const c = tone === 'danger' ? colors.danger : tone === 'warn' ? colors.warn : colors.accent;
  const bg = tone === 'danger' ? 'rgba(209,104,92,0.1)' : tone === 'warn' ? 'rgba(201,176,109,0.1)' : colors.accentWash;
  return (
    <View style={{ marginTop: 10, borderWidth: 1, borderColor: c, borderRadius: 8, padding: 10, backgroundColor: bg }}>
      <Text style={{ fontSize: 12, color: tone === 'danger' ? '#f0c3bc' : c, fontFamily: font.medium }}>{title}</Text>
      <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>{text}</Text>
    </View>
  );
}

/** The gold trim the gear screen uses, for the fight's panels. */
const GOLD_LINE = 'rgba(201,163,107,0.45)';
const GOLD_TEXT = '#e6cf9c';
/** Height kept free under the field for the action bar (a coaching tip may cover a little more). */
const ACTION_BAR_H = 190;

/** A labelled slim bar for the fight panel. */
function Meter({ label, labelColor, pct, color, value }: { label: string; labelColor?: string; pct: number; color: string; value?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: labelColor ?? colors.textFaint, fontFamily: font.medium }}>{label}</Text>
        {value ? <Text style={{ fontSize: 10, color: colors.textDim, fontVariant: ['tabular-nums'], fontFamily: font.regular }}>{value}</Text> : null}
      </View>
      <ProgressBar pct={pct} color={color} height={5} />
    </View>
  );
}

const ENEMY_ICON: Record<EnemyRole, IconName> = { brute: 'shield', archer: 'target', shaman: 'flask' };

export function CombatScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  useCombatSounds(engine.sim);
  const insets = useSafeAreaInsets();
  const [pickingTarget, setPickingTarget] = useState<TurnActionKey | null>(null);
  const [failed3d, setFailed3d] = useState(false);
  // Bumped by «Повторить» to mount the 3D field afresh.
  const [attempt, setAttempt] = useState(0);
  const [webgl] = useState(canRender3D);
  const use3d = webgl && !failed3d;
  // Gear can't change mid-fight, so the heroes' worn looks are worked out once.
  const heroGear = useMemo(() => Object.fromEntries(engine.pool.map((c) => [c.id, gearLookOf(c.equipment)])), [engine]);
  const s = engine.sim!;

  const bossPct = Math.max(0, (s.boss.hp / s.boss.maxHp) * 100);
  const bossLabel = s.name + (s.encounterType === 'boss' ? ' · фаза ' + s.phase : '');
  const tiltColor = s.tilt >= 70 ? colors.danger : s.tilt >= 40 ? colors.warn : colors.good;
  const current = engine.currentRaider();
  const actions = engine.turnActionsVM();
  const healTargets = engine.healTargetsVM();
  const reachableCells = engine.reachableCells();
  const isBossFight = s.encounterType === 'boss';
  // Arena rivals are other guilds' squads, not monsters, so they keep the plain skull.
  const dungeonForArt = engine.inArena ? null : engine.currentDungeon();
  const bossArt = dungeonForArt && BOSS_ART[dungeonForArt.id] ? MONSTER_ART[BOSS_ART[dungeonForArt.id]] : undefined;
  const roomArt = dungeonForArt ? roomArtFor(dungeonForArt) : undefined;
  const theme = BATTLE_THEMES[dungeonForArt ? dungeonForArt.locationId : 'arena'] ?? BATTLE_THEMES.outskirts;
  const focusId = engine.focusEnemy()?.id;
  const stunnedNow = s.stunned || s.vulnerableRounds > 0;
  const enraged = s.round >= s.enrageAt;
  const dangerCells = new Set(s.danger?.cells ?? []);
  const stunnedFoes = s.stunned || s.vulnerableRounds > 0;

  const [fieldW, setFieldW] = useState(0);
  /** The 3D field on the whole screen: the state panel shrinks to a strip over it. */
  const [full, setFull] = useState(false);
  // The 3D field takes the height the panels leave free, within sensible proportions.
  const { height: winH } = useWindowDimensions();
  // What's left after the top panel and room for the action bar below it.
  const [hudH, setHudH] = useState(140);
  const fieldH = full && use3d
    ? Math.round(winH - insets.top - ACTION_BAR_H + 30)
    : Math.round(Math.min(fieldW * 1.5, Math.max(fieldW * 0.95, winH - insets.top - hudH - 12 - 10 - ACTION_BAR_H)));
  const onPickAction = (key: TurnActionKey, needsTarget: boolean) => {
    if (needsTarget) { setPickingTarget(key); return; }
    engine.raiderAction(key);
  };
  const onPickTarget = (targetId: number) => {
    if (!pickingTarget) return;
    engine.raiderAction(pickingTarget, targetId);
    setPickingTarget(null);
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView scrollEnabled={!(full && use3d)} contentContainerStyle={{ paddingTop: full && use3d ? insets.top : insets.top + 12, paddingHorizontal: full && use3d ? 0 : 14, paddingBottom: full && use3d ? 0 : 16 }}>
        {/* One panel for the fight's state: the foe's health, the turn order, stagger, tilt and the enrage clock. */}
        {full && use3d ? null : (<View onLayout={(e) => setHudH(e.nativeEvent.layout.height)} style={{ borderWidth: 1, borderColor: GOLD_LINE, borderRadius: 12, backgroundColor: 'rgba(14,15,24,0.82)', padding: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {isBossFight && bossArt ? (
              <Image source={bossArt} style={{ width: 40, height: 40, borderRadius: 8, borderWidth: 1.5, borderColor: colors.danger }} />
            ) : null}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontFamily: font.semibold, color: GOLD_TEXT }}>{bossLabel}</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, fontVariant: ['tabular-nums'], fontFamily: font.medium }}>{Math.round(bossPct)}%</Text>
              </View>
              <ProgressBar pct={bossPct} color={colors.danger} height={9} />
            </View>
          </View>

          {/* Turn queue: whoever acts now is bigger and ringed in their colour. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            {s.order.map((entry, i) => {
              const active = i === s.turnPos;
              const size = active ? 40 : 32;
              if (entry.kind === 'boss') {
                return (
                  <View key="boss" style={{
                    width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
                    borderWidth: active ? 2 : 1, borderColor: active ? colors.danger : colors.borderStrong,
                    backgroundColor: active ? 'rgba(209,104,92,0.22)' : 'rgba(255,255,255,0.03)',
                  }}>
                    <Icon name="skull" size={active ? 18 : 14} color={active ? colors.danger : colors.textFaint} />
                  </View>
                );
              }
              const r = s.raiders.find((x) => x.id === entry.id);
              if (!r) return null;
              return (
                <View key={'r' + r.id} style={{ opacity: r.alive ? (active || i > s.turnPos ? 1 : 0.55) : 0.3 }}>
                  <Avatar id={r.candidateId} size={size} radius={size / 2} grayscale={!r.alive} style={{ borderWidth: active ? 2 : 1, borderColor: active ? roleColor[r.role] : colors.border }} />
                </View>
              );
            })}
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 10.5, textAlign: 'right', color: enraged ? colors.danger : colors.textFaint, fontFamily: enraged ? font.semibold : font.regular, fontVariant: ['tabular-nums'] }}>
              {enraged ? 'Ярость\n×' + engine.enrageMult().toFixed(2) : 'Раунд ' + s.round + '\nярость через ' + (s.enrageAt - s.round)}
            </Text>
          </View>

          {/* Stagger and tilt side by side. */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
            <Meter label={stunnedNow ? 'Оглушён' : 'Натиск'} labelColor={stunnedNow ? colors.warn : undefined} pct={stunnedNow ? 100 : s.stagger} color={stunnedNow ? colors.warn : colors.accent} />
            <Meter label="Тилт" pct={s.tilt} color={tiltColor} value={Math.round(s.tilt) + '%'} />
          </View>
        </View>)}

        {/* Status banners */}
        {s.pendingCast ? (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: colors.danger, borderRadius: 8, padding: 10, backgroundColor: 'rgba(209,104,92,0.1)' }}>
            <Text style={{ fontSize: 12, color: '#f0c3bc', fontFamily: font.medium }}>Луч смерти нацелен на {s.pendingCast.targetName}</Text>
            <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>Прервите его на своём ходу, иначе он ударит на следующем ходу босса.</Text>
          </View>
        ) : null}
        {s.danger ? (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: colors.danger, borderRadius: 8, padding: 10, backgroundColor: 'rgba(209,104,92,0.1)' }}>
            <Text style={{ fontSize: 12, color: '#f0c3bc', fontFamily: font.medium }}>{DANGER_TITLE[s.danger.kind](s.danger.cols)}</Text>
            <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>
              Ударит на следующем ходу противника по всем, кто останется на красных клетках.
            </Text>
          </View>
        ) : null}
        {s.iceShell ? <Banner tone="accent" title="Ледяной панцирь" text="Урон по боссу −75%. Любой боец может потратить ход и расколоть его." /> : null}
        {s.debt ? <Banner tone="warn" title={'Долговая расписка: ' + s.debt.targetName + (s.debt.paid ? ' — погашено' : '')} text={s.debt.paid ? 'Взыскания не будет.' : 'Этот боец должен ударить босса своим ходом, иначе получит «взыскание».'} /> : null}
        {s.execution ? <Banner tone="danger" title={'Приказ о расстреле: ' + s.execution.targetName} text="Подлечите приговорённого выше 60% HP или пусть уйдёт в оборону — иначе залп на следующем ходу босса." /> : null}
        {s.quota ? <Banner tone={s.quota.dealt >= s.quota.need ? 'accent' : 'warn'} title={'Квартальный план: ' + Math.min(s.quota.dealt, s.quota.need) + ' / ' + s.quota.need + ' урона'} text="Выполните до хода босса — он растеряется. Провал — штраф всему отряду." /> : null}
        {s.signature === 'feast' ? <Banner tone="warn" title="Пир на ранах" text="Пока хоть кто-то в отряде ниже 50% HP, Кардинал лечится каждый раунд." /> : null}
        {s.chain ? (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: colors.accent, borderRadius: 8, padding: 10, backgroundColor: colors.accentWash }}>
            <Text style={{ fontSize: 12, color: colors.accentSoft, fontFamily: font.medium }}>
              Цепь: {s.raiders.find((r) => r.id === s.chain!.aId)?.name} ↔ {s.raiders.find((r) => r.id === s.chain!.bId)?.name}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>Бьёт обоих каждый ход. Один из них может её разорвать.</Text>
          </View>
        ) : null}
        {s.braceCall ? (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: colors.warn, borderRadius: 8, padding: 10, backgroundColor: 'rgba(201,176,109,0.1)' }}>
            <Text style={{ fontSize: 12, color: colors.warn, fontFamily: font.medium }}>«Кровавый прилив» нарастает</Text>
            <Text style={{ fontSize: 11, color: colors.textDim, marginTop: 2, fontFamily: font.regular }}>
              Приготовились: {s.braceCall.braced.size}/3 нужно, чтобы смягчить удар на следующем ходу босса.
            </Text>
          </View>
        ) : null}

        {/* Tactical grid */}
        <View style={{ marginTop: full && use3d ? 0 : 10, marginHorizontal: full && use3d ? 0 : -8 }}>
          <View onLayout={(e) => setFieldW(e.nativeEvent.layout.width)}>
          {use3d && fieldW ? (
            <Battle3D
              key={attempt}
              engine={engine} sim={s} theme={theme} height={fieldH} isBoss={isBossFight}
              bossArt={bossArt} roomArt={roomArt ? { brute: MONSTER_ART[roomArt.brute], archer: MONSTER_ART[roomArt.archer], shaman: MONSTER_ART[roomArt.shaman] } : undefined}
              bossMonster={engine.inArena ? ARENA_CHAMPION : dungeonForArt && BOSS_ART[dungeonForArt.id] ? MONSTER_LOOKS[BOSS_ART[dungeonForArt.id]] : undefined}
              roomMonsters={roomArt ? { brute: MONSTER_LOOKS[roomArt.brute], archer: MONSTER_LOOKS[roomArt.archer], shaman: MONSTER_LOOKS[roomArt.shaman], ...ROOM_BODIES[dungeonForArt!.locationId] } : undefined}
              focusId={focusId} current={current} reachable={reachableCells} heroGear={heroGear} intro={!!engine.bossIntro}
              onFail={(e) => { console.warn('3D battlefield failed', e); setFailed3d(true); }}
              full={full} onToggleFull={() => setFull((v) => !v)}
              overlay={full ? (
                // The foe's health and the turn order, in a strip over the field.
                <View pointerEvents="none" style={{ position: 'absolute', left: 8, right: 44, top: 42, padding: 8, borderRadius: 10, backgroundColor: 'rgba(14,15,24,0.72)', borderWidth: 1, borderColor: GOLD_LINE }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontFamily: font.semibold, color: GOLD_TEXT }}>{bossLabel}</Text>
                    <Text style={{ fontSize: 10.5, color: colors.textMuted, fontFamily: font.medium }}>{Math.round(bossPct)}% · раунд {s.round}</Text>
                  </View>
                  <ProgressBar pct={bossPct} color={colors.danger} height={6} />
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                    {s.order.map((entry, i) => {
                      const active = i === s.turnPos;
                      const size = active ? 24 : 18;
                      if (entry.kind === 'boss') return <View key="boss" style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: active ? colors.danger : colors.border }}><Icon name="skull" size={size * 0.55} color={active ? colors.danger : colors.textFaint} /></View>;
                      const r = s.raiders.find((x) => x.id === entry.id);
                      return r ? <Avatar key={'r' + r.id} id={r.candidateId} size={size} radius={size / 2} grayscale={!r.alive} style={{ borderWidth: active ? 2 : 1, borderColor: active ? roleColor[r.role] : colors.border, opacity: r.alive ? 1 : 0.4 }} /> : null;
                    })}
                  </View>
                </View>
              ) : null}
            />
          ) : fieldW ? (
            <View style={{ height: fieldH, borderRadius: 10, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: 'rgba(14,15,24,0.85)', borderWidth: 1, borderColor: GOLD_LINE }}>
              <Icon name="warning" size={26} color={colors.warn} />
              <Text style={{ fontSize: 15, color: colors.text, fontFamily: font.semibold, textAlign: 'center' }}>
                {webgl ? 'Поле боя не загрузилось' : 'Браузер не поддерживает 3D (WebGL)'}
              </Text>
              <Text style={{ fontSize: 12.5, lineHeight: 18, color: colors.textDim, fontFamily: font.regular, textAlign: 'center' }}>
                {webgl ? 'Попробуем ещё раз с облегчённой графикой.' : 'Откройте игру в Chrome, Edge или Safari последней версии.'}
              </Text>
              {webgl ? (
                <Pressable
                  testID="retry-3d"
                  onPress={() => { if (engine.settings.quality !== 'low') engine.setQuality('low'); setFailed3d(false); setAttempt((n) => n + 1); }}
                  style={{ height: 40, paddingHorizontal: 22, borderRadius: 8, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 14, color: colors.accentSoft, fontFamily: font.medium }}>Повторить</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          </View>
        </View>

        {(() => {
          // HR trouble costs damage all trip long; keep it on screen, not just in the scrolling log.
          const hr = engine.hrNote();
          return hr ? (
            <View testID="hr-note" style={{ marginTop: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.warn, backgroundColor: 'rgba(214,170,90,0.08)' }}>
              <Icon name="warning" size={14} color={colors.warn} />
              <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.warn, fontFamily: font.regular }}>{hr}</Text>
            </View>
          ) : null;
        })()}

        {/* Combat log */}
        <View style={{ marginTop: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, backgroundColor: 'rgba(14,15,24,0.6)' }}>
          {s.log.length === 0 ? (
            <Text style={{ fontSize: 12, color: colors.textFaint, fontFamily: font.regular }}>Бой начинается…</Text>
          ) : (
            s.log.map((entry, i) => (
              <Text
                key={i}
                style={{
                  fontSize: 12, lineHeight: 17, fontFamily: font.regular, marginBottom: 3,
                  color: entry.kind === 'ok' ? colors.good : entry.kind === 'warn' ? colors.warn : colors.textMuted,
                }}
              >
                {entry.text}
              </Text>
            ))
          )}
        </View>
      </ScrollView>

      {/* Action panel */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(14,15,24,0.9)', paddingHorizontal: 14, paddingTop: 10, paddingBottom: Math.max(14, insets.bottom + 10) }}>
        {!s.over ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 11.5, lineHeight: 15, color: colors.textDim, fontFamily: font.regular }}>
              {!current || engine.settings.auto ? '' : (
                <>
                  <Text style={{ color: GOLD_TEXT, fontFamily: font.semibold }}>{current.name}</Text>
                  {s.movePhase ? (reachableCells.length ? ' · выберите клетку или пропустите' : ' · нет свободных клеток рядом')
                    : pickingTarget ? ' · выберите цель'
                    : isBossFight ? (s.minions.some((m) => m.alive) ? ' · цель: скелет или босс' : ' · ближний бой вплотную к врагу')
                    : ' · нажмите на врага, чтобы выбрать цель'}
                </>
              )}
            </Text>
            <Chip testID="speed-toggle" label={engine.settings.speed >= 2 ? '×2' : '×1'} icon="fast-forward" on={engine.settings.speed >= 2} onPress={() => engine.toggleSpeed()} />
            <Chip testID="auto-toggle" label="Авто" icon="robot" on={engine.settings.auto} onPress={() => { setPickingTarget(null); engine.toggleAuto(); }} />
          </View>
        ) : null}
        {(() => {
          // First-fight coaching: one tip at a time, each shown once, when it's relevant.
          if (s.over || engine.settings.auto) return null;
          const tip: Tip | null =
            s.windup && engine.tipPending('windup') ? 'windup'
            : dangerCells.size > 0 && engine.tipPending('danger') ? 'danger'
            : current && s.movePhase && engine.tipPending('move') ? 'move'
            : current && !s.movePhase && !isBossFight && engine.tipPending('focus') ? 'focus'
            : current && !s.movePhase && !pickingTarget && engine.tipPending('act') ? 'act'
            : null;
          if (!tip) return null;
          const warn = tip === 'danger' || tip === 'windup';
          return (
            <View
              testID={'tip-' + tip}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, padding: 10, borderRadius: 8, borderWidth: 1,
                borderColor: warn ? colors.danger : colors.accent, backgroundColor: warn ? 'rgba(209,104,92,0.12)' : colors.accentWash,
              }}
            >
              <Icon name={warn ? 'warning' : 'target'} size={16} color={warn ? colors.danger : colors.accentSoft} />
              <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.text, fontFamily: font.regular }}>{TIPS[tip]}</Text>
              <Pressable testID="tip-ok" onPress={() => engine.dismissTip(tip)} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: colors.borderStrong }}>
                <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: font.medium }}>Понятно</Text>
              </Pressable>
            </View>
          );
        })()}
        {!current ? (
          <View style={{ height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular }}>{s.windup ? 'Противник замахивается для мощного удара!' : s.order[s.turnPos]?.kind === 'boss' ? 'Ход противника…' : '…'}</Text>
          </View>
        ) : engine.settings.auto ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46 }}>
            <Text style={{ flex: 1, fontSize: 13, color: colors.textMuted, fontFamily: font.regular }}>
              Автобой · ход: <Text style={{ color: colors.text, fontFamily: font.medium }}>{current.name}</Text>
            </Text>
            <SecondaryButton label="Взять управление" height={40} onPress={() => engine.toggleAuto()} />
          </View>
        ) : s.movePhase ? (
          <SecondaryButton label="Пропустить перемещение" onPress={() => engine.skipMove()} />
        ) : pickingTarget ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {healTargets.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => onPickTarget(t.id)}
                    style={{ borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', minWidth: 76 }}
                  >
                    <Text style={{ fontSize: 12, color: colors.text, fontFamily: font.medium }}>{t.name}</Text>
                    <Text style={{ fontSize: 11, color: colors.textFaint, marginTop: 2, fontFamily: font.regular }}>{t.hpPct}% HP</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Pressable onPress={() => setPickingTarget(null)} style={{ marginTop: 8, alignSelf: 'center' }}>
              <Text style={{ fontSize: 12, color: colors.textDim, fontFamily: font.regular }}>Отмена</Text>
            </Pressable>
          </>
        ) : (
          // A skill bar: one tile per action, icon over its name.
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {actions.map((a) => (
              <Pressable
                key={a.key}
                onPress={() => (a.disabled ? undefined : onPickAction(a.key, a.needsTarget))}
                style={({ pressed }) => ({
                  flexGrow: 1, flexBasis: 70, alignItems: 'center', gap: 4,
                  borderWidth: 1, borderColor: a.disabled ? colors.border : GOLD_LINE, borderRadius: 10,
                  paddingHorizontal: 6, paddingVertical: 8, opacity: a.disabled ? 0.4 : 1,
                  backgroundColor: pressed ? 'rgba(201,163,107,0.16)' : 'rgba(201,163,107,0.06)',
                })}
              >
                {a.abilityArt ? (
                  <SkillIcon id={a.abilityArt} size={30} radius={7} dim={a.disabled} />
                ) : (
                  <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    <Icon name={a.key === 'ability' ? (a.abilityIcon as IconName) : ACTION_ICON[a.key]} size={17} color={a.disabled ? colors.textFaint : GOLD_TEXT} />
                  </View>
                )}
                <Text numberOfLines={2} style={{ fontSize: 11.5, lineHeight: 14, textAlign: 'center', color: a.disabled ? colors.textFaint : colors.text, fontFamily: font.medium }}>{a.label}</Text>
                {a.sub ? <Text numberOfLines={1} style={{ fontSize: 10, color: colors.textFaint, fontFamily: font.regular }}>{a.sub}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
      {engine.bossIntro ? (
        <BossIntro name={engine.bossIntro.name} place={engine.bossIntro.place} line={engine.bossIntro.line} onDone={engine.endBossIntro} />
      ) : null}
    </View>
  );
}

/** Small pill toggle for battle pace and auto-play. */
function Chip({ label, icon, on, onPress, testID }: { label: string; icon: IconName; on: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={6}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1,
        borderColor: on ? colors.accent : colors.borderStrong, backgroundColor: on ? colors.accentWash : 'transparent',
      }}
    >
      <Icon name={icon} size={13} color={on ? colors.accentSoft : colors.textDim} />
      <Text style={{ fontSize: 12, color: on ? colors.text : colors.textDim, fontFamily: font.medium }}>{label}</Text>
    </Pressable>
  );
}
