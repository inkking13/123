// A mercenary's ledger: warm near-black leather behind everything, parchment-cream
// text, aged-ochre trim and wax red for danger. Documents (contracts, letters,
// notices) sit on Parchment sheets in dark ink (components/Frame).

export const colors = {
  bg: '#120e0b',
  bgAlt: '#0b0907',
  surface: '#1f1812',
  border: '#3b2e22',
  borderStrong: '#5c4730',
  borderHover: '#8a6c45',
  text: '#ede2c8',
  textMuted: '#c7b796',
  textDim: '#a6967a',
  textFaint: '#7e705c',
  accent: '#c79d5e',
  accentBright: '#e2bd7c',
  accentSoft: '#efdbb2',
  accentWash: 'rgba(199,157,94,0.12)',
  accentWashStrong: 'rgba(199,157,94,0.2)',
  danger: '#c4503f',
  good: '#93ad7f',
  warn: '#d0a955',
  crit: '#ecd9a0',
} as const;

/** Ink on parchment: text colours for anything drawn on a Parchment sheet. */
export const ink = {
  text: '#2a1d12',
  muted: '#5b4530',
  faint: '#806849',
  rule: 'rgba(60,40,22,0.35)',
  red: '#8c2a1d',
  green: '#3f5a2a',
  wax: '#9b2c20',
  waxDark: '#5e1710',
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

// Alegreya: a calligraphic book face with Cyrillic, for the inked-ledger look.
// Its small capitals set titles and headings.
export const font = {
  regular: 'Alegreya_400Regular',
  medium: 'Alegreya_500Medium',
  semibold: 'Alegreya_700Bold',
  bold: 'Alegreya_800ExtraBold',
  italic: 'Alegreya_400Regular_Italic',
  title: 'AlegreyaSC_700Bold',
  caps: 'AlegreyaSC_500Medium',
} as const;

export const radius = { sm: 4, md: 7, lg: 8, pill: 999 };
