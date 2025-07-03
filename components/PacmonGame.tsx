'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useFrame } from '@/components/farcaster-provider'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'
import { parseEther } from 'viem'
import { monadTestnet } from 'viem/chains'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
} from 'wagmi'

// Leaderboard management functions
const getLeaderboard = () => {
  try {
    const stored = localStorage.getItem('pacmon_leaderboard')
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error loading leaderboard:', error)
    return []
  }
}

const updateLeaderboard = (walletAddress: string, score: number) => {
  try {
    const leaderboard = getLeaderboard()
    const shortWallet = walletAddress.slice(0, 4) + '...' + walletAddress.slice(-4)
    
    // Check if wallet already exists
    const existingIndex = leaderboard.findIndex((entry: any) => entry.wallet === shortWallet)
    
    if (existingIndex >= 0) {
      // Update if new score is higher
      if (score > leaderboard[existingIndex].score) {
        leaderboard[existingIndex].score = score
        leaderboard[existingIndex].date = new Date().toISOString()
      }
    } else {
      // Add new entry
      leaderboard.push({
        wallet: shortWallet,
        score,
        date: new Date().toISOString()
      })
    }
    
    // Sort by score (descending) and keep top 10
    leaderboard.sort((a: any, b: any) => b.score - a.score)
    const topLeaderboard = leaderboard.slice(0, 10)
    
    localStorage.setItem('pacmon_leaderboard', JSON.stringify(topLeaderboard))
    return topLeaderboard
  } catch (error) {
    console.error('Error updating leaderboard:', error)
    return []
  }
}

const getTodayHighScore = () => {
  try {
    const leaderboard = getLeaderboard()
    const today = new Date().toDateString()
    
    const todayScores = leaderboard.filter((entry: any) => 
      new Date(entry.date).toDateString() === today
    )
    
    return todayScores.length > 0 ? Math.max(...todayScores.map((entry: any) => entry.score)) : 0
  } catch (error) {
    console.error('Error getting today high score:', error)
    return 0
  }
}

// Monad color palette
const COLORS = {
  MONAD_PURPLE: '#836EF9',
  MONAD_BLUE: '#200052',
  MONAD_BERRY: '#A0055D',
  MONAD_OFF_WHITE: '#FBFAF9',
  MONAD_BLACK: '#0E100F',
  WHITE: '#FFFFFF'
}

// Game constants - Fixed sizing to prevent stretching
const GRID_SIZE = 20
const CELL_SIZE = 18  // Reduced from 20 to prevent stretching
const GAME_WIDTH = GRID_SIZE * CELL_SIZE
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE

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

interface GameState {
  pacmon: Position
  pacmonDirection: Position
  ghosts: Ghost[]
  pellets: Position[]
  powerPellets: Position[]
  score: number
  lives: number
  gameStatus: 'pregame' | 'playing' | 'gameOver' | 'levelComplete'
  powerMode: boolean
  powerModeTimer: number
  highScore: number
  leaderboard: Array<{wallet: string, score: number, date: string}>
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
  const canvasRef = useRef(null)
  const { isEthProviderAvailable } = useFrame()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: hash, sendTransaction } = useSendTransaction()
  const { switchChain } = useSwitchChain()
  const { connect } = useConnect()
  
  const [gameState, setGameState] = useState({
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
    leaderboard: []
  })

  // Load leaderboard and high score on component mount
  useEffect(() => {
    const loadGameStats = () => {
      try {
        const loadedLeaderboard = getLeaderboard()
        const todayHigh = getTodayHighScore()
        
        setGameState(prev => ({
          ...prev,
          leaderboard: loadedLeaderboard,
          highScore: todayHigh
        }))
      } catch (error) {
        console.error('Error loading game stats:', error)
      }
    }
    
    loadGameStats()
  }, [])

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
              } else if (!ghost.eaten) {
                // Lose life
                newState.lives -= 1
                newState.pacmon = { x: 9, y: 15 } // Reset Pacmon position
                newState.pacmonDirection = { x: 0, y: 0 } // Stop Pacmon
                newState.ghosts = newState.ghosts.map(g => ({ ...g, position: { x: 9, y: 9 }, direction: { x: 1, y: 0 }, vulnerable: false, eaten: false })) // Reset ghosts
                if (newState.lives <= 0) {
                  newState.gameStatus = 'gameOver'
                  // Update leaderboard
                  if (address) {
                    const updatedLeaderboard = updateLeaderboard(address, newState.score)
                    newState.leaderboard = updatedLeaderboard
                    newState.highScore = getTodayHighScore()
                  }
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
            newState.gameStatus = 'levelComplete'
          }
          
          return newState
        })
      }
    }, 200)

    return () => clearInterval(gameLoop)
  }, [gameState.gameStatus, address])

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

  const handlePayment = async () => {
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

    try {
      await sendTransaction({
        to: '0x7f748f154B6D180D35fA12460C7E4C631e28A9d7', // Game treasury address
        value: parseEther('0.0001'),
      })
      // Start the game after successful payment
      setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
    } catch (error) {
      console.error('Payment failed:', error)
    }
  }

  const startGame = () => {
    if (!isConnected) {
      handlePayment()
    } else {
      handlePayment()
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
      pellets: [],
      powerPellets: [],
      score: 0,
      lives: 3,
      gameStatus: 'pregame',
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
    
      {gameState.gameStatus === 'pregame' && (
        
          
            
              PACMON
            
            
              
                Today's High Score: {gameState.highScore.toLocaleString()}
              
              
              {/* Leaderboard */}
              
                
                  🏆 Top Players
                
                
                  {gameState.leaderboard.slice(0, 3).length > 0 ? (
                    
                      {gameState.leaderboard.slice(0, 3).map((entry, index) => (
                        
                          
                            
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            
                            
                              {entry.wallet}
                            
                          
                          
                            {entry.score.toLocaleString()}
                          
                        
                      ))}
                    
                  ) : (
                    
                      No scores yet. Be the first!
                    
                  )}
                
              
            
          

          {/* Wallet Connection Status */}
          {isConnected && (
            
              
                
                  Wallet Connected
                
                
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                
                
                  Chain: {chainId === monadTestnet.id ? 'Monad Testnet' : 'Switch to Monad Testnet'}
                
              
            
          )}

          
            
              {!isConnected ? 'Connect Wallet & Pay 0.0001 MON' : 
               chainId !== monadTestnet.id ? 'Switch to Monad Testnet' : 
               'Pay 0.0001 MON for +1 Play'}
            

            {isConnected && (
               disconnect()}
                className="w-full py-2 px-4 text-sm font-bold rounded-lg transition-all duration-200"
                style={{ 
                  backgroundColor: 'transparent', 
                  color: COLORS.MONAD_OFF_WHITE,
                  border: `1px solid ${COLORS.MONAD_OFF_WHITE}`
                }}
              >
                Disconnect Wallet
              
            )}
          

          
            Swipe/Mouse to move, tap/click to play
            Eat all pellets while avoiding ghosts!
            
              Earn MON rewards for high scores and achievements!
            
          
        
      )}

      {gameState.gameStatus !== 'pregame' && (
        
          {/* Game Header */}
          
            
              PACMON
            
            
              Score: {gameState.score}
              Lives: {gameState.lives}
              {gameState.powerMode && (
                
                  Power: {Math.ceil(gameState.powerModeTimer / 5)}s
                
              )}
            
          

          {/* Game Canvas Container - Fixed sizing */}
          
            
              
            
            
            {/* Mobile Controls - Larger buttons with proper spacing */}
            
              
               handleDirectionPress({ x: 0, y: -1 })}
                onClick={() => handleDirectionPress({ x: 0, y: -1 })}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-200 active:scale-95"
                style={{ 
                  backgroundColor: COLORS.MONAD_PURPLE, 
                  color: COLORS.WHITE,
                  border: `2px solid ${COLORS.MONAD_OFF_WHITE}`
                }}
              >
                ↑
              
              
              
               handleDirectionPress({ x: -1, y: 0 })}
                onClick={() => handleDirectionPress({ x: -1, y: 0 })}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-200 active:scale-95"
                style={{ 
                  backgroundColor: COLORS.MONAD_PURPLE, 
                  color: COLORS.WHITE,
                  border: `2px solid ${COLORS.MONAD_OFF_WHITE}`
                }}
              >
                ←
              
              
               handleDirectionPress({ x: 1, y: 0 })}
                onClick={() => handleDirectionPress({ x: 1, y: 0 })}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-200 active:scale-95"
                style={{ 
                  backgroundColor: COLORS.MONAD_PURPLE, 
                  color: COLORS.WHITE,
                  border: `2px solid ${COLORS.MONAD_OFF_WHITE}`
                }}
              >
                →
              
              
              
               handleDirectionPress({ x: 0, y: 1 })}
                onClick={() => handleDirectionPress({ x: 0, y: 1 })}
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold transition-all duration-200 active:scale-95"
                style={{ 
                  backgroundColor: COLORS.MONAD_PURPLE, 
                  color: COLORS.WHITE,
                  border: `2px solid ${COLORS.MONAD_OFF_WHITE}`
                }}
              >
                ↓
              
              
            
          
            
          {/* Game Over Screen */}
          {gameState.gameStatus === 'gameOver' && (
            
              
                
                  Game Over
                
                
                  Final Score: {gameState.score}
                
                
                  Play Again
                
              
            
          )}
          
          {/* Level Complete Screen */}
          {gameState.gameStatus === 'levelComplete' && (
            
              
                
                  Level Complete!
                
                
                  Score: {gameState.score}
                
                
                  Next Level
                
              
            
          )}
        
      )}
    
  )
}