'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useFrame } from './farcaster-provider'
import { FarcasterFrame } from '@farcaster/frame-wagmi-connector'
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
  ORANGE: '#FFA500',
}

// Game constants
const GRID_SIZE = 20
const CELL_SIZE = 20
const GAME_WIDTH = GRID_SIZE * CELL_SIZE
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE

// Contract address for score storage
const SCORE_CONTRACT_ADDRESS = '0x1F0e9dcd371af37AD20E96A5a193D78052dCA904'

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
  eaten: boolean
  type: 'blinky' | 'pinky' | 'inky' | 'clyde'
  scatterTarget: Position // Target tile when in scatter mode
}

interface Pacman {
  position: Position
  direction: Position
  mouthOpen: number // 0 = closed, 1 = open
}

interface GameState {
  pacman: Pacman
  ghosts: Ghost[]
  pellets: Position[]
  powerPellets: Position[]
  score: number
  lives: number
  powerMode: boolean
  powerModeTimer: number
  gameStatus: 'loading' | 'playing' | 'postGame' | 'gameOver'
  level: number
}

// Maze layouts for different levels
const MAZES = {
  1: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  2: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
  3: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ],
}

// Initial game state
const getInitialGameState = (level: number): GameState => {
  const currentMaze = MAZES[level] || MAZES[1] // Default to level 1 maze
  const pellets: Position[] = []
  const powerPellets: Position[] = []

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (currentMaze[y][x] === 0) {
        // Add all pellets except where power pellets will be
        if (
          !(x === 1 && y === 1) &&
          !(x === GRID_SIZE - 2 && y === 1) &&
          !(x === 1 && y === GRID_SIZE - 2) &&
          !(x === GRID_SIZE - 2 && y === GRID_SIZE - 2)
        ) {
          pellets.push({ x, y })
        }
      }
    }
  }
  // Add power pellets at specific corners
  powerPellets.push(
    { x: 1, y: 1 },
    { x: GRID_SIZE - 2, y: 1 },
    { x: 1, y: GRID_SIZE - 2 },
    { x: GRID_SIZE - 2, y: GRID_SIZE - 2 }
  )

  let initialGhosts: Ghost[] = []
  if (level === 1) {
    initialGhosts = [
      { id: 0, position: { x: 9, y: 8 }, direction: { x: 0, y: 0 }, color: '#FF0000', vulnerable: false, eaten: false, type: 'blinky', scatterTarget: { x: GRID_SIZE - 1, y: 0 } }, // Red
      { id: 1, position: { x: 8, y: 8 }, direction: { x: 0, y: 0 }, color: '#FFB8FF', vulnerable: false, eaten: false, type: 'pinky', scatterTarget: { x: 0, y: 0 } }, // Pink
    ]
  } else if (level === 2) {
    initialGhosts = [
      { id: 0, position: { x: 9, y: 8 }, direction: { x: 0, y: 0 }, color: '#FF0000', vulnerable: false, eaten: false, type: 'blinky', scatterTarget: { x: GRID_SIZE - 1, y: 0 } },
      { id: 1, position: { x: 8, y: 8 }, direction: { x: 0, y: 0 }, color: '#FFB8FF', vulnerable: false, eaten: false, type: 'pinky', scatterTarget: { x: 0, y: 0 } },
      { id: 2, position: { x: 10, y: 8 }, direction: { x: 0, y: 0 }, color: '#00FFFF', vulnerable: false, eaten: false, type: 'inky', scatterTarget: { x: GRID_SIZE - 1, y: GRID_SIZE - 1 } }, // Cyan
    ]
  } else {
    initialGhosts = [
      { id: 0, position: { x: 9, y: 8 }, direction: { x: 0, y: 0 }, color: '#FF0000', vulnerable: false, eaten: false, type: 'blinky', scatterTarget: { x: GRID_SIZE - 1, y: 0 } },
      { id: 1, position: { x: 8, y: 8 }, direction: { x: 0, y: 0 }, color: '#FFB8FF', vulnerable: false, eaten: false, type: 'pinky', scatterTarget: { x: 0, y: 0 } },
      { id: 2, position: { x: 10, y: 8 }, direction: { x: 0, y: 0 }, color: '#00FFFF', vulnerable: false, eaten: false, type: 'inky', scatterTarget: { x: GRID_SIZE - 1, y: GRID_SIZE - 1 } },
      { id: 3, position: { x: 9, y: 9 }, direction: { x: 0, y: 0 }, color: '#FFB852', vulnerable: false, eaten: false, type: 'clyde', scatterTarget: { x: 0, y: GRID_SIZE - 1 } }, // Orange
    ]
  }

  return {
    pacman: { position: { x: 9, y: 15 }, direction: { x: 0, y: 0 }, mouthOpen: 0 },
    ghosts: initialGhosts,
    pellets,
    powerPellets,
    score: 0,
    lives: 3,
    powerMode: false,
    powerModeTimer: 0,
    gameStatus: 'loading',
    level,
  }
}

// Sound manager (simplified for example)
const soundManager = {
  _sounds: {},
  loadSound(name: string, path: string) {
    // In a real app, you'd load audio files here
    // For this example, we'll just simulate playing
    this._sounds[name] = new Audio(path)
  },
  play(name: string) {
    // console.log(`Playing sound: ${name}`)
    // this._sounds[name]?.play()
  },
  stop(name: string) {
    // this._sounds[name]?.pause()
    // this._sounds[name]?.currentTime = 0
  },
  stopAll() {
    // for (const name in this._sounds) {
    //   this.stop(name)
    // }
  },
}

// Game loop interval (ms)
const GAME_LOOP_INTERVAL = 200

export default function PacmonGame() {
  const [gameState, setGameState] = useState<GameState>(() => getInitialGameState(1))
  const [frameState, setFrameState] = useState({
    score: 0,
    lives: 3,
    level: 1,
    status: 'loading',
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<number | null>(null)
  const soundManagerRef = useRef(soundManager)

  // Load sounds on mount
  useEffect(() => {
    soundManagerRef.current.loadSound('pelletEat', '/sounds/pellet_eat.wav')
    soundManagerRef.current.loadSound('powerPellet', '/sounds/power_pellet.wav')
    soundManagerRef.current.loadSound('ghostEat', '/sounds/ghost_eat.wav')
    soundManagerRef.current.loadSound('death', '/sounds/death.wav')
    soundManagerRef.current.loadSound('gameOver', '/sounds/game_over.wav')
    soundManagerRef.current.loadSound('gameStart', '/sounds/game_start.wav')

    // Play game start sound
    soundManagerRef.current.play('gameStart')

    setGameState(prev => ({ ...prev, gameStatus: 'playing' }))
  }, [])

  // Game loop
  useEffect(() => {
    if (gameState.gameStatus === 'playing') {
      gameLoopRef.current = window.setInterval(() => {
        setGameState(prev => updateGame(prev))
      }, GAME_LOOP_INTERVAL)
    } else if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
      gameLoopRef.current = null
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState.gameStatus])

  // Update frame state for Farcaster
  useEffect(() => {
    setFrameState({
      score: gameState.score,
      lives: gameState.lives,
      level: gameState.level,
      status: gameState.gameStatus,
    })
  }, [gameState.score, gameState.lives, gameState.level, gameState.gameStatus])

  // Game update logic
  const updateGame = (prevState: GameState): GameState => {
    const newState = { ...prevState }

    // Update Pacman position
    const newPacmanPos = {
      x: newState.pacman.position.x + newState.pacman.direction.x,
      y: newState.pacman.position.y + newState.pacman.direction.y,
    }

    // Check for wall collision
    const currentMaze = MAZES[newState.level] || MAZES[1] // Get maze for current level
    if (
      newPacmanPos.x >= 0 &&
      newPacmanPos.x < GRID_SIZE &&
      newPacmanPos.y >= 0 &&
      newPacmanPos.y < GRID_SIZE &&
      currentMaze[newPacmanPos.y][newPacmanPos.x] !== 1
    ) {
      newState.pacman.position = newPacmanPos
    } else {
      // Stop Pacman if hits a wall
      newState.pacman.direction = { x: 0, y: 0 }
    }

    // Update Pacman mouth
    newState.pacman.mouthOpen = (newState.pacman.mouthOpen + 1) % 2

    // Check pellet collection
    const pelletIndex = newState.pellets.findIndex(
      pellet =>
        pellet.x === newState.pacman.position.x &&
        pellet.y === newState.pacman.position.y
    )
    if (pelletIndex !== -1) {
      newState.pellets = newState.pellets.filter((_, index) => index !== pelletIndex)
      newState.score += 10
      // Play pellet eat sound
      soundManagerRef.current?.play('pelletEat')
    }

    // Check power pellet collection
    const powerPelletIndex = newState.powerPellets.findIndex(
      pellet =>
        pellet.x === newState.pacman.position.x &&
        pellet.y === newState.pacman.position.y
    )
    if (powerPelletIndex !== -1) {
      newState.powerPellets = newState.powerPellets.filter(
        (_, index) => index !== powerPelletIndex
      )
      newState.score += 50
      newState.powerMode = true
      newState.powerModeTimer = 30 // 6 seconds at 200ms intervals
      // Play power pellet sound
      soundManagerRef.current?.play('powerPellet')
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
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
        ]
        const validDirections = directions.filter(dir => {
          const testPos = {
            x: ghost.position.x + dir.x,
            y: ghost.position.y + dir.y,
          }
          return (
            testPos.x >= 0 &&
            testPos.x < GRID_SIZE &&
            testPos.y >= 0 &&
            testPos.y < GRID_SIZE &&
            currentMaze[testPos.y][testPos.x] !== 1
          )
        })
        const newDirection = validDirections[Math.floor(Math.random() * validDirections.length)]
        targetTile = { x: ghost.position.x + newDirection.x, y: ghost.position.y + newDirection.y }
      } else {
        // Chase/Scatter mode
        switch (ghost.type) {
          case 'blinky':
            targetTile = newState.pacman.position
            break
          case 'pinky':
            // 4 tiles in front of Pac-Man
            targetTile = {
              x: newState.pacman.position.x + newState.pacman.direction.x * 4,
              y: newState.pacman.position.y + newState.pacman.direction.y * 4,
            }
            break
          case 'inky':
            // Complex: depends on Pac-Man and Blinky
            const blinky = newState.ghosts.find(g => g.type === 'blinky')
            if (blinky) {
              const pacmanTwoAhead = {
                x: newState.pacman.position.x + newState.pacman.direction.x * 2,
                y: newState.pacman.position.y + newState.pacman.direction.y * 2,
              }
              const vector = {
                x: pacmanTwoAhead.x - blinky.position.x,
                y: pacmanTwoAhead.y - blinky.position.y,
              }
              targetTile = { x: blinky.position.x + vector.x * 2, y: blinky.position.y + vector.y * 2 }
            } else {
              targetTile = newState.pacman.position // Fallback
            }
            break
          case 'clyde':
            // Scatter if close to Pac-Man, else chase
            const distance = Math.sqrt(
              Math.pow(ghost.position.x - newState.pacman.position.x, 2) +
                Math.pow(ghost.position.y - newState.pacman.position.y, 2)
            )
            if (distance < 8) {
              targetTile = ghost.scatterTarget
            } else {
              targetTile = newState.pacman.position
            }
            break
          default:
            targetTile = newState.pacman.position
        }
      }

      // Ghost movement logic (shortest path to target, avoiding walls)
      const possibleDirections = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ]

      let bestDirection = ghost.direction
      let minDistance = Infinity

      possibleDirections.forEach(dir => {
        const nextPos = {
          x: ghost.position.x + dir.x,
          y: ghost.position.y + dir.y,
        }
        // Check if next position is a wall
        if (
          nextPos.x >= 0 &&
          nextPos.x < GRID_SIZE &&
          nextPos.y >= 0 &&
          nextPos.y < GRID_SIZE &&
          currentMaze[nextPos.y][nextPos.x] !== 1
        ) {
          // Avoid reversing direction unless necessary
          if (
            dir.x === -ghost.direction.x &&
            dir.y === -ghost.direction.y &&
            !newState.powerMode
          ) {
            return // Skip this direction
          }

          const dist = Math.sqrt(
            Math.pow(nextPos.x - targetTile.x, 2) +
              Math.pow(nextPos.y - targetTile.y, 2)
          )

          if (dist < minDistance) {
            minDistance = dist
            bestDirection = dir
          }
        }
      })

      const newGhostPos = {
        x: ghost.position.x + bestDirection.x,
        y: ghost.position.y + bestDirection.y,
      }

      return { ...ghost, position: newGhostPos, direction: bestDirection }
    })

    // Check ghost collisions
    newState.ghosts.forEach(ghost => {
      if (
        ghost.position.x === newState.pacman.position.x &&
        ghost.position.y === newState.pacman.position.y
      ) {
        if (ghost.vulnerable) {
          // Eat ghost
          newState.score += 200
          newState.ghosts = newState.ghosts.map(g =>
            g.id === ghost.id ? { ...g, eaten: true, vulnerable: false } : g
          )
          // Play ghost eat sound
          soundManagerRef.current?.play('ghostEat')
        } else if (!ghost.eaten) {
          // Lose life
          newState.lives -= 1
          newState.pacman = { x: 9, y: 15 } // Reset Pacman position
          newState.pacman.direction = { x: 0, y: 0 } // Stop Pacman
          newState.ghosts = newState.ghosts.map(g => ({
            ...g,
            position: getInitialGameState(newState.level).ghosts[g.id].position,
            direction: { x: 0, y: 0 },
            vulnerable: false,
            eaten: false,
          }))
          // Play death sound
          soundManagerRef.current?.play('death')
          if (newState.lives <= 0) {
            newState.gameStatus = 'gameOver'
            // Stop background music and play game over sound
            soundManagerRef.current?.stop('backgroundMusic')
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
          vulnerable: false,
        }))
      }
    }

    // Check level complete
    if (newState.pellets.length === 0 && newState.powerPellets.length === 0) {
      newState.gameStatus = 'postGame'
      // Stop background music and play game over sound
      soundManagerRef.current?.stop('backgroundMusic')
      soundManagerRef.current?.play('gameOver')
      // Advance to next level
      if (newState.level < Object.keys(MAZES).length) {
        newState.level += 1
        const newLevelState = getInitialGameState(newState.level)
        newState.pacman = newLevelState.pacman
        newState.ghosts = newLevelState.ghosts
        newState.pellets = newLevelState.pellets
        newState.powerPellets = newLevelState.powerPellets
        newState.gameStatus = 'playing'
      } else {
        // Game completed
        newState.gameStatus = 'gameOver'
      }
    }

    return newState
  }

  // Handle keyboard input
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState.gameStatus !== 'playing') return

    let newDirection = { x: 0, y: 0 }
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
        newDirection.y = -1
        break
      case 'ArrowDown':
      case 's':
        newDirection.y = 1
        break
      case 'ArrowLeft':
      case 'a':
        newDirection.x = -1
        break
      case 'ArrowRight':
      case 'd':
        newDirection.x = 1
        break
      default:
        return
    }

    // Only update direction if the new direction is valid (not a wall in the next tile)
    const nextX = gameState.pacman.position.x + newDirection.x
    const nextY = gameState.pacman.position.y + newDirection.y

    const currentMaze = MAZES[gameState.level] || MAZES[1] // Get maze for current level
    if (
      nextX >= 0 &&
      nextX < GRID_SIZE &&
      nextY >= 0 &&
      nextY < GRID_SIZE &&
      currentMaze[nextY][nextX] !== 1
    ) {
      setGameState(prev => ({
        ...prev,
        pacman: { ...prev.pacman, direction: newDirection },
      }))
    }
  }, [gameState.gameStatus, gameState.pacman.position, gameState.level])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
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
    const currentMaze = MAZES[gameState.level] || MAZES[1] // Get maze for current level
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (currentMaze[y][x] === 1) {
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
        CELL_SIZE / 8,
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
        CELL_SIZE / 4,
        0,
        2 * Math.PI
      )
      ctx.fill()
    })

    // Draw Pacman
    ctx.fillStyle = '#FFFF00' // Classic Pac-Man yellow
    ctx.beginPath()
    ctx.arc(
      gameState.pacman.position.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacman.position.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0.2 * Math.PI * gameState.pacman.mouthOpen,
      1.8 * Math.PI * gameState.pacman.mouthOpen,
      false
    )
    ctx.lineTo(
      gameState.pacman.position.x * CELL_SIZE + CELL_SIZE / 2,
      gameState.pacman.position.y * CELL_SIZE + CELL_SIZE / 2
    )
    ctx.fill()

    // Draw ghosts
    gameState.ghosts.forEach(ghost => {
      ctx.fillStyle = ghost.vulnerable ? '#ADD8E6' : ghost.color // Light blue when vulnerable
      ctx.beginPath()
      ctx.arc(
        ghost.position.x * CELL_SIZE + CELL_SIZE / 2,
        ghost.position.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        0,
        2 * Math.PI
      )
      ctx.lineTo(
        ghost.position.x * CELL_SIZE + CELL_SIZE / 2 - (CELL_SIZE / 2 - 2),
        ghost.position.y * CELL_SIZE + CELL_SIZE / 2 + (CELL_SIZE / 2 - 2)
      )
      ctx.lineTo(
        ghost.position.x * CELL_SIZE + CELL_SIZE / 2 + (CELL_SIZE / 2 - 2),
        ghost.position.y * CELL_SIZE + CELL_SIZE / 2 + (CELL_SIZE / 2 - 2)
      )
      ctx.fill()

      // Draw ghost eyes (simplified)
      ctx.fillStyle = COLORS.WHITE
      ctx.beginPath()
      ctx.arc(
        ghost.position.x * CELL_SIZE + CELL_SIZE / 2 - CELL_SIZE / 6,
        ghost.position.y * CELL_SIZE + CELL_SIZE / 2 - CELL_SIZE / 6,
        CELL_SIZE / 8,
        0,
        2 * Math.PI
      )
      ctx.fill()
      ctx.beginPath()
      ctx.arc(
        ghost.position.x * CELL_SIZE + CELL_SIZE / 2 + CELL_SIZE / 6,
        ghost.position.y * CELL_SIZE + CELL_SIZE / 2 - CELL_SIZE / 6,
        CELL_SIZE / 8,
        0,
        2 * Math.PI
      )
      ctx.fill()

      ctx.fillStyle = COLORS.MONAD_BLACK
      ctx.beginPath()
      ctx.arc(
        ghost.position.x * CELL_SIZE + CELL_SIZE / 2 - CELL_SIZE / 6 +
          ghost.direction.x * (CELL_SIZE / 16),
        ghost.position.y * CELL_SIZE + CELL_SIZE / 2 - CELL_SIZE / 6 +
          ghost.direction.y * (CELL_SIZE / 16),
        CELL_SIZE / 16,
        0,
        2 * Math.PI
      )
      ctx.fill()
      ctx.beginPath()
      ctx.arc(
        ghost.position.x * CELL_SIZE + CELL_SIZE / 2 + CELL_SIZE / 6 +
          ghost.direction.x * (CELL_SIZE / 16),
        ghost.position.y * CELL_SIZE + CELL_SIZE / 2 - CELL_SIZE / 6 +
          ghost.direction.y * (CELL_SIZE / 16),
        CELL_SIZE / 16,
        0,
        2 * Math.PI
      )
      ctx.fill()
    })

    // Draw score and lives
    ctx.fillStyle = COLORS.WHITE
    ctx.font = '16px Arial'
    ctx.fillText(`Score: ${gameState.score}`, 10, GAME_HEIGHT - 10)
    ctx.fillText(`Lives: ${gameState.lives}`, GAME_WIDTH - 80, GAME_HEIGHT - 10)
    ctx.fillText(`Level: ${gameState.level}`, GAME_WIDTH / 2 - 30, GAME_HEIGHT - 10)

    // Draw game status
    if (gameState.gameStatus === 'loading') {
      ctx.font = '30px Arial'
      ctx.fillStyle = COLORS.YELLOW
      ctx.fillText('Loading...', GAME_WIDTH / 2 - 70, GAME_HEIGHT / 2)
    } else if (gameState.gameStatus === 'postGame') {
      ctx.font = '30px Arial'
      ctx.fillStyle = COLORS.YELLOW
      ctx.fillText('Level Complete!', GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2)
    } else if (gameState.gameStatus === 'gameOver') {
      ctx.font = '30px Arial'
      ctx.fillStyle = COLORS.YELLOW
      ctx.fillText('Game Over!', GAME_WIDTH / 2 - 80, GAME_HEIGHT / 2)
    }
  }, [gameState])

  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { sendTransaction } = useSendTransaction()
  const { switchChain } = useSwitchChain()
  const publicClient = usePublicClient()

  const onConnectWallet = useCallback(() => {
    if (!isConnected) {
      connect({ connector: connectors[0] })
    }
  }, [connect, connectors, isConnected])

  const onSendScore = useCallback(async () => {
    if (!address || !publicClient) return

    const score = gameState.score
    const level = gameState.level

    const data = encodeFunctionData({
      abi: [
        {
          inputs: [
            { name: 'score', type: 'uint256' },
            { name: 'level', type: 'uint256' },
          ],
          name: 'recordScore',
          outputs: [],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'recordScore',
      args: [BigInt(score), BigInt(level)],
    })

    try {
      const { hash } = await sendTransaction({
        to: SCORE_CONTRACT_ADDRESS,
        data,
      })
      console.log('Transaction hash:', hash)
      // Optionally, wait for transaction receipt
      // const receipt = await publicClient.waitForTransactionReceipt({ hash })
      // console.log('Transaction receipt:', receipt)
    } catch (error) {
      console.error('Failed to send transaction:', error)
    }
  }, [address, gameState.score, gameState.level, sendTransaction, publicClient])

  const onResetGame = useCallback(() => {
    setGameState(getInitialGameState(1)) // Reset to level 1
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: COLORS.MONAD_BLACK,
        color: COLORS.WHITE,
        fontFamily: 'monospace',
        position: 'relative',
      }}
    >
      <h1 style={{ fontSize: '2em', marginBottom: '20px' }}>Pacmon</h1>
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        style={{
          border: `2px solid ${COLORS.MONAD_BLUE}`,
          backgroundColor: COLORS.MONAD_BLACK,
        }}
      />
      <div
        style={{
          marginTop: '20px',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {gameState.gameStatus === 'gameOver' && (
          <button
            onClick={onResetGame}
            style={{
              padding: '10px 20px',
              fontSize: '1em',
              backgroundColor: COLORS.MONAD_PURPLE,
              color: COLORS.WHITE,
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Play Again
          </button>
        )}
        {isConnected ? (
          <button
            onClick={onSendScore}
            style={{
              padding: '10px 20px',
              fontSize: '1em',
              backgroundColor: COLORS.MONAD_PURPLE,
              color: COLORS.WHITE,
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Send Score to Monad ({gameState.score})
          </button>
        ) : (
          <button
            onClick={onConnectWallet}
            style={{
              padding: '10px 20px',
              fontSize: '1em',
              backgroundColor: COLORS.MONAD_PURPLE,
              color: COLORS.WHITE,
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* Farcaster Frame for game state */}
      <FarcasterFrame
        frameUrl={
          `${process.env.NEXT_PUBLIC_URL}/api/frame?score=${frameState.score}&lives=${frameState.lives}&level=${frameState.level}&status=${frameState.status}`
        }
      />

      {/* Optional: Display game instructions or other info */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <p>Use Arrow Keys or WASD to move Pacmon.</p>
      </div>
    </div>
  )
}


