import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Polygon, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { FieldGeometry, Pt } from '../combat/perspective';
import { GRID_COLS, GRID_ROWS } from '../combat/types';
import { colors } from '../theme/theme';

export type TileState = 'plain' | 'reachable' | 'self' | 'danger' | 'lava' | 'foe';

const TILE_FILL: Record<TileState, string> = {
  plain: 'rgba(120,118,150,0.10)',
  reachable: 'rgba(145,132,217,0.30)',
  self: 'rgba(210,206,253,0.22)',
  danger: 'rgba(209,104,92,0.34)',
  lava: 'rgba(217,128,63,0.38)',
  foe: 'rgba(209,104,92,0.16)',
};
const TILE_STROKE: Record<TileState, string> = {
  plain: 'rgba(160,160,190,0.22)',
  reachable: colors.accent,
  self: colors.accentSoft,
  danger: colors.danger,
  lava: '#d9803f',
  foe: 'rgba(209,104,92,0.45)',
};

/** Stone floor under the grid: board slab and one quad per tile. */
export function Floor({ geo, tileState, palette }: {
  geo: FieldGeometry; tileState: (row: number, col: number) => TileState;
  palette: { far: string; near: string; tile: string; stroke: string };
}) {
  return (
    <Svg width={geo.width} height={geo.height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Defs>
        <SvgGradient id="slab" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.far} stopOpacity="0.55" />
          <Stop offset="0.45" stopColor={palette.far} stopOpacity="0.95" />
          <Stop offset="1" stopColor={palette.near} stopOpacity="1" />
        </SvgGradient>
      </Defs>
      <Polygon points={geo.boardPoints} fill="url(#slab)" />
      {Array.from({ length: GRID_ROWS }).flatMap((_, row) =>
        Array.from({ length: GRID_COLS }).map((__, col) => {
          const st = tileState(row, col);
          return (
            <Polygon
              key={row + '-' + col}
              points={geo.tilePoints(row, col)}
              fill={st === 'plain' ? palette.tile : TILE_FILL[st]}
              stroke={st === 'plain' ? palette.stroke : TILE_STROKE[st]}
              strokeWidth={st === 'plain' ? 1 : 1.6}
            />
          );
        }),
      )}
    </Svg>
  );
}

function useBreath(duration: number) {
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

/** A breathing glow painted onto one floor tile (danger, lava, whose turn). */
export function TileGlow({ geo, row, col, color, stroke, duration = 1040, min = 0.15, max = 1 }: {
  geo: FieldGeometry; row: number; col: number; color: string; stroke?: string; duration?: number; min?: number; max?: number;
}) {
  const v = useBreath(duration);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: geo.width, height: geo.height, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [min, max] }) }}>
      <Svg width={geo.width} height={geo.height}>
        <Polygon points={geo.tilePoints(row, col)} fill={color} stroke={stroke ?? 'none'} strokeWidth={2.2} />
      </Svg>
    </Animated.View>
  );
}

/** A telegraphed zone landing: the tile flashes and a column of fire (or a steel arc) rises off it. */
// Plays once on mount — the caller keys it by the impact's seq.
export function TileImpact({ geo, row, col, kind }: { geo: FieldGeometry; row: number; col: number; kind: 'meteor' | 'cleave' }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 560, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [v]);
  const foot = geo.foot(row, col);
  const s = geo.tileScale(row, col);
  const w = (geo.width / GRID_COLS) * s * 0.8;
  const h = 70 * s;
  const hot = kind === 'meteor';
  return (
    <>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: geo.width, height: geo.height, zIndex: 900,
        opacity: v.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 0] }) }}>
        <Svg width={geo.width} height={geo.height}>
          <Polygon points={geo.tilePoints(row, col)} fill={hot ? 'rgba(255,150,70,0.9)' : 'rgba(230,230,240,0.8)'} />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', left: foot.x - w / 2, top: foot.y - h, width: w, height: h, zIndex: 901,
        opacity: v.interpolate({ inputRange: [0, 0.1, 0.6, 1], outputRange: [0, 1, 0.8, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 0.35], outputRange: [h / 2, 0], extrapolate: 'clamp' }) },
          { scaleY: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.02, 1, 1.15] }) },
        ],
      }}>
        <LinearGradient
          colors={hot ? ['rgba(255,220,120,0)', 'rgba(255,150,60,0.85)', 'rgba(255,90,40,0.95)'] : ['rgba(240,240,255,0)', 'rgba(230,230,245,0.8)', 'rgba(255,255,255,0.95)']}
          style={{ flex: 1, borderTopLeftRadius: w / 2, borderTopRightRadius: w / 2 }}
        />
      </Animated.View>
    </>
  );
}

/** Soft contact shadow a figure casts on the floor. */
export function FootShadow({ at, width }: { at: Pt; width: number }) {
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', left: at.x - width / 2, top: at.y - width * 0.14, width, height: width * 0.28, borderRadius: width,
      backgroundColor: 'rgba(0,0,0,0.5)',
    }} />
  );
}
