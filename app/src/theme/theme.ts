// Nocturne design-system tokens from the `Raid Commander Mobile.dc.html`
// prototype, with the accent and borders moved to the dark gold of the
// equipment screen so every screen shares one trim. Surfaces are warm dark
// bronze plates to match the Frame panels (components/Frame).

export const colors = {
  bg: '#161826',
  bgAlt: '#0f1119',
  surface: '#1d1915',
  border: '#3a3128',
  borderStrong: '#5e4d37',
  borderHover: '#8a7650',
  text: '#e9e9ed',
  textMuted: '#b2b6ca',
  textDim: '#9397ab',
  textFaint: '#75798c',
  accent: '#c9a36b',
  accentBright: '#e2bf85',
  accentSoft: '#ecd9b0',
  accentWash: 'rgba(201,163,107,0.12)',
  accentWashStrong: 'rgba(201,163,107,0.2)',
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
