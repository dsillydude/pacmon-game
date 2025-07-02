import React, { useState } from 'react';
import { useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';

interface GameOverScreenProps {
  score: number;
  highScore: number;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

export function GameOverScreen({ score, highScore, onPlayAgain, onBackToMenu }: GameOverScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { sendTransaction } = useSendTransaction();

  const isNewHighScore = score > highScore;

  const handleSubmitScore = async () => {
    setIsSubmitting(true);
    try {
      // Submit score to blockchain
      await sendTransaction({
        to: '0x7f748f154B6D180D35fA12460C7E4C631e28A9d7', // Replace with your game contract
        value: parseEther('0.00001'), // Small fee for score submission
      });
      
      setSubmitted(true);
      setIsSubmitting(false);
    } catch (error) {
      console.error('Failed to submit score:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-[#200052] to-[#0E001A] rounded-lg p-8 max-w-md w-full mx-4 text-center text-white border border-[#836EF9]/30">
        {/* Game Over Title */}
        <h2 className="text-4xl font-bold text-[#FF4444] mb-4">
          GAME OVER
        </h2>

        {/* Score Display */}
        <div className="mb-6">
          <div className="text-2xl font-bold text-[#836EF9] mb-2">
            Final Score
          </div>
          <div className="text-4xl font-bold text-[#00D4FF]">
            {score.toLocaleString()}
          </div>
          
          {isNewHighScore && (
            <div className="text-lg text-[#FFD700] mt-2 animate-pulse">
              🎉 NEW HIGH SCORE! 🎉
            </div>
          )}
        </div>

        {/* Score Submission */}
        {!submitted ? (
          <div className="mb-6">
            <button
              onClick={handleSubmitScore}
              disabled={isSubmitting}
              className="w-full bg-[#836EF9] hover:bg-[#7059E8] disabled:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 mb-2"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Score to Blockchain'}
            </button>
            <p className="text-xs text-[#FBFAF9]/60">
              Small transaction fee required for leaderboard entry
            </p>
          </div>
        ) : (
          <div className="mb-6 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
            <div className="text-green-400 font-semibold">
              ✅ Score Submitted Successfully!
            </div>
            <p className="text-xs text-[#FBFAF9]/60 mt-1">
              Your score has been recorded on the blockchain
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={onPlayAgain}
            className="w-full bg-[#4A90E2] hover:bg-[#357ABD] text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Play Again
          </button>
          
          <button
            onClick={onBackToMenu}
            className="w-full bg-[#666] hover:bg-[#555] text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
          >
            Back to Menu
          </button>
        </div>

        {/* Achievement Display (if applicable) */}
        {score >= 10000 && (
          <div className="mt-4 p-3 bg-[#FFD700]/20 border border-[#FFD700]/30 rounded-lg">
            <div className="text-[#FFD700] font-semibold">
              🏆 Achievement Unlocked!
            </div>
            <p className="text-xs text-[#FBFAF9]/80">
              Score Master: Reached 10,000+ points
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

