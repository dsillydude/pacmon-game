
'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

// Classic Pac-Man color palette
const COLORS = {
  PACMAN_YELLOW: '#FFFF00',
  MAZE_BLUE: '#0000FF',
  BACKGROUND_BLACK: '#000000',
  DOT_WHITE: '#FFFFFF',
  POWER_PELLET_WHITE: '#FFFFFF',
  GHOST_RED: '#FF0000',
  GHOST_PINK: '#FFB8FF',
  GHOST_CYAN: '#00FFFF',
  GHOST_ORANGE: '#FFB852',
  FRIGHTENED_BLUE: '#0000FF',
  TEXT_WHITE: '#FFFFFF',
  TEXT_YELLOW: '#FFFF00',
}

const CELL_SIZE = 20

// Progressive maze configurations
const MAZES = {
  1: [
    'XXXXXXXXXXXXXXX',
    'X.............X',
    'X.XXX.XXX.XXX.X',
    'X.............X',
    'X.XX.XXXXX.XX.X',
    'X.............X',
    'XXX.XX   XX.XXX',
    'X.............X',
    'X.XX.XXXXX.XX.X',
    'X.............X',
    'X.XXX.XXX.XXX.X',
    'X.............X',
    'XXXXXXXXXXXXXXX',
  ],
  2: [
    'XXXXXXXXXXXXXXXXXXXX',
    'X..................X',
    'X.XXX.XXXXXX.XXX.X.X',
    'X..................X',
    'X.XX.XX.XXXX.XX.XX.X',
    'X..................X',
    'XXXX.XXXX  XXXX.XXXX',
    'X..................X',
    'X.XX.XX.XXXX.XX.XX.X',
    'X..................X',
    'X.XXX.XXXXXX.XXX.X.X',
    'X..................X',
    'XXXXXXXXXXXXXXXXXXXX',
  ],
  3: [
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    'X............XX............X',
    'X.XXXX.XXXXX.XX.XXXXX.XXXX.X',
    'X..........................X',
    'X.XXXX.XX.XXXXXXXX.XX.XXXX.X',
    'X......XX....XX....XX......X',
    'XXXXXX.XXXXX XX XXXXX.XXXXXX',
    'XXXXXX.XX          XX.XXXXXX',
    'XXXXXX.XX XXXXXXXX XX.XXXXXX',
    '      .   X      X   .      ',
    'XXXXXX.XX X      X XX.XXXXXX',
    'XXXXXX.XX XXXXXXXX XX.XXXXXX',
    'XXXXXX.XX          XX.XXXXXX',
    'XXXXXX.XX XXXXXXXX XX.XXXXXX',
    'X............XX............X',
    'X.XXXX.XXXXX.XX.XXXXX.XXXX.X',
    'X...XX................XX...X',
    'XXX.XX.XX.XXXXXXXX.XX.XX.XXX',
    'X......XX....XX....XX......X',
    'X.XXXXXXXXXX.XX.XXXXXXXXXX.X',
    'X..........................X',
    'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  ]
}

// Level configurations
const LEVEL_CONFIG = {
  1: { ghosts: 2, ghostSpeed: 1.5, powerPellets: 2, maze: MAZES[1] },
  2: { ghosts: 3, ghostSpeed: 2, powerPellets: 3, maze: MAZES[2] },
  3: { ghosts: 4, ghostSpeed: 2.5, powerPellets: 4, maze: MAZES[3] },
}

const GHOST_COLORS = [COLORS.GHOST_RED, COLORS.GHOST_PINK, COLORS.GHOST_CYAN, COLORS.GHOST_ORANGE]

const DOT_RADIUS = 2
const POWER_PELLET_RADIUS = 6

const PACMON_SPEED = 2
const POWER_PELLET_DURATION = 6000

const SCORE_PELLET = 10
const SCORE_POWER_PELLET = 50
const SCORE_GHOST = 200

interface Position {
  x: number
  y: number
}

interface Ghost extends Position {
  color: string
  dx: number
  dy: number
  isFrightened: boolean
  isEaten: boolean
  originalColor: string
}

interface Pacmon extends Position {
  dx: number
  dy: number
  lives: number
}

const PacmonGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pacmon, setPacmon] = useState<Pacmon>({
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    lives: 3,
  })
  const [ghosts, setGhosts] = useState<Ghost[]>([])
  const [dots, setDots] = useState<Position[]>([])
  const [powerPellets, setPowerPellets] = useState<Position[]>([])
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [level, setLevel] = useState(1)
  const [powerPelletTimer, setPowerPelletTimer] = useState<NodeJS.Timeout | null>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [currentMaze, setCurrentMaze] = useState<string[]>(MAZES[1])

  const getCurrentLevelConfig = useCallback((currentLevel: number) => {
    if (currentLevel <= 2) {
      return LEVEL_CONFIG[currentLevel as keyof typeof LEVEL_CONFIG]
    }
    // For levels 3+, use level 3 config but increase ghost speed
    const baseConfig = LEVEL_CONFIG[3]
    const speedIncrease = Math.floor((currentLevel - 3) / 2) * 0.5
    return {
      ...baseConfig,
      ghostSpeed: baseConfig.ghostSpeed + speedIncrease
    }
  }, [])

  const initializeLevel = useCallback((levelNum: number) => {
    const config = getCurrentLevelConfig(levelNum)
    const maze = config.maze
    
    setCurrentMaze(maze)
    
    // Calculate game dimensions based on maze
    const mazeWidth = maze[0].length
    const mazeHeight = maze.length
    
    // Generate dots and power pellets
    const newDots: Position[] = []
    const newPowerPellets: Position[] = []
    
    for (let y = 0; y < maze.length; y++) {
      for (let x = 0; x < maze[y].length; x++) {
        if (maze[y][x] === '.') {
          newDots.push({ 
            x: x * CELL_SIZE + CELL_SIZE / 2, 
            y: y * CELL_SIZE + CELL_SIZE / 2 
          })
        }
      }
    }
    
    // Place power pellets in corners for larger mazes
    if (mazeWidth >= 20) {
      newPowerPellets.push(
        { x: 1 * CELL_SIZE + CELL_SIZE / 2, y: 1 * CELL_SIZE + CELL_SIZE / 2 },
        { x: (mazeWidth - 2) * CELL_SIZE + CELL_SIZE / 2, y: 1 * CELL_SIZE + CELL_SIZE / 2 },
        { x: 1 * CELL_SIZE + CELL_SIZE / 2, y: (mazeHeight - 2) * CELL_SIZE + CELL_SIZE / 2 },
        { x: (mazeWidth - 2) * CELL_SIZE + CELL_SIZE / 2, y: (mazeHeight - 2) * CELL_SIZE + CELL_SIZE / 2 }
      )
    } else {
      // For smaller mazes, place fewer power pellets
      newPowerPellets.push(
        { x: 1 * CELL_SIZE + CELL_SIZE / 2, y: 1 * CELL_SIZE + CELL_SIZE / 2 },
        { x: (mazeWidth - 2) * CELL_SIZE + CELL_SIZE / 2, y: (mazeHeight - 2) * CELL_SIZE + CELL_SIZE / 2 }
      )
    }
    
    setDots(newDots)
    setPowerPellets(newPowerPellets.slice(0, config.powerPellets))
    
    // Initialize ghosts
    const centerX = Math.floor(mazeWidth / 2)
    const centerY = Math.floor(mazeHeight / 2)
    
    const newGhosts: Ghost[] = []
    for (let i = 0; i < config.ghosts; i++) {
      const color = GHOST_COLORS[i]
      newGhosts.push({
        x: (centerX + i - 1) * CELL_SIZE,
        y: centerY * CELL_SIZE,
        color: color,
        originalColor: color,
        dx: config.ghostSpeed,
        dy: 0,
        isFrightened: false,
        isEaten: false,
      })
    }
    
    setGhosts(newGhosts)
    
    // Reset Pacman position
    const pacmanX = Math.floor(mazeWidth / 2)
    const pacmanY = mazeHeight - 3
    setPacmon({
      x: pacmanX * CELL_SIZE,
      y: pacmanY * CELL_SIZE,
      dx: 0,
      dy: 0,
      lives: levelNum === 1 ? 3 : pacmon.lives,
    })
  }, [getCurrentLevelConfig, pacmon.lives])

  const initializeGame = useCallback(() => {
    setScore(0)
    setGameOver(false)
    setLevel(1)
    setGameStarted(false)
    initializeLevel(1)
  }, [initializeLevel])

  useEffect(() => {
    initializeGame()
  }, [initializeGame])

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const maze = currentMaze
      const canvasWidth = maze[0].length * CELL_SIZE
      const canvasHeight = maze.length * CELL_SIZE
      
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // Draw maze with rounded corners
      ctx.strokeStyle = COLORS.MAZE_BLUE
      ctx.fillStyle = COLORS.MAZE_BLUE
      ctx.lineWidth = 2
      
      for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < maze[y].length; x++) {
          if (maze[y][x] === 'X') {
            const cellX = x * CELL_SIZE
            const cellY = y * CELL_SIZE
            
            // Draw rounded rectangle for walls
            ctx.beginPath()
            ctx.roundRect(cellX + 1, cellY + 1, CELL_SIZE - 2, CELL_SIZE - 2, 3)
            ctx.fill()
          }
        }
      }

      // Draw dots
      ctx.fillStyle = COLORS.DOT_WHITE
      dots.forEach((dot) => {
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw power pellets with glow effect
      powerPellets.forEach((pellet) => {
        // Glow effect
        ctx.shadowColor = COLORS.POWER_PELLET_WHITE
        ctx.shadowBlur = 10
        ctx.fillStyle = COLORS.POWER_PELLET_WHITE
        ctx.beginPath()
        ctx.arc(pellet.x, pellet.y, POWER_PELLET_RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      })

      // Draw Pacman with mouth animation
      ctx.fillStyle = COLORS.PACMAN_YELLOW
      ctx.beginPath()
      
      // Determine mouth direction based on movement
      let mouthAngle = 0
      if (pacmon.dx > 0) mouthAngle = 0 // Right
      else if (pacmon.dx < 0) mouthAngle = Math.PI // Left
      else if (pacmon.dy < 0) mouthAngle = -Math.PI / 2 // Up
      else if (pacmon.dy > 0) mouthAngle = Math.PI / 2 // Down
      
      const pacmanCenterX = pacmon.x + CELL_SIZE / 2
      const pacmanCenterY = pacmon.y + CELL_SIZE / 2
      const pacmanRadius = CELL_SIZE / 2 - 2
      
      // Draw Pacman with mouth
      ctx.arc(pacmanCenterX, pacmanCenterY, pacmanRadius, 
              mouthAngle + 0.3, mouthAngle - 0.3)
      ctx.lineTo(pacmanCenterX, pacmanCenterY)
      ctx.fill()

      // Draw ghosts with classic shape
      ghosts.forEach((ghost) => {
        const ghostCenterX = ghost.x + CELL_SIZE / 2
        const ghostCenterY = ghost.y + CELL_SIZE / 2
        const ghostRadius = CELL_SIZE / 2 - 2
        
        ctx.fillStyle = ghost.isFrightened ? COLORS.FRIGHTENED_BLUE : ghost.color
        
        // Ghost body (circle + rectangle)
        ctx.beginPath()
        ctx.arc(ghostCenterX, ghostCenterY - 2, ghostRadius, Math.PI, 0)
        ctx.rect(ghost.x + 2, ghostCenterY - 2, CELL_SIZE - 4, ghostRadius + 2)
        ctx.fill()
        
        // Ghost bottom wavy edge
        ctx.beginPath()
        ctx.moveTo(ghost.x + 2, ghostCenterY + ghostRadius)
        for (let i = 0; i < 4; i++) {
          const waveX = ghost.x + 2 + (i * (CELL_SIZE - 4) / 4)
          const waveY = ghostCenterY + ghostRadius + (i % 2 === 0 ? -3 : 0)
          ctx.lineTo(waveX, waveY)
        }
        ctx.lineTo(ghost.x + CELL_SIZE - 2, ghostCenterY + ghostRadius)
        ctx.fill()

        // Ghost eyes
        ctx.fillStyle = COLORS.TEXT_WHITE
        ctx.beginPath()
        ctx.arc(ghostCenterX - 4, ghostCenterY - 4, 3, 0, Math.PI * 2)
        ctx.arc(ghostCenterX + 4, ghostCenterY - 4, 3, 0, Math.PI * 2)
        ctx.fill()

        // Eye pupils
        ctx.fillStyle = COLORS.BACKGROUND_BLACK
        ctx.beginPath()
        const pupilOffsetX = ghost.dx > 0 ? 1 : ghost.dx < 0 ? -1 : 0
        const pupilOffsetY = ghost.dy > 0 ? 1 : ghost.dy < 0 ? -1 : 0
        ctx.arc(ghostCenterX - 4 + pupilOffsetX, ghostCenterY - 4 + pupilOffsetY, 1, 0, Math.PI * 2)
        ctx.arc(ghostCenterX + 4 + pupilOffsetX, ghostCenterY - 4 + pupilOffsetY, 1, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw UI
      ctx.fillStyle = COLORS.TEXT_WHITE
      ctx.font = '16px Arial'
      ctx.fillText(`Score: ${score}`, 10, 20)
      ctx.fillText(`High Score: ${highScore}`, 150, 20)
      ctx.fillText(`Level: ${level}`, 300, 20)
      
      // Draw lives as Pacman icons
      for (let i = 0; i < pacmon.lives; i++) {
        const lifeX = canvasWidth - 100 + (i * 25)
        const lifeY = 15
        ctx.fillStyle = COLORS.PACMAN_YELLOW
        ctx.beginPath()
        ctx.arc(lifeX, lifeY, 8, 0.3, -0.3)
        ctx.lineTo(lifeX, lifeY)
        ctx.fill()
      }

      if (!gameStarted) {
        ctx.fillStyle = COLORS.TEXT_YELLOW
        ctx.font = '24px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('Ready!', canvasWidth / 2, canvasHeight / 2 + 50)
        ctx.fillText('Press ENTER to start', canvasWidth / 2, canvasHeight / 2 + 80)
        ctx.textAlign = 'left'
      }

      if (gameOver) {
        ctx.fillStyle = 'red'
        ctx.font = '32px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('Game Over!', canvasWidth / 2, canvasHeight / 2)
        ctx.fillStyle = COLORS.TEXT_WHITE
        ctx.font = '16px Arial'
        ctx.fillText('Press R to restart', canvasWidth / 2, canvasHeight / 2 + 40)
        ctx.textAlign = 'left'
      }
    },
    [pacmon, ghosts, dots, powerPellets, score, highScore, level, gameOver, gameStarted, currentMaze]
  )

  const checkCollision = useCallback((obj1: Position, obj2: Position) => {
    const dist = Math.sqrt(
      Math.pow(obj1.x - obj2.x, 2) + Math.pow(obj1.y - obj2.y, 2)
    )
    return dist < CELL_SIZE - 5
  }, [])

  const isCollidingWithWall = useCallback((x: number, y: number) => {
    const maze = currentMaze
    const gridX = Math.floor(x / CELL_SIZE)
    const gridY = Math.floor(y / CELL_SIZE)
    if (gridX < 0 || gridX >= maze[0].length || gridY < 0 || gridY >= maze.length) {
      return true
    }
    return maze[gridY][gridX] === 'X'
  }, [currentMaze])

  const movePacmon = useCallback(() => {
    setPacmon((prev) => {
      let newX = prev.x + prev.dx
      let newY = prev.y + prev.dy

      // Wrap around logic for tunnels (only for larger mazes)
      const maze = currentMaze
      if (maze[0].length >= 28) {
        if (newX < -CELL_SIZE) newX = maze[0].length * CELL_SIZE
        if (newX > maze[0].length * CELL_SIZE) newX = -CELL_SIZE
      }

      if (!isCollidingWithWall(newX, newY)) {
        return { ...prev, x: newX, y: newY }
      }
      return prev
    })
  }, [isCollidingWithWall, currentMaze])

  const moveGhosts = useCallback(() => {
    const config = getCurrentLevelConfig(level)
    
    setGhosts((prevGhosts) =>
      prevGhosts.map((ghost, index) => {
        let { x, y, dx, dy, isFrightened, isEaten } = ghost

        if (isEaten) {
          // Move eaten ghost back to center
          const maze = currentMaze
          const targetX = Math.floor(maze[0].length / 2) * CELL_SIZE
          const targetY = Math.floor(maze.length / 2) * CELL_SIZE
          const dist = Math.sqrt(Math.pow(targetX - x, 2) + Math.pow(targetY - y, 2))

          if (dist < config.ghostSpeed) {
            return { ...ghost, x: targetX, y: targetY, isEaten: false, isFrightened: false }
          }

          const angle = Math.atan2(targetY - y, targetX - x)
          dx = Math.cos(angle) * config.ghostSpeed
          dy = Math.sin(angle) * config.ghostSpeed
        } else {
          // Simple AI: move towards Pacman or randomly when frightened
          if (isFrightened) {
            // Move away from Pacman
            const pacmanCenterX = pacmon.x + CELL_SIZE / 2
            const pacmanCenterY = pacmon.y + CELL_SIZE / 2
            const ghostCenterX = x + CELL_SIZE / 2
            const ghostCenterY = y + CELL_SIZE / 2
            
            const angle = Math.atan2(ghostCenterY - pacmanCenterY, ghostCenterX - pacmanCenterX)
            dx = Math.cos(angle) * (config.ghostSpeed * 0.7) // Slower when frightened
            dy = Math.sin(angle) * (config.ghostSpeed * 0.7)
          } else {
            // Move towards Pacman with some randomness
            const pacmanCenterX = pacmon.x + CELL_SIZE / 2
            const pacmanCenterY = pacmon.y + CELL_SIZE / 2
            const ghostCenterX = x + CELL_SIZE / 2
            const ghostCenterY = y + CELL_SIZE / 2
            
            if (Math.random() < 0.8) { // 80% chance to chase Pacman
              const angle = Math.atan2(pacmanCenterY - ghostCenterY, pacmanCenterX - ghostCenterX)
              dx = Math.cos(angle) * config.ghostSpeed
              dy = Math.sin(angle) * config.ghostSpeed
            } else { // 20% chance to move randomly
              const directions = [
                { dx: config.ghostSpeed, dy: 0 },
                { dx: -config.ghostSpeed, dy: 0 },
                { dx: 0, dy: config.ghostSpeed },
                { dx: 0, dy: -config.ghostSpeed },
              ]
              const randomDir = directions[Math.floor(Math.random() * directions.length)]
              dx = randomDir.dx
              dy = randomDir.dy
            }
          }
        }

        let newX = x + dx
        let newY = y + dy

        // Wrap around logic for tunnels (only for larger mazes)
        const maze = currentMaze
        if (maze[0].length >= 28) {
          if (newX < -CELL_SIZE) newX = maze[0].length * CELL_SIZE
          if (newX > maze[0].length * CELL_SIZE) newX = -CELL_SIZE
        }

        if (!isCollidingWithWall(newX, newY)) {
          return { ...ghost, x: newX, y: newY, dx, dy }
        }

        // If colliding, try to change direction
        const possibleDirections = [
          { dx: config.ghostSpeed, dy: 0 },
          { dx: -config.ghostSpeed, dy: 0 },
          { dx: 0, dy: config.ghostSpeed },
          { dx: 0, dy: -config.ghostSpeed },
        ]
        
        for (const direction of possibleDirections) {
          if (!isCollidingWithWall(x + direction.dx, y + direction.dy)) {
            return { ...ghost, dx: direction.dx, dy: direction.dy }
          }
        }

        return ghost
      })
    )
  }, [getCurrentLevelConfig, level, currentMaze, isCollidingWithWall, pacmon])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStarted && e.key === 'Enter') {
        setGameStarted(true)
        return
      }
      
      if (gameOver && e.key.toLowerCase() === 'r') {
        initializeGame()
        return
      }
      
      if (gameOver || !gameStarted) return

      let newDx = 0
      let newDy = 0
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          newDy = -PACMON_SPEED
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          newDy = PACMON_SPEED
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          newDx = -PACMON_SPEED
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          newDx = PACMON_SPEED
          break
      }
      
      if (newDx !== 0 || newDy !== 0) {
        setPacmon((prev) => ({
          ...prev,
          dx: newDx,
          dy: newDy,
        }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [gameOver, gameStarted, initializeGame])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Update canvas size based on current maze
    const maze = currentMaze
    canvas.width = maze[0].length * CELL_SIZE
    canvas.height = maze.length * CELL_SIZE

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number

    const gameLoop = () => {
      if (!gameStarted) {
        draw(ctx)
        animationFrameId = requestAnimationFrame(gameLoop)
        return
      }

      if (gameOver) {
        draw(ctx)
        animationFrameId = requestAnimationFrame(gameLoop)
        return
      }

      movePacmon()
      moveGhosts()

      // Check for dot collisions
      setDots((prevDots) => {
        const eatenDots = prevDots.filter((dot) =>
          checkCollision(pacmon, dot)
        )
        if (eatenDots.length > 0) {
          setScore((prevScore) => prevScore + eatenDots.length * SCORE_PELLET)
        }
        return prevDots.filter((dot) => !checkCollision(pacmon, dot))
      })

      // Check for power pellet collisions
      setPowerPellets((prevPellets) => {
        const eatenPellets = prevPellets.filter((pellet) =>
          checkCollision(pacmon, pellet)
        )
        if (eatenPellets.length > 0) {
          setScore((prevScore) => prevScore + eatenPellets.length * SCORE_POWER_PELLET)
          setGhosts((prevGhosts) =>
            prevGhosts.map((g) => ({ ...g, isFrightened: true }))
          )
          if (powerPelletTimer) clearTimeout(powerPelletTimer)
          setPowerPelletTimer(
            setTimeout(() => {
              setGhosts((prevGhosts) =>
                prevGhosts.map((g) => ({ ...g, isFrightened: false }))
              )
            }, POWER_PELLET_DURATION)
          )
        }
        return prevPellets.filter((pellet) => !checkCollision(pacmon, pellet))
      })

      // Check for ghost collisions
      setGhosts((prevGhosts) =>
        prevGhosts.map((ghost) => {
          if (checkCollision(pacmon, ghost)) {
            if (ghost.isFrightened && !ghost.isEaten) {
              setScore((prevScore) => prevScore + SCORE_GHOST)
              return { ...ghost, isEaten: true }
            } else if (!ghost.isFrightened && !ghost.isEaten) {
              setPacmon((prev) => {
                const newLives = prev.lives - 1
                if (newLives <= 0) {
                  setGameOver(true)
                  setHighScore((prevHigh) => Math.max(prevHigh, score))
                }
                return {
                  ...prev,
                  x: (currentMaze[0].length / 2) * CELL_SIZE,
                  y: (currentMaze.length - 3) * CELL_SIZE,
                  dx: 0,
                  dy: 0,
                  lives: newLives,
                }
              })
              // Reset ghosts to center
              const maze = currentMaze
              const centerX = Math.floor(maze[0].length / 2)
              const centerY = Math.floor(maze.length / 2)
              return {
                ...ghost,
                x: centerX * CELL_SIZE,
                y: centerY * CELL_SIZE,
                dx: getCurrentLevelConfig(level).ghostSpeed,
                dy: 0,
                isFrightened: false,
                isEaten: false,
              }
            }
          }
          return ghost
        })
      )

      // Check for level complete
      if (dots.length === 0 && powerPellets.length === 0) {
        const nextLevel = level + 1
        setLevel(nextLevel)
        setGameStarted(false)
        initializeLevel(nextLevel)
      }

      draw(ctx)
      animationFrameId = requestAnimationFrame(gameLoop)
    }

    animationFrameId = requestAnimationFrame(gameLoop)

    return () => {
      cancelAnimationFrame(animationFrameId)
      if (powerPelletTimer) clearTimeout(powerPelletTimer)
    }
  }, [pacmon, ghosts, dots, powerPellets, score, gameOver, gameStarted, level, currentMaze, draw, movePacmon, moveGhosts, checkCollision, initializeLevel, powerPelletTimer, getCurrentLevelConfig])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: COLORS.BACKGROUND_BLACK,
        color: COLORS.TEXT_WHITE,
        fontFamily: 'Arial, sans-serif',
        padding: '20px',
      }}
    >
      <h1 style={{ color: COLORS.TEXT_YELLOW, marginBottom: '10px' }}>Pacmon Game</h1>
      <canvas
        ref={canvasRef}
        style={{
          border: `2px solid ${COLORS.MAZE_BLUE}`,
          backgroundColor: COLORS.BACKGROUND_BLACK,
          marginBottom: '20px',
        }}
      />
      
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <p>Use ARROW KEYS or WASD to move</p>
        {gameOver && <p>Press R to restart</p>}
        {!gameStarted && !gameOver && <p>Press ENTER to start</p>}
      </div>

      {gameOver && (
        <button
          onClick={initializeGame}
          style={{
            marginBottom: '20px',
            padding: '10px 20px',
            fontSize: '18px',
            cursor: 'pointer',
            backgroundColor: COLORS.PACMAN_YELLOW,
            color: COLORS.BACKGROUND_BLACK,
            border: 'none',
            borderRadius: '5px',
          }}
        >
          Play Again
        </button>
      )}
    </div>
  )
}

export default PacmonGame


