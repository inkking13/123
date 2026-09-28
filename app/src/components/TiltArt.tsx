import React, { useState } from 'react';
import { Animated, ImageSourcePropType, LayoutChangeEvent, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTilt } from './useTilt';

/**
 * Wide key art covering its box, cropped round `focusX` (0..1 across the
 * picture). Tilting the phone pans across it — like looking through a
 * window — with a little vertical drift; the bottom fades into the page.
 */
const SHADE = 'rgba(14,15,24,0.92)';

export function TiltArt({ source, aspect, focusX, style, fadeFrom = 0.55, testID }: {
  source: ImageSourcePropType; aspect: number; focusX: number; style: ViewStyle; fadeFrom?: number; testID?: string;
}) {
  const tilt = useTilt();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  // A touch taller than the box so there's room to drift up and down.
  const imgH = box.h * 1.08;
  const imgW = Math.max(box.w, imgH * aspect);
  const left = Math.min(0, Math.max(box.w - imgW, box.w / 2 - imgW * focusX));
  // How far the art can slide each way from its resting crop.
  const toLeftEdge = -left;
  const toRightEdge = left - (box.w - imgW);
  const slideY = (imgH - box.h) / 2;
  const tx = tilt.x.interpolate({ inputRange: [-1, 0, 1], outputRange: [toLeftEdge, 0, -toRightEdge], extrapolate: 'clamp' });
  const ty = tilt.y.interpolate({ inputRange: [-1, 1], outputRange: [slideY, -slideY], extrapolate: 'clamp' });
  return (
    <View onLayout={onLayout} onTouchStart={tilt.askPermission} pointerEvents="box-none" style={style}>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' }}>
      {box.w > 0 ? (
        <Animated.Image
          testID={testID}
          source={source}
          resizeMode="cover"
          style={{ position: 'absolute', left, top: -slideY, width: imgW, height: imgH, transform: [{ translateX: tx }, { translateY: ty }] }}
        />
      ) : null}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(14,15,24,0)', 'rgba(14,15,24,0)', SHADE]}
        locations={[0, fadeFrom, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      </View>
      {/* The shade runs on past the art and thins out over the stone wall behind the page. */}
      <LinearGradient
        pointerEvents="none"
        colors={[SHADE, 'rgba(14,15,24,0)']}
        style={{ position: 'absolute', left: 0, right: 0, top: '100%', height: 110 }}
      />
    </View>
  );
}
