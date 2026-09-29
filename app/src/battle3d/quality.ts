import { PixelRatio } from 'react-native';

export type Quality = 'low' | 'medium' | 'high';

export const QUALITY_LABEL: Record<Quality, string> = { low: 'Низкое', medium: 'Среднее', high: 'Высокое' };
export const QUALITY_HINT: Record<Quality, string> = {
  low: 'Без сглаживания и погоды, меньше пикселей, 30 кадров в секунду. Для слабых телефонов и экономии батареи.',
  medium: 'Сглаживание, половина частиц погоды, чёткость до 1.5×.',
  high: 'Полная чёткость экрана и вся погода. Для мощных телефонов.',
};

/** Canvas settings for a quality level: pixel ratio, antialiasing, how much weather to draw and a frame-rate cap (0 = none). */
export function qualityProfile(q: Quality) {
  const screen = PixelRatio.get() || 1;
  switch (q) {
    case 'low': return { dpr: 1, antialias: false, weather: 0, fps: 30 };
    case 'high': return { dpr: Math.min(screen, 2.5), antialias: true, weather: 1, fps: 0 };
    default: return { dpr: Math.min(screen, 1.5), antialias: true, weather: 0.5, fps: 0 };
  }
}
