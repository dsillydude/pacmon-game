'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useFrame } from '@/components/farcaster-provider'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'
import { parseEther, encodeFunctionData, keccak256, toHex, Address } from 'viem'
import { monadTestnet } from 'viem/chains'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
  usePublicClient,
} from 'wagmi'
// Add these imports at the top
import { 
  useReadContract, 
  useWriteContract, 
  useWaitForTransactionReceipt 
} from 'wagmi'

import { 
  LEADERBOARD_CONTRACT_ADDRESS, 
  LEADERBOARD_ABI, 
  OnChainScore, 
  PlayerStats 
} from '@/lib/contract'



// Enhanced color palette matching reference image
const COLORS = {
  MONAD_PURPLE: '#836EF9',
  MONAD_BLUE: '#200052',
  MONAD_BERRY: '#A0055D',
  MONAD_OFF_WHITE: '#FBFAF9',
  MONAD_BLACK: '#000000', // Pure black background
  WHITE: '#FFFFFF',
  GREEN: '#00FF00',
  ORANGE: '#FFA500',
  // New colors for enhanced design
  ELECTRIC_BLUE: '#0080FF', // Bright blue for walls
  PELLET_ORANGE: '#FFB000', // Orange for pellets
  GHOST_RED: '#FF0000',
  GHOST_PINK: '#FFB8FF',
  GHOST_CYAN: '#00FFFF',
  GHOST_YELLOW: '#FFFF00'
}

// Enhanced game constants
const GRID_SIZE = 21 // Increased to match reference image
const CELL_SIZE = 18 // Slightly smaller for better fit
const GAME_WIDTH = GRID_SIZE * CELL_SIZE
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE

// Replace the contract address constant
const SCORE_CONTRACT_ADDRESS = LEADERBOARD_CONTRACT_ADDRESS

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
  speed: number // Added speed for difficulty scaling
}

interface GameState {
  pacmon: Position
  pacmonDirection: Position
  ghosts: Ghost[]
  pellets: Position[]
  powerPellets: Position[]
  score: number
  lives: number
  level: number // Added level system
  gameStatus: 'pregame' | 'playing' | 'gameOver' | 'levelComplete' | 'postGame'
  powerMode: boolean
  powerModeTimer: number
  highScore: number
  totalPlayers: number
  totalPlays: number
  userOnChainScore: number | null
  onChainScores: OnChainScore[]
  showLeaderboard: boolean
  gameSpeed: number // Added for progressive difficulty
  isPaused: boolean // Added isPaused state
}

// Sound Manager Class (unchanged)
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

// Enhanced maze layout matching reference image (1 = wall, 0 = empty, 2 = pellet, 3 = power pellet, 4 = ghost house)
const MAZE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,3,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,3,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,2,1],
  [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
  [1,1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1,1],
  [0,0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0,0],
  [1,1,1,1,1,2,1,0,1,4,4,4,1,0,1,2,1,1,1,1,1],
  [0,0,0,0,0,2,0,0,4,4,4,4,4,0,0,2,0,0,0,0,0],
  [1,1,1,1,1,2,1,0,1,4,4,4,1,0,1,2,1,1,1,1,1],
  [0,0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0,0],
  [1,1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,2,1],
  [1,3,2,2,1,2,2,2,2,2,2,2,2,2,2,2,1,2,2,3,1],
  [1,1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1,1],
  [1,2,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,2,2,1,2,2,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
]

export default function PacmonGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const soundManagerRef = useRef<SoundManager | null>(null)
  const { isEthProviderAvailable } = useFrame()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: hash, sendTransaction } = useSendTransaction()
  const { switchChain } = useSwitchChain()
  const { connect } = useConnect()
  const publicClient = usePublicClient()
  const [scoreSaved, setScoreSaved] = useState(false)
  
  // Add contract hooks after your existing hooks
  const { data: topScores, refetch: refetchTopScores } = useReadContract({
    address: LEADERBOARD_CONTRACT_ADDRESS,
    abi: LEADERBOARD_ABI,
    functionName: 'getTopScores',
    args: [10n], // Get top 10 scores
    query: {
      enabled: isConnected && chainId === monadTestnet.id,
    }
  })

  const { data: playerStats, refetch: refetchPlayerStats } = useReadContract({
    address: LEADERBOARD_CONTRACT_ADDRESS,
    abi: LEADERBOARD_ABI,
    functionName: 'getPlayerStats',
    args: [address as Address],
    query: {
      enabled: !!address && isConnected && chainId === monadTestnet.id,
    }
  })

  const { data: totalPlayers } = useReadContract({
    address: LEADERBOARD_CONTRACT_ADDRESS,
    abi: LEADERBOARD_ABI,
    functionName: 'getTotalPlayers',
    query: {
      enabled: isConnected && chainId === monadTestnet.id,
    }
  })

  const { writeContract: submitScore, data: submitHash } = useWriteContract()

  const { isLoading: isSubmitting, isSuccess: isSubmitted } = useWaitForTransactionReceipt({
    hash: submitHash,
  })

  const [gameState, setGameState] = useState<GameState>({
    pacmon: { x: 10, y: 15 },
    pacmonDirection: { x: 0, y: 0 },
    ghosts: [
      { id: 1, position: { x: 10, y: 9 }, direction: { x: 1, y: 0 }, color: COLORS.GHOST_RED, vulnerable: false, type: 'blinky', scatterTarget: { x: 18, y: 0 }, eaten: false, speed: 0.25 },
      { id: 2, position: { x: 9, y: 10 }, direction: { x: -1, y: 0 }, color: COLORS.GHOST_PINK, vulnerable: false, type: 'pinky', scatterTarget: { x: 1, y: 0 }, eaten: false, speed: 0.25 }
    ],
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
    onChainScores: [], // Start with empty array - no mock data
    showLeaderboard: false,
    gameSpeed: 200,
    isPaused: false
  })

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager()
  }, [])

  // Update the loadOnChainScores function
  const loadOnChainScores = useCallback(async () => {
    // Data is now loaded via useReadContract hooks
    if (topScores && playerStats) {
      const formattedScores: OnChainScore[] = (topScores as any[]).map((score: any) => ({
        address: score.player,
        score: Number(score.score),
        timestamp: Number(score.timestamp) * 1000, // Convert to milliseconds
      }))

      setGameState(prev => ({
        ...prev,
        onChainScores: formattedScores,
        userOnChainScore: playerStats ? Number((playerStats as PlayerStats).bestScore) : null,
        highScore: formattedScores[0]?.score || 0,
        totalPlayers: Number(totalPlayers || 0n)
      }))
    }
  }, [topScores, playerStats, totalPlayers])


  // Load on-chain scores when wallet connects
  useEffect(() => {
    if (isConnected && address && chainId === monadTestnet.id) {
      loadOnChainScores()
    }
  }, [isConnected, address, chainId, loadOnChainScores])

  // Initialize pellets and power pellets from maze
  useEffect(() => {
    const pellets: Position[] = []
    const powerPellets: Position[] = []
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (MAZE[y][x] === 2) {
          pellets.push({ x, y })
        } else if (MAZE[y][x] === 3) {
          powerPellets.push({ x, y })
        }
      }
    }
    
    setGameState(prev => ({ ...prev, pellets, powerPellets }))
  }, [])

  // Enhanced game loop with progressive difficulty
  useEffect(() => {
    const gameLoop = setInterval(() => {
      if (gameState.gameStatus === 'playing' && !gameState.isPaused) {
        setGameState(prev => {
          let newState = { ...prev }
          
          // Move Pacmon
          let newPacmonPos = {
            x: newState.pacmon.x + newState.pacmonDirection.x,
            y: newState.pacmon.y + newState.pacmonDirection.y
          }

          // Handle tunnel teleportation
          if (newPacmonPos.x < 0) {
            newPacmonPos.x = GRID_SIZE - 1
          } else if (newPacmonPos.x >= GRID_SIZE) {
            newPacmonPos.x = 0
          }

          // Check for wall collision
          if (newPacmonPos.y >= 0 && newPacmonPos.y < GRID_SIZE &&
              MAZE[newPacmonPos.y][newPacmonPos.x] !== 1) {
            newState.pacmon = newPacmonPos

            // Check pellet collection
            const pelletIndex = newState.pellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (pelletIndex !== -1) {
              newState.pellets = newState.pellets.filter((_, index) => index !== pelletIndex)
              newState.score += 10 * newState.level // Level multiplier
              soundManagerRef.current?.play('pelletEat')
            }

            // Check power pellet collection
            const powerPelletIndex = newState.powerPellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (powerPelletIndex !== -1) {
              newState.powerPellets = newState.powerPellets.filter((_, index) => index !== powerPelletIndex)
              newState.score += 50 * newState.level // Level multiplier
              newState.powerMode = true
              // Power mode duration decreases with level
              newState.powerModeTimer = Math.max(20, 35 - newState.level * 2)
              soundManagerRef.current?.play('powerPellet')
            }
          } else {
            // Stop Pacmon if hits a wall
            newState.pacmonDirection = { x: 0, y: 0 }
          }

          // Enhanced ghost movement with level-based speed
          newState.ghosts = newState.ghosts.map(ghost => {
            if (ghost.eaten) {
              // Eaten ghosts return to ghost house
              if (ghost.position.x === 10 && (ghost.position.y === 9 || ghost.position.y === 10)) {
                return { ...ghost, eaten: false, vulnerable: false }
              }
              // Path back to ghost house
              const target = { x: 10, y: 9 }
              const dx = target.x - ghost.position.x
              const dy = target.y - ghost.position.y
              let newDirection = { x: 0, y: 0 }

              if (Math.abs(dx) > Math.abs(dy)) {
                newDirection.x = dx > 0 ? 1 : -1
              } else {
                newDirection.y = dy > 0 ? 1 : -1
              }
              
              let newPos = { x: ghost.position.x + newDirection.x, y: ghost.position.y + newDirection.y }
              
              // Handle tunnel for ghosts
              if (newPos.x < 0) newPos.x = GRID_SIZE - 1
              else if (newPos.x >= GRID_SIZE) newPos.x = 0
              
              return { ...ghost, direction: newDirection, position: newPos }
            }

            let targetTile: Position
            if (newState.powerMode) {
              // Frightened mode: random movement away from Pacman
              const directions = [
                { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
              ]
              const validDirections = directions.filter(dir => {
                let testPos = {
                  x: ghost.position.x + dir.x,
                  y: ghost.position.y + dir.y
                }
                // Handle tunnel
                if (testPos.x < 0) testPos.x = GRID_SIZE - 1
                else if (testPos.x >= GRID_SIZE) testPos.x = 0
                
                return testPos.y >= 0 && testPos.y < GRID_SIZE && 
                       MAZE[testPos.y][testPos.x] !== 1
              })
              
              // Prefer directions away from Pacman
              const awayDirections = validDirections.filter(dir => {
                const testPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
                const currentDist = Math.abs(ghost.position.x - newState.pacmon.x) + Math.abs(ghost.position.y - newState.pacmon.y)
                const newDist = Math.abs(testPos.x - newState.pacmon.x) + Math.abs(testPos.y - newState.pacmon.y)
                return newDist > currentDist
              })
              
              const chosenDirections = awayDirections.length > 0 ? awayDirections : validDirections
              const newDirection = chosenDirections[Math.floor(Math.random() * chosenDirections.length)] || { x: 0, y: 0 }
              
              let newPos = { x: ghost.position.x + newDirection.x, y: ghost.position.y + newDirection.y }
              if (newPos.x < 0) newPos.x = GRID_SIZE - 1
              else if (newPos.x >= GRID_SIZE) newPos.x = 0
              
              return { ...ghost, direction: newDirection, position: newPos, vulnerable: true }
            } else {
              // Enhanced AI based on ghost type
              switch (ghost.type) {
                case 'blinky':
                  targetTile = newState.pacmon
                  break
                case 'pinky':
                  targetTile = {
                    x: Math.max(0, Math.min(GRID_SIZE - 1, newState.pacmon.x + newState.pacmonDirection.x * 4)),
                    y: Math.max(0, Math.min(GRID_SIZE - 1, newState.pacmon.y + newState.pacmonDirection.y * 4))
                  }
                  break
                case 'inky':
                  const blinky = newState.ghosts.find(g => g.type === 'blinky')
                  if (blinky) {
                    const pacmanTwoAhead = {
                      x: Math.max(0, Math.min(GRID_SIZE - 1, newState.pacmon.x + newState.pacmonDirection.x * 2)),
                      y: Math.max(0, Math.min(GRID_SIZE - 1, newState.pacmon.y + newState.pacmonDirection.y * 2))
                    }
                    const vector = {
                      x: pacmanTwoAhead.x - blinky.position.x,
                      y: pacmanTwoAhead.y - blinky.position.y
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

            // Improved pathfinding
            const possibleDirections = [
              { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
            ]
            let bestDirection = ghost.direction
            let minDistance = Infinity

            possibleDirections.forEach(dir => {
              let nextPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
              
              // Handle tunnel
              if (nextPos.x < 0) nextPos.x = GRID_SIZE - 1
              else if (nextPos.x >= GRID_SIZE) nextPos.x = 0
              
              if (nextPos.y >= 0 && nextPos.y < GRID_SIZE && MAZE[nextPos.y][nextPos.x] !== 1) {
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

            let newPos = { x: ghost.position.x + bestDirection.x, y: ghost.position.y + bestDirection.y }
            if (newPos.x < 0) newPos.x = GRID_SIZE - 1
            else if (newPos.x >= GRID_SIZE) newPos.x = 0

            return { 
              ...ghost, 
              direction: bestDirection, 
              position: newPos, 
              vulnerable: newState.powerMode,
              speed: Math.min(3, 1 + Math.floor(newState.level / 3)) // Increase speed with level
            }
          })
          
          // Check ghost collisions
          newState.ghosts.forEach(ghost => {
            if (ghost.position.x === newState.pacmon.x && ghost.position.y === newState.pacmon.y) {
              if (ghost.vulnerable) {
                // Eat ghost
                newState.score += 200 * newState.level // Level multiplier
                ghost.eaten = true
                ghost.vulnerable = false
                soundManagerRef.current?.play('ghostEat')
              } else if (!ghost.eaten) {
                // Lose life
                newState.lives -= 1
                newState.pacmon = { x: 10, y: 15 } // Reset Pacmon position
                newState.pacmonDirection = { x: 0, y: 0 }
                // Reset ghosts to ghost house
                newState.ghosts = newState.ghosts.map(g => ({ 
                  ...g, 
                  position: { x: 10, y: 9 + (g.id - 1) }, 
                  direction: { x: 1, y: 0 }, 
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
            newState.level += 1
            newState.score += 1000 * newState.level // Level completion bonus
            newState.gameSpeed = Math.max(100, newState.gameSpeed - 10) // Increase game speed
            
            // Reset level with faster gameplay
            const pellets: Position[] = []
            const powerPellets: Position[] = []
            
            for (let y = 0; y < GRID_SIZE; y++) {
              for (let x = 0; x < GRID_SIZE; x++) {
                if (MAZE[y][x] === 2) {
                  pellets.push({ x, y })
                } else if (MAZE[y][x] === 3) {
                  powerPellets.push({ x, y })
                }
              }
            }
            
            newState.pellets = pellets
            newState.powerPellets = powerPellets
            newState.pacmon = { x: 10, y: 15 }
            newState.pacmonDirection = { x: 0, y: 0 }
            
            // Reset ghosts with increased speed
            newState.ghosts = newState.ghosts.map((g, index) => ({ 
              ...g, 
              position: { x: 10, y: 9 + index }, 
              direction: { x: 1, y: 0 }, 
              vulnerable: false, 
              eaten: false,
              speed: Math.min(3, 1 + Math.floor(newState.level / 3))
            }))
          }
          
          return newState
        })
      }
    }, gameState.gameSpeed)

    return () => clearInterval(gameLoop)
  }, [gameState.gameStatus, gameState.gameSpeed, gameState.isPaused])

  // Handle keyboard input (unchanged)
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

    // Check if direction is valid
    let nextX = gameState.pacmon.x + newDirection.x
    let nextY = gameState.pacmon.y + newDirection.y

    // Handle tunnel
    if (nextX < 0) nextX = GRID_SIZE - 1
    else if (nextX >= GRID_SIZE) nextX = 0

    if (nextY >= 0 && nextY < GRID_SIZE && MAZE[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
    }
  }, [gameState.pacmon, gameState.gameStatus])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // Enhanced render with new colors and design
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas with pure black background
    ctx.fillStyle = COLORS.MONAD_BLACK
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze with electric blue walls
    ctx.fillStyle = COLORS.ELECTRIC_BLUE
    ctx.strokeStyle = COLORS.ELECTRIC_BLUE
    ctx.lineWidth = 2
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (MAZE[y][x] === 1) {
          // Draw rounded rectangle for walls
          const cornerRadius = 2
          ctx.beginPath()
          ctx.roundRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2, cornerRadius)
          ctx.fill()
        }
      }
    }

    // Draw pellets with orange color
    ctx.fillStyle = COLORS.PELLET_ORANGE
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

    // Draw power pellets with larger orange circles
    ctx.fillStyle = COLORS.PELLET_ORANGE
    gameState.powerPellets.forEach(pellet => {
      ctx.beginPath()
      ctx.arc(
        pellet.x * CELL_SIZE + CELL_SIZE / 2,
        pellet.y * CELL_SIZE + CELL_SIZE / 2,
        7,
        0,
        2 * Math.PI
      )
      ctx.fill()
      
      // Add glow effect
      ctx.shadowColor = COLORS.PELLET_ORANGE
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.shadowBlur = 0
    })

    // Draw Pacmon (keep purple as requested)
    ctx.fillStyle = COLORS.MONAD_PURPLE
    ctx.beginPath()
    
    // Determine mouth direction based on movement
    let startAngle = 0.2 * Math.PI
    let endAngle = 1.8 * Math.PI
    
    if (gameState.pacmonDirection.x > 0) { // Right
      startAngle = 0.2 * Math.PI
      endAngle = 1.8 * Math.PI
    } else if (gameState.pacmonDirection.x < 0) { // Left
      startAngle = 1.2 * Math.PI
      endAngle = 0.8 * Math.PI
    } else if (gameState.pacmonDirection.y > 0) { // Down
      startAngle = 0.7 * Math.PI
      endAngle = 0.3 * Math.PI
    } else if (gameState.pacmonDirection.y < 0) { // Up
      startAngle = 1.7 * Math.PI
      endAngle = 1.3 * Math.PI
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

    // Draw ghosts with enhanced colors and design
    gameState.ghosts.forEach(ghost => {
      ctx.fillStyle = ghost.vulnerable ? COLORS.MONAD_BLUE : ghost.color
      
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
      
      // Ghost bottom wavy edge
      ctx.beginPath()
      const bottomY = ghost.position.y * CELL_SIZE + CELL_SIZE - 2
      const leftX = ghost.position.x * CELL_SIZE + 2
      const rightX = ghost.position.x * CELL_SIZE + CELL_SIZE - 2
      const waveHeight = 3
      
      ctx.moveTo(leftX, bottomY - waveHeight)
      for (let i = 0; i < 4; i++) {
        const x = leftX + (i + 0.5) * (CELL_SIZE - 4) / 4
        ctx.lineTo(x, bottomY - (i % 2 === 0 ? 0 : waveHeight))
      }
      ctx.lineTo(rightX, bottomY - waveHeight)
      ctx.lineTo(rightX, ghost.position.y * CELL_SIZE + CELL_SIZE / 2)
      ctx.lineTo(leftX, ghost.position.y * CELL_SIZE + CELL_SIZE / 2)
      ctx.closePath()
      ctx.fill()
      
      // Ghost eyes
      ctx.fillStyle = COLORS.WHITE
      const eyeSize = 3
      const eyeY = ghost.position.y * CELL_SIZE + 6
      
      // Left eye
      ctx.fillRect(
        ghost.position.x * CELL_SIZE + 5,
        eyeY,
        eyeSize,
        eyeSize
      )
      
      // Right eye
      ctx.fillRect(
        ghost.position.x * CELL_SIZE + CELL_SIZE - 8,
        eyeY,
        eyeSize,
        eyeSize
      )
      
      // Eye pupils
      ctx.fillStyle = COLORS.MONAD_BLACK
      const pupilSize = 1
      ctx.fillRect(
        ghost.position.x * CELL_SIZE + 6,
        eyeY + 1,
        pupilSize,
        pupilSize
      )
      ctx.fillRect(
        ghost.position.x * CELL_SIZE + CELL_SIZE - 7,
        eyeY + 1,
        pupilSize,
        pupilSize
      )
    })
  }, [gameState])

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

  // Update the score submission handler
  const handleScoreSubmission = async () => {
    if (!isConnected || chainId !== monadTestnet.id || !address) {
      return
    }

    try {
      await submitScore({
        address: LEADERBOARD_CONTRACT_ADDRESS,
        abi: LEADERBOARD_ABI,
        functionName: 'submitScore',
        args: [BigInt(gameState.score), BigInt(gameState.level)],
        value: parseEther("0.015")
      })
    } catch (error) {
      console.error("Score submission failed:", error)
    }
  }

  // Update the useEffect for handling successful submissions
  useEffect(() => {
    if (isSubmitted && submitHash) {
      setScoreSaved(true)
      // Refetch data to update leaderboard
      refetchTopScores()
      refetchPlayerStats()
      
      // Update local state
      setGameState(prev => ({
        ...prev,
        userOnChainScore: prev.score
      }))
    }
  }, [isSubmitted, submitHash, refetchTopScores, refetchPlayerStats])

  const startGame = () => {
    if (!isConnected) {
      handleWalletConnect()
    } else if (chainId !== monadTestnet.id) {
      switchChain({ chainId: monadTestnet.id })
    } else {
      setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
      soundManagerRef.current?.playBackgroundMusic()
    }
  }

  const restartGame = () => {
    setScoreSaved(false) // Reset score saved state
    setGameState(prev => ({
      ...prev,
      pacmon: { x: 10, y: 15 },
      pacmonDirection: { x: 0, y: 0 },
      ghosts: [
        { id: 1, position: { x: 10, y: 9 }, direction: { x: 1, y: 0 }, color: COLORS.GHOST_RED, vulnerable: false, type: 'blinky', scatterTarget: { x: 18, y: 0 }, eaten: false, speed: 0.25 },
        { id: 2, position: { x: 9, y: 10 }, direction: { x: -1, y: 0 }, color: COLORS.GHOST_PINK, vulnerable: false, type: 'pinky', scatterTarget: { x: 1, y: 0 }, eaten: false, speed: 0.25 }
      ],
      score: 0,
      lives: 3,
      level: 1,
      gameStatus: 'playing',
      powerMode: false,
      powerModeTimer: 0,
      gameSpeed: 200,
      isPaused: false
    }))
    
    // Reinitialize pellets
    const pellets: Position[] = []
    const powerPellets: Position[] = []
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (MAZE[y][x] === 2) {
          pellets.push({ x, y })
        } else if (MAZE[y][x] === 3) {
          powerPellets.push({ x, y })
        }
      }
    }
    
    setGameState(prev => ({ ...prev, pellets, powerPellets }))
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

  // Handle mobile controls
  const handleDirectionPress = useCallback((direction: Position) => {
    if (gameState.gameStatus !== 'playing') return

    let nextX = gameState.pacmon.x + direction.x
    let nextY = gameState.pacmon.y + direction.y

    // Handle tunnel
    if (nextX < 0) nextX = GRID_SIZE - 1
    else if (nextX >= GRID_SIZE) nextX = 0

    if (nextY >= 0 && nextY < GRID_SIZE && MAZE[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: direction }))
    }
  }, [gameState.pacmon, gameState.gameStatus])

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
      {gameState.gameStatus === 'pregame' && !gameState.showLeaderboard && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">
              PACMON
            </h1>
            <div className="space-y-3 text-center" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              <div className="text-lg md:text-xl font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                Leaderboard - Real Player Scores Only
              </div>
              <div className="space-y-2 bg-black bg-opacity-30 rounded-lg p-4">
                {gameState.onChainScores.slice(0, 3).map((score, index) => (
                  <div key={index} className="flex items-center justify-between text-base md:text-lg" style={{ 
                    color: index === 0 ? COLORS.MONAD_BERRY : index === 1 ? COLORS.MONAD_BLUE : COLORS.MONAD_OFF_WHITE 
                  }}>
                    <span className="flex items-center">
                      <span className="text-xl mr-2">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                      <span className="font-bold">{index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'}</span>
                    </span>
                    <span className="font-mono">{score.score.toLocaleString()}</span>
                    <span className="text-sm font-mono">{`${score.address.slice(0, 4)}...${score.address.slice(-4)}`}</span>
                  </div>
                ))}
                {gameState.onChainScores.length === 0 && (
                  <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                    No scores saved yet - be the first!
                  </div>
                )}
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
               'Start Game'}
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
            <p>Enhanced with progressive difficulty and improved maze design!</p>
            <p className="mt-1">Eat all pellets while avoiding ghosts - levels get harder!</p>
            <p className="mt-2 text-xs" style={{ color: COLORS.MONAD_PURPLE }}>
              Submit your score to the blockchain for 0.015 MON!
            </p>
          </div>
        </div>
      )}

      {gameState.showLeaderboard && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
              Leaderboard
            </h2>
            <p className="text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Real player scores only - no mock data
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
                <p className="mt-2 text-sm">Be the first to save your score!</p>
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

      {(gameState.gameStatus === 'playing') && (
        <div className="flex flex-col h-screen w-full">
          <div className="text-center py-2" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
            <h1 className="text-xl md:text-2xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
              PACMON
            </h1>
            <div className="flex justify-center space-x-4 text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              <div>Score: {gameState.score}</div>
              <div>Lives: {gameState.lives}</div>
              <div>Level: {gameState.level}</div>
              {gameState.powerMode && (
                <div style={{ color: COLORS.MONAD_PURPLE }}>
                  Power: {Math.ceil(gameState.powerModeTimer / 5)}s
                </div>
              )}
              <button
                onClick={() => setGameState(prev => ({ ...prev, isPaused: !prev.isPaused }))}
                className="text-xs px-2 py-1 rounded"
                style={{ 
                  backgroundColor: COLORS.MONAD_BLUE, 
                  color: COLORS.WHITE 
                }}
              >
                {gameState.isPaused ? '▶️ Play' : '⏸️ Pause'}
              </button>
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
                  ↑
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
                    ←
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
                    →
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
                  ↓
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
              Game Over!
            </h2>
            <p className="text-xl md:text-2xl" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Final Score: {gameState.score}
            </p>
            <p className="text-lg" style={{ color: COLORS.PELLET_ORANGE }}>
              Level Reached: {gameState.level}
            </p>
            {gameState.score > (gameState.userOnChainScore || 0) && !scoreSaved && (
              <p className="text-lg" style={{ color: COLORS.GREEN }}>
                🎉 New Personal Best! 🎉
              </p>
            )}
          </div>

          <div className="w-full max-w-md space-y-4 px-4">
            {/* Updated post-game score submission button */}
            {isConnected && chainId === monadTestnet.id && (
              <div className="text-center">
                <button
                  onClick={handleScoreSubmission}
                  disabled={isSubmitting || scoreSaved}
                  className="w-full py-6 px-8 text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: scoreSaved ? COLORS.MONAD_BERRY : COLORS.MONAD_PURPLE,
                    color: COLORS.WHITE 
                  }}
                >
                  {isSubmitting ? 'Saving Score...' : 
                   scoreSaved ? 'Score Saved On-Chain!' : 
                   `Save Score On-Chain (0.015 MON)`}
                </button>
                
                {scoreSaved && (
                  <p className="mt-3 text-sm" style={{ color: COLORS.GREEN }}>
                    Your score has been permanently saved to the blockchain!
                  </p>
                )}
              </div>
            )}

            <button
              onClick={restartGame}
              className="w-full py-6 px-8 text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: COLORS.MONAD_PURPLE, 
                color: COLORS.WHITE 
              }}
            >
              Play Again
            </button>

            <button
              onClick={exitGame}
              className="w-full py-6 px-8 text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: COLORS.MONAD_BERRY, 
                color: COLORS.WHITE 
              }}
            >
              Exit Game
            </button>
          </div>

          <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            <p>Submit your score to compete on the leaderboard!</p>
            <p className="mt-1">Challenge yourself to reach higher levels!</p>
          </div>
        </div>
      )}
    </div>
  )
}