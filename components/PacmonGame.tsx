
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

// Contract address for score storage
const SCORE_CONTRACT_ADDRESS = '0x1F0e9dcd371af37AD20E96A5a193d78052dCA984'

// Level configurations with progressive difficulty
const LEVEL_CONFIGS = [
  {
    level: 1,
    name: "Beginner's Maze",
    ghostSpeed: 300, // milliseconds between moves (slower = easier)
    ghostCount: 2,
    powerPelletDuration: 40, // 8 seconds at 200ms intervals
    scoreMultiplier: 1,
    bonusPoints: 500,
    description: "Easy start with fewer ghosts"
  },
  {
    level: 2,
    name: "Getting Warmer",
    ghostSpeed: 250,
    ghostCount: 3,
    powerPelletDuration: 35,
    scoreMultiplier: 1.2,
    bonusPoints: 750,
    description: "More ghosts join the hunt"
  },
  {
    level: 3,
    name: "Maze Runner",
    ghostSpeed: 200,
    ghostCount: 3,
    powerPelletDuration: 30,
    scoreMultiplier: 1.5,
    bonusPoints: 1000,
    description: "Faster ghosts, same count"
  },
  {
    level: 4,
    name: "Ghost Town",
    ghostSpeed: 180,
    ghostCount: 4,
    powerPelletDuration: 25,
    scoreMultiplier: 1.8,
    bonusPoints: 1500,
    description: "All ghosts are active now"
  },
  {
    level: 5,
    name: "Speed Demon",
    ghostSpeed: 150,
    ghostCount: 4,
    powerPelletDuration: 20,
    scoreMultiplier: 2.0,
    bonusPoints: 2000,
    description: "Maximum difficulty reached"
  },
  {
    level: 6,
    name: "Nightmare Mode",
    ghostSpeed: 120,
    ghostCount: 4,
    powerPelletDuration: 15,
    scoreMultiplier: 2.5,
    bonusPoints: 3000,
    description: "For the brave souls"
  }
]

// Multiple maze layouts for different levels
const MAZES = [
  // Level 1 - Simple maze with wide corridors
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,2,2,2,1,1,1,1,1,1,2,2,2,1,1,3,1],
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
  ],
  // Level 2 - More complex with tighter spaces
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,3,1,0,0,1,2,1,0,0,0,0,1,2,1,0,0,1,3,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,2,2,1,1,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,1,2,0,0,2,1,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,2,2,1,1,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,3,1,0,0,1,2,1,0,0,0,0,1,2,1,0,0,1,3,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  // Level 3 - Cross pattern with central hub
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1],
    [1,2,1,0,0,0,0,1,2,1,1,2,1,0,0,0,0,1,2,1],
    [1,2,1,0,1,1,0,1,2,1,1,2,1,0,1,1,0,1,2,1],
    [1,2,1,0,1,1,0,1,2,2,2,2,1,0,1,1,0,1,2,1],
    [1,2,1,0,0,0,0,1,1,1,1,1,1,0,0,0,0,1,2,1],
    [1,2,1,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,2,2,2,2,2,0,0,2,2,2,2,2,1,1,1,1],
    [1,1,1,1,2,2,2,2,2,0,0,2,2,2,2,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1,2,1],
    [1,2,1,0,0,0,0,1,1,1,1,1,1,0,0,0,0,1,2,1],
    [1,2,1,0,1,1,0,1,2,2,2,2,1,0,1,1,0,1,2,1],
    [1,2,1,0,1,1,0,1,2,1,1,2,1,0,1,1,0,1,2,1],
    [1,2,1,0,0,0,0,1,2,1,1,2,1,0,0,0,0,1,2,1],
    [1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1],
    [1,3,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  // Level 4 - Spiral maze
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,2,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,2,1],
    [1,2,1,2,1,1,1,1,1,1,1,1,1,1,1,1,2,1,2,1],
    [1,2,1,2,1,2,2,2,2,2,2,2,2,2,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,1,1,1,1,1,1,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,2,2,2,2,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,1,1,1,1,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,1,0,0,1,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,1,0,0,1,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,1,1,1,1,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,2,2,2,2,2,2,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,1,1,1,1,1,1,1,1,2,1,2,1,2,1],
    [1,2,1,2,1,2,2,2,2,2,2,2,2,2,2,1,2,1,2,1],
    [1,2,1,2,1,1,1,1,1,1,1,1,1,1,1,1,2,1,2,1],
    [1,2,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  // Level 5 - Complex interconnected maze
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,1,2,2,2,2,2,2,2,2,2,2,1,2,2,2,1],
    [1,2,1,2,1,2,1,1,1,1,1,1,1,1,2,1,2,1,2,1],
    [1,2,1,2,2,2,1,0,0,0,0,0,0,1,2,2,2,1,2,1],
    [1,2,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,0,1,0,0,1,0,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,2,0,1,0,0,1,0,2,1,1,1,1,1,1],
    [0,0,0,0,0,1,2,0,0,0,0,0,0,2,1,0,0,0,0,0],
    [1,1,1,1,1,1,2,1,1,0,0,1,1,2,1,1,1,1,1,1],
    [2,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,2],
    [1,1,1,1,1,1,2,1,1,0,0,1,1,2,1,1,1,1,1,1],
    [0,0,0,0,0,1,2,0,0,0,0,0,0,2,1,0,0,0,0,0],
    [1,1,1,1,1,1,2,0,1,0,0,1,0,2,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,0,1,0,0,1,0,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1,2,1],
    [1,2,1,2,2,2,1,0,0,0,0,0,0,1,2,2,2,1,2,1],
    [1,2,1,2,1,2,1,1,1,1,1,1,1,1,2,1,2,1,2,1],
    [1,2,2,2,1,2,2,2,2,2,2,2,2,2,2,1,2,2,2,1],
    [1,3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  // Level 6 - Ultimate challenge maze
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,1,2,2,2,2,2,2,2,2,1,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,3,1,2,2,2,2,1,0,0,0,0,1,2,2,2,2,1,3,1],
    [1,2,1,2,1,1,1,1,0,1,1,0,1,1,1,1,2,1,2,1],
    [1,2,2,2,1,0,0,0,0,1,1,0,0,0,0,1,2,2,2,1],
    [1,1,1,2,1,0,1,1,1,1,1,1,1,1,0,1,2,1,1,1],
    [0,0,1,2,1,0,1,0,0,0,0,0,0,1,0,1,2,1,0,0],
    [1,1,1,2,2,0,1,0,1,0,0,1,0,1,0,2,2,1,1,1],
    [1,2,2,2,2,0,0,0,1,0,0,1,0,0,0,2,2,2,2,1],
    [1,1,1,2,2,0,1,0,1,0,0,1,0,1,0,2,2,1,1,1],
    [0,0,1,2,1,0,1,0,0,0,0,0,0,1,0,1,2,1,0,0],
    [1,1,1,2,1,0,1,1,1,1,1,1,1,1,0,1,2,1,1,1],
    [1,2,2,2,1,0,0,0,0,1,1,0,0,0,0,1,2,2,2,1],
    [1,2,1,2,1,1,1,1,0,1,1,0,1,1,1,1,2,1,2,1],
    [1,3,1,2,2,2,2,1,0,0,0,0,1,2,2,2,2,1,3,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,2,2,2,2,2,1,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ]
]

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

interface GameState {
  pacmon: Position
  pacmonDirection: Position
  ghosts: Ghost[]
  pellets: Position[]
  powerPellets: Position[]
  score: number
  lives: number
  level: number
  gameStatus: 'pregame' | 'playing' | 'gameOver' | 'levelComplete' | 'postGame' | 'levelTransition'
  powerMode: boolean
  powerModeTimer: number
  highScore: number
  totalPlayers: number
  totalPlays: number
  userOnChainScore: number | null
  onChainScores: OnChainScore[]
  showLeaderboard: boolean
  levelStartTime: number
  levelCompleteBonus: number
  extraLifeThreshold: number
  transitionTimer: number
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

export default function PacmonGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const soundManagerRef = useRef<SoundManager | null>(null)
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
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
    level: 1,
    gameStatus: 'pregame',
    powerMode: false,
    powerModeTimer: 0,
    highScore: 0,
    totalPlayers: 0,
    totalPlays: 0,
    userOnChainScore: null,
    onChainScores: [],
    showLeaderboard: false,
    levelStartTime: 0,
    levelCompleteBonus: 0,
    extraLifeThreshold: 10000,
    transitionTimer: 0
  })

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager()
  }, [])

  // Initialize ghosts based on current level
  const initializeGhosts = useCallback((level: number): Ghost[] => {
    const config = LEVEL_CONFIGS[Math.min(level - 1, LEVEL_CONFIGS.length - 1)]
    const ghostTypes: Array<'blinky' | 'pinky' | 'inky' | 'clyde'> = ['blinky', 'pinky', 'inky', 'clyde']
    const ghostColors = [COLORS.MONAD_BERRY, COLORS.MONAD_PURPLE, COLORS.MONAD_BLUE, COLORS.MONAD_OFF_WHITE]
    const scatterTargets = [
      { x: 18, y: 0 }, { x: 1, y: 0 }, { x: 18, y: 18 }, { x: 1, y: 18 }
    ]

    return Array.from({ length: config.ghostCount }, (_, i) => ({
      id: i + 1,
      position: { x: 9 + (i % 2), y: 9 + Math.floor(i / 2) },
      direction: { x: i % 2 === 0 ? 1 : -1, y: 0 },
      color: ghostColors[i],
      vulnerable: false,
      type: ghostTypes[i],
      scatterTarget: scatterTargets[i],
      eaten: false,
      speed: config.ghostSpeed,
      lastMoveTime: 0
    }))
  }, [])

  // Initialize level
  const initializeLevel = useCallback((level: number) => {
    const mazeIndex = Math.min(level - 1, MAZES.length - 1)
    const maze = MAZES[mazeIndex]
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

    setGameState(prev => ({
      ...prev,
      level,
      pellets,
      powerPellets,
      ghosts: initializeGhosts(level),
      pacmon: { x: 9, y: 15 },
      pacmonDirection: { x: 0, y: 0 },
      powerMode: false,
      powerModeTimer: 0,
      levelStartTime: Date.now(),
      levelCompleteBonus: 0
    }))
  }, [initializeGhosts])

  // Load on-chain scores and user's score
  const loadOnChainScores = useCallback(async () => {
    if (!publicClient || !address) return

    try {
      // Simulate loading on-chain scores
      const mockOnChainScores: OnChainScore[] = [
        { address: '0x1234567890123456789012345678901234567890', score: 15450, timestamp: Date.now() - 86400000 },
        { address: '0x9876543210987654321098765432109876543210', score: 12890, timestamp: Date.now() - 172800000 },
        { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', score: 9650, timestamp: Date.now() - 259200000 },
        { address: '0x1111222233334444555566667777888899990000', score: 7420, timestamp: Date.now() - 345600000 },
        { address: '0x0000999988887777666655554444333322221111', score: 5200, timestamp: Date.now() - 432000000 }
      ]

      const userScore = mockOnChainScores.find(score => 
        score.address.toLowerCase() === address.toLowerCase()
      )

      setGameState(prev => ({
        ...prev,
        onChainScores: mockOnChainScores.sort((a, b) => b.score - a.score),
        userOnChainScore: userScore?.score || null,
        highScore: mockOnChainScores[0]?.score || 0
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

  // Initialize first level
  useEffect(() => {
    initializeLevel(1)
  }, [initializeLevel])

  // Enhanced game loop with level-based ghost speeds
  useEffect(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
    }

    gameLoopRef.current = setInterval(() => {
      if (gameState.gameStatus === 'playing') {
        setGameState(prev => {
          let newState = { ...prev }
          const currentTime = Date.now()

          // Move Pacmon
          let newPacmonPos = {
            x: newState.pacmon.x + newState.pacmonDirection.x,
            y: newState.pacmon.y + newState.pacmonDirection.y
          }

          const currentMaze = MAZES[Math.min(newState.level - 1, MAZES.length - 1)]

          // Check for wall collision
          if (newPacmonPos.x >= 0 && newPacmonPos.x < GRID_SIZE &&
              newPacmonPos.y >= 0 && newPacmonPos.y < GRID_SIZE &&
              currentMaze[newPacmonPos.y][newPacmonPos.x] !== 1) {
            newState.pacmon = newPacmonPos

            // Check pellet collection
            const pelletIndex = newState.pellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (pelletIndex !== -1) {
              newState.pellets = newState.pellets.filter((_, index) => index !== pelletIndex)
              const config = LEVEL_CONFIGS[Math.min(newState.level - 1, LEVEL_CONFIGS.length - 1)]
              newState.score += Math.floor(10 * config.scoreMultiplier)
              soundManagerRef.current?.play('pelletEat')
            }

            // Check power pellet collection
            const powerPelletIndex = newState.powerPellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (powerPelletIndex !== -1) {
              newState.powerPellets = newState.powerPellets.filter((_, index) => index !== powerPelletIndex)
              const config = LEVEL_CONFIGS[Math.min(newState.level - 1, LEVEL_CONFIGS.length - 1)]
              newState.score += Math.floor(50 * config.scoreMultiplier)
              newState.powerMode = true
              newState.powerModeTimer = config.powerPelletDuration
              soundManagerRef.current?.play('powerPellet')
            }
          } else {
            // Stop Pacmon if hits a wall
            newState.pacmonDirection = { x: 0, y: 0 }
          }

          // Move ghosts with individual speeds
          newState.ghosts = newState.ghosts.map(ghost => {
            if (currentTime - ghost.lastMoveTime < ghost.speed) {
              return ghost // Don't move this ghost yet
            }

            let updatedGhost = { ...ghost, lastMoveTime: currentTime }

            if (updatedGhost.eaten) {
              // Eaten ghosts return to ghost house
              if (updatedGhost.position.x === 9 && updatedGhost.position.y === 9) {
                return { ...updatedGhost, eaten: false, vulnerable: false }
              }
              // Simple path back to ghost house
              const target = { x: 9, y: 9 }
              const dx = target.x - updatedGhost.position.x
              const dy = target.y - updatedGhost.position.y
              let newDirection = { x: 0, y: 0 }

              if (Math.abs(dx) > Math.abs(dy)) {
                newDirection.x = dx > 0 ? 1 : -1
              } else {
                newDirection.y = dy > 0 ? 1 : -1
              }
              return { 
                ...updatedGhost, 
                direction: newDirection, 
                position: { 
                  x: updatedGhost.position.x + newDirection.x, 
                  y: updatedGhost.position.y + newDirection.y 
                } 
              }
            }

            let targetTile: Position
            if (newState.powerMode) {
              // Frightened mode: random movement away from Pacman
              const directions = [
                { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
              ]
              const validDirections = directions.filter(dir => {
                const testPos = {
                  x: updatedGhost.position.x + dir.x,
                  y: updatedGhost.position.y + dir.y
                }
                return testPos.x >= 0 && testPos.x < GRID_SIZE && 
                       testPos.y >= 0 && testPos.y < GRID_SIZE && 
                       currentMaze[testPos.y][testPos.x] !== 1
              })

              // Prefer directions away from Pacman
              const awayDirections = validDirections.filter(dir => {
                const testPos = {
                  x: updatedGhost.position.x + dir.x,
                  y: updatedGhost.position.y + dir.y
                }
                const distanceToPacman = Math.sqrt(
                  Math.pow(testPos.x - newState.pacmon.x, 2) +
                  Math.pow(testPos.y - newState.pacmon.y, 2)
                )
                const currentDistance = Math.sqrt(
                  Math.pow(updatedGhost.position.x - newState.pacmon.x, 2) +
                  Math.pow(updatedGhost.position.y - newState.pacmon.y, 2)
                )
                return distanceToPacman > currentDistance
              })

              const chosenDirections = awayDirections.length > 0 ? awayDirections : validDirections
              const newDirection = chosenDirections[Math.floor(Math.random() * chosenDirections.length)]
              targetTile = { 
                x: updatedGhost.position.x + newDirection.x, 
                y: updatedGhost.position.y + newDirection.y 
              }
            } else {
              // Enhanced AI based on ghost type and level
              switch (updatedGhost.type) {
                case 'blinky':
                  // Direct chase, gets more aggressive at higher levels
                  targetTile = newState.pacmon
                  break
                case 'pinky':
                  // Ambush: target 4 tiles ahead of Pac-Man
                  targetTile = {
                    x: newState.pacmon.x + newState.pacmonDirection.x * 4,
                    y: newState.pacmon.y + newState.pacmonDirection.y * 4
                  }
                  break
                case 'inky':
                  // Complex: depends on Pac-Man and Blinky
                  const blinky = newState.ghosts.find(g => g.type === 'blinky')
                  if (blinky) {
                    const pacmanTwoAhead = {
                      x: newState.pacmon.x + newState.pacmonDirection.x * 2,
                      y: newState.pacmon.y + newState.pacmonDirection.y * 2
                    }
                    const vector = {
                      x: pacmanTwoAhead.x - blinky.position.x,
                      y: pacmanTwoAhead.y - blinky.position.y
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
                  // Scatter if close to Pac-Man, else chase
                  const distance = Math.sqrt(
                    Math.pow(updatedGhost.position.x - newState.pacmon.x, 2) +
                    Math.pow(updatedGhost.position.y - newState.pacmon.y, 2)
                  )
                  if (distance < 8) {
                    targetTile = updatedGhost.scatterTarget
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
            let bestDirection = updatedGhost.direction
            let minDistance = Infinity

            possibleDirections.forEach(dir => {
              const nextPos = { 
                x: updatedGhost.position.x + dir.x, 
                y: updatedGhost.position.y + dir.y 
              }
              if (nextPos.x >= 0 && nextPos.x < GRID_SIZE && 
                  nextPos.y >= 0 && nextPos.y < GRID_SIZE && 
                  currentMaze[nextPos.y][nextPos.x] !== 1) {
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
              ...updatedGhost, 
              direction: bestDirection, 
              position: { 
                x: updatedGhost.position.x + bestDirection.x, 
                y: updatedGhost.position.y + bestDirection.y 
              }, 
              vulnerable: newState.powerMode 
            }
          })

          // Check ghost collisions
          newState.ghosts.forEach(ghost => {
            if (ghost.position.x === newState.pacmon.x && ghost.position.y === newState.pacmon.y) {
              if (ghost.vulnerable) {
                // Eat ghost
                const config = LEVEL_CONFIGS[Math.min(newState.level - 1, LEVEL_CONFIGS.length - 1)]
                newState.score += Math.floor(200 * config.scoreMultiplier)
                ghost.eaten = true
                ghost.vulnerable = false
                soundManagerRef.current?.play('ghostEat')
              } else if (!ghost.eaten) {
                // Lose life
                newState.lives -= 1
                newState.pacmon = { x: 9, y: 15 }
                newState.pacmonDirection = { x: 0, y: 0 }
                newState.ghosts = initializeGhosts(newState.level)
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

          // Check for extra life
          if (newState.score >= newState.extraLifeThreshold) {
            newState.lives += 1
            newState.extraLifeThreshold += 10000
            soundManagerRef.current?.play('extraLife')
          }

          // Check level complete
          if (newState.pellets.length === 0 && newState.powerPellets.length === 0) {
            const config = LEVEL_CONFIGS[Math.min(newState.level - 1, LEVEL_CONFIGS.length - 1)]
            const timeBonus = Math.max(0, 5000 - Math.floor((Date.now() - newState.levelStartTime) / 1000) * 10)
            newState.levelCompleteBonus = config.bonusPoints + timeBonus
            newState.score += newState.levelCompleteBonus
            newState.gameStatus = 'levelTransition'
            newState.transitionTimer = 15 // 3 seconds at 200ms intervals
            soundManagerRef.current?.play('levelComplete')
          }

          return newState
        })
      } else if (gameState.gameStatus === 'levelTransition') {
        setGameState(prev => {
          let newState = { ...prev }
          newState.transitionTimer -= 1

          if (newState.transitionTimer <= 0) {
            if (newState.level < LEVEL_CONFIGS.length) {
              // Go to next level
              const nextLevel = newState.level + 1
              initializeLevel(nextLevel)
              newState.gameStatus = 'playing'
            } else {
              // Game completed
              newState.gameStatus = 'postGame'
              soundManagerRef.current?.stopBackgroundMusic()
              soundManagerRef.current?.play('gameOver')
            }
          }

          return newState
        })
      }
    }, 200)

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState.gameStatus, gameState.level, initializeGhosts, initializeLevel])

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

    const currentMaze = MAZES[Math.min(gameState.level - 1, MAZES.length - 1)]
    const nextX = gameState.pacmon.x + newDirection.x
    const nextY = gameState.pacmon.y + newDirection.y

    if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE && 
        currentMaze[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.level])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // Enhanced render function
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const currentMaze = MAZES[Math.min(gameState.level - 1, MAZES.length - 1)]

    // Clear canvas
    ctx.fillStyle = COLORS.MONAD_BLACK
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze
    ctx.fillStyle = COLORS.MONAD_BLUE
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (currentMaze[y][x] === 1) {
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

    // Draw power pellets with pulsing effect
    const pulseSize = 4 + Math.sin(Date.now() / 200) * 2
    ctx.fillStyle = COLORS.MONAD_PURPLE
    gameState.powerPellets.forEach(pellet => {
      ctx.beginPath()
      ctx.arc(
        pellet.x * CELL_SIZE + CELL_SIZE / 2,
        pellet.y * CELL_SIZE + CELL_SIZE / 2,
        pulseSize,
        0,
        2 * Math.PI
      )
      ctx.fill()
    })

    // Draw Pacmon with mouth animation
    ctx.fillStyle = COLORS.MONAD_PURPLE
    const mouthAngle = Math.sin(Date.now() / 150) * 0.5 + 0.5
    ctx.beginPath()
    ctx.arc(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0.2 * Math.PI * mouthAngle,
      (2 - 0.2 * mouthAngle) * Math.PI
    )
    ctx.lineTo(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2
    )
    ctx.fill()

    // Draw ghosts with enhanced visuals
    gameState.ghosts.forEach(ghost => {
      if (ghost.eaten) return // Don't draw eaten ghosts

      ctx.fillStyle = ghost.vulnerable ? COLORS.MONAD_BERRY : ghost.color

      // Ghost body
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
      ctx.fillStyle = ghost.vulnerable ? COLORS.WHITE : COLORS.WHITE
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

      // Vulnerable ghost mouth
      if (ghost.vulnerable) {
        ctx.fillStyle = COLORS.MONAD_BLACK
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 8,
          ghost.position.y * CELL_SIZE + 12,
          4,
          2
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
        `Level ${gameState.level} Complete!`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 40
      )

      ctx.fillStyle = COLORS.MONAD_OFF_WHITE
      ctx.font = '16px Arial'
      ctx.fillText(
        `Bonus: ${gameState.levelCompleteBonus}`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 10
      )

      if (gameState.level < LEVEL_CONFIGS.length) {
        const nextConfig = LEVEL_CONFIGS[gameState.level]
        ctx.fillText(
          `Next: ${nextConfig.name}`,
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 + 20
        )
      } else {
        ctx.fillText(
          'All Levels Complete!',
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2 + 20
        )
      }
    }
  }, [gameState])

  // Rest of the component methods remain the same...
  const handleWalletConnect = async () => {
    if (!isConnected) {
      if (isEthProviderAvailable) {
        connect({ connector: farcasterFrame() })
      }
      return
    }

    if (chainId !== monadTestnet.id) {
      switchChain({ chainId: monadTestnet.id })
      return
    }

    setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
    soundManagerRef.current?.playBackgroundMusic()
  }

  const handleScoreSubmission = async () => {
    if (!isConnected || chainId !== monadTestnet.id) {
      return
    }

    try {
      const scoreData = toHex(gameState.score, { size: 32 })
      const timestampData = toHex(Math.floor(Date.now() / 1000), { size: 32 })

      await sendTransaction({
        to: SCORE_CONTRACT_ADDRESS,
        value: parseEther("0.015"),
        data: `0x${scoreData.slice(2)}${timestampData.slice(2)}`
      })

      setGameState(prev => ({
        ...prev,
        userOnChainScore: prev.score,
        onChainScores: [
          { address: address!, score: prev.score, timestamp: Date.now() },
          ...prev.onChainScores.filter(s => s.address.toLowerCase() !== address!.toLowerCase())
        ].sort((a, b) => b.score - a.score)
      }))
      setScoreSaved(true)

    } catch (error) {
      console.error("Score submission failed:", error)
    }
  }

  const startGame = () => {
    if (!isConnected) {
      handleWalletConnect()
    } else if (chainId !== monadTestnet.id) {
      switchChain({ chainId: monadTestnet.id })
    } else {
      initializeLevel(1)
      setGameState(prev => ({ 
        ...prev, 
        gameStatus: 'playing',
        score: 0,
        lives: 3,
        level: 1,
        extraLifeThreshold: 10000
      }))
      soundManagerRef.current?.playBackgroundMusic()
    }
  }

  const restartGame = () => {
    initializeLevel(1)
    setGameState(prev => ({
      ...prev,
      score: 0,
      lives: 3,
      level: 1,
      gameStatus: 'playing',
      powerMode: false,
      powerModeTimer: 0,
      extraLifeThreshold: 10000
    }))
    soundManagerRef.current?.playBackgroundMusic()
  }

  const exitGame = () => {
    setGameState(prev => ({ ...prev, gameStatus: 'pregame' }))
    soundManagerRef.current?.stopBackgroundMusic()
  }

  const toggleLeaderboard = () => {
    setGameState(prev => ({ ...prev, showLeaderboard: !prev.showLeaderboard }))
  }

  const toggleSounds = () => {
    const soundsEnabled = soundManagerRef.current?.toggleSounds()
    return soundsEnabled
  }

  const handleDirectionPress = useCallback((direction: Position) => {
    if (gameState.gameStatus !== 'playing') return

    const currentMaze = MAZES[Math.min(gameState.level - 1, MAZES.length - 1)]
    const nextX = gameState.pacmon.x + direction.x
    const nextY = gameState.pacmon.y + direction.y

    if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE && 
        currentMaze[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: direction }))
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.level])

  const currentLevelConfig = LEVEL_CONFIGS[Math.min(gameState.level - 1, LEVEL_CONFIGS.length - 1)]

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
      {gameState.gameStatus === 'pregame' && !gameState.showLeaderboard && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">
              PACMON
            </h1>
            <div className="text-lg font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
              Enhanced Multi-Level Edition
            </div>
            <div className="space-y-3 text-center" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              <div className="text-lg md:text-xl font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                Current High Scores Onchain
              </div>
              <div className="space-y-2 bg-black bg-opacity-30 rounded-lg p-4">
                {gameState.onChainScores.slice(0, 3).map((score, index) => (
                  <div key={index} className="flex items-center justify-between text-base md:text-lg" style={{ 
                    color: index === 0 ? COLORS.MONAD_BERRY : index === 1 ? COLORS.MONAD_BLUE : COLORS.MONAD_OFF_WHITE 
                  }}>
                    <span className="flex items-center">
                      <span className="text-xl mr-2">{index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉'}</span>
                      <span className="font-bold">{index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'}</span>
                    </span>
                    <span className="font-mono">{score.score.toLocaleString()}</span>
                    <span className="text-sm font-mono">{`${score.address.slice(0, 4)}...${score.address.slice(-4)}`}</span>
                  </div>
                ))}
                {gameState.onChainScores.length === 0 && (
                  <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                    Save your score onchain to appear here
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Level Preview */}
          <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ borderColor: COLORS.MONAD_PURPLE, backgroundColor: 'rgba(131, 110, 249, 0.1)' }}>
            <div className="text-center space-y-2">
              <div className="text-sm font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                🎮 {LEVEL_CONFIGS.length} Challenging Levels
              </div>
              <div className="text-xs" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                Progressive difficulty • Multiple mazes • Enhanced AI
              </div>
              <div className="text-xs" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                Extra lives at 10K, 20K, 30K points!
              </div>
            </div>
          </div>

          {/* User's On-Chain Score */}
          {gameState.userOnChainScore !== null && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ borderColor: COLORS.MONAD_PURPLE, backgroundColor: 'rgba(131, 110, 249, 0.1)' }}>
              <div className="text-center space-y-2">
                <div className="text-sm font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                  Your Best Onchain Score
                </div>
                <div className="text-xl font-mono font-bold" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  {gameState.userOnChainScore.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Wallet Connection Status */}
          {isConnected && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ borderColor: COLORS.MONAD_PURPLE, backgroundColor: 'rgba(131, 110, 249, 0.1)' }}>
              <div className="text-center space-y-2">
                <div className="text-sm font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                  Wallet Connected
                </div>
                <div className="text-xs font-mono" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
                <div className="text-xs" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  Chain: {chainId === monadTestnet.id ? 'Monad Testnet' : 'Switch to Monad Testnet'}
                </div>
              </div>
            </div>
          )}

          <div className="w-full max-w-md space-y-4 px-4">
            <button
              onClick={startGame}
              className="w-full py-6 px-8 text-xl md:text-2xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: COLORS.MONAD_BERRY, 
                color: COLORS.WHITE 
              }}
            >
              {!isConnected ? 'Connect Wallet to Play' : 
               chainId !== monadTestnet.id ? 'Switch to Monad Testnet' : 
               'Start Multi-Level Adventure'}
            </button>

            <button
              onClick={toggleLeaderboard}
              className="w-full py-4 px-6 text-lg font-bold rounded-lg transition-all duration-200"
              style={{ 
                backgroundColor: COLORS.MONAD_PURPLE, 
                color: COLORS.WHITE 
              }}
            >
              View Leaderboard
            </button>

            {isConnected && (
              <button
                onClick={() => disconnect()}
                className="w-full py-4 px-6 text-lg font-bold rounded-lg transition-all duration-200"
                style={{ 
                  backgroundColor: 'transparent', 
                  color: COLORS.MONAD_OFF_WHITE,
                  border: `1px solid ${COLORS.MONAD_OFF_WHITE}`
                }}
              >
                Disconnect Wallet
              </button>
            )}
          </div>

          <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            <p>🕹️ Arrow keys or WASD to move</p>
            <p className="mt-1">🎯 Eat all pellets while avoiding ghosts!</p>
            <p className="mt-1">⚡ Power pellets make ghosts vulnerable</p>
            <p className="mt-2 text-xs" style={{ color: COLORS.MONAD_PURPLE }}>
              💎 Submit your score to the blockchain for 0.015 MON!
            </p>
          </div>
        </div>
      )}

      {gameState.showLeaderboard && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
              🏆 Leaderboard
            </h2>
            <p className="text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Multi-Level Champions
            </p>
          </div>

          <div className="w-full max-w-md space-y-2 px-4">
            {gameState.onChainScores.map((score, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-black bg-opacity-30">
                <span className="text-lg font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
                  #{index + 1}
                </span>
                <span className="font-mono text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  {score.score.toLocaleString()}
                </span>
                <span className="text-sm font-mono" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  {`${score.address.slice(0, 4)}...${score.address.slice(-4)}`}
                </span>
              </div>
            ))}
            {gameState.onChainScores.length === 0 && (
              <div className="text-center p-8" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                <p>No scores saved onchain yet.</p>
                <p className="mt-2 text-sm">Be the first to conquer all levels!</p>
              </div>
            )}
          </div>

          <button
            onClick={toggleLeaderboard}
            className="py-4 px-8 text-lg font-bold rounded-lg"
            style={{ 
              backgroundColor: COLORS.MONAD_BERRY, 
              color: COLORS.WHITE 
            }}
          >
            Back to Game
          </button>
        </div>
      )}

      {(gameState.gameStatus === 'playing' || gameState.gameStatus === 'levelTransition') && (
        <div className="flex flex-col h-screen w-full">
          <div className="text-center py-2" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
            <h1 className="text-xl md:text-2xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
              PACMON - Level {gameState.level}
            </h1>
            <div className="text-sm font-semibold" style={{ color: COLORS.MONAD_BERRY }}>
              {currentLevelConfig.name}
            </div>
            <div className="flex justify-center space-x-4 text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              <div>Score: {gameState.score.toLocaleString()}</div>
              <div>Lives: {gameState.lives}</div>
              <div>Level: {gameState.level}/{LEVEL_CONFIGS.length}</div>
              {gameState.powerMode && (
                <div style={{ color: COLORS.MONAD_PURPLE }}>
                  Power: {Math.ceil(gameState.powerModeTimer / 5)}s
                </div>
              )}
              <button
                onClick={toggleSounds}
                className="text-xs px-2 py-1 rounded"
                style={{ 
                  backgroundColor: COLORS.MONAD_BLUE, 
                  color: COLORS.WHITE 
                }}
              >
                {soundManagerRef.current?.getSoundsEnabled() ? '🔊' : '🔇'}
              </button>
            </div>
          </div>

          <div className="flex flex-col h-full">
            <div className="flex-1 flex items-start justify-center pt-4">
              <canvas
                ref={canvasRef}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
                className="max-w-full max-h-full"
                style={{ backgroundColor: COLORS.MONAD_BLACK }}
              />
            </div>

            {/* Enhanced Mobile Controls */}
            <div className="flex justify-center pb-8 pt-4 md:hidden">
              <div className="flex flex-col items-center space-y-4">
                <button
                  onTouchStart={() => handleDirectionPress({ x: 0, y: -1 })}
                  onClick={() => handleDirectionPress({ x: 0, y: -1 })}
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-2 active:scale-95 transition-transform"
                  style={{ 
                    backgroundColor: COLORS.MONAD_PURPLE, 
                    color: COLORS.WHITE,
                    borderColor: COLORS.MONAD_OFF_WHITE,
                    opacity: 0.9
                  }}
                >
                  ⬆️
                </button>
                <div className="flex space-x-6">
                  <button
                    onTouchStart={() => handleDirectionPress({ x: -1, y: 0 })}
                    onClick={() => handleDirectionPress({ x: -1, y: 0 })}
                    className="w-28 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-2 active:scale-95 transition-transform"
                    style={{ 
                      backgroundColor: COLORS.MONAD_PURPLE, 
                      color: COLORS.WHITE,
                      borderColor: COLORS.MONAD_OFF_WHITE,
                      opacity: 0.9
                    }}
                  >
                    ⬅️
                  </button>
                  <button
                    onTouchStart={() => handleDirectionPress({ x: 1, y: 0 })}
                    onClick={() => handleDirectionPress({ x: 1, y: 0 })}
                    className="w-28 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-2 active:scale-95 transition-transform"
                    style={{ 
                      backgroundColor: COLORS.MONAD_PURPLE, 
                      color: COLORS.WHITE,
                      borderColor: COLORS.MONAD_OFF_WHITE,
                      opacity: 0.9
                    }}
                  >
                    ➡️
                  </button>
                </div>
                <button
                  onTouchStart={() => handleDirectionPress({ x: 0, y: 1 })}
                  onClick={() => handleDirectionPress({ x: 0, y: 1 })}
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold border-2 active:scale-95 transition-transform"
                  style={{ 
                    backgroundColor: COLORS.MONAD_PURPLE, 
                    color: COLORS.WHITE,
                    borderColor: COLORS.MONAD_OFF_WHITE,
                    opacity: 0.9
                  }}
                >
                  ⬇️
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState.gameStatus === 'postGame' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
              {gameState.level >= LEVEL_CONFIGS.length ? '🎉 All Levels Complete!' : 'Game Over!'}
            </h2>
            <div className="text-xl font-bold" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Final Score: {gameState.score.toLocaleString()}
            </div>
            <div className="text-lg" style={{ color: COLORS.MONAD_BERRY }}>
              Reached Level: {gameState.level}
            </div>
            {gameState.level >= LEVEL_CONFIGS.length && (
              <div className="text-lg" style={{ color: COLORS.MONAD_PURPLE }}>
                🏆 Congratulations! You've mastered all levels!
              </div>
            )}
          </div>

          {/* Score submission section */}
          {isConnected && chainId === monadTestnet.id && !scoreSaved && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ borderColor: COLORS.MONAD_PURPLE, backgroundColor: 'rgba(131, 110, 249, 0.1)' }}>
              <div className="text-center space-y-4">
                <div className="text-sm font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                  💎 Save Your Score Onchain
                </div>
                <div className="text-xs" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  Cost: 0.015 MON • Permanent record on Monad blockchain
                </div>
                <button
                  onClick={handleScoreSubmission}
                  className="w-full py-3 px-6 text-lg font-bold rounded-lg transition-all duration-200"
                  style={{ 
                    backgroundColor: COLORS.MONAD_BERRY, 
                    color: COLORS.WHITE 
                  }}
                >
                  Submit Score (0.015 MON)
                </button>
              </div>
            </div>
          )}

          {scoreSaved && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ borderColor: COLORS.GREEN, backgroundColor: 'rgba(0, 255, 0, 0.1)' }}>
              <div className="text-center space-y-2">
                <div className="text-sm font-semibold" style={{ color: COLORS.GREEN }}>
                  ✅ Score Saved Successfully!
                </div>
                <div className="text-xs" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  Your achievement is now permanently recorded on the blockchain
                </div>
              </div>
            </div>
          )}

          <div className="w-full max-w-md space-y-4 px-4">
            <button
              onClick={restartGame}
              className="w-full py-4 px-6 text-lg font-bold rounded-lg transition-all duration-200"
              style={{ 
                backgroundColor: COLORS.MONAD_PURPLE, 
                color: COLORS.WHITE 
              }}
            >
              🔄 Play Again
            </button>

            <button
              onClick={toggleLeaderboard}
              className="w-full py-4 px-6 text-lg font-bold rounded-lg transition-all duration-200"
              style={{ 
                backgroundColor: COLORS.MONAD_BLUE, 
                color: COLORS.WHITE 
              }}
            >
              📊 View Leaderboard
            </button>

            <button
              onClick={exitGame}
              className="w-full py-4 px-6 text-lg font-bold rounded-lg transition-all duration-200"
              style={{ 
                backgroundColor: 'transparent', 
                color: COLORS.MONAD_OFF_WHITE,
                border: `1px solid ${COLORS.MONAD_OFF_WHITE}`
              }}
            >
              🏠 Main Menu
            </button>
          </div>

          <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            <p>Thanks for playing Pacmon Enhanced!</p>
            <p className="mt-1">Challenge your friends to beat your score!</p>
          </div>
        </div>
      )}
    </div>
  )
}
