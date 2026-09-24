import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';
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
  icon, name, hp, maxHp, alive, focused, isBoss, poisoned, stunned, phase = 1, fx, onPress, testID, overlay, art,
}: {
  icon: IconName; name?: string; hp: number; maxHp: number; alive: boolean; focused: boolean; isBoss: boolean;
  poisoned: boolean; stunned: boolean; phase?: number; fx: CombatFx; onPress?: () => void; testID?: string; overlay?: React.ReactNode;
  /** Monster portrait; without it the cell falls back to the plain icon. */
  art?: any;
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
        {art ? (
          <>
            <Image source={art} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', borderRadius: 6 }} />
            {!isBoss ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%', borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: 'rgba(10,10,18,0.62)' }} /> : null}
          </>
        ) : null}
        {alive ? overlay : null}
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 7, backgroundColor: fx.crit ? 'rgba(201,176,109,0.55)' : 'rgba(255,235,225,0.45)', opacity: flash }}
        />
        {art ? (
          <View style={{ position: 'absolute', left: 3, right: 3, bottom: 3, alignItems: 'center', gap: 2 }}>
            {name ? <Text numberOfLines={1} style={{ fontSize: 9, color: focused ? colors.warn : '#e9e6f2', fontFamily: font.medium, textShadowColor: '#000', textShadowRadius: 2 }}>{name}</Text> : null}
            {!isBoss ? <View style={{ width: '86%' }}><ProgressBar pct={(hp / maxHp) * 100} color={colors.danger} height={3} /></View> : null}
          </View>
        ) : null}
        {art && !isBoss ? (
          <View style={{ position: 'absolute', top: 3, left: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(10,10,18,0.75)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={alive ? icon : 'skull'} size={10} color={alive ? colors.danger : colors.textFaint} />
          </View>
        ) : null}
        {art && poisoned ? (
          <View style={{ position: 'absolute', top: 3, right: 3 }}><Icon name="drop" size={11} color={colors.good} weight="fill" /></View>
        ) : null}
        {art ? null : <>
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
        </>}
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

/** A glowing bolt flying between two points of the battlefield, fired once per fx.seq; `arc` lobs it over the field. */
export function Projectile({ from, to, color, size = 10, arc = 0, onDone }: { from: { x: number; y: number }; to: { x: number; y: number }; color: string; size?: number; arc?: number; onDone: () => void }) {
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
          { translateY: Animated.add(
            t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }),
            t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -arc, 0] }),
          ) },
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

/** Looping 0→1→0 value, for anything that should breathe while a state lasts. */
function useLoop(duration: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return v;
}
function useSpin(duration: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
}

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/** Ice block over a frozen raider. */
export function FrozenOverlay() {
  const v = useLoop(1600);
  return (
    <Animated.View pointerEvents="none" style={{ ...FILL, top: -3, left: -3, right: -3, bottom: -3, borderRadius: 8, borderWidth: 1.5, borderColor: '#bfe6ff',
      backgroundColor: 'rgba(170,220,255,0.38)', opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }), alignItems: 'flex-end' }}>
      <Icon name="snowflake" size={9} color="#e8f6ff" />
    </Animated.View>
  );
}

/** Green bubbles drifting up off a poisoned raider. */
export function PoisonBubbles() {
  const a = useLoop(1400); const b = useLoop(1100); const c = useLoop(1700);
  const bubble = (v: Animated.Value, x: number, size: number) => (
    <Animated.View style={{ position: 'absolute', bottom: 2, left: x, width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(122,200,116,0.85)',
      opacity: v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 0.9, 0] }),
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) }] }} />
  );
  return (
    <View pointerEvents="none" style={FILL}>
      {bubble(a, 4, 4)}{bubble(b, 13, 3)}{bubble(c, 21, 5)}
    </View>
  );
}

/** Shimmering ring for shields (and a hot red one for berserk). */
export function AuraRing({ color, fast = false }: { color: string; fast?: boolean }) {
  const v = useLoop(fast ? 520 : 1300);
  return (
    <Animated.View pointerEvents="none" style={{ ...FILL, top: -5, left: -5, right: -5, bottom: -5, borderRadius: 11, borderWidth: 2, borderColor: color,
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.95] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] }) }] }} />
  );
}

/** Slowly turning crosshair over the raider the General ordered shot. */
export function Crosshair() {
  const rotate = useSpin(2600);
  const v = useLoop(700);
  return (
    <Animated.View pointerEvents="none" style={{ ...FILL, top: -6, left: -6, right: -6, bottom: -6, alignItems: 'center', justifyContent: 'center',
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }), transform: [{ rotate }] }}>
      <Icon name="target" size={42} color={colors.danger} />
    </Animated.View>
  );
}

/** Bobbing gold coin on the raider holding the Usurer's debt note. */
export function DebtCoin() {
  const v = useLoop(900);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -10, right: -8, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }}>
      <Icon name="coins" size={13} color={colors.warn} weight="fill" />
    </Animated.View>
  );
}

/** Small shield that pops in when a raider takes the defend stance. */
export function DefendBadge() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }).start(); }, [v]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -8, left: -8, transform: [{ scale: v }] }}>
      <Icon name="shield" size={13} color={colors.accentSoft} weight="fill" />
    </Animated.View>
  );
}

/** Molten glow on a lava cell. */
export function LavaGlow() {
  const v = useLoop(1500);
  return <Animated.View pointerEvents="none" style={{ ...FILL, borderRadius: 7, backgroundColor: 'rgba(255,120,40,0.35)', opacity: v }} />;
}

/** Frost sheen over the Jarl while his ice shell holds. */
export function IceShellOverlay() {
  const v = useLoop(1800);
  return (
    <Animated.View pointerEvents="none" style={{ ...FILL, borderRadius: 7, borderWidth: 2, borderColor: '#bfe6ff', backgroundColor: 'rgba(170,220,255,0.3)',
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }), alignItems: 'flex-end', padding: 2 }}>
      <Icon name="snowflake" size={11} color="#e8f6ff" />
    </Animated.View>
  );
}

/** A pulsing line between two battlefield points (death beam lock-on, chains). */
export function Tether({ from, to, color, thickness = 2 }: { from: { x: number; y: number }; to: { x: number; y: number }; color: string; thickness?: number }) {
  const v = useLoop(600);
  const dx = to.x - from.x; const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: (from.x + to.x) / 2 - len / 2, top: (from.y + to.y) / 2 - thickness / 2, width: len, height: thickness,
        borderRadius: thickness, backgroundColor: color, zIndex: 15,
        shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.95] }),
        transform: [{ rotate: angle + 'deg' }],
      }}
    />
  );
}

/** Gold shockwave rolling out from whoever rallied the squad. */
export function RallyWave({ at, onDone, squash = 1 }: { at: { x: number; y: number }; onDone: () => void; squash?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 750, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(onDone);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const size = 60;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: at.x - size / 2, top: at.y - size / 2, width: size, height: size, borderRadius: size / 2,
        borderWidth: 3, borderColor: colors.warn, zIndex: 16,
        opacity: v.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.9, 0] }),
        transform: [
          { scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 6] }) },
          { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [0.4 * squash, 6 * squash] }) },
        ],
      }}
    />
  );
}

// Each move is animated once, even though the token remounts in its new cell.
const slidDone = new WeakSet<object>();
/** Glide in from the cell the raider just left; `offsetOf` gives that cell's screen offset from the current one. */
export function useSlideIn(
  moveFx: { seq: number; id: number; fromRow: number; fromCol: number } | null,
  raiderId: number, row: number, col: number,
  offsetOf: ((fromRow: number, fromCol: number) => { dx: number; dy: number }) | null,
) {
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!moveFx || moveFx.id !== raiderId || !offsetOf || slidDone.has(moveFx)) return;
    slidDone.add(moveFx);
    const { dx, dy } = offsetOf(moveFx.fromRow, moveFx.fromCol);
    x.setValue(dx);
    y.setValue(dy);
    Animated.parallel([
      Animated.spring(x, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }),
      Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 4 }),
    ]).start();
    // offsetOf is rebuilt every render from the same geometry; the move itself is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveFx, raiderId, row, col, x, y]);
  return { x, y };
}
