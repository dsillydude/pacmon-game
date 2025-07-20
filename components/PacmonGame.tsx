import React, { useState, useEffect, useCallback, useRef } from 'react'


import { useFrame } from 'frames.js/next/server'
import { useAccount, useConnect, useDisconnect, usePublicClient, useSendTransaction, useSwitchChain } from 'wagmi'
import { parseEther, encodeFunctionData } from 'viem'
import { monadTestnet } from 'wagmi/chains'
import { farcasterFrame } from 'frames.js/wagmi/src/farcaster'

// Constants for game board
const GRID_SIZE = 20
const CELL_SIZE = 20
const GAME_WIDTH = GRID_SIZE * CELL_SIZE
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE

// Game state interfaces
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
  type: string
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
  totalPlayers: number
  totalPlays: number
  userOnChainScore: number | null
  onChainScores: OnChainScore[]
  showLeaderboard: boolean
}

interface OnChainScore {
  address: string
  score: number
  timestamp: number
}

// Sound Manager (simplified for example)
class SoundManager {
  playSound(sound: string) {
    // console.log(`Playing sound: ${sound}`)
    // In a real game, you would play audio files here
  }
}

const COLORS = {
  MONAD_PURPLE: '#836EF9',
  MONAD_BLUE: '#000080', // Dim background maze color
  MONAD_BERRY: '#FF0000', // Red ghost
  MONAD_OFF_WHITE: '#00FFFF', // Cyan ghost
  MONAD_BLACK: '#000000',
  WHITE: '#FFFFFF',
  GREEN: '#00FF00',
  ORANGE: '#FFA500',
  PINK: '#FFC0CB', // Pink ghost
  YELLOW: '#FFFF00' // Yellow ghost
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
  const [level, setLevel] = useState(1) // New state for level

  const [gameState, setGameState] = useState<GameState>({
    pacmon: { x: 9, y: 15 },
    pacmonDirection: { x: 0, y: 0 },
    ghosts: [
      { id: 1, position: { x: 9, y: 9 }, direction: { x: 1, y: 0 }, color: COLORS.MONAD_BERRY, vulnerable: false, type: 'blinky', scatterTarget: { x: 18, y: 0 }, eaten: false }, // Red
      { id: 2, position: { x: 10, y: 9 }, direction: { x: -1, y: 0 }, color: COLORS.PINK, vulnerable: false, type: 'pinky', scatterTarget: { x: 1, y: 0 }, eaten: false }, // Pink
      { id: 3, position: { x: 9, y: 10 }, direction: { x: 0, y: 1 }, color: COLORS.MONAD_OFF_WHITE, vulnerable: false, type: 'inky', scatterTarget: { x: 18, y: 18 }, eaten: false }, // Cyan
      { id: 4, position: { x: 10, y: 10 }, direction: { x: 0, y: -1 }, color: COLORS.YELLOW, vulnerable: false, type: 'clyde', scatterTarget: { x: 1, y: 18 }, eaten: false } // Yellow
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
    if (!publicClient) return

    try {
      // For now, we'll use mock data that represents what would be stored on-chain
      // const mockOnChainScores: OnChainScore[] = [
      //   { address: '0x1234567890123456789012345678901234567890', score: 2450, timestamp: Date.now() - 86400000 },
      //   { address: '0x9876543210987654321098765432109876543210', score: 1890, timestamp: Date.now() - 172800000 },
      //   { address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', score: 1650, timestamp: Date.now() - 259200000 },
      //   { address: '0x1111222233334444555566667777888899990000', score: 1420, timestamp: Date.now() - 345600000 },
      //   { address: '0x0000999988887777666655554444333322221111', score: 1200, timestamp: Date.now() - 432000000 },
      // ]

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
  }, [address, publicClient])

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

    setGameState(prev => ({
      ...prev, pellets, powerPellets
    }))
  }, [])

  // Game loop
  useEffect(() => {
    let animationFrameId: number

    const gameTick = () => {
      setGameState(prev => {
        if (prev.gameStatus !== 'playing') return prev

        let newPellets = [...prev.pellets]
        let newPowerPellets = [...prev.powerPellets]
        let newScore = prev.score
        let newLives = prev.lives
        let newGameStatus = prev.gameStatus
        let newPowerMode = prev.powerMode
        let newPowerModeTimer = prev.powerModeTimer

        // Move Pacmon
        const newPacmonX = prev.pacmon.x + prev.pacmonDirection.x
        const newPacmonY = prev.pacmon.y + prev.pacmonDirection.y

        // Check for wall collision
        if (MAZE[newPacmonY]?.[newPacmonX] === 1) {
          // If collision, stay in current position
          // Pacmon can only move if the next cell is not a wall
          return prev
        }

        const newPacmonPosition = { x: newPacmonX, y: newPacmonY }

        // Check for pellet collision
        const pelletIndex = newPellets.findIndex(p => p.x === newPacmonPosition.x && p.y === newPacmonPosition.y)
        if (pelletIndex !== -1) {
          newPellets.splice(pelletIndex, 1)
          newScore += 10
          soundManagerRef.current?.playSound('pelletEat')
        }

        // Check for power pellet collision
        const powerPelletIndex = newPowerPellets.findIndex(p => p.x === newPacmonPosition.x && p.y === newPacmonPosition.y)
        if (powerPelletIndex !== -1) {
          newPowerPellets.splice(powerPelletIndex, 1)
          newPowerMode = true
          newPowerModeTimer = 60 * 6 // 6 seconds at 60 FPS
          soundManagerRef.current?.playSound('powerPellet')
        }

        // Move ghosts
        const newGhosts = prev.ghosts.map(ghost => {
          let ghostSpeed = 1 // Base speed
          if (level > 1) { // Increase ghost speed for higher levels
            ghostSpeed += (level - 1) * 0.2
          }

          // Simple ghost AI: move towards Pacmon
          let bestDirection = ghost.direction
          let minDistance = Infinity

          const possibleDirections = [
            { x: 0, y: -1 }, // Up
            { x: 0, y: 1 },  // Down
            { x: -1, y: 0 }, // Left
            { x: 1, y: 0 }   // Right
          ]

          for (const dir of possibleDirections) {
            const nextX = ghost.position.x + dir.x
            const nextY = ghost.position.y + dir.y

            if (MAZE[nextY]?.[nextX] !== 1) { // If not a wall
              const distance = Math.sqrt(
                Math.pow(newPacmonPosition.x - nextX, 2) +
                Math.pow(newPacmonPosition.y - nextY, 2)
              )
              if (distance < minDistance) {
                minDistance = distance
                bestDirection = dir
              }
            }
          }

          const newGhostPosition = {
            x: ghost.position.x + bestDirection.x,
            y: ghost.position.y + bestDirection.y
          }

          return { ...ghost, position: newGhostPosition, direction: bestDirection }
        })

        // Check for ghost collision
        for (const ghost of newGhosts) {
          if (ghost.position.x === newPacmonPosition.x && ghost.position.y === newPacmonPosition.y) {
            if (newPowerMode) {
              // Pacmon eats ghost
              newScore += 200
              soundManagerRef.current?.playSound('ghostEat')
              // Reset ghost to initial position
              const initialGhostState = {
                id: ghost.id,
                position: { x: 9 + (ghost.id % 2), y: 9 + Math.floor(ghost.id / 2) }, // Adjust initial positions slightly
                direction: { x: 0, y: 0 },
                color: ghost.color,
                vulnerable: false,
                type: ghost.type,
                scatterTarget: ghost.scatterTarget,
                eaten: true
              }
              // Replace the eaten ghost with its initial state
              const ghostIndex = newGhosts.findIndex(g => g.id === ghost.id)
              if (ghostIndex !== -1) {
                newGhosts[ghostIndex] = initialGhostState
              }
            } else {
              // Pacmon loses a life
              newLives -= 1
              soundManagerRef.current?.playSound('death')
              if (newLives === 0) {
                newGameStatus = 'gameOver'
              } else {
                // Reset Pacmon and ghosts to initial positions
                // This part needs to be implemented to reset positions
                // For now, just setting game status to pregame to restart
                newGameStatus = 'pregame'
              }
            }
          }
        }

        // Power mode timer
        if (newPowerMode) {
          newPowerModeTimer -= 1
          if (newPowerModeTimer <= 0) {
            newPowerMode = false
            // Ghosts become non-vulnerable
            newGhosts.forEach(ghost => ghost.vulnerable = false)
          }
        }

        // Check for level complete
        if (newPellets.length === 0 && newPowerPellets.length === 0) {
          newGameStatus = 'levelComplete'
          setLevel(prevLevel => prevLevel + 1) // Increase level
        }

        return {
          ...prev,
          pacmon: newPacmonPosition,
          pellets: newPellets,
          powerPellets: newPowerPellets,
          score: newScore,
          lives: newLives,
          gameStatus: newGameStatus,
          powerMode: newPowerMode,
          powerModeTimer: newPowerModeTimer,
          ghosts: newGhosts
        }
      })
      animationFrameId = requestAnimationFrame(gameTick)
    }

    animationFrameId = requestAnimationFrame(gameTick)

    return () => cancelAnimationFrame(animationFrameId)
  }, [level]) // Re-run effect when level changes

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      setGameState(prev => {
        if (prev.gameStatus !== 'playing') return prev

        let newDirection = prev.pacmonDirection
        switch (event.key) {
          case 'ArrowUp':
          case 'w':
            newDirection = { x: 0, y: -1 }
            break
          case 'ArrowDown':
          case 's':
            newDirection = { x: 0, y: 1 }
            break
          case 'ArrowLeft':
          case 'a':
            newDirection = { x: -1, y: 0 }
            break
          case 'ArrowRight':
          case 'd':
            newDirection = { x: 1, y: 0 }
            break
        }
        return { ...prev, pacmonDirection: newDirection }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw maze
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (MAZE[y][x] === 1) {
          ctx.fillStyle = COLORS.MONAD_BLUE
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
        }
      }
    }

    // Draw pellets
    ctx.fillStyle = COLORS.ORANGE // Changed pellet color to orange
    gameState.pellets.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x * CELL_SIZE + CELL_SIZE / 2, p.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 8, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw power pellets
    ctx.fillStyle = COLORS.ORANGE // Changed power pellet color to orange
    gameState.powerPellets.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x * CELL_SIZE + CELL_SIZE / 2, p.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 4, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw Pacmon
    ctx.fillStyle = COLORS.MONAD_PURPLE
    ctx.beginPath()
    ctx.arc(gameState.pacmon.x * CELL_SIZE + CELL_SIZE / 2, gameState.pacmon.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2)
    ctx.fill()

    // Draw ghosts
    gameState.ghosts.forEach(ghost => {
      ctx.fillStyle = ghost.color
      ctx.beginPath()
      ctx.arc(ghost.position.x * CELL_SIZE + CELL_SIZE / 2, ghost.position.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw score and lives
    ctx.fillStyle = COLORS.WHITE
    ctx.font = '16px Arial'
    ctx.fillText(`Score: ${gameState.score}`, 10, GAME_HEIGHT + 20)
    ctx.fillText(`Lives: ${gameState.lives}`, 10, GAME_HEIGHT + 40)
    ctx.fillText(`Level: ${level}`, 10, GAME_HEIGHT + 60) // Display current level

    // Game status messages
    if (gameState.gameStatus === 'pregame') {
      ctx.fillText('Press any key to start', GAME_WIDTH / 2 - 80, GAME_HEIGHT / 2)
    } else if (gameState.gameStatus === 'gameOver') {
      ctx.fillText('Game Over!', GAME_WIDTH / 2 - 40, GAME_HEIGHT / 2)
      ctx.fillText(`Final Score: ${gameState.score}`, GAME_WIDTH / 2 - 60, GAME_HEIGHT / 2 + 20)
    } else if (gameState.gameStatus === 'levelComplete') {
      ctx.fillText(`Level ${level - 1} Complete!`, GAME_WIDTH / 2 - 70, GAME_HEIGHT / 2)
      ctx.fillText('Press any key for next level', GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2 + 20)
    }
  }, [gameState, level]) // Re-render when gameState or level changes

  // Handle game start/restart
  useEffect(() => {
    const handleKeyPress = () => {
      if (gameState.gameStatus === 'pregame' || gameState.gameStatus === 'levelComplete') {
        setGameState(prev => ({
          ...prev,
          gameStatus: 'playing',
          pacmon: { x: 9, y: 15 },
          pacmonDirection: { x: 0, y: 0 },
          ghosts: [
            { id: 1, position: { x: 9, y: 9 }, direction: { x: 1, y: 0 }, color: COLORS.MONAD_BERRY, vulnerable: false, type: 'blinky', scatterTarget: { x: 18, y: 0 }, eaten: false }, // Red
            { id: 2, position: { x: 10, y: 9 }, direction: { x: -1, y: 0 }, color: COLORS.PINK, vulnerable: false, type: 'pinky', scatterTarget: { x: 1, y: 0 }, eaten: false }, // Pink
            { id: 3, position: { x: 9, y: 10 }, direction: { x: 0, y: 1 }, color: COLORS.MONAD_OFF_WHITE, vulnerable: false, type: 'inky', scatterTarget: { x: 18, y: 18 }, eaten: false }, // Cyan
            { id: 4, position: { x: 10, y: 10 }, direction: { x: 0, y: -1 }, color: COLORS.YELLOW, vulnerable: false, type: 'clyde', scatterTarget: { x: 1, y: 18 }, eaten: false } // Yellow
          ],
          pellets: [], // Pellets will be re-initialized by the other useEffect
          powerPellets: [], // Power pellets will be re-initialized by the other useEffect
          score: gameState.gameStatus === 'levelComplete' ? prev.score : 0, // Keep score for next level
          lives: gameState.gameStatus === 'levelComplete' ? prev.lives : 3, // Keep lives for next level
          powerMode: false,
          powerModeTimer: 0,
          highScore: prev.highScore, // Keep high score
          userOnChainScore: prev.userOnChainScore,
          onChainScores: prev.onChainScores,
          showLeaderboard: false
        }))
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [gameState.gameStatus])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-monad-black text-monad-off-white p-4">
      <h1 className="text-4xl font-bold mb-4">Pacmon Game</h1>
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT + 80} // Increased height for score/lives/level display
        className="border-2 border-monad-blue"
      />
      <div className="mt-4 text-lg">
        <p>Use Arrow Keys or WASD to move</p>
        <p>Eat all pellets to complete the level</p>
        <p>Avoid ghosts or lose a life</p>
        <p>Eat power pellets to temporarily make ghosts vulnerable</p>
      </div>

      {/* Leaderboard - removed mock data display */}
      {/* {gameState.showLeaderboard && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-2">Leaderboard</h2>
          <table className="table-auto">
            <thead>
              <tr>
                <th className="px-4 py-2">Address</th>
                <th className="px-4 py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {gameState.onChainScores.map((score, index) => (
                <tr>
                  <td className="border px-4 py-2">{score.address.slice(0, 6)}...{score.address.slice(-4)}</td>
                  <td className="border px-4 py-2">{score.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )} */}

      {/* Wallet connection and transaction buttons */}
      <div className="mt-8 flex space-x-4">
        {!isConnected ? (
          <button
            onClick={() => connect({ connector: farcasterFrame() })}
            className="bg-monad-purple text-white px-4 py-2 rounded"
          >
            Connect Wallet
          </button>
        ) : (
          <button
            onClick={() => disconnect()}
            className="bg-monad-berry text-white px-4 py-2 rounded"
          >
            Disconnect Wallet
          </button>
        )}
        {isConnected && (
          <button
            onClick={() => sendTransaction({
              to: '0x0000000000000000000000000000000000000000',
              value: parseEther('0.0001'),
              data: encodeFunctionData({
                abi: [{
                  inputs: [],
                  name: 'recordScore',
                  outputs: [],
                  stateMutability: 'nonpayable',
                  type: 'function',
                }],
                functionName: 'recordScore',
                args: [],
              }),
            })}
            className="bg-monad-purple text-white px-4 py-2 rounded"
          >
            Record Score
          </button>
        )}
      </div>
    </div>
  )
}

