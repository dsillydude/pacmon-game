'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useFrame } from '@/components/farcaster-provider'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'
import { parseEther, Address } from 'viem'
import { monadTestnet } from 'viem/chains'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
} from 'wagmi'
import { 
  useReadContract, 
  useWriteContract, 
  useWaitForTransactionReceipt 
} from 'wagmi'

import { 
  LEADERBOARD_CONTRACT_ADDRESS, 
  LEADERBOARD_ABI, 
  OnChainScore, 
  PlayerStats 
} from '@/lib/contract'

// --- Constants and Types ---
const COLORS = {
  MONAD_PURPLE: '#836EF9', MONAD_BLUE: '#200052', MONAD_BERRY: '#A0055D',
  MONAD_OFF_WHITE: '#FBFAF9', MONAD_BLACK: '#000000', WHITE: '#FFFFFF',
  GREEN: '#00FF00', ORANGE: '#FFA500', ELECTRIC_BLUE: '#0080FF',
  PELLET_ORANGE: '#FFB000', GHOST_RED: '#FF0000', GHOST_PINK: '#FFB8FF',
  GHOST_CYAN: '#00FFFF', GHOST_YELLOW: '#FFFF00'
};
const GRID_SIZE = 21;
const CELL_SIZE = 18;
const GAME_WIDTH = GRID_SIZE * CELL_SIZE;
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE;

const MAZE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,3,1], [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,2,1], [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
  [1,1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1,1], [0,0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0,0],
  [1,1,1,1,1,2,1,0,1,4,4,4,1,0,1,2,1,1,1,1,1], [0,0,0,0,0,2,0,0,4,4,4,4,4,0,0,2,0,0,0,0,0],
  [1,1,1,1,1,2,1,0,1,4,4,4,1,0,1,2,1,1,1,1,1], [0,0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0,0],
  [1,1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1,1], [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,2,1], [1,3,2,2,1,2,2,2,2,2,2,2,2,2,2,2,1,2,2,3,1],
  [1,1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1,1], [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,2,2,1,2,2,1,1,1,1,1,1,2,1], [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

interface Position { x: number; y: number; }
interface Ghost {
  id: number; position: Position; direction: Position; color: string;
  vulnerable: boolean; type: 'blinky' | 'pinky' | 'inky' | 'clyde';
  scatterTarget: Position; eaten: boolean;
}
interface GameState {
  pacmon: Position; pacmonDirection: Position; ghosts: Ghost[]; pellets: Position[];
  powerPellets: Position[]; score: number; lives: number; level: number;
  gameStatus: 'pregame' | 'playing' | 'gameOver' | 'levelComplete' | 'postGame';
  powerMode: boolean; powerModeTimer: number; highScore: number; totalPlayers: number;
  totalPlays: number; userOnChainScore: number | null; onChainScores: OnChainScore[];
  showLeaderboard: boolean; gameSpeed: number; isPaused: boolean;
}

// --- SoundManager Class (unchanged) ---
class SoundManager {
  private sounds: { [key: string]: HTMLAudioElement } = {}
  private soundsEnabled: boolean = true
  constructor() { this.loadSounds() }
  private loadSounds() {
    const soundFiles = {
      pelletEat: '/sounds/pellet-eat.mp3', powerPellet: '/sounds/power-pellet.mp3',
      ghostEat: '/sounds/ghost-eat.mp3', death: '/sounds/death.mp3',
      gameOver: '/sounds/game-over.mp3', backgroundMusic: '/sounds/playing-pac-man.mp3',
      arcadeSound: '/sounds/arcade-videogame-sound.mp3'
    };
    Object.entries(soundFiles).forEach(([key, path]) => {
      const audio = new Audio(path); audio.preload = 'auto'; audio.volume = 0.5; this.sounds[key] = audio;
    });
    if (this.sounds.backgroundMusic) { this.sounds.backgroundMusic.loop = true; this.sounds.backgroundMusic.volume = 0.3; }
  }
  play(soundName: string) {
    if (!this.soundsEnabled || !this.sounds[soundName]) return;
    try { const sound = this.sounds[soundName]; sound.currentTime = 0; sound.play().catch(e => console.log('Sound play failed:', e));
    } catch (error) { console.log('Sound error:', error); }
  }
  playBackgroundMusic() {
    if (!this.soundsEnabled || !this.sounds.backgroundMusic) return;
    try { this.sounds.backgroundMusic.play().catch(e => console.log('Background music play failed:', e));
    } catch (error) { console.log('Background music error:', error); }
  }
  stopBackgroundMusic() {
    if (this.sounds.backgroundMusic) { this.sounds.backgroundMusic.pause(); this.sounds.backgroundMusic.currentTime = 0; }
  }
  toggleSounds() { this.soundsEnabled = !this.soundsEnabled; if (!this.soundsEnabled) { this.stopBackgroundMusic(); } return this.soundsEnabled; }
  getSoundsEnabled() { return this.soundsEnabled; }
}

// --- A* Pathfinding Algorithm (for smart ghosts) ---
const aStar = (start: Position, goal: Position, grid: number[][]): Position => {
    const openSet: { pos: Position; g: number; h: number; f: number; parent: any }[] = [];
    const closedSet: boolean[][] = Array(grid.length).fill(false).map(() => Array(grid[0].length).fill(false));
    const heuristic = (posA: Position, posB: Position) => Math.abs(posA.x - posB.x) + Math.abs(posA.y - posB.y);
    openSet.push({ pos: start, g: 0, h: heuristic(start, goal), f: heuristic(start, goal), parent: null });
    while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        if (!current) break;
        if (current.pos.x === goal.x && current.pos.y === goal.y) {
            let temp = current;
            let path = [];
            while (temp.parent) { path.push(temp.pos); temp = temp.parent; }
            if (path.length > 0) {
                const nextStep = path[path.length - 1];
                return { x: nextStep.x - start.x, y: nextStep.y - start.y };
            }
            break;
        }
        closedSet[current.pos.y][current.pos.x] = true;
        const neighbors = [{ x: current.pos.x, y: current.pos.y - 1 }, { x: current.pos.x, y: current.pos.y + 1 }, { x: current.pos.x - 1, y: current.pos.y }, { x: current.pos.x + 1, y: current.pos.y }];
        for (const neighborPos of neighbors) {
            if (neighborPos.y < 0 || neighborPos.y >= grid.length || neighborPos.x < 0 || neighborPos.x >= grid[0].length || grid[neighborPos.y][neighborPos.x] === 1 || closedSet[neighborPos.y][neighborPos.x]) continue;
            const gScore = current.g + 1;
            const existingNeighbor = openSet.find(node => node.pos.x === neighborPos.x && node.pos.y === neighborPos.y);
            if (!existingNeighbor || gScore < existingNeighbor.g) {
                const hScore = heuristic(neighborPos, goal);
                if (existingNeighbor) { existingNeighbor.g = gScore; existingNeighbor.f = gScore + hScore; existingNeighbor.parent = current; } 
                else { openSet.push({ pos: neighborPos, g: gScore, h: hScore, f: gScore + hScore, parent: current }); }
            }
        }
    }
    const fallbackMoves = [{x:1, y:0}, {x:-1, y:0}, {x:0, y:1}, {x:0, y:-1}];
    return fallbackMoves[Math.floor(Math.random() * 4)];
};

// --- Dumb Movement AI (for Level 1 ghosts) ---
const getDumbMove = (ghost: Ghost, pacman: Position, grid: number[][]): Position => {
    const validMoves: Position[] = [];
    const directions = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}];
    const oppositeDirection = { x: -ghost.direction.x, y: -ghost.direction.y };

    for (const dir of directions) {
        if (dir.x === oppositeDirection.x && dir.y === oppositeDirection.y && validMoves.length > 1) {
            continue; // Don't allow reversing unless it's the only option
        }
        const nextPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y };
        if (nextPos.y >= 0 && nextPos.y < grid.length && nextPos.x >= 0 && nextPos.x < grid[0].length && grid[nextPos.y][nextPos.x] !== 1) {
            validMoves.push(dir);
        }
    }

    if (validMoves.length > 0) {
        // Simple bias: if a move gets closer to pacman, prefer it, but with some randomness.
        validMoves.sort((a, b) => {
            const distA = Math.abs((ghost.position.x + a.x) - pacman.x) + Math.abs((ghost.position.y + a.y) - pacman.y);
            const distB = Math.abs((ghost.position.x + b.x) - pacman.x) + Math.abs((ghost.position.y + b.y) - pacman.y);
            return distA - distB;
        });
        if (Math.random() > 0.3 && validMoves.length > 1) {
            return validMoves[1]; // Occasionally make a less optimal move
        }
        return validMoves[0];
    }
    return ghost.direction; // Keep going if stuck
}

// --- Initial Game State Setup ---
const getInitialGhosts = (level: number): Ghost[] => {
    const initialGhosts: Ghost[] = [
        { id: 1, position: { x: 10, y: 9 }, direction: { x: 1, y: 0 }, color: COLORS.GHOST_RED, vulnerable: false, type: 'blinky', scatterTarget: { x: 18, y: 0 }, eaten: false },
        { id: 2, position: { x: 9, y: 10 }, direction: { x: -1, y: 0 }, color: COLORS.GHOST_PINK, vulnerable: false, type: 'pinky', scatterTarget: { x: 1, y: 0 }, eaten: false },
    ];
    if (level >= 2) {
        initialGhosts.push({ id: 3, position: { x: 11, y: 10 }, direction: { x: 1, y: 0 }, color: COLORS.GHOST_CYAN, vulnerable: false, type: 'inky', scatterTarget: { x: 18, y: 20 }, eaten: false });
    }
    if (level >= 3) {
        initialGhosts.push({ id: 4, position: { x: 10, y: 10 }, direction: { x: -1, y: 0 }, color: COLORS.GHOST_YELLOW, vulnerable: false, type: 'clyde', scatterTarget: { x: 1, y: 20 }, eaten: false });
    }
    return initialGhosts;
};

export default function PacmonGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const soundManagerRef = useRef<SoundManager | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null); // For swipe controls
  const { isEthProviderAvailable } = useFrame()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { connect } = useConnect()
  const [scoreSaved, setScoreSaved] = useState(false)
  
  const { data: topScores, refetch: refetchTopScores } = useReadContract({ address: LEADERBOARD_CONTRACT_ADDRESS, abi: LEADERBOARD_ABI, functionName: 'getTopScores', args: [10n], query: { enabled: isConnected && chainId === monadTestnet.id, } });
  const { data: playerStats, refetch: refetchPlayerStats } = useReadContract({ address: LEADERBOARD_CONTRACT_ADDRESS, abi: LEADERBOARD_ABI, functionName: 'getPlayerStats', args: [address as Address], query: { enabled: !!address && isConnected && chainId === monadTestnet.id, } });
  const { data: totalPlayers } = useReadContract({ address: LEADERBOARD_CONTRACT_ADDRESS, abi: LEADERBOARD_ABI, functionName: 'getTotalPlayers', query: { enabled: isConnected && chainId === monadTestnet.id, } });
  
  // Updated wagmi hooks for better UI feedback
  const { writeContract: submitScore, data: submitHash, isPending: isSubmitting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: submitHash, });

  const [gameState, setGameState] = useState<GameState>({
    pacmon: { x: 10, y: 15 }, pacmonDirection: { x: 0, y: 0 },
    ghosts: getInitialGhosts(1), // Start with Level 1 ghosts
    pellets: [], powerPellets: [], score: 0, lives: 3, level: 1,
    gameStatus: 'pregame', powerMode: false, powerModeTimer: 0, highScore: 0,
    totalPlayers: 0, totalPlays: 0, userOnChainScore: null, onChainScores: [],
    showLeaderboard: false, gameSpeed: 250, isPaused: false // Slower start speed
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { soundManagerRef.current = new SoundManager(); }, []);

  const loadOnChainScores = useCallback(async () => { /* Unchanged */
    if (topScores && playerStats) {
      const formattedScores: OnChainScore[] = (topScores as any[]).map((score: any) => ({ player: score.player, score: BigInt(score.score), timestamp: BigInt(score.timestamp), level: BigInt(score.level), }));
      setGameState(prev => ({ ...prev, onChainScores: formattedScores, userOnChainScore: playerStats ? Number((playerStats as PlayerStats).bestScore) : null, highScore: Number(formattedScores[0]?.score) || 0, totalPlayers: Number(totalPlayers || 0n) }));
    }
  }, [topScores, playerStats, totalPlayers]);

  useEffect(() => { /* Unchanged */
    if (isConnected && address && chainId === monadTestnet.id) { loadOnChainScores(); }
  }, [isConnected, address, chainId, loadOnChainScores]);

  useEffect(() => { /* Unchanged */
    const pellets: Position[] = []; const powerPellets: Position[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (MAZE[y][x] === 2) { pellets.push({ x, y }); } 
        else if (MAZE[y][x] === 3) { powerPellets.push({ x, y }); }
      }
    }
    setGameState(prev => ({ ...prev, pellets, powerPellets }));
  }, []);

  // --- Main Game Loop ---
  useEffect(() => {
    const gameLoop = setInterval(() => {
      if (gameState.gameStatus === 'playing' && !gameState.isPaused) {
        setGameState(prev => {
          let newState = { ...prev };
          
          // --- Pacmon Movement (unchanged) ---
          let newPacmonPos = { x: newState.pacmon.x + newState.pacmonDirection.x, y: newState.pacmon.y + newState.pacmonDirection.y };
          if (newPacmonPos.x < 0) { newPacmonPos.x = GRID_SIZE - 1; } 
          else if (newPacmonPos.x >= GRID_SIZE) { newPacmonPos.x = 0; }
          if (newPacmonPos.y >= 0 && newPacmonPos.y < GRID_SIZE && MAZE[newPacmonPos.y][newPacmonPos.x] !== 1) {
            newState.pacmon = newPacmonPos;
            const pelletIndex = newState.pellets.findIndex(p => p.x === newState.pacmon.x && p.y === newState.pacmon.y);
            if (pelletIndex !== -1) {
              newState.pellets = newState.pellets.filter((_, i) => i !== pelletIndex);
              newState.score += 10 * newState.level;
              soundManagerRef.current?.play('pelletEat');
            }
            const powerPelletIndex = newState.powerPellets.findIndex(p => p.x === newState.pacmon.x && p.y === newState.pacmon.y);
            if (powerPelletIndex !== -1) {
              newState.powerPellets = newState.powerPellets.filter((_, i) => i !== powerPelletIndex);
              newState.score += 50 * newState.level;
              newState.powerMode = true;
              newState.powerModeTimer = Math.max(20, 35 - newState.level * 2);
              soundManagerRef.current?.play('powerPellet');
            }
          } else {
            newState.pacmonDirection = { x: 0, y: 0 };
          }

          // --- Ghost Movement with Progressive AI ---
          newState.ghosts = newState.ghosts.map(ghost => {
            if (ghost.eaten) { /* Ghost eaten logic remains unchanged */
              if (ghost.position.x === 10 && (ghost.position.y === 9 || ghost.position.y === 10)) { return { ...ghost, eaten: false, vulnerable: false }; }
              const target = { x: 10, y: 9 }; const bestDirection = aStar(ghost.position, target, MAZE);
              let newPos = { x: ghost.position.x + bestDirection.x, y: ghost.position.y + bestDirection.y };
              if (newPos.x < 0) newPos.x = GRID_SIZE - 1; else if (newPos.x >= GRID_SIZE) newPos.x = 0;
              return { ...ghost, direction: bestDirection, position: newPos };
            }

            let bestDirection: Position;
            if (newState.powerMode) {
              // Frightened mode: random movement (unchanged)
              const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
              const validDirections = directions.filter(dir => { let testPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }; if (testPos.x < 0) testPos.x = GRID_SIZE - 1; else if (testPos.x >= GRID_SIZE) testPos.x = 0; return testPos.y >= 0 && testPos.y < GRID_SIZE && MAZE[testPos.y][testPos.x] !== 1; });
              bestDirection = validDirections[Math.floor(Math.random() * validDirections.length)] || { x: 0, y: 0 };
            
            } else if (newState.level === 1) {
              // LEVEL 1: Use "dumb" AI
              bestDirection = getDumbMove(ghost, newState.pacmon, MAZE);
            
            } else {
              // LEVEL 2+: Use smart A* AI with personalities
              let targetTile: Position;
              switch (ghost.type) {
                case 'blinky': targetTile = newState.pacmon; break;
                case 'pinky': targetTile = { x: Math.max(0, Math.min(GRID_SIZE - 1, newState.pacmon.x + newState.pacmonDirection.x * 4)), y: Math.max(0, Math.min(GRID_SIZE - 1, newState.pacmon.y + newState.pacmonDirection.y * 4)) }; break;
                case 'inky':
                  const blinky = newState.ghosts.find(g => g.type === 'blinky');
                  if (blinky) {
                    const pacmanTwoAhead = { x: Math.max(0, Math.min(GRID_SIZE - 1, newState.pacmon.x + newState.pacmonDirection.x * 2)), y: Math.max(0, Math.min(GRID_SIZE - 1, newState.pacmon.y + newState.pacmonDirection.y * 2)) };
                    const vector = { x: pacmanTwoAhead.x - blinky.position.x, y: pacmanTwoAhead.y - blinky.position.y };
                    targetTile = { x: Math.max(0, Math.min(GRID_SIZE - 1, blinky.position.x + vector.x * 2)), y: Math.max(0, Math.min(GRID_SIZE - 1, blinky.position.y + vector.y * 2)) };
                  } else { targetTile = newState.pacmon; }
                  break;
                case 'clyde':
                  const distance = Math.sqrt(Math.pow(ghost.position.x - newState.pacmon.x, 2) + Math.pow(ghost.position.y - newState.pacmon.y, 2));
                  targetTile = (distance < 8) ? ghost.scatterTarget : newState.pacmon;
                  break;
                default: targetTile = newState.pacmon;
              }
              bestDirection = aStar(ghost.position, targetTile, MAZE);
            }

            let newPos = { x: ghost.position.x + bestDirection.x, y: ghost.position.y + bestDirection.y };
            if (newPos.x < 0) newPos.x = GRID_SIZE - 1; else if (newPos.x >= GRID_SIZE) newPos.x = 0;
            return { ...ghost, direction: bestDirection, position: newPos, vulnerable: newState.powerMode };
          });
          
          // --- Collision Detection (unchanged) ---
          newState.ghosts.forEach(ghost => {
            if (ghost.position.x === newState.pacmon.x && ghost.position.y === newState.pacmon.y) {
              if (ghost.vulnerable) {
                newState.score += 200 * newState.level; ghost.eaten = true; ghost.vulnerable = false;
                soundManagerRef.current?.play('ghostEat');
              } else if (!ghost.eaten) {
                newState.lives -= 1; newState.pacmon = { x: 10, y: 15 }; newState.pacmonDirection = { x: 0, y: 0 };
                newState.ghosts = getInitialGhosts(newState.level); // Reset ghosts for the current level
                soundManagerRef.current?.play('death');
                if (newState.lives <= 0) {
                  newState.gameStatus = 'postGame'; soundManagerRef.current?.stopBackgroundMusic(); soundManagerRef.current?.play('gameOver');
                }
              }
            }
          });
          
          if (newState.powerMode) { /* Power mode timer logic unchanged */
            newState.powerModeTimer -= 1;
            if (newState.powerModeTimer <= 0) { newState.powerMode = false; newState.ghosts = newState.ghosts.map(ghost => ({ ...ghost, vulnerable: false })); }
          }
          
          // --- Level Completion Logic ---
          if (newState.pellets.length === 0 && newState.powerPellets.length === 0) {
            newState.level += 1; 
            newState.score += 1000 * (newState.level - 1);
            newState.gameSpeed = Math.max(120, 250 - (newState.level - 1) * 15); // Increase speed
            
            const pellets: Position[] = []; const powerPellets: Position[] = [];
            for (let y = 0; y < GRID_SIZE; y++) { for (let x = 0; x < GRID_SIZE; x++) { if (MAZE[y][x] === 2) { pellets.push({ x, y }); } else if (MAZE[y][x] === 3) { powerPellets.push({ x, y }); } } }
            
            newState.pellets = pellets; 
            newState.powerPellets = powerPellets;
            newState.pacmon = { x: 10, y: 15 }; 
            newState.pacmonDirection = { x: 0, y: 0 };
            newState.ghosts = getInitialGhosts(newState.level); // Add more ghosts for new level
          }
          
          return newState;
        });
      }
    }, gameState.gameSpeed);
    return () => clearInterval(gameLoop);
  }, [gameState.gameStatus, gameState.gameSpeed, gameState.isPaused]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState.gameStatus !== 'playing') return;
    const { key } = event; let newDirection = { x: 0, y: 0 };
    switch (key) {
      case 'ArrowUp': case 'w': case 'W': newDirection.y = -1; break;
      case 'ArrowDown': case 's': case 'S': newDirection.y = 1; break;
      case 'ArrowLeft': case 'a': case 'A': newDirection.x = -1; break;
      case 'ArrowRight': case 'd': case 'D': newDirection.x = 1; break;
      default: return;
    }
    let nextX = gameState.pacmon.x + newDirection.x; let nextY = gameState.pacmon.y + newDirection.y;
    if (nextX < 0) nextX = GRID_SIZE - 1; else if (nextX >= GRID_SIZE) nextX = 0;
    if (nextY >= 0 && nextY < GRID_SIZE && MAZE[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }));
    }
  }, [gameState.pacmon, gameState.gameStatus]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => { /* Canvas rendering logic remains unchanged */
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = COLORS.MONAD_BLACK; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = COLORS.ELECTRIC_BLUE; ctx.strokeStyle = COLORS.ELECTRIC_BLUE; ctx.lineWidth = 2;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (MAZE[y][x] === 1) { const cornerRadius = 2; ctx.beginPath(); ctx.roundRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2, cornerRadius); ctx.fill(); }
      }
    }
    ctx.fillStyle = COLORS.PELLET_ORANGE;
    gameState.pellets.forEach(pellet => { ctx.beginPath(); ctx.arc(pellet.x * CELL_SIZE + CELL_SIZE / 2, pellet.y * CELL_SIZE + CELL_SIZE / 2, 2, 0, 2 * Math.PI); ctx.fill(); });
    gameState.powerPellets.forEach(pellet => {
      ctx.beginPath(); ctx.arc(pellet.x * CELL_SIZE + CELL_SIZE / 2, pellet.y * CELL_SIZE + CELL_SIZE / 2, 7, 0, 2 * Math.PI); ctx.fill();
      ctx.shadowColor = COLORS.PELLET_ORANGE; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    });
    ctx.fillStyle = COLORS.MONAD_PURPLE; ctx.beginPath();
    let startAngle = 0.2 * Math.PI, endAngle = 1.8 * Math.PI;
    if (gameState.pacmonDirection.x > 0) { startAngle = 0.2 * Math.PI; endAngle = 1.8 * Math.PI; } 
    else if (gameState.pacmonDirection.x < 0) { startAngle = 1.2 * Math.PI; endAngle = 0.8 * Math.PI; } 
    else if (gameState.pacmonDirection.y > 0) { startAngle = 0.7 * Math.PI; endAngle = 0.3 * Math.PI; } 
    else if (gameState.pacmonDirection.y < 0) { startAngle = 1.7 * Math.PI; endAngle = 1.3 * Math.PI; }
    ctx.arc(gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2, gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, startAngle, endAngle);
    ctx.lineTo(gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2, gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2); ctx.fill();
    gameState.ghosts.forEach(ghost => {
      ctx.fillStyle = ghost.vulnerable ? COLORS.MONAD_BLUE : ghost.color;
      ctx.beginPath(); ctx.arc(ghost.position.x * CELL_SIZE + CELL_SIZE / 2, ghost.position.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, Math.PI, 2 * Math.PI);
      ctx.rect(ghost.position.x * CELL_SIZE + 2, ghost.position.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE - 4, CELL_SIZE / 2 - 2); ctx.fill();
      ctx.beginPath();
      const bottomY = ghost.position.y * CELL_SIZE + CELL_SIZE - 2, leftX = ghost.position.x * CELL_SIZE + 2, rightX = ghost.position.x * CELL_SIZE + CELL_SIZE - 2, waveHeight = 3;
      ctx.moveTo(leftX, bottomY - waveHeight);
      for (let i = 0; i < 4; i++) { const x = leftX + (i + 0.5) * (CELL_SIZE - 4) / 4; ctx.lineTo(x, bottomY - (i % 2 === 0 ? 0 : waveHeight)); }
      ctx.lineTo(rightX, bottomY - waveHeight); ctx.lineTo(rightX, ghost.position.y * CELL_SIZE + CELL_SIZE / 2); ctx.lineTo(leftX, ghost.position.y * CELL_SIZE + CELL_SIZE / 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = COLORS.WHITE; const eyeSize = 3, eyeY = ghost.position.y * CELL_SIZE + 6;
      ctx.fillRect(ghost.position.x * CELL_SIZE + 5, eyeY, eyeSize, eyeSize); ctx.fillRect(ghost.position.x * CELL_SIZE + CELL_SIZE - 8, eyeY, eyeSize, eyeSize);
      ctx.fillStyle = COLORS.MONAD_BLACK; const pupilSize = 1;
      ctx.fillRect(ghost.position.x * CELL_SIZE + 6, eyeY + 1, pupilSize, pupilSize); ctx.fillRect(ghost.position.x * CELL_SIZE + CELL_SIZE - 7, eyeY + 1, pupilSize, pupilSize);
    });
  }, [gameState]);

  const handleWalletConnect = async () => { /* Unchanged */
    setConnectionError(null); setIsConnecting(true);
    try {
      if (!isConnected) {
        if (isEthProviderAvailable) { await connect({ connector: farcasterFrame() }); } 
        else { setConnectionError("Farcaster wallet not available"); setIsConnecting(false); return; }
      }
      if (chainId !== monadTestnet.id) { await switchChain({ chainId: monadTestnet.id }); }
      setGameState(prev => ({ ...prev, gameStatus: 'playing' })); soundManagerRef.current?.playBackgroundMusic();
    } catch (error) { console.error("Wallet connection failed:", error); setConnectionError("Failed to connect wallet. Please try again.");
    } finally { setIsConnecting(false); }
  };

  const handleScoreSubmission = async () => {
    if (!isConnected || chainId !== monadTestnet.id || !address) { setSubmitError("Please connect your wallet and switch to Monad Testnet"); return; }
    setSubmitError(null);
    try {
      submitScore({
        address: LEADERBOARD_CONTRACT_ADDRESS, abi: LEADERBOARD_ABI, functionName: 'submitScore',
        args: [BigInt(gameState.score), BigInt(gameState.level)], value: parseEther("0.015")
      });
    } catch (error: any) {
      console.error("Score submission failed:", error);
      if (error.message?.includes("insufficient funds")) { setSubmitError("Insufficient funds. You need at least 0.015 MON plus gas fees."); } 
      else if (error.message?.includes("user rejected")) { setSubmitError("Transaction was cancelled."); } 
      else { setSubmitError("Failed to submit score. Please try again."); }
    }
  };

  useEffect(() => {
    if (isConfirmed) {
      setScoreSaved(true); 
      refetchTopScores(); 
      refetchPlayerStats();
      setGameState(prev => ({ ...prev, userOnChainScore: prev.score }));
    }
  }, [isConfirmed, refetchTopScores, refetchPlayerStats]);

  const startGame = () => { /* Unchanged */
    if (!isConnected) { handleWalletConnect(); } 
    else if (chainId !== monadTestnet.id) { switchChain({ chainId: monadTestnet.id }); } 
    else { setGameState(prev => ({ ...prev, gameStatus: 'playing' })); soundManagerRef.current?.playBackgroundMusic(); }
  };

  const restartGame = () => {
    setScoreSaved(false);
    const initialLevel = 1;
    const pellets: Position[] = []; 
    const powerPellets: Position[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (MAZE[y][x] === 2) { pellets.push({ x, y }); } 
        else if (MAZE[y][x] === 3) { powerPellets.push({ x, y }); }
      }
    }
    
    setGameState(prev => ({
      ...prev, 
      pacmon: { x: 10, y: 15 }, 
      pacmonDirection: { x: 0, y: 0 },
      ghosts: getInitialGhosts(initialLevel),
      score: 0, 
      lives: 3, 
      level: initialLevel, 
      gameStatus: 'playing', 
      powerMode: false,
      powerModeTimer: 0, 
      gameSpeed: 250, // Reset to slower speed
      isPaused: false,
      pellets: pellets,
      powerPellets: powerPellets,
    }));
    soundManagerRef.current?.playBackgroundMusic();
  };

  const exitGame = () => { setGameState(prev => ({ ...prev, gameStatus: 'pregame' })); soundManagerRef.current?.stopBackgroundMusic(); };
  const toggleLeaderboard = () => { setGameState(prev => ({ ...prev, showLeaderboard: !prev.showLeaderboard })); };
  const toggleSounds = () => { const soundsEnabled = soundManagerRef.current?.toggleSounds(); return soundsEnabled; };

  const handleDirectionPress = useCallback((direction: Position) => {
    if (gameState.gameStatus !== 'playing') return;
    let nextX = gameState.pacmon.x + direction.x; let nextY = gameState.pacmon.y + direction.y;
    if (nextX < 0) nextX = GRID_SIZE - 1; else if (nextX >= GRID_SIZE) nextX = 0;
    if (nextY >= 0 && nextY < GRID_SIZE && MAZE[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: direction }));
    }
  }, [gameState.pacmon, gameState.gameStatus]);

  // --- Swipe Controls Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartRef.current.x;
    const deltaY = touchEndY - touchStartRef.current.y;
    const swipeThreshold = 30; // Minimum pixels for a swipe

    if (Math.abs(deltaX) > Math.abs(deltaY)) { // Horizontal swipe
      if (Math.abs(deltaX) > swipeThreshold) {
        handleDirectionPress(deltaX > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
      }
    } else { // Vertical swipe
      if (Math.abs(deltaY) > swipeThreshold) {
        handleDirectionPress(deltaY > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
      }
    }

    touchStartRef.current = null; // Reset for next touch
  };

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
      {gameState.gameStatus === 'pregame' && !gameState.showLeaderboard && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">PACMON</h1>
            <div className="space-y-3 text-center" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              <div className="text-lg md:text-xl font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>Leaderboard - Real Player Scores Only</div>
              <div className="space-y-2 bg-black bg-opacity-30 rounded-lg p-4">
                {gameState.onChainScores.slice(0, 3).map((score, index) => (
                  <div key={index} className="flex items-center justify-between text-base md:text-lg" style={{ color: index === 0 ? COLORS.MONAD_BERRY : index === 1 ? COLORS.MONAD_BLUE : COLORS.MONAD_OFF_WHITE }}>
                    <span className="flex items-center"><span className="text-xl mr-2">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span><span className="font-bold">{index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'}</span></span>
                    <span className="font-mono">{score.score.toLocaleString()}</span>
                    <span className="text-sm font-mono">{`${score.player.slice(0, 4)}...${score.player.slice(-4)}`}</span>
                  </div>
                ))}
                {gameState.onChainScores.length === 0 && (<div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>No scores saved yet - be the first!</div>)}
              </div>
            </div>
          </div>
          {gameState.userOnChainScore !== null && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ borderColor: COLORS.MONAD_PURPLE, backgroundColor: 'rgba(131, 110, 249, 0.1)' }}>
              <div className="text-center space-y-2">
                <div className="text-sm font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>Your Best Onchain Score</div>
                <div className="text-xl font-mono font-bold" style={{ color: COLORS.MONAD_OFF_WHITE }}>{gameState.userOnChainScore.toLocaleString()}</div>
              </div>
            </div>
          )}
          {isConnected && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ borderColor: COLORS.MONAD_PURPLE, backgroundColor: 'rgba(131, 110, 249, 0.1)' }}>
              <div className="text-center space-y-2">
                <div className="text-sm font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>Wallet Connected</div>
                <div className="text-xs font-mono" style={{ color: COLORS.MONAD_OFF_WHITE }}>{address?.slice(0, 6)}...{address?.slice(-4)}</div>
                <div className="text-xs" style={{ color: COLORS.MONAD_OFF_WHITE }}>Chain: {chainId === monadTestnet.id ? 'Monad Testnet' : 'Switch to Monad Testnet'}</div>
              </div>
            </div>
          )}
          <div className="w-full max-w-md space-y-4 px-4">
            {connectionError && (<div className="w-full p-3 rounded-lg border-2" style={{ borderColor: COLORS.GHOST_RED, backgroundColor: 'rgba(255, 0, 0, 0.1)', color: COLORS.GHOST_RED }}><div className="text-center text-sm">{connectionError}</div></div>)}
            <button onClick={startGame} disabled={isConnecting} className="w-full py-6 px-8 text-xl md:text-2xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: COLORS.MONAD_BERRY, color: COLORS.WHITE }}>
              {isConnecting ? 'Connecting...' : !isConnected ? 'Connect Wallet to Play' : chainId !== monadTestnet.id ? 'Switch to Monad Testnet' : 'Start Game'}
            </button>
            <button onClick={toggleLeaderboard} className="w-full py-4 px-6 text-lg font-bold rounded-lg transition-all duration-200" style={{ backgroundColor: COLORS.MONAD_PURPLE, color: COLORS.WHITE }}>View Leaderboard</button>
            {isConnected && (<button onClick={() => disconnect()} className="w-full py-4 px-6 text-lg font-bold rounded-lg transition-all duration-200" style={{ backgroundColor: 'transparent', color: COLORS.MONAD_OFF_WHITE, border: `1px solid ${COLORS.MONAD_OFF_WHITE}` }}>Disconnect Wallet</button>)}
          </div>
          <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            <p>Enhanced with progressive difficulty and improved maze design!</p>
            <p className="mt-1">Eat all pellets while avoiding ghosts - levels get harder!</p>
            <p className="mt-2 text-xs" style={{ color: COLORS.MONAD_PURPLE }}>Submit your score to the blockchain for 0.015 MON!</p>
          </div>
        </div>
      )}
      {gameState.showLeaderboard && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>Leaderboard</h2>
            <p className="text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>Real player scores only - no mock data</p>
          </div>
          <div className="w-full max-w-md space-y-2 px-4">
            {gameState.onChainScores.map((score, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-black bg-opacity-30">
                <span className="text-lg font-bold" style={{ color: COLORS.MONAD_PURPLE }}>#{index + 1}</span>
                <span className="font-mono text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>{score.score.toLocaleString()}</span>
                <span className="text-sm font-mono" style={{ color: COLORS.MONAD_OFF_WHITE }}>{`${score.player.slice(0, 4)}...${score.player.slice(-4)}`}</span>
              </div>
            ))}
            {gameState.onChainScores.length === 0 && (<div className="text-center p-8" style={{ color: COLORS.MONAD_OFF_WHITE }}><p>No scores saved onchain yet.</p><p className="mt-2 text-sm">Be the first to save your score!</p></div>)}
          </div>
          <button onClick={toggleLeaderboard} className="py-4 px-8 text-lg font-bold rounded-lg" style={{ backgroundColor: COLORS.MONAD_BERRY, color: COLORS.WHITE }}>Back to Game</button>
        </div>
      )}
      {(gameState.gameStatus === 'playing') && (
        <div 
          className="flex flex-col h-screen w-full"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="text-center py-2" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
            <h1 className="text-xl md:text-2xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>PACMON</h1>
            <div className="flex justify-center space-x-4 text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              <div>Score: {gameState.score}</div><div>Lives: {gameState.lives}</div><div>Level: {gameState.level}</div>
              {gameState.powerMode && (<div style={{ color: COLORS.MONAD_PURPLE }}>Power: {Math.ceil(gameState.powerModeTimer / 5)}s</div>)}
              <button onClick={() => setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }))} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: COLORS.MONAD_BLUE, color: COLORS.WHITE }}>{gameState.isPaused ? '▶️ Play' : '⏸️ Pause'}</button>
              <button onClick={toggleSounds} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: COLORS.MONAD_BLUE, color: COLORS.WHITE }}>{soundManagerRef.current?.getSoundsEnabled() ? '🔊' : '🔇'}</button>
            </div>
          </div>
          <div className="flex flex-col h-full">
            <div className="flex-1 flex items-start justify-center pt-4">
              <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="max-w-full max-h-full" style={{ backgroundColor: COLORS.MONAD_BLACK }}/>
            </div>
            {/* On-screen buttons removed for a clean swipe-based UI */}
          </div>
        </div>
      )}
      {gameState.gameStatus === 'postGame' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>Game Over!</h2>
            <p className="text-xl md:text-2xl" style={{ color: COLORS.MONAD_OFF_WHITE }}>Final Score: {gameState.score}</p>
            <p className="text-lg" style={{ color: COLORS.PELLET_ORANGE }}>Level Reached: {gameState.level}</p>
            {gameState.score > (gameState.userOnChainScore || 0) && !isConfirmed && (<p className="text-lg" style={{ color: COLORS.GREEN }}>🎉 New Personal Best! 🎉</p>)}
          </div>
          <div className="w-full max-w-md space-y-4 px-4">
            {isConnected && chainId === monadTestnet.id && (
              <div className="text-center">
                {submitError && (<div className="w-full p-3 mb-4 rounded-lg border-2" style={{ borderColor: COLORS.GHOST_RED, backgroundColor: 'rgba(255, 0, 0, 0.1)', color: COLORS.GHOST_RED }}><div className="text-center text-sm">{submitError}</div></div>)}
                <button 
                  onClick={handleScoreSubmission} 
                  disabled={isSubmitting || isConfirming || isConfirmed} 
                  className="w-full py-6 px-8 text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" 
                  style={{ backgroundColor: isConfirmed ? COLORS.MONAD_BERRY : COLORS.MONAD_PURPLE, color: COLORS.WHITE }}
                >
                  {isSubmitting ? 'Confirm in wallet...' : 
                   isConfirming ? 'Saving to chain...' : 
                   isConfirmed ? 'Score Saved On-Chain!' : 
                   `Save Score On-Chain (0.015 MON)`}
                </button>
                {isConfirmed && (<p className="mt-3 text-sm" style={{ color: COLORS.GREEN }}>Your score has been permanently saved to the blockchain!</p>)}
              </div>
            )}
            <button onClick={restartGame} className="w-full py-6 px-8 text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95" style={{ backgroundColor: COLORS.MONAD_PURPLE, color: COLORS.WHITE }}>Play Again</button>
            <button onClick={exitGame} className="w-full py-6 px-8 text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95" style={{ backgroundColor: COLORS.MONAD_BERRY, color: COLORS.WHITE }}>Exit Game</button>
          </div>
          <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            <p>Submit your score to compete on the leaderboard!</p>
            <p className="mt-1">Challenge yourself to reach higher levels!</p>
          </div>
        </div>
      )}
    </div>
  )
}
