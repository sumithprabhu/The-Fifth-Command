"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getAllPastGames, getCurrentGameId, getCurrentGameState, getCurrentPlayerCount, getCurrentTotalPot } from "@/lib/contract";
import { getGameStatus, getGameStartInfo } from "@/lib/api";
import { ethers } from "ethers";

interface TournamentCard {
  gameId: number;
  status: "live" | "completed" | "notStarted";
  playersJoined: number;
  totalPlayers: number;
  poolAmount: string;
  winner?: string;
  hasNoWinner?: boolean; // true when potCarriedOver > 0
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<TournamentCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTournaments() {
      try {
        setLoading(true);
        
        // Get current game ID from contract - this is the game currently going (live or not started)
        let currentGameId = 0;
        try {
          const gameId = await getCurrentGameId();
          currentGameId = Number(gameId);
        } catch (error) {
          console.log("Error fetching current game ID:", error);
        }

        // Fetch past games from contract
        const pastGames = await getAllPastGames();
        
        // Fetch current game status from API
        let currentGameStatus = null;
        try {
          currentGameStatus = await getGameStatus();
        } catch (error) {
          console.log("No active game found in API");
        }

        // Fetch game start info to check if game has started and player joining status
        let startInfo = null;
        try {
          startInfo = await getGameStartInfo();
        } catch (error) {
          console.log("Error fetching game start info:", error);
        }

        // Fetch current game state from contract
        let gameState = 0;
        let currentPlayerCount = 0;
        let currentPot = "0";
        
        try {
          gameState = await getCurrentGameState();
          if (gameState === 1) { // InProgress
            currentPlayerCount = await getCurrentPlayerCount();
            try {
              const pot = await getCurrentTotalPot();
              currentPot = ethers.formatEther(pot.toString());
            } catch (potError) {
              console.log("Error fetching pot:", potError);
            }
          } else if (gameState === 0) {
            currentPlayerCount = await getCurrentPlayerCount();
          }
        } catch (error) {
          console.log("Error fetching current game state:", error);
        }

        const tournamentCards: TournamentCard[] = [];

        // Check if currentGameId is in past games (completed)
        const isInPastGames = pastGames.some(game => Number(game.gameId) === currentGameId);
        
        // Add current game (live or not started) - currentGameId is the game currently going
        if (currentGameId > 0) {
          const displayGameId = currentGameId; // Contract gameId is already 1-indexed
          
          // Use start-info for agent count
          const agentCount = startInfo?.playersJoined.length || 0;
          
          // Logic:
          // - Completed: Only if gameId is in pastGames from contract
          // - Not started: If NOT in pastGames AND status API doesn't have matching gameId
          // - Live: If NOT in pastGames AND status API has gameState === "InProgress"
          
          if (isInPastGames) {
            // Game is completed (in past games)
            const pastGame = pastGames.find(game => Number(game.gameId) === currentGameId);
            if (pastGame) {
              const potPaidValue = pastGame.potPaid ? BigInt(pastGame.potPaid.toString()) : BigInt(0);
              const potCarriedOverValue = pastGame.potCarriedOver ? BigInt(pastGame.potCarriedOver.toString()) : BigInt(0);
              const poolValue = potPaidValue;
              const hasNoWinner = potCarriedOverValue > 0;
              
              const totalPlayersValue = pastGame.totalPlayers as bigint | number | string;
              const totalPlayersNum = typeof totalPlayersValue === 'bigint' 
                ? Number(totalPlayersValue) 
                : typeof totalPlayersValue === 'number'
                ? totalPlayersValue
                : Number(totalPlayersValue.toString());
              
              tournamentCards.push({
                gameId: displayGameId,
                status: "completed" as const,
                playersJoined: totalPlayersNum,
                totalPlayers: 5,
                poolAmount: ethers.formatEther(poolValue),
                winner: pastGame.winner,
                hasNoWinner: hasNoWinner,
              });
            }
          } else {
            // Game is NOT in past games - check status API
            if (currentGameStatus && currentGameStatus.gameId === displayGameId) {
              // Status API has matching gameId
              if (currentGameStatus.gameState === "InProgress") {
                // Game is live
                tournamentCards.push({
                  gameId: displayGameId,
                  status: "live",
                  playersJoined: agentCount,
                  totalPlayers: 5,
                  poolAmount: currentPot || "0",
                });
              } else {
                // Game exists in status API but not InProgress - treat as not started
                tournamentCards.push({
                  gameId: displayGameId,
                  status: "notStarted",
                  playersJoined: agentCount,
                  totalPlayers: 5,
                  poolAmount: "0",
                });
              }
            } else {
              // Status API doesn't have matching gameId - not started
              tournamentCards.push({
                gameId: displayGameId,
                status: "notStarted",
                playersJoined: agentCount,
                totalPlayers: 5,
                poolAmount: "0",
              });
            }
          }
        } else {
          // No game has been started yet - first game
          tournamentCards.push({
            gameId: 1,
            status: "notStarted",
            playersJoined: startInfo?.playersJoined.length || 0,
            totalPlayers: 5,
            poolAmount: "0",
          });
        }

        // Add past games (completed) - games behind currentGameId are finished
        // Contract gameId is 1-indexed (gameId: 1, 2, 3, etc.)
        // To get previous game: if currentGameId is 2, previous game is gameId 1
        // Index in pastGames array = gameId - 1 (so gameId 1 is at index 0)
        const pastGamesToShow = [];
        if (currentGameId > 0) {
          // Get all past games that are completed (gameId < currentGameId)
          for (let i = 0; i < pastGames.length; i++) {
            const game = pastGames[i];
            const gameIdNum = Number(game.gameId);
            // Show games that are finished (gameId < currentGameId)
            // Contract gameId is 1-indexed, so we use it directly
            if (gameIdNum < currentGameId) {
              const potPaidValue = game.potPaid ? BigInt(game.potPaid.toString()) : BigInt(0);
              const potCarriedOverValue = game.potCarriedOver ? BigInt(game.potCarriedOver.toString()) : BigInt(0);
              // Always use potPaid for pool amount display
              const poolValue = potPaidValue;
              
              pastGamesToShow.push({
                gameId: gameIdNum, // Use gameId directly (already 1-indexed)
                status: "completed" as const,
                playersJoined: Number(game.totalPlayers.toString()),
                totalPlayers: 5,
                poolAmount: ethers.formatEther(poolValue),
                winner: game.winner,
              });
            }
          }
          // Sort by gameId descending (newest first)
          pastGamesToShow.sort((a, b) => b.gameId - a.gameId);
        } else {
          // If no current game, show all past games
          const completedGames = pastGames
            .map((game) => {
              const potPaidValue = game.potPaid ? BigInt(game.potPaid.toString()) : BigInt(0);
              const potCarriedOverValue = game.potCarriedOver ? BigInt(game.potCarriedOver.toString()) : BigInt(0);
              // Always use potPaid for pool amount display
              const poolValue = potPaidValue;
              const hasNoWinner = potCarriedOverValue > 0; // No winner if pot was carried over
              
              // Ensure totalPlayers is converted correctly from BigInt
              const totalPlayersValue = game.totalPlayers as bigint | number | string;
              const totalPlayersNum = typeof totalPlayersValue === 'bigint' 
                ? Number(totalPlayersValue) 
                : typeof totalPlayersValue === 'number'
                ? totalPlayersValue
                : Number(totalPlayersValue.toString());
              
              return {
                gameId: Number(game.gameId), // Contract gameId is already 1-indexed
                status: "completed" as const,
                playersJoined: totalPlayersNum,
                totalPlayers: 5,
                poolAmount: ethers.formatEther(poolValue),
                winner: game.winner,
                hasNoWinner: hasNoWinner,
              };
            })
            .sort((a, b) => b.gameId - a.gameId);
          pastGamesToShow.push(...completedGames);
        }

        tournamentCards.push(...pastGamesToShow);

        // Sort all tournaments by gameId descending (current game first, then past games)
        tournamentCards.sort((a, b) => b.gameId - a.gameId);

        // Log all tournament cards for debugging
        console.log('All Tournament Cards (tournaments page):', tournamentCards);

        setTournaments(tournamentCards);
      } catch (error) {
        console.error("Error fetching tournaments:", error);
        setTournaments([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTournaments();
  }, []);

  // Helper function to shorten address
  const shortenAddress = (address: string) => {
    if (!address) return "N/A";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Helper function to format game ID
  const formatGameId = (gameId: number) => {
    return String(gameId).padStart(3, "0");
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
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-12" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
            ALL TOURNAMENTS
          </h1>
          
          {/* Tournament Cards - Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="rounded-lg p-6 relative overflow-hidden flex flex-col animate-pulse"
                  style={{ backgroundColor: '#1a1a1a', minHeight: '300px', border: '2px solid #8B5CF6', borderRadius: '0.5rem' }}
                >
                  <div className="h-4 bg-gray-700 rounded w-1/4 mb-4"></div>
                  <div className="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-white/70 text-lg">No tournaments available yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {tournaments.map((tournament, index) => (
                <div
                  key={`${tournament.gameId}-${index}`}
                  className="rounded-lg p-6 relative overflow-hidden flex flex-col"
                  style={{ backgroundColor: '#1a1a1a', minHeight: '300px', border: '2px solid #8B5CF6', borderRadius: '0.5rem' }}
                >
                  {tournament.status === "live" && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                      <span className="text-red-500 font-bold text-sm">LIVE</span>
                    </div>
                  )}
                  {tournament.status === "notStarted" && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-yellow-500 font-bold text-sm">STARTING SOON</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-4 flex-1">
                    <div>
                      <p className="text-sm text-white/70 mb-1">
                        Tournament #{formatGameId(tournament.gameId)}
                      </p>
                      <p className="text-lg text-white font-bold">
                        Agents Joined: {tournament.playersJoined}/{tournament.totalPlayers}
                      </p>
                    </div>
                    {tournament.status === "completed" && (
                      <div className="mt-2">
                        {tournament.hasNoWinner ? (
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded text-sm font-bold text-yellow-500" style={{ border: '1px solid #eab308', backgroundColor: 'rgba(234, 179, 8, 0.1)' }}>
                              NO WINNER
                            </span>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-white/70 mb-1">Winner</p>
                            <p className="text-base text-white font-bold">
                              {tournament.winner ? shortenAddress(tournament.winner) : "N/A"}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                    {(tournament.status === "live" || tournament.status === "notStarted") && (
                      <div className="mt-2">
                        <p className="text-sm text-white/70 mb-1">
                          {tournament.status === "live" ? "Game in Progress" : "Waiting for players"}
                        </p>
                      </div>
                    )}
                    <div className="pt-2">
                      <p className="text-sm text-white/70 mb-2">
                        {tournament.status === "completed" ? "Won Pool Amount" : "Pool Amount"}
                      </p>
                      <p className="text-2xl text-white font-bold mb-4">
                        {parseFloat(tournament.poolAmount).toFixed(2)} FIF
                      </p>
                      {(tournament.status === "live" || tournament.status === "notStarted") && (
                        <Link href="/tournament">
                          <button
                            className="w-full rounded-lg px-6 py-3 text-base font-bold text-white transition-all hover:opacity-90"
                            style={{
                              background: 'linear-gradient(135deg, #B794F6 0%, #9B7EDE 50%, #7C5ACF 100%)',
                              fontFamily: 'Arial, Helvetica, sans-serif',
                              boxShadow: '0 4px 15px rgba(124, 90, 207, 0.4)'
                            }}
                          >
                            {tournament.status === "live" ? "Watch Live" : "View Tournament"}
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
