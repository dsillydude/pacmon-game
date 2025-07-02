import React, { useState } from 'react';
import { useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';

interface PreGameScreenProps {
  onStartGame: () => void;
  onShowRankings: () => void;
  highScore: number;
  totalPlayers: number;
  totalPlays: number;
}

export function PreGameScreen({ 
  onStartGame, 
  onShowRankings, 
  highScore, 
  totalPlayers, 
  totalPlays 
}: PreGameScreenProps) {
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const { sendTransaction } = useSendTransaction();

  const handlePayToPlay = async () => {
    setIsPaymentProcessing(true);
    try {
      // Send 0.0001 MON for +1 Play (similar to the Monad Shoot'em ups example)
      await sendTransaction({
        to: '0x7f748f154B6D180D35fA12460C7E4C631e28A9d7', // Replace with your game contract address
        value: parseEther('0.0001'),
      });
      
      // After successful payment, start the game
      setTimeout(() => {
        setIsPaymentProcessing(false);
        onStartGame();
      }, 1000);
    } catch (error) {
      console.error('Payment failed:', error);
      setIsPaymentProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#200052] to-[#0E001A] flex flex-col items-center justify-center p-4 text-white">
      {/* Game Title */}
      <div className="text-center mb-8">
        <h1 className="text-6xl font-bold text-[#836EF9] mb-4 glow-text">
          PACMON
        </h1>
        <p className="text-lg text-[#FBFAF9] opacity-80">
          Monad Pacman Adventure
        </p>
      </div>

      {/* Stats Display */}
      <div className="bg-black/30 rounded-lg p-6 mb-8 w-full max-w-md">
        <div className="text-center space-y-2">
          <div className="text-[#00D4FF] text-xl font-semibold">
            Today's High Score: {highScore.toLocaleString()}
          </div>
          <div className="text-[#A0055D] text-lg">
            Total Players: {totalPlayers.toLocaleString()}
          </div>
          <div className="text-[#FFD700] text-lg">
            Total Plays: {totalPlays.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4 w-full max-w-md">
        <button
          onClick={handlePayToPlay}
          disabled={isPaymentProcessing}
          className="w-full bg-[#FF4444] hover:bg-[#FF3333] disabled:bg-gray-500 text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors duration-200 shadow-lg"
        >
          {isPaymentProcessing ? 'Processing...' : 'Pay 0.0001 MON for +1 Play'}
        </button>

        <button
          onClick={onShowRankings}
          className="w-full bg-[#4A90E2] hover:bg-[#357ABD] text-white font-bold py-4 px-6 rounded-lg text-lg transition-colors duration-200 shadow-lg"
        >
          Rankings
        </button>

        {/* Free Play Option (for testing) */}
        <button
          onClick={onStartGame}
          className="w-full bg-[#836EF9] hover:bg-[#7059E8] text-white font-bold py-3 px-6 rounded-lg text-sm transition-colors duration-200 shadow-lg opacity-75"
        >
          Free Play (Demo)
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-8 text-center text-sm text-[#FBFAF9] opacity-60 max-w-md">
        <p>Use arrow keys or on-screen controls to move</p>
        <p>Eat all pellets while avoiding ghosts!</p>
      </div>

      <style jsx>{`
        .glow-text {
          text-shadow: 0 0 10px #836EF9, 0 0 20px #836EF9, 0 0 30px #836EF9;
        }
      `}</style>
    </div>
  );
}

