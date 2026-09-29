import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas } from './r3f';
import { qualityProfile } from './quality';
import { FrameCap } from './FrameCap';
import { Arena3D, ArenaProps, Orbit } from './Arena3D';
import { Projection } from './projection';
import { CAMERA_HOME } from './world';
import { use3dProbe } from './probe3d';
import { GameEngine } from '../engine/GameEngine';
import { GRID_COLS, GRID_ROWS, Raider, Sim } from '../combat/types';
import { Floaters, impactDelay, useHpFloaters } from '../components/CombatFx';
import { ProgressBar } from '../components/ProgressBar';
import { Icon } from '../components/Icon';
import { colors, font, roleColor } from '../theme/theme';

/** True when this device can draw WebGL (always assumed on native, where expo-gl provides it). */
export function canRender3D(): boolean {
  if (Platform.OS !== 'web') return true;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** How long the 3D field may take to load before the fight offers a retry on lighter graphics (weak phones can stall for good). */
const LOAD_TIMEOUT_MS = 30000;

/** Mounted once everything under the Suspense boundary has loaded. */
function Loaded({ onLoad }: { onLoad: () => void }) {
  useEffect(() => { onLoad(); }, []);
  return null;
}

/** Any render error inside a 3D view is reported (the fight offers a retry) instead of crashing the app. */
export class Guard extends Component<{ onFail: (e: unknown) => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { this.props.onFail(e); }
  render() { return this.state.failed ? null : this.props.children; }
}

function RaiderTag({ r, sim, proj }: { r: Raider; sim: Sim; proj: Projection }) {
  const box = proj.box('r' + r.id);
  const fx = sim.fx;
  const floaters = useHpFloaters(r.hp, () => false, () => (fx.kind === 'heal' || fx.kind === 'ability') && fx.targetRaider === r.id ? impactDelay(fx) : 0);
  const hpPct = Math.max(0, (r.hp / r.maxHp) * 100);
  const hpColor = hpPct > 60 ? colors.good : hpPct > 30 ? colors.warn : colors.danger;
  const alive = r.alive;
  const icons: { name: Parameters<typeof Icon>[0]['name']; color: string }[] = [];
  if (alive && sim.poison?.targetId === r.id) icons.push({ name: 'drop', color: colors.good });
  if (alive && sim.execution?.targetId === r.id) icons.push({ name: 'target', color: colors.danger });
  if (alive && sim.debt?.targetId === r.id && !sim.debt.paid) icons.push({ name: 'coins', color: colors.warn });
  if (alive && r.defending) icons.push({ name: 'shield', color: colors.accentSoft });
  if (alive && sim.frozen?.targetId === r.id) icons.push({ name: 'snowflake', color: '#bfe6ff' });
  if (alive && r.chainPartner != null) icons.push({ name: 'shield-chevron', color: colors.accent });
  if (alive && r.ability.active) icons.push({ name: r.ability.icon, color: roleColor[r.role] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: box.left, top: box.top }}>
      <View style={{ position: 'absolute', left: -24, top: -12, width: 48, alignItems: 'center' }}>
        {icons.length ? (
          <View style={{ flexDirection: 'row', gap: 2, marginBottom: 2 }}>
            {icons.map((ic, i) => <Icon key={i} name={ic.name} size={10} color={ic.color} weight="fill" />)}
          </View>
        ) : null}
        {alive ? <View style={{ width: 40 }}><ProgressBar pct={hpPct} color={hpColor} height={4} /></View> : null}
        <View style={{ position: 'absolute', top: -6, left: 0, right: 0, alignItems: 'center' }}>
          <Floaters items={floaters.items} remove={floaters.remove} />
        </View>
      </View>
    </Animated.View>
  );
}

function FoeOverlay({ proj, keyName, name, hp, maxHp, alive, isBoss, sim, focused, onPress, testID }: {
  proj: Projection; keyName: string; name?: string; hp: number; maxHp: number; alive: boolean; isBoss: boolean;
  sim: Sim; focused: boolean; onPress?: () => void; testID?: string;
}) {
  const box = proj.box(keyName);
  const fx = sim.fx;
  const delay = () => (fx.actor !== 'enemy' ? impactDelay(fx) : 0);
  const floaters = useHpFloaters(hp, () => fx.crit && fx.actor !== 'enemy', delay);
  return (
    <Animated.View
      // While a raider is choosing a cell, taps go through the figure to the tile under it.
      pointerEvents={sim.movePhase ? 'none' : 'box-none'}
      style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height, zIndex: 5 }}
    >
      <Pressable testID={testID} disabled={!onPress || !alive} onPress={onPress} style={{ flex: 1 }}>
        {!isBoss ? (
          <View style={{ position: 'absolute', left: -30, right: -30, top: '100%', marginTop: 6, alignItems: 'center', gap: 2 }}>
            {name ? <Text numberOfLines={1} style={{ fontSize: 9.5, color: focused ? colors.warn : '#f0ecf6', fontFamily: font.medium, textShadowColor: '#000', textShadowRadius: 3 }}>{name}</Text> : null}
            {alive ? <View style={{ width: 54 }}><ProgressBar pct={(hp / maxHp) * 100} color={colors.danger} height={3} /></View> : null}
          </View>
        ) : null}
        {alive && (sim.stunned || sim.vulnerableRounds > 0) ? (
          <Text style={{ position: 'absolute', top: -14, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: colors.warn, letterSpacing: 6 }}>✦ ✦ ✦</Text>
        ) : null}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
          <Floaters items={floaters.items} remove={floaters.remove} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function TileTarget({ proj, row, col, enabled, onPress }: { proj: Projection; row: number; col: number; enabled: boolean; onPress: () => void }) {
  const box = proj.box(`tile-${row}-${col}`);
  return (
    <Animated.View style={{ position: 'absolute', left: box.left, top: box.top, width: box.width, height: box.height }}>
      <Pressable testID={'cell-' + row + '-' + col} disabled={!enabled} onPress={onPress} style={{ flex: 1 }} />
    </Animated.View>
  );
}

/** Darkened edges over the 3D view, so the eye goes to the board. */
/** A white flash when a crit lands; a red glow breathing round the edges while the enemy winds up a heavy blow. */
function Flashes({ sim }: { sim: Sim }) {
  const flash = useRef(new Animated.Value(0)).current;
  const warn = useRef(new Animated.Value(0)).current;
  const seen = useRef(sim.fx.seq);
  useEffect(() => {
    const f = sim.fx;
    if (f.seq === seen.current) return;
    seen.current = f.seq;
    if (!f.crit || typeof f.actor !== 'number') return;
    flash.setValue(0);
    Animated.sequence([
      Animated.delay(impactDelay(f)),
      Animated.timing(flash, { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [sim.fx.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sim.windup) { warn.stopAnimation(); Animated.timing(warn, { toValue: 0, duration: 250, useNativeDriver: true }).start(); return; }
    const a = Animated.loop(Animated.sequence([
      Animated.timing(warn, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(warn, { toValue: 0.35, duration: 420, useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [sim.windup, warn]);
  const red = 'rgba(200,20,10,0.38)', none = 'rgba(200,20,10,0)';
  return (
    <>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: warn }}>
        <LinearGradient colors={[red, none]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '14%' }} />
        <LinearGradient colors={[none, red]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '14%' }} />
        <LinearGradient colors={[red, none]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '10%' }} />
        <LinearGradient colors={[none, red]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '10%' }} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: '#fff6dc', opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.32] }) }} />
    </>
  );
}

function Vignette() {
  const dark = 'rgba(6,4,10,0.6)'; const clear = 'rgba(6,4,10,0)';
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <LinearGradient colors={[dark, clear]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '16%' }} />
      <LinearGradient colors={[clear, dark]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '20%' }} />
      <LinearGradient colors={[dark, clear]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '12%' }} />
      <LinearGradient colors={[clear, dark]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '12%' }} />
    </View>
  );
}

export function Battle3D(props: Omit<ArenaProps, 'proj'> & { engine: GameEngine; height: number; onFail: (e: unknown) => void; full?: boolean; onToggleFull?: () => void; overlay?: React.ReactNode }) {
  const { engine, sim, height, onFail, isBoss, focusId, current, reachable } = props;
  const proj = useRef(new Projection()).current;
  use3dProbe();
  const quality = engine.settings.quality;
  const q = useMemo(() => qualityProfile(quality), [quality]);
  // Close-up by default: on a phone the whole board makes the figures tiny.
  const [closeUp, setCloseUp] = useState(true);
  // Drag sideways anywhere on the field to walk the camera round the board (taps still reach tiles and foes).
  const orbit = useRef<Orbit>({ yaw: 0 });
  const [turned, setTurned] = useState(false);
  const startYaw = useRef(0);
  // A drag ends in a click on whatever is under the finger (on the web): swallow that one.
  const dragged = useRef(0);
  const tap = (fn: () => void) => () => { if (Date.now() - dragged.current > 250) fn(); };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderGrant: () => { startYaw.current = orbit.current.yaw; dragged.current = Date.now(); },
    onPanResponderMove: (_, g) => { orbit.current.yaw = startYaw.current - g.dx * 0.012; dragged.current = Date.now(); },
    onPanResponderRelease: () => {
      // Keep it within one turn either way.
      const y = orbit.current.yaw; orbit.current.yaw = Math.atan2(Math.sin(y), Math.cos(y));
      setTurned(Math.abs(orbit.current.yaw) > 0.05);
      dragged.current = Date.now();
    },
    onPanResponderTerminationRequest: () => false,
  }), []);
  // Say it's loading instead of showing an empty field, and give up on 3D if it never arrives.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => onFail(new Error('3D battlefield did not load in time')), LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [loaded]);
  const camera = useMemo(() => ({ position: CAMERA_HOME.toArray() as [number, number, number], fov: 50, near: 0.1, far: 200 }), []);
  return (
    <View {...pan.panHandlers} style={{ height, borderRadius: 10, overflow: 'hidden', backgroundColor: props.theme.sky[2] }}>
      <Guard onFail={onFail}>
        <Canvas key={quality} camera={camera} style={{ flex: 1 }} frameloop={q.fps ? 'demand' : 'always'} gl={{ antialias: q.antialias }} onCreated={(st) => st.setDpr(q.dpr)}>
          <FrameCap fps={q.fps} />
          <Suspense fallback={null}>
            <Arena3D {...props} proj={proj} closeUp={closeUp} weather={q.weather} orbit={orbit} />
            <Loaded onLoad={() => setLoaded(true)} />
          </Suspense>
        </Canvas>
      </Guard>
      {!loaded ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: font.medium }}>Загружаю поле боя…</Text>
        </View>
      ) : null}
      <Vignette />
      <Flashes sim={sim} />
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        {Array.from({ length: GRID_ROWS }).flatMap((_, row) => Array.from({ length: GRID_COLS }).map((__, col) => {
          const isSelf = !!current && current.row === row && current.col === col;
          const reach = sim.movePhase && reachable.some((c) => c.row === row && c.col === col);
          return (
            <TileTarget
              key={row + '-' + col} proj={proj} row={row} col={col}
              enabled={reach || (sim.movePhase && isSelf)}
              onPress={tap(() => (isSelf ? engine.skipMove() : engine.moveRaider(row, col)))}
            />
          );
        }))}
        {isBoss ? (
          <FoeOverlay proj={proj} keyName="boss" hp={sim.boss.hp} maxHp={sim.boss.maxHp} alive={sim.boss.hp > 0} isBoss sim={sim} focused={false} onPress={sim.minions.length ? tap(() => engine.setFocus(-1)) : undefined} />
        ) : null}
        {(isBoss ? sim.minions : sim.enemies).map((e) => (
          <FoeOverlay
            key={e.id} proj={proj} keyName={'e' + e.id} testID={'enemy-' + e.id} name={e.name} hp={e.hp} maxHp={e.maxHp} alive={e.alive}
            isBoss={false} sim={sim} focused={e.alive && e.id === focusId} onPress={tap(() => engine.setFocus(e.id))}
          />
        ))}
        {sim.raiders.map((r) => <RaiderTag key={r.id} r={r} sim={sim} proj={proj} />)}
      </View>
      <Pressable
        testID="camera-toggle"
        onPress={() => setCloseUp((v) => !v)}
        hitSlop={8}
        style={{
          position: 'absolute', right: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 5,
          paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: 'rgba(12,12,20,0.62)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
        }}
      >
        <Icon name={closeUp ? 'path' : 'target'} size={13} color="#e8e4f2" />
        <Text style={{ fontSize: 11.5, color: '#e8e4f2', fontFamily: font.medium }}>{closeUp ? 'Обзор' : 'Крупно'}</Text>
      </Pressable>
      {props.onToggleFull ? (
        <Pressable
          testID="fullscreen-toggle"
          onPress={props.onToggleFull}
          hitSlop={8}
          style={{
            position: 'absolute', right: 8, top: 42, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(12,12,20,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <Icon name={props.full ? 'arrows-in' : 'arrows-out'} size={14} color="#e8e4f2" />
        </Pressable>
      ) : null}
      {turned ? (
        <Pressable
          testID="camera-reset"
          onPress={() => { orbit.current.yaw = 0; setTurned(false); }}
          hitSlop={8}
          style={{
            position: 'absolute', right: 8, bottom: props.full ? 42 : 10, height: 28, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: 'rgba(12,12,20,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
          }}
        >
          <Icon name="arrow-left" size={12} color="#e8e4f2" />
          <Text style={{ fontSize: 11.5, color: '#e8e4f2', fontFamily: font.medium }}>Прямо</Text>
        </Pressable>
      ) : null}
      {props.overlay}
    </View>
  );
}
