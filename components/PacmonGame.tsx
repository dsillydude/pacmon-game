
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

// Classic Pac-Man color palette matching reference image
const COLORS = {
  YELLOW: '#FFFF00',        // Pac-Man
  RED: '#FF0000',           // Blinky ghost
  PINK: '#FFB8FF',          // Pinky ghost  
  CYAN: '#00FFFF',          // Inky ghost
  ORANGE: '#FFB852',        // Clyde ghost
  BLUE: '#0000FF',          // Maze walls
  WHITE: '#FFFFFF',         // Pellets and text
  BLACK: '#000000',         // Background
  VULNERABLE_BLUE: '#2121DE', // Vulnerable ghost color
  VULNERABLE_WHITE: '#FFFFFF' // Vulnerable ghost flash
}

// Game constants
const GRID_SIZE = 19  // Start with smaller maze for easier levels
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
  mazeComplexity: 'simple' | 'medium' | 'complex';
};

// Progressive difficulty configuration
const LEVEL_CONFIG: { [key: number]: LevelConfig } = {
  1: { 
    gameSpeed: 300, 
    ghostSpeed: 0.8, 
    pelletValue: 10, 
    powerPelletValue: 50, 
    powerDuration: 40,
    bonusMultiplier: 1,
    ghostCount: 2,
    mazeComplexity: 'simple'
  },
  2: { 
    gameSpeed: 250, 
    ghostSpeed: 1, 
    pelletValue: 15, 
    powerPelletValue: 75, 
    powerDuration: 35,
    bonusMultiplier: 1.2,
    ghostCount: 3,
    mazeComplexity: 'medium'
  },
  3: { 
    gameSpeed: 200, 
    ghostSpeed: 1.2, 
    pelletValue: 20, 
    powerPelletValue: 100, 
    powerDuration: 30,
    bonusMultiplier: 1.5,
    ghostCount: 4,
    mazeComplexity: 'complex'
  },
  4: { 
    gameSpeed: 180, 
    ghostSpeed: 1.4, 
    pelletValue: 25, 
    powerPelletValue: 125, 
    powerDuration: 25,
    bonusMultiplier: 1.8,
    ghostCount: 4,
    mazeComplexity: 'complex'
  },
  5: { 
    gameSpeed: 160, 
    ghostSpeed: 1.6, 
    pelletValue: 30, 
    powerPelletValue: 150, 
    powerDuration: 20,
    bonusMultiplier: 2,
    ghostCount: 4,
    mazeComplexity: 'complex'
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
  gameStatus: 'pregame' | 'playing' | 'gameOver' | 'levelComplete' | 'postGame' | 'levelTransition' | 'ready'
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
  readyTimer: number
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

// Progressive maze layouts matching reference image design
const MAZE_LAYOUTS = {
  simple: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,2,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,1,2,1,0,1,2,1,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,2,1,0,1,2,1,1,1,1,1,1,1],
    [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
    [1,1,1,1,1,1,1,2,1,0,1,2,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,1,2,1,0,1,2,1,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,2,1,1,1,2,1,1,1,2,1,1,1,2,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  medium: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,1,2,1,1,2,1,2,1,1,2,1,1,1,3,1],
    [1,2,2,2,2,2,1,2,2,2,2,2,1,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,2,1,1,1,2,1,1,2,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,1,1,2,1,1,1,1,2,1,2,1,1,1,1,2,1,1,1],
    [0,0,1,2,1,2,2,2,2,2,2,2,2,2,1,2,1,0,0],
    [1,1,1,2,1,2,1,0,0,0,0,0,1,2,1,2,1,1,1],
    [2,2,2,2,2,2,1,0,0,0,0,0,1,2,2,2,2,2,2],
    [1,1,1,2,1,2,1,0,0,0,0,0,1,2,1,2,1,1,1],
    [0,0,1,2,1,2,2,2,2,2,2,2,2,2,1,2,1,0,0],
    [1,1,1,2,1,1,1,1,2,1,2,1,1,1,1,2,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,2,1,1,1,2,1,1,2,1,1,2,1],
    [1,2,2,2,2,2,1,2,2,2,2,2,1,2,2,2,2,2,1],
    [1,3,1,1,1,2,1,1,2,1,2,1,1,2,1,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  complex: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,2,1,1,1,2,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,1,2,2,1,2,2,1,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,2,1,2,1,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,2,2,2,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,2,1,0,1,2,1,2,1,1,1,1,1],
    [2,2,2,2,2,2,2,2,1,0,1,2,2,2,2,2,2,2,2],
    [1,1,1,1,1,2,1,2,1,0,1,2,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,2,2,2,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,1,2,1,2,1,1,2,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,2,1,1,1,2,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,1,2,2,2,2,2,1,2,2,2,2,2,1],
    [1,3,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ]
}

// Function to get maze for current level
const getMazeForLevel = (level: number) => {
  const levelConfig = LEVEL_CONFIG[Math.min(level, 5)] || LEVEL_CONFIG[5]
  return MAZE_LAYOUTS[levelConfig.mazeComplexity]
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
    onChainScores: [], // No mock data - starts empty
    showLeaderboard: false,
    currentLevel: 1,
    levelStats: [],
    totalPelletsInLevel: 0,
    levelStartTime: 0,
    consecutiveLevels: 0,
    bonusScore: 0,
    showBonusMessage: false,
    gameSpeed: 300,
    readyTimer: 0
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

      setGameState(prev => ({
        ...prev,
        onChainScores: realScores,
        userOnChainScore: null,
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
    const ghostColors = [COLORS.RED, COLORS.PINK, COLORS.CYAN, COLORS.ORANGE]

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
      powerModeTimer: 0,
      gameStatus: 'ready',
      readyTimer: 3
    }))
  }, [])

  // Initialize first level
  useEffect(() => {
    initializeLevel(1)
  }, [initializeLevel])

  // Ready countdown timer
  useEffect(() => {
    if (gameState.gameStatus === 'ready' && gameState.readyTimer > 0) {
      const timer = setTimeout(() => {
        setGameState(prev => ({
          ...prev,
          readyTimer: prev.readyTimer - 1
        }))
      }, 1000)

      if (gameState.readyTimer === 1) {
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            gameStatus: 'playing'
          }))
          soundManagerRef.current?.playBackgroundMusic()
        }, 1000)
      }

      return () => clearTimeout(timer)
    }
  }, [gameState.gameStatus, gameState.readyTimer])

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

          // Enhanced ghost AI with progressive difficulty
          newState.ghosts = newState.ghosts.map(ghost => {
            if (currentTime - ghost.lastMoveTime < (200 / ghost.speed)) {
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
              // Frightened mode - try to avoid Pacmon
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

              const pacmonDistance = Math.sqrt(
                Math.pow(ghost.position.x - newState.pacmon.x, 2) +
                Math.pow(ghost.position.y - newState.pacmon.y, 2)
              )

              let selectedDirection
              if (pacmonDistance < 5 && Math.random() < 0.8) {
                selectedDirection = validDirections.reduce((best, dir) => {
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
              } else {
                selectedDirection = validDirections[Math.floor(Math.random() * validDirections.length)]
              }

              targetTile = { 
                x: ghost.position.x + selectedDirection.x, 
                y: ghost.position.y + selectedDirection.y 
              }
            } else {
              // Progressive AI difficulty
              const aggressionLevel = Math.min(newState.currentLevel * 0.5, 3)

              switch (ghost.type) {
                case 'blinky':
                  targetTile = newState.pacmon
                  break
                case 'pinky':
                  const lookAhead = Math.min(2 + aggressionLevel, 6)
                  targetTile = {
                    x: newState.pacmon.x + newState.pacmonDirection.x * lookAhead,
                    y: newState.pacmon.y + newState.pacmonDirection.y * lookAhead
                  }
                  break
                case 'inky':
                  const blinky = newState.ghosts.find(g => g.type === 'blinky')
                  if (blinky) {
                    const pacmanAhead = {
                      x: newState.pacmon.x + newState.pacmonDirection.x * (1 + aggressionLevel),
                      y: newState.pacmon.y + newState.pacmonDirection.y * (1 + aggressionLevel)
                    }
                    const vector = {
                      x: pacmanAhead.x - blinky.position.x,
                      y: pacmanAhead.y - blinky.position.y
                    }
                    targetTile = { 
                      x: blinky.position.x + vector.x * (1 + aggressionLevel), 
                      y: blinky.position.y + vector.y * (1 + aggressionLevel) 
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
                  const threshold = Math.max(8 - aggressionLevel, 4)
                  if (distance < threshold) {
                    targetTile = ghost.scatterTarget
                  } else {
                    targetTile = newState.pacmon
                  }
                  break
                default:
                  targetTile = newState.pacmon
              }
            }

            // Enhanced pathfinding
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
                const bonusPoints = Math.floor(basePoints * levelConfig.bonusMultiplier * (newState.currentLevel * 0.5))
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

            const timeBonus = Math.max(0, 1000 - Math.floor((Date.now() - newState.levelStartTime) / 1000) * 10)
            const levelBonus = newState.currentLevel * 500
            const totalBonus = timeBonus + levelBonus

            newState.score += totalBonus
            newState.bonusScore = totalBonus
            newState.showBonusMessage = true

            newState.levelStats.push({
              level: newState.currentLevel,
              score: newState.score,
              pelletsCollected: newState.totalPelletsInLevel,
              powerPelletsCollected: 4,
              ghostsEaten: 0,
              timeSpent: Date.now() - newState.levelStartTime
            })

            if (newState.currentLevel % 2 === 0 && newState.lives < 5) {
              newState.lives += 1
              soundManagerRef.current?.play('extraLife')
            }

            soundManagerRef.current?.play('levelComplete')

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

  // Enhanced render game with exact visual match
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maze = getMazeForLevel(gameState.currentLevel)

    // Clear canvas with black background
    ctx.fillStyle = COLORS.BLACK
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze walls in blue
    ctx.fillStyle = COLORS.BLUE
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (maze[y][x] === 1) {
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
        }
      }
    }

    // Draw pellets in white
    ctx.fillStyle = COLORS.WHITE
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

    // Draw power pellets in white (larger)
    gameState.powerPellets.forEach(pellet => {
      const glowIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7
      ctx.fillStyle = COLORS.WHITE
      ctx.beginPath()
      ctx.arc(
        pellet.x * CELL_SIZE + CELL_SIZE / 2,
        pellet.y * CELL_SIZE + CELL_SIZE / 2,
        6,
        0,
        2 * Math.PI
      )
      ctx.fill()
    })

    // Draw Pac-Man in yellow with animated mouth
    const pacmanAngle = Math.sin(Date.now() * 0.02) * 0.5 + 0.5
    ctx.fillStyle = COLORS.YELLOW
    ctx.beginPath()

    // Determine mouth direction based on movement
    let startAngle = 0.2 * Math.PI + pacmanAngle * 0.3
    let endAngle = 1.8 * Math.PI - pacmanAngle * 0.3

    if (gameState.pacmonDirection.x === 1) { // Right
      startAngle = 0.2 * Math.PI + pacmanAngle * 0.3
      endAngle = 1.8 * Math.PI - pacmanAngle * 0.3
    } else if (gameState.pacmonDirection.x === -1) { // Left
      startAngle = 1.2 * Math.PI + pacmanAngle * 0.3
      endAngle = 0.8 * Math.PI - pacmanAngle * 0.3
    } else if (gameState.pacmonDirection.y === -1) { // Up
      startAngle = 1.7 * Math.PI + pacmanAngle * 0.3
      endAngle = 1.3 * Math.PI - pacmanAngle * 0.3
    } else if (gameState.pacmonDirection.y === 1) { // Down
      startAngle = 0.7 * Math.PI + pacmanAngle * 0.3
      endAngle = 0.3 * Math.PI - pacmanAngle * 0.3
    }

    ctx.arc(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      startAngle,
      endAngle
    )
    ctx.lineTo(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2
    )
    ctx.fill()

    // Draw ghosts with exact colors and design
    gameState.ghosts.forEach(ghost => {
      if (ghost.vulnerable) {
        const flash = Math.sin(Date.now() * 0.02) > 0
        ctx.fillStyle = flash ? COLORS.VULNERABLE_BLUE : COLORS.VULNERABLE_WHITE
      } else if (ghost.eaten) {
        ctx.fillStyle = COLORS.BLACK
      } else {
        ctx.fillStyle = ghost.color
      }

      // Ghost body (rounded top, flat bottom with wavy edge)
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
        // Left eye
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 5,
          ghost.position.y * CELL_SIZE + 5,
          4,
          4
        )
        // Right eye
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 11,
          ghost.position.y * CELL_SIZE + 5,
          4,
          4
        )

        // Eye pupils
        ctx.fillStyle = COLORS.BLACK
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 6 + ghost.direction.x,
          ghost.position.y * CELL_SIZE + 6 + ghost.direction.y,
          2,
          2
        )
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 12 + ghost.direction.x,
          ghost.position.y * CELL_SIZE + 6 + ghost.direction.y,
          2,
          2
        )
      }
    })

    // Draw "Ready!" text when game is starting
    if (gameState.gameStatus === 'ready') {
      ctx.fillStyle = COLORS.YELLOW
      ctx.font = 'bold 16px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        'Ready!',
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 20
      )

      if (gameState.readyTimer > 0) {
        ctx.fillText(
          gameState.readyTimer.toString(),
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 - 20
        )
      }
    }

    // Draw level transition overlay
    if (gameState.gameStatus === 'levelTransition') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

      ctx.fillStyle = COLORS.YELLOW
      ctx.font = 'bold 20px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        `Level ${gameState.currentLevel} Complete!`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 40
      )

      if (gameState.showBonusMessage) {
        ctx.fillStyle = COLORS.WHITE
        ctx.font = '14px Arial'
        ctx.fillText(
          `Bonus: ${gameState.bonusScore}`,
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2
        )

        ctx.fillText(
          `Get Ready for Level ${gameState.currentLevel + 1}!`,
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 + 40
        )
      }
    }
  }, [gameState])

  // Game control functions
  const startGame = () => {
    if (!isConnected) {
      connect({ connector: farcasterFrame() })
      return
    }

    if (chainId !== monadTestnet.id) {
      switchChain({ chainId: monadTestnet.id })
      return
    }

    setGameState(prev => ({ 
      ...prev, 
      gameStatus: 'ready',
      readyTimer: 3,
      score: 0,
      lives: 3,
      currentLevel: 1,
      consecutiveLevels: 0,
      levelStats: []
    }))
    initializeLevel(1)
  }

  const restartGame = () => {
    setGameState(prev => ({ 
      ...prev, 
      gameStatus: 'ready',
      readyTimer: 3,
      score: 0,
      lives: 3,
      currentLevel: 1,
      consecutiveLevels: 0,
      levelStats: []
    }))
    setScoreSaved(false)
    initializeLevel(1)
  }

  const continueGame = () => {
    if (gameState.lives > 0) {
      setGameState(prev => ({ 
        ...prev, 
        gameStatus: 'ready',
        readyTimer: 3
      }))
    }
  }

  const exitToMenu = () => {
    setGameState(prev => ({ 
      ...prev, 
      gameStatus: 'pregame',
      showLeaderboard: false
    }))
    soundManagerRef.current?.stopBackgroundMusic()
  }

  const toggleLeaderboard = () => {
    setGameState(prev => ({ 
      ...prev, 
      showLeaderboard: !prev.showLeaderboard 
    }))
  }

  const toggleSounds = () => {
    const enabled = soundManagerRef.current?.toggleSounds()
    return enabled
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

  // Save score on-chain
  const saveScoreOnChain = async () => {
    if (!isConnected || !address || chainId !== monadTestnet.id || scoreSaved) return

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
      await loadOnChainScores()
    } catch (error) {
      console.error('Error saving score:', error)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
      {/* Start Screen - Cleaned up */}
      {gameState.gameStatus === 'pregame' && (
        <div className="text-center space-y-6 max-w-md">
          <div className="mb-8">
            <h1 className="text-6xl font-bold mb-4 text-yellow-400">PACMON</h1>
          </div>

          {/* Current High Scores - Only show if there are real scores */}
          {gameState.onChainScores.length > 0 && (
            <div className="bg-blue-900 p-4 rounded-lg">
              <h3 className="text-lg font-bold mb-2 text-yellow-400">Current High Scores</h3>
              <div className="space-y-1 text-sm">
                {gameState.onChainScores.slice(0, 3).map((score, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{score.address.slice(0, 6)}...{score.address.slice(-4)}</span>
                    <span className="text-yellow-400">{score.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User's On-Chain Score */}
          {gameState.userOnChainScore && (
            <div className="bg-purple-900 p-3 rounded-lg">
              <p className="text-sm">Your Best: <span className="text-yellow-400 font-bold">{gameState.userOnChainScore.toLocaleString()}</span></p>
            </div>
          )}

          {/* Wallet Status */}
          {isConnected && (
            <div className="bg-green-900 p-3 rounded-lg">
              <p className="text-sm">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
              {chainId !== monadTestnet.id && (
                <p className="text-yellow-400 text-xs mt-1">Switch to Monad Testnet to play</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={startGame}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {!isConnected ? 'Connect Wallet to Play' : 
               chainId !== monadTestnet.id ? 'Switch to Monad Testnet' : 'Start Game'}
            </button>

            <button
              onClick={toggleLeaderboard}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
            >
              View Leaderboard
            </button>

            {isConnected && (
              <button
                onClick={() => disconnect()}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              >
                Disconnect Wallet
              </button>
            )}
          </div>
        </div>
      )}

      {/* Leaderboard Overlay */}
      {gameState.showLeaderboard && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-blue-900 p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-yellow-400 text-center">Leaderboard</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {gameState.onChainScores.length > 0 ? (
                gameState.onChainScores.map((score, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-blue-700">
                    <div className="flex items-center space-x-2">
                      <span className="text-yellow-400 font-bold">#{index + 1}</span>
                      <span className="text-sm">{score.address.slice(0, 8)}...{score.address.slice(-6)}</span>
                    </div>
                    <span className="text-yellow-400 font-bold">{score.score.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p>No scores yet!</p>
                  <p className="text-sm mt-2">Be the first to set a high score.</p>
                </div>
              )}
            </div>
            <button
              onClick={toggleLeaderboard}
              className="w-full mt-4 bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-2 px-4 rounded transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Game View */}
      {(gameState.gameStatus === 'playing' || gameState.gameStatus === 'ready' || gameState.gameStatus === 'levelTransition') && (
        <div className="flex flex-col items-center space-y-4">
          {/* Game Info */}
          <div className="flex justify-between items-center w-full max-w-md text-sm">
            <div className="text-yellow-400">Score: {gameState.score.toLocaleString()}</div>
            <div className="text-red-400">Lives: {gameState.lives}</div>
            <div className="text-blue-400">Level: {gameState.currentLevel}</div>
            {gameState.powerMode && (
              <div className="text-purple-400">Power: {gameState.powerModeTimer}</div>
            )}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={toggleSounds}
            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded transition-colors"
          >
            Sound: {soundManagerRef.current?.getSoundsEnabled() ? 'ON' : 'OFF'}
          </button>

          {/* Game Canvas */}
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="border-2 border-blue-600 bg-black"
          />

          {/* Mobile Controls */}
          <div className="grid grid-cols-3 gap-2 mt-4 md:hidden">
            <div></div>
            <button
              onTouchStart={() => handleMobileControl('up')}
              onClick={() => handleMobileControl('up')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors"
            >
              ↑
            </button>
            <div></div>
            <button
              onTouchStart={() => handleMobileControl('left')}
              onClick={() => handleMobileControl('left')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors"
            >
              ←
            </button>
            <div></div>
            <button
              onTouchStart={() => handleMobileControl('right')}
              onClick={() => handleMobileControl('right')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors"
            >
              →
            </button>
            <div></div>
            <button
              onTouchStart={() => handleMobileControl('down')}
              onClick={() => handleMobileControl('down')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors"
            >
              ↓
            </button>
            <div></div>
          </div>
        </div>
      )}

      {/* Post Game Screen */}
      {gameState.gameStatus === 'postGame' && (
        <div className="text-center space-y-6 max-w-md">
          <h2 className="text-4xl font-bold text-red-400">Game Over</h2>

          <div className="bg-gray-800 p-4 rounded-lg space-y-2">
            <p className="text-xl">Final Score: <span className="text-yellow-400 font-bold">{gameState.score.toLocaleString()}</span></p>
            <p>Levels Completed: <span className="text-blue-400">{gameState.consecutiveLevels}</span></p>
            <p>Highest Level: <span className="text-purple-400">{gameState.currentLevel}</span></p>

            {gameState.score > (gameState.userOnChainScore || 0) && (
              <p className="text-green-400 font-bold">🎉 New Personal Best!</p>
            )}
          </div>

          {/* Statistics */}
          {gameState.levelStats.length > 0 && (
            <div className="bg-blue-900 p-4 rounded-lg">
              <h3 className="text-lg font-bold mb-2 text-yellow-400">Statistics</h3>
              <div className="text-sm space-y-1">
                <p>Total Score: {gameState.score.toLocaleString()}</p>
                <p>Levels Played: {gameState.levelStats.length}</p>
                <p>Average Score/Level: {Math.floor(gameState.score / gameState.levelStats.length).toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Save Score */}
          {isConnected && chainId === monadTestnet.id && !scoreSaved && (
            <button
              onClick={saveScoreOnChain}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Save Score On-Chain
            </button>
          )}

          {scoreSaved && (
            <div className="bg-green-900 p-3 rounded-lg">
              <p className="text-green-400">✅ Score saved on Monad Testnet!</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={restartGame}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Play Again
            </button>

            {gameState.lives > 0 && (
              <button
                onClick={continueGame}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              >
                Continue ({gameState.lives} lives left)
              </button>
            )}

            <button
              onClick={exitToMenu}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
            >
              Main Menu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
