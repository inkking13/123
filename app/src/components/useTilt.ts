import { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

// Device tilt as two smoothed Animated values in -1..1: `x` for tilting the
// right edge down (+) or up (−), `y` for tipping the top away (+) or towards
// you (−) from however the phone was being held when the screen opened.
// Each platform reports the accelerometer its own way: Android gives the
// reaction to gravity (right edge down → x < 0), iOS gives gravity itself
// (→ x > 0) and browsers give orientation angles in degrees. On desktop the
// mouse position stands in for tilt.

const FULL_TILT = 0.45; // sideways reading that counts as a full tilt
const SMOOTH = 0.12; // low-pass factor per reading

let askedMotion = false;
/** Mobile Safari only hands out motion data after a tap asks for it; call from any touch. */
export function askMotionPermission() {
  if (Platform.OS !== 'web' || askedMotion) return;
  askedMotion = true;
  const req = (globalThis as any).DeviceOrientationEvent?.requestPermission;
  if (typeof req === 'function') req.call((globalThis as any).DeviceOrientationEvent).catch(() => {});
}

export function useTilt() {
  const x = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(0)).current;
  const state = useRef({ sx: 0, sy: 0, baseY: null as number | null }).current;

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const feed = (tx: number, ty: number) => {
      state.sx += (tx - state.sx) * SMOOTH;
      state.sy += (ty - state.sy) * SMOOTH;
      x.setValue(state.sx);
      y.setValue(state.sy);
    };
    const onReading = (side: number, pitch: number) => {
      if (state.baseY === null) state.baseY = pitch;
      // Let the resting angle follow slowly, so only deliberate tips register.
      state.baseY += (pitch - state.baseY) * 0.01;
      feed(clamp(side / FULL_TILT), clamp((pitch - state.baseY) / FULL_TILT));
    };

    let onOrient: ((e: DeviceOrientationEvent) => void) | null = null;
    if (Platform.OS === 'web') {
      // Browsers: listen to orientation directly (gamma = sideways, beta = front/back, degrees);
      // on iPhone it only starts flowing once askPermission has been granted.
      if (typeof window !== 'undefined') {
        onOrient = (e: DeviceOrientationEvent) => {
          if (e.gamma == null || e.beta == null) return;
          onReading((e.gamma * Math.PI) / 180, (-e.beta * Math.PI) / 180);
        };
        window.addEventListener('deviceorientation', onOrient);
      }
    } else {
      (async () => {
        try {
          if (!(await Accelerometer.isAvailableAsync()) || !alive) return;
          Accelerometer.setUpdateInterval(33);
          sub = Accelerometer.addListener(({ x: ax, y: ay }) => {
            // Tipping the top away: iOS y rises from −1 towards 0, Android y falls.
            onReading(Platform.OS === 'android' ? -ax : ax, Platform.OS === 'ios' ? ay : -ay);
          });
        } catch {
          // No sensor: the art just stays centred.
        }
      })();
    }

    let onMouse: ((e: MouseEvent) => void) | null = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      onMouse = (e: MouseEvent) => feed(clamp((e.clientX / window.innerWidth) * 2 - 1), clamp((e.clientY / window.innerHeight) * 2 - 1));
      window.addEventListener('mousemove', onMouse);
    }
    return () => {
      alive = false;
      sub?.remove();
      if (onMouse) window.removeEventListener('mousemove', onMouse);
      if (onOrient) window.removeEventListener('deviceorientation', onOrient);
    };
  }, [x, y, state]);

  return { x, y, askPermission: askMotionPermission };
}
