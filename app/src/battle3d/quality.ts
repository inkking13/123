import { PixelRatio } from 'react-native';

export type Quality = 'low' | 'medium' | 'high';

export const QUALITY_LABEL: Record<Quality, string> = { low: 'Низкое', medium: 'Среднее', high: 'Высокое' };
export const QUALITY_HINT: Record<Quality, string> = {
  low: 'Без сглаживания, теней и погоды, меньше пикселей, 30 кадров в секунду. Для слабых телефонов и экономии батареи.',
  medium: 'Сглаживание, тени от героев, половина частиц погоды, чёткость до 1.5×.',
  high: 'Полная чёткость экрана, чёткие тени и вся погода. Для мощных телефонов.',
};

/**
 * Canvas settings for a quality level: pixel ratio, antialiasing, how much weather to draw, a frame-rate cap (0 = none)
 * and the sun's shadow map size (0 = no shadows: figures stand on a soft blob instead).
 */
export function qualityProfile(q: Quality) {
  const screen = PixelRatio.get() || 1;
  switch (q) {
    case 'low': return { dpr: 1, antialias: false, weather: 0, fps: 30, shadows: 0 };
    case 'high': return { dpr: Math.min(screen, 2.5), antialias: true, weather: 1, fps: 0, shadows: 2048 };
    default: return { dpr: Math.min(screen, 1.5), antialias: true, weather: 0.5, fps: 0, shadows: 1024 };
  }
}
