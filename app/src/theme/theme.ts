// Nocturne design-system tokens, taken verbatim from the concrete hex values
// baked into the source `Raid Commander Mobile.dc.html` prototype.

export const colors = {
  bg: '#161826',
  bgAlt: '#0f1119',
  surface: '#1c1e2c',
  border: '#292b31',
  borderStrong: '#3f424d',
  borderHover: '#595d6c',
  text: '#e9e9ed',
  textMuted: '#b2b6ca',
  textDim: '#9397ab',
  textFaint: '#75798c',
  accent: '#9184d9',
  accentBright: '#b5abfc',
  accentSoft: '#d2cefd',
  accentWash: 'rgba(145,132,217,0.12)',
  accentWashStrong: 'rgba(145,132,217,0.2)',
  danger: '#d1685c',
  good: '#86b39a',
  warn: '#c9b06d',
  crit: '#e0d5a3',
} as const;

export const roleColor = {
  tank: '#8aa2d6',
  heal: '#86b39a',
  dps: '#c98c6d',
} as const;

export const roleName: Record<keyof typeof roleColor, string> = {
  tank: 'Танк',
  heal: 'Хилер',
  dps: 'ДПС',
};

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const radius = { sm: 4, md: 7, lg: 8, pill: 999 };
