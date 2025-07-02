import React from 'react';

interface RankingEntry {
  rank: number;
  player: string;
  score: number;
  date: string;
}

interface RankingsScreenProps {
  onBack: () => void;
  rankings: RankingEntry[];
}

export function RankingsScreen({ onBack, rankings }: RankingsScreenProps) {
  // Mock data for demonstration
  const mockRankings: RankingEntry[] = [
    { rank: 1, player: '0x1234...5678', score: 184400, date: 'Today' },
    { rank: 2, player: '0x9876...4321', score: 156200, date: 'Yesterday' },
    { rank: 3, player: '0xABCD...EFGH', score: 142800, date: '2 days ago' },
    { rank: 4, player: '0x5555...7777', score: 128900, date: '3 days ago' },
    { rank: 5, player: '0x2222...8888', score: 115600, date: '4 days ago' },
    { rank: 6, player: '0x3333...9999', score: 98750, date: '5 days ago' },
    { rank: 7, player: '0x4444...0000', score: 87320, date: '6 days ago' },
    { rank: 8, player: '0x6666...1111', score: 76540, date: '1 week ago' },
    { rank: 9, player: '0x7777...2222', score: 65890, date: '1 week ago' },
    { rank: 10, player: '0x8888...3333', score: 54210, date: '1 week ago' },
  ];

  const displayRankings = rankings.length > 0 ? rankings : mockRankings;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#200052] to-[#0E001A] flex flex-col p-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="bg-[#836EF9] hover:bg-[#7059E8] text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-[#836EF9]">Rankings</h1>
        <div className="w-16"></div> {/* Spacer for centering */}
      </div>

      {/* Rankings List */}
      <div className="flex-1 bg-black/30 rounded-lg p-4 overflow-y-auto">
        <div className="space-y-2">
          {displayRankings.map((entry) => (
            <div
              key={entry.rank}
              className={`flex items-center justify-between p-3 rounded-lg ${
                entry.rank <= 3
                  ? 'bg-gradient-to-r from-[#FFD700]/20 to-[#FFA500]/20 border border-[#FFD700]/30'
                  : 'bg-[#836EF9]/10 border border-[#836EF9]/20'
              }`}
            >
              <div className="flex items-center space-x-4">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    entry.rank === 1
                      ? 'bg-[#FFD700] text-black'
                      : entry.rank === 2
                      ? 'bg-[#C0C0C0] text-black'
                      : entry.rank === 3
                      ? 'bg-[#CD7F32] text-white'
                      : 'bg-[#836EF9] text-white'
                  }`}
                >
                  {entry.rank}
                </div>
                <div>
                  <div className="font-mono text-sm text-[#FBFAF9]">
                    {entry.player}
                  </div>
                  <div className="text-xs text-[#FBFAF9]/60">{entry.date}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-[#00D4FF]">
                  {entry.score.toLocaleString()}
                </div>
                <div className="text-xs text-[#FBFAF9]/60">points</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="mt-4 text-center text-sm text-[#FBFAF9]/60">
        <p>Rankings updated in real-time</p>
        <p>Play more games to climb the leaderboard!</p>
      </div>
    </div>
  );
}

