import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GameEngine, TurnActionKey } from '../engine/GameEngine';
import { colors, font, roleColor } from '../theme/theme';
import { GRID_ROWS, GRID_COLS, BOSS_W, BOSS_H, CombatFx, EnemyRole, Raider, Sim } from '../combat/types';
import { Avatar } from '../components/Avatar';
import { Icon, IconName } from '../components/Icon';
import { SkillIcon } from '../components/SkillIcon';
import { ProgressBar } from '../components/ProgressBar';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { useEngineVersion } from '../engine/useEngine';
import { BOSS_ART, MONSTER_ART, roomArtFor } from '../data/monsterArt';
import { AuraRing, Crosshair, DebtCoin, DefendBadge, FoeCell, Floaters, FrozenOverlay, IceShellOverlay, PoisonBubbles, Projectile, RallyWave, Tether, impactDelay, useActorMotion, useHpFloaters, useSlideIn } from '../components/CombatFx';
import { FootShadow, Floor, TileGlow, TileImpact } from '../components/Stage25D';
import { fieldGeometry } from '../combat/perspective';
import { BATTLE_THEMES, BattleBackdrop, BattleParticles } from '../components/BattleBackdrop';
import { Battle3D, canRender3D } from '../battle3d/Battle3D';
import { ARENA_CHAMPION, MONSTER_LOOKS, ROOM_BODIES } from '../battle3d/monsterLooks';
import { gearLookOf } from '../battle3d/gearLooks';
import { TIPS, Tip } from '../data/features';
import { BossIntro } from '../components/BossIntro';

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
  const insets = useSafeAreaInsets();
  const [pickingTarget, setPickingTarget] = useState<TurnActionKey | null>(null);
  const [failed3d, setFailed3d] = useState(false);
  const [webgl] = useState(canRender3D);
  const use3d = engine.settings.view3d && webgl && !failed3d;
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

  // 2.5D battlefield geometry, derived from its measured width: the shared
  // grid is a floor seen from behind the party, enemies walk its far rows.
  const [fieldW, setFieldW] = useState(0);
  // The 3D field takes the height the panels leave free, within sensible proportions.
  const { height: winH } = useWindowDimensions();
  // What's left after the top panel and room for the action bar below it.
  const [hudH, setHudH] = useState(140);
  const fieldH = Math.round(Math.min(fieldW * 1.5, Math.max(fieldW * 0.95, winH - insets.top - hudH - 12 - 10 - ACTION_BAR_H)));
  const bossSize = fieldW * 0.42;
  const roomFoeSize = fieldW * 0.15;
  // Extra sky so the location's scenery shows above the enemies.
  const geo = fieldW ? fieldGeometry(fieldW, Math.max((isBossFight ? bossSize : roomFoeSize) + 12, fieldW * 0.28)) : null;
  const foeSizeAt = (row: number) => (isBossFight ? bossSize : geo ? roomFoeSize * geo.tileScale(row, 0) / geo.tileScale(1, 0) : 0);
  /** Feet of an enemy figure: the centre of the boss's footprint, or a room enemy's own cell. */
  const foeFootOf = (enemyId: number) => {
    const minion = s.minions.find((m) => m.id === enemyId);
    if (minion) return { foot: geo!.foot(minion.row, minion.col), size: roomFoeSize * geo!.tileScale(minion.row, 0) / geo!.tileScale(1, 0) };
    if (s.bossPos || enemyId < 0) {
      const p = s.bossPos ?? { row: 0, col: Math.floor((GRID_COLS - BOSS_W) / 2) };
      return { foot: geo!.footAt(p.row + (BOSS_H - 1) / 2, p.col + (BOSS_W - 1) / 2), size: bossSize };
    }
    const e = s.enemies.find((x) => x.id === enemyId) ?? s.enemies[0];
    return { foot: geo!.foot(e.row, e.col), size: foeSizeAt(e.row) };
  };
  const foePoint = (enemyId: number) => {
    const { foot, size } = foeFootOf(enemyId);
    return { x: foot.x, y: foot.y - size / 2 };
  };
  const figureSize = (row: number) => (geo ? Math.round(46 * geo.tileScale(row, 0)) : 30);
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
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 14, paddingBottom: 16 }}>
        {/* One panel for the fight's state: the foe's health, the turn order, stagger, tilt and the enrage clock. */}
        <View onLayout={(e) => setHudH(e.nativeEvent.layout.height)} style={{ borderWidth: 1, borderColor: GOLD_LINE, borderRadius: 12, backgroundColor: 'rgba(14,15,24,0.82)', padding: 10 }}>
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

        {/* Tactical grid */}
        <View style={{ marginTop: 10, marginHorizontal: -8 }}>
          <View onLayout={(e) => setFieldW(e.nativeEvent.layout.width)}>
          {use3d && fieldW ? (
            <Battle3D
              engine={engine} sim={s} theme={theme} height={fieldH} isBoss={isBossFight}
              bossArt={bossArt} roomArt={roomArt ? { brute: MONSTER_ART[roomArt.brute], archer: MONSTER_ART[roomArt.archer], shaman: MONSTER_ART[roomArt.shaman] } : undefined}
              bossMonster={engine.inArena ? ARENA_CHAMPION : dungeonForArt && BOSS_ART[dungeonForArt.id] ? MONSTER_LOOKS[BOSS_ART[dungeonForArt.id]] : undefined}
              roomMonsters={roomArt ? { brute: MONSTER_LOOKS[roomArt.brute], archer: MONSTER_LOOKS[roomArt.archer], shaman: MONSTER_LOOKS[roomArt.shaman], ...ROOM_BODIES[dungeonForArt!.locationId] } : undefined}
              focusId={focusId} current={current} reachable={reachableCells} heroGear={heroGear} intro={!!engine.bossIntro}
              onFail={(e) => { console.warn('3D battlefield failed, falling back to 2.5D', e); setFailed3d(true); }}
            />
          ) : (
          <View
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
                      if (engine.foeRects().some((f) => row >= f.row && row < f.row + f.h && col >= f.col && col < f.col + f.w)) return 'foe';
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
                      const { foot: f, size } = foeFootOf(-1);
                      figs.push({ y: f.y, node: (
                        <Glide key="boss" x={f.x - size / 2} y={f.y - size} passThrough style={{ width: size, height: size, zIndex: Math.round(f.y) }}>
                          <FootShadow at={{ x: size / 2, y: size }} width={size * 0.95} />
                          <FoeCell
                            icon="skull" hp={s.boss.hp} maxHp={s.boss.maxHp} alive={s.boss.hp > 0}
                            focused={false} isBoss poisoned={!!s.bossPoison} stunned={stunnedFoes} phase={s.phase} fx={s.fx}
                            overlay={s.iceShell ? <IceShellOverlay /> : null} art={bossArt} windup={s.windup}
                          />
                        </Glide>
                      ) });
                      // Skeletons the boss has raised.
                      s.minions.forEach((m) => {
                        const { foot: mf, size: ms } = foeFootOf(m.id);
                        figs.push({ y: mf.y + (m.alive ? 0.4 : 0), node: (
                          <Glide key={'minion' + m.id} x={mf.x - ms / 2} y={mf.y - ms} passThrough={s.movePhase} style={{ width: ms, height: ms, zIndex: Math.round(mf.y) + (m.alive ? 1 : 0) }}>
                            <FootShadow at={{ x: ms / 2, y: ms }} width={ms * 0.9} />
                            <FoeCell
                              testID={'enemy-' + m.id} icon={ENEMY_ICON.brute} name={m.name}
                              hp={m.hp} maxHp={m.maxHp} alive={m.alive} focused={m.alive && m.id === focusId} isBoss={false}
                              poisoned={false} stunned={false} fx={s.fx} onPress={() => engine.setFocus(m.id)}
                              art={roomArt ? MONSTER_ART[roomArt.brute] : undefined} windup={false}
                            />
                          </Glide>
                        ) });
                      });
                    } else {
                      s.enemies.forEach((e) => {
                        const { foot: f, size } = foeFootOf(e.id);
                        figs.push({ y: f.y + (e.alive ? 0.4 : 0), node: (
                          <Glide key={'foe' + e.id} x={f.x - size / 2} y={f.y - size} passThrough={s.movePhase} style={{ width: size, height: size, zIndex: Math.round(f.y) + (e.alive ? 1 : 0) }}>
                            <FootShadow at={{ x: size / 2, y: size }} width={size * 0.9} />
                            <FoeCell
                              testID={'enemy-' + e.id} icon={ENEMY_ICON[e.role]} name={e.name}
                              hp={e.hp} maxHp={e.maxHp} alive={e.alive} focused={e.alive && e.id === focusId} isBoss={false}
                              poisoned={s.bossPoison?.enemyId === e.id} stunned={stunnedFoes} fx={s.fx} onPress={() => engine.setFocus(e.id)}
                              art={roomArt ? MONSTER_ART[roomArt[e.role]] : undefined} windup={s.windup}
                            />
                          </Glide>
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
          )}
          {webgl && !failed3d ? (
            <Pressable
              testID="toggle-3d"
              onPress={() => engine.toggleView3d()}
              hitSlop={8}
              style={{ position: 'absolute', left: 10, top: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: GOLD_LINE, backgroundColor: 'rgba(14,15,24,0.7)' }}
            >
              <Text style={{ fontSize: 11, color: GOLD_TEXT, fontFamily: font.semibold }}>{use3d ? '3D' : '2.5D'}</Text>
            </Pressable>
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

/** Absolutely positioned box that slides to its new spot when an enemy walks, instead of jumping. */
function Glide({ x, y, style, passThrough, children }: { x: number; y: number; style: object; passThrough?: boolean; children: React.ReactNode }) {
  const ox = useRef(new Animated.Value(0)).current;
  const oy = useRef(new Animated.Value(0)).current;
  const prev = useRef({ x, y });
  useEffect(() => {
    const dx = prev.current.x - x; const dy = prev.current.y - y;
    prev.current = { x, y };
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    ox.setValue(dx); oy.setValue(dy);
    Animated.parallel([
      Animated.timing(ox, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(oy, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [x, y, ox, oy]);
  return (
    <Animated.View pointerEvents={passThrough ? 'none' : 'auto'} style={[{ position: 'absolute', left: x, top: y, transform: [{ translateX: ox }, { translateY: oy }] }, style]}>
      {children}
    </Animated.View>
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
