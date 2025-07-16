'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

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

export default function PacmonGameTestDemo() {
  const [gameState, setGameState] = useState({
    score: 1450,
    highScore: 1250,
    gameStatus: 'postGame' as 'pregame' | 'playing' | 'postGame'
  })
  
  const [isConnected] = useState(true)
  const [address] = useState('0x1234...5678')

  const handleScoreSubmission = () => {
    alert('Score submitted successfully! (Test mode)')
  }

  const restartGame = () => {
    setGameState(prev => ({
      ...prev,
      score: 0,
      gameStatus: 'playing'
    }))
  }

  const exitGame = () => {
    setGameState(prev => ({
      ...prev,
      gameStatus: 'pregame'
    }))
  }

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ backgroundColor: COLORS.MONAD_BLACK }}>
      {gameState.gameStatus === 'postGame' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
              Game Over!
            </h2>
            <p className="text-xl md:text-2xl" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Final Score: {gameState.score}
            </p>
            {gameState.score > gameState.highScore && (
              <p className="text-lg" style={{ color: COLORS.GREEN }}>
                🎉 New High Score! 🎉
              </p>
            )}
          </div>

          <div className="w-full max-w-md space-y-4 px-4">
            <button
              onClick={handleScoreSubmission}
              className="w-full py-6 px-8 text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
              style={{ 
                backgroundColor: COLORS.MONAD_PURPLE, 
                color: COLORS.WHITE 
              }}
            >
              Save Score Onchain [0.015 MON]
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

      {gameState.gameStatus === 'playing' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold" style={{ color: COLORS.MONAD_PURPLE }}>
              PACMON
            </h1>
            <p className="text-xl" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              Game is playing... Score: {gameState.score}
            </p>
            <button
              onClick={() => setGameState(prev => ({ ...prev, gameStatus: 'postGame', score: 1450 }))}
              className="py-4 px-8 text-lg font-bold rounded-lg"
              style={{ 
                backgroundColor: COLORS.MONAD_BERRY, 
                color: COLORS.WHITE 
              }}
            >
              Simulate Game Over
            </button>
          </div>
        </div>
      )}

      {gameState.gameStatus === 'pregame' && (
        <div className="flex flex-col items-center justify-center flex-1 w-full space-y-6">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">
              PACMON
            </h1>
            <div className="space-y-3 text-center" style={{ color: COLORS.MONAD_OFF_WHITE }}>
              <div className="text-lg md:text-xl font-semibold" style={{ color: COLORS.MONAD_PURPLE }}>
                Today's High Scores
              </div>
              <div className="space-y-2 bg-black bg-opacity-30 rounded-lg p-4">
                <div className="flex items-center justify-between text-base md:text-lg" style={{ color: COLORS.MONAD_BERRY }}>
                  <span className="flex items-center">
                    <span className="text-xl mr-2">🥇</span>
                    <span className="font-bold">1st</span>
                  </span>
                  <span className="font-mono">{gameState.highScore.toLocaleString()}</span>
                  <span className="text-sm font-mono">{address ? `${address.slice(0, 4)}...${address.slice(-4)}` : '0x0000...0000'}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setGameState(prev => ({ ...prev, gameStatus: 'postGame', score: 1450 }))}
            className="py-6 px-8 text-xl font-bold rounded-lg"
            style={{ 
              backgroundColor: COLORS.MONAD_BERRY, 
              color: COLORS.WHITE 
            }}
          >
            Show Post-Game UI
          </button>
        </div>
      )}
    </div>
  )
}

