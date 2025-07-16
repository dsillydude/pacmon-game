'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useFrame } from '@/components/farcaster-provider'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'
import { parseEther, toHex } from 'viem'
import { monadTestnet } from 'viem/chains'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
  usePublicClient,
} from 'wagmi'

// Monad color palette
const COLORS = {
  MONAD_PURPLE: '#836EF9',
  MONAD_BLUE: '#200052',
  MONAD_BERRY: '#A0055D',
  MONAD_OFF_WHITE: '#FBFAF9',
  MONAD_BLACK: '#0E100F',
  WHITE: '#FFFFFF',
  GREEN: '#00FF00',
  ORANGE: '#FFA500',
  YELLOW: '#FFFF00',
};

// Game constants
const GRID_SIZE = 20
const CELL_SIZE = 20
const GAME_WIDTH = GRID_SIZE * CELL_SIZE
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE
const SCORE_CONTRACT_ADDRESS = '0x1F0e9dcd371af37AD20E96A5a193d78052dCA984'

// --- MAZE DEFINITIONS FOR LEVELS ---
// 1 = wall, 0 = empty space, 2 = pellet, 3 = power pellet, 4 = Pacmon start, 5 = Ghost start
const MAZE_LEVEL_1 = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,2,1,0,0,0,2,0,0,0,0,0,0,2,0,0,0,1,2,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,1,1,5,1,1,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,2,1,1,5,1,1,2,1,1,1,1,1,1,1],
    [0,0,0,0,0,1,2,1,1,1,1,1,2,1,0,0,0,0,0,0],
    [1,1,1,1,1,1,2,1,1,1,1,1,2,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,2,2,2,1,1,2,2,2,2,2,2,2,2,1,1,2,2,2,1],
    [1,1,2,2,1,1,2,1,1,4,1,1,2,1,1,2,2,1,1,1],
    [1,2,2,2,2,2,2,1,1,1,1,1,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,2,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,2,1],
    [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const MAZE_LEVEL_2 = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,2,1,1,1,1,2,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,1,2,2,1,1,2,2,1,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,2,1,1,2,1,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,2,5,2,2,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,2,1,0,0,1,2,1,2,1,1,1,1,1],
    [2,2,2,2,2,2,2,2,1,0,0,1,2,2,2,2,2,2,2,2],
    [1,1,1,1,1,2,1,2,1,0,0,1,2,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,2,2,2,2,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,1,2,1,1,2,1,1,2,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,2,1],
    [1,3,2,2,1,2,2,2,2,4,2,2,2,2,2,1,2,2,3,1],
    [1,1,1,2,1,2,1,2,1,1,1,1,2,1,2,1,2,1,1,1],
    [1,2,2,2,2,2,1,2,2,1,1,2,2,1,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const MAZES = [MAZE_LEVEL_1, MAZE_LEVEL_2]; // Add more levels here

// Game entities
interface Position { x: number; y: number }
interface Ghost {
  id: number;
  position: Position;
  startPosition: Position;
  direction: Position;
  color: string;
  vulnerable: boolean;
  eaten: boolean;
}
interface OnChainScore { address: string; score: number; timestamp: number }

interface GameState {
  pacmon: Position;
  pacmonStart: Position;
  pacmonDirection: Position;
  ghosts: Ghost[];
  pellets: Position[];
  powerPellets: Position[];
  score: number;
  lives: number;
  level: number;
  gameStatus: 'pregame' | 'playing' | 'levelComplete' | 'postGame' | 'paused';
  powerMode: boolean;
  powerModeTimer: number;
  highScore: number;
  userOnChainScore: number | null;
  onChainScores: OnChainScore[];
  showLeaderboard: boolean;
}

// Sound Manager Class
class SoundManager {
    private sounds: { [key: string]: HTMLAudioElement } = {};
    private soundsEnabled: boolean = true;

    constructor() { this.loadSounds(); }

    private loadSounds() {
        const soundFiles = {
            pelletEat: '/sounds/pellet-eat.mp3',
            powerPellet: '/sounds/power-pellet.mp3',
            ghostEat: '/sounds/ghost-eat.mp3',
            death: '/sounds/death.mp3',
            gameOver: '/sounds/game-over.mp3',
            levelComplete: '/sounds/arcade-videogame-sound.mp3',
            backgroundMusic: '/sounds/playing-pac-man.mp3',
        };
        Object.entries(soundFiles).forEach(([key, path]) => {
            const audio = new Audio(path);
            audio.preload = 'auto';
            this.sounds[key] = audio;
        });
        if (this.sounds.backgroundMusic) {
            this.sounds.backgroundMusic.loop = true;
            this.sounds.backgroundMusic.volume = 0.2;
        }
    }

    play(soundName: string) {
        if (!this.soundsEnabled || !this.sounds[soundName]) return;
        const sound = this.sounds[soundName];
        sound.currentTime = 0;
        sound.play().catch(e => console.error('Sound play failed:', e));
    }

    stop(soundName: string) {
        if (this.sounds[soundName]) {
            this.sounds[soundName].pause();
            this.sounds[soundName].currentTime = 0;
        }
    }

    toggleSounds(): boolean {
        this.soundsEnabled = !this.soundsEnabled;
        if (!this.soundsEnabled) {
            Object.values(this.sounds).forEach(sound => {
                sound.pause();
                sound.currentTime = 0;
            });
        }
        return this.soundsEnabled;
    }
    getSoundsEnabled = () => this.soundsEnabled;
}

export default function PacmonGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const soundManagerRef = useRef<SoundManager | null>(null);
  const { isEthProviderAvailable } = useFrame();
  const { isConnected, address, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { sendTransaction } = useSendTransaction();
  const { switchChain } = useSwitchChain();
  const { connect } = useConnect();
  const publicClient = usePublicClient();
  const [scoreSaved, setScoreSaved] = useState(false);

  const getInitialGameState = (): GameState => ({
    pacmon: { x: 0, y: 0 },
    pacmonStart: { x: 0, y: 0 },
    pacmonDirection: { x: 0, y: 0 },
    ghosts: [],
    pellets: [],
    powerPellets: [],
    score: 0,
    lives: 3,
    level: 1,
    gameStatus: 'pregame',
    powerMode: false,
    powerModeTimer: 0,
    highScore: 0,
    userOnChainScore: null,
    onChainScores: [],
    showLeaderboard: false,
  });

  const [gameState, setGameState] = useState<GameState>(getInitialGameState());

  // --- CORE GAME LOGIC ---

  // Initialize Sound Manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager();
  }, []);

  // Setup level data
  const setupLevel = useCallback((level: number, currentScore: number, currentLives: number) => {
    const maze = MAZES[level - 1];
    if (!maze) {
        console.error("Level not found, ending game.");
        setGameState(prev => ({ ...prev, gameStatus: 'postGame' }));
        return;
    }

    const newPellets: Position[] = [];
    const newPowerPellets: Position[] = [];
    let newPacmonStart: Position = { x: 1, y: 1 };
    const ghostStartPositions: Position[] = [];

    maze.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell === 2) newPellets.push({ x, y });
            else if (cell === 3) newPowerPellets.push({ x, y });
            else if (cell === 4) newPacmonStart = { x, y };
            else if (cell === 5) ghostStartPositions.push({ x, y });
        });
    });

    const newGhosts: Ghost[] = [
        { id: 1, startPosition: ghostStartPositions[0] || { x: 9, y: 8 }, position: ghostStartPositions[0] || { x: 9, y: 8 }, direction: { x: 1, y: 0 }, color: COLORS.MONAD_BERRY, vulnerable: false, eaten: false },
        { id: 2, startPosition: ghostStartPositions[1] || { x: 10, y: 8 }, position: ghostStartPositions[1] || { x: 10, y: 8 }, direction: { x: -1, y: 0 }, color: COLORS.MONAD_PURPLE, vulnerable: false, eaten: false },
        { id: 3, startPosition: ghostStartPositions[2] || { x: 9, y: 9 }, position: ghostStartPositions[2] || { x: 9, y: 9 }, direction: { x: 0, y: 1 }, color: COLORS.MONAD_BLUE, vulnerable: false, eaten: false },
        { id: 4, startPosition: ghostStartPositions[3] || { x: 10, y: 9 }, position: ghostStartPositions[3] || { x: 10, y: 9 }, direction: { x: 0, y: -1 }, color: COLORS.MONAD_OFF_WHITE, vulnerable: false, eaten: false }
    ];

    setGameState(prev => ({
        ...prev,
        pacmon: newPacmonStart,
        pacmonStart: newPacmonStart,
        pacmonDirection: { x: 0, y: 0 },
        ghosts: newGhosts,
        pellets: newPellets,
        powerPellets: newPowerPellets,
        level: level,
        score: currentScore,
        lives: currentLives,
        powerMode: false,
        powerModeTimer: 0,
        gameStatus: 'playing',
    }));

    soundManagerRef.current?.play('backgroundMusic');
  }, []);

  // Game Loop
  useEffect(() => {
    const gameLoop = setInterval(() => {
        if (gameState.gameStatus !== 'playing') return;

        setGameState(prev => {
            const maze = MAZES[prev.level - 1];
            let newState = JSON.parse(JSON.stringify(prev)); // Deep copy

            // --- Pac-Man Movement ---
            let newPacmonPos = {
                x: newState.pacmon.x + newState.pacmonDirection.x,
                y: newState.pacmon.y + newState.pacmonDirection.y
            };

            // Wall collision
            if (maze[newPacmonPos.y]?.[newPacmonPos.x] !== 1) {
                newState.pacmon = newPacmonPos;
            }

            // Pellet collection
            const pelletIndex = newState.pellets.findIndex(p => p.x === newState.pacmon.x && p.y === newState.pacmon.y);
            if (pelletIndex !== -1) {
                newState.pellets.splice(pelletIndex, 1);
                newState.score += 10;
                soundManagerRef.current?.play('pelletEat');
            }

            // Power pellet collection
            const powerPelletIndex = newState.powerPellets.findIndex(p => p.x === newState.pacmon.x && p.y === newState.pacmon.y);
            if (powerPelletIndex !== -1) {
                newState.powerPellets.splice(powerPelletIndex, 1);
                newState.score += 50;
                newState.powerMode = true;
                newState.powerModeTimer = 35; // 7 seconds
                soundManagerRef.current?.play('powerPellet');
            }

            // --- Ghost Movement (Simplified AI) ---
            newState.ghosts = newState.ghosts.map(ghost => {
                if (ghost.eaten) {
                    // Pathfind back to start
                    if (ghost.position.x === ghost.startPosition.x && ghost.position.y === ghost.startPosition.y) {
                        ghost.eaten = false;
                        ghost.vulnerable = false;
                    }
                    // Simple path back to start
                    const target = ghost.startPosition;
                    const dx = target.x - ghost.position.x;
                    const dy = target.y - ghost.position.y;
                    let newDirection = {x: 0, y: 0};
                    if (Math.abs(dx) > Math.abs(dy)) newDirection.x = Math.sign(dx);
                    else newDirection.y = Math.sign(dy);

                    const nextPos = {x: ghost.position.x + newDirection.x, y: ghost.position.y + newDirection.y};
                    if(maze[nextPos.y]?.[nextPos.x] !== 1) ghost.position = nextPos;

                    return ghost;
                }

                // Basic random movement, avoids turning back
                const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
                const validDirections = directions.filter(dir => {
                    const nextPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y };
                    return maze[nextPos.y]?.[nextPos.x] !== 1 && !(dir.x === -ghost.direction.x && dir.y === -ghost.direction.y);
                });

                let nextDirection = ghost.direction;
                if (validDirections.length > 0 && Math.random() > 0.5) { // Chance to change direction at intersection
                    nextDirection = validDirections[Math.floor(Math.random() * validDirections.length)];
                }

                let nextPos = { x: ghost.position.x + nextDirection.x, y: ghost.position.y + nextDirection.y };
                if (maze[nextPos.y]?.[nextPos.x] !== 1) {
                    ghost.position = nextPos;
                    ghost.direction = nextDirection;
                } else { // If hits a wall, pick a new valid direction
                    if(validDirections.length > 0) {
                        const newDir = validDirections[Math.floor(Math.random() * validDirections.length)];
                        ghost.position = { x: ghost.position.x + newDir.x, y: ghost.position.y + newDir.y };
                        ghost.direction = newDir;
                    }
                }
                ghost.vulnerable = newState.powerMode;
                return ghost;
            });

            // --- Collision Detection ---
            newState.ghosts.forEach((ghost, index) => {
                if (ghost.position.x === newState.pacmon.x && ghost.position.y === newState.pacmon.y) {
                    if (ghost.vulnerable && !ghost.eaten) {
                        newState.score += 200;
                        newState.ghosts[index].eaten = true;
                        soundManagerRef.current?.play('ghostEat');
                    } else if (!ghost.eaten) {
                        newState.lives -= 1;
                        soundManagerRef.current?.play('death');
                        if (newState.lives <= 0) {
                            newState.gameStatus = 'postGame';
                            soundManagerRef.current?.stop('backgroundMusic');
                            soundManagerRef.current?.play('gameOver');
                        } else {
                            // Reset positions for this life
                            newState.pacmon = newState.pacmonStart;
                            newState.ghosts = newState.ghosts.map(g => ({...g, position: g.startPosition, eaten: false}));
                            newState.gameStatus = 'paused'; // Pause briefly
                            setTimeout(() => setGameState(gs => ({...gs, gameStatus: 'playing'})), 1500);
                        }
                    }
                }
            });

            // --- Timers and State Changes ---
            if (newState.powerMode) {
                newState.powerModeTimer -= 1;
                if (newState.powerModeTimer <= 0) {
                    newState.powerMode = false;
                    newState.ghosts.forEach(g => g.vulnerable = false);
                }
            }

            // Level Complete
            if (newState.pellets.length === 0 && newState.powerPellets.length === 0) {
                newState.gameStatus = 'levelComplete';
                soundManagerRef.current?.stop('backgroundMusic');
                soundManagerRef.current?.play('levelComplete');
            }

            return newState;
        });
    }, 200); // Game speed

    return () => clearInterval(gameLoop);
  }, [gameState.gameStatus, gameState.level]);

  // Handle Keyboard Input
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState.gameStatus !== 'playing') return;

    const { key } = event;
    let newDirection = { ...gameState.pacmonDirection };

    switch (key.toLowerCase()) {
      case 'arrowup': case 'w': newDirection = { x: 0, y: -1 }; break;
      case 'arrowdown': case 's': newDirection = { x: 0, y: 1 }; break;
      case 'arrowleft': case 'a': newDirection = { x: -1, y: 0 }; break;
      case 'arrowright': case 'd': newDirection = { x: 1, y: 0 }; break;
      default: return;
    }

    const nextPos = { x: gameState.pacmon.x + newDirection.x, y: gameState.pacmon.y + newDirection.y };
    const maze = MAZES[gameState.level - 1];
    if (maze[nextPos.y]?.[nextPos.x] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }));
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.level, gameState.pacmonDirection]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Render Game Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const maze = MAZES[gameState.level - 1] || MAZES[0];

    // Clear canvas
    ctx.fillStyle = COLORS.MONAD_BLACK;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Draw maze walls
    ctx.fillStyle = COLORS.MONAD_BLUE;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (maze[y][x] === 1) {
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // Draw pellets
    ctx.fillStyle = COLORS.MONAD_OFF_WHITE;
    gameState.pellets.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x * CELL_SIZE + CELL_SIZE / 2, p.y * CELL_SIZE + CELL_SIZE / 2, 2, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw power pellets
    ctx.fillStyle = COLORS.YELLOW;
    gameState.powerPellets.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x * CELL_SIZE + CELL_SIZE / 2, p.y * CELL_SIZE + CELL_SIZE / 2, 6, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw Pac-Man
    ctx.fillStyle = COLORS.YELLOW;
    ctx.beginPath();
    ctx.arc(gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2, gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0.2 * Math.PI, 1.8 * Math.PI);
    ctx.lineTo(gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2, gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2);
    ctx.fill();

    // Draw ghosts
    gameState.ghosts.forEach(ghost => {
      ctx.fillStyle = ghost.vulnerable ? COLORS.MONAD_BERRY : ghost.color;
      if (ghost.eaten) ctx.fillStyle = '#666'; // Gray when eaten
      ctx.beginPath();
      const radius = CELL_SIZE / 2 - 2;
      ctx.arc(ghost.position.x * CELL_SIZE + CELL_SIZE / 2, ghost.position.y * CELL_SIZE + CELL_SIZE / 2, radius, Math.PI, 2 * Math.PI);
      ctx.rect(ghost.position.x * CELL_SIZE + 2, ghost.position.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE - 4, CELL_SIZE / 2 - 2);
      ctx.fill();
    });
  }, [gameState]);


  // --- GAME ACTIONS ---

  const startGame = () => {
    if (!isConnected) {
        connect({ connector: farcasterFrame() });
        return;
    }
    if (chainId !== monadTestnet.id) {
        switchChain({ chainId: monadTestnet.id });
        return;
    }
    setScoreSaved(false);
    setupLevel(1, 0, 3);
  };

  const nextLevel = () => {
    const nextLevelNumber = gameState.level + 1;
    if (nextLevelNumber > MAZES.length) {
        setGameState(prev => ({ ...prev, gameStatus: 'postGame' }));
    } else {
        setupLevel(nextLevelNumber, gameState.score, gameState.lives);
    }
  };

  const restartGame = () => {
    setGameState(getInitialGameState());
    startGame();
  };

  const exitGame = () => {
    setGameState(prev => ({...getInitialGameState(), onChainScores: prev.onChainScores, userOnChainScore: prev.userOnChainScore, highScore: prev.highScore}));
    soundManagerRef.current?.stop('backgroundMusic');
  };

  const handleScoreSubmission = async () => {
    if (!isConnected || chainId !== monadTestnet.id || scoreSaved) return;

    try {
      const scoreData = toHex(gameState.score, { size: 32 });
      await sendTransaction({
        to: SCORE_CONTRACT_ADDRESS,
        value: parseEther("0.001"), // Reduced fee for testing
        data: scoreData
      });
      setScoreSaved(true);
      // Mock update scores locally
      const newScores = [
          { address: address!, score: gameState.score, timestamp: Date.now() },
          ...gameState.onChainScores.filter(s => s.address.toLowerCase() !== address!.toLowerCase())
      ].sort((a, b) => b.score - a.score);
      setGameState(prev => ({...prev, onChainScores: newScores, userOnChainScore: gameState.score}));
    } catch (error) {
      console.error("Score submission failed:", error);
    }
  };

  // --- UI RENDERING ---

  const renderGameUI = () => (
    <div className="flex flex-col h-screen w-full bg-black">
      <div className="text-center py-2 text-white">
        <h1 className="text-xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>PACMON</h1>
        <div className="flex justify-center space-x-4 text-sm">
          <span>Score: {gameState.score}</span>
          <span>Lives: {'❤️'.repeat(gameState.lives)}</span>
          <span>Level: {gameState.level}</span>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} />
        {gameState.gameStatus === 'paused' && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex justify-center items-center">
                <p className="text-white text-4xl font-bold animate-ping">Ready?</p>
            </div>
        )}
      </div>
    </div>
  );

  const renderLevelCompleteUI = () => (
    <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6 text-white">
        <h2 className="text-4xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>Level {gameState.level} Complete!</h2>
        <p className="text-2xl">Score: {gameState.score}</p>
        <button onClick={nextLevel} className="w-full max-w-xs py-4 text-xl font-bold rounded-lg" style={{ backgroundColor: COLORS.GREEN, color: COLORS.WHITE }}>
            {gameState.level >= MAZES.length ? 'Finish Game' : 'Next Level'}
        </button>
    </div>
  );

  const renderPostGameUI = () => (
    <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6 text-white p-4">
        <h2 className="text-4xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>Game Over!</h2>
        <p className="text-2xl">Final Score: {gameState.score}</p>
        <div className="w-full max-w-md space-y-4">
            <button onClick={handleScoreSubmission} disabled={scoreSaved} className="w-full py-4 text-lg font-bold rounded-lg disabled:opacity-50" style={{ backgroundColor: scoreSaved ? COLORS.GREEN : COLORS.MONAD_PURPLE, color: COLORS.WHITE }}>
                {scoreSaved ? 'Score Saved!' : 'Save Score Onchain'}
            </button>
            <button onClick={restartGame} className="w-full py-4 text-lg font-bold rounded-lg" style={{ backgroundColor: COLORS.GREEN, color: COLORS.WHITE }}>
                Play Again
            </button>
            <button onClick={exitGame} className="w-full py-4 text-lg font-bold rounded-lg" style={{ backgroundColor: COLORS.ORANGE, color: COLORS.WHITE }}>
                Exit to Menu
            </button>
        </div>
    </div>
  );

  const renderPregameUI = () => (
     <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6 p-4">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">
            PACMON
        </h1>
        <div className="w-full max-w-md space-y-4">
            <button onClick={startGame} className="w-full py-6 text-2xl font-bold rounded-lg" style={{ backgroundColor: COLORS.MONAD_BERRY, color: COLORS.WHITE }}>
                {!isConnected ? 'Connect Wallet' : chainId !== monadTestnet.id ? 'Switch to Monad Testnet' : 'Start Game'}
            </button>
            {isConnected && <p className="text-center text-xs text-white">Connected as {address?.slice(0,6)}...{address?.slice(-4)}</p>}
        </div>
        <div className="text-center text-sm text-white">
            <p>Use Arrow Keys or WASD to move.</p>
            <p className="mt-1">Eat all pellets. Avoid the ghosts!</p>
        </div>
     </div>
  );

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
        {gameState.gameStatus === 'pregame' && renderPregameUI()}
        {(gameState.gameStatus === 'playing' || gameState.gameStatus === 'paused') && renderGameUI()}
        {gameState.gameStatus === 'levelComplete' && renderLevelCompleteUI()}
        {gameState.gameStatus === 'postGame' && renderPostGameUI()}
    </div>
  );
}