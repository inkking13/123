import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { CombatFx } from '../combat/types';
import { colors, font } from '../theme/theme';
import { Icon, IconName } from './Icon';
import { ProgressBar } from './ProgressBar';

interface FloaterItem { id: number; delta: number; big: boolean }

/** Watches an HP value and queues a floating "+N / −N" for every change. */
export function useHpFloaters(hp: number, isBig: () => boolean = () => false) {
  const [items, setItems] = useState<FloaterItem[]>([]);
  const prev = useRef(hp);
  const nextId = useRef(0);
  useEffect(() => {
    const delta = Math.round(hp - prev.current);
    prev.current = hp;
    if (delta !== 0) {
      const id = nextId.current++;
      setItems((xs) => [...xs, { id, delta, big: delta < 0 && isBig() }]);
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
    Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(onDone);
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
        opacity: v.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 1, 0] }),
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
export function useHitReaction(hp: number) {
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const prev = useRef(hp);
  useEffect(() => {
    if (hp < prev.current) {
      shake.setValue(0); flash.setValue(1);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 40, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0.5, duration: 45, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
        ]),
        Animated.timing(flash, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    }
    prev.current = hp;
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
  icon, name, hp, maxHp, alive, focused, isBoss, poisoned, fx, onPress, testID,
}: {
  icon: IconName; name?: string; hp: number; maxHp: number; alive: boolean; focused: boolean; isBoss: boolean;
  poisoned: boolean; fx: CombatFx; onPress?: () => void; testID?: string;
}) {
  const { shake, flash } = useHitReaction(hp);
  const floaters = useHpFloaters(hp, () => fx.crit && fx.actor !== 'enemy');
  const motion = useActorMotion(fx, (f) => f.actor === 'enemy' && alive, 1);
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
          opacity: alive ? 1 : 0.35,
          transform: [
            { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] }) },
            { translateY: motion.translateY },
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
      <Floaters items={floaters.items} remove={floaters.remove} />
    </Pressable>
  );
}
