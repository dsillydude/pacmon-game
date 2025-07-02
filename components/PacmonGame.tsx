'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

// Monad color palette
const COLORS = {
  MONAD_PURPLE: '#836EF9',
  MONAD_BLUE: '#200052',
  MONAD_BERRY: '#A0055D',
  MONAD_OFF_WHITE: '#FBFAF9',
  MONAD_BLACK: '#0E001A',
  WHITE: '#FFFFFF',
}

// Game constants
const GRID_SIZE = 20
const CELL_SIZE = 20
const GAME_WIDTH = GRID_SIZE * CELL_SIZE
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE
const INITIAL_PACMON_SPEED = 200 // milliseconds per cell
const GHOST_SPEED_MULTIPLIER = 1.2
const POWER_PELLET_DURATION = 6000 // milliseconds
const GHOST_FRIGHT_DURATION = 7000 // milliseconds

// Game states
enum GameState {
  Loading,
  Playing,
  GameOver,
  Paused,
}

// Directions
enum Direction {
  Up,
  Down,
  Left,
  Right,
  None,
}

interface Position {
  x: number
  y: number
}

interface Ghost extends Position {
  direction: Direction
  isFrightened: boolean
  isEaten: boolean
  color: string
  initialPosition: Position
}

interface PacmonGameProps {
  onGameOver?: (score: number) => void;
  onAchievement?: (type: string, score: number) => void;
  currentScore?: number;
}

const PacmonGame: React.FC<PacmonGameProps> = ({ onGameOver, onAchievement, currentScore = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>(GameState.Playing)
  const [pacmonPosition, setPacmonPosition] = useState<Position>({ x: 1, y: 1 })
  const [pacmonDirection, setPacmonDirection] = useState<Direction>(Direction.Right)
  const [pacmonNextDirection, setPacmonNextDirection] = useState<Direction>(Direction.Right)
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [pellets, setPellets] = useState<Position[]>([])
  const [powerPellets, setPowerPellets] = useState<Position[]>([])
  const [score, setScore] = useState<number>(currentScore)
  const [lives, setLives] = useState<number>(3)
  const [level, setLevel] = useState<number>(1)
  const [isPowerMode, setIsPowerMode] = useState<boolean>(false)
  const [frightenedGhostsCount, setFrightenedGhostsCount] = useState<number>(0)
  const [lastMoveTime, setLastMoveTime] = useState<number>(Date.now())
  const [lastGhostMoveTime, setLastGhostMoveTime] = useState<number>(Date.now())
  const [pacmonSpeed, setPacmonSpeed] = useState<number>(INITIAL_PACMON_SPEED)

  const maze = useRef<number[][]>([])

  const initializeGame = useCallback(() => {
    // Define the maze layout (1: wall, 0: path, 2: pellet, 3: power pellet)
    const initialMaze = [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
      [1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 1],
      [1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 1],
      [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
      [1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1],
      [1, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 1],
      [1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 2, 1, 2, 2, 2, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 2, 2, 2, 1, 0, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 2, 1, 2, 2, 2, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1],
      [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
      [1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 1],
      [1, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1],
      [1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1],
      [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
      [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
      [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ]

    maze.current = initialMaze.map((row) => [...row]) // Deep copy

    const initialPellets: Position[] = []
    const initialPowerPellets: Position[] = []

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (maze.current[r][c] === 2) {
          initialPellets.push({ x: c, y: r })
        } else if (maze.current[r][c] === 3) {
          initialPowerPellets.push({ x: c, y: r })
        }
      }
    }

    setPellets(initialPellets)
    setPowerPellets(initialPowerPellets)
    setPacmonPosition({ x: 1, y: 1 })
    setPacmonDirection(Direction.Right)
    setPacmonNextDirection(Direction.Right)
    setScore(0)
    setLives(3)
    setLevel(1)
    setIsPowerMode(false)
    setFrightenedGhostsCount(0)
    setPacmonSpeed(INITIAL_PACMON_SPEED)

    setGhosts([
      { x: 9, y: 8, direction: Direction.Up, isFrightened: false, isEaten: false, color: COLORS.MONAD_BERRY, initialPosition: { x: 9, y: 8 } },
      { x: 10, y: 8, direction: Direction.Down, isFrightened: false, isEaten: false, color: COLORS.MONAD_BLUE, initialPosition: { x: 10, y: 8 } },
      { x: 8, y: 9, direction: Direction.Left, isFrightened: false, isEaten: false, color: COLORS.MONAD_PURPLE, initialPosition: { x: 8, y: 9 } },
      { x: 11, y: 9, direction: Direction.Right, isFrightened: false, isEaten: false, color: COLORS.MONAD_OFF_WHITE, initialPosition: { x: 11, y: 9 } },
    ])

    setGameState(GameState.Playing)
  }, [])

  useEffect(() => {
    initializeGame()
  }, [initializeGame])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (maze.current[r][c] === 1) {
          ctx.fillStyle = COLORS.MONAD_BLUE
          ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE)
        }
      }
    }

    // Draw pellets
    pellets.forEach((p) => {
      ctx.fillStyle = COLORS.MONAD_OFF_WHITE
      ctx.beginPath()
      ctx.arc(
        p.x * CELL_SIZE + CELL_SIZE / 2,
        p.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 8,
        0,
        Math.PI * 2
      )
      ctx.fill()
    })

    // Draw power pellets
    powerPellets.forEach((p) => {
      ctx.fillStyle = COLORS.MONAD_PURPLE
      ctx.beginPath()
      ctx.arc(
        p.x * CELL_SIZE + CELL_SIZE / 2,
        p.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 4,
        0,
        Math.PI * 2
      )
      ctx.fill()
    })

    // Draw Pacmon
    ctx.fillStyle = COLORS.MONAD_PURPLE
    ctx.beginPath()
    let startAngle = 0
    let endAngle = Math.PI * 2
    const mouthOpen = gameState === GameState.Playing && Date.now() % 400 < 200 // Simple animation

    if (mouthOpen) {
      switch (pacmonDirection) {
        case Direction.Right:
          startAngle = Math.PI / 4
          endAngle = (Math.PI * 7) / 4
          break
        case Direction.Left:
          startAngle = (Math.PI * 5) / 4
          endAngle = (Math.PI * 3) / 4
          break
        case Direction.Up:
          startAngle = (Math.PI * 7) / 4
          endAngle = (Math.PI * 5) / 4
          break
        case Direction.Down:
          startAngle = Math.PI / 4
          endAngle = (Math.PI * 3) / 2
          break
      }
    }

    ctx.arc(
      pacmonPosition.x * CELL_SIZE + CELL_SIZE / 2,
      pacmonPosition.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      startAngle,
      endAngle
    )
    ctx.lineTo(
      pacmonPosition.x * CELL_SIZE + CELL_SIZE / 2,
      pacmonPosition.y * CELL_SIZE + CELL_SIZE / 2
    )
    ctx.fill()

    // Draw ghosts
    ghosts.forEach((ghost) => {
      ctx.fillStyle = ghost.isFrightened ? COLORS.MONAD_OFF_WHITE : ghost.color
      ctx.beginPath()
      ctx.arc(
        ghost.x * CELL_SIZE + CELL_SIZE / 2,
        ghost.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        Math.PI,
        0,
        false
      )
      ctx.lineTo(ghost.x * CELL_SIZE + CELL_SIZE - 2, ghost.y * CELL_SIZE + CELL_SIZE - 2)
      ctx.lineTo(ghost.x * CELL_SIZE + 2, ghost.y * CELL_SIZE + CELL_SIZE - 2)
      ctx.closePath()
      ctx.fill()

      // Draw ghost eyes
      ctx.fillStyle = COLORS.WHITE
      ctx.beginPath()
      ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2 - 5, ghost.y * CELL_SIZE + CELL_SIZE / 2 - 5, 3, 0, Math.PI * 2)
      ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2 + 5, ghost.y * CELL_SIZE + CELL_SIZE / 2 - 5, 3, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = COLORS.MONAD_BLACK
      ctx.beginPath()
      ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2 - 5 + (ghost.direction === Direction.Left ? -2 : ghost.direction === Direction.Right ? 2 : 0), ghost.y * CELL_SIZE + CELL_SIZE / 2 - 5 + (ghost.direction === Direction.Up ? -2 : ghost.direction === Direction.Down ? 2 : 0), 1.5, 0, Math.PI * 2)
      ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2 + 5 + (ghost.direction === Direction.Left ? -2 : ghost.direction === Direction.Right ? 2 : 0), ghost.y * CELL_SIZE + CELL_SIZE / 2 - 5 + (ghost.direction === Direction.Up ? -2 : ghost.direction === Direction.Down ? 2 : 0), 1.5, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw score and lives
    ctx.fillStyle = COLORS.WHITE
    ctx.font = '16px Arial'
    ctx.fillText(`Score: ${score}`, 10, 20)
    ctx.fillText(`Lives: ${lives}`, GAME_WIDTH - 80, 20)

    if (gameState === GameState.GameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      ctx.fillStyle = COLORS.WHITE
      ctx.font = '40px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20)
      ctx.font = '20px Arial'
      ctx.fillText(`Final Score: ${score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20)
      ctx.textAlign = 'left'
    }
  }, [pacmonPosition, pacmonDirection, ghosts, pellets, powerPellets, score, lives, gameState])

  const isValidMove = useCallback((pos: Position, dir: Direction) => {
    let newX = pos.x
    let newY = pos.y

    switch (dir) {
      case Direction.Up:
        newY--
        break
      case Direction.Down:
        newY++
        break
      case Direction.Left:
        newX--
        break
      case Direction.Right:
        newX++
        break
    }

    if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) {
      return false
    }
    return maze.current[newY][newX] !== 1
  }, [])

  const movePacmon = useCallback(() => {
    setPacmonPosition((prev) => {
      let newX = prev.x
      let newY = prev.y
      let currentDir = pacmonDirection

      // Try to move in next desired direction first
      if (pacmonNextDirection !== Direction.None && isValidMove(prev, pacmonNextDirection)) {
        currentDir = pacmonNextDirection
        setPacmonDirection(pacmonNextDirection)
      } else if (!isValidMove(prev, currentDir)) {
        // If current direction is blocked, stop Pacmon
        return prev
      }

      switch (currentDir) {
        case Direction.Up:
          newY--
          break
        case Direction.Down:
          newY++
          break
        case Direction.Left:
          newX--
          break
        case Direction.Right:
          newX++
          break
      }

      // Pellet eating
      setPellets((prevPellets) => {
        const pelletIndex = prevPellets.findIndex((p) => p.x === newX && p.y === newY)
        if (pelletIndex !== -1) {
          setScore((s) => s + 10)
          return prevPellets.filter((_, i) => i !== pelletIndex)
        }
        return prevPellets
      })

      // Power pellet eating
      setPowerPellets((prevPowerPellets) => {
        const powerPelletIndex = prevPowerPellets.findIndex((p) => p.x === newX && p.y === newY)
        if (powerPelletIndex !== -1) {
          setScore((s) => s + 50)
          setIsPowerMode(true)
          setFrightenedGhostsCount(0) // Reset count for new power pellet
          setTimeout(() => {
            setIsPowerMode(false)
            setGhosts((g) => g.map((ghost) => ({ ...ghost, isFrightened: false })))
          }, POWER_PELLET_DURATION)
          return prevPowerPellets.filter((_, i) => i !== powerPelletIndex)
        }
        return prevPowerPellets
      })

      return { x: newX, y: newY }
    })
  }, [pacmonDirection, pacmonNextDirection, isValidMove])

  const moveGhosts = useCallback(() => {
    setGhosts((prevGhosts) => {
      return prevGhosts.map((ghost) => {
        if (ghost.isEaten) {
          // Eaten ghosts return to initial position
          if (ghost.x === ghost.initialPosition.x && ghost.y === ghost.initialPosition.y) {
            return { ...ghost, isEaten: false, isFrightened: false }
          }
          // Pathfinding back to initial position (simple)
          const pathDir = getDirectionToTarget(ghost, ghost.initialPosition)
          if (isValidMove(ghost, pathDir)) {
            return moveInDirection(ghost, pathDir)
          }
          return ghost
        }

        let newDirection = ghost.direction
        const possibleDirections = Object.values(Direction).filter(
          (dir) => dir !== Direction.None && isValidMove(ghost, dir) && !isOppositeDirection(dir, ghost.direction)
        )

        if (ghost.isFrightened) {
          // Frightened ghosts move randomly or away from Pacmon
          newDirection = getRandomDirection(possibleDirections)
        } else {
          // Ghosts chase Pacmon (simple AI: move towards Pacmon)
          newDirection = getDirectionToTarget(ghost, pacmonPosition)
          if (!isValidMove(ghost, newDirection)) {
            newDirection = getRandomDirection(possibleDirections)
          }
        }

        if (isValidMove(ghost, newDirection)) {
          return moveInDirection(ghost, newDirection)
        } else {
          // If chosen direction is blocked, pick a random valid one
          return moveInDirection(ghost, getRandomDirection(possibleDirections))
        }
      })
    })
  }, [isValidMove, pacmonPosition])

  const getDirectionToTarget = (from: Position, to: Position): Direction => {
    const dx = to.x - from.x
    const dy = to.y - from.y

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? Direction.Right : Direction.Left
    } else {
      return dy > 0 ? Direction.Down : Direction.Up
    }
  }

  const isOppositeDirection = (dir1: Direction, dir2: Direction): boolean => {
    return (
      (dir1 === Direction.Up && dir2 === Direction.Down) ||
      (dir1 === Direction.Down && dir2 === Direction.Up) ||
      (dir1 === Direction.Left && dir2 === Direction.Right) ||
      (dir1 === Direction.Right && dir2 === Direction.Left)
    )
  }

  const getRandomDirection = (possibleDirections: Direction[]): Direction => {
    if (possibleDirections.length === 0) return Direction.None
    return possibleDirections[Math.floor(Math.random() * possibleDirections.length)]
  }

  const moveInDirection = (entity: Position, direction: Direction): Position => {
    let newX = entity.x
    let newY = entity.y
    switch (direction) {
      case Direction.Up:
        newY--
        break
      case Direction.Down:
        newY++
        break
      case Direction.Left:
        newX--
        break
      case Direction.Right:
        newX++
        break
    }
    return { ...entity, x: newX, y: newY, direction: direction }
  }

  // Game loop
  useEffect(() => {
    let animationFrameId: number

    const gameLoop = () => {
      const now = Date.now()

      if (gameState === GameState.Playing) {
        // Pacmon movement
        if (now - lastMoveTime > pacmonSpeed) {
          movePacmon()
          setLastMoveTime(now)
        }

        // Ghost movement
        if (now - lastGhostMoveTime > INITIAL_PACMON_SPEED * GHOST_SPEED_MULTIPLIER) {
          moveGhosts()
          setLastGhostMoveTime(now)
        }

        // Collision detection
        ghosts.forEach((ghost) => {
          if (pacmonPosition.x === ghost.x && pacmonPosition.y === ghost.y) {
            if (isPowerMode && !ghost.isEaten) {
              // Eat ghost
              setScore((s) => s + 200)
              setGhosts((g) =>
                g.map((g) =>
                  g === ghost ? { ...g, isEaten: true, isFrightened: false } : g
                )
              )
              setFrightenedGhostsCount((count) => count + 1)
              // Trigger achievement for eating ghosts
              if (onAchievement) {
                onAchievement('GHOST_EATER', score + 200);
              }
            } else if (!isPowerMode && !ghost.isEaten) {
              // Pacmon hit by ghost
              setLives((l) => l - 1)
              if (lives - 1 <= 0) {
                setGameState(GameState.GameOver)
                if (onGameOver) {
                  onGameOver(score);
                }
              } else {
                // Reset positions after losing a life
                setPacmonPosition({ x: 1, y: 1 })
                setPacmonDirection(Direction.Right)
                setPacmonNextDirection(Direction.Right)
                setGhosts((g) =>
                  g.map((ghost) => ({ ...ghost, x: ghost.initialPosition.x, y: ghost.initialPosition.y, isFrightened: false, isEaten: false }))
                )
                setIsPowerMode(false)
              }
            }
          }
        })

        // Check for level complete
        if (pellets.length === 0 && powerPellets.length === 0) {
          setLevel((l) => l + 1)
          setPacmonSpeed((s) => Math.max(50, s - 20)) // Increase speed
          initializeGame() // Re-initialize maze for next level
          // Trigger achievement for completing level
          if (onAchievement) {
            onAchievement('LEVEL_COMPLETE', level + 1);
          }
        }
      }

      draw()
      animationFrameId = requestAnimationFrame(gameLoop)
    }

    animationFrameId = requestAnimationFrame(gameLoop)

    return () => cancelAnimationFrame(animationFrameId)
  }, [gameState, lastMoveTime, lastGhostMoveTime, pacmonSpeed, pellets, powerPellets, ghosts, pacmonPosition, isPowerMode, lives, score, level, initializeGame, draw, movePacmon, moveGhosts, onGameOver, onAchievement])

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.Playing) return

      let newDirection: Direction = Direction.None
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          newDirection = Direction.Up
          break
        case 'ArrowDown':
        case 's':
          newDirection = Direction.Down
          break
        case 'ArrowLeft':
        case 'a':
          newDirection = Direction.Left
          break
        case 'ArrowRight':
        case 'd':
          newDirection = Direction.Right
          break
      }

      if (newDirection !== Direction.None) {
        setPacmonNextDirection(newDirection)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState])

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="bg-black border-4 border-monad-blue rounded-lg shadow-lg"
      />
      <div className="mt-4 text-center text-white">
        <p className="text-lg">
          Use arrow keys or WASD to move
        </p>
        <p className="text-sm opacity-80">
          Eat all pellets while avoiding ghosts!
        </p>
      </div>
    </div>
  )
}

export default PacmonGame
