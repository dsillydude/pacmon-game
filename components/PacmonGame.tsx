// PacmonGame.tsx - IMPROVED VERSION
'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useFrame } from '@/components/farcaster-provider'
import { farcasterFrame } from '@farcaster/frame-wagmi-connector'
import { parseEther, toHex } from 'viem'
import { monadTestnet } from 'viem/chains'
import { useAccount, useConnect, useDisconnect, useSendTransaction, useSwitchChain, usePublicClient } from 'wagmi'

// Updated Color Palette to Match Reference Image
const COLORS = {
  WALL: '#8A2BE2',        // Purple walls
  BACKGROUND: '#1A1A2E',  // Dim background
  PACMAN: '#9370DB',      // Purple Pacman
  DOTS: '#FFD700',        // Gold dots
  POWER_PELLET: '#FF69B4',// Pink power pellets
  GHOSTS: [               // Ghost colors from reference
    '#FF0000', // Red (Blinky)
    '#FFB8FF', // Pink (Pinky)
    '#00FFFF', // Cyan (Inky)
    '#FFA500'  // Orange (Clyde)
  ],
  TEXT: '#FFFFFF',
  SCORE: '#00FF00'
}

// Game constants
const GRID_SIZE = 20
const CELL_SIZE = 20
const GAME_WIDTH = GRID_SIZE * CELL_SIZE
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE

// Updated maze layout to match reference image
const MAZE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,1,2,1,1,1,2,1,1,2,1],
  [1,3,1,1,2,1,1,1,2,1,1,2,1,1,1,2,1,1,3,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,2,1],
  [1,2,2,2,2,1,2,2,2,1,1,2,2,1,2,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,2,1,1,2,1,1,2,1,1,1,1,1],
  [0,0,0,1,2,1,2,2,2,2,2,2,2,1,2,1,0,0,0,0],
  [1,1,1,1,2,1,2,1,1,0,0,1,2,1,2,1,1,1,1,1],
  [2,2,2,2,2,2,2,1,0,0,0,0,1,2,2,2,2,2,2,2],
  [1,1,1,1,2,1,2,1,1,1,1,1,1,2,1,2,1,1,1,1],
  [0,0,0,1,2,1,2,2,2,2,2,2,2,2,1,2,1,0,0,0],
  [1,1,1,1,2,1,2,1,1,1,1,1,1,2,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,1,2,1,1,1,2,1,1,2,1],
  [1,3,2,2,2,1,2,2,2,2,2,2,2,2,1,2,2,2,3,1],
  [1,1,1,1,2,1,2,1,1,1,1,1,1,2,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
]

interface Position { x: number; y: number }

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
  highScore: number
  onChainScores: any[]
  showLeaderboard: boolean
}

class SoundManager {
  private sounds: { [key: string]: HTMLAudioElement } = {}
  private soundsEnabled = true

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
      levelComplete: '/sounds/level-complete.mp3'
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
    this.sounds[soundName].currentTime = 0
    this.sounds[soundName].play().catch(console.error)
  }

  playBackgroundMusic() {
    if (this.soundsEnabled && this.sounds.backgroundMusic) {
      this.sounds.backgroundMusic.play().catch(console.error)
    }
  }

  stopBackgroundMusic() {
    this.sounds.backgroundMusic?.pause()
    this.sounds.backgroundMusic!.currentTime = 0
  }

  toggleSounds() {
    this.soundsEnabled = !this.soundsEnabled
    if (!this.soundsEnabled) this.stopBackgroundMusic()
    return this.soundsEnabled
  }
}

export default function PacmonGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const soundManagerRef = useRef<SoundManager | null>(null)
  const { isEthProviderAvailable } = useFrame()
  const { isConnected, address, chainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { sendTransaction } = useSendTransaction()
  const { switchChain } = useSwitchChain()
  const { connect } = useConnect()
  const publicClient = usePublicClient()
  const [scoreSaved, setScoreSaved] = useState(false)
  
  const [gameState, setGameState] = useState<GameState>({
    pacmon: { x: 9, y: 15 },
    pacmonDirection: { x: 0, y: 0 },
    ghosts: [
      { id: 1, position: { x: 9, y: 9 }, direction: { x: 1, y: 0 }, color: COLORS.GHOSTS[0], vulnerable: false, type: 'blinky', scatterTarget: { x: 18, y: 0 }, eaten: false, speed: 0.5 },
      { id: 2, position: { x: 10, y: 9 }, direction: { x: -1, y: 0 }, color: COLORS.GHOSTS[1], vulnerable: false, type: 'pinky', scatterTarget: { x: 1, y: 0 }, eaten: false, speed: 0.5 },
      { id: 3, position: { x: 9, y: 10 }, direction: { x: 0, y: 1 }, color: COLORS.GHOSTS[2], vulnerable: false, type: 'inky', scatterTarget: { x: 18, y: 18 }, eaten: false, speed: 0.5 },
      { id: 4, position: { x: 10, y: 10 }, direction: { x: 0, y: -1 }, color: COLORS.GHOSTS[3], vulnerable: false, type: 'clyde', scatterTarget: { x: 1, y: 18 }, eaten: false, speed: 0.5 }
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
    onChainScores: [],
    showLeaderboard: false
  })

  // Initialize sound manager
  useEffect(() => {
    soundManagerRef.current = new SoundManager()
    return () => soundManagerRef.current?.stopBackgroundMusic()
  }, [])

  // Load real on-chain scores
  const loadOnChainScores = useCallback(async () => {
    if (!publicClient || !address) return
    try {
      // Replace with actual contract call
      const scores = [] // await publicClient.readContract(...)
      setGameState(prev => ({
        ...prev,
        onChainScores: scores,
        highScore: scores[0]?.score || 0
      }))
    } catch (error) {
      console.error('Error loading scores:', error)
      setGameState(prev => ({ ...prev, onChainScores: [], highScore: 0 }))
    }
  }, [publicClient, address])

  useEffect(() => {
    if (isConnected && address && chainId === monadTestnet.id) {
      loadOnChainScores()
    }
  }, [isConnected, address, chainId, loadOnChainScores])

  // Initialize pellets
  useEffect(() => {
    const pellets: Position[] = []
    const powerPellets: Position[] = []
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (MAZE[y][x] === 2) pellets.push({ x, y })
        if (MAZE[y][x] === 3) powerPellets.push({ x, y })
      }
    }
    setGameState(prev => ({ ...prev, pellets, powerPellets }))
  }, [])

  // Enhanced ghost movement
  const moveGhosts = useCallback((prevState: GameState) => {
    return prevState.ghosts.map(ghost => {
      if (ghost.eaten) {
        if (ghost.position.x === 9 && ghost.position.y === 9) {
          return { ...ghost, eaten: false, vulnerable: false }
        }
        const target = { x: 9, y: 9 }
        const dx = target.x - ghost.position.x
        const dy = target.y - ghost.position.y
        let newDirection = { x: 0, y: 0 }
        if (Math.abs(dx) > Math.abs(dy)) newDirection.x = dx > 0 ? 1 : -1
        else newDirection.y = dy > 0 ? 1 : -1
        return { 
          ...ghost, 
          direction: newDirection, 
          position: { 
            x: ghost.position.x + newDirection.x * ghost.speed, 
            y: ghost.position.y + newDirection.y * ghost.speed 
          } 
        }
      }

      let targetTile: Position
      if (prevState.powerMode) {
        const directions = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
        const validDirections = directions.filter(dir => {
          const testPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
          return testPos.x >= 0 && testPos.x < GRID_SIZE && 
                 testPos.y >= 0 && testPos.y < GRID_SIZE && 
                 MAZE[testPos.y][testPos.x] !== 1
        })
        const newDirection = validDirections[Math.floor(Math.random() * validDirections.length)]
        targetTile = { x: ghost.position.x + newDirection.x, y: ghost.position.y + newDirection.y }
      } else {
        switch (ghost.type) {
          case 'blinky': targetTile = prevState.pacmon; break
          case 'pinky':
            targetTile = {
              x: prevState.pacmon.x + prevState.pacmonDirection.x * 4,
              y: prevState.pacmon.y + prevState.pacmonDirection.y * 4
            }
            break
          case 'inky':
            const blinky = prevState.ghosts.find(g => g.type === 'blinky')
            if (blinky) {
              const pacmanTwoAhead = {
                x: prevState.pacmon.x + prevState.pacmonDirection.x * 2,
                y: prevState.pacmon.y + prevState.pacmonDirection.y * 2
              }
              const vector = {
                x: pacmanTwoAhead.x - blinky.position.x,
                y: pacmanTwoAhead.y - blinky.position.y
              }
              targetTile = { x: blinky.position.x + vector.x * 2, y: blinky.position.y + vector.y * 2 }
            } else targetTile = prevState.pacmon
            break
          case 'clyde':
            const distance = Math.sqrt(
              Math.pow(ghost.position.x - prevState.pacmon.x, 2) +
              Math.pow(ghost.position.y - prevState.pacmon.y, 2))
            targetTile = distance < 8 ? ghost.scatterTarget : prevState.pacmon
            break
          default: targetTile = prevState.pacmon
        }
      }

      const possibleDirections = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]
      let bestDirection = ghost.direction
      let minDistance = Infinity

      possibleDirections.forEach(dir => {
        const nextPos = { x: ghost.position.x + dir.x, y: ghost.position.y + dir.y }
        if (nextPos.x >= 0 && nextPos.x < GRID_SIZE && nextPos.y >= 0 && nextPos.y < GRID_SIZE && MAZE[nextPos.y][nextPos.x] !== 1) {
          const distance = Math.sqrt(Math.pow(nextPos.x - targetTile.x, 2) + Math.pow(nextPos.y - targetTile.y, 2))
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
          x: ghost.position.x + bestDirection.x * ghost.speed, 
          y: ghost.position.y + bestDirection.y * ghost.speed 
        },
        vulnerable: prevState.powerMode
      }
    })
  }, [])

  // Game loop with level progression
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

          if (newPacmonPos.x >= 0 && newPacmonPos.x < GRID_SIZE &&
              newPacmonPos.y >= 0 && newPacmonPos.y < GRID_SIZE &&
              MAZE[newPacmonPos.y][newPacmonPos.x] !== 1) {
            newState.pacmon = newPacmonPos

            // Check pellet collection
            const pelletIndex = newState.pellets.findIndex(
              p => p.x === newState.pacmon.x && p.y === newState.pacmon.y
            )
            if (pelletIndex !== -1) {
              newState.pellets = newState.pellets.filter((_, i) => i !== pelletIndex)
              newState.score += 10 * newState.level
              soundManagerRef.current?.play('pelletEat')
            }

            // Check power pellet
            const powerPelletIndex = newState.powerPellets.findIndex(
              p => p.x === newState.pacmon.x && p.y === newState.pacmon.y
            )
            if (powerPelletIndex !== -1) {
              newState.powerPellets = newState.powerPellets.filter((_, i) => i !== powerPelletIndex)
              newState.score += 50 * newState.level
              newState.powerMode = true
              newState.powerModeTimer = 30 - (newState.level * 2)
              soundManagerRef.current?.play('powerPellet')
            }
          }

          // Move ghosts
          newState.ghosts = moveGhosts(newState)
          
          // Check ghost collisions
          newState.ghosts.forEach(ghost => {
            if (Math.abs(ghost.position.x - newState.pacmon.x) < 0.8 && 
                Math.abs(ghost.position.y - newState.pacmon.y) < 0.8) {
              if (ghost.vulnerable) {
                newState.score += 200 * newState.level
                ghost.eaten = true
                ghost.vulnerable = false
                soundManagerRef.current?.play('ghostEat')
              } else if (!ghost.eaten) {
                newState.lives -= 1
                newState.pacmon = { x: 9, y: 15 }
                newState.pacmonDirection = { x: 0, y: 0 }
                newState.ghosts = newState.ghosts.map(g => ({ 
                  ...g, 
                  position: { x: 9, y: 9 }, 
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
              newState.ghosts = newState.ghosts.map(g => ({ ...g, vulnerable: false }))
            }
          }
          
          // Level completion
          if (newState.pellets.length === 0 && newState.powerPellets.length === 0) {
            soundManagerRef.current?.play('levelComplete')
            newState.level += 1
            newState.ghosts = newState.ghosts.map(g => ({
              ...g,
              speed: g.speed + 0.1
            }))
            if (newState.level % 3 === 0 && newState.ghosts.length < 8) {
              const newGhost = {
                id: newState.ghosts.length + 1,
                position: { x: 9, y: 9 },
                direction: { x: 1, y: 0 },
                color: COLORS.GHOSTS[newState.ghosts.length % COLORS.GHOSTS.length],
                vulnerable: false,
                type: ['blinky', 'pinky', 'inky', 'clyde'][newState.ghosts.length % 4] as any,
                scatterTarget: { x: 18, y: 0 },
                eaten: false,
                speed: 0.5 + (newState.level * 0.1)
              }
              newState.ghosts.push(newGhost)
            }
            // Reset pellets
            const pellets: Position[] = []
            const powerPellets: Position[] = []
            for (let y = 0; y < GRID_SIZE; y++) {
              for (let x = 0; x < GRID_SIZE; x++) {
                if (MAZE[y][x] === 2) pellets.push({ x, y })
                if (MAZE[y][x] === 3) powerPellets.push({ x, y })
              }
            }
            newState.pellets = pellets
            newState.powerPellets = powerPellets
            newState.pacmon = { x: 9, y: 15 }
          }
          
          return newState
        })
      }
    }, 200)

    return () => clearInterval(gameLoop)
  }, [gameState.gameStatus, moveGhosts])

  // [Rest of the component code (handleKeyPress, render, etc.) remains the same]
  // Make sure to update the JSX to use the new COLORS constants

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ backgroundColor: COLORS.BACKGROUND }}>
      {/* Your existing JSX structure */}
      {/* Update colors to use the new COLORS constants */}
    </div>
  )
}