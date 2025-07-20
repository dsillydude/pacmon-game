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

// Classic Pac-Man color palette (matching reference image)
const COLORS = {
  PACMAN_PURPLE: '#836EF9',  // Keep Pacman purple as requested
  WALL_BLUE: '#0000FF',      // Bright blue walls
  BACKGROUND_BLACK: '#000000', // Black background
  PELLET_WHITE: '#FFFFFF',   // White pellets
  GHOST_RED: '#FF0000',      // Red ghost (Blinky)
  GHOST_PINK: '#FFB6C1',     // Pink ghost (Pinky)
  GHOST_ORANGE: '#FFA500',   // Orange ghost (Clyde)
  GHOST_CYAN: '#00FFFF',     // Cyan ghost (Inky)
  VULNERABLE_BLUE: '#0000AA', // Vulnerable ghost color
  WHITE: '#FFFFFF',
  YELLOW: '#FFFF00'
}

// Game constants
const GRID_SIZE = 21
const CELL_SIZE = 18
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
  mazeComplexity: number;
};

// Progressive difficulty configuration
const LEVEL_CONFIG: { [key: number]: LevelConfig } = {
  1: { 
    gameSpeed: 300, 
    ghostSpeed: 1, 
    pelletValue: 10, 
    powerPelletValue: 50, 
    powerDuration: 40,
    bonusMultiplier: 1,
    ghostCount: 2,
    mazeComplexity: 1
  },
  2: { 
    gameSpeed: 250, 
    ghostSpeed: 1, 
    pelletValue: 15, 
    powerPelletValue: 75, 
    powerDuration: 35,
    bonusMultiplier: 1.2,
    ghostCount: 3,
    mazeComplexity: 2
  },
  3: { 
    gameSpeed: 200, 
    ghostSpeed: 1.2, 
    pelletValue: 20, 
    powerPelletValue: 100, 
    powerDuration: 30,
    bonusMultiplier: 1.5,
    ghostCount: 3,
    mazeComplexity: 3
  },
  4: { 
    gameSpeed: 170, 
    ghostSpeed: 1.5, 
    pelletValue: 25, 
    powerPelletValue: 125, 
    powerDuration: 25,
    bonusMultiplier: 1.8,
    ghostCount: 4,
    mazeComplexity: 4
  },
  5: { 
    gameSpeed: 140, 
    ghostSpeed: 2, 
    pelletValue: 30, 
    powerPelletValue: 150, 
    powerDuration: 20,
    bonusMultiplier: 2,
    ghostCount: 4,
    mazeComplexity: 5
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

// Classic Pac-Man maze layouts with progressive complexity
const MAZE_LAYOUTS = {
  1: [
    // Level 1: Simple maze with fewer pellets, 2 ghosts
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,2,2,2,2,2,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,2,1,0,0,0,1,2,1,2,1,1,1,1,1],
    [2,2,2,2,2,2,2,2,1,0,0,0,1,2,2,2,2,2,2,2,2],
    [1,1,1,1,1,2,1,2,1,0,0,0,1,2,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,2,2,2,2,2,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,2,1],
    [1,3,2,2,1,2,2,2,2,2,2,2,2,2,2,2,1,2,2,3,1],
    [1,1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1,1],
    [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,2,1,2,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  2: [
    // Level 2: More complex with additional pellets, 3 ghosts
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,2,2,1,2,2,1,1,1,2,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,2,1,2,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,2,2,1,2,2,1,1,1,2,1,1,1,1],
    [0,0,0,1,2,1,2,2,2,2,2,2,2,2,2,1,2,1,0,0,0],
    [1,1,1,1,2,1,2,1,1,0,0,0,1,1,2,1,2,1,1,1,1],
    [2,2,2,2,2,2,2,1,0,0,0,0,0,1,2,2,2,2,2,2,2],
    [1,1,1,1,2,1,2,1,1,0,0,0,1,1,2,1,2,1,1,1,1],
    [0,0,0,1,2,1,2,2,2,2,2,2,2,2,2,1,2,1,0,0,0],
    [1,1,1,1,2,1,1,1,2,2,1,2,2,1,1,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,2,2,1,2,2,1,1,1,2,1,1,2,1],
    [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,1,1,2,1,1,1,2,1,1,1,1,1,2,1,1,1,2,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  3: [
    // Level 3: Full complexity, 4 ghosts
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,2,2,2,2,2,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,2,1,1,0,1,1,2,1,2,1,1,1,1,1],
    [2,2,2,2,2,2,2,2,1,0,0,0,1,2,2,2,2,2,2,2,2],
    [1,1,1,1,1,2,1,2,1,0,0,0,1,2,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,1,1,1,1,1,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,2,2,2,2,2,2,2,1,2,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,2,1],
    [1,3,2,2,1,2,2,2,2,2,2,2,2,2,2,2,1,2,2,3,1],
    [1,1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1,1],
    [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,2,1,2,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ]
}

// Function to get maze for current level with progressive complexity
const getMazeForLevel = (level: number) => {
  if (level <= 2) return MAZE_LAYOUTS[level as keyof typeof MAZE_LAYOUTS]
  return MAZE_LAYOUTS[3] // Use most complex maze for levels 3+
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
    pacmon: { x: 10, y: 15 },
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
    onChainScores: [], // No mock data - only real scores
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

  // Load real on-chain scores only (no mock data)
  const loadOnChainScores = useCallback(async () => {
    if (!publicClient || !address) return

    try {
      // Only load real on-chain scores - no mock data
      const realScores: OnChainScore[] = []

      // Query actual blockchain for scores
      // This would be implemented with actual contract calls

      setGameState(prev => ({
        ...prev,
        onChainScores: realScores.sort((a, b) => b.score - a.score),
        userOnChainScore: null,
        highScore: realScores[0]?.score || 0
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

  // Initialize level with progressive difficulty
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

    const levelConfig = LEVEL_CONFIG[Math.min(level, 5)] || LEVEL_CONFIG[5]
    const ghostCount = levelConfig.ghostCount

    // Initialize ghosts with classic colors
    const ghosts: Ghost[] = []
    const ghostTypes = ['blinky', 'pinky', 'inky', 'clyde']
    const ghostColors = [COLORS.GHOST_RED, COLORS.GHOST_PINK, COLORS.GHOST_CYAN, COLORS.GHOST_ORANGE]

    for (let i = 0; i < ghostCount; i++) {
      ghosts.push({
        id: i + 1,
        position: { x: 10 + (i % 2), y: 9 + Math.floor(i / 2) },
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
      pacmon: { x: 10, y: 15 },
      pacmonDirection: { x: 0, y: 0 },
      powerMode: false,
      powerModeTimer: 0
    }))
  }, [])

  // Initialize first level
  useEffect(() => {
    initializeLevel(1)
  }, [initializeLevel])

  // Enhanced game loop with progressive difficulty
  useEffect(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
    }

    if (gameState.gameStatus === 'playing') {
      gameLoopRef.current = setInterval(() => {
        setGameState(prev => {
          let newState = { ...prev }
          const currentTime = Date.now()
          const levelConfig = LEVEL_CONFIG[Math.min(newState.currentLevel, 5)] || LEVEL_CONFIG[5]
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

          // Move ghosts with enhanced AI
          newState.ghosts = newState.ghosts.map(ghost => {
            if (currentTime - ghost.lastMoveTime < (200 / ghost.speed)) {
              return ghost
            }

            if (ghost.eaten) {
              // Return to ghost house
              if (ghost.position.x === 10 && ghost.position.y === 9) {
                return { ...ghost, eaten: false, vulnerable: false, lastMoveTime: currentTime }
              }
              const target = { x: 10, y: 9 }
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
              // Frightened mode - run away from Pacmon
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

              // Move away from Pacmon
              const selectedDirection = validDirections.reduce((best, dir) => {
                const testPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
                const testDistance = Math.sqrt(
                  Math.pow(testPos.x - newState.pacmon.x, 2) +
                  Math.pow(testPos.y - newState.pacmon.y, 2)
                )
                return testDistance > Math.sqrt(
                  Math.pow(ghost.position.x + best.x - newState.pacmon.x, 2) +
                  Math.pow(ghost.position.y + best.y - newState.pacmon.y, 2)
                ) ? dir : best
              }, validDirections[0])

              targetTile = { 
                x: ghost.position.x + selectedDirection.x, 
                y: ghost.position.y + selectedDirection.y 
              }
            } else {
              // Enhanced AI based on ghost type
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
                  const blinky = newState.ghosts.find(g => g.type === 'blinky')
                  if (blinky) {
                    const pacmanAhead = {
                      x: newState.pacmon.x + newState.pacmonDirection.x * 2,
                      y: newState.pacmon.y + newState.pacmonDirection.y * 2
                    }
                    const vector = {
                      x: pacmanAhead.x - blinky.position.x,
                      y: pacmanAhead.y - blinky.position.y
                    }
                    targetTile = { 
                      x: blinky.position.x + vector.x * 2, 
                      y: blinky.position.y + vector.y * 2 
                    }
                  } else {
                    targetTile = newState.pacmon
                  }
                  break
                case 'clyde':
                  const distance = Math.sqrt(
                    Math.pow(ghost.position.x - newState.pacmon.x, 2) +
                    Math.pow(ghost.position.y - newState.pacmon.y, 2)
                  )
                  if (distance < 8) {
                    targetTile = ghost.scatterTarget
                  } else {
                    targetTile = newState.pacmon
                  }
                  break
                default:
                  targetTile = newState.pacmon
              }
            }

            // Pathfinding
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
                // Eat ghost
                const basePoints = 200
                const bonusPoints = Math.floor(basePoints * levelConfig.bonusMultiplier * (newState.currentLevel * 0.5))
                newState.score += bonusPoints
                ghost.eaten = true
                ghost.vulnerable = false
                soundManagerRef.current?.play('ghostEat')
              } else if (!ghost.eaten) {
                // Lose life
                newState.lives -= 1
                newState.pacmon = { x: 10, y: 15 }
                newState.pacmonDirection = { x: 0, y: 0 }
                newState.ghosts = newState.ghosts.map(g => ({ 
                  ...g, 
                  position: { x: 10 + (g.id % 2), y: 9 + Math.floor(g.id / 2) }, 
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

            // Check for extra life every 2 levels
            if (newState.currentLevel % 2 === 0 && newState.lives < 5) {
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

  // Enhanced render game with classic Pac-Man colors
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maze = getMazeForLevel(gameState.currentLevel)

    // Clear canvas with black background
    ctx.fillStyle = COLORS.BACKGROUND_BLACK
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze walls in bright blue
    ctx.fillStyle = COLORS.WALL_BLUE
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (maze[y][x] === 1) {
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
        }
      }
    }

    // Draw white pellets
    ctx.fillStyle = COLORS.PELLET_WHITE
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

    // Draw power pellets with glow effect
    gameState.powerPellets.forEach(pellet => {
      const glowIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7
      ctx.shadowColor = COLORS.PELLET_WHITE
      ctx.shadowBlur = 8 * glowIntensity
      ctx.fillStyle = COLORS.PELLET_WHITE
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

    // Draw Pacmon in purple with mouth animation
    const pacmanAngle = Math.sin(Date.now() * 0.02) * 0.5 + 0.5
    ctx.fillStyle = COLORS.PACMAN_PURPLE
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

    // Draw ghosts with classic colors
    gameState.ghosts.forEach(ghost => {
      if (ghost.vulnerable) {
        // Blue when vulnerable
        ctx.fillStyle = COLORS.VULNERABLE_BLUE
      } else if (ghost.eaten) {
        ctx.fillStyle = COLORS.BACKGROUND_BLACK
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

        // Pupils
        ctx.fillStyle = COLORS.BACKGROUND_BLACK
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

    // Draw level transition overlay
    if (gameState.gameStatus === 'levelTransition') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

      ctx.fillStyle = COLORS.YELLOW
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        `Level ${gameState.currentLevel} Complete!`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 40
      )

      if (gameState.showBonusMessage) {
        ctx.fillStyle = COLORS.WHITE
        ctx.font = '16px Arial'
        ctx.fillText(
          `Bonus: ${gameState.bonusScore} points`,
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2
        )
      }
    }
  }, [gameState])

  // Start game function
  const startGame = () => {
    setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
    soundManagerRef.current?.playBackgroundMusic()
  }

  // Restart game function
  const restartGame = () => {
    setGameState(prev => ({
      ...prev,
      score: 0,
      lives: 3,
      currentLevel: 1,
      gameStatus: 'playing',
      levelStats: [],
      consecutiveLevels: 0,
      bonusScore: 0,
      showBonusMessage: false
    }))
    initializeLevel(1)
    soundManagerRef.current?.playBackgroundMusic()
  }

  // Save score to blockchain
  const saveScoreToBlockchain = async () => {
    if (!isConnected || !address || chainId !== monadTestnet.id) {
      alert('Please connect your wallet to Monad Testnet first')
      return
    }

    try {
      const scoreData = encodeFunctionData({
        abi: [
          {
            name: 'submitScore',
            type: 'function',
            inputs: [
              { name: 'score', type: 'uint256' },
              { name: 'level', type: 'uint256' },
              { name: 'timestamp', type: 'uint256' }
            ],
            outputs: []
          }
        ],
        functionName: 'submitScore',
        args: [BigInt(gameState.score), BigInt(gameState.currentLevel), BigInt(Date.now())]
      })

      await sendTransaction({
        to: SCORE_CONTRACT_ADDRESS as `0x${string}`,
        data: scoreData,
        value: parseEther('0')
      })

      setScoreSaved(true)
      alert('Score saved to blockchain!')
    } catch (error) {
      console.error('Error saving score:', error)
      alert('Failed to save score to blockchain')
    }
  }

  // Connect wallet function
  const connectWallet = () => {
    connect({ connector: farcasterFrame() })
  }

  // Switch to Monad Testnet
  const switchToMonad = () => {
    switchChain({ chainId: monadTestnet.id })
  }

  // Toggle leaderboard
  const toggleLeaderboard = () => {
    setGameState(prev => ({ ...prev, showLeaderboard: !prev.showLeaderboard }))
  }

  // Mobile controls
  const handleMobileControl = (direction: string) => {
    if (gameState.gameStatus !== 'playing') return

    let newDirection = { x: 0, y: 0 }
    switch (direction) {
      case 'up': newDirection.y = -1; break
      case 'down': newDirection.y = 1; break
      case 'left': newDirection.x = -1; break
      case 'right': newDirection.x = 1; break
    }

    const maze = getMazeForLevel(gameState.currentLevel)
    const nextX = gameState.pacmon.x + newDirection.x
    const nextY = gameState.pacmon.y + newDirection.y

    if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE && maze[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      <div className="w-full max-w-md mx-auto">
        {/* Clean Start Screen */}
        {gameState.gameStatus === 'pregame' && (
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-yellow-400 mb-8">PACMON</h1>

            {gameState.highScore > 0 && (
              <div className="text-lg">
                <p className="text-white">Current High Score: <span className="text-yellow-400">{gameState.highScore}</span></p>
              </div>
            )}

            <div className="space-y-4">
              {!isConnected ? (
                <button
                  onClick={connectWallet}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Connect Wallet to Play
                </button>
              ) : chainId !== monadTestnet.id ? (
                <button
                  onClick={switchToMonad}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Switch to Monad Testnet
                </button>
              ) : (
                <button
                  onClick={startGame}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Start Game
                </button>
              )}

              <button
                onClick={toggleLeaderboard}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                View Leaderboard
              </button>
            </div>
          </div>
        )}

        {/* Game Canvas */}
        {(gameState.gameStatus === 'playing' || gameState.gameStatus === 'levelTransition') && (
          <div className="space-y-4">
            {/* Game Stats */}
            <div className="flex justify-between text-sm">
              <span>Score: {gameState.score}</span>
              <span>Level: {gameState.currentLevel}</span>
              <span>Lives: {gameState.lives}</span>
            </div>

            <canvas
              ref={canvasRef}
              width={GAME_WIDTH}
              height={GAME_HEIGHT}
              className="border border-blue-500 mx-auto block"
            />

            {/* Mobile Controls */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              <div></div>
              <button
                onClick={() => handleMobileControl('up')}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
              >
                ↑
              </button>
              <div></div>
              <button
                onClick={() => handleMobileControl('left')}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
              >
                ←
              </button>
              <div></div>
              <button
                onClick={() => handleMobileControl('right')}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
              >
                →
              </button>
              <div></div>
              <button
                onClick={() => handleMobileControl('down')}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded"
              >
                ↓
              </button>
              <div></div>
            </div>
          </div>
        )}

        {/* Post Game Screen */}
        {gameState.gameStatus === 'postGame' && (
          <div className="text-center space-y-6">
            <h2 className="text-3xl font-bold text-red-500">Game Over</h2>
            <div className="space-y-2">
              <p className="text-xl">Final Score: <span className="text-yellow-400">{gameState.score}</span></p>
              <p>Levels Completed: {gameState.currentLevel - 1}</p>
            </div>

            <div className="space-y-4">
              {isConnected && chainId === monadTestnet.id && !scoreSaved && (
                <button
                  onClick={saveScoreToBlockchain}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Save Score to Blockchain
                </button>
              )}

              <button
                onClick={restartGame}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Play Again
              </button>

              <button
                onClick={() => setGameState(prev => ({ ...prev, gameStatus: 'pregame' }))}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Main Menu
              </button>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {gameState.showLeaderboard && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-2xl font-bold text-center mb-4">Leaderboard</h3>

              {gameState.onChainScores.length === 0 ? (
                <p className="text-center text-gray-400">No scores yet. Be the first to play!</p>
              ) : (
                <div className="space-y-2">
                  {gameState.onChainScores.slice(0, 10).map((score, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-700">
                      <span className="text-sm">
                        {index + 1}. {score.address.slice(0, 6)}...{score.address.slice(-4)}
                      </span>
                      <span className="font-bold text-yellow-400">{score.score}</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={toggleLeaderboard}
                className="w-full mt-4 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
