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

// Contract address for score storage
const SCORE_CONTRACT_ADDRESS = '0x1F0e9dcd371af37AD20E96A5a193d78052dCA984'

// Game entities
interface Position {
  x: number
  y: number
}

interface Ghost {
  id: number
  position: Position
  direction: Position
  color: string
  vulnerable: boolean
  type: 'blinky' | 'pinky' | 'inky' | 'clyde'
  scatterTarget: Position
  eaten: boolean
  speed: number
}

interface OnChainScore {
  address: string
  score: number
  timestamp: number
}

interface GameState {
  pacmon: Position
  pacmonDirection: Position
  ghosts: Ghost[]
  pellets: Position[]
  powerPellets: Position[]
  score: number
  lives: number
  level: number
  gameStatus: 'pregame' | 'playing' | 'gameOver' | 'levelComplete' | 'postGame'
  powerMode: boolean
  powerModeTimer: number
  highScore: number
  userOnChainScore: number | null
  onChainScores: OnChainScore[]
  showLeaderboard: boolean
  maze: number[][]
  mazeSize: number
  gameWidth: number
  gameHeight: number
  levelTransition: boolean
}

// Sound Manager Class
class SoundManager {
  private sounds: { [key: string]: HTMLAudioElement } = {}
  private soundsEnabled: boolean = true

  constructor() {
    this.loadSounds()
  }

  private loadSounds() {
    const soundFiles = {
      pelletEat: '/sounds/pellet-eat.mp3',
      powerPellet: '/sounds/power-pellet.mp3',
      ghostEat: '/sounds/ghost-eat.mp3',
      death: '/sounds/death.mp3',
      gameOver: '/sounds/game-over.mp3',
      backgroundMusic: '/sounds/playing-pac-man.mp3',
      arcadeSound: '/sounds/arcade-videogame-sound.mp3'
    }

    Object.entries(soundFiles).forEach(([key, path]) => {
      const audio = new Audio(path)
      audio.preload = 'auto'
      audio.volume = 0.5
      this.sounds[key] = audio
    })

    // Set background music to loop
    if (this.sounds.backgroundMusic) {
      this.sounds.backgroundMusic.loop = true
      this.sounds.backgroundMusic.volume = 0.3
    }
  }

  play(soundName: string) {
    if (!this.soundsEnabled || !this.sounds[soundName]) return
    
    try {
      const sound = this.sounds[soundName]
      sound.currentTime = 0
      sound.play().catch(e => console.error('Sound play failed:', e))
    } catch (error) {
      console.error('Sound error:', error)
    }
  }

  playBackgroundMusic() {
    if (!this.soundsEnabled || !this.sounds.backgroundMusic) return
    
    try {
      this.sounds.backgroundMusic.play().catch(e => console.error('Background music play failed:', e))
    } catch (error) {
      console.error('Background music error:', error)
    }
  }

  stopBackgroundMusic() {
    if (this.sounds.backgroundMusic) {
      this.sounds.backgroundMusic.pause()
      this.sounds.backgroundMusic.currentTime = 0
    }
  }

  toggleSounds() {
    this.soundsEnabled = !this.soundsEnabled
    if (!this.soundsEnabled) {
      this.stopBackgroundMusic()
    }
    return this.soundsEnabled
  }

  getSoundsEnabled() {
    return this.soundsEnabled
  }
}

export default function PacmonGameImproved() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const soundManagerRef = useRef<SoundManager | null>(null)
  const { isEthProviderAvailable } = useFrame()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { sendTransaction } = useSendTransaction()
  const { switchChain } = useSwitchChain()
  const { connect } = useConnect()
  const publicClient = usePublicClient()
  const [scoreSaved, setScoreSaved] = useState(false)
  
  const [gameState, setGameState] = useState<GameState>({
    pacmon: { x: 1, y: 1 },
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
    maze: [],
    mazeSize: 7,
    gameWidth: 140,
    gameHeight: 140,
    levelTransition: false
  })

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager()
  }, [])

  // Initialize level
  const initializeLevel = useCallback((level: number) => {
    const levelSettings = getLevelSettings(level)
    const mazeData = generateMaze(level)
    
    const gameWidth = mazeData.size * CELL_SIZE
    const gameHeight = mazeData.size * CELL_SIZE
    
    const ghostColors = [COLORS.MONAD_BERRY, COLORS.MONAD_PURPLE, COLORS.MONAD_BLUE, COLORS.MONAD_OFF_WHITE]
    const ghostTypes: ('blinky' | 'pinky' | 'inky' | 'clyde')[] = ['blinky', 'pinky', 'inky', 'clyde']
    
    const ghosts: Ghost[] = Array.from({ length: levelSettings.ghostCount }, (_, i) => {
        const ghostStart = mazeData.ghostStarts[i] || { x: Math.floor(mazeData.size / 2), y: Math.floor(mazeData.size / 2) };
        return {
            id: i + 1,
            position: ghostStart,
            direction: { x: 1, y: 0 },
            color: ghostColors[i % ghostColors.length],
            vulnerable: false,
            type: ghostTypes[i % ghostTypes.length],
            scatterTarget: { x: mazeData.size - 1, y: i % 2 === 0 ? 0 : mazeData.size - 1 },
            eaten: false,
            speed: levelSettings.ghostSpeed
        };
    });

    const pellets: Position[] = []
    const powerPellets: Position[] = []
    
    for (let y = 0; y < mazeData.size; y++) {
      for (let x = 0; x < mazeData.size; x++) {
        if (mazeData.grid[y][x] === 2) {
          pellets.push({ x, y })
        } else if (mazeData.grid[y][x] === 3) {
          powerPellets.push({ x, y })
        }
      }
    }

    setGameState(prev => ({
      ...prev,
      level,
      maze: mazeData.grid,
      mazeSize: mazeData.size,
      gameWidth,
      gameHeight,
      pacmon: mazeData.playerStart,
      ghosts,
      pellets,
      powerPellets,
      pacmonDirection: { x: 0, y: 0 },
      powerMode: false,
      powerModeTimer: 0,
      levelTransition: false
    }))
  }, [])

  // Load on-chain scores and user's score
  const loadOnChainScores = useCallback(async () => {
    if (!publicClient || !address) return;

    try {
        const mockOnChainScores: OnChainScore[] = [
            { address: '0x1234567890123456789012345678901234567890', score: 2450, timestamp: Date.now() - 86400000 },
            { address: '0x9876543210987654321098765432109876543210', score: 1890, timestamp: Date.now() - 172800000 },
        ];
        const userScore = mockOnChainScores.find(score => score.address.toLowerCase() === address.toLowerCase());

        setGameState(prev => ({
            ...prev,
            onChainScores: mockOnChainScores.sort((a, b) => b.score - a.score),
            userOnChainScore: userScore?.score || null,
            highScore: mockOnChainScores[0]?.score || 0
        }));
    } catch (error) {
        console.error('Error loading on-chain scores:', error);
    }
}, [publicClient, address]);


  // Load on-chain scores when wallet connects
  useEffect(() => {
    if (isConnected && address && chainId === monadTestnet.id) {
      loadOnChainScores()
    }
  }, [isConnected, address, chainId, loadOnChainScores])

  // Initialize first level
  useEffect(() => {
    initializeLevel(1)
  }, [initializeLevel])

  // Game loop
  useEffect(() => {
    const gameLoop = setInterval(() => {
      if (gameState.gameStatus === 'playing' && !gameState.levelTransition) {
        setGameState(prev => {
          let newState = { ...prev }
          
          let newPacmonPos = {
            x: newState.pacmon.x + newState.pacmonDirection.x,
            y: newState.pacmon.y + newState.pacmonDirection.y
          }

          if (newPacmonPos.x >= 0 && newPacmonPos.x < newState.mazeSize &&
              newPacmonPos.y >= 0 && newPacmonPos.y < newState.mazeSize &&
              newState.maze[newPacmonPos.y][newPacmonPos.x] !== 1) {
            newState.pacmon = newPacmonPos

            const pelletIndex = newState.pellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (pelletIndex !== -1) {
              newState.pellets.splice(pelletIndex, 1);
              newState.score += 10
              soundManagerRef.current?.play('pelletEat')
            }

            const powerPelletIndex = newState.powerPellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (powerPelletIndex !== -1) {
              newState.powerPellets.splice(powerPelletIndex, 1);
              newState.score += 50
              newState.powerMode = true
              newState.powerModeTimer = 30 
              soundManagerRef.current?.play('powerPellet')
            }
          } else {
            newState.pacmonDirection = { x: 0, y: 0 }
          }

          newState.ghosts = newState.ghosts.map(ghost => {
              // Ghost movement and collision logic here...
              return ghost;
          });
          
          if (newState.pellets.length === 0 && newState.powerPellets.length === 0) {
            newState.levelTransition = true
            newState.score += 100 * newState.level 
            
            setTimeout(() => {
              const nextLevel = newState.level + 1
              if (nextLevel > 7) {
                  newState.gameStatus = 'postGame';
              } else {
                initializeLevel(nextLevel)
              }
              setGameState(prev => ({...prev, ...newState}))
            }, 2000)
          }
          
          return newState
        })
      }
    }, 200)

    return () => clearInterval(gameLoop)
  }, [gameState.gameStatus, gameState.levelTransition, initializeLevel])

  // ... (handleKeyPress, render game, wallet handlers, etc. as in your original improved file)
  // Make sure to replace hardcoded GRID_SIZE with gameState.mazeSize in calculations

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
        {/* All UI states: pregame, playing, postGame, leaderboard */}
        {gameState.gameStatus === 'pregame' && (
            <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
                <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">
                PACMON
                </h1>
                <button
                onClick={startGame}
                className="w-full max-w-md py-6 px-8 text-xl md:text-2xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
                style={{ 
                    backgroundColor: COLORS.MONAD_BERRY, 
                    color: COLORS.WHITE 
                }}
                >
                {!isConnected ? 'Connect Wallet to Play' : 'Start Game'}
                </button>
            </div>
        )}
        {gameState.gameStatus === 'playing' && (
            <div className="flex flex-col h-screen w-full">
                <div className="text-center py-2" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
                <h1 className="text-xl md:text-2xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
                    PACMON
                </h1>
                <div className="flex justify-center space-x-4 text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                    <div>Score: {gameState.score}</div>
                    <div>Lives: {gameState.lives}</div>
                    <div>Level: {gameState.level}</div>
                </div>
                </div>
                <div className="flex-1 flex items-center justify-center pt-4">
                <canvas
                    ref={canvasRef}
                    width={gameState.gameWidth}
                    height={gameState.gameHeight}
                    className="max-w-full max-h-full"
                    style={{ backgroundColor: COLORS.MONAD_BLACK }}
                />
                </div>
            </div>
        )}
      {/* ... other UI states */}
    </div>
  )
}