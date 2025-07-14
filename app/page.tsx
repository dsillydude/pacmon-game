import { encode, decode } from 'js-base64';
import { redirect } from 'next/navigation';
import { FrameButton, FrameContainer, FrameImage } from 'frames.js/next/server';
import { NextRequest } from 'next/server';
import { generateMaze } from '../lib/mazeGenerator';
import { getLevelSettings } from '../lib/difficultySettings';


// Enhanced type definitions
interface Position {
  x: number;
  y: number;
}

interface Ghost extends Position {
  direction: Position;
}

interface Maze {
  grid: number[][];
  size: number;
  playerStart: Position;
  ghostStarts: Position[];
  dots: number;
}

type GameStatus = 'playing' | 'level-complete' | 'game-over';

interface GameState {
  player: Position;
  ghosts: Ghost[];
  score: number;
  lives: number;
  maze: Maze;
  level: number;
  gameStatus: GameStatus;
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

// Utility functions
const decodeState = (encodedState: string): GameState => 
  JSON.parse(decode(encodedState));

const encodeState = (state: GameState): string => 
  encode(JSON.stringify(state));

const redirectWithState = (state: GameState) => {
  const newSearchParams = new URLSearchParams();
  newSearchParams.set('state', JSON.stringify(encodeState(state)));
  return redirect(`/?${newSearchParams.toString()}`);
};

export default function Home({ searchParams }: { searchParams: { state?: string } }) {
  const state = searchParams.state ? decodeState(JSON.parse(searchParams.state)) : initialState;

  // Initialize game if maze is empty
  if (state.maze.grid.length === 0) {
    initializeGameState(state);
  }

  // Handle power mode timer
  if (state.powerMode) {
    state.powerTimer -= 1;
    if (state.powerTimer <= 0) {
      state.powerMode = false;
    }
  }

  return (
    <FrameContainer postUrl="/frames" state={state} previousFrame={null}>
      <FrameImage aspectRatio="1:1">
        <GameDisplay state={state} />
      </FrameImage>
      {renderButtons(state)}
    </FrameContainer>
  );
}

// Game initialization
function initializeGameState(state: GameState) {
  state.maze = generateMaze(state.level);
  state.player = { ...state.maze.playerStart };
  state.ghosts = state.maze.ghostStarts.map(pos => ({ 
    ...pos, 
    direction: { x: 0, y: 0 } 
  }));
}

// Button rendering
function renderButtons(state: GameState) {
  switch (state.gameStatus) {
    case 'playing':
      return [
        <FrameButton key="up" action="post" target={{ action: 'move', direction: 'up' }}>↑</FrameButton>,
        <FrameButton key="left" action="post" target={{ action: 'move', direction: 'left' }}>←</FrameButton>,
        <FrameButton key="down" action="post" target={{ action: 'move', direction: 'down' }}>↓</FrameButton>,
        <FrameButton key="right" action="post" target={{ action: 'move', direction: 'right' }}>→</FrameButton>
      ];
    case 'level-complete':
      return [
        <FrameButton key="next" action="post" target={{ action: 'nextLevel' }}>
          Next Level ({state.level + 1})
        </FrameButton>
      ];
    case 'game-over':
      return [
        <FrameButton key="restart" action="post" target={{ action: 'restart' }}>
          Play Again
        </FrameButton>
      ];
    default:
      return [];
  }
}

// Game display component
function GameDisplay({ state }: { state: GameState }) {
  const cellSize = 20;
  const mazeSize = state.maze.size * cellSize;

  return (
    <div style={gameContainerStyle}>
      <div style={gameInfoStyle}>
        <div>Level: {state.level}</div>
        <div>Score: {state.score}</div>
        <div>Lives: {'❤️'.repeat(state.lives)}</div>
      </div>
      
      <div style={mazeContainerStyle}>
        <div style={{ ...mazeStyle, width: mazeSize, height: mazeSize }}>
          {state.maze.grid.map((row, y) =>
            row.map((cell, x) => (
              <div key={`${x}-${y}`} style={getCellStyle(cell, x, y, cellSize)}>
                {cell === 2 && <Dot />}
                {cell === 3 && <PowerPellet />}
              </div>
            ))
          )}

          <Player position={state.player} cellSize={cellSize} />
          
          {state.ghosts.map((ghost, index) => (
            <Ghost key={index} ghost={ghost} cellSize={cellSize} powerMode={state.powerMode} index={index} />
          ))}
        </div>
      </div>

      {state.gameStatus === 'level-complete' && <LevelCompleteOverlay score={state.score} />}
      {state.gameStatus === 'game-over' && <GameOverOverlay score={state.score} />}
    </div>
  );
}

// Style objects
const gameContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  backgroundColor: 'black',
  color: 'white',
  fontFamily: 'monospace',
  padding: '16px'
};

const gameInfoStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '16px'
};

const mazeContainerStyle = {
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
};

const mazeStyle = {
  position: 'relative',
  backgroundColor: 'black'
};

const overlayStyle = {
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
};

// Component helpers
function getCellStyle(cell: number, x: number, y: number, cellSize: number) {
  return {
    position: 'absolute',
    left: x * cellSize,
    top: y * cellSize,
    width: cellSize,
    height: cellSize,
    backgroundColor: cell === 1 ? '#1A237E' : 'black',
    ...(cell === 1 && { borderRadius: '4px' })
  };
}

function Dot() {
  return (
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
  );
}

function PowerPellet() {
  return (
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
  );
}

function Player({ position, cellSize }: { position: Position, cellSize: number }) {
  return (
    <div style={{
      position: 'absolute',
      left: position.x * cellSize,
      top: position.y * cellSize,
      width: cellSize,
      height: cellSize,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        width: cellSize * 0.7,
        height: cellSize * 0.7,
        backgroundColor: 'yellow',
        borderRadius: '50%'
      }} />
    </div>
  );
}

function Ghost({ ghost, cellSize, powerMode, index }: { 
  ghost: Ghost, 
  cellSize: number, 
  powerMode: boolean, 
  index: number 
}) {
  const colors = ['red', 'pink', 'cyan', 'orange'];
  return (
    <div style={{
      position: 'absolute',
      left: ghost.x * cellSize,
      top: ghost.y * cellSize,
      width: cellSize,
      height: cellSize,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        width: cellSize * 0.7,
        height: cellSize * 0.7,
        backgroundColor: powerMode ? 'blue' : colors[index % 4],
        borderRadius: '50% 50% 0 0'
      }} />
    </div>
  );
}

function LevelCompleteOverlay({ score }: { score: number }) {
  return (
    <div style={overlayStyle}>
      <div style={{ fontSize: '24px', marginBottom: '16px' }}>Level Complete!</div>
      <div>Score: {score}</div>
    </div>
  );
}

function GameOverOverlay({ score }: { score: number }) {
  return (
    <div style={overlayStyle}>
      <div style={{ fontSize: '24px', marginBottom: '16px' }}>Game Over</div>
      <div>Final Score: {score}</div>
    </div>
  );
}

// API endpoint handler
export async function POST(req: NextRequest) {
  const body = await req.json();
  const state = body.state ? decodeState(JSON.parse(body.state)) : initialState;
  const action = body.untrustedData?.action;

  switch (action) {
    case 'move':
      return handleMove(state, body.untrustedData.direction);
    case 'nextLevel':
      return handleNextLevel(state);
    case 'restart':
      return handleRestart();
    default:
      return new Response('Invalid action', { status: 400 });
  }
}

async function handleMove(state: GameState, direction: string) {
  const newPosition = updatePlayerPosition(state.player, direction, state.maze.size);
  
  if (isValidMove(newPosition, state.maze)) {
    state.player = newPosition;
    handleCellInteraction(state, newPosition);
  }

  updateGhosts(state);
  checkCollisions(state);
  checkLevelCompletion(state);

  return redirectWithState(state);
}

function updatePlayerPosition(player: Position, direction: string, mazeSize: number): Position {
  const newPosition = { ...player };
  switch (direction) {
    case 'up': newPosition.y = Math.max(0, newPosition.y - 1); break;
    case 'down': newPosition.y = Math.min(mazeSize - 1, newPosition.y + 1); break;
    case 'left': newPosition.x = Math.max(0, newPosition.x - 1); break;
    case 'right': newPosition.x = Math.min(mazeSize - 1, newPosition.x + 1); break;
  }
  return newPosition;
}

function isValidMove(position: Position, maze: Maze): boolean {
  return maze.grid[position.y][position.x] !== 1;
}

function handleCellInteraction(state: GameState, position: Position) {
  const cellValue = state.maze.grid[position.y][position.x];
  if (cellValue === 2) {
    state.score += 10;
    state.maze.grid[position.y][position.x] = 0;
  } else if (cellValue === 3) {
    state.score += 50;
    state.powerMode = true;
    state.powerTimer = 20;
    state.maze.grid[position.y][position.x] = 0;
  }
}

function updateGhosts(state: GameState) {
  const levelSettings = getLevelSettings(state.level);
  
  state.ghosts.forEach(ghost => {
    if (Math.random() < 0.05 + (state.level * 0.02)) {
      updateGhostDirection(ghost, state.player);
    } else if (Math.random() < 0.1) {
      setRandomDirection(ghost);
    }
    
    moveGhost(ghost, state.maze, levelSettings.ghostSpeed);
  });
}

function updateGhostDirection(ghost: Ghost, player: Position) {
  const dx = player.x - ghost.x;
  const dy = player.y - ghost.y;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    ghost.direction = { x: Math.sign(dx), y: 0 };
  } else {
    ghost.direction = { x: 0, y: Math.sign(dy) };
  }
}

function setRandomDirection(ghost: Ghost) {
  const directions = [
    {x: 1, y: 0}, {x: -1, y: 0}, 
    {x: 0, y: 1}, {x: 0, y: -1}
  ];
  ghost.direction = directions[Math.floor(Math.random() * directions.length)];
}

function moveGhost(ghost: Ghost, maze: Maze, speed: number) {
  const newX = Math.round(ghost.x + ghost.direction.x * speed);
  const newY = Math.round(ghost.y + ghost.direction.y * speed);
  
  if (newX >= 0 && newX < maze.size && 
      newY >= 0 && newY < maze.size &&
      maze.grid[newY][newX] !== 1) {
    ghost.x = newX;
    ghost.y = newY;
  }
}

function checkCollisions(state: GameState) {
  state.ghosts.forEach(ghost => {
    if (isColliding(ghost, state.player)) {
      handleGhostCollision(state, ghost);
    }
  });
}

function isColliding(a: Position, b: Position): boolean {
  return Math.round(a.x) === Math.round(b.x) && 
         Math.round(a.y) === Math.round(b.y);
}

function handleGhostCollision(state: GameState, ghost: Ghost) {
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
      resetPlayerAndGhosts(state);
    }
  }
}

function resetPlayerAndGhosts(state: GameState) {
  state.player = { ...state.maze.playerStart };
  state.ghosts = state.maze.ghostStarts.map(pos => ({ 
    ...pos, 
    direction: { x: 0, y: 0 } 
  }));
}

function checkLevelCompletion(state: GameState) {
  const dotsRemaining = state.maze.grid.flat().filter(cell => cell === 2).length;
  if (dotsRemaining === 0) {
    state.gameStatus = 'level-complete';
  }
}

async function handleNextLevel(state: GameState) {
  const newState: GameState = {
    ...initialState,
    score: state.score,
    lives: state.lives,
    level: state.level + 1
  };
  
  initializeGameState(newState);
  return redirectWithState(newState);
}

async function handleRestart() {
  return redirectWithState(initialState);
}