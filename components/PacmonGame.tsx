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

// Classic Pac-Man color palette matching the reference image
const COLORS = {
  MONAD_PURPLE: '#836EF9',  // Keep Pac-Man purple as requested
  MONAD_BLUE: '#0000FF',    // Classic blue for maze walls
  MONAD_BLACK: '#000000',   // Pure black background
  WHITE: '#FFFFFF',         // White pellets
  YELLOW: '#FFFF00',        // Yellow for UI text
  RED: '#FF0000',           // Red for Blinky
  PINK: '#FFB6C1',          // Pink for Pinky  
  ORANGE: '#FFA500',        // Orange for Clyde
  BLUE: '#0000FF',          // Blue for Inky
  GREEN: '#00FF00'
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

// Progressive level configuration - starts much easier
const LEVEL_CONFIG: { [key: number]: LevelConfig } = {
  1: { 
    gameSpeed: 300,    // Slower for beginners
    ghostSpeed: 1, 
    pelletValue: 10, 
    powerPelletValue: 50, 
    powerDuration: 40,  // Longer power duration
    bonusMultiplier: 1,
    ghostCount: 1       // Start with just 1 ghost
  },
  2: { 
    gameSpeed: 250, 
    ghostSpeed: 1, 
    pelletValue: 15, 
    powerPelletValue: 75, 
    powerDuration: 35,
    bonusMultiplier: 1.2,
    ghostCount: 2       // Add second ghost
  },
  3: { 
    gameSpeed: 220, 
    ghostSpeed: 1, 
    pelletValue: 20, 
    powerPelletValue: 100, 
    powerDuration: 30,
    bonusMultiplier: 1.5,
    ghostCount: 3       // Add third ghost
  },
  4: { 
    gameSpeed: 200, 
    ghostSpeed: 1, 
    pelletValue: 25, 
    powerPelletValue: 125, 
    powerDuration: 25,
    bonusMultiplier: 1.8,
    ghostCount: 4       // Full ghost count
  },
  5: { 
    gameSpeed: 180, 
    ghostSpeed: 1, 
    pelletValue: 30, 
    powerPelletValue: 150, 
    powerDuration: 20,
    bonusMultiplier: 2,
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

// Progressive maze layouts - starting simple and getting more complex
const MAZE_LAYOUTS = {
  1: [ // Level 1: Very simple, open maze with minimal walls
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,1],
    [1,3,1,1,2,2,2,2,2,2,2,2,2,2,2,1,1,2,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,1,0,0,1,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,2,2,2,0,0,0,0,2,2,2,2,2,2,2,1], // Ghost house
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
  2: [ // Level 2: Add some internal walls
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
  3: [ // Level 3+: Full complexity - classic Pac-Man maze design
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
  return MAZE_LAYOUTS[3] // Use complex maze for level 3+
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
    onChainScores: [], // No mock data - will be empty initially
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

  // Load real on-chain scores (no mock data)
  const loadOnChainScores = useCallback(async () => {
    if (!publicClient || !address) return

    try {
      // In a real implementation, query the blockchain for actual scores
      // For now, start with empty array - no mock data
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

  // Initialize level with progressive difficulty
  const initializeLevel = useCallback((level: number) => {
    const maze = getMazeForLevel(level)
    const pellets: Position[] = []
    const powerPellets: Position[] = []
    
    // Progressive pellet distribution
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (maze[y][x] === 2) {
          // For level 1, only add every 3rd pellet to make it easier
          if (level === 1 && Math.random() > 0.4) continue
          pellets.push({ x, y })
        } else if (maze[y][x] === 3) {
          // Progressive power pellets - level 1 gets only 2
          if (level === 1 && powerPellets.length >= 2) continue
          powerPellets.push({ x, y })
        }
      }
    }

    const levelConfig = LEVEL_CONFIG[Math.min(level, 5)] || LEVEL_CONFIG[5]
    
    // Progressive ghost initialization
    const ghosts: Ghost[] = []
    const ghostTypes = ['blinky', 'pinky', 'inky', 'clyde']
    const ghostColors = [COLORS.RED, COLORS.PINK, COLORS.BLUE, COLORS.ORANGE] // Match reference image
    
    for (let i = 0; i < levelConfig.ghostCount; i++) {
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

          // Move ghosts with level-appropriate AI
          newState.ghosts = newState.ghosts.map(ghost => {
            if (currentTime - ghost.lastMoveTime < (200 / ghost.speed)) {
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
              return { 
                ...ghost, 
                direction: newDirection, 
                position: { x: ghost.position.x + newDirection.x, y: ghost.position.y + newDirection.y },
                lastMoveTime: currentTime
              }
            }

            let targetTile: Position
            if (newState.powerMode) {
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
                       maze[testPos.y][testPos.x] !== 1
              })
              
              // Try to move away from Pac-Man
              const selectedDirection = validDirections.reduce((best, dir) => {
                const testPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
                const testDistance = Math.sqrt(
                  Math.pow(testPos.x - newState.pacmon.x, 2) +
                  Math.pow(testPos.y - newState.pacmon.y, 2)
                )
                const bestDistance = Math.sqrt(
                  Math.pow(ghost.position.x + best.x - newState.pacmon.x, 2) +
                  Math.pow(ghost.position.y + best.y - newState.pacmon.y, 2)
                )
                return testDistance > bestDistance ? dir : best
              }, validDirections[0] || { x: 0, y: 0 })
              
              targetTile = { 
                x: ghost.position.x + selectedDirection.x, 
                y: ghost.position.y + selectedDirection.y 
              }
            } else {
              // Normal AI - simpler for early levels
              switch (ghost.type) {
                case 'blinky':
                  targetTile = newState.pacmon // Always target Pac-Man directly
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

  // Render game with classic Pac-Man colors
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maze = getMazeForLevel(gameState.currentLevel)

    // Clear canvas with pure black background
    ctx.fillStyle = COLORS.MONAD_BLACK
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze walls in blue
    ctx.fillStyle = COLORS.MONAD_BLUE
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

    // Draw power pellets in white with glow
    gameState.powerPellets.forEach(pellet => {
      const glowIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7
      ctx.shadowColor = COLORS.WHITE
      ctx.shadowBlur = 10 * glowIntensity
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
      ctx.shadowBlur = 0
    })

    // Draw Pac-Man in purple (as requested)
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

    // Draw ghosts with correct colors matching reference image
    gameState.ghosts.forEach(ghost => {
      if (ghost.vulnerable) {
        const flash = Math.sin(Date.now() * 0.02) > 0
        ctx.fillStyle = flash ? COLORS.BLUE : COLORS.WHITE
      } else if (ghost.eaten) {
        ctx.fillStyle = COLORS.MONAD_BLACK
      } else {
        ctx.fillStyle = ghost.color
      }
      
      // Draw ghost body
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
      
      // Draw ghost bottom with wavy edge
      const waveHeight = 3
      ctx.beginPath()
      ctx.moveTo(ghost.position.x * CELL_SIZE + 2, ghost.position.y * CELL_SIZE + CELL_SIZE - 2)
      for (let i = 0; i < CELL_SIZE - 4; i += 3) {
        ctx.lineTo(
          ghost.position.x * CELL_SIZE + 2 + i,
          ghost.position.y * CELL_SIZE + CELL_SIZE - 2 - (i % 6 < 3 ? waveHeight : 0)
        )
      }
      ctx.lineTo(ghost.position.x * CELL_SIZE + CELL_SIZE - 2, ghost.position.y * CELL_SIZE + CELL_SIZE - 2)
      ctx.fill()
      
      // Draw ghost eyes
      if (!ghost.eaten) {
        ctx.fillStyle = COLORS.WHITE
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 5,
          ghost.position.y * CELL_SIZE + 5,
          4,
          4
        )
        ctx.fillRect(
          ghost.position.x * CELL_SIZE + 11,
          ghost.position.y * CELL_SIZE + 5,
          4,
          4
        )
        
        ctx.fillStyle = COLORS.MONAD_BLACK
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

    // Draw level transition overlay
    if (gameState.gameStatus === 'levelTransition') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
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
      
      ctx.fillStyle = COLORS.YELLOW
      ctx.font = '14px Arial'
      ctx.fillText(
        `Get ready for Level ${gameState.currentLevel + 1}...`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 40
      )
    }

    // Show "Ready!" message at start
    if (gameState.gameStatus === 'playing' && Date.now() - gameState.levelStartTime < 2000) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      
      ctx.fillStyle = COLORS.YELLOW
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        'Ready!',
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2
      )
    }
  }, [gameState])

  // Mobile touch controls
  const handleDirectionButton = (direction: { x: number; y: number }) => {
    if (gameState.gameStatus !== 'playing') return
    
    const maze = getMazeForLevel(gameState.currentLevel)
    const nextX = gameState.pacmon.x + direction.x
    const nextY = gameState.pacmon.y + direction.y

    if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE && maze[nextY][nextX] !== 1) {
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
    
      
        {/* Clean Start Screen */}
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

        {/* Leaderboard Screen */}
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

        {/* Game Canvas */}
        {(gameState.gameStatus === 'playing' || gameState.gameStatus === 'levelTransition') && (
          
            
            
            {/* Game HUD */}
            
              Score: {gameState.score.toLocaleString()}
              Level: {gameState.currentLevel}
              Lives: {gameState.lives}
            
            
            {gameState.powerMode && (
              
                
                  Power Mode: {Math.ceil(gameState.powerModeTimer / 10)}s
                
              
            )}
            
            {/* Mobile Controls */}
            
               handleDirectionButton({ x: 0, y: -1 })}
                onClick={() => handleDirectionButton({ x: 0, y: -1 })}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
              >
                ↑
              
              
                 handleDirectionButton({ x: -1, y: 0 })}
                  onClick={() => handleDirectionButton({ x: -1, y: 0 })}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
                >
                  ←
                
                 handleDirectionButton({ x: 1, y: 0 })}
                  onClick={() => handleDirectionButton({ x: 1, y: 0 })}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
                >
                  →
                
              
               handleDirectionButton({ x: 0, y: 1 })}
                onClick={() => handleDirectionButton({ x: 0, y: 1 })}
                className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
              >
                ↓
              
            
            
            
               soundManagerRef.current?.toggleSounds()}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xs py-1 px-2 rounded"
              >
                {soundManagerRef.current?.getSoundsEnabled() ? '🔊' : '🔇'}
              
              
                Quit
              
            
          
        )}

        {/* Game Over Screen */}
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