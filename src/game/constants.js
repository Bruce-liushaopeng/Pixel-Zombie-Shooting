export const WORLD = {
  width: 2400,
  height: 1600,
  tile: 48,
};

export const GAME_STATE = {
  START: 'start',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game-over',
};

export const COLORS = {
  asphalt: '#26313a',
  asphaltDark: '#1b242c',
  grass: '#273e2d',
  grassDark: '#1d2f22',
  curb: '#6b7374',
  wall: '#444b52',
  roof: '#724344',
  outline: '#101417',
  yellow: '#ffd166',
  red: '#ef476f',
  teal: '#4cc9a7',
  blue: '#57b8ff',
  violet: '#b38cff',
};

export const ABILITIES = {
  speed: { label: 'Speed', duration: 8, color: '#4cc9a7', icon: '>>' },
  rapid: { label: 'Rapid', duration: 9, color: '#ffd166', icon: '//' },
  big: { label: 'Big Shot', duration: 10, color: '#57b8ff', icon: 'O' },
  spread: { label: 'Spread', duration: 11, color: '#ff8c42', icon: 'Y' },
  shield: { label: 'Shield', duration: 10, color: '#b38cff', icon: '[]' },
  invincible: { label: 'Ghost', duration: 5, color: '#d6f6ff', icon: '**' },
  damage: { label: 'Power', duration: 9, color: '#ef476f', icon: 'x2' },
};
