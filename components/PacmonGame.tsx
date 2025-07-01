'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

// Monad color palette
const COLORS = {
  MONAD_PURPLE: '#836EF9',
  MONAD_BLUE: '#200052',
  MONAD_BERRY: '#A0055D',
  MONAD_OFF_WHITE: '#FBFAF9',
  MONAD_BLACK: '#0E100F',
  WHITE: '#FFFFFF'
}

// Game constants
const GRID_SIZE = 20
const CELL_SIZE = 20
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
}

interface GameState {
  pacmon: Position
  ghosts: Ghost[]
  pellets: Position[]
  powerPellets: Position[]
  score: number
  lives: number
  gameStatus: 'playing' | 'gameOver' | 'levelComplete'
  powerMode: boolean
  powerModeTimer: number
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
  const [gameState, setGameState] = useState<GameState>({
    pacmon: { x: 9, y: 15 },
    ghosts: [
      { id: 1, position: { x: 9, y: 9 }, direction: { x: 1, y: 0 }, color: COLORS.MONAD_BLUE, vulnerable: false },
      { id: 2, position: { x: 10, y: 9 }, direction: { x: -1, y: 0 }, color: COLORS.MONAD_BERRY, vulnerable: false },
      { id: 3, position: { x: 9, y: 10 }, direction: { x: 0, y: 1 }, color: COLORS.MONAD_OFF_WHITE, vulnerable: false }
    ],
    pellets: [],
    powerPellets: [],
    score: 0,
    lives: 3,
    gameStatus: 'playing',
    powerMode: false,
    powerModeTimer: 0
  })

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
          
          // Move ghosts
          newState.ghosts = newState.ghosts.map(ghost => {
            let newPos = {
              x: ghost.position.x + ghost.direction.x,
              y: ghost.position.y + ghost.direction.y
            }
            
            // Boundary check and direction change
            if (newPos.x < 0 || newPos.x >= GRID_SIZE || newPos.y < 0 || newPos.y >= GRID_SIZE || 
                MAZE[newPos.y][newPos.x] === 1) {
              // Change direction randomly
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
              
              if (validDirections.length > 0) {
                const newDirection = validDirections[Math.floor(Math.random() * validDirections.length)]
                return {
                  ...ghost,
                  direction: newDirection,
                  position: {
                    x: ghost.position.x + newDirection.x,
                    y: ghost.position.y + newDirection.y
                  },
                  vulnerable: newState.powerMode
                }
              }
              return { ...ghost, vulnerable: newState.powerMode }
            }
            
            return { ...ghost, position: newPos, vulnerable: newState.powerMode }
          })
          
          // Check ghost collisions
          newState.ghosts.forEach(ghost => {
            if (ghost.position.x === newState.pacmon.x && ghost.position.y === newState.pacmon.y) {
              if (ghost.vulnerable) {
                // Eat ghost
                newState.score += 200
                ghost.position = { x: 9, y: 9 } // Reset to center
                ghost.vulnerable = false
              } else {
                // Lose life
                newState.lives -= 1
                newState.pacmon = { x: 9, y: 15 } // Reset Pacmon position
                if (newState.lives <= 0) {
                  newState.gameStatus = 'gameOver'
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
  }, [gameState.gameStatus])

  // Handle keyboard input
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState.gameStatus !== 'playing') return

    const { key } = event
    let newPosition = { ...gameState.pacmon }

    switch (key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        newPosition.y = Math.max(0, newPosition.y - 1)
        break
      case 'ArrowDown':
      case 's':
      case 'S':
        newPosition.y = Math.min(GRID_SIZE - 1, newPosition.y + 1)
        break
      case 'ArrowLeft':
      case 'a':
      case 'A':
        newPosition.x = Math.max(0, newPosition.x - 1)
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        newPosition.x = Math.min(GRID_SIZE - 1, newPosition.x + 1)
        break
      default:
        return
    }

    // Check if new position is valid (not a wall)
    if (MAZE[newPosition.y][newPosition.x] !== 1) {
      setGameState(prev => {
        let newState = { ...prev, pacmon: newPosition }
        
        // Check pellet collection
        const pelletIndex = newState.pellets.findIndex(
          pellet => pellet.x === newPosition.x && pellet.y === newPosition.y
        )
        if (pelletIndex !== -1) {
          newState.pellets = newState.pellets.filter((_, index) => index !== pelletIndex)
          newState.score += 10
        }
        
        // Check power pellet collection
        const powerPelletIndex = newState.powerPellets.findIndex(
          pellet => pellet.x === newPosition.x && pellet.y === newPosition.y
        )
        if (powerPelletIndex !== -1) {
          newState.powerPellets = newState.powerPellets.filter((_, index) => index !== powerPelletIndex)
          newState.score += 50
          newState.powerMode = true
          newState.powerModeTimer = 30 // 6 seconds at 200ms intervals
        }
        
        return newState
      })
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

  const restartGame = () => {
    setGameState({
      pacmon: { x: 9, y: 15 },
      ghosts: [
        { id: 1, position: { x: 9, y: 9 }, direction: { x: 1, y: 0 }, color: COLORS.MONAD_BLUE, vulnerable: false },
        { id: 2, position: { x: 10, y: 9 }, direction: { x: -1, y: 0 }, color: COLORS.MONAD_BERRY, vulnerable: false },
        { id: 3, position: { x: 9, y: 10 }, direction: { x: 0, y: 1 }, color: COLORS.MONAD_OFF_WHITE, vulnerable: false }
      ],
      pellets: [],
      powerPellets: [],
      score: 0,
      lives: 3,
      gameStatus: 'playing',
      powerMode: false,
      powerModeTimer: 0
    })
    
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
      <div className="text-center mb-4">
        <h1 className="text-4xl font-bold mb-2" style={{ color: COLORS.MONAD_PURPLE }}>
          PACMON
        </h1>
        <div className="flex justify-center space-x-8 text-lg" style={{ color: COLORS.MONAD_OFF_WHITE }}>
          <div>Score: {gameState.score}</div>
          <div>Lives: {gameState.lives}</div>
          {gameState.powerMode && (
            <div style={{ color: COLORS.MONAD_PURPLE }}>
              Power Mode: {Math.ceil(gameState.powerModeTimer / 5)}s
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="border-2"
          style={{ borderColor: COLORS.MONAD_PURPLE }}
        />
        
        {gameState.gameStatus === 'gameOver' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4" style={{ color: COLORS.MONAD_BERRY }}>
                Game Over
              </h2>
              <p className="text-xl mb-4" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                Final Score: {gameState.score}
              </p>
              <button
                onClick={restartGame}
                className="px-6 py-3 text-lg font-bold rounded"
                style={{ 
                  backgroundColor: COLORS.MONAD_PURPLE, 
                  color: COLORS.WHITE 
                }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
        
        {gameState.gameStatus === 'levelComplete' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4" style={{ color: COLORS.MONAD_PURPLE }}>
                Level Complete!
              </h2>
              <p className="text-xl mb-4" style={{ color: COLORS.MONAD_OFF_WHITE }}>
                Score: {gameState.score}
              </p>
              <button
                onClick={restartGame}
                className="px-6 py-3 text-lg font-bold rounded"
                style={{ 
                  backgroundColor: COLORS.MONAD_PURPLE, 
                  color: COLORS.WHITE 
                }}
              >
                Next Level
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center" style={{ color: COLORS.MONAD_OFF_WHITE }}>
        <p className="text-sm">Use arrow keys or WASD to move</p>
        <p className="text-xs mt-2">Eat all pellets while avoiding ghosts!</p>
      </div>
    </div>
  )
}

