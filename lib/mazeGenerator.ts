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
  const maze: Maze = {
    grid: Array(size).fill(null).map(() => Array(size).fill(WALL)),
    size,
    playerStart: { x: 1, y: 1 },
    ghostStarts: [],
    dots: 0
  };

  // Generate paths (simpler for early levels)
  if (level <= 2) {
    generateSimpleMaze(maze, settings);
  } else {
    generateComplexMaze(maze, settings);
  }

  // Place player and ghosts
  maze.playerStart = findOpenSpace(maze) || { x: 1, y: 1 };
  maze.ghostStarts = [];
  for (let i = 0; i < settings.ghostCount; i++) {
    const pos = findOpenSpace(maze, maze.playerStart);
    if (pos) maze.ghostStarts.push(pos);
  }

  return maze;
}

function generateSimpleMaze(maze: Maze, settings: ReturnType<typeof getLevelSettings>) {
  // Simple maze with clear paths
  for (let y = 1; y < maze.size - 1; y += 2) {
    for (let x = 1; x < maze.size - 1; x += 2) {
      maze.grid[y][x] = PATH;
      
      // Place dots
      if (Math.random() > 0.3 && maze.dots < settings.dots) {
        maze.grid[y][x] = DOT;
        maze.dots++;
      }
      
      // Connect horizontally
      if (x + 1 < maze.size - 1) {
        maze.grid[y][x + 1] = PATH;
        if (Math.random() > 0.3 && maze.dots < settings.dots) {
          maze.grid[y][x + 1] = DOT;
          maze.dots++;
        }
      }
    }
  }

  // Place power pellets
  for (let i = 0; i < settings.powerPellets; i++) {
    const pos = findOpenSpace(maze);
    if (pos) {
      maze.grid[pos.y][pos.x] = POWER_PELLET;
    }
  }
}

function generateComplexMaze(maze: Maze, settings: ReturnType<typeof getLevelSettings>) {
  // More complex maze generation for higher levels
  const frontier: {x: number, y: number}[] = [];
  const start = { x: 1, y: 1 };
  maze.grid[start.y][start.x] = PATH;
  frontier.push(...getNeighbors(start, maze));

  while (frontier.length > 0 && maze.dots < settings.dots * 1.5) {
    const randomIndex = Math.floor(Math.random() * frontier.length);
    const cell = frontier.splice(randomIndex, 1)[0];
    const neighbors = getNeighbors(cell, maze, 2).filter(n => maze.grid[n.y][n.x] === PATH);
    
    if (neighbors.length > 0) {
      const neighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
      const between = {
        x: cell.x + Math.sign(neighbor.x - cell.x),
        y: cell.y + Math.sign(neighbor.y - cell.y)
      };
      maze.grid[cell.y][cell.x] = PATH;
      maze.grid[between.y][between.x] = PATH;
      
      // Place dots with higher probability
      if (Math.random() > 0.2 && maze.dots < settings.dots) {
        maze.grid[cell.y][cell.x] = DOT;
        maze.dots++;
      }
    }
    
    frontier.push(...getNeighbors(cell, maze).filter(n => maze.grid[n.y][n.x] === WALL));
  }

  // Place power pellets
  for (let i = 0; i < settings.powerPellets; i++) {
    const pos = findOpenSpace(maze);
    if (pos) {
      maze.grid[pos.y][pos.x] = POWER_PELLET;
    }
  }
}

function getNeighbors(pos: {x: number, y: number}, maze: Maze, distance = 1) {
  const neighbors: {x: number, y: number}[] = [];
  if (pos.x - distance >= 0) neighbors.push({ x: pos.x - distance, y: pos.y });
  if (pos.x + distance < maze.size) neighbors.push({ x: pos.x + distance, y: pos.y });
  if (pos.y - distance >= 0) neighbors.push({ x: pos.x, y: pos.y - distance });
  if (pos.y + distance < maze.size) neighbors.push({ x: pos.x, y: pos.y + distance });
  return neighbors;
}

function findOpenSpace(maze: Maze, exclude: {x: number, y: number} | null = null): {x: number, y: number} | null {
  let attempts = 0;
  let pos: {x: number, y: number};
  do {
    pos = {
      x: Math.floor(Math.random() * (maze.size - 2)) + 1,
      y: Math.floor(Math.random() * (maze.size - 2)) + 1
    };
    attempts++;
  } while (
    (maze.grid[pos.y][pos.x] !== PATH ||
    (exclude && pos.x === exclude.x && pos.y === exclude.y)) &&
    attempts < 100
  );
  return attempts < 100 ? pos : null;
}