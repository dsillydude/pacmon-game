'use client'

import React, { useState, useEffect } from 'react';
import PacmonGame from '@/components/PacmonGame';
import { PreGameScreen } from '@/components/PreGameScreen';
import { RankingsScreen } from '@/components/RankingsScreen';
import { MobileControls } from '@/components/MobileControls';
import { useFrame } from '@/components/farcaster-provider';
import { SafeAreaContainer } from '@/components/safe-area-container';
import { useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';

type GameState = 'pregame' | 'playing' | 'rankings' | 'gameover';

interface GameStats {
  highScore: number;
  totalPlayers: number;
  totalPlays: number;
  currentScore: number;
}

export default function EnhancedPacmonApp() {
  const { context, isLoading, isSDKLoaded } = useFrame();
  const [gameState, setGameState] = useState<GameState>('pregame');
  const [gameStats, setGameStats] = useState<GameStats>({
    highScore: 184400,
    totalPlayers: 13649,
    totalPlays: 114113,
    currentScore: 0,
  });
  const [mobileDirection, setMobileDirection] = useState<string | null>(null);
  const { sendTransaction } = useSendTransaction();

  // Handle mobile control input
  const handleMobileDirection = (direction: 'up' | 'down' | 'left' | 'right') => {
    setMobileDirection(direction);
    
    // Simulate keyboard event for the game
    const keyMap = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
    };

    const event = new KeyboardEvent('keydown', {
      key: keyMap[direction],
      code: keyMap[direction],
      bubbles: true,
    });
    
    document.dispatchEvent(event);
    
    // Clear direction after a short delay
    setTimeout(() => setMobileDirection(null), 150);
  };

  // Handle game over event with wallet transaction
  const handleGameOver = async (finalScore: number) => {
    setGameStats(prev => ({ ...prev, currentScore: finalScore }));
    
    try {
      // Send transaction for game over event (achievement/score submission)
      await sendTransaction({
        to: '0x7f748f154B6D180D35fA12460C7E4C631e28A9d7', // Replace with your game contract
        value: parseEther('0.00001'), // Small fee for score submission
      });
      
      // Update stats (in a real app, this would come from your backend)
      setGameStats(prev => ({
        ...prev,
        highScore: Math.max(prev.highScore, finalScore),
        totalPlays: prev.totalPlays + 1,
      }));
    } catch (error) {
      console.error('Failed to submit score:', error);
    }
    
    setGameState('pregame');
  };

  // Handle achievement unlocks
  const handleAchievement = async (achievementType: string, score: number) => {
    try {
      // Send transaction for achievement unlock
      await sendTransaction({
        to: '0x7f748f154B6D180D35fA12460C7E4C631e28A9d7', // Replace with your game contract
        value: parseEther('0.00005'), // Achievement reward transaction
      });
      
      console.log(`Achievement unlocked: ${achievementType} at score ${score}`);
    } catch (error) {
      console.error('Failed to process achievement:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaContainer insets={context?.client.safeAreaInsets}>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 space-y-8 bg-gradient-to-b from-[#200052] to-[#0E001A]">
          <h1 className="text-3xl font-bold text-center text-[#836EF9]">Loading...</h1>
        </div>
      </SafeAreaContainer>
    );
  }

  if (!isSDKLoaded) {
    return (
      <SafeAreaContainer insets={context?.client.safeAreaInsets}>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 space-y-8 bg-gradient-to-b from-[#200052] to-[#0E001A]">
          <h1 className="text-3xl font-bold text-center text-[#836EF9]">
            No farcaster SDK found, please use this miniapp in the farcaster app
          </h1>
        </div>
      </SafeAreaContainer>
    );
  }

  return (
    <SafeAreaContainer insets={context?.client.safeAreaInsets}>
      <div className="relative min-h-screen bg-gradient-to-b from-[#200052] to-[#0E001A]">
        {gameState === 'pregame' && (
          <PreGameScreen
            onStartGame={() => setGameState('playing')}
            onShowRankings={() => setGameState('rankings')}
            highScore={gameStats.highScore}
            totalPlayers={gameStats.totalPlayers}
            totalPlays={gameStats.totalPlays}
          />
        )}

        {gameState === 'rankings' && (
          <RankingsScreen
            onBack={() => setGameState('pregame')}
            rankings={[]} // In a real app, fetch from your backend
          />
        )}

        {gameState === 'playing' && (
          <>
            <div className="flex flex-col items-center">
              {/* Game container with mobile-optimized sizing */}
              <div className="w-full max-w-md mx-auto">
                <PacmonGame
                  onGameOver={handleGameOver}
                  onAchievement={handleAchievement}
                  currentScore={gameStats.currentScore}
                />
              </div>
              
              {/* Mobile Controls */}
              <MobileControls onDirectionPress={handleMobileDirection} />
              
              {/* Back to menu button */}
              <button
                onClick={() => setGameState('pregame')}
                className="fixed top-4 left-4 bg-[#836EF9] hover:bg-[#7059E8] text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 z-50"
              >
                ← Menu
              </button>
            </div>
          </>
        )}
      </div>
    </SafeAreaContainer>
  );
}

