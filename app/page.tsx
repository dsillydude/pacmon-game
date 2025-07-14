import { encode, decode } from 'js-base64';
import { redirect } from 'next/navigation';
import { FrameButton, FrameContainer, FrameImage } from 'frames.js/next/server';
import { NextRequest } from 'next/server';
import { generateMaze } from '../lib/mazeGenerator';
import { getLevelSettings } from '../lib/difficultySettings';

interface GameState {
  player: { x: number; y: number };
  ghosts: { x: number; y: number; direction: { x: number; y: number } }[];
  score: number;
  lives: number;
  maze: {
    grid: number[][];
    size: number;
    playerStart: { x: number; y: number };
    ghostStarts: { x: number; y: number }[];
    dots: number;
  };
  level: number;
  gameStatus: 'playing' | 'level-complete' | 'game-over';
  powerMode: boolean;
  powerTimer: number;
}

const initialState: GameState = {
  player: { x: 1, y: 1 },
  ghosts: [],
  score: 0,
  lives: 3,
  maze: {
    grid: [],
    size: 0,
    playerStart: { x: 0, y: 0 },
    ghostStarts: [],
    dots: 0
  },
  level: 1,
  gameStatus: 'playing',
  powerMode: false,
  powerTimer: 0
};

function decodeState(encodedState: string): GameState {
  return JSON.parse(decode(encodedState));
}

function encodeState(state: GameState): string {
  return encode(JSON.stringify(state));
}

export default function Home({ searchParams }: { searchParams: { state?: string } }) {
  const state = searchParams.state ? decodeState(JSON.parse(searchParams.state)) : initialState;

  // Initialize game if maze is empty
  if (state.maze.grid.length === 0) {
    state.maze = generateMaze(state.level);
    state.player = { ...state.maze.playerStart };
    state.ghosts = state.maze.ghostStarts.map(pos => ({ ...pos, direction: { x: 0, y: 0 } }));
  }

  // Handle power mode timer
  if (state.powerMode) {
    state.powerTimer -= 1;
    if (state.powerTimer <= 0) {
      state.powerMode = false;
    }
  }

  // Determine buttons based on game state
  let buttons = [];
  if (state.gameStatus === 'playing') {
    buttons = [
      <FrameButton key="up" action="post" target={{ action: 'move', direction: 'up' }}>↑</FrameButton>,
      <FrameButton key="left" action="post" target={{ action: 'move', direction: 'left' }}>←</FrameButton>,
      <FrameButton key="down" action="post" target={{ action: 'move', direction: 'down' }}>↓</FrameButton>,
      <FrameButton key="right" action="post" target={{ action: 'move', direction: 'right' }}>→</FrameButton>
    ];
  } else if (state.gameStatus === 'level-complete') {
    buttons = [
      <FrameButton key="next" action="post" target={{ action: 'nextLevel' }}>
        Next Level ({state.level + 1})
      </FrameButton>
    ];
  } else if (state.gameStatus === 'game-over') {
    buttons = [
      <FrameButton key="restart" action="post" target={{ action: 'restart' }}>
        Play Again
      </FrameButton>
    ];
  }

  return (
    <FrameContainer
      postUrl="/frames"
      state={state}
      previousFrame={null}
    >
      <FrameImage aspectRatio="1:1">
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: 'black',
          color: 'white',
          fontFamily: 'monospace',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>Level: {state.level}</div>
            <div>Score: {state.score}</div>
            <div>Lives: {'❤️'.repeat(state.lives)}</div>
          </div>
          
          <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <MazeDisplay state={state} />
          </div>

          {state.gameStatus === 'level-complete' && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '16px' }}>Level Complete!</div>
              <div>Score: {state.score}</div>
            </div>
          )}

          {state.gameStatus === 'game-over' && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '16px' }}>Game Over</div>
              <div>Final Score: {state.score}</div>
            </div>
          )}
        </div>
      </FrameImage>
      {buttons}
    </FrameContainer>
  );
}

function MazeDisplay({ state }: { state: GameState }) {
  const cellSize = 20;
  const mazeSize = state.maze.size * cellSize;

  return (
    <div style={{
      position: 'relative',
      width: mazeSize,
      height: mazeSize,
      backgroundColor: 'black'
    }}>
      {state.maze.grid.map((row, y) =>
        row.map((cell, x) => (
          <div
            key={`${x}-${y}`}
            style={{
              position: 'absolute',
              left: x * cellSize,
              top: y * cellSize,
              width: cellSize,
              height: cellSize,
              backgroundColor: cell === 1 ? '#1A237E' : 'black',
              ...(cell === 1 && { borderRadius: '4px' })
            }}
          >
            {cell === 2 && (
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '4px',
                height: '4px',
                backgroundColor: 'white',
                borderRadius: '50%'
              }} />
            )}
            {cell === 3 && (
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: '8px',
                height: '8px',
                backgroundColor: 'white',
                borderRadius: '50%'
              }} />
            )}
          </div>
        ))
      )}

      {/* Player */}
      <div
        style={{
          position: 'absolute',
          left: state.player.x * cellSize,
          top: state.player.y * cellSize,
          width: cellSize,
          height: cellSize,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <div style={{
          width: cellSize * 0.7,
          height: cellSize * 0.7,
          backgroundColor: 'yellow',
          borderRadius: '50%'
        }} />
      </div>

      {/* Ghosts */}
      {state.ghosts.map((ghost, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: ghost.x * cellSize,
            top: ghost.y * cellSize,
            width: cellSize,
            height: cellSize,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <div style={{
            width: cellSize * 0.7,
            height: cellSize * 0.7,
            backgroundColor: state.powerMode ? 'blue' : 
              ['red', 'pink', 'cyan', 'orange'][index % 4],
            borderRadius: '50% 50% 0 0'
          }} />
        </div>
      ))}
    </div>
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const state = body.state ? decodeState(JSON.parse(body.state)) : initialState;

  // Handle different actions
  const action = body.untrustedData?.action;
  
  if (action === 'move') {
    return handleMove(state, body.untrustedData.direction);
  } else if (action === 'nextLevel') {
    return handleNextLevel(state);
  } else if (action === 'restart') {
    return handleRestart();
  }

  return new Response('Invalid action', { status: 400 });
}

async function handleMove(state: GameState, direction: string) {
  // Update player position
  const newPosition = { ...state.player };
  switch (direction) {
    case 'up': newPosition.y = Math.max(0, newPosition.y - 1); break;
    case 'down': newPosition.y = Math.min(state.maze.size - 1, newPosition.y + 1); break;
    case 'left': newPosition.x = Math.max(0, newPosition.x - 1); break;
    case 'right': newPosition.x = Math.min(state.maze.size - 1, newPosition.x + 1); break;
  }

  // Check if move is valid
  if (state.maze.grid[newPosition.y][newPosition.x] !== 1) {
    state.player = newPosition;

    // Check for dots or power pellets
    const cellValue = state.maze.grid[newPosition.y][newPosition.x];
    if (cellValue === 2) {
      state.score += 10;
      state.maze.grid[newPosition.y][newPosition.x] = 0;
    } else if (cellValue === 3) {
      state.score += 50;
      state.powerMode = true;
      state.powerTimer = 20;
      state.maze.grid[newPosition.y][newPosition.x] = 0;
    }
  }

  // Update ghosts
  updateGhosts(state);

  // Check collisions
  checkCollisions(state);

  // Check level completion
  const dotsRemaining = state.maze.grid.flat().filter(cell => cell === 2).length;
  if (dotsRemaining === 0) {
    state.gameStatus = 'level-complete';
  }

  const newSearchParams = new URLSearchParams();
  newSearchParams.set('state', JSON.stringify(encodeState(state)));

  return redirect(`/?${newSearchParams.toString()}`);
}

function updateGhosts(state: GameState) {
  const levelSettings = getLevelSettings(state.level);
  
  state.ghosts.forEach(ghost => {
    // Simple movement with level-based intelligence
    if (Math.random() < 0.05 + (state.level * 0.02)) {
      // More likely to chase player at higher levels
      const dx = state.player.x - ghost.x;
      const dy = state.player.y - ghost.y;
      
      if (Math.abs(dx) > Math.abs(dy)) {
        ghost.direction = { x: Math.sign(dx), y: 0 };
      } else {
        ghost.direction = { x: 0, y: Math.sign(dy) };
      }
    } else if (Math.random() < 0.1) {
      // Random direction change
      const directions = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      ghost.direction = directions[Math.floor(Math.random() * directions.length)];
    }
    
    // Apply movement with level-based speed
    const newX = Math.round(ghost.x + ghost.direction.x);
    const newY = Math.round(ghost.y + ghost.direction.y);
    
    // Only move if new position is valid
    if (newX >= 0 && newX < state.maze.size && 
        newY >= 0 && newY < state.maze.size &&
        state.maze.grid[newY][newX] !== 1) {
      ghost.x = newX;
      ghost.y = newY;
    }
  });
}

function checkCollisions(state: GameState) {
  state.ghosts.forEach(ghost => {
    if (Math.round(ghost.x) === Math.round(state.player.x) &&
        Math.round(ghost.y) === Math.round(state.player.y)) {
      if (state.powerMode) {
        // Ghost eaten
        ghost.x = state.maze.ghostStarts[0].x;
        ghost.y = state.maze.ghostStarts[0].y;
        state.score += 200;
      } else {
        // Player dies
        state.lives -= 1;
        if (state.lives <= 0) {
          state.gameStatus = 'game-over';
        } else {
          // Reset positions
          state.player = { ...state.maze.playerStart };
          state.ghosts = state.maze.ghostStarts.map(pos => ({ ...pos, direction: { x: 0, y: 0 } }));
        }
      }
    }
  });
}

async function handleNextLevel(state: GameState) {
  const newState: GameState = {
    ...initialState,
    score: state.score,
    lives: state.lives,
    level: state.level + 1
  };
  
  // Generate new maze for next level
  newState.maze = generateMaze(newState.level);
  newState.player = { ...newState.maze.playerStart };
  newState.ghosts = newState.maze.ghostStarts.map(pos => ({ ...pos, direction: { x: 0, y: 0 } }));
  
  const newSearchParams = new URLSearchParams();
  newSearchParams.set('state', JSON.stringify(encodeState(newState)));
  
  return redirect(`/?${newSearchParams.toString()}`);
}

async function handleRestart() {
  const newSearchParams = new URLSearchParams();
  newSearchParams.set('state', JSON.stringify(encodeState(initialState)));
  return redirect(`/?${newSearchParams.toString()}`);
}