import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine, TurnActionKey } from '../engine/GameEngine';
import { colors, font, roleColor } from '../theme/theme';
import { GRID_ROWS, GRID_COLS, FRONT_ROW, CombatFx, EnemyRole, Raider, Sim } from '../combat/types';
import { Avatar } from '../components/Avatar';
import { Icon, IconName } from '../components/Icon';
import { SkillIcon } from '../components/SkillIcon';
import { ProgressBar } from '../components/ProgressBar';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';
import { BOSS_ART, MONSTER_ART, ROOM_ART } from '../data/monsterArt';
import { AuraRing, Crosshair, DebtCoin, DefendBadge, FoeCell, Floaters, FrozenOverlay, IceShellOverlay, PoisonBubbles, Projectile, RallyWave, Tether, impactDelay, useActorMotion, useHpFloaters, useSlideIn } from '../components/CombatFx';
import { FootShadow, Floor, TileGlow, TileImpact } from '../components/Stage25D';
import { fieldGeometry } from '../combat/perspective';
import { BATTLE_THEMES, BattleBackdrop, BattleParticles } from '../components/BattleBackdrop';

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
  cleave: () => 'Сокрушающий взмах по переднему ряду',
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

const ENEMY_ICON: Record<EnemyRole, IconName> = { brute: 'shield', archer: 'target', shaman: 'flask' };
// Room groups sit centred in the enemy row, spread out so each stays easy to tap.
const ENEMY_SLOTS: Record<number, number[]> = { 1: [2], 2: [1, 3], 3: [1, 2, 3] };

export function CombatScreen({ engine }: { engine: GameEngine }) {
  useEngineVersion(engine);
  const insets = useSafeAreaInsets();
  const [pickingTarget, setPickingTarget] = useState<TurnActionKey | null>(null);
  const s = engine.sim!;

  const bossPct = Math.max(0, (s.boss.hp / s.boss.maxHp) * 100);
  const bossLabel = s.name + (s.encounterType === 'boss' ? ' · фаза ' + s.phase : '');
  const tiltColor = s.tilt >= 70 ? colors.danger : s.tilt >= 40 ? colors.warn : colors.good;
  const current = engine.currentRaider();
  const actions = engine.turnActionsVM();
  const healTargets = engine.healTargetsVM();
  const reachableCells = engine.reachableCells();
  const isBossFight = s.encounterType === 'boss';
  const enemyCenter = Math.floor(GRID_COLS / 2);
  const enemySlots = ENEMY_SLOTS[s.enemies.length] ?? [];
  // Arena rivals are other guilds' squads, not monsters, so they keep the plain skull.
  const dungeonForArt = engine.inArena ? null : engine.currentDungeon();
  const bossArt = dungeonForArt && BOSS_ART[dungeonForArt.id] ? MONSTER_ART[BOSS_ART[dungeonForArt.id]] : undefined;
  const roomArt = dungeonForArt ? ROOM_ART[dungeonForArt.locationId] : undefined;
  const theme = BATTLE_THEMES[dungeonForArt ? dungeonForArt.locationId : 'arena'] ?? BATTLE_THEMES.outskirts;
  const focusId = engine.focusEnemy()?.id;
  const stunnedNow = s.stunned || s.vulnerableRounds > 0;
  const enraged = s.round >= s.enrageAt;
  const dangerCells = new Set(s.danger?.cells ?? []);
  const stunnedFoes = s.stunned || s.vulnerableRounds > 0;

  // 2.5D battlefield geometry, derived from its measured width: the grid is a
  // floor seen from behind the party, enemies stand beyond its far edge.
  const [fieldW, setFieldW] = useState(0);
  const bossSize = fieldW * 0.4;
  const roomFoeSize = fieldW * 0.2 * 1.5 * 0.56;
  // Room fights get extra sky so the location's scenery shows above the enemies.
  const geo = fieldW ? fieldGeometry(fieldW, Math.max((isBossFight ? bossSize : roomFoeSize) + 12, fieldW * 0.3)) : null;
  const enemyZ = geo ? (geo.rowSpan(-1)[0] + geo.rowSpan(-1)[1]) / 2 : 0;
  const foeSize = isBossFight ? bossSize : geo ? fieldW * 0.2 * 1.5 * geo.scale(enemyZ) : 0;
  // Room groups stand a little wider than the tiles so their cards don't pile up.
  const foeFoot = (col: number) => geo!.project(0.5 + ((col - enemyCenter) / GRID_COLS) * 1.3, enemyZ);
  const foePoint = (enemyId: number) => {
    const col = enemyId < 0 ? enemyCenter : enemySlots[s.enemies.findIndex((e) => e.id === enemyId)] ?? enemyCenter;
    const f = foeFoot(col);
    return { x: f.x, y: f.y - foeSize / 2 };
  };
  const figureSize = (row: number) => (geo ? Math.round(60 * geo.tileScale(row, 0)) : 30);
  const raiderPoint = (row: number, col: number) => {
    const f = geo!.foot(row, col);
    return { x: f.x, y: f.y - figureSize(row) * 0.6 };
  };
  const slideOffset = (toRow: number, toCol: number) => (fromRow: number, fromCol: number) => {
    const a = geo!.foot(fromRow, fromCol); const b = geo!.foot(toRow, toCol);
    return { dx: a.x - b.x, dy: a.y - b.y };
  };

  const [waves, setWaves] = useState<{ key: number; at: { x: number; y: number } }[]>([]);
  // One projectile per ranged/ability/heal action, flying from the actor to its target.
  const [shots, setShots] = useState<{ key: number; from: { x: number; y: number }; to: { x: number; y: number }; color: string; arc: number }[]>([]);
  useEffect(() => {
    const fx = s.fx;
    if (!geo || fx.seq === 0 || typeof fx.actor !== 'number') return;
    const actor = s.raiders.find((r) => r.id === fx.actor);
    if (!actor) return;
    const from = raiderPoint(actor.row, actor.col);
    let to: { x: number; y: number } | null = null;
    let color: string = colors.warn;
    let arc = 0;
    if ((fx.kind === 'ranged' || fx.kind === 'ability') && fx.targetEnemy != null) {
      to = foePoint(fx.targetEnemy);
      color = fx.kind === 'ability' ? colors.accent : '#ffb35c';
      arc = 34;
    } else if (fx.targetRaider != null && fx.targetRaider !== actor.id) {
      const t = s.raiders.find((r) => r.id === fx.targetRaider);
      if (t) { to = raiderPoint(t.row, t.col); color = colors.good; arc = 22; }
    }
    if (fx.kind === 'rally') setWaves((xs) => [...xs, { key: fx.seq, at: geo.foot(actor.row, actor.col) }]);
    if (to) setShots((xs) => [...xs, { key: fx.seq, from, to: to!, color, arc }]);
    // Fires once per action; positions are read from the state that action produced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.fx.seq]);

  // Camera: a slow idle drift, and heavy moments shake and punch in.
  const fieldShake = useRef(new Animated.Value(0)).current;
  const punch = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const prevShake = useRef(s.shakeSeq);
  useEffect(() => {
    if (s.shakeSeq === prevShake.current) return;
    prevShake.current = s.shakeSeq;
    fieldShake.setValue(0);
    Animated.sequence([
      Animated.timing(fieldShake, { toValue: 1, duration: 45, useNativeDriver: true }),
      Animated.timing(fieldShake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(fieldShake, { toValue: 0.6, duration: 55, useNativeDriver: true }),
      Animated.timing(fieldShake, { toValue: -0.3, duration: 50, useNativeDriver: true }),
      Animated.timing(fieldShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    punch.setValue(0);
    Animated.sequence([
      Animated.timing(punch, { toValue: 1, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(punch, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [s.shakeSeq, fieldShake, punch]);
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: -1, duration: 6400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [drift]);

  // Camera follows the turn: eases toward whoever acts and leans in harder on a wind-up.
  const camX = useRef(new Animated.Value(0)).current;
  const camY = useRef(new Animated.Value(0)).current;
  const camZ = useRef(new Animated.Value(1)).current;
  const enemyTurn = s.order[s.turnPos]?.kind === 'boss';
  let focus: { x: number; y: number } | null = null;
  let zoom = 1;
  let pull = 0;
  if (geo && s.windup) { focus = foePoint(-1); zoom = 1.1; pull = 0.3; }
  else if (geo && enemyTurn) { focus = foePoint(-1); zoom = 1.04; pull = 0.15; }
  else if (geo && current) { focus = raiderPoint(current.row, current.col); zoom = 1.05; pull = 0.15; }
  const camTx = geo && focus ? -zoom * (focus.x - geo.width / 2) * pull : 0;
  const camTy = geo && focus ? -zoom * (focus.y - geo.height / 2) * pull : 0;
  useEffect(() => {
    const ease = { duration: s.windup ? 600 : 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true };
    Animated.parallel([
      Animated.timing(camX, { toValue: camTx, ...ease }),
      Animated.timing(camY, { toValue: camTy, ...ease }),
      Animated.timing(camZ, { toValue: zoom, ...ease }),
    ]).start();
  }, [camTx, camTy, zoom, s.windup, camX, camY, camZ]);

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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 14, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {isBossFight && bossArt ? (
            <Image source={bossArt} style={{ width: 46, height: 46, borderRadius: 8, borderWidth: 1.5, borderColor: colors.danger }} />
          ) : null}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontFamily: font.medium, color: colors.text }}>{bossLabel}</Text>
              <Text style={{ fontSize: 11, color: colors.textDim, fontVariant: ['tabular-nums'], fontFamily: font.regular }}>{Math.round(bossPct)}%</Text>
            </View>
            <ProgressBar pct={bossPct} color={colors.danger} height={8} />
          </View>
        </View>

        {/* Stagger meter + enrage clock */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 }}>
          <Text style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: stunnedNow ? colors.warn : colors.textFaint, width: 58, fontFamily: font.regular }}>
            {stunnedNow ? 'Оглушён' : 'Натиск'}
          </Text>
          <View style={{ flex: 1 }}>
            <ProgressBar pct={stunnedNow ? 100 : s.stagger} color={stunnedNow ? colors.warn : colors.accent} height={4} />
          </View>
          <Text style={{ fontSize: 10.5, color: enraged ? colors.danger : colors.textFaint, fontFamily: enraged ? font.medium : font.regular, fontVariant: ['tabular-nums'] }}>
            {enraged ? 'Ярость · урон ×' + engine.enrageMult().toFixed(2) : 'Раунд ' + s.round + ' · ярость через ' + (s.enrageAt - s.round)}
          </Text>
        </View>

        {/* Turn queue */}
        <View style={{ flexDirection: 'row', gap: 5, marginTop: 12, marginBottom: 4 }}>
          {s.order.map((entry, i) => {
            const active = i === s.turnPos;
            if (entry.kind === 'boss') {
              return (
                <View key="boss" style={{
                  width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                  borderWidth: active ? 2 : 1, borderColor: active ? colors.danger : colors.borderStrong,
                  backgroundColor: active ? 'rgba(209,104,92,0.18)' : 'transparent',
                }}>
                  <Icon name="skull" size={14} color={active ? colors.danger : colors.textFaint} />
                </View>
              );
            }
            const r = s.raiders.find((x) => x.id === entry.id);
            if (!r) return null;
            return (
              <View key={'r' + r.id} style={{ opacity: r.alive ? 1 : 0.3 }}>
                <Avatar id={r.candidateId} size={30} radius={15} grayscale={!r.alive} style={active ? { borderWidth: 2, borderColor: roleColor[r.role] } : undefined} />
              </View>
            );
          })}
        </View>

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

        {/* Tilt */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <Text style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Тилт</Text>
          <View style={{ flex: 1 }}>
            <ProgressBar pct={s.tilt} color={tiltColor} height={5} />
          </View>
          <Text style={{ fontSize: 11, color: colors.textDim, width: 30, textAlign: 'right', fontVariant: ['tabular-nums'], fontFamily: font.regular }}>{Math.round(s.tilt)}%</Text>
        </View>

        {/* Tactical grid */}
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Text style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textFaint, fontFamily: font.regular }}>Поле боя</Text>
            <Text style={{ fontSize: 10.5, color: colors.textFaint, fontFamily: font.regular }}>
              {isBossFight ? 'Передний край: ближний бой, строй, танк прикрывает' : 'Нажмите на врага, чтобы выбрать цель'}
            </Text>
          </View>
          <View
            onLayout={(e) => setFieldW(e.nativeEvent.layout.width)}
            style={{ height: geo ? geo.height : 240, borderRadius: 10, overflow: 'hidden', backgroundColor: theme.ground[1] }}
          >
            {geo ? (
              <>
                <BattleBackdrop theme={theme} width={geo.width} height={geo.height} horizon={geo.horizon} pan={camX} />
                <Animated.View
                  style={{
                    position: 'absolute', left: 0, top: 0, width: geo.width, height: geo.height,
                    transform: [
                      { translateX: Animated.add(Animated.add(fieldShake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }), drift.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] })), camX) },
                      { translateY: Animated.add(drift.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.5, 0, 1.5] }), camY) },
                      { scale: Animated.multiply(punch.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }), camZ) },
                    ],
                  }}
                >
                  <Floor
                    geo={geo}
                    palette={theme.floor}
                    tileState={(row, col) => {
                      const key = row + ',' + col;
                      if (dangerCells.has(key)) return 'danger';
                      if (s.lava.includes(key)) return 'lava';
                      if (s.movePhase && reachableCells.some((c) => c.row === row && c.col === col)) return 'reachable';
                      if (s.movePhase && current && current.row === row && current.col === col) return 'self';
                      return 'plain';
                    }}
                  />
                  {[...dangerCells].map((key) => {
                    const [row, col] = key.split(',').map(Number);
                    return <TileGlow key={'d' + key} geo={geo} row={row} col={col} color="rgba(209,104,92,0.45)" stroke={colors.danger} />;
                  })}
                  {s.lava.map((key) => {
                    const [row, col] = key.split(',').map(Number);
                    return <TileGlow key={'l' + key} geo={geo} row={row} col={col} color="rgba(255,120,40,0.45)" duration={1500} />;
                  })}
                  {current ? (
                    <TileGlow key={'a' + current.id} geo={geo} row={current.row} col={current.col} color={roleColor[current.role] + '33'} stroke={roleColor[current.role]} duration={1300} min={0.3} max={0.95} />
                  ) : null}
                  {s.impact.cells.map((key) => {
                    const [row, col] = key.split(',').map(Number);
                    return <TileImpact key={s.impact.seq + ':' + key} geo={geo} row={row} col={col} kind={s.impact.kind === 'meteor' || s.impact.kind === 'devour' ? 'meteor' : 'cleave'} />;
                  })}

                  {/* Tap targets, one per tile */}
                  {Array.from({ length: GRID_ROWS }).flatMap((_, row) =>
                    Array.from({ length: GRID_COLS }).map((__, col) => {
                      const isSelfCell = !!current && current.row === row && current.col === col;
                      const reachable = s.movePhase && reachableCells.some((c) => c.row === row && c.col === col);
                      const rect = geo.tileRect(row, col);
                      return (
                        <Pressable
                          key={'t' + row + '-' + col}
                          testID={'cell-' + row + '-' + col}
                          disabled={!(reachable || (s.movePhase && isSelfCell))}
                          onPress={() => (isSelfCell ? engine.skipMove() : engine.moveRaider(row, col))}
                          style={{ position: 'absolute', ...rect, zIndex: 1 }}
                        />
                      );
                    }),
                  )}

                  {/* Figures, far to near so nearer ones overlap */}
                  {(() => {
                    const figs: { y: number; node: React.ReactNode }[] = [];
                    if (isBossFight) {
                      const f = foeFoot(enemyCenter);
                      figs.push({ y: f.y, node: (
                        <View key="boss" style={{ position: 'absolute', left: f.x - foeSize / 2, top: f.y - foeSize, width: foeSize, height: foeSize, zIndex: Math.round(f.y) }}>
                          <FootShadow at={{ x: foeSize / 2, y: foeSize }} width={foeSize * 0.95} />
                          <FoeCell
                            icon="skull" hp={s.boss.hp} maxHp={s.boss.maxHp} alive={s.boss.hp > 0}
                            focused={false} isBoss poisoned={!!s.bossPoison} stunned={stunnedFoes} phase={s.phase} fx={s.fx}
                            overlay={s.iceShell ? <IceShellOverlay /> : null} art={bossArt} windup={s.windup}
                          />
                        </View>
                      ) });
                    } else {
                      s.enemies.forEach((e, i) => {
                        const col = enemySlots[i] ?? enemyCenter;
                        const f = foeFoot(col);
                        figs.push({ y: f.y + i * 0.01, node: (
                          <View key={'foe' + e.id} style={{ position: 'absolute', left: f.x - foeSize / 2, top: f.y - foeSize, width: foeSize, height: foeSize, zIndex: Math.round(f.y) + (col === enemyCenter ? 0 : 1) }}>
                            <FootShadow at={{ x: foeSize / 2, y: foeSize }} width={foeSize * 0.9} />
                            <FoeCell
                              testID={'enemy-' + e.id} icon={ENEMY_ICON[e.role]} name={e.name}
                              hp={e.hp} maxHp={e.maxHp} alive={e.alive} focused={e.alive && e.id === focusId} isBoss={false}
                              poisoned={s.bossPoison?.enemyId === e.id} stunned={stunnedFoes} fx={s.fx} onPress={() => engine.setFocus(e.id)}
                              art={roomArt ? MONSTER_ART[roomArt[e.role]] : undefined} windup={s.windup}
                            />
                          </View>
                        ) });
                      });
                    }
                    // Dead first so a living raider sharing the cell draws on top.
                    [...s.raiders].sort((a, b) => Number(a.alive) - Number(b.alive)).forEach((r) => {
                      const f = geo.foot(r.row, r.col);
                      const size = figureSize(r.row);
                      const isSelf = s.movePhase && current?.id === r.id;
                      figs.push({ y: f.y + (r.alive ? 0.5 : 0), node: (
                        <View
                          key={'r' + r.id}
                          pointerEvents="box-none"
                          style={{ position: 'absolute', left: f.x - size, top: f.y - size - 3, width: size * 2, zIndex: Math.round(f.y) + (r.alive ? 3 : 2) }}
                        >
                          <GridToken
                            r={r} size={size} isActive={current?.id === r.id} poisoned={s.poison?.targetId === r.id} fx={s.fx} sim={s}
                            offsetOf={slideOffset(r.row, r.col)} onPress={isSelf ? () => engine.skipMove() : undefined}
                          />
                        </View>
                      ) });
                    });
                    return figs.sort((a, b) => a.y - b.y).map((x) => x.node);
                  })()}

                  <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
                    {shots.map((p) => (
                      <Projectile key={p.key} from={p.from} to={p.to} color={p.color} arc={p.arc} onDone={() => setShots((xs) => xs.filter((x) => x.key !== p.key))} />
                    ))}
                    {s.pendingCast ? (() => {
                      const t = s.raiders.find((r) => r.id === s.pendingCast!.targetId && r.alive);
                      return t ? <Tether from={foePoint(-1)} to={raiderPoint(t.row, t.col)} color={colors.danger} thickness={3} /> : null;
                    })() : null}
                    {s.chain ? (() => {
                      const a = s.raiders.find((r) => r.id === s.chain!.aId); const b = s.raiders.find((r) => r.id === s.chain!.bId);
                      return a && b ? <Tether from={raiderPoint(a.row, a.col)} to={raiderPoint(b.row, b.col)} color={colors.accent} /> : null;
                    })() : null}
                    {waves.map((w) => <RallyWave key={w.key} at={w.at} squash={0.42} onDone={() => setWaves((xs) => xs.filter((x) => x.key !== w.key))} />)}
                  </View>
                </Animated.View>
                <BattleParticles theme={theme} width={geo.width} height={geo.height} />
              </>
            ) : null}
          </View>
        </View>

        {/* Combat log */}
        <View style={{ marginTop: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, minHeight: 90 }}>
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
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Math.max(14, insets.bottom + 10) }}>
        {!current ? (
          <View style={{ height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, color: colors.textFaint, fontFamily: font.regular }}>{s.windup ? 'Противник замахивается для мощного удара!' : s.order[s.turnPos]?.kind === 'boss' ? 'Ход противника…' : '…'}</Text>
          </View>
        ) : s.movePhase ? (
          <>
            <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 8, fontFamily: font.regular }}>
              Ход: {current.name} · {reachableCells.length ? 'выберите клетку на поле или пропустите' : 'нет свободных клеток рядом'}
            </Text>
            <SecondaryButton label="Пропустить перемещение" onPress={() => engine.skipMove()} />
          </>
        ) : pickingTarget ? (
          <>
            <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 8, fontFamily: font.regular }}>Выберите цель</Text>
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
          <>
            <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: 8, fontFamily: font.regular }}>Ход: {current.name}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {actions.map((a) => (
                <Pressable
                  key={a.key}
                  onPress={() => (a.disabled ? undefined : onPickAction(a.key, a.needsTarget))}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    borderWidth: 1, borderColor: a.disabled ? colors.border : colors.borderStrong, borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 10, opacity: a.disabled ? 0.4 : 1,
                  }}
                >
                  {a.abilityArt ? (
                    <SkillIcon id={a.abilityArt} size={26} radius={6} dim={a.disabled} style={{ marginVertical: -4 }} />
                  ) : (
                    <Icon name={a.key === 'ability' ? (a.abilityIcon as IconName) : ACTION_ICON[a.key]} size={15} color={a.disabled ? colors.textFaint : colors.text} />
                  )}
                  <View>
                    <Text style={{ fontSize: 12.5, color: a.disabled ? colors.textFaint : colors.text, fontFamily: font.medium }}>{a.label}</Text>
                    {a.sub ? <Text style={{ fontSize: 10, color: colors.textFaint, fontFamily: font.regular }}>{a.sub}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function GridToken({ r, size, isActive, poisoned, fx, sim, offsetOf, onPress }: {
  r: Raider; size: number; isActive: boolean; poisoned: boolean; fx: CombatFx; sim: Sim;
  offsetOf: (fromRow: number, fromCol: number) => { dx: number; dy: number }; onPress?: () => void;
}) {
  const hpPct = Math.max(0, (r.hp / r.maxHp) * 100);
  const hpColor = hpPct > 60 ? colors.good : hpPct > 30 ? colors.warn : colors.danger;
  const chained = r.chainPartner != null;
  const shake = useRef(new Animated.Value(0)).current;
  const prevHp = useRef(r.hp);
  useEffect(() => {
    if (r.hp < prevHp.current) {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]).start();
    }
    prevHp.current = r.hp;
  }, [r.hp, shake]);
  const floaters = useHpFloaters(r.hp, () => false, () => (fx.kind === 'heal' || fx.kind === 'ability') && fx.targetRaider === r.id ? impactDelay(fx) : 0);
  const slump = useRef(new Animated.Value(r.alive ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(slump, { toValue: r.alive ? 0 : 1, duration: r.alive ? 0 : 500, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [r.alive, slump]);
  const motion = useActorMotion(fx, (f) => f.actor === r.id, -1);
  const glowColor = fx.kind === 'heal' ? colors.good : fx.kind === 'ability' ? colors.accent : fx.kind === 'rally' ? colors.warn : roleColor[r.role];
  const slide = useSlideIn(sim.moveFx, r.id, r.row, r.col, offsetOf);
  const alive = r.alive;
  const frozen = alive && sim.frozen?.targetId === r.id;
  const shielded = alive && ((r.ability.kind === 'selfShield' && r.ability.active) || !!sim.partyWard);
  const berserk = alive && r.ability.kind === 'berserk' && r.ability.active;
  const doomed = alive && sim.execution?.targetId === r.id;
  const indebted = alive && sim.debt?.targetId === r.id && !sim.debt.paid;
  const body = (
    <Animated.View pointerEvents={onPress ? 'auto' : 'none'} style={{ alignItems: 'center', width: '100%', transform: [{ translateX: slide.x }, { translateY: slide.y }] }}>
      {/* Contact shadow under the figure's feet */}
      <View style={{ position: 'absolute', top: size - size * 0.12, width: size * 1.05, height: size * 0.3, borderRadius: size, backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <Animated.View style={{ opacity: slump.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }), transform: [
        { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] }) },
        { translateY: Animated.add(motion.translateY, slump.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.25] })) },
        { rotate: slump.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-14deg'] }) },
        { scale: motion.scale },
      ] }}>
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 10, borderWidth: 2, borderColor: glowColor, opacity: motion.glow }}
        />
        <Avatar
          id={r.candidateId} size={size} radius={Math.max(4, size * 0.16)} grayscale={!r.alive}
          style={{ borderWidth: isActive ? 2 : 1, borderColor: isActive ? roleColor[r.role] : 'rgba(0,0,0,0.6)' }}
        />
        {shielded ? <AuraRing color="#8fb8ff" /> : null}
        {berserk ? <AuraRing color={colors.danger} fast /> : null}
        {poisoned && alive ? <PoisonBubbles /> : null}
        {frozen ? <FrozenOverlay /> : null}
        {doomed ? <Crosshair /> : null}
        {indebted ? <DebtCoin /> : null}
        {alive && r.defending ? <DefendBadge /> : null}
      </Animated.View>
      <Floaters items={floaters.items} remove={floaters.remove} />
      <View style={{ width: size * 0.95, marginTop: 3 }}>
        <ProgressBar pct={hpPct} color={hpColor} height={3} />
      </View>
      {chained || poisoned || r.ability.active ? (
        <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
          {chained ? <Icon name="shield-chevron" size={9} color={colors.accent} /> : null}
          {poisoned ? <Icon name="drop" size={9} color={colors.good} /> : null}
          {r.ability.active ? <Icon name={r.ability.icon} size={9} color={roleColor[r.role]} /> : null}
        </View>
      ) : null}
    </Animated.View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}
