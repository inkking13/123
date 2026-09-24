import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { CombatFx } from '../combat/types';
import { colors, font } from '../theme/theme';
import { Icon, IconName } from './Icon';
import { ProgressBar } from './ProgressBar';

interface FloaterItem { id: number; delta: number; big: boolean; delay: number }

/** How long a hit should wait so it lands when the attack visually arrives (lunge peak / projectile impact). */
export const PROJECTILE_MS = 190;
export function impactDelay(fx: CombatFx): number {
  if (fx.kind === 'ranged' || fx.kind === 'ability' || fx.kind === 'heal') return PROJECTILE_MS;
  if (fx.kind === 'melee') return 90;
  return 0;
}

/** Watches an HP value and queues a floating "+N / −N" for every change. */
export function useHpFloaters(hp: number, isBig: () => boolean = () => false, getDelay: () => number = () => 0) {
  const [items, setItems] = useState<FloaterItem[]>([]);
  const prev = useRef(hp);
  const nextId = useRef(0);
  useEffect(() => {
    const delta = Math.round(hp - prev.current);
    prev.current = hp;
    if (delta !== 0) {
      const id = nextId.current++;
      setItems((xs) => [...xs, { id, delta, big: delta < 0 && isBig(), delay: getDelay() }]);
    }
    // isBig reads the latest fx at the moment HP changes; it's intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hp]);
  const remove = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id));
  return { items, remove };
}

export function Floaters({ items, remove }: { items: FloaterItem[]; remove: (id: number) => void }) {
  return (
    <>
      {items.map((it) => <Floater key={it.id} item={it} onDone={() => remove(it.id)} />)}
    </>
  );
}

function Floater({ item, onDone }: { item: FloaterItem; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(item.delay),
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(onDone);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const heal = item.delta > 0;
  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute', top: -6, left: -20, right: -20, textAlign: 'center', zIndex: 10,
        fontSize: item.big ? 17 : 13, fontFamily: font.bold,
        color: heal ? colors.good : item.big ? colors.warn : '#ff9d8f',
        textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 },
        opacity: v.interpolate({ inputRange: [0, 0.01, 0.65, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -30] }) },
          { scale: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.5, item.big ? 1.35 : 1.1, 1] }) },
        ],
      }}
    >
      {(heal ? '+' : '−') + Math.abs(item.delta)}
    </Animated.Text>
  );
}

/** Quick jolt + a flash overlay whenever the watched HP drops. */
export function useHitReaction(hp: number, getDelay: () => number = () => 0) {
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const prev = useRef(hp);
  useEffect(() => {
    if (hp < prev.current) {
      shake.setValue(0);
      Animated.sequence([
        Animated.delay(getDelay()),
        Animated.timing(flash, { toValue: 1, duration: 30, useNativeDriver: true }),
      ]).start();
      Animated.sequence([Animated.delay(getDelay()), Animated.parallel([
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 40, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0.5, duration: 45, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
        ]),
        Animated.timing(flash, { toValue: 0, duration: 320, delay: 30, useNativeDriver: true }),
      ])]).start();
    }
    prev.current = hp;
    // getDelay reads the fx of the action that caused this change; not a dependency on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hp, shake, flash]);
  return { shake, flash };
}

/** Plays a lunge/pulse on the actor whenever fx names them. */
export function useActorMotion(fx: CombatFx, isActor: (fx: CombatFx) => boolean, direction: 1 | -1) {
  const lunge = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (fx.seq === 0 || !isActor(fx)) return;
    if (fx.kind === 'melee' || fx.kind === 'enemy') {
      lunge.setValue(0);
      Animated.sequence([
        Animated.timing(lunge, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(lunge, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]).start();
    } else if (fx.kind === 'ranged') {
      lunge.setValue(0);
      Animated.sequence([
        Animated.timing(lunge, { toValue: -0.35, duration: 80, useNativeDriver: true }),
        Animated.spring(lunge, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 10 }),
      ]).start();
      pulse.setValue(1);
      Animated.timing(pulse, { toValue: 0, duration: 380, useNativeDriver: true }).start();
    } else {
      pulse.setValue(1);
      Animated.timing(pulse, { toValue: 0, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
    // Keyed on seq only: every action bumps it, and the actor check reads the fx it came with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx.seq]);
  return {
    translateY: lunge.interpolate({ inputRange: [-1, 1], outputRange: [-18 * direction, 18 * direction] }),
    scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }),
    glow: pulse,
  };
}

export function FoeCell({
  icon, name, hp, maxHp, alive, focused, isBoss, poisoned, stunned, phase = 1, fx, onPress, testID,
}: {
  icon: IconName; name?: string; hp: number; maxHp: number; alive: boolean; focused: boolean; isBoss: boolean;
  poisoned: boolean; stunned: boolean; phase?: number; fx: CombatFx; onPress?: () => void; testID?: string;
}) {
  const delay = () => (fx.actor !== 'enemy' ? impactDelay(fx) : 0);
  const { shake, flash } = useHitReaction(hp, delay);
  const floaters = useHpFloaters(hp, () => fx.crit && fx.actor !== 'enemy', delay);
  const motion = useActorMotion(fx, (f) => f.actor === 'enemy' && alive, 1);

  // Death: collapse and fade rather than snapping to the dead style.
  const life = useRef(new Animated.Value(alive ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(life, { toValue: alive ? 1 : 0, duration: alive ? 0 : 420, delay: alive ? 0 : delay() + 120, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
  }, [alive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stunned: a dizzy wobble with stars circling overhead.
  const wobble = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!stunned || !alive) { wobble.stopAnimation(); wobble.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(wobble, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(wobble, { toValue: -1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(wobble, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [stunned, alive, wobble]);

  // Boss phase change: a shockwave ring.
  const ring = useRef(new Animated.Value(0)).current;
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (phase > prevPhase.current) {
      ring.setValue(0);
      Animated.timing(ring, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
    prevPhase.current = phase;
  }, [phase, ring]);
  return (
    <Pressable
      testID={testID}
      disabled={!onPress || !alive}
      onPress={onPress}
      style={{ flex: 1, aspectRatio: 1, zIndex: 2 }}
    >
      <Animated.View
        style={{
          flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 2,
          borderWidth: focused ? 2.5 : 1.5,
          borderColor: focused ? colors.warn : alive ? colors.danger : colors.border,
          backgroundColor: alive ? 'rgba(209,104,92,0.12)' : 'transparent',
          opacity: life.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          transform: [
            { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) },
            { translateY: motion.translateY },
            { scale: life.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) },
            { rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) },
          ],
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 7, backgroundColor: fx.crit ? 'rgba(201,176,109,0.55)' : 'rgba(255,235,225,0.45)', opacity: flash }}
        />
        <View>
          <Icon name={alive ? icon : 'skull'} size={isBoss ? 26 : 17} color={alive ? colors.danger : colors.textFaint} weight={isBoss ? 'fill' : 'regular'} />
          {poisoned ? (
            <View style={{ position: 'absolute', right: -9, top: -3 }}><Icon name="drop" size={9} color={colors.good} /></View>
          ) : null}
        </View>
        {name ? <Text numberOfLines={1} style={{ fontSize: 9, color: focused ? colors.warn : colors.textDim, fontFamily: font.medium }}>{name}</Text> : null}
        {!isBoss ? (
          <View style={{ width: '72%' }}>
            <ProgressBar pct={(hp / maxHp) * 100} color={colors.danger} height={3} />
          </View>
        ) : null}
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 10, borderWidth: 3, borderColor: colors.danger,
          opacity: ring.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.9, 0] }),
          transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
        }}
      />
      {stunned && alive ? <DizzyStars /> : null}
      <Floaters items={floaters.items} remove={floaters.remove} />
    </Pressable>
  );
}

function DizzyStars() {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: -9, left: 0, right: 0, height: 18, alignItems: 'center', justifyContent: 'center',
        transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}
    >
      <Text style={{ fontSize: 10, color: colors.warn, letterSpacing: 6 }}>✦ ✦ ✦</Text>
    </Animated.View>
  );
}

/** A glowing bolt flying between two points of the battlefield, fired once per fx.seq. */
export function Projectile({ from, to, color, size = 10, onDone }: { from: { x: number; y: number }; to: { x: number; y: number }; color: string; size?: number; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: PROJECTILE_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(onDone);
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
  const dx = to.x - from.x; const dy = to.y - from.y;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: from.x - size / 2, top: from.y - size / 2, width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, zIndex: 20,
        shadowColor: color, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
        opacity: t.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0.4] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) },
        ],
      }}
    />
  );
}

/** Slowly breathing red glow on a cell that's about to be hit. */
export function DangerPulse() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 7, backgroundColor: 'rgba(209,104,92,0.35)', opacity: v }}
    />
  );
}

/** Pulsing ring marking whose turn it is. */
export function ActivePulse({ color }: { color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 10, borderWidth: 2, borderColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] }),
      }}
    />
  );
}

/** Fiery burst on a cell when a telegraphed zone lands on it. */
export function ImpactBurst({ seq, active, kind }: { seq: number; active: boolean; kind: 'meteor' | 'cleave' | null }) {
  const v = useRef(new Animated.Value(0)).current;
  const prev = useRef(seq);
  useEffect(() => {
    if (seq !== prev.current && active) {
      v.setValue(0);
      Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
    prev.current = seq;
  }, [seq, active, v]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 8, zIndex: 4,
        backgroundColor: kind === 'cleave' ? 'rgba(230,230,240,0.75)' : 'rgba(255,150,70,0.85)',
        opacity: v.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 1.08, 1] }) }],
      }}
    />
  );
}
