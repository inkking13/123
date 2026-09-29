import React, { useRef } from 'react';
import { Animated, Pressable, Text, View, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, font } from '../theme/theme';
import { Corners } from './Frame';
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
      <Pressable onPress={disabled ? undefined : onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={{ opacity: disabled ? 0.4 : 1 }}>
        {({ pressed }) => (
          <View style={{ height, borderRadius: 6, borderWidth: 1, borderColor: pressed ? '#f0d28e' : '#b8925a' }}>
            {/* Burnished bronze plate with a lit top edge. */}
            <LinearGradient
              colors={pressed ? ['#6e5030', '#3d2b1a'] : ['#5a4127', '#2c1f14']}
              style={{
                flex: 1, borderRadius: 5, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
                justifyContent: trailingIcon ? 'space-between' : 'center',
              }}
            >
              <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 10, right: 10, height: 1, backgroundColor: 'rgba(255,228,170,0.35)' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {icon ? <Icon name={icon} size={18} color="#f4e4bf" /> : null}
                <Text style={{ color: '#f4e4bf', fontFamily: font.semibold, fontSize: 15, letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>{label}</Text>
              </View>
              {trailingIcon ? <Icon name={trailingIcon} size={18} color="#f4e4bf" /> : null}
            </LinearGradient>
            <Corners color="#f0d28e" size={8} />
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
          borderColor: pressed ? '#8a7650' : colors.borderStrong, backgroundColor: pressed ? 'rgba(201,163,107,0.08)' : 'rgba(18,16,20,0.6)',
          alignItems: 'center', justifyContent: 'center',
        })}
      >
        <Text style={{ color: colors.textMuted, fontFamily: font.medium, fontSize: 14 }}>{label}</Text>
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
