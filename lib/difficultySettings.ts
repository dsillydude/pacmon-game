export const LEVEL_SETTINGS = {
  1: {
    mazeSize: 9,  // 9x9 grid
    ghostCount: 1,
    ghostSpeed: 1,
    powerPellets: 1,
    dots: 15
  },
  2: {
    mazeSize: 11,  // 11x11 grid
    ghostCount: 1,
    ghostSpeed: 1.2,
    powerPellets: 1,
    dots: 20
  },
  3: {
    mazeSize: 13,  // 13x13 grid
    ghostCount: 2,
    ghostSpeed: 1.4,
    powerPellets: 1,
    dots: 25
  },
  4: {
    mazeSize: 15,  // 15x15 grid
    ghostCount: 2,
    ghostSpeed: 1.6,
    powerPellets: 2,
    dots: 30
  },
  5: {
    mazeSize: 15,  // 15x15 grid
    ghostCount: 3,
    ghostSpeed: 1.8,
    powerPellets: 2,
    dots: 35
  }
} as const;

export type LevelSettings = typeof LEVEL_SETTINGS[keyof typeof LEVEL_SETTINGS];

export const getLevelSettings = (level: number): LevelSettings => {
  return LEVEL_SETTINGS[Math.min(level, 5) as keyof typeof LEVEL_SETTINGS] || LEVEL_SETTINGS[1];
};