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
  require('../../assets/portraits/9.jpg'),
  require('../../assets/portraits/10.jpg'),
  require('../../assets/portraits/11.jpg'),
  require('../../assets/portraits/12.jpg'),
  require('../../assets/portraits/13.jpg'),
];

export function portraitSource(id: number) {
  return SOURCES[id];
}
