export const LEVEL_SETTINGS = {
  1: {
    mazeSize: 7,  // 7x7 grid
    ghostCount: 1,
    ghostSpeed: 1,
    powerPellets: 1,
    dots: 10
  },
  2: {
    mazeSize: 9,  // 9x9 grid
    ghostCount: 1,
    ghostSpeed: 1.2,
    powerPellets: 1,
    dots: 15
  },
  3: {
    mazeSize: 11,  // 11x11 grid
    ghostCount: 2,
    ghostSpeed: 1.4,
    powerPellets: 1,
    dots: 20
  },
  4: {
    mazeSize: 13,  // 13x13 grid
    ghostCount: 2,
    ghostSpeed: 1.6,
    powerPellets: 2,
    dots: 25
  },
  5: {
    mazeSize: 15,  // 15x15 grid
    ghostCount: 3,
    ghostSpeed: 1.8,
    powerPellets: 2,
    dots: 30
  },
  6: {
    mazeSize: 17, // 17x17 grid
    ghostCount: 3,
    ghostSpeed: 2,
    powerPellets: 2,
    dots: 35
  },
  7: {
    mazeSize: 19, // 19x19 grid
    ghostCount: 4,
    ghostSpeed: 2.2,
    powerPellets: 3,
    dots: 40
  }
} as const;

export type LevelSettings = typeof LEVEL_SETTINGS[keyof typeof LEVEL_SETTINGS];

export const getLevelSettings = (level: number): LevelSettings => {
  return LEVEL_SETTINGS[Math.min(level, Object.keys(LEVEL_SETTINGS).length) as keyof typeof LEVEL_SETTINGS] || LEVEL_SETTINGS[1];
};