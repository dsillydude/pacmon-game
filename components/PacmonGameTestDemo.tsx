'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { generateMaze } from '@/lib/mazeGenerator'
import { getLevelSettings } from '@/lib/difficultySettings'

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
const CELL_SIZE = 20

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
  gameStatus: 'pregame' | 'playing' | 'gameOver' | 'levelComplete' | 'postGame'
  powerMode: boolean
  powerModeTimer: number
  maze: number[][]
  mazeSize: number
  gameWidth: number
  gameHeight: number
  levelTransition: boolean
}

export default function PacmonGameTestDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [gameState, setGameState] = useState<GameState>({
    pacmon: { x: 1, y: 1 },
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
    maze: [],
    mazeSize: 7,
    gameWidth: 140,
    gameHeight: 140,
    levelTransition: false
  })

  // Initialize level
  const initializeLevel = useCallback((level: number) => {
    const levelSettings = getLevelSettings(level)
    const mazeData = generateMaze(level)
    
    const gameWidth = mazeData.size * CELL_SIZE
    const gameHeight = mazeData.size * CELL_SIZE
    
    // Create ghosts based on level settings
    const ghostColors = [COLORS.MONAD_BERRY, COLORS.MONAD_PURPLE, COLORS.MONAD_BLUE, COLORS.MONAD_OFF_WHITE]
    const ghostTypes: ('blinky' | 'pinky' | 'inky' | 'clyde')[] = ['blinky', 'pinky', 'inky', 'clyde']
    
    const ghosts: Ghost[] = []
    for (let i = 0; i < levelSettings.ghostCount && i < mazeData.ghostStarts.length; i++) {
      const ghostStart = mazeData.ghostStarts[i]
      ghosts.push({
        id: i + 1,
        position: ghostStart,
        direction: { x: 1, y: 0 },
        color: ghostColors[i % ghostColors.length],
        vulnerable: false,
        type: ghostTypes[i % ghostTypes.length],
        scatterTarget: { x: mazeData.size - 1, y: i % 2 === 0 ? 0 : mazeData.size - 1 },
        eaten: false,
        speed: levelSettings.ghostSpeed
      })
    }

    // Extract pellets and power pellets from maze
    const pellets: Position[] = []
    const powerPellets: Position[] = []
    
    for (let y = 0; y < mazeData.size; y++) {
      for (let x = 0; x < mazeData.size; x++) {
        if (mazeData.grid[y][x] === 2) {
          pellets.push({ x, y })
        } else if (mazeData.grid[y][x] === 3) {
          powerPellets.push({ x, y })
        }
      }
    }

    setGameState(prev => ({
      ...prev,
      level,
      maze: mazeData.grid,
      mazeSize: mazeData.size,
      gameWidth,
      gameHeight,
      pacmon: mazeData.playerStart,
      ghosts,
      pellets,
      powerPellets,
      pacmonDirection: { x: 0, y: 0 },
      powerMode: false,
      powerModeTimer: 0,
      levelTransition: false
    }))
  }, [])

  // Initialize first level
  useEffect(() => {
    initializeLevel(1)
  }, [initializeLevel])

  // Game loop
  useEffect(() => {
    const gameLoop = setInterval(() => {
      if (gameState.gameStatus === 'playing' && !gameState.levelTransition) {
        setGameState(prev => {
          let newState = { ...prev }
          
          // Move Pacmon
          let newPacmonPos = {
            x: newState.pacmon.x + newState.pacmonDirection.x,
            y: newState.pacmon.y + newState.pacmonDirection.y
          }

          // Check for wall collision
          if (newPacmonPos.x >= 0 && newPacmonPos.x < newState.mazeSize &&
              newPacmonPos.y >= 0 && newPacmonPos.y < newState.mazeSize &&
              newState.maze[newPacmonPos.y][newPacmonPos.x] !== 1) {
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
              // Eaten ghosts return to center
              const center = { x: Math.floor(newState.mazeSize / 2), y: Math.floor(newState.mazeSize / 2) }
              if (ghost.position.x === center.x && ghost.position.y === center.y) {
                return { ...ghost, eaten: false, vulnerable: false }
              }
              // Simple path back to center
              const dx = center.x - ghost.position.x
              const dy = center.y - ghost.position.y
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
                return testPos.x >= 0 && testPos.x < newState.mazeSize && 
                       testPos.y >= 0 && testPos.y < newState.mazeSize && 
                       newState.maze[testPos.y][testPos.x] !== 1
              })
              const newDirection = validDirections[Math.floor(Math.random() * validDirections.length)]
              targetTile = { x: ghost.position.x + newDirection.x, y: ghost.position.y + newDirection.y }
            } else {
              // Chase mode - all ghosts target Pacmon for simplicity
              targetTile = newState.pacmon
            }

            // Ghost movement logic (shortest path to target, avoiding walls)
            const possibleDirections = [
              { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
            ]
            let bestDirection = ghost.direction
            let minDistance = Infinity

            possibleDirections.forEach(dir => {
              const nextPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
              if (nextPos.x >= 0 && nextPos.x < newState.mazeSize && 
                  nextPos.y >= 0 && nextPos.y < newState.mazeSize && 
                  newState.maze[nextPos.y][nextPos.x] !== 1) {
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
              position: { 
                x: ghost.position.x + bestDirection.x, 
                y: ghost.position.y + bestDirection.y 
              }, 
              vulnerable: newState.powerMode 
            }
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
                newState.pacmon = { x: 1, y: 1 } // Reset Pacmon position
                newState.pacmonDirection = { x: 0, y: 0 } // Stop Pacmon
                // Reset ghosts to their starting positions
                const levelSettings = getLevelSettings(newState.level)
                const mazeData = generateMaze(newState.level)
                newState.ghosts = newState.ghosts.map((g, index) => ({
                  ...g,
                  position: mazeData.ghostStarts[index] || { x: Math.floor(newState.mazeSize / 2), y: Math.floor(newState.mazeSize / 2) },
                  direction: { x: 1, y: 0 },
                  vulnerable: false,
                  eaten: false
                }))
                if (newState.lives <= 0) {
                  newState.gameStatus = 'postGame'
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
            newState.levelTransition = true
            newState.score += 100 * newState.level // Bonus for completing level
            
            // Advance to next level after a short delay
            setTimeout(() => {
              const nextLevel = newState.level + 1
              initializeLevel(nextLevel)
              setGameState(prev => ({
                ...prev,
                gameStatus: 'playing',
                levelTransition: false
              }))
            }, 2000)
          }
          
          return newState
        })
      }
    }, 200)

    return () => clearInterval(gameLoop)
  }, [gameState.gameStatus, gameState.levelTransition, initializeLevel])

  // Handle keyboard input
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState.gameStatus !== 'playing' || gameState.levelTransition) return

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

    if (nextX >= 0 && nextX < gameState.mazeSize && 
        nextY >= 0 && nextY < gameState.mazeSize && 
        gameState.maze[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: newDirection }))
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.levelTransition, gameState.mazeSize, gameState.maze])

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
    ctx.fillRect(0, 0, gameState.gameWidth, gameState.gameHeight)

    // Draw maze
    ctx.fillStyle = COLORS.MONAD_BLUE
    for (let y = 0; y < gameState.mazeSize; y++) {
      for (let x = 0; x < gameState.mazeSize; x++) {
        if (gameState.maze[y] && gameState.maze[y][x] === 1) {
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

    // Draw level transition overlay
    if (gameState.levelTransition) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, gameState.gameWidth, gameState.gameHeight)
      
      ctx.fillStyle = COLORS.MONAD_PURPLE
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(
        `Level ${gameState.level} Complete!`,
        gameState.gameWidth / 2,
        gameState.gameHeight / 2 - 20
      )
      ctx.fillText(
        `Next Level: ${gameState.level + 1}`,
        gameState.gameWidth / 2,
        gameState.gameHeight / 2 + 20
      )
    }
  }, [gameState])

  const startGame = () => {
    setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
  }

  const restartGame = () => {
    setGameState(prev => ({
      ...prev,
      score: 0,
      lives: 3,
      level: 1,
      gameStatus: 'playing',
      powerMode: false,
      powerModeTimer: 0,
      levelTransition: false
    }))
    
    // Reinitialize level 1
    initializeLevel(1)
  }

  const exitGame = () => {
    setGameState(prev => ({ ...prev, gameStatus: 'pregame' }))
  }

  // Handle mobile controls
  const handleDirectionPress = useCallback((direction: Position) => {
    if (gameState.gameStatus !== 'playing' || gameState.levelTransition) return

    // Only update direction if the new direction is valid (not a wall in the immediate next cell)
    const nextX = gameState.pacmon.x + direction.x
    const nextY = gameState.pacmon.y + direction.y

    if (nextX >= 0 && nextX < gameState.mazeSize && 
        nextY >= 0 && nextY < gameState.mazeSize && 
        gameState.maze[nextY][nextX] !== 1) {
      setGameState(prev => ({ ...prev, pacmonDirection: direction }))
    }
  }, [gameState.pacmon, gameState.gameStatus, gameState.levelTransition, gameState.mazeSize, gameState.maze])

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
      {gameState.gameStatus === 'pregame' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">
              PACMON
            </h1>
            <p className="text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Improved Game with Progressive Difficulty
            </p>
          </div>

          <div className="w-full max-w-md space-y-4 px-4">
            <button
              onClick={startGame}
              className="w-full py-6 px-8 text-xl md:text-2xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: COLORS.MONAD_BERRY, 
                color: COLORS.WHITE 
              }}
            >
              Start Game
            </button>
          </div>

          <div className="text-center text-sm" style={{ color: COLORS.MONAD_OFF_WHITE }}>
            <p>Use arrow keys or WASD to move</p>
            <p className="mt-1">Eat all pellets while avoiding ghosts!</p>
            <p className="mt-1">Progress through levels with increasing difficulty!</p>
            <p className="mt-2 text-xs" style={{ color: COLORS.MONAD_PURPLE }}>
              Level 1: 7x7 maze, 1 ghost | Level 2: 9x9 maze, 1 ghost | Level 3+: Bigger mazes, more ghosts!
            </p>
          </div>
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
            </div>
          </div>

          <div className="flex flex-col h-full">
            {/* Game Canvas Container - Takes up most of the space */}
            <div className="flex-1 flex items-start justify-center pt-4">
              <canvas
                ref={canvasRef}
                width={gameState.gameWidth}
                height={gameState.gameHeight}
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
            <p className="text-lg" style={{ color: COLORS.MONAD_PURPLE }}>
              Reached Level: {gameState.level}
            </p>
          </div>

          <div className="w-full max-w-md space-y-4 px-4">
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
            <p>Try to beat your high score!</p>
          </div>
        </div>
      )}
    </div>
  )
}

