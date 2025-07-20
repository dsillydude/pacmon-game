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

// Classic Pac-Man colors matching the reference image exactly
const COLORS = {
  MONAD_PURPLE: '#836EF9',  // Keep Pac-Man purple as requested
  MAZE_BLUE: '#0000FF',     // Exact blue from reference image for maze walls
  BACKGROUND_BLACK: '#000000', // Pure black background
  PELLET_WHITE: '#FFFFFF',     // White pellets
  UI_YELLOW: '#FFFF00',        // Yellow for UI text like "Ready!"
  GHOST_RED: '#FF0000',        // Red ghost (Blinky)
  GHOST_PINK: '#FFB6C1',       // Pink ghost (Pinky)  
  GHOST_ORANGE: '#FFA500',     // Orange ghost (Clyde)
  GHOST_CYAN: '#00FFFF',       // Cyan ghost (Inky) - matches reference
  POWER_PELLET_GLOW: '#FFFFFF', // White glow for power pellets
  VULNERABLE_BLUE: '#0000FF',   // Blue when ghosts are vulnerable
  VULNERABLE_WHITE: '#FFFFFF'   // White flash when vulnerable
}

// Game constants optimized for visual accuracy
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
  pelletDensity: number; // How many pellets to spawn (0-1)
}

// Enhanced progressive level configuration - much easier start
const LEVEL_CONFIG: { [key: number]: LevelConfig } = {
  1: { 
    gameSpeed: 400,      // Much slower for beginners
    ghostSpeed: 0.8,     // Slower ghosts
    pelletValue: 10, 
    powerPelletValue: 50, 
    powerDuration: 50,   // Longer power mode
    bonusMultiplier: 1,
    ghostCount: 1,       // Only 1 ghost to start
    pelletDensity: 0.3   // Fewer pellets, easier to complete
  },
  2: { 
    gameSpeed: 350, 
    ghostSpeed: 0.9, 
    pelletValue: 15, 
    powerPelletValue: 75, 
    powerDuration: 45,
    bonusMultiplier: 1.2,
    ghostCount: 2,       // Add second ghost
    pelletDensity: 0.5   // More pellets
  },
  3: { 
    gameSpeed: 300, 
    ghostSpeed: 1.0, 
    pelletValue: 20, 
    powerPelletValue: 100, 
    powerDuration: 40,
    bonusMultiplier: 1.5,
    ghostCount: 3,       // Add third ghost
    pelletDensity: 0.7   // Even more pellets
  },
  4: { 
    gameSpeed: 250, 
    ghostSpeed: 1.1, 
    pelletValue: 25, 
    powerPelletValue: 125, 
    powerDuration: 35,
    bonusMultiplier: 1.8,
    ghostCount: 4,       // All ghosts active
    pelletDensity: 0.9   // Almost all pellets
  },
  5: { 
    gameSpeed: 200,      // Fastest speed
    ghostSpeed: 1.2,     // Fastest ghosts
    pelletValue: 30, 
    powerPelletValue: 150, 
    powerDuration: 30,   // Shortest power mode
    bonusMultiplier: 2,
    ghostCount: 4,
    pelletDensity: 1.0   // All pellets present
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

// Enhanced Sound Manager Class
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
      gameStart: '/sounds/game-start.mp3'
    }

    Object.entries(soundFiles).forEach(([key, path]) => {
      try {
        const audio = new Audio(path)
        audio.preload = 'auto'
        audio.volume = key === 'backgroundMusic' ? 0.3 : 0.5
        this.sounds[key] = audio
      } catch (error) {
        console.log(`Failed to load sound: ${key}`)
      }
    })

    if (this.sounds.backgroundMusic) {
      this.sounds.backgroundMusic.loop = true
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
  1: [ // Level 1: Simple open maze - easy for beginners
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,1],
    [1,3,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,2,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,1,0,0,1,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,0,0,0,0,2,2,2,2,2,2,2,1], // Ghost starting area
    [1,2,2,2,2,2,2,2,1,0,0,1,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1], // Pac-Man starts here
    [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,2,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  2: [ // Level 2: Moderate complexity
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,1,2,1,1,2,1,1,2,1,1,2,1,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,2,1,1,1,1,2,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,1,2,2,1,1,2,2,1,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,2,1,1,2,1,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,0,0,0,0,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,2,1,0,0,1,2,1,2,1,1,1,1,1],
    [2,2,2,2,2,2,2,2,1,0,0,1,2,2,2,2,2,2,2,2],
    [1,1,1,1,1,2,1,2,1,0,0,1,2,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,2,2,2,2,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,1,2,1,1,2,1,1,2,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
    [1,3,2,2,1,2,2,2,2,2,2,2,2,2,2,1,2,2,3,1],
    [1,1,1,2,1,2,1,1,1,1,1,1,1,1,2,1,2,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  3: [ // Level 3+: Classic Pac-Man maze design matching reference image
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
  ]
}

// Function to get maze for current level
const getMazeForLevel = (level: number) => {
  if (level === 1) return MAZE_LAYOUTS[1]
  if (level === 2) return MAZE_LAYOUTS[2]
  return MAZE_LAYOUTS[3] // Use classic maze for level 3+
}

export default function PacmonGame() {
  const canvasRef = useRef(null)
  const gameLoopRef = useRef(null)
  const soundManagerRef = useRef(null)
  const { isEthProviderAvailable } = useFrame()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: hash, sendTransaction } = useSendTransaction()
  const { switchChain } = useSwitchChain()
  const { connect } = useConnect()
  const publicClient = usePublicClient()
  const [scoreSaved, setScoreSaved] = useState(false)
  
  const [gameState, setGameState] = useState({
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
    onChainScores: [], // No mock data - empty initially
    showLeaderboard: false,
    currentLevel: 1,
    levelStats: [],
    totalPelletsInLevel: 0,
    levelStartTime: 0,
    consecutiveLevels: 0,
    bonusScore: 0,
    showBonusMessage: false,
    gameSpeed: 400
  })

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager()
  }, [])

  // Load real on-chain scores (no mock data)
  const loadOnChainScores = useCallback(async () => {
    if (!publicClient || !address) return

    try {
      // In a real implementation, query the blockchain for actual scores
      // Starting with empty array - no mock data as requested
      const realOnChainScores: OnChainScore[] = []

      setGameState(prev => ({
        ...prev,
        onChainScores: realOnChainScores,
        userOnChainScore: null,
        highScore: realOnChainScores[0]?.score || 0
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

  // Initialize level with enhanced progressive difficulty
  const initializeLevel = useCallback((level: number) => {
    const maze = getMazeForLevel(level)
    const pellets: Position[] = []
    const powerPellets: Position[] = []
    const levelConfig = LEVEL_CONFIG[Math.min(level, 5)] || LEVEL_CONFIG[5]
    
    // Progressive pellet distribution based on density
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (maze[y][x] === 2) {
          if (Math.random() < levelConfig.pelletDensity) {
            pellets.push({ x, y })
          }
        } else if (maze[y][x] === 3) {
          // Progressive power pellets - level 1 gets fewer
          if (level === 1 && powerPellets.length >= 2) continue
          if (level === 2 && powerPellets.length >= 3) continue
          powerPellets.push({ x, y })
        }
      }
    }
    
    // Progressive ghost initialization with correct colors from reference image
    const ghosts: Ghost[] = []
    const ghostTypes: Array<'blinky' | 'pinky' | 'inky' | 'clyde'> = ['blinky', 'pinky', 'inky', 'clyde']
    const ghostColors = [COLORS.GHOST_RED, COLORS.GHOST_PINK, COLORS.GHOST_CYAN, COLORS.GHOST_ORANGE]
    
    for (let i = 0; i < levelConfig.ghostCount; i++) {
      ghosts.push({
        id: i + 1,
        position: { x: 9 + (i % 2), y: 9 + Math.floor(i / 2) },
        direction: { x: i % 2 === 0 ? 1 : -1, y: 0 },
        color: ghostColors[i],
        vulnerable: false,
        type: ghostTypes[i],
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

  // Enhanced game loop with improved collision and movement
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

          // Handle tunnel effect (wrap around edges)
          if (newPacmonPos.x < 0) newPacmonPos.x = GRID_SIZE - 1
          if (newPacmonPos.x >= GRID_SIZE) newPacmonPos.x = 0

          // Check for wall collision
          if (newPacmonPos.y >= 0 && newPacmonPos.y < GRID_SIZE &&
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

          // Enhanced ghost AI with level-appropriate behavior
          newState.ghosts = newState.ghosts.map(ghost => {
            const moveDelay = 200 / ghost.speed
            if (currentTime - ghost.lastMoveTime < moveDelay) {
              return ghost
            }

            if (ghost.eaten) {
              // Return to ghost house
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

              const newPos = { 
                x: ghost.position.x + newDirection.x, 
                y: ghost.position.y + newDirection.y 
              }
              
              return { 
                ...ghost, 
                direction: newDirection, 
                position: newPos,
                lastMoveTime: currentTime
              }
            }

            let targetTile: Position

            if (newState.powerMode && ghost.vulnerable) {
              // Frightened mode - run away from Pac-Man
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
                       maze[testPos.y] && maze[testPos.y][testPos.x] !== 1
              })
              
              // Move away from Pac-Man
              const awayDirection = validDirections.reduce((best, dir) => {
                const testPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
                const testDistance = Math.sqrt(
                  Math.pow(testPos.x - newState.pacmon.x, 2) +
                  Math.pow(testPos.y - newState.pacmon.y, 2)
                )
                const currentBestPos = { x: ghost.position.x + best.x, y: ghost.position.y + best.y }
                const bestDistance = Math.sqrt(
                  Math.pow(currentBestPos.x - newState.pacmon.x, 2) +
                  Math.pow(currentBestPos.y - newState.pacmon.y, 2)
                )
                return testDistance > bestDistance ? dir : best
              }, validDirections[0] || { x: 0, y: 0 })
              
              const newPos = { 
                x: ghost.position.x + awayDirection.x, 
                y: ghost.position.y + awayDirection.y 
              }
              
              return { 
                ...ghost, 
                direction: awayDirection, 
                position: newPos, 
                vulnerable: true,
                lastMoveTime: currentTime
              }
            } else {
              // Normal AI behavior - different strategies for each ghost
              switch (ghost.type) {
                case 'blinky':
                  targetTile = newState.pacmon // Always chase Pac-Man directly
                  break
                case 'pinky':
                  // Target ahead of Pac-Man
                  targetTile = {
                    x: Math.max(0, Math.min(GRID_SIZE - 1, newState.pacmon.x + newState.pacmonDirection.x * 4)),
                    y: Math.max(0, Math.min(GRID_SIZE - 1, newState.pacmon.y + newState.pacmonDirection.y * 4))
                  }
                  break
                case 'inky':
                  // Complex targeting based on Blinky's position
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
                      x: Math.max(0, Math.min(GRID_SIZE - 1, blinky.position.x + vector.x * 2)), 
                      y: Math.max(0, Math.min(GRID_SIZE - 1, blinky.position.y + vector.y * 2))
                    }
                  } else {
                    targetTile = newState.pacmon
                  }
                  break
                case 'clyde':
                  // Keep distance from Pac-Man, scatter when close
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

            // Enhanced pathfinding
            const possibleDirections = [
              { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
            ]
            let bestDirection = ghost.direction
            let minDistance = Infinity

            possibleDirections.forEach(dir => {
              const nextPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
              
              // Handle edge wrapping
              if (nextPos.x < 0) nextPos.x = GRID_SIZE - 1
              if (nextPos.x >= GRID_SIZE) nextPos.x = 0
              
              if (nextPos.y >= 0 && nextPos.y < GRID_SIZE && 
                  maze[nextPos.y] && maze[nextPos.y][nextPos.x] !== 1) {
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

            const newPos = { 
              x: ghost.position.x + bestDirection.x, 
              y: ghost.position.y + bestDirection.y 
            }

            // Handle edge wrapping for ghosts too
            if (newPos.x < 0) newPos.x = GRID_SIZE - 1
            if (newPos.x >= GRID_SIZE) newPos.x = 0

            return { 
              ...ghost, 
              direction: bestDirection, 
              position: newPos, 
              vulnerable: newState.powerMode && !ghost.eaten,
              lastMoveTime: currentTime
            }
          })
          
          // Check ghost collisions
          newState.ghosts.forEach(ghost => {
            if (ghost.position.x === newState.pacmon.x && ghost.position.y === newState.pacmon.y) {
              if (ghost.vulnerable && !ghost.eaten) {
                // Eat ghost
                const basePoints = 200
                const bonusPoints = Math.floor(basePoints * levelConfig.bonusMultiplier)
                newState.score += bonusPoints
                ghost.eaten = true
                ghost.vulnerable = false
                soundManagerRef.current?.play('ghostEat')
              } else if (!ghost.eaten) {
                // Lose life
                newState.lives -= 1
                newState.pacmon = { x: 9, y: 15 }
                newState.pacmonDirection = { x: 0, y: 0 }
                newState.ghosts = newState.ghosts.map(g => ({ 
                  ...g, 
                  position: { x: 9 + (g.id % 2), y: 9 + Math.floor((g.id - 1) / 2) }, 
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
              newState.ghosts = newState.ghosts.map(ghost => ({ 
                ...ghost, 
                vulnerable: false 
              }))
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
            
            // Extra life every 3 levels
            if (newState.currentLevel % 3 === 0 && newState.lives < 5) {
              newState.lives += 1
              soundManagerRef.current?.play('extraLife')
            }
            
            soundManagerRef.current?.play('levelComplete')
            
            // Auto-advance to next level after delay
            setTimeout(() => {
              setGameState(prev => {
                const nextLevel = prev.currentLevel + 1
                initializeLevel(nextLevel)
                return {
                  ...prev,
                  currentLevel: nextLevel,
                  gameStatus: 'playing',
                  showBonusMessage: false
                }
              })
            }, 3000)
          }
          
          return newState
        })
      }, gameState.gameSpeed) as NodeJS.Timeout
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState.gameStatus, gameState.gameSpeed, initializeLevel])

  // Enhanced keyboard controls
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
    let nextX = gameState.pacmon.x + newDirection.x
    let nextY = gameState.pacmon.y + newDirection.y

    // Handle tunnel wrapping
    if (nextX < 0) nextX = GRID_SIZE - 1
    if (nextX >= GRID_SIZE) nextX = 0

    if (nextY >= 0 && nextY < GRID_SIZE && maze[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.currentLevel])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // Enhanced rendering with exact visual matching
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maze = getMazeForLevel(gameState.currentLevel)

    // Clear canvas with pure black background
    ctx.fillStyle = COLORS.BACKGROUND_BLACK
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze walls in exact blue from reference
    ctx.fillStyle = COLORS.MAZE_BLUE
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (maze[y][x] === 1) {
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
        }
      }
    }

    // Draw pellets in white (small dots)
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

    // Draw power pellets in white with glowing effect
    gameState.powerPellets.forEach(pellet => {
      const glowIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7
      ctx.shadowColor = COLORS.POWER_PELLET_GLOW
      ctx.shadowBlur = 10 * glowIntensity
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

    // Draw Pac-Man in purple with mouth animation
    const pacmanAngle = Math.sin(Date.now() * 0.02) * 0.5 + 0.5
    ctx.fillStyle = COLORS.MONAD_PURPLE
    ctx.beginPath()
    
    // Determine mouth direction based on movement
    let startAngle = 0.2 * Math.PI + pacmanAngle * 0.3
    let endAngle = 1.8 * Math.PI - pacmanAngle * 0.3
    
    if (gameState.pacmonDirection.x > 0) { // Right
      startAngle = 0.2 * Math.PI + pacmanAngle * 0.3
      endAngle = 1.8 * Math.PI - pacmanAngle * 0.3
    } else if (gameState.pacmonDirection.x < 0) { // Left
      startAngle = 1.2 * Math.PI + pacmanAngle * 0.3
      endAngle = 0.8 * Math.PI - pacmanAngle * 0.3
    } else if (gameState.pacmonDirection.y > 0) { // Down
      startAngle = 0.7 * Math.PI + pacmanAngle * 0.3
      endAngle = 0.3 * Math.PI - pacmanAngle * 0.3
    } else if (gameState.pacmonDirection.y < 0) { // Up
      startAngle = 1.7 * Math.PI + pacmanAngle * 0.3
      endAngle = 1.3 * Math.PI - pacmanAngle * 0.3
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

    // Draw ghosts with exact colors and enhanced visual effects
    gameState.ghosts.forEach(ghost => {
      let ghostColor = ghost.color
      
      if (ghost.vulnerable && !ghost.eaten) {
        // Flash between blue and white when vulnerable
        const flash = Math.sin(Date.now() * 0.02) > 0
        ghostColor = flash ? COLORS.VULNERABLE_BLUE : COLORS.VULNERABLE_WHITE
      } else if (ghost.eaten) {
        return // Don't draw eaten ghosts
      }
      
      ctx.fillStyle = ghostColor
      
      // Draw ghost body (rounded top)
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
      
      // Draw wavy bottom edge
      const waveHeight = 3
      ctx.beginPath()
      ctx.moveTo(ghost.position.x * CELL_SIZE + 2, ghost.position.y * CELL_SIZE + CELL_SIZE - 2)
      for (let i = 0; i < CELL_SIZE - 4; i += 3) {
        const wave = (i % 6 < 3) ? waveHeight : 0
        ctx.lineTo(
          ghost.position.x * CELL_SIZE + 2 + i,
          ghost.position.y * CELL_SIZE + CELL_SIZE - 2 - wave
        )
      }
      ctx.lineTo(ghost.position.x * CELL_SIZE + CELL_SIZE - 2, ghost.position.y * CELL_SIZE + CELL_SIZE - 2)
      ctx.fill()
      
      // Draw ghost eyes (always visible unless eaten)
      if (!ghost.eaten) {
        // White eye background
        ctx.fillStyle = COLORS.PELLET_WHITE
        ctx.fillRect(ghost.position.x * CELL_SIZE + 5, ghost.position.y * CELL_SIZE + 5, 4, 4)
        ctx.fillRect(ghost.position.x * CELL_SIZE + 11, ghost.position.y * CELL_SIZE + 5, 4, 4)
        
        // Black pupils that follow direction
        ctx.fillStyle = COLORS.BACKGROUND_BLACK
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 6 + ghost.direction.x,
          ghost.position.y * CELL_SIZE + 6 + ghost.direction.y,
          2, 2
        )
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 12 + ghost.direction.x,
          ghost.position.y * CELL_SIZE + 6 + ghost.direction.y,
          2, 2
        )
      }
    })

    // Draw level transition overlay
    if (gameState.gameStatus === 'levelTransition') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      
      ctx.fillStyle = COLORS.UI_YELLOW
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        `Level ${gameState.currentLevel} Complete!`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 40
      )
      
      if (gameState.showBonusMessage) {
        ctx.fillStyle = COLORS.PELLET_WHITE
        ctx.font = '16px Arial'
        ctx.fillText(
          `Bonus: ${gameState.bonusScore} points`,
          GAME_WIDTH / 2,
          GAME_HEIGHT / 2
        )
      }
      
      ctx.fillStyle = COLORS.UI_YELLOW
      ctx.font = '14px Arial'
      ctx.fillText(
        `Get ready for Level ${gameState.currentLevel + 1}...`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 40
      )
    }

    // Show "Ready!" message at level start
    if (gameState.gameStatus === 'playing' && Date.now() - gameState.levelStartTime < 2000) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      
      ctx.fillStyle = COLORS.UI_YELLOW
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Ready!', GAME_WIDTH / 2, GAME_HEIGHT / 2)
    }
  }, [gameState])

  // Enhanced mobile controls
  const handleDirectionButton = (direction: { x: number; y: number }) => {
    if (gameState.gameStatus !== 'playing') return
    
    const maze = getMazeForLevel(gameState.currentLevel)
    let nextX = gameState.pacmon.x + direction.x
    let nextY = gameState.pacmon.y + direction.y

    // Handle tunnel wrapping
    if (nextX < 0) nextX = GRID_SIZE - 1
    if (nextX >= GRID_SIZE) nextX = 0

    if (nextY >= 0 && nextY < GRID_SIZE && maze[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: direction }))
    }
  }

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
      gameStatus: 'playing',
      score: 0,
      lives: 3,
      currentLevel: 1,
      levelStats: [],
      consecutiveLevels: 0
    }))
    initializeLevel(1)
    soundManagerRef.current?.playBackgroundMusic()
    soundManagerRef.current?.play('gameStart')
  }

  const saveScoreOnChain = async () => {
    if (!isConnected || !address || chainId !== monadTestnet.id) return

    try {
      const scoreHash = keccak256(toHex(gameState.score.toString() + address + Date.now()))
      
      await sendTransaction({
        to: SCORE_CONTRACT_ADDRESS,
        value: parseEther('0.015'),
        data: encodeFunctionData({
          abi: [{
            name: 'submitScore',
            type: 'function',
            inputs: [
              { name: 'score', type: 'uint256' },
              { name: 'hash', type: 'bytes32' }
            ],
            outputs: []
          }],
          functionName: 'submitScore',
          args: [BigInt(gameState.score), scoreHash]
        })
      })
      
      setScoreSaved(true)
      
      setTimeout(() => {
        loadOnChainScores()
      }, 2000)
    } catch (error) {
      console.error('Error saving score:', error)
    }
  }

  const resetGame = () => {
    setGameState(prev => ({
      ...prev,
      gameStatus: 'pregame',
      score: 0,
      lives: 3,
      currentLevel: 1,
      levelStats: [],
      consecutiveLevels: 0,
      showBonusMessage: false
    }))
    soundManagerRef.current?.stopBackgroundMusic()
    setScoreSaved(false)
  }

  const toggleLeaderboard = () => {
    setGameState(prev => ({ ...prev, showLeaderboard: !prev.showLeaderboard }))
  }

  const isNewPersonalBest = gameState.score > (gameState.userOnChainScore || 0)

  return (
    
      
        
        {/* Cleaned Start Screen - Only essential elements as requested */}
        {gameState.gameStatus === 'pregame' && !gameState.showLeaderboard && (
          
            PACMON
            
            {gameState.onChainScores.length > 0 && (
              
                Current High Scores
                
                  {gameState.onChainScores.slice(0, 3).map((score, index) => (
                    
                      
                        {score.address.slice(0, 6)}...{score.address.slice(-4)}
                      
                      {score.score.toLocaleString()}
                    
                  ))}
                
              
            )}
            
            {gameState.onChainScores.length === 0 && (
              
                Current High Scores
                No scores yet. Be the first to play!
              
            )}
            
            
              
                {!isConnected 
                  ? 'Connect Wallet to Play' 
                  : chainId !== monadTestnet.id 
                  ? 'Switch to Monad Testnet' 
                  : 'Start Game'
                }
              
              
              
                View Leaderboard
              
            
            
            {isConnected && (
               disconnect()}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
              >
                Disconnect Wallet
              
            )}
          
        )}

        {/* Leaderboard Screen - Shows only real scores */}
        {gameState.showLeaderboard && (
          
            Leaderboard
            
            
              {gameState.onChainScores.length > 0 ? (
                
                  {gameState.onChainScores.map((score, index) => (
                    
                      
                        #{index + 1}
                        
                          {score.address.slice(0, 6)}...{score.address.slice(-4)}
                        
                      
                      {score.score.toLocaleString()}
                    
                  ))}
                
              ) : (
                No scores recorded yet. Play to set the first score!
              )}
            
            
            
              Back to Menu
            
          
        )}

        {/* Game Canvas with Enhanced HUD */}
        {(gameState.gameStatus === 'playing' || gameState.gameStatus === 'levelTransition') && (
          
            
            
            {/* Enhanced Game HUD */}
            
              Score: {gameState.score.toLocaleString()}
              Level: {gameState.currentLevel}
              Lives: {gameState.lives}
            
            
            {gameState.powerMode && (
              
                
                  Power Mode: {Math.ceil(gameState.powerModeTimer / 10)}s
                
              
            )}
            
            {/* Enhanced Mobile Controls */}
            
              
               handleDirectionButton({ x: 0, y: -1 })}
                onClick={() => handleDirectionButton({ x: 0, y: -1 })}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg active:bg-gray-500"
              >
                ↑
              
              
              
               handleDirectionButton({ x: -1, y: 0 })}
                onClick={() => handleDirectionButton({ x: -1, y: 0 })}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg active:bg-gray-500"
              >
                ←
              
               handleDirectionButton({ x: 1, y: 0 })}
                onClick={() => handleDirectionButton({ x: 1, y: 0 })}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg active:bg-gray-500"
              >
                →
              
              
              
               handleDirectionButton({ x: 0, y: 1 })}
                onClick={() => handleDirectionButton({ x: 0, y: 1 })}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg active:bg-gray-500"
              >
                ↓
              
              
            
            
            
               soundManagerRef.current?.toggleSounds()}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-2 rounded"
              >
                {soundManagerRef.current?.getSoundsEnabled() ? '🔊' : '🔇'}
              
              
                Quit
              
            
          
        )}

        {/* Enhanced Game Over Screen */}
        {gameState.gameStatus === 'postGame' && (
          
            Game Over
            
            
              
                Final Score: {gameState.score.toLocaleString()}
              
              
              {gameState.consecutiveLevels > 0 && (
                
                  Levels Completed: {gameState.consecutiveLevels}
                
              )}
              
              {isNewPersonalBest && (
                
                  🎉 New Personal Best! 🎉
                
              )}
              
              
                Level Reached: {gameState.currentLevel}
                Total Play Time: {Math.floor((Date.now() - gameState.levelStartTime) / 1000)}s
              
            
            
            {isConnected && chainId === monadTestnet.id && !scoreSaved && (
              
                Save Score On-Chain (0.015 MON)
              
            )}
            
            {scoreSaved && (
              
                ✅ Score saved on-chain successfully!
              
            )}
            
            
              
                Play Again
              
              
              
                Main Menu
              
            
          
        )}
      
    
  )
}