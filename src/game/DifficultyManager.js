export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    label: 'Easy',
    spawnMultiplier: 0.72,
    speedMultiplier: 0.82,
    healthMultiplier: 0.78,
    damageMultiplier: 0.75,
    waveScale: 0.72,
    pickupChance: 0.28,
    scoreMultiplier: 0.9,
    bossEvery: 6,
    specialWave: 4,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    spawnMultiplier: 1,
    speedMultiplier: 1,
    healthMultiplier: 1,
    damageMultiplier: 1,
    waveScale: 1,
    pickupChance: 0.18,
    scoreMultiplier: 1,
    bossEvery: 5,
    specialWave: 3,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    spawnMultiplier: 1.35,
    speedMultiplier: 1.18,
    healthMultiplier: 1.28,
    damageMultiplier: 1.25,
    waveScale: 1.35,
    pickupChance: 0.1,
    scoreMultiplier: 1.25,
    bossEvery: 4,
    specialWave: 2,
  },
};

export function getDifficulty(id = 'medium') {
  return DIFFICULTIES[id] || DIFFICULTIES.medium;
}

