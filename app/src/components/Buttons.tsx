import React, { useRef } from 'react';
import { Animated, Pressable, Text, View, StyleProp, ViewStyle } from 'react-native';
import { colors, font } from '../theme/theme';
import { Icon, IconName } from './Icon';

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
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={({ pressed }) => ({
          height, borderRadius: 8, borderWidth: 1,
          borderColor: pressed ? colors.accentBright : colors.accent,
          backgroundColor: pressed ? colors.accentWashStrong : 'transparent',
          alignItems: 'center', justifyContent: trailingIcon ? 'space-between' : 'center',
          flexDirection: 'row', paddingHorizontal: 20, opacity: disabled ? 0.4 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Icon name={icon} size={18} color={colors.accentSoft} /> : null}
          <Text style={{ color: colors.accentSoft, fontFamily: font.medium, fontSize: 15 }}>{label}</Text>
        </View>
        {trailingIcon ? <Icon name={trailingIcon} size={18} color={colors.accentSoft} /> : null}
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
          height, borderRadius: 8, borderWidth: 1, paddingHorizontal: 18,
          borderColor: colors.borderStrong, backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        })}
      >
        <Text style={{ color: colors.textDim, fontFamily: font.medium, fontSize: 14 }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function GhostLink({ label, onPress, icon }: { label: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
      {icon ? <Icon name={icon} size={14} color={colors.textDim} /> : null}
      <Text style={{ color: colors.textDim, fontFamily: font.regular, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}
