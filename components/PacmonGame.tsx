
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
  RED: '#FF0000',
  CYAN: '#00FFFF'
}

// Game constants
const GRID_SIZE = 20
const CELL_SIZE = 20
const GAME_WIDTH = GRID_SIZE * CELL_SIZE
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE
const MAX_LEVELS = 10
const BASE_GAME_SPEED = 200
const MIN_GAME_SPEED = 80

// Contract address for score storage
const SCORE_CONTRACT_ADDRESS = '0x1F0e9dcd371af37AD20E96A5a193d78052dCA984'

// Game entities interfaces
interface Position {
  x: number
  y: number
}

// Add this before the Ghost interface
type GhostType = 'blinky' | 'pinky' | 'inky' | 'clyde' | 'sue' | 'funky'

interface Ghost {
  id: number
  position: Position
  direction: Position
  color: string
  vulnerable: boolean
  type: GhostType  // Use the type alias instead
  scatterTarget: Position
  eaten: boolean
  speed: number
  mode: 'chase' | 'scatter' | 'frightened'
  modeTimer: number
  lastDirection: Position
}



interface PowerUp {
  position: Position
  type: 'speed' | 'freeze' | 'double' | 'shield' | 'bonus' | 'life'
  color: string
  points: number
  duration?: number
  active: boolean
}

interface OnChainScore {
  address: string
  score: number
  level: number
  timestamp: number
}

interface GameState {
  pacmon: Position
  pacmonDirection: Position
  ghosts: Ghost[]
  pellets: Position[]
  powerPellets: Position[]
  powerUps: PowerUp[]
  score: number
  lives: number
  level: number
  gameStatus: 'pregame' | 'playing' | 'gameOver' | 'levelComplete' | 'postGame' | 'levelTransition' | 'paused'
  powerMode: boolean
  powerModeTimer: number
  activePowerUps: { type: string; timer: number }[]
  gameSpeed: number
  highScore: number
  totalPlayers: number
  totalPlays: number
  userOnChainScore: number | null
  onChainScores: OnChainScore[]
  showLeaderboard: boolean
  levelStartTime: number
  levelBonus: number
  combo: number
  maxCombo: number
  ghostsEaten: number
  totalPellets: number
  pelletsEaten: number
  timeBonus: number
  perfectLevel: boolean
}


// Enhanced Sound Manager Class 
class SoundManager {
  private sounds: { [key: string]: HTMLAudioElement } = {}
  private soundsEnabled: boolean = true
  private musicVolume: number = 0.3
  private effectsVolume: number = 0.5

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
      powerUp: '/sounds/power-up.mp3',
      levelStart: '/sounds/level-start.mp3',
      bonus: '/sounds/bonus.mp3',
      freeze: '/sounds/freeze.mp3',
      shield: '/sounds/shield.mp3',
      combo: '/sounds/combo.mp3',
      backgroundMusic: '/sounds/playing-pac-man.mp3',
      arcadeSound: '/sounds/arcade-videogame-sound.mp3'
    }

    Object.entries(soundFiles).forEach(([key, path]) => {
      const audio = new Audio(path)
      audio.preload = 'auto'
      audio.volume = key === 'backgroundMusic' ? this.musicVolume : this.effectsVolume
      this.sounds[key] = audio
    })

    // Set background music to loop
    if (this.sounds.backgroundMusic) {
      this.sounds.backgroundMusic.loop = true
    }
  }

  play(soundName: string, volume?: number) {
    if (!this.soundsEnabled || !this.sounds[soundName]) return

    try {
      const sound = this.sounds[soundName]
      if (volume !== undefined) {
        sound.volume = volume
      }
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

  setVolume(type: 'music' | 'effects', volume: number) {
    if (type === 'music') {
      this.musicVolume = volume
      if (this.sounds.backgroundMusic) {
        this.sounds.backgroundMusic.volume = volume
      }
    } else {
      this.effectsVolume = volume
      Object.entries(this.sounds).forEach(([key, sound]) => {
        if (key !== 'backgroundMusic') {
          sound.volume = volume
        }
      })
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

// Progressive maze layouts for different levels
const MAZES = [
  // Level 1 - Easy (lots of open space)
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,3,1],
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

  // Level 2 - Medium (more walls)
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,2,1],
    [1,3,1,0,0,0,1,2,2,2,2,2,2,1,0,0,0,1,3,1],
    [1,2,1,0,0,0,1,1,1,2,2,1,1,1,0,0,0,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,2,1,1,1,1,2,1,2,1,1,1,2,1],
    [1,2,2,2,1,2,1,2,2,1,1,2,2,1,2,1,2,2,2,1],
    [1,1,1,2,1,2,1,1,2,1,1,2,1,1,2,1,2,1,1,1],
    [0,0,1,2,2,2,2,2,2,0,0,2,2,2,2,2,2,1,0,0],
    [1,1,1,2,1,2,1,1,2,1,1,2,1,1,2,1,2,1,1,1],
    [1,2,2,2,1,2,1,2,2,1,1,2,2,1,2,1,2,2,2,1],
    [1,2,1,1,1,2,1,2,1,1,1,1,2,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,0,0,0,1,1,1,2,2,1,1,1,0,0,0,1,2,1],
    [1,3,1,0,0,0,1,2,2,2,2,2,2,1,0,0,0,1,3,1],
    [1,2,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],

  // Level 3 - Hard (complex maze with fewer escape routes)
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,1,2,2,2,2,2,2,2,2,2,2,1,2,2,2,1],
    [1,3,1,2,1,2,1,1,1,1,1,1,1,1,2,1,2,1,3,1],
    [1,2,1,2,2,2,1,2,2,2,2,2,2,1,2,2,2,1,2,1],
    [1,2,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,1,2,2,1,2,2,2,2,2,2,2,1],
    [1,1,1,2,1,1,1,1,1,2,2,1,1,1,1,1,2,1,1,1],
    [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
    [1,1,1,1,1,1,1,2,1,0,0,1,2,1,1,1,1,1,1,1],
    [2,2,2,2,2,2,2,2,1,0,0,1,2,2,2,2,2,2,2,2],
    [1,1,1,1,1,1,1,2,1,0,0,1,2,1,1,1,1,1,1,1],
    [0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0],
    [1,1,1,2,1,1,1,1,1,2,2,1,1,1,1,1,2,1,1,1],
    [1,2,2,2,2,2,2,2,1,2,2,1,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,2,1],
    [1,2,1,2,2,2,1,2,2,2,2,2,2,1,2,2,2,1,2,1],
    [1,3,1,2,1,2,1,1,1,1,1,1,1,1,2,1,2,1,3,1],
    [1,2,2,2,1,2,2,2,2,2,2,2,2,2,2,1,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],

  // Level 4 - Very Hard (narrow passages)
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,1,2,1,2,1,2,1,2,2,1,2,1,2,1,2,1,2,1],
    [1,3,1,2,1,2,1,2,1,1,1,1,2,1,2,1,2,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,2,1,1,1,1,1,2,2,1,1,1,1,1,2,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,2,1,0,0,1,2,1,1,1,1,1,1,1],
    [2,2,2,2,2,2,2,2,1,0,0,1,2,2,2,2,2,2,2,2],
    [1,1,1,1,1,1,1,2,1,0,0,1,2,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,2,1,1,1,1,1,2,2,1,1,1,1,1,2,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,3,1,2,1,2,1,2,1,1,1,1,2,1,2,1,2,1,3,1],
    [1,2,1,2,1,2,1,2,1,2,2,1,2,1,2,1,2,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],

  // Level 5 - Expert (minimal escape routes)
  [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,2,1],
    [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,1,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,1,2,2,1,1,1,2,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,1,0,0,1,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,2,1,0,0,1,2,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,1,0,0,1,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,1,2,2,1,1,1,2,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,1,1,1,1,1,1,2,1,1,1,1,1],
    [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,2,1,1,1,1,1,1,1,2,2,1,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ]
]

// Generate advanced maze layouts for levels 6-10
const generateAdvancedMaze = (level: number) => {
  const baseMaze = MAZES[Math.min(4, level - 1)]
  const maze = baseMaze.map(row => [...row])

  // Add more complexity for higher levels
  const complexity = Math.min(level - 5, 8)
  const wallDensity = 0.1 + (level - 6) * 0.05

  for (let i = 0; i < complexity * 3; i++) {
    const x = Math.floor(Math.random() * (GRID_SIZE - 4)) + 2
    const y = Math.floor(Math.random() * (GRID_SIZE - 4)) + 2

    // Add walls strategically to create more challenging paths
    if (maze[y][x] === 2 && Math.random() < wallDensity) {
      // Check if adding wall doesn't block all paths
      const neighbors = [
        maze[y-1][x], maze[y+1][x], maze[y][x-1], maze[y][x+1]
      ]
      const openNeighbors = neighbors.filter(n => n !== 1).length

      if (openNeighbors >= 2) {
        maze[y][x] = 1 // Add wall
      }
    }
  }

  // Ensure there are still power pellets
  let powerPelletCount = 0
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (maze[y][x] === 3) powerPelletCount++
    }
  }

  // Add power pellets if too few
  while (powerPelletCount < 2) {
    const x = Math.floor(Math.random() * GRID_SIZE)
    const y = Math.floor(Math.random() * GRID_SIZE)
    if (maze[y][x] === 2) {
      maze[y][x] = 3
      powerPelletCount++
    }
  }

  return maze
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
    powerUps: [],
    score: 0,
    lives: 3,
    level: 1,
    gameStatus: 'pregame',
    powerMode: false,
    powerModeTimer: 0,
    activePowerUps: [],
    gameSpeed: BASE_GAME_SPEED,
    highScore: 0,
    totalPlayers: 0,
    totalPlays: 0,
    userOnChainScore: null,
    onChainScores: [],
    showLeaderboard: false,
    levelStartTime: Date.now(),
    levelBonus: 0,
    combo: 0,
    maxCombo: 0,
    ghostsEaten: 0,
    totalPellets: 0,
    pelletsEaten: 0,
    timeBonus: 0,
    perfectLevel: true
  })

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager()
  }, [])

  // Initialize ghosts based on level with enhanced AI
  const initializeGhosts = useCallback((level: number): Ghost[] => {
    const baseGhosts = [
      { 
        id: 1, 
        position: { x: 9, y: 9 }, 
        direction: { x: 1, y: 0 }, 
        lastDirection: { x: 1, y: 0 },
        color: COLORS.MONAD_BERRY, 
        vulnerable: false, 
        type: 'blinky' as const, 
        scatterTarget: { x: 18, y: 0 }, 
        eaten: false, 
        speed: 1, 
        mode: 'chase' as const, 
        modeTimer: 0 
      },
      { 
        id: 2, 
        position: { x: 10, y: 9 }, 
        direction: { x: -1, y: 0 }, 
        lastDirection: { x: -1, y: 0 },
        color: COLORS.MONAD_PURPLE, 
        vulnerable: false, 
        type: 'pinky' as const, 
        scatterTarget: { x: 1, y: 0 }, 
        eaten: false, 
        speed: 1, 
        mode: 'chase' as const, 
        modeTimer: 0 
      },
      { 
        id: 3, 
        position: { x: 9, y: 10 }, 
        direction: { x: 0, y: 1 }, 
        lastDirection: { x: 0, y: 1 },
        color: COLORS.MONAD_BLUE, 
        vulnerable: false, 
        type: 'inky' as const, 
        scatterTarget: { x: 18, y: 18 }, 
        eaten: false, 
        speed: 1, 
        mode: 'chase' as const, 
        modeTimer: 0 
      },
      { 
        id: 4, 
        position: { x: 10, y: 10 }, 
        direction: { x: 0, y: -1 }, 
        lastDirection: { x: 0, y: -1 },
        color: COLORS.MONAD_OFF_WHITE, 
        vulnerable: false, 
        type: 'clyde' as const, 
        scatterTarget: { x: 1, y: 18 }, 
        eaten: false, 
        speed: 1, 
        mode: 'chase' as const, 
        modeTimer: 0 
      }
    ]

    // Add more ghosts for higher levels
    if (level >= 3) {
      baseGhosts.push({
        id: 5, 
        position: { x: 8, y: 9 }, 
        direction: { x: 1, y: 0 }, 
        lastDirection: { x: 1, y: 0 },
        color: COLORS.ORANGE, 
        vulnerable: false, 
        type: 'sue' as const, 
        scatterTarget: { x: 0, y: 9 }, 
        eaten: false, 
        speed: 1.2, 
        mode: 'chase' as const, 
        modeTimer: 0
      })
    }

    if (level >= 5) {
      baseGhosts.push({
        id: 6, 
        position: { x: 11, y: 10 }, 
        direction: { x: -1, y: 0 }, 
        lastDirection: { x: -1, y: 0 },
        color: COLORS.GREEN, 
        vulnerable: false, 
        type: 'funky' as const, 
        scatterTarget: { x: 19, y: 9 }, 
        eaten: false, 
        speed: 1.5, 
        mode: 'chase' as const, 
        modeTimer: 0
      })
    }

    // Increase ghost speed and intelligence based on level
    return baseGhosts.map(ghost => ({
      ...ghost,
      speed: ghost.speed + (level - 1) * 0.15,
      modeTimer: Math.floor(Math.random() * 50) + 20 // Random initial mode timer
    }))
  }, [])

  // Generate enhanced power-ups with level scaling
  const generatePowerUps = useCallback((level: number): PowerUp[] => {
    const powerUps: PowerUp[] = []
    const powerUpTypes: PowerUp['type'][] = ['speed', 'freeze', 'double', 'shield', 'bonus', 'life']
    const numPowerUps = Math.min(Math.floor(level / 2) + 1, 4)

    for (let i = 0; i < numPowerUps; i++) {
      let x, y
      let attempts = 0
      do {
        x = Math.floor(Math.random() * GRID_SIZE)
        y = Math.floor(Math.random() * GRID_SIZE)
        attempts++
      } while (getCurrentMaze(level)[y][x] !== 0 && attempts < 50)

      if (attempts < 50) {
        const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]
        powerUps.push({
          position: { x, y },
          type,
          color: type === 'speed' ? COLORS.YELLOW : 
                 type === 'freeze' ? COLORS.CYAN :
                 type === 'double' ? COLORS.GREEN :
                 type === 'shield' ? COLORS.ORANGE : 
                 type === 'life' ? COLORS.MONAD_PURPLE : COLORS.RED,
          points: 100 + level * 50,
          duration: ['speed', 'freeze', 'shield'].includes(type) ? 80 + level * 10 : undefined,
          active: true
        })
      }
    }

    return powerUps
  }, [])

  // Get current maze based on level
  const getCurrentMaze = useCallback((level: number) => {
    if (level <= 5) {
      return MAZES[level - 1]
    }
    return generateAdvancedMaze(level)
  }, [])

  // Enhanced ghost AI with better pathfinding
  const calculateGhostTarget = useCallback((ghost: Ghost, gameState: GameState) => {
    const { pacmon, pacmonDirection, ghosts, level } = gameState

    if (ghost.mode === 'frightened' || ghost.vulnerable) {
      // Run away from Pacman
      const dx = ghost.position.x - pacmon.x
      const dy = ghost.position.y - pacmon.y
      return {
        x: ghost.position.x + (dx > 0 ? 3 : -3),
        y: ghost.position.y + (dy > 0 ? 3 : -3)
      }
    }

    if (ghost.mode === 'scatter') {
      return ghost.scatterTarget
    }

    // Enhanced chase behavior based on ghost type
    switch (ghost.type) {
      case 'blinky':
        // Direct chase with speed boost at higher levels
        return level >= 4 ? {
          x: pacmon.x + pacmonDirection.x,
          y: pacmon.y + pacmonDirection.y
        } : pacmon

      case 'pinky':
        // Ambush 4 tiles ahead of Pacman
        return {
          x: pacmon.x + pacmonDirection.x * 4,
          y: pacmon.y + pacmonDirection.y * 4
        }

      case 'inky':
        // Complex behavior based on Blinky and Pacman
        const blinky = ghosts.find(g => g.type === 'blinky')
        if (blinky) {
          const pacmanTwoAhead = {
            x: pacmon.x + pacmonDirection.x * 2,
            y: pacmon.y + pacmonDirection.y * 2
          }
          const vector = {
            x: pacmanTwoAhead.x - blinky.position.x,
            y: pacmanTwoAhead.y - blinky.position.y
          }
          return { 
            x: blinky.position.x + vector.x * 2, 
            y: blinky.position.y + vector.y * 2 
          }
        }
        return pacmon

      case 'clyde':
        // Scatter if close to Pacman, else chase
        const distance = Math.sqrt(
          Math.pow(ghost.position.x - pacmon.x, 2) +
          Math.pow(ghost.position.y - pacmon.y, 2)
        )
        return distance < 8 ? ghost.scatterTarget : pacmon

      case 'sue':
        // Patrol behavior - the corners
        const corners = [
          { x: 1, y: 1 }, { x: 18, y: 1 }, { x: 1, y: 18 }, { x: 18, y: 18 }
        ]
        const nearestCorner = corners.reduce((nearest, corner) => {
          const dist = Math.abs(corner.x - pacmon.x) + Math.abs(corner.y - pacmon.y)
          const nearestDist = Math.abs(nearest.x - pacmon.x) + Math.abs(nearest.y - pacmon.y)
          return dist < nearestDist ? corner : nearest
        })
        return nearestCorner

      case 'funky':
        // Unpredictable behavior - sometimes chase, sometimes random
        return Math.random() > 0.3 ? pacmon : {
          x: Math.floor(Math.random() * GRID_SIZE),
          y: Math.floor(Math.random() * GRID_SIZE)
        }

      default:
        return pacmon
    }
  }, [])

  // Load on-chain scores with enhanced data
  const loadOnChainScores = useCallback(async () => {
    if (!publicClient || !address) return

    try {
      // Enhanced mock on-chain scores with level progression
      const mockOnChainScores: OnChainScore[] = [
        { address: '0x1234567890123456789012345678901234567890', score: 25450, level: 10, timestamp: Date.now() - 86400000 },
        { address: '0x9876543210987654321098765432109876543210', score: 18890, level: 8, timestamp: Date.now() - 172800000 },
        { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', score: 15650, level: 7, timestamp: Date.now() - 259200000 },
        { address: '0x1111222233334444555566667777888899990000', score: 12420, level: 6, timestamp: Date.now() - 345600000 },
        { address: '0x0000999988887777666655554444333322221111', score: 9200, level: 5, timestamp: Date.now() - 432000000 },
        { address: '0x2222333344445555666677778888999900001111', score: 7800, level: 4, timestamp: Date.now() - 518400000 },
        { address: '0x3333444455556666777788889999000011112222', score: 5600, level: 3, timestamp: Date.now() - 604800000 }
      ]

      // Find user's on-chain score
      const userScore = mockOnChainScores.find(score => 
        score.address.toLowerCase() === address.toLowerCase()
      )

      setGameState(prev => ({
        ...prev,
        onChainScores: mockOnChainScores.sort((a, b) => b.score - a.score),
        userOnChainScore: userScore?.score || null,
        highScore: mockOnChainScores[0]?.score || 0,
        totalPlayers: mockOnChainScores.length,
        totalPlays: mockOnChainScores.length * 3 // Estimate
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

  // Initialize level with enhanced features
  const initializeLevel = useCallback((level: number) => {
    const maze = getCurrentMaze(level)
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

    const ghosts = initializeGhosts(level)
    const powerUps = generatePowerUps(level)
    const gameSpeed = Math.max(MIN_GAME_SPEED, BASE_GAME_SPEED - (level - 1) * 12)

    setGameState(prev => ({
      ...prev,
      pellets,
      powerPellets,
      powerUps,
      ghosts,
      gameSpeed,
      levelStartTime: Date.now(),
      levelBonus: 0,
      combo: 0,
      activePowerUps: [],
      totalPellets: pellets.length + powerPellets.length,
      pelletsEaten: 0,
      ghostsEaten: 0,
      perfectLevel: true,
      timeBonus: 0
    }))

    // Play level start sound
    soundManagerRef.current?.play('levelStart')
  }, [getCurrentMaze, initializeGhosts, generatePowerUps])

  // Initialize first level
  useEffect(() => {
    initializeLevel(1)
  }, [initializeLevel])

  // Calculate level completion bonus
  const calculateLevelBonus = useCallback((gameState: GameState) => {
    const timeElapsed = (Date.now() - gameState.levelStartTime) / 1000
    const timeBonus = Math.max(0, Math.floor((120 - timeElapsed) * 10)) // Bonus for completing quickly
    const comboBonus = gameState.maxCombo * 50
    const perfectBonus = gameState.perfectLevel ? 1000 * gameState.level : 0
    const ghostBonus = gameState.ghostsEaten * 200

    return timeBonus + comboBonus + perfectBonus + ghostBonus
  }, [])

  // Level transition logic
  const handleLevelComplete = useCallback(() => {
    setGameState(prev => {
      const levelBonus = calculateLevelBonus(prev)
      const newLevel = Math.min(prev.level + 1, MAX_LEVELS)

      return {
        ...prev,
        gameStatus: 'levelTransition',
        levelBonus,
        score: prev.score + levelBonus,
        level: newLevel
      }
    })

    soundManagerRef.current?.play('levelComplete')

    // Transition to next level after delay
    setTimeout(() => {
      setGameState(prev => {
        if (prev.level >= MAX_LEVELS) {
          return { ...prev, gameStatus: 'postGame' }
        }

        initializeLevel(prev.level)
        return { ...prev, gameStatus: 'playing' }
      })
    }, 3000)
  }, [calculateLevelBonus, initializeLevel])


  // Enhanced game loop with dynamic speed and advanced mechanics
  useEffect(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
    }

    gameLoopRef.current = setInterval(() => {
      if (gameState.gameStatus === 'playing') {
        setGameState(prev => {
          let newState = { ...prev }

          // Update active power-ups
          newState.activePowerUps = newState.activePowerUps
            .map(powerUp => ({ ...powerUp, timer: powerUp.timer - 1 }))
            .filter(powerUp => powerUp.timer > 0)

          // Check for active power-up effects
          const hasSpeedBoost = newState.activePowerUps.some(p => p.type === 'speed')
          const hasFreezeBoost = newState.activePowerUps.some(p => p.type === 'freeze')
          const hasShield = newState.activePowerUps.some(p => p.type === 'shield')
          const hasDouble = newState.activePowerUps.some(p => p.type === 'double')

          // Enhanced Pacmon movement with speed boost
          const moveSpeed = hasSpeedBoost ? 2 : 1
          let newPacmonPos = {
            x: newState.pacmon.x + (newState.pacmonDirection.x * moveSpeed),
            y: newState.pacmon.y + (newState.pacmonDirection.y * moveSpeed)
          }

          // Boundary wrapping for horizontal movement
          if (newPacmonPos.x < 0) newPacmonPos.x = GRID_SIZE - 1
          if (newPacmonPos.x >= GRID_SIZE) newPacmonPos.x = 0

          // Check for wall collision
          const currentMaze = getCurrentMaze(newState.level)
          if (newPacmonPos.y >= 0 && newPacmonPos.y < GRID_SIZE &&
              currentMaze[newPacmonPos.y][newPacmonPos.x] !== 1) {
            newState.pacmon = newPacmonPos

            // Enhanced pellet collection with combo system
            const pelletIndex = newState.pellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (pelletIndex !== -1) {
              newState.pellets = newState.pellets.filter((_, index) => index !== pelletIndex)
              const basePoints = hasDouble ? 20 : 10
              const comboMultiplier = Math.min(Math.floor(newState.combo / 5) + 1, 5)
              const points = basePoints * comboMultiplier

              newState.score += points
              newState.combo += 1
              newState.maxCombo = Math.max(newState.maxCombo, newState.combo)
              newState.pelletsEaten += 1

              // Play combo sound for high combos
              if (newState.combo > 0 && newState.combo % 10 === 0) {
                soundManagerRef.current?.play('combo')
              } else {
                soundManagerRef.current?.play('pelletEat')
              }
            }

            // Enhanced power pellet collection
            const powerPelletIndex = newState.powerPellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (powerPelletIndex !== -1) {
              newState.powerPellets = newState.powerPellets.filter((_, index) => index !== powerPelletIndex)
              const basePoints = hasDouble ? 100 : 50
              const levelMultiplier = newState.level
              const points = basePoints * levelMultiplier

              newState.score += points
              newState.powerMode = true
              newState.powerModeTimer = 40 + newState.level * 8 // Longer power mode at higher levels
              newState.combo += 3
              newState.maxCombo = Math.max(newState.maxCombo, newState.combo)
              newState.pelletsEaten += 1

              // Make all ghosts vulnerable
              newState.ghosts = newState.ghosts.map(ghost => ({
                ...ghost,
                vulnerable: true,
                mode: 'frightened'
              }))

              soundManagerRef.current?.play('powerPellet')
            }

            // Enhanced power-up collection
            const powerUpIndex = newState.powerUps.findIndex(
              powerUp => powerUp.position.x === newState.pacmon.x && 
                        powerUp.position.y === newState.pacmon.y && 
                        powerUp.active
            )
            if (powerUpIndex !== -1) {
              const powerUp = newState.powerUps[powerUpIndex]
              newState.powerUps = newState.powerUps.map((pu, index) => 
                index === powerUpIndex ? { ...pu, active: false } : pu
              )

              newState.score += powerUp.points

              // Apply power-up effects
              switch (powerUp.type) {
                case 'speed':
                case 'freeze':
                case 'shield':
                  if (powerUp.duration) {
                    newState.activePowerUps.push({ type: powerUp.type, timer: powerUp.duration })
                  }
                  break
                case 'double':
                  newState.activePowerUps.push({ type: 'double', timer: 100 })
                  break
                case 'bonus':
                  newState.score += 1000 * newState.level
                  soundManagerRef.current?.play('bonus')
                  break
                case 'life':
                  newState.lives = Math.min(newState.lives + 1, 5)
                  break
              }

              soundManagerRef.current?.play('powerUp')
            }
          } else {
            // Stop Pacmon if hits a wall
            newState.pacmonDirection = { x: 0, y: 0 }
          }

          // Enhanced ghost movement with improved AI
          if (!hasFreezeBoost) {
            newState.ghosts = newState.ghosts.map(ghost => {
              // Update ghost mode timer
              ghost.modeTimer -= 1
              if (ghost.modeTimer <= 0) {
                // Switch between chase and scatter modes
                if (ghost.mode === 'chase') {
                  ghost.mode = 'scatter'
                  ghost.modeTimer = 30 + Math.floor(Math.random() * 20)
                } else if (ghost.mode === 'scatter') {
                  ghost.mode = 'chase'
                  ghost.modeTimer = 100 + Math.floor(Math.random() * 50)
                }
              }

              if (ghost.eaten) {
                // Eaten ghosts return to ghost house faster
                const target = { x: 9, y: 9 }
                if (ghost.position.x === target.x && ghost.position.y === target.y) {
                  return { 
                    ...ghost, 
                    eaten: false, 
                    vulnerable: false, 
                    mode: 'chase',
                    modeTimer: 50 
                  }
                }

                // Enhanced pathfinding back to ghost house
                const dx = target.x - ghost.position.x
                const dy = target.y - ghost.position.y
                let newDirection = { x: 0, y: 0 }

                if (Math.abs(dx) > Math.abs(dy)) {
                  newDirection.x = dx > 0 ? 1 : -1
                } else {
                  newDirection.y = dy > 0 ? 1 : -1
                }

                const newPos = {
                  x: Math.max(0, Math.min(GRID_SIZE - 1, ghost.position.x + newDirection.x)),
                  y: Math.max(0, Math.min(GRID_SIZE - 1, ghost.position.y + newDirection.y))
                }

                return { 
                  ...ghost, 
                  direction: newDirection, 
                  position: newPos,
                  lastDirection: newDirection
                }
              }

              // Calculate target based on enhanced AI
              const targetTile = calculateGhostTarget(ghost, newState)

              // Enhanced pathfinding with look-ahead
              const possibleDirections = [
                { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
              ]

              let bestDirection = ghost.direction
              let minDistance = Infinity

              // Avoid reversing direction unless necessary
              const validDirections = possibleDirections.filter(dir => {
                const nextPos = { 
                  x: ghost.position.x + dir.x, 
                  y: ghost.position.y + dir.y 
                }

                // Check bounds and walls
                if (nextPos.x < 0 || nextPos.x >= GRID_SIZE || 
                    nextPos.y < 0 || nextPos.y >= GRID_SIZE ||
                    currentMaze[nextPos.y][nextPos.x] === 1) {
                  return false
                }

                // Avoid immediate reversal unless it's the only option
                const isReverse = dir.x === -ghost.lastDirection.x && dir.y === -ghost.lastDirection.y
                return !isReverse
              })

              const directionsToCheck = validDirections.length > 0 ? validDirections : possibleDirections.filter(dir => {
                const nextPos = { 
                  x: ghost.position.x + dir.x, 
                  y: ghost.position.y + dir.y 
                }
                return nextPos.x >= 0 && nextPos.x < GRID_SIZE && 
                       nextPos.y >= 0 && nextPos.y < GRID_SIZE &&
                       currentMaze[nextPos.y][nextPos.x] !== 1
              })

              directionsToCheck.forEach(dir => {
                const nextPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }

                // Calculate distance to target with some randomness for variety
                let distance = Math.sqrt(
                  Math.pow(nextPos.x - targetTile.x, 2) +
                  Math.pow(nextPos.y - targetTile.y, 2)
                )

                // Add slight randomness to prevent predictable behavior
                distance += (Math.random() - 0.5) * 0.5

                // Prefer continuing in the same direction (momentum)
                if (dir.x === ghost.direction.x && dir.y === ghost.direction.y) {
                  distance -= 0.3
                }

                if (distance < minDistance) {
                  minDistance = distance
                  bestDirection = dir
                }
              })

              // Apply ghost speed with level scaling
              const ghostSpeed = ghost.speed * (1 + (newState.level - 1) * 0.1)
              const shouldMove = Math.random() < ghostSpeed

              if (shouldMove) {
                const newPos = {
                  x: Math.max(0, Math.min(GRID_SIZE - 1, ghost.position.x + bestDirection.x)),
                  y: Math.max(0, Math.min(GRID_SIZE - 1, ghost.position.y + bestDirection.y))
                }

                return { 
                  ...ghost, 
                  direction: bestDirection, 
                  position: newPos,
                  lastDirection: bestDirection,
                  vulnerable: newState.powerMode && !ghost.eaten
                }
              }

              return { 
                ...ghost, 
                vulnerable: newState.powerMode && !ghost.eaten 
              }
            })
          }

          // Enhanced ghost collision detection
          newState.ghosts.forEach(ghost => {
            if (ghost.position.x === newState.pacmon.x && ghost.position.y === newState.pacmon.y) {
              if (ghost.vulnerable && !ghost.eaten) {
                // Eat ghost with enhanced scoring
                const ghostPoints = 200 * Math.pow(2, newState.ghostsEaten) // Exponential scoring
                newState.score += ghostPoints
                newState.ghostsEaten += 1
                newState.combo += 5
                newState.maxCombo = Math.max(newState.maxCombo, newState.combo)

                ghost.eaten = true
                ghost.vulnerable = false
                ghost.mode = 'chase'

                soundManagerRef.current?.play('ghostEat')
              } else if (!ghost.eaten && !hasShield) {
                // Lose life
                newState.lives -= 1
                newState.combo = 0 // Reset combo on death
                newState.perfectLevel = false

                // Reset positions
                newState.pacmon = { x: 9, y: 15 }
                newState.pacmonDirection = { x: 0, y: 0 }
                newState.ghosts = newState.ghosts.map(g => ({ 
                  ...g, 
                  position: { x: 9 + (g.id - 1) % 2, y: 9 + Math.floor((g.id - 1) / 2) }, 
                  direction: { x: g.id % 2 === 0 ? -1 : 1, y: 0 }, 
                  vulnerable: false, 
                  eaten: false,
                  mode: 'chase',
                  modeTimer: 50
                }))

                // Clear power mode and active power-ups
                newState.powerMode = false
                newState.powerModeTimer = 0
                newState.activePowerUps = []

                soundManagerRef.current?.play('death')

                if (newState.lives <= 0) {
                  newState.gameStatus = 'postGame'
                  soundManagerRef.current?.stopBackgroundMusic()
                  soundManagerRef.current?.play('gameOver')
                }
              }
            }
          })

          // Enhanced power mode timer
          if (newState.powerMode) {
            newState.powerModeTimer -= 1
            if (newState.powerModeTimer <= 0) {
              newState.powerMode = false
              newState.ghosts = newState.ghosts.map(ghost => ({ 
                ...ghost, 
                vulnerable: false,
                mode: ghost.eaten ? 'chase' : ghost.mode
              }))
            }
          }

          // Check level complete with enhanced conditions
          const totalItems = newState.pellets.length + newState.powerPellets.length
          if (totalItems === 0) {
            handleLevelComplete()
          }

          // Update time bonus
          const timeElapsed = (Date.now() - newState.levelStartTime) / 1000
          newState.timeBonus = Math.max(0, Math.floor((120 - timeElapsed) * 10))

          return newState
        })
      }
    }, gameState.gameSpeed)

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState.gameStatus, gameState.gameSpeed, getCurrentMaze, calculateGhostTarget, handleLevelComplete])

  // Enhanced keyboard input handling
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState.gameStatus !== 'playing') return

    const { key } = event
    let newDirection = { x: 0, y: 0 }

    switch (key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        newDirection.y = -1
        break
      case 'arrowdown':
      case 's':
        newDirection.y = 1
        break
      case 'arrowleft':
      case 'a':
        newDirection.x = -1
        break
      case 'arrowright':
      case 'd':
        newDirection.x = 1
        break
      case ' ':
      case 'p':
        // Pause/unpause game
        setGameState(prev => ({
          ...prev,
          gameStatus: prev.gameStatus === 'playing' ? 'paused' : 'playing'
        }))
        return
      case 'm':
        // Toggle sound
        soundManagerRef.current?.toggleSounds()
        return
      default:
        return
    }

    // Enhanced movement validation with look-ahead
    const currentMaze = getCurrentMaze(gameState.level)
    const nextX = gameState.pacmon.x + newDirection.x
    const nextY = gameState.pacmon.y + newDirection.y

    // Handle horizontal wrapping
    const wrappedX = nextX < 0 ? GRID_SIZE - 1 : nextX >= GRID_SIZE ? 0 : nextX

    if (nextY >= 0 && nextY < GRID_SIZE && currentMaze[nextY][wrappedX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.level, getCurrentMaze])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])


  // Enhanced rendering with animations and visual effects
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Animation frame counter for smooth animations
    const animationFrame = Date.now() / 100

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, GAME_WIDTH, GAME_HEIGHT)
    gradient.addColorStop(0, COLORS.MONAD_BLACK)
    gradient.addColorStop(1, '#1a1a2e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Get current maze
    const currentMaze = getCurrentMaze(gameState.level)

    // Enhanced maze rendering with glow effects
    ctx.shadowBlur = 10
    ctx.shadowColor = COLORS.MONAD_BLUE
    ctx.fillStyle = COLORS.MONAD_BLUE

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (currentMaze[y][x] === 1) {
          // Animated wall with subtle glow
          const glowIntensity = 0.8 + 0.2 * Math.sin(animationFrame * 0.5)
          ctx.shadowBlur = 5 * glowIntensity

          // Rounded corners for walls
          const cornerRadius = 3
          const wallX = x * CELL_SIZE
          const wallY = y * CELL_SIZE

          ctx.beginPath()
          ctx.roundRect(wallX, wallY, CELL_SIZE, CELL_SIZE, cornerRadius)
          ctx.fill()
        }
      }
    }
    ctx.shadowBlur = 0

    // Enhanced pellet rendering with pulsing animation
    gameState.pellets.forEach(pellet => {
      const pulseScale = 1 + 0.3 * Math.sin(animationFrame * 2)
      const pelletSize = 2 * pulseScale

      ctx.fillStyle = COLORS.MONAD_OFF_WHITE
      ctx.shadowBlur = 3
      ctx.shadowColor = COLORS.MONAD_OFF_WHITE

      ctx.beginPath()
      ctx.arc(
        pellet.x * CELL_SIZE + CELL_SIZE / 2,
        pellet.y * CELL_SIZE + CELL_SIZE / 2,
        pelletSize,
        0,
        2 * Math.PI
      )
      ctx.fill()
    })

    // Enhanced power pellet rendering with rotating glow
    gameState.powerPellets.forEach(pellet => {
      const rotationAngle = animationFrame * 0.5
      const glowSize = 8 + 4 * Math.sin(animationFrame)

      // Outer glow
      const glowGradient = ctx.createRadialGradient(
        pellet.x * CELL_SIZE + CELL_SIZE / 2,
        pellet.y * CELL_SIZE + CELL_SIZE / 2,
        0,
        pellet.x * CELL_SIZE + CELL_SIZE / 2,
        pellet.y * CELL_SIZE + CELL_SIZE / 2,
        glowSize
      )
      glowGradient.addColorStop(0, COLORS.MONAD_PURPLE)
      glowGradient.addColorStop(0.5, `${COLORS.MONAD_PURPLE}80`)
      glowGradient.addColorStop(1, 'transparent')

      ctx.fillStyle = glowGradient
      ctx.beginPath()
      ctx.arc(
        pellet.x * CELL_SIZE + CELL_SIZE / 2,
        pellet.y * CELL_SIZE + CELL_SIZE / 2,
        glowSize,
        0,
        2 * Math.PI
      )
      ctx.fill()

      // Inner pellet with rotation effect
      ctx.save()
      ctx.translate(
        pellet.x * CELL_SIZE + CELL_SIZE / 2,
        pellet.y * CELL_SIZE + CELL_SIZE / 2
      )
      ctx.rotate(rotationAngle)

      ctx.fillStyle = COLORS.MONAD_PURPLE
      ctx.shadowBlur = 5
      ctx.shadowColor = COLORS.MONAD_PURPLE

      ctx.beginPath()
      ctx.arc(0, 0, 6, 0, 2 * Math.PI)
      ctx.fill()

      // Add sparkle effect
      for (let i = 0; i < 4; i++) {
        const sparkleAngle = (i * Math.PI / 2) + rotationAngle
        const sparkleX = Math.cos(sparkleAngle) * 8
        const sparkleY = Math.sin(sparkleAngle) * 8

        ctx.fillStyle = COLORS.WHITE
        ctx.beginPath()
        ctx.arc(sparkleX, sparkleY, 1, 0, 2 * Math.PI)
        ctx.fill()
      }

      ctx.restore()
    })

    // Enhanced power-up rendering with unique effects
    gameState.powerUps.forEach(powerUp => {
      if (!powerUp.active) return

      const centerX = powerUp.position.x * CELL_SIZE + CELL_SIZE / 2
      const centerY = powerUp.position.y * CELL_SIZE + CELL_SIZE / 2

      // Power-up specific animations
      switch (powerUp.type) {
        case 'speed':
          // Lightning bolt effect
          ctx.strokeStyle = COLORS.YELLOW
          ctx.lineWidth = 2
          ctx.shadowBlur = 5
          ctx.shadowColor = COLORS.YELLOW

          ctx.beginPath()
          ctx.moveTo(centerX - 4, centerY - 6)
          ctx.lineTo(centerX + 2, centerY - 2)
          ctx.lineTo(centerX - 2, centerY)
          ctx.lineTo(centerX + 4, centerY + 6)
          ctx.stroke()
          break

        case 'freeze':
          // Snowflake effect
          ctx.strokeStyle = COLORS.CYAN
          ctx.lineWidth = 2
          ctx.shadowBlur = 5
          ctx.shadowColor = COLORS.CYAN

          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI / 3) + animationFrame * 0.2
            ctx.beginPath()
            ctx.moveTo(centerX, centerY)
            ctx.lineTo(
              centerX + Math.cos(angle) * 6,
              centerY + Math.sin(angle) * 6
            )
            ctx.stroke()
          }
          break

        case 'double':
          // Double coin effect
          ctx.fillStyle = COLORS.GREEN
          ctx.shadowBlur = 5
          ctx.shadowColor = COLORS.GREEN

          ctx.beginPath()
          ctx.arc(centerX - 2, centerY, 4, 0, 2 * Math.PI)
          ctx.fill()

          ctx.beginPath()
          ctx.arc(centerX + 2, centerY, 4, 0, 2 * Math.PI)
          ctx.fill()
          break

        case 'shield':
          // Shield effect
          ctx.fillStyle = COLORS.ORANGE
          ctx.shadowBlur = 5
          ctx.shadowColor = COLORS.ORANGE

          ctx.beginPath()
          ctx.moveTo(centerX, centerY - 6)
          ctx.lineTo(centerX - 5, centerY - 2)
          ctx.lineTo(centerX - 5, centerY + 4)
          ctx.lineTo(centerX, centerY + 6)
          ctx.lineTo(centerX + 5, centerY + 4)
          ctx.lineTo(centerX + 5, centerY - 2)
          ctx.closePath()
          ctx.fill()
          break

        case 'bonus':
          // Star effect
          ctx.fillStyle = COLORS.RED
          ctx.shadowBlur = 8
          ctx.shadowColor = COLORS.RED

          ctx.save()
          ctx.translate(centerX, centerY)
          ctx.rotate(animationFrame * 0.3)

          ctx.beginPath()
          for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI / 5) - Math.PI / 2
            const x = Math.cos(angle) * 6
            const y = Math.sin(angle) * 6
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)

            const innerAngle = angle + Math.PI / 5
            const innerX = Math.cos(innerAngle) * 3
            const innerY = Math.sin(innerAngle) * 3
            ctx.lineTo(innerX, innerY)
          }
          ctx.closePath()
          ctx.fill()
          ctx.restore()
          break

        case 'life':
          // Heart effect
          ctx.fillStyle = COLORS.MONAD_PURPLE
          ctx.shadowBlur = 5
          ctx.shadowColor = COLORS.MONAD_PURPLE

          ctx.save()
          ctx.translate(centerX, centerY)
          ctx.scale(0.8, 0.8)

          ctx.beginPath()
          ctx.moveTo(0, 3)
          ctx.bezierCurveTo(-5, -2, -10, 1, -5, 6)
          ctx.bezierCurveTo(0, 10, 0, 10, 0, 10)
          ctx.bezierCurveTo(0, 10, 0, 10, 5, 6)
          ctx.bezierCurveTo(10, 1, 5, -2, 0, 3)
          ctx.fill()
          ctx.restore()
          break
      }
    })

    // Enhanced Pacmon rendering with mouth animation
    const mouthAngle = Math.sin(animationFrame * 3) * 0.5 + 0.5
    const pacmonRadius = CELL_SIZE / 2 - 2

    // Pacmon glow effect
    const pacmonGradient = ctx.createRadialGradient(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2,
      0,
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2,
      pacmonRadius + 5
    )
    pacmonGradient.addColorStop(0, COLORS.MONAD_PURPLE)
    pacmonGradient.addColorStop(0.7, COLORS.MONAD_PURPLE)
    pacmonGradient.addColorStop(1, `${COLORS.MONAD_PURPLE}40`)

    ctx.fillStyle = pacmonGradient
    ctx.beginPath()
    ctx.arc(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2,
      pacmonRadius + 3,
      0,
      2 * Math.PI
    )
    ctx.fill()

    // Pacmon body with direction-based rotation
    ctx.save()
    ctx.translate(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2
    )

    // Rotate based on direction
    if (gameState.pacmonDirection.x > 0) ctx.rotate(0)
    else if (gameState.pacmonDirection.x < 0) ctx.rotate(Math.PI)
    else if (gameState.pacmonDirection.y > 0) ctx.rotate(Math.PI / 2)
    else if (gameState.pacmonDirection.y < 0) ctx.rotate(-Math.PI / 2)

    ctx.fillStyle = COLORS.MONAD_PURPLE
    ctx.shadowBlur = 3
    ctx.shadowColor = COLORS.MONAD_PURPLE

    ctx.beginPath()
    ctx.arc(0, 0, pacmonRadius, 0.2 * Math.PI * mouthAngle, (2 - 0.2 * mouthAngle) * Math.PI)
    ctx.lineTo(0, 0)
    ctx.fill()

    // Pacmon eye
    ctx.fillStyle = COLORS.WHITE
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.arc(-3, -5, 2, 0, 2 * Math.PI)
    ctx.fill()

    ctx.fillStyle = COLORS.MONAD_BLACK
    ctx.beginPath()
    ctx.arc(-2, -5, 1, 0, 2 * Math.PI)
    ctx.fill()

    ctx.restore()

    // Enhanced ghost rendering with animations
    gameState.ghosts.forEach(ghost => {
      const ghostX = ghost.position.x * CELL_SIZE + CELL_SIZE / 2
      const ghostY = ghost.position.y * CELL_SIZE + CELL_SIZE / 2
      const ghostRadius = CELL_SIZE / 2 - 2

      // Ghost glow effect
      if (ghost.vulnerable) {
        ctx.shadowBlur = 8
        ctx.shadowColor = COLORS.MONAD_BERRY
        ctx.fillStyle = COLORS.MONAD_BERRY

        // Flashing effect when power mode is about to end
        if (gameState.powerModeTimer < 10 && Math.floor(animationFrame) % 2 === 0) {
          ctx.fillStyle = COLORS.WHITE
        }
      } else if (ghost.eaten) {
        ctx.shadowBlur = 5
        ctx.shadowColor = COLORS.CYAN
        ctx.fillStyle = 'transparent'
      } else {
        ctx.shadowBlur = 5
        ctx.shadowColor = ghost.color
        ctx.fillStyle = ghost.color
      }

      if (!ghost.eaten) {
        // Ghost body with floating animation
        const floatOffset = Math.sin(animationFrame + ghost.id) * 1

        ctx.beginPath()
        ctx.arc(ghostX, ghostY + floatOffset, ghostRadius, Math.PI, 2 * Math.PI)

        // Ghost bottom with wavy effect
        const waveHeight = 3
        const waveFreq = 4
        for (let i = 0; i <= waveFreq; i++) {
          const waveX = ghostX - ghostRadius + (i * (ghostRadius * 2) / waveFreq)
          const waveY = ghostY + floatOffset + ghostRadius + Math.sin(animationFrame * 2 + i) * waveHeight
          if (i === 0) ctx.lineTo(waveX, waveY)
          else ctx.lineTo(waveX, waveY)
        }

        ctx.closePath()
        ctx.fill()

        // Ghost eyes
        if (!ghost.vulnerable) {
          ctx.fillStyle = COLORS.WHITE
          ctx.shadowBlur = 0

          // Left eye
          ctx.beginPath()
          ctx.arc(ghostX - 4, ghostY - 3 + floatOffset, 3, 0, 2 * Math.PI)
          ctx.fill()

          // Right eye
          ctx.beginPath()
          ctx.arc(ghostX + 4, ghostY - 3 + floatOffset, 3, 0, 2 * Math.PI)
          ctx.fill()

          // Eye pupils (direction-based)
          ctx.fillStyle = COLORS.MONAD_BLACK
          const pupilOffsetX = ghost.direction.x * 1
          const pupilOffsetY = ghost.direction.y * 1

          ctx.beginPath()
          ctx.arc(ghostX - 4 + pupilOffsetX, ghostY - 3 + pupilOffsetY + floatOffset, 1.5, 0, 2 * Math.PI)
          ctx.fill()

          ctx.beginPath()
          ctx.arc(ghostX + 4 + pupilOffsetX, ghostY - 3 + pupilOffsetY + floatOffset, 1.5, 0, 2 * Math.PI)
          ctx.fill()
        } else {
          // Scared ghost eyes
          ctx.fillStyle = COLORS.WHITE
          ctx.shadowBlur = 0

          ctx.beginPath()
          ctx.arc(ghostX - 3, ghostY - 2 + floatOffset, 2, 0, 2 * Math.PI)
          ctx.fill()

          ctx.beginPath()
          ctx.arc(ghostX + 3, ghostY - 2 + floatOffset, 2, 0, 2 * Math.PI)
          ctx.fill()

          // Scared mouth
          ctx.strokeStyle = COLORS.WHITE
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(ghostX, ghostY + 2 + floatOffset, 3, 0, Math.PI)
          ctx.stroke()
        }
      } else {
        // Eaten ghost - just eyes floating back
        ctx.fillStyle = COLORS.WHITE
        ctx.shadowBlur = 2
        ctx.shadowColor = COLORS.CYAN

        ctx.beginPath()
        ctx.arc(ghostX - 3, ghostY - 2, 3, 0, 2 * Math.PI)
        ctx.fill()

        ctx.beginPath()
        ctx.arc(ghostX + 3, ghostY - 2, 3, 0, 2 * Math.PI)
        ctx.fill()

        ctx.fillStyle = COLORS.MONAD_BLACK
        ctx.shadowBlur = 0

        ctx.beginPath()
        ctx.arc(ghostX - 3, ghostY - 2, 1.5, 0, 2 * Math.PI)
        ctx.fill()

        ctx.beginPath()
        ctx.arc(ghostX + 3, ghostY - 2, 1.5, 0, 2 * Math.PI)
        ctx.fill()
      }
    })

    // Power mode visual effects
    if (gameState.powerMode) {
      ctx.save()
      ctx.globalAlpha = 0.1 + 0.1 * Math.sin(animationFrame * 4)
      ctx.fillStyle = COLORS.MONAD_PURPLE
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      ctx.restore()
    }

    // Active power-up indicators
    gameState.activePowerUps.forEach((powerUp, index) => {
      const indicatorX = 10 + index * 25
      const indicatorY = 10
      const alpha = Math.min(1, powerUp.timer / 20)

      ctx.save()
      ctx.globalAlpha = alpha

      switch (powerUp.type) {
        case 'speed':
          ctx.fillStyle = COLORS.YELLOW
          ctx.fillRect(indicatorX, indicatorY, 20, 8)
          break
        case 'freeze':
          ctx.fillStyle = COLORS.CYAN
          ctx.fillRect(indicatorX, indicatorY, 20, 8)
          break
        case 'shield':
          ctx.fillStyle = COLORS.ORANGE
          ctx.fillRect(indicatorX, indicatorY, 20, 8)
          break
        case 'double':
          ctx.fillStyle = COLORS.GREEN
          ctx.fillRect(indicatorX, indicatorY, 20, 8)
          break
      }

      ctx.restore()
    })

    // Combo indicator
    if (gameState.combo > 5) {
      ctx.fillStyle = COLORS.YELLOW
      ctx.font = 'bold 16px Arial'
      ctx.textAlign = 'center'
      ctx.shadowBlur = 3
      ctx.shadowColor = COLORS.YELLOW

      const comboScale = 1 + 0.2 * Math.sin(animationFrame * 4)
      ctx.save()
      ctx.translate(GAME_WIDTH / 2, 30)
      ctx.scale(comboScale, comboScale)
      ctx.fillText(`COMBO x${gameState.combo}`, 0, 0)
      ctx.restore()
    }

    ctx.shadowBlur = 0
  }, [gameState, getCurrentMaze])


  // Enhanced wallet connection handler
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

    // Start the game after wallet is connected and on correct chain
    setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
    soundManagerRef.current?.playBackgroundMusic()
  }

  // Enhanced score submission with level tracking
  const handleScoreSubmission = async () => {
    if (!isConnected || chainId !== monadTestnet.id || scoreSaved) {
      return
    }

    try {
      // Create enhanced transaction data for score submission
      const scoreData = toHex(gameState.score, { size: 32 })
      const levelData = toHex(gameState.level, { size: 32 })
      const timestampData = toHex(Math.floor(Date.now() / 1000), { size: 32 })
      const comboData = toHex(gameState.maxCombo, { size: 32 })

      // Send transaction to store comprehensive score data on-chain
      await sendTransaction({
        to: SCORE_CONTRACT_ADDRESS,
        value: parseEther("0.015"),
        data: `0x${scoreData.slice(2)}${levelData.slice(2)}${timestampData.slice(2)}${comboData.slice(2)}`
      })

      // Update local state to reflect the new on-chain score
      setGameState(prev => ({
        ...prev,
        userOnChainScore: prev.score,
        onChainScores: [
          { 
            address: address!, 
            score: prev.score, 
            level: prev.level,
            timestamp: Date.now() 
          },
          ...prev.onChainScores.filter(s => s.address.toLowerCase() !== address!.toLowerCase())
        ].sort((a, b) => b.score - a.score)
      }))

      setScoreSaved(true)
      soundManagerRef.current?.play('bonus')

    } catch (error) {
      console.error("Score submission failed:", error)
    }
  }

  // Enhanced game control functions
  const startGame = () => {
    if (!isConnected) {
      handleWalletConnect()
    } else if (chainId !== monadTestnet.id) {
      switchChain({ chainId: monadTestnet.id })
    } else {
      setGameState(prev => ({ 
        ...prev, 
        gameStatus: 'playing',
        levelStartTime: Date.now()
      }))
      soundManagerRef.current?.playBackgroundMusic()
    }
  }

  const restartGame = () => {
    // Reset to initial state with enhanced features
    setGameState(prev => ({
      ...prev,
      pacmon: { x: 9, y: 15 },
      pacmonDirection: { x: 0, y: 0 },
      score: 0,
      lives: 3,
      level: 1,
      gameStatus: 'playing',
      powerMode: false,
      powerModeTimer: 0,
      activePowerUps: [],
      combo: 0,
      maxCombo: 0,
      ghostsEaten: 0,
      pelletsEaten: 0,
      perfectLevel: true,
      levelStartTime: Date.now(),
      levelBonus: 0,
      timeBonus: 0
    }))

    // Reinitialize level 1
    initializeLevel(1)
    setScoreSaved(false)

    soundManagerRef.current?.playBackgroundMusic()
  }

  const pauseGame = () => {
    setGameState(prev => ({ 
      ...prev, 
      gameStatus: prev.gameStatus === 'playing' ? 'paused' : 'playing' 
    }))
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

  // Enhanced mobile controls with gesture support
  const handleDirectionPress = useCallback((direction: Position) => {
    if (gameState.gameStatus !== 'playing') return

    const currentMaze = getCurrentMaze(gameState.level)
    const nextX = gameState.pacmon.x + direction.x
    const nextY = gameState.pacmon.y + direction.y

    // Handle horizontal wrapping
    const wrappedX = nextX < 0 ? GRID_SIZE - 1 : nextX >= GRID_SIZE ? 0 : nextX

    if (nextY >= 0 && nextY < GRID_SIZE && currentMaze[nextY][wrappedX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: direction }))
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.level, getCurrentMaze])

  // Touch gesture handling for mobile
  const [touchStart, setTouchStart] = useState<Position | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return

    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStart.x
    const deltaY = touch.clientY - touchStart.y

    const minSwipeDistance = 30

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > minSwipeDistance) {
        handleDirectionPress({ x: deltaX > 0 ? 1 : -1, y: 0 })
      }
    } else {
      if (Math.abs(deltaY) > minSwipeDistance) {
        handleDirectionPress({ x: 0, y: deltaY > 0 ? 1 : -1 })
      }
    }

    setTouchStart(null)
  }, [touchStart, handleDirectionPress])

  // Enhanced UI rendering starts here
  return (
    <div 
      className="flex flex-col min-h-screen w-full" 
      style={{ backgroundColor: COLORS.MONAD_BLACK }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Enhanced Pre-game Screen */}
      {gameState.gameStatus === 'pregame' && !gameState.showLeaderboard && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6 p-4">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">
              PACMON ENHANCED
            </h1>
            <div className="text-lg md:text-xl font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
              Level-Based Pacman with Progressive Difficulty
            </div>

            {/* Game Features */}
            <div className="grid grid-cols-2 gap-4 mt-6 text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              <div className="bg-black bg-opacity-30 rounded-lg p-3">
                <div className="font-bold text-yellow-400">🎯 10 Levels</div>
                <div>Progressive difficulty</div>
              </div>
              <div className="bg-black bg-opacity-30 rounded-lg p-3">
                <div className="font-bold text-blue-400">👻 Smart AI</div>
                <div>Enhanced ghost behavior</div>
              </div>
              <div className="bg-black bg-opacity-30 rounded-lg p-3">
                <div className="font-bold text-green-400">⚡ Power-ups</div>
                <div>Speed, freeze, shield & more</div>
              </div>
              <div className="bg-black bg-opacity-30 rounded-lg p-3">
                <div className="font-bold text-purple-400">🏆 Combos</div>
                <div>Multiplier scoring system</div>
              </div>
            </div>

            {/* Current High Scores */}
            <div className="space-y-3 text-center" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              <div className="text-lg md:text-xl font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                🏆 Onchain Leaderboard
              </div>
              <div className="space-y-2 bg-black bg-opacity-30 rounded-lg p-4 max-w-md mx-auto">
                {gameState.onChainScores.slice(0, 5).map((score, index) => (
                  <div key={index} className="flex items-center justify-between text-sm md:text-base" style={{ 
                    color: index === 0 ? COLORS.YELLOW : 
                           index === 1 ? '#C0C0C0' : 
                           index === 2 ? '#CD7F32' : COLORS.MONAD_OFF_WHITE 
                  }}>
                    <span className="flex items-center">
                      <span className="text-lg mr-2">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                      </span>
                      <span className="font-mono text-xs">
                        {`${score.address.slice(0, 4)}...${score.address.slice(-4)}`}
                      </span>
                    </span>
                    <span className="font-mono font-bold">{score.score.toLocaleString()}</span>
                    <span className="text-xs bg-purple-600 px-2 py-1 rounded">L{score.level}</span>
                  </div>
                ))}
                {gameState.onChainScores.length === 0 && (
                  <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                    🎮 Be the first to save your score onchain!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User's On-Chain Score */}
          {gameState.userOnChainScore !== null && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ 
              borderColor: COLORS.MONAD_PURPLE, 
              backgroundColor: 'rgba(131, 110, 249, 0.1)' 
            }}>
              <div className="text-center space-y-2">
                <div className="text-sm font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                  🎯 Your Best Onchain Score
                </div>
                <div className="text-xl font-mono font-bold" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  {gameState.userOnChainScore.toLocaleString()}
                </div>
              </div>
            </div>
          )}

          {/* Wallet Connection Status */}
          {isConnected && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ 
              borderColor: COLORS.GREEN, 
              backgroundColor: 'rgba(0, 255, 0, 0.1)' 
            }}>
              <div className="text-center space-y-2">
                <div className="text-sm font-semibold" style={{ color: COLORS.GREEN }}>
                  ✅ Wallet Connected
                </div>
                <div className="text-xs font-mono" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  {address?.slice(0, 8)}...{address?.slice(-6)}
                </div>
                <div className="text-xs" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  {chainId === monadTestnet.id ? '🟢 Monad Testnet' : '🔴 Switch to Monad Testnet'}
                </div>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="w-full max-w-md space-y-4 px-4">
            <button
              onClick={startGame}
              className="w-full py-6 px-8 text-xl md:text-2xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
              style={{ 
                backgroundColor: COLORS.MONAD_BERRY, 
                color: COLORS.WHITE,
                boxShadow: `0 4px 15px ${COLORS.MONAD_BERRY}40`
              }}
            >
              {!isConnected ? '🔗 Connect Wallet to Play' : 
               chainId !== monadTestnet.id ? '🔄 Switch to Monad Testnet' : 
               '🎮 Start Enhanced Game'}
            </button>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={toggleLeaderboard}
                className="py-4 px-6 text-lg font-bold rounded-lg transition-all duration-200 hover:scale-105"
                style={{ 
                  backgroundColor: COLORS.MONAD_PURPLE, 
                  color: COLORS.WHITE 
                }}
              >
                🏆 Leaderboard
              </button>

              <button
                onClick={toggleSounds}
                className="py-4 px-6 text-lg font-bold rounded-lg transition-all duration-200 hover:scale-105"
                style={{ 
                  backgroundColor: COLORS.MONAD_BLUE, 
                  color: COLORS.WHITE 
                }}
              >
                {soundManagerRef.current?.getSoundsEnabled() ? '🔊 Sound On' : '🔇 Sound Off'}
              </button>
            </div>

            {isConnected && (
              <button
                onClick={() => disconnect()}
                className="w-full py-4 px-6 text-lg font-bold rounded-lg transition-all duration-200 hover:scale-105"
                style={{ 
                  backgroundColor: 'transparent', 
                  color: COLORS.MONAD_OFF_WHITE,
                  border: `2px solid ${COLORS.MONAD_OFF_WHITE}`
                }}
              >
                🔌 Disconnect Wallet
              </button>
            )}
          </div>

          {/* Game Instructions */}
          <div className="text-center text-sm max-w-md" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            <div className="bg-black bg-opacity-30 rounded-lg p-4 space-y-2">
              <p className="font-bold">🎮 How to Play:</p>
              <p>🖱️ Desktop: Arrow keys or WASD to move</p>
              <p>📱 Mobile: Swipe or tap direction buttons</p>
              <p>⚡ Collect power-ups for special abilities</p>
              <p>🎯 Complete all 10 levels for maximum score!</p>
              <p className="mt-3 text-xs font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
                💎 Save your score onchain for 0.015 MON
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Leaderboard Screen */}
      {gameState.showLeaderboard && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6 p-4">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              🏆 Global Leaderboard
            </h2>
            <p className="text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Top players who saved their scores onchain
            </p>
          </div>

          <div className="w-full max-w-lg space-y-3 px-4">
            {gameState.onChainScores.map((score, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-black to-gray-900 border border-purple-500">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : 
                     index === 3 ? '🏅' : `${index + 1}`}
                  </span>
                  <div>
                    <div className="font-mono text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                      {`${score.address.slice(0, 6)}...${score.address.slice(-4)}`}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(score.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-lg font-bold" style={{ 
                    color: index === 0 ? COLORS.YELLOW : 
                           index === 1 ? '#C0C0C0' : 
                           index === 2 ? '#CD7F32' : COLORS.MONAD_OFF_WHITE 
                  }}>
                    {score.score.toLocaleString()}
                  </div>
                  <div className="text-xs bg-purple-600 px-2 py-1 rounded inline-block">
                    Level {score.level}
                  </div>
                </div>
              </div>
            ))}

            {gameState.onChainScores.length === 0 && (
              <div className="text-center p-8 bg-black bg-opacity-30 rounded-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                <div className="text-4xl mb-4">🎮</div>
                <p className="text-lg">No scores saved onchain yet.</p>
                <p className="mt-2 text-sm">Be the first to make history!</p>
              </div>
            )}
          </div>

          <button
            onClick={toggleLeaderboard}
            className="py-4 px-8 text-lg font-bold rounded-lg transition-all duration-200 hover:scale-105"
            style={{ 
              backgroundColor: COLORS.MONAD_BERRY, 
              color: COLORS.WHITE 
            }}
          >
            ⬅️ Back to Game
          </button>
        </div>
      )}


      {/* Enhanced Playing Screen */}
      {gameState.gameStatus === 'playing' && (
        <div className="flex flex-col h-screen w-full">
          {/* Enhanced Game Header */}
          <div className="text-center py-3 px-4" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
            <div className="flex justify-between items-center mb-2">
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                PACMON ENHANCED
              </h1>
              <button
                onClick={pauseGame}
                className="px-3 py-1 text-sm rounded"
                style={{ backgroundColor: COLORS.MONAD_BLUE, color: COLORS.WHITE }}
              >
                ⏸️ Pause
              </button>
            </div>

            {/* Enhanced Game Stats */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs md:text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              <div className="bg-black bg-opacity-50 rounded px-2 py-1">
                <div className="font-bold text-yellow-400">Score</div>
                <div className="font-mono">{gameState.score.toLocaleString()}</div>
              </div>
              <div className="bg-black bg-opacity-50 rounded px-2 py-1">
                <div className="font-bold text-red-400">Lives</div>
                <div>{'❤️'.repeat(gameState.lives)}</div>
              </div>
              <div className="bg-black bg-opacity-50 rounded px-2 py-1">
                <div className="font-bold text-purple-400">Level</div>
                <div className="font-mono">{gameState.level}/{MAX_LEVELS}</div>
              </div>
              <div className="bg-black bg-opacity-50 rounded px-2 py-1">
                <div className="font-bold text-green-400">Combo</div>
                <div className="font-mono">x{gameState.combo}</div>
              </div>
              <div className="bg-black bg-opacity-50 rounded px-2 py-1">
                <div className="font-bold text-blue-400">Progress</div>
                <div className="text-xs">
                  {gameState.pelletsEaten}/{gameState.totalPellets}
                </div>
              </div>
              <div className="bg-black bg-opacity-50 rounded px-2 py-1">
                <div className="font-bold text-orange-400">Time Bonus</div>
                <div className="font-mono text-xs">{gameState.timeBonus}</div>
              </div>
            </div>

            {/* Power Mode Indicator */}
            {gameState.powerMode && (
              <div className="mt-2 text-center">
                <div className="inline-block bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                  ⚡ POWER MODE: {Math.ceil(gameState.powerModeTimer / 5)}s
                </div>
              </div>
            )}

            {/* Active Power-ups Display */}
            {gameState.activePowerUps.length > 0 && (
              <div className="mt-2 flex justify-center space-x-2">
                {gameState.activePowerUps.map((powerUp, index) => (
                  <div key={index} className="bg-black bg-opacity-70 rounded px-2 py-1 text-xs">
                    <span style={{ 
                      color: powerUp.type === 'speed' ? COLORS.YELLOW :
                             powerUp.type === 'freeze' ? COLORS.CYAN :
                             powerUp.type === 'shield' ? COLORS.ORANGE : COLORS.GREEN
                    }}>
                      {powerUp.type === 'speed' ? '⚡' :
                       powerUp.type === 'freeze' ? '❄️' :
                       powerUp.type === 'shield' ? '🛡️' : '2️⃣'}
                      {Math.ceil(powerUp.timer / 5)}s
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Game Canvas Container */}
          <div className="flex-1 flex items-start justify-center pt-2">
            <canvas
              ref={canvasRef}
              width={GAME_WIDTH}
              height={GAME_HEIGHT}
              className="max-w-full max-h-full border-2 border-purple-500 rounded-lg shadow-2xl"
              style={{ backgroundColor: COLORS.MONAD_BLACK }}
            />
          </div>

          {/* Enhanced Mobile Controls */}
          <div className="flex justify-center pb-6 pt-4 md:hidden">
            <div className="flex flex-col items-center space-y-3">
              <button
                onTouchStart={() => handleDirectionPress({ x: 0, y: -1 })}
                onClick={() => handleDirectionPress({ x: 0, y: -1 })}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2 active:scale-95 transition-transform shadow-lg"
                style={{ 
                  backgroundColor: COLORS.MONAD_PURPLE, 
                  color: COLORS.WHITE,
                  borderColor: COLORS.MONAD_OFF_WHITE,
                  boxShadow: `0 4px 15px ${COLORS.MONAD_PURPLE}40`
                }}
              >
                ⬆️
              </button>
              <div className="flex space-x-4">
                <button
                  onTouchStart={() => handleDirectionPress({ x: -1, y: 0 })}
                  onClick={() => handleDirectionPress({ x: -1, y: 0 })}
                  className="w-20 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2 active:scale-95 transition-transform shadow-lg"
                  style={{ 
                    backgroundColor: COLORS.MONAD_PURPLE, 
                    color: COLORS.WHITE,
                    borderColor: COLORS.MONAD_OFF_WHITE,
                    boxShadow: `0 4px 15px ${COLORS.MONAD_PURPLE}40`
                  }}
                >
                  ⬅️
                </button>
                <button
                  onTouchStart={() => handleDirectionPress({ x: 1, y: 0 })}
                  onClick={() => handleDirectionPress({ x: 1, y: 0 })}
                  className="w-20 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2 active:scale-95 transition-transform shadow-lg"
                  style={{ 
                    backgroundColor: COLORS.MONAD_PURPLE, 
                    color: COLORS.WHITE,
                    borderColor: COLORS.MONAD_OFF_WHITE,
                    boxShadow: `0 4px 15px ${COLORS.MONAD_PURPLE}40`
                  }}
                >
                  ➡️
                </button>
              </div>
              <button
                onTouchStart={() => handleDirectionPress({ x: 0, y: 1 })}
                onClick={() => handleDirectionPress({ x: 0, y: 1 })}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-2 active:scale-95 transition-transform shadow-lg"
                style={{ 
                  backgroundColor: COLORS.MONAD_PURPLE, 
                  color: COLORS.WHITE,
                  borderColor: COLORS.MONAD_OFF_WHITE,
                  boxShadow: `0 4px 15px ${COLORS.MONAD_PURPLE}40`
                }}
              >
                ⬇️
              </button>
            </div>
          </div>

          {/* Desktop Controls Hint */}
          <div className="hidden md:block text-center pb-4 text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            Use WASD or Arrow Keys • Space/P to Pause • M to Toggle Sound
          </div>
        </div>
      )}

      {/* Pause Screen */}
      {gameState.gameStatus === 'paused' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
              ⏸️ PAUSED
            </h2>
            <div className="bg-black bg-opacity-50 rounded-lg p-6 space-y-3">
              <div className="text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                Level {gameState.level} • Score: {gameState.score.toLocaleString()}
              </div>
              <div className="text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                Lives: {'❤️'.repeat(gameState.lives)} • Combo: x{gameState.combo}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={pauseGame}
              className="w-48 py-4 px-6 text-xl font-bold rounded-lg transition-all duration-200 hover:scale-105"
              style={{ backgroundColor: COLORS.MONAD_BERRY, color: COLORS.WHITE }}
            >
              ▶️ Resume Game
            </button>

            <button
              onClick={exitGame}
              className="w-48 py-4 px-6 text-xl font-bold rounded-lg transition-all duration-200 hover:scale-105"
              style={{ 
                backgroundColor: 'transparent', 
                color: COLORS.MONAD_OFF_WHITE,
                border: `2px solid ${COLORS.MONAD_OFF_WHITE}`
              }}
            >
              🏠 Main Menu
            </button>
          </div>
        </div>
      )}

      {/* Level Transition Screen */}
      {gameState.gameStatus === 'levelTransition' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent animate-pulse">
              🎉 LEVEL {gameState.level - 1} COMPLETE!
            </h2>

            {/* Level Completion Stats */}
            <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg p-6 space-y-4 max-w-md mx-auto">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{gameState.levelBonus.toLocaleString()}</div>
                  <div style={{ color: COLORS.MONAD_OFF_WHITE }}>Level Bonus</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{gameState.maxCombo}</div>
                  <div style={{ color: COLORS.MONAD_OFF_WHITE }}>Max Combo</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{gameState.ghostsEaten}</div>
                  <div style={{ color: COLORS.MONAD_OFF_WHITE }}>Ghosts Eaten</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{gameState.timeBonus}</div>
                  <div style={{ color: COLORS.MONAD_OFF_WHITE }}>Time Bonus</div>
                </div>
              </div>

              {gameState.perfectLevel && (
                <div className="text-center bg-yellow-600 text-black rounded-lg py-2 font-bold">
                  ⭐ PERFECT LEVEL! ⭐
                </div>
              )}
            </div>

            <div className="text-xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
              {gameState.level <= MAX_LEVELS ? 
                `Preparing Level ${gameState.level}...` : 
                'All Levels Complete!'}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Post-Game Screen */}
      {gameState.gameStatus === 'postGame' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6 p-4">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-red-500 to-purple-600 bg-clip-text text-transparent">
              {gameState.level >= MAX_LEVELS ? '🏆 GAME COMPLETED!' : '💀 GAME OVER'}
            </h2>

            {/* Final Score Display */}
            <div className="bg-gradient-to-r from-black to-gray-900 rounded-lg p-6 border-2 border-purple-500 max-w-md mx-auto">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-400 mb-2">
                    {gameState.score.toLocaleString()}
                  </div>
                  <div className="text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                    Final Score
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-xl font-bold text-purple-400">{gameState.level}</div>
                    <div style={{ color: COLORS.MONAD_OFF_WHITE }}>Levels Reached</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-400">{gameState.maxCombo}</div>
                    <div style={{ color: COLORS.MONAD_OFF_WHITE }}>Best Combo</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-400">{gameState.ghostsEaten}</div>
                    <div style={{ color: COLORS.MONAD_OFF_WHITE }}>Total Ghosts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-400">{gameState.pelletsEaten}</div>
                    <div style={{ color: COLORS.MONAD_OFF_WHITE }}>Pellets Eaten</div>
                  </div>
                </div>

                {/* Performance Rating */}
                <div className="text-center pt-4 border-t border-gray-600">
                  <div className="text-lg font-bold" style={{ 
                    color: gameState.score > 20000 ? COLORS.YELLOW :
                           gameState.score > 15000 ? COLORS.ORANGE :
                           gameState.score > 10000 ? COLORS.GREEN :
                           gameState.score > 5000 ? COLORS.MONAD_PURPLE : COLORS.MONAD_OFF_WHITE
                  }}>
                    {gameState.score > 20000 ? '🏆 LEGENDARY!' :
                     gameState.score > 15000 ? '⭐ EXCELLENT!' :
                     gameState.score > 10000 ? '🎯 GREAT!' :
                     gameState.score > 5000 ? '👍 GOOD!' : '🎮 KEEP TRYING!'}
                  </div>
                </div>
              </div>
            </div>

            {/* High Score Comparison */}
            {gameState.score > gameState.highScore && (
              <div className="bg-yellow-600 text-black rounded-lg p-4 font-bold animate-pulse">
                🎉 NEW HIGH SCORE! 🎉
              </div>
            )}
          </div>

          {/* Score Submission Section */}
          {isConnected && chainId === monadTestnet.id && !scoreSaved && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ 
              borderColor: COLORS.MONAD_PURPLE, 
              backgroundColor: 'rgba(131, 110, 249, 0.1)' 
            }}>
              <div className="text-center space-y-3">
                <div className="text-lg font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                  💎 Save Score Onchain
                </div>
                <div className="text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  Immortalize your score on the Monad blockchain!
                </div>
                <button
                  onClick={handleScoreSubmission}
                  className="w-full py-3 px-6 text-lg font-bold rounded-lg transition-all duration-200 hover:scale-105"
                  style={{ 
                    backgroundColor: COLORS.MONAD_BERRY, 
                    color: COLORS.WHITE 
                  }}
                >
                  💎 Submit for 0.015 MON
                </button>
              </div>
            </div>
          )}

          {scoreSaved && (
            <div className="w-full max-w-md p-4 rounded-lg border-2" style={{ 
              borderColor: COLORS.GREEN, 
              backgroundColor: 'rgba(0, 255, 0, 0.1)' 
            }}>
              <div className="text-center space-y-2">
                <div className="text-lg font-semibold" style={{ color: COLORS.GREEN }}>
                  ✅ Score Saved Onchain!
                </div>
                <div className="text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                  Your achievement is now permanent on the blockchain
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full max-w-md space-y-4">
            <button
              onClick={restartGame}
              className="w-full py-4 px-6 text-xl font-bold rounded-lg transition-all duration-200 hover:scale-105"
              style={{ 
                backgroundColor: COLORS.MONAD_BERRY, 
                color: COLORS.WHITE 
              }}
            >
              🔄 Play Again
            </button>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={toggleLeaderboard}
                className="py-3 px-4 text-lg font-bold rounded-lg transition-all duration-200 hover:scale-105"
                style={{ 
                  backgroundColor: COLORS.MONAD_PURPLE, 
                  color: COLORS.WHITE 
                }}
              >
                🏆 Leaderboard
              </button>

              <button
                onClick={exitGame}
                className="py-3 px-4 text-lg font-bold rounded-lg transition-all duration-200 hover:scale-105"
                style={{ 
                  backgroundColor: 'transparent', 
                  color: COLORS.MONAD_OFF_WHITE,
                  border: `2px solid ${COLORS.MONAD_OFF_WHITE}`
                }}
              >
                🏠 Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
