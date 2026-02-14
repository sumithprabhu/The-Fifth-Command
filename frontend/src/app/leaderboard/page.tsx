"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getAllPastGames, getGameFinalizedEvent } from "@/lib/contract";
import { ethers } from "ethers";

interface LeaderboardEntry {
  rank: number;
  winner: string;
  wins: number;
  totalWinnings: string;
  gamesWon: number[];
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboardData() {
      try {
        setLoading(true);
        
        // Fetch all past games
        const pastGames = await getAllPastGames();
        
        // Create a map to track winners
        const winnersMap = new Map<string, { wins: number; totalWinnings: bigint; gamesWon: number[] }>();
        
        // Process each past game
        for (let i = 0; i < pastGames.length; i++) {
          const game = pastGames[i];
          const gameIdNum = Number(game.gameId);
          
          let winner = game.winner;
          let potPaid = game.potPaid;
          
          // Try to get GameFinalized event for accurate data
          try {
            const finalizedEvent = await getGameFinalizedEvent(gameIdNum);
            if (finalizedEvent && finalizedEvent.winner && finalizedEvent.winner !== ethers.ZeroAddress) {
              winner = finalizedEvent.winner;
              potPaid = finalizedEvent.potPaid;
            }
          } catch (error) {
            console.log(`Error fetching GameFinalized event for game ${gameIdNum}:`, error);
            // Fall back to game data
          }
          
          // Only count valid winners (not zero address)
          if (winner && winner !== ethers.ZeroAddress) {
            const lowerWinner = winner.toLowerCase();
            const potBigInt = BigInt(potPaid.toString());
            
            if (winnersMap.has(lowerWinner)) {
              const entry = winnersMap.get(lowerWinner)!;
              entry.wins += 1;
              entry.totalWinnings += potBigInt;
              entry.gamesWon.push(gameIdNum);
            } else {
              winnersMap.set(lowerWinner, {
                wins: 1,
                totalWinnings: potBigInt,
                gamesWon: [gameIdNum]
              });
            }
          }
        }
        
        // Convert map to leaderboard entries and sort by total winnings
        const leaderboardEntries: LeaderboardEntry[] = Array.from(winnersMap.entries())
          .map(([winner, data], index) => ({
            rank: index + 1,
            winner,
            wins: data.wins,
            totalWinnings: ethers.formatEther(data.totalWinnings),
            gamesWon: data.gamesWon.sort((a, b) => a - b)
          }))
          .sort((a, b) => {
            // Sort by total winnings descending
            const aTotal = parseFloat(a.totalWinnings);
            const bTotal = parseFloat(b.totalWinnings);
            if (bTotal !== aTotal) {
              return bTotal - aTotal;
            }
            // If tied, sort by number of wins
            return b.wins - a.wins;
          })
          .map((entry, index) => ({
            ...entry,
            rank: index + 1
          }));
        
        setLeaderboard(leaderboardEntries);
      } catch (error) {
        console.error("Error fetching leaderboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboardData();
  }, []);

  // Helper function to shorten address
  const shortenAddress = (address: string) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Helper function to get medal emoji based on rank
  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "";
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden" style={{ backgroundColor: 'rgba(30, 20, 50, 0.95)' }}>
      {/* Background Image */}
      <div className="fixed inset-0 z-0 w-full h-full">
        <Image
          src="/new_bg.png"
          alt="Background"
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      <div className="relative z-10 w-full px-6 py-16 md:px-12 md:py-24">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            LEADERBOARD
          </h1>
          <p className="text-white/70 text-lg mb-12">Champions of The Fifth Command</p>
          
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="rounded-lg p-6 animate-pulse"
                  style={{ backgroundColor: '#1a1a1a', border: '2px solid #8B5CF6' }}
                >
                  <div className="h-6 bg-gray-700 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/70 text-lg">No winners yet</p>
            </div>
          ) : (
            
            <div className="overflow-x-auto">
                {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div
                  className="rounded-lg p-6 text-center"
                  style={{ backgroundColor: '#1a1a1a', border: '2px solid #8B5CF6' }}
                >
                  <p className="text-white/70 text-sm mb-2">Total Winners</p>
                  <p className="text-4xl font-bold text-white">{leaderboard.length}</p>
                </div>

                <div
                  className="rounded-lg p-6 text-center"
                  style={{ backgroundColor: '#1a1a1a', border: '2px solid #8B5CF6' }}
                >
                  <p className="text-white/70 text-sm mb-2">Total Tournaments Completed</p>
                  <p className="text-4xl font-bold text-white">
                    {leaderboard.reduce((sum, entry) => sum + entry.wins, 0)}
                  </p>
                </div>

                <div
                  className="rounded-lg p-6 text-center"
                  style={{ backgroundColor: '#1a1a1a', border: '2px solid #8B5CF6' }}
                >
                  <p className="text-white/70 text-sm mb-2">Total Pool Distributed</p>
                  <p className="text-4xl font-bold text-purple-400">
                    {(
                      leaderboard.reduce(
                        (sum, entry) => sum + parseFloat(entry.totalWinnings),
                        0
                      )
                    ).toFixed(2)}{" "}
                    MON
                  </p>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border-2" style={{ backgroundColor: '#1a1a1a', borderColor: '#8B5CF6' }}>
                {/* Table Header */}
                <div
                  className="grid grid-cols-10 gap-4 px-6 py-4 text-white/70 font-bold text-sm uppercase"
                  style={{ backgroundColor: '#2a1a4a', borderBottom: '2px solid #8B5CF6' }}
                >
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-4">Player</div>
                  <div className="col-span-2 text-center">Wins</div>
                  <div className="col-span-3 text-right">Total Winnings</div>
                  {/* <div className="col-span-2 text-right">Games Won</div> */}
                </div>

                {/* Table Body */}
                <div>
                  {leaderboard.map((entry, index) => (
                    <div
                      key={entry.winner}
                      className="grid grid-cols-10 gap-4 px-6 py-4 items-center border-b transition-all hover:bg-white/5"
                      style={{
                        borderColor: '#4a3a6a',
                        backgroundColor: index < 3 ? 'rgba(139, 92, 246, 0.05)' : undefined
                      }}
                    >
                      {/* Rank */}
                      <div className="col-span-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getMedalEmoji(entry.rank)}</span>
                          <span className="text-xl font-bold text-white">{entry.rank}</span>
                        </div>
                      </div>

                      {/* Player Address */}
                      <div className="col-span-4">
                        <p className="text-white font-semibold truncate" title={entry.winner}>
                          {shortenAddress(entry.winner)}
                        </p>
                      </div>

                      {/* Wins */}
                      <div className="col-span-2 text-center">
                        <p className="text-white font-bold text-lg">{entry.wins}</p>
                      </div>

                      {/* Total Winnings */}
                      <div className="col-span-3 text-right">
                        <p
                          className="text-lg font-bold"
                          style={{
                            color: index < 3 ? '#FCD34D' : '#8B5CF6'
                          }}
                        >
                          {parseFloat(entry.totalWinnings).toFixed(2)} MON
                        </p>
                      </div>

                      {/* Games Won */}
                      {/* <div className="col-span-2 text-right">
                        <details className="cursor-pointer">
                          <summary className="text-white/70 hover:text-white transition-colors">
                            #{entry.gamesWon.join(", #")}
                          </summary>
                        </details>
                      </div> */}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
