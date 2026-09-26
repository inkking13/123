import React, { Component, Suspense, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { Canvas } from './r3f';
import { Arena3D, ArenaProps } from './Arena3D';
import { Projection } from './projection';
import { CAMERA_HOME } from './world';
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

/** Any render error inside the 3D view drops the fight back to the 2.5D stage instead of crashing it. */
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

export function Battle3D(props: Omit<ArenaProps, 'proj'> & { engine: GameEngine; height: number; onFail: (e: unknown) => void }) {
  const { engine, sim, height, onFail, isBoss, focusId, current, reachable } = props;
  const proj = useRef(new Projection()).current;
  const camera = useMemo(() => ({ position: CAMERA_HOME.toArray() as [number, number, number], fov: 50, near: 0.1, far: 200 }), []);
  return (
    <View style={{ height, borderRadius: 10, overflow: 'hidden', backgroundColor: props.theme.sky[2] }}>
      <Guard onFail={onFail}>
        <Canvas camera={camera} style={{ flex: 1 }} gl={{ antialias: true }}>
          <Suspense fallback={null}>
            <Arena3D {...props} proj={proj} />
          </Suspense>
        </Canvas>
      </Guard>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        {Array.from({ length: GRID_ROWS }).flatMap((_, row) => Array.from({ length: GRID_COLS }).map((__, col) => {
          const isSelf = !!current && current.row === row && current.col === col;
          const reach = sim.movePhase && reachable.some((c) => c.row === row && c.col === col);
          return (
            <TileTarget
              key={row + '-' + col} proj={proj} row={row} col={col}
              enabled={reach || (sim.movePhase && isSelf)}
              onPress={() => (isSelf ? engine.skipMove() : engine.moveRaider(row, col))}
            />
          );
        }))}
        {isBoss ? (
          <FoeOverlay proj={proj} keyName="boss" hp={sim.boss.hp} maxHp={sim.boss.maxHp} alive={sim.boss.hp > 0} isBoss sim={sim} focused={false} />
        ) : sim.enemies.map((e) => (
          <FoeOverlay
            key={e.id} proj={proj} keyName={'e' + e.id} testID={'enemy-' + e.id} name={e.name} hp={e.hp} maxHp={e.maxHp} alive={e.alive}
            isBoss={false} sim={sim} focused={e.alive && e.id === focusId} onPress={() => engine.setFocus(e.id)}
          />
        ))}
        {sim.raiders.map((r) => <RaiderTag key={r.id} r={r} sim={sim} proj={proj} />)}
      </View>
    </View>
  );
}
