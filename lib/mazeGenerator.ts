export function generateMaze(level: number): number[][] {
  const GRID_SIZE = 20;
  let maze: number[][] = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(1)); // Initialize with walls

  // Simple maze generation for now, will improve based on difficulty
  // For level 1, a very simple open maze
  if (level === 1) {
    for (let y = 1; y < GRID_SIZE - 1; y++) {
      for (let x = 1; x < GRID_SIZE - 1; x++) {
        maze[y][x] = 0; // Empty space
      }
    }
    // Add some simple walls to make it a maze
    maze[3][3] = 1;
    maze[3][4] = 1;
    maze[4][3] = 1;
    maze[5][5] = 1;
    maze[5][6] = 1;
    maze[6][5] = 1;

  } else if (level === 2) {
    // Slightly more complex maze
    for (let y = 1; y < GRID_SIZE - 1; y++) {
      for (let x = 1; x < GRID_SIZE - 1; x++) {
        maze[y][x] = 0; // Empty space
      }
    }
    // Add more walls
    for (let i = 2; i < GRID_SIZE - 2; i += 2) {
      maze[i][GRID_SIZE / 2 - 1] = 1;
      maze[i][GRID_SIZE / 2] = 1;
    }
    maze[3][3] = 1;
    maze[3][4] = 1;
    maze[4][3] = 1;
    maze[5][5] = 1;
    maze[5][6] = 1;
    maze[6][5] = 1;
    maze[10][10] = 1;
    maze[10][11] = 1;
    maze[11][10] = 1;

  } else {
    // More complex mazes for higher levels (can implement a proper maze generation algorithm here)
    // For now, just use the original maze for higher levels
    const originalMaze = [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
      [1,3,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,3,1],
      [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
      [1,2,1,1,1,2,1,2,1,1,1,1,2,1,2,1,1,1,2,1],
      [1,2,2,2,2,2,1,2,2,1,1,2,2,1,2,2,2,2,2,1],
      [1,1,1,1,1,2,1,1,2,1,1,2,1,1,2,1,1,1,1,1],
      [0,0,0,0,1,2,1,2,2,2,2,2,2,1,2,1,0,0,0,0],
      [1,1,1,1,1,2,1,2,1,0,0,1,2,1,2,1,1,1,1,1],
      [2,2,2,2,2,2,2,2,1,0,0,1,2,2,2,2,2,2,2,2],
      [1,1,1,1,1,2,1,2,1,0,0,1,2,1,2,1,1,1,1,1],
      [0,0,0,0,1,2,1,2,2,2,2,2,2,1,2,1,0,0,0,0],
      [1,1,1,1,1,2,1,1,2,1,1,2,1,1,2,1,1,1,1,1],
      [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
      [1,2,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,2,1],
      [1,3,2,2,1,2,2,2,2,2,2,2,2,2,2,1,2,2,3,1],
      [1,1,1,2,1,2,1,2,1,1,1,1,2,1,2,1,2,1,1,1],
      [1,2,2,2,2,2,1,2,2,1,1,2,2,1,2,2,2,2,2,1],
      [1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ];
    maze = originalMaze;
  }

  // Populate pellets and power pellets
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (maze[y][x] === 0) {
        // Randomly place pellets or power pellets
        if (Math.random() < 0.05) { // 5% chance for power pellet
          maze[y][x] = 3; // Power pellet
        } else {
          maze[y][x] = 2; // Pellet
        }
      }
    }
  }

  return maze;
}


