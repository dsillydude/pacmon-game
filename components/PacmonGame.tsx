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
} from 'wagmi'
import { generateMaze } from '@/lib/mazeGenerator'
import { getLevelSettings } from '@/lib/difficultySettings'

// Monad color palette
const COLORS = {
  MONAD_PURPLE: '#836EF9',
  MONAD_BLUE: '#200052',
  MONAD_BERRY: '#A0055D',
  MONAD_OFF_WHITE: '#FBFAF9',
  MONAD_BLACK: '#0E100F',
  WHITE: '#FFFFFF',
  GREEN: '#00FF00',
  ORANGE: '#FFA500'
}

// Game constants
const CELL_SIZE = 20
const SCORE_CONTRACT_ADDRESS = '0x1F0e9dcd371af37AD20E96A5a193d78052dCA984'

// Game entities
interface Position {
  x: number
  y: number
}

interface Ghost {
  id: number
  position: Position;
  startPosition: Position;
  direction: Position
  color: string
  vulnerable: boolean
  eaten: boolean
}

interface GameState {
  pacmon: Position
  pacmonStart: Position
  pacmonDirection: Position
  ghosts: Ghost[]
  pellets: Position[]
  powerPellets: Position[]
  score: number
  lives: number
  level: number
  gameStatus: 'pregame' | 'playing' | 'levelComplete' | 'postGame'
  powerMode: boolean
  powerModeTimer: number
  maze: number[][]
  mazeSize: number
  gameWidth: number
  gameHeight: number
  levelTransition: boolean
}

class SoundManager {
    private sounds: { [key: string]: HTMLAudioElement } = {};
    private soundsEnabled: boolean = true;
  
    constructor() {
      if (typeof window !== 'undefined') {
        this.loadSounds();
      }
    }
  
    private loadSounds() {
      const soundFiles = {
        pelletEat: '/sounds/pellet-eat.mp3',
        powerPellet: '/sounds/power-pellet.mp3',
        ghostEat: '/sounds/ghost-eat.mp3',
        death: '/sounds/death.mp3',
        gameOver: '/sounds/game-over.mp3',
        backgroundMusic: '/sounds/playing-pac-man.mp3',
      };
      Object.entries(soundFiles).forEach(([key, path]) => {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = 0.4;
        this.sounds[key] = audio;
      });
      if (this.sounds.backgroundMusic) {
        this.sounds.backgroundMusic.loop = true;
        this.sounds.backgroundMusic.volume = 0.2;
      }
    }
  
    play = (soundName: keyof SoundManager['sounds']) => {
      if (!this.soundsEnabled || !this.sounds[soundName]) return;
      this.sounds[soundName].currentTime = 0;
      this.sounds[soundName].play().catch(e => console.error(`Sound play failed for ${soundName}:`, e));
    }
  
    stop = (soundName: keyof SoundManager['sounds']) => {
        if (this.sounds[soundName]) {
            this.sounds[soundName].pause();
            this.sounds[soundName].currentTime = 0;
        }
    }

    playBackgroundMusic = () => this.play('backgroundMusic');
    stopBackgroundMusic = () => this.stop('backgroundMusic');
  
    toggleSounds = () => {
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const soundManagerRef = useRef<SoundManager | null>(null)
  const { isEthProviderAvailable } = useFrame()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { sendTransaction } = useSendTransaction()
  const { switchChain } = useSwitchChain()
  const { connect } = useConnect()
  const [scoreSaved, setScoreSaved] = useState(false);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  
  const initialGameState: GameState = {
    pacmon: { x: 1, y: 1 },
    pacmonStart: { x: 1, y: 1 },
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
    maze: [],
    mazeSize: 7,
    gameWidth: 140,
    gameHeight: 140,
    levelTransition: false
  };

  const [gameState, setGameState] = useState<GameState>(initialGameState);

  useEffect(() => {
    soundManagerRef.current = new SoundManager();
  }, []);

  const initializeLevel = useCallback((level: number, currentLives: number, currentScore: number) => {
    const levelSettings = getLevelSettings(level);
    const mazeData = generateMaze(level);
    
    const ghostColors = [COLORS.MONAD_BERRY, COLORS.MONAD_PURPLE, COLORS.MONAD_BLUE, COLORS.MONAD_OFF_WHITE];
    const ghosts: Ghost[] = Array.from({ length: levelSettings.ghostCount }, (_, i) => ({
        id: i + 1,
        position: mazeData.ghostStarts[i] || { x: 1, y: 1 },
        startPosition: mazeData.ghostStarts[i] || { x: 1, y: 1 },
        direction: { x: 1, y: 0 },
        color: ghostColors[i % ghostColors.length],
        vulnerable: false,
        eaten: false,
    }));

    const pellets: Position[] = [];
    const powerPellets: Position[] = [];
    for (let y = 0; y < mazeData.size; y++) {
      for (let x = 0; x < mazeData.size; x++) {
        if (mazeData.grid[y][x] === 2) pellets.push({ x, y });
        else if (mazeData.grid[y][x] === 3) powerPellets.push({ x, y });
      }
    }

    setGameState(prev => ({
      ...prev,
      level,
      maze: mazeData.grid,
      mazeSize: mazeData.size,
      gameWidth: mazeData.size * CELL_SIZE,
      gameHeight: mazeData.size * CELL_SIZE,
      pacmon: { ...mazeData.playerStart },
      pacmonStart: { ...mazeData.playerStart },
      ghosts,
      pellets,
      powerPellets,
      pacmonDirection: { x: 0, y: 0 },
      powerMode: false,
      powerModeTimer: 0,
      levelTransition: false,
      gameStatus: 'playing',
      lives: currentLives,
      score: currentScore,
    }));
  }, []);

  const resetPositions = useCallback(() => {
    setGameState(prev => ({
        ...prev,
        pacmon: { ...prev.pacmonStart },
        pacmonDirection: { x: 0, y: 0 },
        ghosts: prev.ghosts.map(ghost => ({ ...ghost, position: { ...ghost.startPosition } })),
    }));
  }, []);

  const handleWalletConnect = useCallback(() => {
    if (!isConnected && isEthProviderAvailable) {
        connect({ connector: farcasterFrame() });
    } else if (isConnected && chainId !== monadTestnet.id) {
        switchChain({ chainId: monadTestnet.id });
    }
  }, [isConnected, isEthProviderAvailable, chainId, connect, switchChain]);

  const startGame = useCallback(() => {
    if (isConnected && chainId === monadTestnet.id) {
        setScoreSaved(false);
        initializeLevel(1, 3, 0);
        soundManagerRef.current?.playBackgroundMusic();
    } else {
        handleWalletConnect();
    }
  }, [isConnected, chainId, handleWalletConnect, initializeLevel]);
  
  const restartGame = useCallback(() => {
    startGame();
  }, [startGame]);

  const exitGame = () => {
    setGameState(initialGameState);
    soundManagerRef.current?.stopBackgroundMusic();
  };
  
  const handleScoreSubmission = async () => {
    if (!isConnected || chainId !== monadTestnet.id) {
      handleWalletConnect();
      return;
    }
    try {
      await sendTransaction({
        to: SCORE_CONTRACT_ADDRESS,
        value: parseEther("0.015"),
        data: toHex(gameState.score, { size: 32 })
      });
      setScoreSaved(true);
    } catch (error) {
      console.error("Score submission failed:", error);
    }
  };

  const handleDirectionPress = useCallback((direction: Position) => {
    if (gameState.gameStatus !== 'playing') return;
    setGameState(prev => ({ ...prev, pacmonDirection: direction }));
  }, [gameState.gameStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let newDirection: Position | null = null;
      switch (e.key.toLowerCase()) {
        case 'arrowup': case 'w': newDirection = { x: 0, y: -1 }; break;
        case 'arrowdown': case 's': newDirection = { x: 0, y: 1 }; break;
        case 'arrowleft': case 'a': newDirection = { x: -1, y: 0 }; break;
        case 'arrowright': case 'd': newDirection = { x: 1, y: 0 }; break;
      }
      if (newDirection) {
        handleDirectionPress(newDirection);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDirectionPress]);

  useEffect(() => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);

    if (gameState.gameStatus === 'playing' && !gameState.levelTransition) {
      gameLoopRef.current = setInterval(() => {
        setGameState(prev => {
          const newState: GameState = JSON.parse(JSON.stringify(prev));

          const { pacmon, pacmonDirection, maze, mazeSize, ghosts, pellets, powerPellets } = newState;

          const nextPacmanPos = { x: pacmon.x + pacmonDirection.x, y: pacmon.y + pacmonDirection.y };
          if (nextPacmanPos.x >= 0 && nextPacmanPos.x < mazeSize && nextPacmanPos.y >= 0 && nextPacmanPos.y < mazeSize && maze[nextPacmanPos.y]?.[nextPacmanPos.x] !== 1) {
            newState.pacmon = nextPacmanPos;
          }

          const pelletIndex = pellets.findIndex(p => p.x === newState.pacmon.x && p.y === newState.pacmon.y);
          if (pelletIndex > -1) {
            newState.pellets.splice(pelletIndex, 1);
            newState.score += 10;
            soundManagerRef.current?.play('pelletEat');
          }

          const powerPelletIndex = powerPellets.findIndex(p => p.x === newState.pacmon.x && p.y === newState.pacmon.y);
          if (powerPelletIndex > -1) {
            newState.powerPellets.splice(powerPelletIndex, 1);
            newState.score += 50;
            newState.powerMode = true;
            newState.powerModeTimer = 30;
            soundManagerRef.current?.play('powerPellet');
          }
          
          ghosts.forEach((ghost: Ghost) => {
             const possibleDirections = [{x:0, y:1}, {x:0, y:-1}, {x:1, y:0}, {x:-1, y:0}];
             const validDirections = possibleDirections.filter(dir => {
                 const nextPos = {x: ghost.position.x + dir.x, y: ghost.position.y + dir.y};
                 return nextPos.x >=0 && nextPos.x < mazeSize && nextPos.y >= 0 && nextPos.y < mazeSize && maze[nextPos.y][nextPos.x] !== 1;
             });
             if (validDirections.length > 0) {
                 ghost.direction = validDirections[Math.floor(Math.random() * validDirections.length)];
             }
             ghost.position.x += ghost.direction.x;
             ghost.position.y += ghost.direction.y;
          });

          ghosts.forEach((ghost: Ghost) => {
            if (ghost.position.x === newState.pacmon.x && ghost.position.y === newState.pacmon.y) {
              if (newState.powerMode) {
                newState.score += 200;
                ghost.position = { ...ghost.startPosition };
                soundManagerRef.current?.play('ghostEat');
              } else {
                newState.lives -= 1;
                soundManagerRef.current?.play('death');
                if (newState.lives <= 0) {
                  newState.gameStatus = 'postGame';
                  soundManagerRef.current?.stopBackgroundMusic();
                  soundManagerRef.current?.play('gameOver');
                } else {
                    resetPositions();
                }
              }
            }
          });
          
          if (newState.powerMode) {
            newState.powerModeTimer -= 1;
            if (newState.powerModeTimer <= 0) {
              newState.powerMode = false;
            }
          }

          if (pellets.length === 0 && powerPellets.length === 0) {
            newState.gameStatus = 'levelComplete';
            newState.levelTransition = true;
            newState.score += 100 * newState.level;
            
            setTimeout(() => {
                const nextLevel = newState.level + 1;
                if (nextLevel > 7) {
                    setGameState(current => ({...current, gameStatus: 'postGame'}));
                    soundManagerRef.current?.stopBackgroundMusic();
                } else {
                    initializeLevel(nextLevel, newState.lives, newState.score);
                }
            }, 2000);
          }
          
          return newState;
        });
      }, 200);
    }
    
    return () => {
      if(gameLoopRef.current) clearInterval(gameLoopRef.current);
    }
  }, [gameState.gameStatus, gameState.levelTransition, initializeLevel, resetPositions]);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.MONAD_BLACK;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { maze, mazeSize, pellets, powerPellets, pacmon, ghosts, powerMode, level, levelTransition, gameWidth, gameHeight, score } = gameState;
    
    for (let y = 0; y < mazeSize; y++) {
      for (let x = 0; x < mazeSize; x++) {
        if (maze[y]?.[x] === 1) {
          ctx.fillStyle = COLORS.MONAD_BLUE;
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    ctx.fillStyle = COLORS.MONAD_OFF_WHITE;
    pellets.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x * CELL_SIZE + CELL_SIZE / 2, p.y * CELL_SIZE + CELL_SIZE / 2, 2, 0, 2 * Math.PI);
        ctx.fill();
    });

    ctx.fillStyle = COLORS.MONAD_PURPLE;
    powerPellets.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x * CELL_SIZE + CELL_SIZE / 2, p.y * CELL_SIZE + CELL_SIZE / 2, 6, 0, 2 * Math.PI);
        ctx.fill();
    });

    ctx.fillStyle = COLORS.MONAD_PURPLE;
    ctx.beginPath();
    ctx.arc(pacmon.x * CELL_SIZE + CELL_SIZE/2, pacmon.y * CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2 - 2, 0.2 * Math.PI, 1.8 * Math.PI);
    ctx.lineTo(pacmon.x * CELL_SIZE + CELL_SIZE/2, pacmon.y * CELL_SIZE + CELL_SIZE/2);
    ctx.fill();
    
    ghosts.forEach(ghost => {
        ctx.fillStyle = powerMode ? COLORS.MONAD_BERRY : ghost.color;
        ctx.fillRect(ghost.position.x * CELL_SIZE, ghost.position.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    });

    if (levelTransition) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, gameWidth, gameHeight);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`Level ${level} Complete!`, gameWidth/2, gameHeight/2 - 10);
        ctx.font = '20px monospace';
        ctx.fillText(`Score: ${score}`, gameWidth/2, gameHeight/2 + 20);
    }
  }, [gameState]);

  return (
    <div className="flex flex-col min-h-screen w-full items-center justify-center" style={{ backgroundColor: COLORS.MONAD_BLACK, color: 'white', fontFamily: 'monospace' }}>
        {gameState.gameStatus === 'pregame' && (
            <div className="flex flex-col items-center justify-center text-center p-4 space-y-8">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">PACMON</h1>
                <p className="text-lg">Eat pellets. Avoid ghosts. Progress through levels.</p>
                <div className="w-full max-w-xs space-y-4">
                    <button onClick={startGame} className="w-full py-4 text-xl font-bold rounded-lg transition-transform hover:scale-105" style={{ backgroundColor: COLORS.MONAD_BERRY }}>
                        {isConnected ? 'Start Game' : 'Connect Wallet'}
                    </button>
                    {isConnected && <button onClick={() => disconnect()} className="w-full py-2 text-sm rounded-lg" style={{ border: `1px solid ${COLORS.MONAD_OFF_WHITE}` }}>Disconnect</button>}
                </div>
            </div>
        )}
        {(gameState.gameStatus === 'playing' || gameState.gameStatus === 'levelComplete') && (
            <div className="flex flex-col items-center">
                <div className="flex justify-around w-full max-w-lg p-2 text-lg">
                    <span>Score: {gameState.score}</span>
                    <span>Level: {gameState.level}</span>
                    <span>Lives: {'❤️'.repeat(gameState.lives)}</span>
                </div>
                <canvas ref={canvasRef} width={gameState.gameWidth} height={gameState.gameHeight} style={{ backgroundColor: COLORS.MONAD_BLACK, border: `2px solid ${COLORS.MONAD_BLUE}` }} />
                <div className="pt-4 md:hidden">
                    <div className="grid grid-cols-3 gap-2 w-48">
                        <div />
                        <button onTouchStart={() => handleDirectionPress({x:0, y:-1})} className="p-4 rounded-lg" style={{backgroundColor: COLORS.MONAD_PURPLE}}>↑</button>
                        <div/>
                        <button onTouchStart={() => handleDirectionPress({x:-1, y:0})} className="p-4 rounded-lg" style={{backgroundColor: COLORS.MONAD_PURPLE}}>←</button>
                        <div/>
                        <button onTouchStart={() => handleDirectionPress({x:1, y:0})} className="p-4 rounded-lg" style={{backgroundColor: COLORS.MONAD_PURPLE}}>→</button>
                        <div/>
                        <button onTouchStart={() => handleDirectionPress({x:0, y:1})} className="p-4 rounded-lg" style={{backgroundColor: COLORS.MONAD_PURPLE}}>↓</button>
                        <div/>
                    </div>
                </div>
            </div>
        )}
        {gameState.gameStatus === 'postGame' && (
            <div className="flex flex-col items-center justify-center text-center p-4 space-y-6">
                <h2 className="text-4xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>Game Over</h2>
                <p className="text-2xl">Final Score: {gameState.score}</p>
                <div className="w-full max-w-xs space-y-4">
                    <button onClick={handleScoreSubmission} disabled={scoreSaved} className="w-full py-3 text-lg font-bold rounded-lg" style={{ backgroundColor: scoreSaved ? COLORS.GREEN : COLORS.MONAD_PURPLE, cursor: scoreSaved ? 'default' : 'pointer' }}>
                        {scoreSaved ? 'Score Saved!' : 'Save Score Onchain'}
                    </button>
                    <button onClick={restartGame} className="w-full py-3 text-lg font-bold rounded-lg" style={{ backgroundColor: COLORS.GREEN }}>
                        Play Again
                    </button>
                    <button onClick={exitGame} className="w-full py-3 text-lg font-bold rounded-lg" style={{ backgroundColor: COLORS.ORANGE }}>
                        Main Menu
                    </button>
                </div>
            </div>
        )}
    </div>
  )
}