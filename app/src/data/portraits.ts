// Static requires so Metro can bundle every portrait.
const SOURCES = [
  require('../../assets/portraits/0.jpg'),
  require('../../assets/portraits/1.jpg'),
  require('../../assets/portraits/2.jpg'),
  require('../../assets/portraits/3.jpg'),
  require('../../assets/portraits/4.jpg'),
  require('../../assets/portraits/5.jpg'),
  require('../../assets/portraits/6.jpg'),
  require('../../assets/portraits/7.jpg'),
  require('../../assets/portraits/8.jpg'),
];

export function portraitSource(id: number) {
  return SOURCES[id];
}

// Recruits (ids 9+) join after launch and have no bundled portrait art yet —
// they fall back to a role-tinted monogram instead of a photo.
export interface PortraitFallback {
  letter: string;
  color: string;
}
const FALLBACKS: Record<number, PortraitFallback> = {
  9: { letter: 'О', color: '#8aa2d6' }, // tank
  10: { letter: 'И', color: '#86b39a' }, // heal
  11: { letter: 'Д', color: '#c98c6d' }, // dps
  12: { letter: 'Г', color: '#c98c6d' }, // dps
  13: { letter: 'М', color: '#c98c6d' }, // dps
};

export function portraitFallback(id: number): PortraitFallback | null {
  return FALLBACKS[id] || null;
}
