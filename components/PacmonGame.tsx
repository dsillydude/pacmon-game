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
  ORANGE: '#FFA500'
}

// Game constants
const GRID_SIZE = 20
const CELL_SIZE = 20
const GAME_WIDTH = GRID_SIZE * CELL_SIZE
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE

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
  gameStatus: 'pregame' | 'playing' | 'gameOver' | 'levelComplete' | 'postGame'
  powerMode: boolean
  powerModeTimer: number
  highScore: number
  totalPlayers: number
  totalPlays: number
  userOnChainScore: number | null
  onChainScores: OnChainScore[]
  showLeaderboard: boolean
}

// Sound Manager Class
class SoundManager {
  private sounds: { [key: string]: HTMLAudioElement } = {}
  private soundsEnabled: boolean = true

  constructor() {
    this.loadSounds()
  }

  private loadSounds() {
    const soundFiles = {      pelletEat: 
'/sounds/pellet-eat.mp3',      powerPellet: 
'/sounds/power-pellet.mp3',      ghostEat: 
'/sounds/ghost-eat.mp3',      death: 
'/sounds/death.mp3',
      gameOver: 
'/sounds/game-over.mp3',      backgroundMusic: '/sounds/playing-pac-man.mp3',
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

// Simple maze layout (1 = wall, 0 = empty, 2 = pellet, 3 = power pellet)
const MAZE = [
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
  
  const [gameState, setGameState] = useState<GameState>({
    pacmon: { x: 9, y: 15 },
    pacmonDirection: { x: 0, y: 0 },
    ghosts: [
      { id: 1, position: { x: 9, y: 9 }, direction: { x: 1, y: 0 }, color: COLORS.MONAD_BERRY, vulnerable: false, type: 'blinky', scatterTarget: { x: 18, y: 0 }, eaten: false },
      { id: 2, position: { x: 10, y: 9 }, direction: { x: -1, y: 0 }, color: COLORS.MONAD_PURPLE, vulnerable: false, type: 'pinky', scatterTarget: { x: 1, y: 0 }, eaten: false },
      { id: 3, position: { x: 9, y: 10 }, direction: { x: 0, y: 1 }, color: COLORS.MONAD_BLUE, vulnerable: false, type: 'inky', scatterTarget: { x: 18, y: 18 }, eaten: false },
      { id: 4, position: { x: 10, y: 10 }, direction: { x: 0, y: -1 }, color: COLORS.MONAD_OFF_WHITE, vulnerable: false, type: 'clyde', scatterTarget: { x: 1, y: 18 }, eaten: false }
    ],
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
    showLeaderboard: false
  })

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager()
  }, [])

  // Load on-chain scores and user's score
  const loadOnChainScores = useCallback(async () => {
    if (!publicClient || !address) return

    try {
      // Simulate loading on-chain scores (in a real implementation, you would query the blockchain)
      // For now, we'll use mock data that represents what would be stored on-chain
      const mockOnChainScores: OnChainScore[] = [
        { address: '0x1234567890123456789012345678901234567890', score: 2450, timestamp: Date.now() - 86400000 },
        { address: '0x9876543210987654321098765432109876543210', score: 1890, timestamp: Date.now() - 172800000 },
        { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', score: 1650, timestamp: Date.now() - 259200000 },
        { address: '0x1111222233334444555566667777888899990000', score: 1420, timestamp: Date.now() - 345600000 },
        { address: '0x0000999988887777666655554444333322221111', score: 1200, timestamp: Date.now() - 432000000 }
      ]

      // Find user's on-chain score
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

  // Game loop
  useEffect(() => {
    const gameLoop = setInterval(() => {
      if (gameState.gameStatus === 'playing') {
        setGameState(prev => {
          let newState = { ...prev }
          
          // Move Pacmon
          let newPacmonPos = {
            x: newState.pacmon.x + newState.pacmonDirection.x,
            y: newState.pacmon.y + newState.pacmonDirection.y
          }

          // Check for wall collision
          if (newPacmonPos.x >= 0 && newPacmonPos.x < GRID_SIZE &&
              newPacmonPos.y >= 0 && newPacmonPos.y < GRID_SIZE &&
              MAZE[newPacmonPos.y][newPacmonPos.x] !== 1) {
            newState.pacmon = newPacmonPos

            // Check pellet collection
            const pelletIndex = newState.pellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (pelletIndex !== -1) {
              newState.pellets = newState.pellets.filter((_, index) => index !== pelletIndex)
              newState.score += 10
              // Play pellet eat sound
              soundManagerRef.current?.play('pelletEat')
            }

            // Check power pellet collection
            const powerPelletIndex = newState.powerPellets.findIndex(
              pellet => pellet.x === newState.pacmon.x && pellet.y === newState.pacmon.y
            )
            if (powerPelletIndex !== -1) {
              newState.powerPellets = newState.powerPellets.filter((_, index) => index !== powerPelletIndex)
              newState.score += 50
              newState.powerMode = true
              newState.powerModeTimer = 30 // 6 seconds at 200ms intervals
              // Play power pellet sound
              soundManagerRef.current?.play('powerPellet')
            }
          } else {
            // Stop Pacmon if hits a wall
            newState.pacmonDirection = { x: 0, y: 0 }
          }

          // Move ghosts
          newState.ghosts = newState.ghosts.map(ghost => {
            if (ghost.eaten) {
              // Eaten ghosts return to ghost house
              if (ghost.position.x === 9 && ghost.position.y === 9) {
                return { ...ghost, eaten: false, vulnerable: false }
              }
              // Simple path back to ghost house (can be improved)
              const target = { x: 9, y: 9 }
              const dx = target.x - ghost.position.x
              const dy = target.y - ghost.position.y
              let newDirection = { x: 0, y: 0 }

              if (Math.abs(dx) > Math.abs(dy)) {
                newDirection.x = dx > 0 ? 1 : -1
              } else {
                newDirection.y = dy > 0 ? 1 : -1
              }
              return { ...ghost, direction: newDirection, position: { x: ghost.position.x + newDirection.x, y: ghost.position.y + newDirection.y } }
            }

            let targetTile: Position
            if (newState.powerMode) {
              // Frightened mode: random movement
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
                       MAZE[testPos.y][testPos.x] !== 1
              })
              const newDirection = validDirections[Math.floor(Math.random() * validDirections.length)]
              targetTile = { x: ghost.position.x + newDirection.x, y: ghost.position.y + newDirection.y }
            } else {
              // Chase/Scatter mode
              switch (ghost.type) {
                case 'blinky':
                  targetTile = newState.pacmon
                  break
                case 'pinky':
                  // 4 tiles in front of Pac-Man
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
                    targetTile = { x: blinky.position.x + vector.x * 2, y: blinky.position.y + vector.y * 2 }
                  } else {
                    targetTile = newState.pacmon // Fallback
                  }
                  break
                case 'clyde':
                  // Scatter if close to Pac-Man, else chase
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

            // Ghost movement logic (shortest path to target, avoiding walls)
            const possibleDirections = [
              { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
            ]
            let bestDirection = ghost.direction
            let minDistance = Infinity

            possibleDirections.forEach(dir => {
              const nextPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
              if (nextPos.x >= 0 && nextPos.x < GRID_SIZE && nextPos.y >= 0 && nextPos.y < GRID_SIZE && MAZE[nextPos.y][nextPos.x] !== 1) {
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

            return { ...ghost, direction: bestDirection, position: { x: ghost.position.x + bestDirection.x, y: ghost.position.y + bestDirection.y }, vulnerable: newState.powerMode }
          })
          
          // Check ghost collisions
          newState.ghosts.forEach(ghost => {
            if (ghost.position.x === newState.pacmon.x && ghost.position.y === newState.pacmon.y) {
              if (ghost.vulnerable) {
                // Eat ghost
                newState.score += 200
                ghost.eaten = true
                ghost.vulnerable = false
                // Play ghost eat sound
                soundManagerRef.current?.play('ghostEat')
              } else if (!ghost.eaten) {
                // Lose life
                newState.lives -= 1
                newState.pacmon = { x: 9, y: 15 } // Reset Pacmon position
                newState.pacmonDirection = { x: 0, y: 0 } // Stop Pacmon
                newState.ghosts = newState.ghosts.map(g => ({ ...g, position: { x: 9, y: 9 }, direction: { x: 1, y: 0 }, vulnerable: false, eaten: false })) // Reset ghosts
                // Play death sound
                soundManagerRef.current?.play('death')
                if (newState.lives <= 0) {
                  newState.gameStatus = 'postGame'
                  // Stop background music and play game over sound
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
            newState.gameStatus = 'postGame'
            // Stop background music and play game over sound
            soundManagerRef.current?.stopBackgroundMusic()
            soundManagerRef.current?.play('gameOver')
          }
          
          return newState
        })
      }
    }, 200)

    return () => clearInterval(gameLoop)
  }, [gameState.gameStatus])

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

    // Only update direction if the new direction is valid (not a wall in the immediate next cell)
    const nextX = gameState.pacmon.x + newDirection.x
    const nextY = gameState.pacmon.y + newDirection.y

    if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE && MAZE[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
    }
  }, [gameState.pacmon, gameState.gameStatus])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = COLORS.MONAD_BLACK
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze
    ctx.fillStyle = COLORS.MONAD_BLUE
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (MAZE[y][x] === 1) {
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
    ctx.fillStyle = COLORS.MONAD_PURPLE
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

    // Draw Pacmon
    ctx.fillStyle = COLORS.MONAD_PURPLE
    ctx.beginPath()
    ctx.arc(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0.2 * Math.PI,
      1.8 * Math.PI
    )
    ctx.lineTo(
      gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2
    )
    ctx.fill()

    // Draw ghosts
    gameState.ghosts.forEach(ghost => {
      ctx.fillStyle = ghost.vulnerable ? COLORS.MONAD_BERRY : ghost.color
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

    // Start the game after wallet is connected and on correct chain
    setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
    // Start background music
    soundManagerRef.current?.playBackgroundMusic()
  }

  const handleScoreSubmission = async () => {
    if (!isConnected || chainId !== monadTestnet.id) {
      return
    }

    try {
      // Create transaction data for score submission
      // In a real implementation, this would encode a function call to store the score
      const scoreData = toHex(gameState.score, { size: 32 })
      const timestampData = toHex(Math.floor(Date.now() / 1000), { size: 32 })
      
      // Send transaction to store score on-chain
      await sendTransaction({
        to: SCORE_CONTRACT_ADDRESS,
        value: parseEther("0.015"),
        data: `0x${scoreData.slice(2)}${timestampData.slice(2)}` // Combine score and timestamp
      })

      // Update local state to reflect the new on-chain score
      setGameState(prev => ({
        ...prev,
        userOnChainScore: prev.score,
        onChainScores: [
          { address: address!, score: prev.score, timestamp: Date.now() },
          ...prev.onChainScores.filter(s => s.address.toLowerCase() !== address!.toLowerCase())
        ].sort((a, b) => b.score - a.score)
      }))
      setScoreSaved(true) // Set scoreSaved to true on successful submission

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
      setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
      // Start background music
      soundManagerRef.current?.playBackgroundMusic()
    }
  }

  const restartGame = () => {
    setGameState(prev => ({
      ...prev,
      pacmon: { x: 9, y: 15 },
      pacmonDirection: { x: 0, y: 0 },
      ghosts: [
        { id: 1, position: { x: 9, y: 9 }, direction: { x: 1, y: 0 }, color: COLORS.MONAD_BERRY, vulnerable: false, type: 'blinky', scatterTarget: { x: 18, y: 0 }, eaten: false },
        { id: 2, position: { x: 10, y: 9 }, direction: { x: -1, y: 0 }, color: COLORS.MONAD_PURPLE, vulnerable: false, type: 'pinky', scatterTarget: { x: 1, y: 0 }, eaten: false },
        { id: 3, position: { x: 9, y: 10 }, direction: { x: 0, y: 1 }, color: COLORS.MONAD_BLUE, vulnerable: false, type: 'inky', scatterTarget: { x: 18, y: 18 }, eaten: false },
        { id: 4, position: { x: 10, y: 10 }, direction: { x: 0, y: -1 }, color: COLORS.MONAD_OFF_WHITE, vulnerable: false, type: 'clyde', scatterTarget: { x: 1, y: 18 }, eaten: false }
      ],
      score: 0,
      lives: 3,
      gameStatus: 'playing',
      powerMode: false,
      powerModeTimer: 0
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
    
    // Start background music
    soundManagerRef.current?.playBackgroundMusic()
  }

  const exitGame = () => {
    setGameState(prev => ({ ...prev, gameStatus: 'pregame' }))
    // Stop background music
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

    // Only update direction if the new direction is valid (not a wall in the immediate next cell)
    const nextX = gameState.pacmon.x + direction.x
    const nextY = gameState.pacmon.y + direction.y

    if (nextX >= 0 && nextX < GRID_SIZE && nextY >= 0 && nextY < GRID_SIZE && MAZE[nextY][nextX] !== 1) {
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
                Current High Scores Onchain
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
                    Save your score onchain to appear here
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
                  Your Today's Onchain Score
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
            <p>Swipe/Mouse to move, tap/click to play</p>
            <p className="mt-1">Eat all pellets while avoiding ghosts!</p>
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
              Save your score onchain to appear here
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
            {/* Game Canvas Container - Takes up most of the space */}
            <div className="flex-1 flex items-start justify-center pt-4">
              <canvas
                ref={canvasRef}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
                className="max-w-full max-h-full"
                style={{ backgroundColor: COLORS.MONAD_BLACK }}
              />
            </div>
            
            {/* Mobile Controls - Fixed at bottom with larger buttons */}
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
            {gameState.score > (gameState.userOnChainScore || 0) && (
              <p className="text-lg" style={{ color: COLORS.GREEN }}>
                🎉 New Personal Best! 🎉
              </p>
            )}
          </div>

          <div className="w-full max-w-md space-y-4 px-4">
            <button
              onClick={handleScoreSubmission}
              disabled={scoreSaved} // Disable button if score is saved
              className="w-full py-6 px-8 text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: scoreSaved ? COLORS.GREEN : COLORS.MONAD_PURPLE, // Change color if saved
                color: COLORS.WHITE 
              }}
            >
              {scoreSaved ? 'Saved Successfully!' : 'Save Score Onchain [0.015 MON]'}
            </button>

            <button
              onClick={restartGame}
              className="w-full py-6 px-8 text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: COLORS.GREEN, 
                color: COLORS.WHITE 
              }}
            >
              Play Again
            </button>

            <button
              onClick={exitGame}
              className="w-full py-6 px-8 text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: COLORS.ORANGE, 
                color: COLORS.WHITE 
              }}
            >
              Exit Game
            </button>
          </div>

          <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            <p>Submit your score to compete on the leaderboard!</p>
            <p className="mt-1">Or play again to beat your high score!</p>
          </div>
        </div>
      )}
    </div>
  )
}

