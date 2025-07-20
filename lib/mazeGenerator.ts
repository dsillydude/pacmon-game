import { getLevelSettings } from './difficultySettings';

const WALL = 1;
const PATH = 0;
const DOT = 2;
const POWER_PELLET = 3;

interface Maze {
  grid: number[][];
  size: number;
  playerStart: { x: number; y: number };
  ghostStarts: { x: number; y: number }[];
  dots: number;
}

export function generateMaze(level: number): Maze {
  const settings = getLevelSettings(level);
  const size = settings.mazeSize;

  let maze: number[][] = Array(size).fill(null).map(() => Array(size).fill(WALL));

  // Simple maze generation using recursive backtracking
  function carvePassages(cx: number, cy: number) {
    const directions = [
      [0, 1], [0, -1], [1, 0], [-1, 0] // Down, Up, Right, Left
    ].sort(() => Math.random() - 0.5); // Randomize directions

    for (const [dx, dy] of directions) {
      const nx = cx + dx * 2;
      const ny = cy + dy * 2;

      if (nx >= 0 && nx < size && ny >= 0 && ny < size && maze[ny][nx] === WALL) {
        maze[cy + dy][cx + dx] = PATH; // Carve path
        maze[ny][nx] = PATH; // Move to next cell
        carvePassages(nx, ny);
      }
    }
  }

  // Start carving from a random point
  const startX = Math.floor(Math.random() * (size / 2)) * 2;
  const startY = Math.floor(Math.random() * (size / 2)) * 2;
  maze[startY][startX] = PATH;
  carvePassages(startX, startY);

  // Add border walls
  for (let i = 0; i < size; i++) {
    maze[0][i] = WALL;
    maze[size - 1][i] = WALL;
    maze[i][0] = WALL;
    maze[i][size - 1] = WALL;
  }

  // Place dots and power pellets
  let dotsCount = 0;
  const powerPelletPositions: { x: number; y: number }[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (maze[y][x] === PATH) {
        maze[y][x] = DOT;
        dotsCount++;
      }
    }
  }

  // Place power pellets in strategic locations (e.g., corners or ends of long paths)
  // This is a simplified placement. For a true Pac-Man experience, these would be fixed.
  const potentialPowerPelletSpots = [
    { x: 1, y: 1 },
    { x: size - 2, y: 1 },
    { x: 1, y: size - 2 },
    { x: size - 2, y: size - 2 },
  ];

  for (let i = 0; i < settings.powerPellets; i++) {
    if (potentialPowerPelletSpots[i]) {
      const { x, y } = potentialPowerPelletSpots[i];
      if (maze[y][x] === DOT) {
        maze[y][x] = POWER_PELLET;
        dotsCount--; // Power pellets replace dots
        powerPelletPositions.push({ x, y });
      }
    }
  }

  // Determine player start and ghost start positions
  let playerStart = { x: 1, y: 1 };
  let ghostStarts: { x: number; y: number }[] = [];

  // Find a suitable player start (e.g., bottom center)
  for (let y = size - 2; y >= 0; y--) {
    if (maze[y][Math.floor(size / 2)] === DOT) {
      playerStart = { x: Math.floor(size / 2), y: y };
      maze[y][Math.floor(size / 2)] = PATH; // Remove dot at player start
      dotsCount--;
      break;
    }
  }

  // Find suitable ghost start positions (e.g., near center)
  const center = Math.floor(size / 2);
  const ghostSpawnArea = [
    { x: center, y: center - 1 },
    { x: center - 1, y: center },
    { x: center + 1, y: center },
    { x: center, y: center + 1 },
  ];

  for (let i = 0; i < settings.ghostCount; i++) {
    if (ghostSpawnArea[i] && maze[ghostSpawnArea[i].y][ghostSpawnArea[i].x] === PATH) {
      ghostStarts.push(ghostSpawnArea[i]);
    } else {
      // Fallback if preferred spot is not a path
      for (let gy = 1; gy < size - 1; gy++) {
        for (let gx = 1; gx < size - 1; gx++) {
          if (maze[gy][gx] === PATH && !ghostStarts.some(gs => gs.x === gx && gs.y === gy)) {
            ghostStarts.push({ x: gx, y: gy });
            break;
          }
        }
        if (ghostStarts.length === i + 1) break;
      }
    }
  }

  return {
    grid: maze,
    size: size,
    playerStart: playerStart,
    ghostStarts: ghostStarts,
    dots: dotsCount,
  };
}

// Classic Pac-Man Maze (28x31 grid)
export const CLASSIC_MAZE_GRID = [
  "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "X............XX............X",
  "X.XXXX.XXXXX.XX.XXXXX.XXXX.X",
  "X..........................X",
  "X.XXXX.XX.XXXXXXXX.XX.XXXX.X",
  "X......XX....XX....XX......X",
  "XXXXXX.XXXXX XX XXXXX.XXXXXX",
  "XXXXXX.XX          XX.XXXXXX",
  "XXXXXX.XX XXXXXXXX XX.XXXXXX",
  "      .   X      X   .      ",
  "XXXXXX.XX X      X XX.XXXXXX",
  "XXXXXX.XX XXXXXXXX XX.XXXXXX",
  "XXXXXX.XX          XX.XXXXXX",
  "XXXXXX.XX XXXXXXXX XX.XXXXXX",
  "X............XX............X",
  "X.XXXX.XXXXX.XX.XXXXX.XXXX.X",
  "X...XX................XX...X",
  "XXX.XX.XX.XXXXXXXX.XX.XX.XXX",
  "X......XX....XX....XX......X",
  "X.XXXXXXXXXX.XX.XXXXXXXXXX.X",
  "X..........................X",
  "XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
];

export function getClassicMaze(): Maze {
  const grid: number[][] = CLASSIC_MAZE_GRID.map(row => row.split('').map(char => {
    if (char === 'X') return WALL;
    if (char === '.') return DOT;
    return PATH; // For empty spaces like ghost house
  }));

  let dotsCount = 0;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === DOT) {
        dotsCount++;
      }
    }
  }

  return {
    grid: grid,
    size: CLASSIC_MAZE_GRID[0].length,
    playerStart: { x: 13, y: 23 }, // Approximate center bottom
    ghostStarts: [
      { x: 13, y: 14 }, // Blinky (Red)
      { x: 12, y: 14 }, // Pinky (Pink)
      { x: 14, y: 14 }, // Inky (Cyan)
      { x: 15, y: 14 }, // Clyde (Orange)
    ],
    dots: dotsCount,
  };
}


