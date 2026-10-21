import React, { useRef } from 'react';
import { Animated, ImageBackground, Pressable, Text, View, StyleProp, ViewStyle } from 'react-native';
import { colors, font, ink } from '../theme/theme';
import { PAPER } from './Frame';
import { Icon, IconName } from './Icon';
import type { GameEngine } from '../engine/GameEngine';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  trailingIcon?: IconName;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({ label, onPress, icon, trailingIcon, disabled, height = 50, style }: PrimaryButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPress={disabled ? undefined : onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={{ opacity: disabled ? 0.4 : 1 }}>
        {({ pressed }) => (
          <View style={{ height, borderRadius: 4, borderWidth: 1, borderColor: '#120c07', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 }}>
            {/* A strip of parchment with the order inked on it. */}
            <ImageBackground
              source={PAPER} resizeMode="stretch" imageStyle={{ borderRadius: 3 }}
              style={{
                flex: 1, borderRadius: 3, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
                justifyContent: trailingIcon ? 'space-between' : 'center',
              }}
            >
              {pressed ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 3, backgroundColor: 'rgba(60,35,15,0.18)' }} /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {icon ? <Icon name={icon} size={18} color={ink.text} /> : null}
                <Text style={{ color: ink.text, fontFamily: font.title, fontSize: 17, letterSpacing: 0.4 }}>{label}</Text>
              </View>
              {trailingIcon ? <Icon name={trailingIcon} size={18} color={ink.text} /> : null}
            </ImageBackground>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function SecondaryButton({ label, onPress, height = 46, style }: { label: string; onPress: () => void; height?: number; style?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => ({
          height, borderRadius: 6, borderWidth: 1, paddingHorizontal: 18,
          borderColor: pressed ? colors.borderHover : colors.borderStrong, backgroundColor: pressed ? 'rgba(199,157,94,0.1)' : 'rgba(16,12,9,0.75)',
          alignItems: 'center', justifyContent: 'center',
        })}
      >
        <Text style={{ color: colors.textMuted, fontFamily: font.caps, fontSize: 15, letterSpacing: 0.3 }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Back links and small header actions: a dark pill in a bronze rim. */
export function GhostLink({ label, onPress, icon }: { label: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
        height: 30, paddingHorizontal: 11, borderRadius: 15, borderWidth: 1,
        borderColor: pressed ? '#b8935c' : '#4d3b29', backgroundColor: pressed ? 'rgba(199,157,94,0.12)' : 'rgba(18,13,9,0.85)',
      })}
    >
      {icon ? <Icon name={icon} size={13} color="#d9c595" /> : null}
      <Text style={{ color: '#dcc699', fontFamily: font.medium, fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
}

/** The "back" pill: returns to the screen the player came from and names it. */
export function BackLink({ engine }: { engine: GameEngine }) {
  return <GhostLink label={engine.backLabel()} icon="arrow-left" onPress={() => engine.back()} />;
}
