export const THEMES = [
  { id: 'city', label: 'Abandoned City', fromWave: 1, ground: '#1d2f22', road: '#26313a', accent: '#ffd166', music: [220, 277, 330, 392] },
  { id: 'sewer', label: 'Toxic Zone', fromWave: 5, ground: '#14351f', road: '#1f4a36', accent: '#70e000', music: [110, 147, 196, 220] },
  { id: 'factory', label: 'Burning Factory', fromWave: 10, ground: '#301916', road: '#3d2f2a', accent: '#ff8c42', music: [146, 196, 233, 293] },
  { id: 'frozen', label: 'Frozen Outpost', fromWave: 15, ground: '#132c3b', road: '#233f50', accent: '#9ee7ff', music: [165, 220, 247, 330] },
  { id: 'lab', label: 'Mutant Lab', fromWave: 20, ground: '#111936', road: '#202545', accent: '#b38cff', music: [130, 174, 261, 349] },
];

export function themeForWave(wave) {
  return [...THEMES].reverse().find((theme) => wave >= theme.fromWave) || THEMES[0];
}

