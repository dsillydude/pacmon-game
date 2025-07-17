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

// Classic Pac-Man color palette for authentic look
const COLORS = {
  // Classic Pac-Man colors
  PACMAN_YELLOW: '#FFFF00',
  WALL_BLUE: '#0000FF',
  PELLET_WHITE: '#FFFFFF',
  POWER_PELLET_YELLOW: '#FFFF00',
  BACKGROUND_BLACK: '#000000',
  
  // Ghost colors (classic)
  GHOST_RED: '#FF0000',      // Blinky
  GHOST_PINK: '#FFB8FF',     // Pinky  
  GHOST_CYAN: '#00FFFF',     // Inky
  GHOST_ORANGE: '#FFB852',   // Clyde
  GHOST_BLUE: '#2121FF',     // Vulnerable state
  GHOST_WHITE: '#FFFFFF',    // Eyes
  
  // UI colors
  TEXT_YELLOW: '#FFFF00',
  TEXT_WHITE: '#FFFFFF',
  
  // Monad theme integration
  MONAD_PURPLE: '#836EF9',
  MONAD_BLUE: '#200052',
  MONAD_BERRY: '#A0055D',
  MONAD_OFF_WHITE: '#FBFAF9',
  MONAD_BLACK: '#0E100F'
}

// Game constants for classic proportions
const GRID_SIZE = 21  // Classic maze size
const CELL_SIZE = 18  // Adjusted for better visibility
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

// Progressive level configuration
const LEVEL_CONFIG: { [key: number]: LevelConfig } = {
  1: { 
    gameSpeed: 200, 
    ghostSpeed: 0.8, 
    pelletValue: 10, 
    powerPelletValue: 50, 
    powerDuration: 8000,  // 8 seconds
    bonusMultiplier: 1,
    ghostCount: 2,
    mazeComplexity: 1
  },
  2: { 
    gameSpeed: 180, 
    ghostSpeed: 0.9, 
    pelletValue: 15, 
    powerPelletValue: 75, 
    powerDuration: 7000,
    bonusMultiplier: 1.2,
    ghostCount: 3,
    mazeComplexity: 1
  },
  3: { 
    gameSpeed: 160, 
    ghostSpeed: 1.0, 
    pelletValue: 20, 
    powerPelletValue: 100, 
    powerDuration: 6000,
    bonusMultiplier: 1.5,
    ghostCount: 3,
    mazeComplexity: 2
  },
  4: { 
    gameSpeed: 140, 
    ghostSpeed: 1.1, 
    pelletValue: 25, 
    powerPelletValue: 125, 
    powerDuration: 5500,
    bonusMultiplier: 1.8,
    ghostCount: 4,
    mazeComplexity: 2
  },
  5: { 
    gameSpeed: 120, 
    ghostSpeed: 1.2, 
    pelletValue: 30, 
    powerPelletValue: 150, 
    powerDuration: 5000,
    bonusMultiplier: 2,
    ghostCount: 4,
    mazeComplexity: 3
  }
}

// Game entities interfaces
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
  playerName?: string
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
  powerModeStartTime: number
  highScore: number
  userOnChainScore: number | null
  onChainScores: OnChainScore[]
  showLeaderboard: boolean
  currentLevel: number
  totalPelletsInLevel: number
  levelStartTime: number
  gameSpeed: number
  pacmanMouthAngle: number
}

// Classic maze layouts with progressive complexity
const CLASSIC_MAZES = {
  1: [
    // Level 1: Simple, open maze
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,3,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,2,1],
    [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
    [1,1,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,2,2,2,2,2,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,2,1,1,0,1,1,2,1,2,1,1,1,1,1],
    [0,0,0,0,0,2,2,2,1,0,0,0,1,2,2,2,0,0,0,0,0],
    [1,1,1,1,1,2,1,2,1,0,0,0,1,2,1,2,1,1,1,1,1],
    [0,0,0,0,1,2,1,2,1,1,1,1,1,2,1,2,1,0,0,0,0],
    [1,1,1,1,1,2,1,2,2,2,2,2,2,2,1,2,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,2,1],
    [1,3,2,2,1,2,2,2,2,2,2,2,2,2,2,2,1,2,2,3,1],
    [1,1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1,1],
    [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  2: [
    // Level 2: Medium complexity
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,1,1,1,2,1,2,1,1,1,1,2,1,1,2,1],
    [1,3,1,1,2,1,1,1,1,2,2,2,1,1,1,1,2,1,1,3,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,2,1,2,1,1,1,1,1,1,2,1,2,1,1,2,1],
    [1,2,2,2,2,1,2,2,2,1,1,2,2,2,1,2,2,2,2,1],
    [1,1,1,1,2,1,1,1,2,1,1,2,1,1,1,2,1,1,1,1],
    [0,0,0,1,2,1,2,2,2,2,2,2,2,2,1,2,1,0,0,0],
    [1,1,1,1,2,1,2,1,1,0,0,1,1,2,1,2,1,1,1,1],
    [0,0,0,0,2,2,2,1,0,0,0,0,1,2,2,2,0,0,0,0],
    [1,1,1,1,2,1,2,1,1,1,1,1,1,2,1,2,1,1,1,1],
    [0,0,0,1,2,1,2,2,2,2,2,2,2,2,1,2,1,0,0,0],
    [1,1,1,1,2,1,1,1,2,1,1,2,1,1,1,2,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,2,1,2,1,2,1,2,1,1,1,1,1,2,1],
    [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  3: [
    // Level 3: Complex maze
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,2,2,2,1,1,2,1,1,2,2,2,1,1,2,1,1,2,2,2,1],
    [1,1,1,2,1,1,2,1,1,2,2,2,1,1,2,1,1,2,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,2,1,1,2,1,1,2,2,2,1,1,2,1,1,2,1,1,1],
    [1,2,2,2,1,1,2,1,1,2,2,2,1,1,2,1,1,2,2,2,1],
    [1,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ]
}

// Get maze based on level and complexity
const getMazeForLevel = (level: number): number[][] => {
  const levelConfig = LEVEL_CONFIG[Math.min(level, 5)] || LEVEL_CONFIG[5]
  const mazeKey = Math.min(levelConfig.mazeComplexity, 3) as keyof typeof CLASSIC_MAZES
  return CLASSIC_MAZES[mazeKey] || CLASSIC_MAZES[1]
}

// Enhanced Sound Manager
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
      extraLife: '/sounds/extra-life.mp3'
    }

    Object.entries(soundFiles).forEach(([key, path]) => {
      try {
        const audio = new Audio(path)
        audio.preload = 'auto'
        audio.volume = 0.5
        this.sounds[key] = audio
      } catch (error) {
        console.log(`Failed to load sound: ${key}`)
      }
    })
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

  toggleSounds() {
    this.soundsEnabled = !this.soundsEnabled
    return this.soundsEnabled
  }

  getSoundsEnabled() {
    return this.soundsEnabled
  }
}

// Real leaderboard storage using localStorage and on-chain integration
class LeaderboardManager {
  private storageKey = 'pacmon_leaderboard'
  private maxEntries = 10

  getLeaderboard(): OnChainScore[] {
    try {
      const stored = localStorage.getItem(this.storageKey)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  addScore(address: string, score: number, playerName?: string): OnChainScore[] {
    const currentScores = this.getLeaderboard()
    const newScore: OnChainScore = {
      address,
      score,
      timestamp: Date.now(),
      playerName: playerName || `Player ${address.slice(0, 6)}...${address.slice(-4)}`
    }

    // Remove old score from same address if exists
    const filtered = currentScores.filter(s => s.address.toLowerCase() !== address.toLowerCase())
    
    // Add new score and sort
    filtered.push(newScore)
    filtered.sort((a, b) => b.score - a.score)

    // Keep only top entries
    const trimmed = filtered.slice(0, this.maxEntries)

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed))
    } catch (error) {
      console.error('Failed to save leaderboard:', error)
    }

    return trimmed
  }

  getUserBestScore(address: string): number | null {
    const scores = this.getLeaderboard()
    const userScore = scores.find(s => s.address.toLowerCase() === address.toLowerCase())
    return userScore?.score || null
  }
}

export default function PacmonGame() {
  const canvasRef = useRef(null)
  const gameLoopRef = useRef(null)
  const soundManagerRef = useRef(null)
  const leaderboardManagerRef = useRef(null)
  
  const { isEthProviderAvailable } = useFrame()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: hash, sendTransaction } = useSendTransaction()
  const { switchChain } = useSwitchChain()
  const { connect } = useConnect()
  const publicClient = usePublicClient()
  
  const [scoreSaved, setScoreSaved] = useState(false)
  const [gameState, setGameState] = useState({
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
    powerModeStartTime: 0,
    highScore: 0,
    userOnChainScore: null,
    onChainScores: [],
    showLeaderboard: false,
    currentLevel: 1,
    totalPelletsInLevel: 0,
    levelStartTime: 0,
    gameSpeed: 200,
    pacmanMouthAngle: 0
  })

  // Initialize managers
  useEffect(() => {
    soundManagerRef.current = new SoundManager()
    leaderboardManagerRef.current = new LeaderboardManager()
    
    // Load initial leaderboard
    const scores = leaderboardManagerRef.current.getLeaderboard()
    setGameState(prev => ({
      ...prev,
      onChainScores: scores,
      highScore: scores[0]?.score || 0,
      userOnChainScore: address ? leaderboardManagerRef.current!.getUserBestScore(address) : null
    }))
  }, [address])

  // Initialize level
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
    const ghostCount = Math.min(levelConfig.ghostCount, 4)
    
    // Initialize ghosts with classic colors
    const ghosts: Ghost[] = []
    const ghostTypes = ['blinky', 'pinky', 'inky', 'clyde']
    const ghostColors = [
      COLORS.GHOST_RED, 
      COLORS.GHOST_PINK, 
      COLORS.GHOST_CYAN, 
      COLORS.GHOST_ORANGE
    ]
    
    for (let i = 0; i < ghostCount; i++) {
      ghosts.push({
        id: i + 1,
        position: { x: 10 + (i % 2), y: 9 + Math.floor(i / 2) },
        direction: { x: i % 2 === 0 ? 1 : -1, y: 0 },
        color: ghostColors[i],
        vulnerable: false,
        type: ghostTypes[i] as 'blinky' | 'pinky' | 'inky' | 'clyde',
        scatterTarget: { x: 19 - (i % 2) * 18, y: i < 2 ? 0 : 20 },
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
      powerModeTimer: 0,
      pacmanMouthAngle: 0
    }))
  }, [])

  // Initialize first level
  useEffect(() => {
    initializeLevel(1)
  }, [initializeLevel])

  // Game loop
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
          
          // Update Pacman mouth animation
          newState.pacmanMouthAngle = (newState.pacmanMouthAngle + 0.3) % (Math.PI * 2)
          
          // Move Pacman
          let newPacmonPos = {
            x: newState.pacmon.x + newState.pacmonDirection.x,
            y: newState.pacmon.y + newState.pacmonDirection.y
          }

          // Handle screen wrapping (tunnel effect)
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
              newState.powerModeStartTime = currentTime
              soundManagerRef.current?.play('powerPellet')
            }
          } else {
            // Stop Pacman if hits a wall
            newState.pacmonDirection = { x: 0, y: 0 }
          }

          // Update power mode timer
          if (newState.powerMode) {
            const elapsed = currentTime - newState.powerModeStartTime
            if (elapsed >= newState.powerModeTimer) {
              newState.powerMode = false
              newState.powerModeTimer = 0
            }
          }

          // Move ghosts
          newState.ghosts = newState.ghosts.map(ghost => {
            if (currentTime - ghost.lastMoveTime < (300 / ghost.speed)) {
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

            // AI behavior
            let targetTile: Position
            if (newState.powerMode) {
              // Run away from Pacman
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
              
              // Move away from Pacman
              const bestDirection = validDirections.reduce((best, dir) => {
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
                x: ghost.position.x + bestDirection.x, 
                y: ghost.position.y + bestDirection.y 
              }
            } else {
              // Chase Pacman with different strategies per ghost
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
                  soundManagerRef.current?.play('gameOver')
                }
              }
            }
          })
          
          // Check level complete
          if (newState.pellets.length === 0 && newState.powerPellets.length === 0) {
            newState.gameStatus = 'levelTransition'
            const levelBonus = newState.currentLevel * 100
            newState.score += levelBonus
            soundManagerRef.current?.play('levelComplete')
            
            // Auto-advance to next level after a delay
            setTimeout(() => {
              setGameState(prev => ({
                ...prev,
                gameStatus: 'playing'
              }))
              initializeLevel(newState.currentLevel + 1)
            }, 2000)
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

    // Check if new direction is valid
    const maze = getMazeForLevel(gameState.currentLevel)
    const nextX = gameState.pacmon.x + newDirection.x
    const nextY = gameState.pacmon.y + newDirection.y

    if (nextY >= 0 && nextY < GRID_SIZE && maze[nextY] && maze[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.currentLevel])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const maze = getMazeForLevel(gameState.currentLevel)

    // Clear canvas with black background
    ctx.fillStyle = COLORS.BACKGROUND_BLACK
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze walls
    ctx.fillStyle = COLORS.WALL_BLUE
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (maze[y][x] === 1) {
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
        }
      }
    }

    // Draw pellets
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

    // Draw power pellets with flashing effect
    const powerPelletFlash = Math.sin(Date.now() * 0.008) > 0
    if (powerPelletFlash) {
      ctx.fillStyle = COLORS.POWER_PELLET_YELLOW
      gameState.powerPellets.forEach(pellet => {
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
    }

    // Draw Pacman with classic yellow color and mouth animation
    ctx.fillStyle = COLORS.PACMAN_YELLOW
    ctx.beginPath()
    
    const pacX = gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2
    const pacY = gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2
    const radius = CELL_SIZE / 2 - 2
    
    // Calculate mouth angle based on direction
    let startAngle = 0.2 * Math.PI
    let endAngle = 1.8 * Math.PI
    
    if (gameState.pacmonDirection.x === 1) {
      // Moving right
      startAngle = 0.2 * Math.PI
      endAngle = 1.8 * Math.PI
    } else if (gameState.pacmonDirection.x === -1) {
      // Moving left
      startAngle = 1.2 * Math.PI
      endAngle = 0.8 * Math.PI
    } else if (gameState.pacmonDirection.y === -1) {
      // Moving up
      startAngle = 1.7 * Math.PI
      endAngle = 1.3 * Math.PI
    } else if (gameState.pacmonDirection.y === 1) {
      // Moving down
      startAngle = 0.7 * Math.PI
      endAngle = 0.3 * Math.PI
    }
    
    // Animate mouth opening/closing
    const mouthAnimation = Math.sin(gameState.pacmanMouthAngle)
    const mouthOpenness = Math.abs(mouthAnimation) * 0.3
    startAngle += mouthOpenness
    endAngle -= mouthOpenness
    
    ctx.arc(pacX, pacY, radius, startAngle, endAngle)
    ctx.lineTo(pacX, pacY)
    ctx.fill()

    // Draw ghosts with classic appearance
    gameState.ghosts.forEach(ghost => {
      let ghostColor = ghost.color
      
      if (ghost.vulnerable && !ghost.eaten) {
        // Flashing blue when vulnerable
        const flash = Math.sin(Date.now() * 0.01) > 0
        ghostColor = flash ? COLORS.GHOST_BLUE : COLORS.GHOST_WHITE
      } else if (ghost.eaten) {
        ghostColor = COLORS.BACKGROUND_BLACK
      }
      
      const gX = ghost.position.x * CELL_SIZE + CELL_SIZE / 2
      const gY = ghost.position.y * CELL_SIZE + CELL_SIZE / 2
      const gRadius = CELL_SIZE / 2 - 2
      
      // Draw ghost body (semicircle + rectangle)
      ctx.fillStyle = ghostColor
      ctx.beginPath()
      ctx.arc(gX, gY, gRadius, Math.PI, 2 * Math.PI)
      ctx.rect(gX - gRadius, gY, gRadius * 2, gRadius)
      ctx.fill()
      
      // Draw ghost bottom wavy edge
      ctx.beginPath()
      ctx.moveTo(gX - gRadius, gY + gRadius)
      for (let i = 0; i <= 4; i++) {
        const waveX = gX - gRadius + (i * gRadius / 2)
        const waveY = gY + gRadius + ((i % 2) * 3)
        ctx.lineTo(waveX, waveY)
      }
      ctx.lineTo(gX + gRadius, gY + gRadius)
      ctx.fill()
      
      // Draw eyes (unless eaten)
      if (!ghost.eaten) {
        ctx.fillStyle = COLORS.GHOST_WHITE
        // Left eye
        ctx.fillRect(gX - 6, gY - 4, 4, 6)
        // Right eye
        ctx.fillRect(gX + 2, gY - 4, 4, 6)
        
        // Draw pupils based on direction
        ctx.fillStyle = COLORS.BACKGROUND_BLACK
        // Left pupil
        ctx.fillRect(gX - 6 + ghost.direction.x, gY - 4 + ghost.direction.y + 2, 2, 2)
        // Right pupil
        ctx.fillRect(gX + 2 + ghost.direction.x, gY - 4 + ghost.direction.y + 2, 2, 2)
      }
    })

    // Draw level transition overlay
    if (gameState.gameStatus === 'levelTransition') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      
      ctx.fillStyle = COLORS.TEXT_YELLOW
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        `Level ${gameState.currentLevel} Complete!`,
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2
      )
    }

  }, [gameState])

  // Start game
  const startGame = () => {
    setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
    soundManagerRef.current?.play('pelletEat')
  }

  // Restart game
  const restartGame = () => {
    setGameState(prev => ({
      ...prev,
      pacmon: { x: 10, y: 15 },
      pacmonDirection: { x: 0, y: 0 },
      score: 0,
      lives: 3,
      gameStatus: 'playing',
      powerMode: false,
      powerModeTimer: 0,
      currentLevel: 1,
      pacmanMouthAngle: 0
    }))
    initializeLevel(1)
  }

  // Save score to leaderboard
  const saveScore = async () => {
    if (!leaderboardManagerRef.current || !address) return

    try {
      const updatedScores = leaderboardManagerRef.current.addScore(address, gameState.score)
      setGameState(prev => ({
        ...prev,
        onChainScores: updatedScores,
        userOnChainScore: gameState.score,
        highScore: Math.max(prev.highScore, gameState.score)
      }))
      setScoreSaved(true)

      // Optional: Save to blockchain
      if (isConnected && chainId === monadTestnet.id && sendTransaction) {
        try {
          await sendTransaction({
            to: '0x1F0e9dcd371af37AD20E96A5a193d78052dCA984',
            value: parseEther('0.001'), // Small fee
            data: encodeFunctionData({
              abi: [{ name: 'saveScore', type: 'function', inputs: [{ name: 'score', type: 'uint256' }] }],
              functionName: 'saveScore',
              args: [BigInt(gameState.score)]
            })
          })
        } catch (error) {
          console.error('Blockchain save failed:', error)
        }
      }
    } catch (error) {
      console.error('Failed to save score:', error)
    }
  }

  // Connect wallet
  const connectWallet = async () => {
    if (!isEthProviderAvailable) return
    
    try {
      await connect({ connector: farcasterFrame() })
      if (chainId !== monadTestnet.id) {
        await switchChain({ chainId: monadTestnet.id })
      }
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }

  // Mobile controls
  const handleMobileMove = (direction: string) => {
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

    if (nextY >= 0 && nextY < GRID_SIZE && maze[nextY] && maze[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
    }
  }

  return (
    

      {/* Game Title */}
      

        
PACMON

        
Classic Arcade Gaming on Monad


      


      {/* Game Stats */}
      

        
Score: {gameState.score.toLocaleString()}

        
Level: {gameState.currentLevel}

        
Lives: {'❤️'.repeat(gameState.lives)}

      


      {/* Game Canvas */}
      

        


      {/* Mobile Controls */}
      

        

         handleMobileMove('up')}
          className="bg-blue-600 text-white p-2 rounded-lg active:bg-blue-700"
        >
          ↑
        
        

         handleMobileMove('left')}
          className="bg-blue-600 text-white p-2 rounded-lg active:bg-blue-700"
        >
          ←
        
        

         handleMobileMove('right')}
          className="bg-blue-600 text-white p-2 rounded-lg active:bg-blue-700"
        >
          →
        
        

         handleMobileMove('down')}
          className="bg-blue-600 text-white p-2 rounded-lg active:bg-blue-700"
        >
          ↓
        
        

      


      {/* Game Controls */}
      

        {gameState.gameStatus === 'pregame' && (
          
            START GAME
          
        )}
        
        {gameState.gameStatus === 'postGame' && (
          <>
            
              PLAY AGAIN
            
            {!scoreSaved && (
              
                SAVE SCORE
              
            )}
          
        )}

         setGameState(prev => ({ ...prev, showLeaderboard: !prev.showLeaderboard }))}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          {gameState.showLeaderboard ? 'HIDE' : 'SHOW'} LEADERBOARD
        

        {!isConnected && (
          
            CONNECT WALLET
          
        )}
      


      {/* Instructions */}
      

        
Use ARROW KEYS or WASD to move • Eat all pellets to advance


        
Use the directional buttons to move • Eat all pellets to advance


        
Power pellets make ghosts vulnerable • Avoid ghosts when they're not blue


      


      {/* Leaderboard */}
      {gameState.showLeaderboard && (
        

          
🏆 LEADERBOARD

          

            {gameState.onChainScores.length === 0 ? (
              
No scores yet. Be the first!


            ) : (
              gameState.onChainScores.slice(0, 10).map((score, index) => (
                

                  

                    
                      #{index + 1}
                    
                    
                      {score.playerName || `${score.address.slice(0, 6)}...${score.address.slice(-4)}`}
                    
                  

                  
                    {score.score.toLocaleString()}
                  
                

              ))
            )}
          

          {isConnected && (
            

              

                Your Best: 
                  {gameState.userOnChainScore?.toLocaleString() || '0'}
                
              


            

          )}
        

      )}

      {/* Wallet Status */}
      {isConnected && (
        

          
🟢 Connected: {address?.slice(0, 6)}...{address?.slice(-4)}


          {chainId !== monadTestnet.id && (
            
⚠️ Please switch to Monad Testnet


          )}
        

      )}
    

  )
}