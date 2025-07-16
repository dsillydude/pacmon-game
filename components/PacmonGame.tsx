'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useFrame } from '@/components/farcaster-provider'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'
import { parseEther, encodeFunctionData, keccak256, toHex } from 'viem'
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
  RED: '#FF0000'
}

// Game constants
const GRID_SIZE = 20
const CELL_SIZE = 20
const GAME_WIDTH = GRID_SIZE * CELL_SIZE
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE

type LevelConfig = {
  gameSpeed: number;
  ghostSpeed: number;
  pelletValue: number;
  powerPelletValue: number;
  powerDuration: number;
  bonusMultiplier: number;
  ghostCount: number;
};

// Improved level configuration with progressive difficulty
const LEVEL_CONFIG: { [key: number]: LevelConfig } = {
  1: { 
    gameSpeed: 300, 
    ghostSpeed: 1, 
    pelletValue: 10, 
    powerPelletValue: 50, 
    powerDuration: 40,
    bonusMultiplier: 1,
    ghostCount: 1 // Start with just 1 ghost
  },
  2: { 
    gameSpeed: 280, 
    ghostSpeed: 1, 
    pelletValue: 15, 
    powerPelletValue: 75, 
    powerDuration: 35,
    bonusMultiplier: 1.2,
    ghostCount: 2 // Add second ghost
  },
  3: { 
    gameSpeed: 260, 
    ghostSpeed: 1, 
    pelletValue: 20, 
    powerPelletValue: 100, 
    powerDuration: 30,
    bonusMultiplier: 1.5,
    ghostCount: 3 // Add third ghost
  },
  4: { 
    gameSpeed: 240, 
    ghostSpeed: 1, 
    pelletValue: 25, 
    powerPelletValue: 125, 
    powerDuration: 25,
    bonusMultiplier: 1.8,
    ghostCount: 4 // All 4 ghosts
  },
  5: { 
    gameSpeed: 220, 
    ghostSpeed: 1, 
    pelletValue: 30, 
    powerPelletValue: 150, 
    powerDuration: 20,
    bonusMultiplier: 2,
    ghostCount: 4
  },
  6: { 
    gameSpeed: 200, 
    ghostSpeed: 1, 
    pelletValue: 35, 
    powerPelletValue: 175, 
    powerDuration: 18,
    bonusMultiplier: 2.5,
    ghostCount: 4
  },
  7: { 
    gameSpeed: 180, 
    ghostSpeed: 1, 
    pelletValue: 40, 
    powerPelletValue: 200, 
    powerDuration: 15,
    bonusMultiplier: 3,
    ghostCount: 4
  }
}

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
  lastMoveTime: number
}

interface OnChainScore {
  address: string
  score: number
  timestamp: number
  isReal: boolean
}

interface LevelStats {
  level: number
  score: number
  pelletsCollected: number
  powerPelletsCollected: number
  ghostsEaten: number
  timeSpent: number
}

interface GameState {
  pacmon: Position
  pacmonDirection: Position
  ghosts: Ghost[]
  pellets: Position[]
  powerPellets: Position[]
  score: number
  lives: number
  gameStatus: 'pregame' | 'playing' | 'gameOver' | 'levelComplete' | 'postGame' | 'levelTransition'
  powerMode: boolean
  powerModeTimer: number
  highScore: number
  totalPlayers: number
  totalPlays: number
  userOnChainScore: number | null
  onChainScores: OnChainScore[]
  showLeaderboard: boolean
  currentLevel: number
  levelStats: LevelStats[]
  totalPelletsInLevel: number
  levelStartTime: number
  consecutiveLevels: number
  bonusScore: number
  showBonusMessage: boolean
  gameSpeed: number
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
      levelComplete: '/sounds/level-complete.mp3',
      extraLife: '/sounds/extra-life.mp3',
      backgroundMusic: '/sounds/playing-pac-man.mp3',
      arcadeSound: '/sounds/arcade-videogame-sound.mp3'
    }

    Object.entries(soundFiles).forEach(([key, path]) => {
      const audio = new Audio(path)
      audio.preload = 'auto'
      audio.volume = 0.5
      this.sounds[key] = audio
    })

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
      sound.play().catch(e => console.log('Sound play failed:', e))
    } catch (error) {
      console.log('Sound error:', error)
    }
  }

  playBackgroundMusic() {
    if (!this.soundsEnabled || !this.sounds.backgroundMusic) return
    
    try {
      this.sounds.backgroundMusic.play().catch(e => console.log('Background music play failed:', e))
    } catch (error) {
      console.log('Background music error:', error)
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

// Simplified maze layouts with easier progression
const MAZE_LAYOUTS = {
  1: [
    // Level 1: Very simple maze with lots of open space
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,1],
    [1,3,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,2,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,2,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  2: [
    // Level 2: Slightly more complex
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,2,2,2,2,2,2,2,2,1,1,1,2,2,1],
    [1,3,1,1,1,2,2,2,2,2,2,2,2,2,1,1,1,2,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,1,1,2,2,2,1,1,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,1,1,2,2,2,1,1,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,1,1,2,2,2,1,1,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,1,1,2,2,2,1,1,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,1,2,2,2,2,2,2,2,2,2,1,1,1,2,3,1],
    [1,2,1,1,1,2,2,2,2,2,2,2,2,2,1,1,1,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  3: [
    // Level 3: More complex with corridors
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,2,2,2,2,2,2,1,1,1,1,2,2,1],
    [1,3,1,1,1,1,2,2,2,2,2,2,2,1,1,1,1,2,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,1,1,1,2,2,2,2,2,1,1,1,2,2,2,2,1],
    [1,2,2,2,1,1,1,2,2,2,2,2,1,1,1,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,1,1,1,2,2,2,2,2,1,1,1,2,2,2,2,1],
    [1,2,2,2,1,1,1,2,2,2,2,2,1,1,1,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,1,1,2,2,2,2,2,2,2,1,1,1,1,2,3,1],
    [1,2,1,1,1,1,2,2,2,2,2,2,2,1,1,1,1,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ]
}

// Function to get maze for current level
const getMazeForLevel = (level: number) => {
  if (level <= 3) {
    return MAZE_LAYOUTS[level as keyof typeof MAZE_LAYOUTS]
  }
  // For levels 4+, cycle through available mazes with slight modifications
  const baseLayout = MAZE_LAYOUTS[((level - 1) % 3) + 1 as keyof typeof MAZE_LAYOUTS]
  return baseLayout
}

export default function PacmonGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
  const soundManagerRef = useRef<SoundManager | null>(null)
  const { isEthProviderAvailable } = useFrame()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: hash, sendTransaction } = useSendTransaction()
  const { switchChain } = useSwitchChain()
  const { connect } = useConnect()
  const publicClient = usePublicClient()
  const [scoreSaved, setScoreSaved] = useState(false)
  
  const [gameState, setGameState] = useState<GameState>({
    pacmon: { x: 9, y: 15 },
    pacmonDirection: { x: 0, y: 0 },
    ghosts: [],
    pellets: [],
    powerPellets: [],
    score: 0,
    lives: 3,
    gameStatus: 'pregame',
    powerMode: false,
    powerModeTimer: 0,
    highScore: 0,
    totalPlayers: 0,
    totalPlays: 0,
    userOnChainScore: null,
    onChainScores: [],
    showLeaderboard: false,
    currentLevel: 1,
    levelStats: [],
    totalPelletsInLevel: 0,
    levelStartTime: 0,
    consecutiveLevels: 0,
    bonusScore: 0,
    showBonusMessage: false,
    gameSpeed: 300
  })

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager()
  }, [])

  // Load real on-chain scores only
  const loadOnChainScores = useCallback(async () => {
    if (!publicClient || !address) return

    try {
      // Only load real scores from blockchain
      const realScores: OnChainScore[] = []
      
      // Query actual blockchain for scores
      // This is where you'd implement real blockchain queries
      // For now, we'll keep it empty until real scores are available
      
      setGameState(prev => ({
        ...prev,
        onChainScores: realScores.sort((a, b) => b.score - a.score),
        userOnChainScore: realScores.find(s => s.address.toLowerCase() === address.toLowerCase())?.score || null,
        highScore: realScores.length > 0 ? realScores[0].score : 0
      }))
    } catch (error) {
      console.error('Error loading on-chain scores:', error)
    }
  }, [publicClient, address])

  // Load on-chain scores when wallet connects
  useEffect(() => {
    if (isConnected && address && chainId === monadTestnet.id) {
      loadOnChainScores()
    }
  }, [isConnected, address, chainId, loadOnChainScores])

  // Initialize level with progressive ghost count
  const initializeLevel = useCallback((level: number) => {
    const maze = getMazeForLevel(level)
    const pellets: Position[] = []
    const powerPellets: Position[] = []
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (maze[y][x] === 2) {
          pellets.push({ x, y })
        } else if (maze[y][x] === 3) {
          powerPellets.push({ x, y })
        }
      }
    }

    const levelConfig = LEVEL_CONFIG[Math.min(level, 7)] || LEVEL_CONFIG[7]
    const ghostCount = levelConfig.ghostCount
    
    // Initialize ghosts based on level (progressive from 1 to 4)
    const ghosts: Ghost[] = []
    const ghostTypes = ['blinky', 'pinky', 'inky', 'clyde']
    const ghostColors = [COLORS.MONAD_BERRY, COLORS.MONAD_PURPLE, COLORS.MONAD_BLUE, COLORS.MONAD_OFF_WHITE]
    
    for (let i = 0; i < ghostCount; i++) {
      ghosts.push({
        id: i + 1,
        position: { x: 9 + (i % 2), y: 9 + Math.floor(i / 2) },
        direction: { x: i % 2 === 0 ? 1 : -1, y: 0 },
        color: ghostColors[i],
        vulnerable: false,
        type: ghostTypes[i] as 'blinky' | 'pinky' | 'inky' | 'clyde',
        scatterTarget: { x: 18 - (i % 2) * 17, y: i < 2 ? 0 : 18 },
        eaten: false,
        speed: levelConfig.ghostSpeed,
        lastMoveTime: 0
      })
    }
    
    setGameState(prev => ({
      ...prev,
      pellets,
      powerPellets,
      ghosts,
      currentLevel: level,
      totalPelletsInLevel: pellets.length + powerPellets.length,
      levelStartTime: Date.now(),
      gameSpeed: levelConfig.gameSpeed,
      pacmon: { x: 9, y: 15 },
      pacmonDirection: { x: 0, y: 0 },
      powerMode: false,
      powerModeTimer: 0
    }))
  }, [])

  // Initialize first level
  useEffect(() => {
    initializeLevel(1)
  }, [initializeLevel])

  // Enhanced game loop with variable speed
  useEffect(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
    }

    if (gameState.gameStatus === 'playing') {
      gameLoopRef.current = setInterval(() => {
        setGameState(prev => {
          let newState = { ...prev }
          const currentTime = Date.now()
          const levelConfig = LEVEL_CONFIG[Math.min(newState.currentLevel, 7)] || LEVEL_CONFIG[7]
          const maze = getMazeForLevel(newState.currentLevel)
          
          // Move Pacmon
          let newPacmonPos = {
            x: newState.pacmon.x + newState.pacmonDirection.x,
            y: newState.pacmon.y + newState.pacmonDirection.y
          }

          // Check for wall collision
          if (newPacmonPos.x >= 0 && newPacmonPos.x < GRID_SIZE &&
              newPacmonPos.y >= 0 && newPacmonPos.y < GRID_SIZE &&
              maze[newPacmonPos.y][newPacmonPos.x] !== 1) {
            newState.pacmon = newPacmonPos

            // Check pellet collection
            const pelletIndex = newState.pellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (pelletIndex !== -1) {
              newState.pellets = newState.pellets.filter((_, index) => index !== pelletIndex)
              const points = Math.floor(levelConfig.pelletValue * levelConfig.bonusMultiplier)
              newState.score += points
              soundManagerRef.current?.play('pelletEat')
            }

            // Check power pellet collection
            const powerPelletIndex = newState.powerPellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (powerPelletIndex !== -1) {
              newState.powerPellets = newState.powerPellets.filter((_, index) => index !== powerPelletIndex)
              const points = Math.floor(levelConfig.powerPelletValue * levelConfig.bonusMultiplier)
              newState.score += points
              newState.powerMode = true
              newState.powerModeTimer = levelConfig.powerDuration
              soundManagerRef.current?.play('powerPellet')
            }
          } else {
            // Stop Pacmon if hits a wall
            newState.pacmonDirection = { x: 0, y: 0 }
          }

          // Move ghosts with level-appropriate speed
          newState.ghosts = newState.ghosts.map(ghost => {
            if (currentTime - ghost.lastMoveTime < (250 / ghost.speed)) {
              return ghost
            }

            if (ghost.eaten) {
              if (ghost.position.x === 9 && ghost.position.y === 9) {
                return { ...ghost, eaten: false, vulnerable: false, lastMoveTime: currentTime }
              }
              const target = { x: 9, y: 9 }
              const dx = target.x - ghost.position.x
              const dy = target.y - ghost.position.y
              let newDirection = { x: 0, y: 0 }

              if (Math.abs(dx) > Math.abs(dy)) {
                newDirection.x = dx > 0 ? 1 : -1
              } else {
                newDirection.y = dy > 0 ? 1 : -1
              }
              return { 
                ...ghost, 
                direction: newDirection, 
                position: { x: ghost.position.x + newDirection.x, y: ghost.position.y + newDirection.y },
                lastMoveTime: currentTime
              }
            }

            let targetTile: Position
            if (newState.powerMode) {
              // Simplified frightened behavior
              const directions = [
                { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
              ]
              const validDirections = directions.filter(dir => {
                const testPos = {
                  x: ghost.position.x + dir.x,
                  y: ghost.position.y + dir.y
                }
                return testPos.x >= 0 && testPos.x < GRID_SIZE && 
                       testPos.y >= 0 && testPos.y < GRID_SIZE && 
                       maze[testPos.y][testPos.x] !== 1
              })
              
              const selectedDirection = validDirections[Math.floor(Math.random() * validDirections.length)]
              targetTile = { 
                x: ghost.position.x + selectedDirection.x, 
                y: ghost.position.y + selectedDirection.y 
              }
            } else {
              // Simplified AI based on ghost type
              switch (ghost.type) {
                case 'blinky':
                  targetTile = newState.pacmon
                  break
                case 'pinky':
                  targetTile = {
                    x: newState.pacmon.x + newState.pacmonDirection.x * 4,
                    y: newState.pacmon.y + newState.pacmonDirection.y * 4
                  }
                  break
                case 'inky':
                  targetTile = {
                    x: newState.pacmon.x + newState.pacmonDirection.x * 2,
                    y: newState.pacmon.y + newState.pacmonDirection.y * 2
                  }
                  break
                case 'clyde':
                  const distance = Math.sqrt(
                    Math.pow(ghost.position.x - newState.pacmon.x, 2) +
                    Math.pow(ghost.position.y - newState.pacmon.y, 2)
                  )
                  targetTile = distance < 8 ? ghost.scatterTarget : newState.pacmon
                  break
                default:
                  targetTile = newState.pacmon
              }
            }

            // Simple pathfinding
            const possibleDirections = [
              { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
            ]
            let bestDirection = ghost.direction
            let minDistance = Infinity

            possibleDirections.forEach(dir => {
              const nextPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
              if (nextPos.x >= 0 && nextPos.x < GRID_SIZE && 
                  nextPos.y >= 0 && nextPos.y < GRID_SIZE && 
                  maze[nextPos.y][nextPos.x] !== 1) {
                const distance = Math.sqrt(
                  Math.pow(nextPos.x - targetTile.x, 2) +
                  Math.pow(nextPos.y - targetTile.y, 2)
                )
                if (distance < minDistance) {
                  minDistance = distance
                  bestDirection = dir
                }
              }
            })

            return { 
              ...ghost, 
              direction: bestDirection, 
              position: { x: ghost.position.x + bestDirection.x, y: ghost.position.y + bestDirection.y }, 
              vulnerable: newState.powerMode,
              lastMoveTime: currentTime
            }
          })
          
          // Check ghost collisions
          newState.ghosts.forEach(ghost => {
            if (ghost.position.x === newState.pacmon.x && ghost.position.y === newState.pacmon.y) {
              if (ghost.vulnerable) {
                const basePoints = 200
                const bonusPoints = Math.floor(basePoints * levelConfig.bonusMultiplier)
                newState.score += bonusPoints
                ghost.eaten = true
                ghost.vulnerable = false
                soundManagerRef.current?.play('ghostEat')
              } else if (!ghost.eaten) {
                newState.lives -= 1
                newState.pacmon = { x: 9, y: 15 }
                newState.pacmonDirection = { x: 0, y: 0 }
                newState.ghosts = newState.ghosts.map(g => ({ 
                  ...g, 
                  position: { x: 9 + (g.id % 2), y: 9 + Math.floor(g.id / 2) }, 
                  direction: { x: g.id % 2 === 0 ? 1 : -1, y: 0 }, 
                  vulnerable: false, 
                  eaten: false 
                }))
                soundManagerRef.current?.play('death')
                if (newState.lives <= 0) {
                  newState.gameStatus = 'postGame'
                  soundManagerRef.current?.stopBackgroundMusic()
                  soundManagerRef.current?.play('gameOver')
                }
              }
            }
          })
          
          // Power mode timer
          if (newState.powerMode) {
            newState.powerModeTimer -= 1
            if (newState.powerModeTimer <= 0) {
              newState.powerMode = false
              newState.ghosts = newState.ghosts.map(ghost => ({ ...ghost, vulnerable: false }))
            }
          }
          
          // Check level complete
          if (newState.pellets.length === 0 && newState.powerPellets.length === 0) {
            newState.gameStatus = 'levelTransition'
            newState.consecutiveLevels += 1
            
            // Calculate level completion bonus
            const timeBonus = Math.max(0, 1000 - Math.floor((Date.now() - newState.levelStartTime) / 1000) * 10)
            const levelBonus = newState.currentLevel * 500
            const totalBonus = timeBonus + levelBonus
            
            newState.score += totalBonus
            newState.bonusScore = totalBonus
            newState.showBonusMessage = true
            
            // Add level stats
            newState.levelStats.push({
              level: newState.currentLevel,
              score: newState.score,
              pelletsCollected: newState.totalPelletsInLevel,
              powerPelletsCollected: 4,
              ghostsEaten: 0,
              timeSpent: Date.now() - newState.levelStartTime
            })
            
            // Check for extra life
            if (newState.currentLevel % 3 === 0 && newState.lives < 5) {
              newState.lives += 1
              soundManagerRef.current?.play('extraLife')
            }
            
            soundManagerRef.current?.play('levelComplete')
            
            // Auto-advance to next level
            setTimeout(() => {
              setGameState(prev => {
                const nextLevel = prev.currentLevel + 1
                const newState = { ...prev }
                newState.currentLevel = nextLevel
                newState.gameStatus = 'playing'
                newState.showBonusMessage = false
                return newState
              })
              
              setTimeout(() => {
                initializeLevel(newState.currentLevel + 1)
              }, 100)
            }, 3000)
          }
          
          return newState
        })
      }, gameState.gameSpeed)
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState.gameStatus, gameState.gameSpeed, initializeLevel])

  // Handle keyboard input
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState.gameStatus !== 'playing') return

    const { key } = event
    let newDirection = { x: 0, y: 0 }

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        newDirection.y = -1
        break
      case 'ArrowDown':
      case 's':
      case 'S':
        newDirection.y = 1
        break
      case 'ArrowLeft':
      case 'a':
      case 'A':
        newDirection.x = -1
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        newDirection.x = 1
        break
      default:
        return
    }

    const maze = getMazeForLevel(gameState.currentLevel)
    const nextX = gameState.pacmon.x + newDirection.x
    const nextY = gameState.pacmon.y + newDirection.y

    if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE && maze[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.currentLevel])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // Enhanced render game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maze = getMazeForLevel(gameState.currentLevel)

    // Clear canvas
    ctx.fillStyle = COLORS.MONAD_BLACK
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze
    ctx.fillStyle = COLORS.MONAD_BLUE
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (maze[y][x] === 1) {
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
        }
      }
    }

    // Draw pellets
    ctx.fillStyle = COLORS.MONAD_OFF_WHITE
    gameState.pellets.forEach(pellet => {
      ctx.beginPath()
      ctx.arc(
        pellet.x * CELL_SIZE + CELL_SIZE / 2,
        pellet.y * CELL_SIZE + CELL_SIZE / 2,
        2,
        0,
        2 * Math.PI
      )
      ctx.fill()
    })

    // Draw power pellets
    gameState.powerPellets.forEach(pellet => {
      const glowIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7
      ctx.shadowColor = COLORS.MONAD_PURPLE
      ctx.shadowBlur = 10 * glowIntensity
      ctx.fillStyle = COLORS.MONAD_PURPLE
      ctx.beginPath()
      ctx.arc(
        pellet.x * CELL_SIZE + CELL_SIZE / 2,
        pellet.y * CELL_SIZE + CELL_SIZE / 2,
        6,
        0,
        2 * Math.PI
      )
      ctx.fill()
      ctx.shadowBlur = 0
    })

    // Draw Pacmon
    const pacmanAngle = Math.sin(Date.now() * 0.02) * 0.5 + 0.5
    ctx.fillStyle = COLORS.MONAD_PURPLE
    ctx.beginPath()
    ctx.arc(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0.2 * Math.PI + pacmanAngle * 0.3,
      1.8 * Math.PI - pacmanAngle * 0.3
    )
    ctx.lineTo(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2
    )
    ctx.fill()

    // Draw ghosts
    gameState.ghosts.forEach(ghost => {
      if (ghost.vulnerable) {
        const flash = Math.sin(Date.now() * 0.02) > 0
        ctx.fillStyle = flash ? COLORS.MONAD_BERRY : COLORS.MONAD_BLUE
      } else if (ghost.eaten) {
        ctx.fillStyle = COLORS.MONAD_BLACK
      } else {
        ctx.fillStyle = ghost.color
      }
      
      ctx.beginPath()
      ctx.arc(
        ghost.position.x * CELL_SIZE + CELL_SIZE / 2,
        ghost.position.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        Math.PI,
        2 * Math.PI
      )
      ctx.rect(
        ghost.position.x * CELL_SIZE + 2,
        ghost.position.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE - 4,
        CELL_SIZE / 2 - 2
      )
      ctx.fill()
      
      // Ghost eyes
      if (!ghost.eaten) {
        ctx.fillStyle = COLORS.WHITE
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 5,
          ghost.position.y * CELL_SIZE + 5,
          3,
          3
        )
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 12,
          ghost.position.y * CELL_SIZE + 5,
          3,
          3
        )
        
        ctx.fillStyle = COLORS.MONAD_BLACK
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 5 + ghost.direction.x,
          ghost.position.y * CELL_SIZE + 5 + ghost.direction.y,
          1,
          1
        )
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 12 + ghost.direction.x,
          ghost.position.y * CELL_SIZE + 5 + ghost.direction.y,
          1,
          1
        )
      }
    })

    // Level transition overlay
    if (gameState.gameStatus === 'levelTransition') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      
      ctx.fillStyle = COLORS.MONAD_PURPLE
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        `Level ${gameState.currentLevel} Complete!`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 40
      )
      
      if (gameState.showBonusMessage) {
        ctx.fillStyle = COLORS.MONAD_BERRY
        ctx.font = '18px Arial'
        ctx.fillText(
          `Bonus: +${gameState.bonusScore}`,
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 - 10
        )
      }
      
      ctx.fillStyle = COLORS.MONAD_OFF_WHITE
      ctx.font = '16px Arial'
      ctx.fillText(
        `Next Level: ${gameState.currentLevel + 1}`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 20
      )
      
      ctx.fillText(
        `Ghosts: ${LEVEL_CONFIG[Math.min(gameState.currentLevel + 1, 7)]?.ghostCount || 4}`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 40
      )
    }
  }, [gameState])

  // Save score to blockchain
  const saveScoreToBlockchain = useCallback(async () => {
    if (!sendTransaction || !address || chainId !== monadTestnet.id) return

    try {
      const scoreData = {
        player: address,
        score: gameState.score,
        level: gameState.currentLevel,
        timestamp: Date.now()
      }

      const txHash = await sendTransaction({
        to: SCORE_CONTRACT_ADDRESS,
        value: parseEther('0.015'),
        data: encodeFunctionData({
          abi: [
            {
              name: 'saveScore',
              type: 'function',
              inputs: [
                { name: 'score', type: 'uint256' },
                { name: 'level', type: 'uint8' }
              ]
            }
          ],
          functionName: 'saveScore',
          args: [BigInt(gameState.score), gameState.currentLevel]
        })
      })

      setScoreSaved(true)
      
      // Add to local leaderboard
      const newScore: OnChainScore = {
        address: address,
        score: gameState.score,
        timestamp: Date.now(),
        isReal: true
      }
      
      setGameState(prev => ({
        ...prev,
        onChainScores: [...prev.onChainScores, newScore].sort((a, b) => b.score - a.score),
        userOnChainScore: gameState.score
      }))
      
    } catch (error) {
      console.error('Error saving score:', error)
    }
  }, [sendTransaction, address, chainId, gameState.score, gameState.currentLevel])

  // Start game
  const startGame = useCallback(() => {
    setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
    soundManagerRef.current?.playBackgroundMusic()
  }, [])

  // Restart game
  const restartGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      score: 0,
      lives: 3,
      gameStatus: 'playing',
      currentLevel: 1,
      levelStats: [],
      consecutiveLevels: 0,
      bonusScore: 0,
      showBonusMessage: false
    }))
    initializeLevel(1)
    soundManagerRef.current?.playBackgroundMusic()
  }, [initializeLevel])

  // Show leaderboard
  const showLeaderboard = useCallback(() => {
    setGameState(prev => ({ ...prev, showLeaderboard: true }))
  }, [])

  // Hide leaderboard
  const hideLeaderboard = useCallback(() => {
    setGameState(prev => ({ ...prev, showLeaderboard: false }))
  }, [])

  // Connect wallet
  const connectWallet = useCallback(() => {
    if (!isConnected) {
      connect({ connector: farcasterFrame() })
    }
  }, [isConnected, connect])

  // Switch to Monad Testnet
  const switchToMonadTestnet = useCallback(() => {
    if (switchChain) {
      switchChain({ chainId: monadTestnet.id })
    }
  }, [switchChain])

  // Touch controls for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = touch.clientX - rect.left
    const y = touch.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const dx = x - centerX
    const dy = y - centerY

    let newDirection = { x: 0, y: 0 }
    if (Math.abs(dx) > Math.abs(dy)) {
      newDirection.x = dx > 0 ? 1 : -1
    } else {
      newDirection.y = dy > 0 ? 1 : -1
    }

    if (gameState.gameStatus === 'playing') {
      const maze = getMazeForLevel(gameState.currentLevel)
      const nextX = gameState.pacmon.x + newDirection.x
      const nextY = gameState.pacmon.y + newDirection.y

      if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE && maze[nextY][nextX] !== 1) {
        setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
      }
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.currentLevel])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
      {/* Game UI */}
      {gameState.gameStatus === 'pregame' && !gameState.showLeaderboard && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">
              PACMON
            </h1>
            
            {/* Simplified UI - removed excessive text */}
            <div className="text-lg md:text-xl font-semibold" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Monad Pacman Adventure
            </div>
            
            {/* Current High Scores - Only show if there are real scores */}
            {gameState.onChainScores.length > 0 && (
              <>
                <div className="text-lg md:text-xl font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                  Current High Scores
                </div>
                <div className="space-y-2 bg-black bg-opacity-30 rounded-lg p-4">
                  {gameState.onChainScores.slice(0, 3).map((score, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold" style={{ color: COLORS.MONAD_BERRY }}>
                          #{index + 1}
                        </span>
                        <span className="text-sm font-mono" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                          {`${score.address.slice(0, 6)}...${score.address.slice(-4)}`}
                        </span>
                      </div>
                      <span className="font-mono text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                        {score.score.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* User's Score */}
          {gameState.userOnChainScore !== null && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ borderColor: COLORS.MONAD_PURPLE, backgroundColor: 'rgba(131, 110, 249, 0.1)' }}>
              <div className="text-center space-y-2">
                <div className="text-sm font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                  Your Best Score
                </div>
                <div className="text-xl font-mono font-bold" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  {gameState.userOnChainScore.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Wallet Connection */}
          {isConnected && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ borderColor: COLORS.MONAD_PURPLE, backgroundColor: 'rgba(131, 110, 249, 0.1)' }}>
              <div className="text-center space-y-2">
                <div className="text-sm font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                  Connected Wallet
                </div>
                <div className="text-sm font-mono" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  {`${address?.slice(0, 6)}...${address?.slice(-4)}`}
                </div>
                <div className="text-xs" style={{ color: COLORS.MONAD_BERRY }}>
                  {chainId === monadTestnet.id ? 'Monad Testnet' : 'Wrong Network'}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full max-w-md space-y-4 px-4">
            <button
              onClick={!isConnected ? connectWallet : chainId !== monadTestnet.id ? switchToMonadTestnet : startGame}
              className="w-full py-3 px-6 rounded-lg text-lg font-semibold transition-all duration-200 transform hover:scale-105"
              style={{ 
                backgroundColor: COLORS.MONAD_PURPLE, 
                color: COLORS.MONAD_OFF_WHITE,
                boxShadow: `0 4px 15px rgba(131, 110, 249, 0.3)`
              }}
            >
              {!isConnected ? 'Connect Wallet to Play' : 
               chainId !== monadTestnet.id ? 'Switch to Monad Testnet' : 
               'Start Adventure'}
            </button>
            
            <button
              onClick={showLeaderboard}
              className="w-full py-3 px-6 rounded-lg text-lg font-semibold transition-all duration-200 transform hover:scale-105"
              style={{ 
                backgroundColor: COLORS.MONAD_BERRY, 
                color: COLORS.MONAD_OFF_WHITE,
                boxShadow: `0 4px 15px rgba(160, 5, 93, 0.3)`
              }}
            >
              View Leaderboard
            </button>
            
            {isConnected && (
              <button
                onClick={disconnect}
                className="w-full py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{ 
                  backgroundColor: 'rgba(131, 110, 249, 0.1)', 
                  color: COLORS.MONAD_PURPLE,
                  border: `1px solid ${COLORS.MONAD_PURPLE}`
                }}
              >
                Disconnect Wallet
              </button>
            )}
          </div>

          {/* Game Info */}
          <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            <p>Progressive difficulty • Start with 1 ghost • Earn bonus lives</p>
            <p className="mt-2 text-xs" style={{ color: COLORS.MONAD_PURPLE }}>
              Save your score to blockchain for 0.015 MON
            </p>
          </div>
        </div>
      )}

      {/* Leaderboard - Only shows real players */}
      {gameState.showLeaderboard && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
              Leaderboard
            </h2>
            <p className="text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Top Players on Monad Testnet
            </p>
          </div>
          
          <div className="w-full max-w-md space-y-2 px-4">
            {gameState.onChainScores.length > 0 ? (
              gameState.onChainScores.map((score, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-black bg-opacity-30">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg font-bold" style={{ color: COLORS.MONAD_BERRY }}>
                      #{index + 1}
                    </span>
                    <span className="text-sm font-mono" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                      {`${score.address.slice(0, 4)}...${score.address.slice(-4)}`}
                    </span>
                  </div>
                  <span className="font-mono text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                    {score.score.toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center p-8" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                <p>No scores saved yet.</p>
                <p className="mt-2 text-sm">Be the first to save your score!</p>
              </div>
            )}
          </div>
          
          <button
            onClick={hideLeaderboard}
            className="py-3 px-6 rounded-lg text-lg font-semibold transition-all duration-200 transform hover:scale-105"
            style={{ 
              backgroundColor: COLORS.MONAD_PURPLE, 
              color: COLORS.MONAD_OFF_WHITE,
              boxShadow: `0 4px 15px rgba(131, 110, 249, 0.3)`
            }}
          >
            Back to Game
          </button>
        </div>
      )}

      {/* Game Canvas */}
      {(gameState.gameStatus === 'playing' || gameState.gameStatus === 'levelTransition') && (
        <div className="space-y-4">
          {/* Game Stats */}
          <div className="flex justify-between items-center w-full" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            <div className="text-sm">
              <span style={{ color: COLORS.MONAD_PURPLE }}>Score: </span>
              <span className="font-mono">{gameState.score.toLocaleString()}</span>
            </div>
            <div className="text-sm">
              <span style={{ color: COLORS.MONAD_PURPLE }}>Level: </span>
              <span className="font-mono">{gameState.currentLevel}</span>
            </div>
            <div className="text-sm">
              <span style={{ color: COLORS.MONAD_PURPLE }}>Lives: </span>
              <span className="font-mono">{gameState.lives}</span>
            </div>
            <div className="text-sm">
              <span style={{ color: COLORS.MONAD_PURPLE }}>Ghosts: </span>
              <span className="font-mono">{gameState.ghosts.length}</span>
            </div>
          </div>
          
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="border-2 rounded-lg"
            style={{ borderColor: COLORS.MONAD_PURPLE }}
            onTouchStart={handleTouchStart}
          />
          
          {/* Mobile Controls */}
          <div className="text-center text-sm md:hidden" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            Tap on the game area to change direction
          </div>
          
          {/* Desktop Controls */}
          <div className="text-center text-sm hidden md:block" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            Use arrow keys or WASD to move
          </div>
        </div>
      )}

      {/* Post Game Screen */}
      {gameState.gameStatus === 'postGame' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.MONAD_BERRY }}>
              Game Over!
            </h2>
            <div className="text-xl" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Final Score: <span className="font-mono font-bold">{gameState.score.toLocaleString()}</span>
            </div>
            <div className="text-lg" style={{ color: COLORS.MONAD_PURPLE }}>
              Levels Completed: {gameState.currentLevel - 1}
            </div>
          </div>

          {/* Save Score */}
          {isConnected && chainId === monadTestnet.id && !scoreSaved && (
            <button
              onClick={saveScoreToBlockchain}
              className="py-3 px-6 rounded-lg text-lg font-semibold transition-all duration-200 transform hover:scale-105"
              style={{ 
                backgroundColor: COLORS.MONAD_BERRY, 
                color: COLORS.MONAD_OFF_WHITE,
                boxShadow: `0 4px 15px rgba(160, 5, 93, 0.3)`
              }}
            >
              Save Score to Blockchain (0.015 MON)
            </button>
          )}
          
          {scoreSaved && (
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: 'rgba(131, 110, 249, 0.1)' }}>
              <p style={{ color: COLORS.MONAD_PURPLE }}>✓ Score saved to blockchain!</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={restartGame}
              className="py-3 px-6 rounded-lg text-lg font-semibold transition-all duration-200 transform hover:scale-105"
              style={{ 
                backgroundColor: COLORS.MONAD_PURPLE, 
                color: COLORS.MONAD_OFF_WHITE,
                boxShadow: `0 4px 15px rgba(131, 110, 249, 0.3)`
              }}
            >
              Play Again
            </button>
            
            <button
              onClick={() => setGameState(prev => ({ ...prev, gameStatus: 'pregame' }))}
              className="py-2 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ml-4"
              style={{ 
                backgroundColor: 'rgba(131, 110, 249, 0.1)', 
                color: COLORS.MONAD_PURPLE,
                border: `1px solid ${COLORS.MONAD_PURPLE}`
              }}
            >
              Main Menu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}