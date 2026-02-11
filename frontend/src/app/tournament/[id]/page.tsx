"use client";

import Image from "next/image";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import CharacterCard from "@/components/CharacterCard";
import charMeta from "@/char_meta.json";
import Marquee from "react-fast-marquee";
// @ts-ignore - Package may need installation
import SlotCounter from "react-slot-counter";
import confetti from "canvas-confetti";
import { ethers } from "ethers";
import { getGameStatus, getGameStartInfo, GameStartInfo, getBidLog } from "@/lib/api";
import { getCurrentGameId, getGameFinalizedEvent, getPastGamesCount, getPastGame, getAllPastGames } from "@/lib/contract";
import { useRouter, useParams } from "next/navigation";

interface GameStatus {
  gameId: number;
  gameState: "NotStarted" | "InProgress" | "Finished";
  currentRound: number;
  totalCards: number;
  currentCard: any | null;
  highestBid: {
    amount: number;
    bidder: string | null;
  };
  revealedCards: any[];
  players: Array<{
    address: string;
    chipBalance: number;
    cardsOwned: number;
    cards: any[];
  }>;
  roundEndsInSeconds: number | null;
  gameStartsInSeconds: number | null;
  auctionedCards: Array<{
    card: any;
    winner: string | null;
  }>;
  remainingCards: any[];
}

export default function TournamentGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = Number(params.id); // Get gameId from URL - PERSISTENT!
  
  // Toggle flags for testing with dummy data
  const isGameStarted = false;
  const isWinnerDeclared = false;
  
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [gameStartInfo, setGameStartInfo] = useState<GameStartInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSets, setOpenSets] = useState<string[]>([]);
  const [openAgents, setOpenAgents] = useState<string[]>([]);
  
  // Winner data
  const [winnerData, setWinnerData] = useState<{ address: string; poolAmount: string } | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  
  // Refs for tracking
  const confettiTriggered = useRef(false);
  const apiPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const contractPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const gameFinishedDetected = useRef(false);
  
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [gameStartCountdown, setGameStartCountdown] = useState<number | null>(null);
  const [currentRoundBids, setCurrentRoundBids] = useState<any[]>([]);
  const [bidPlacedItems, setBidPlacedItems] = useState<any[]>([]);
  const previousBidAmount = useRef<number>(0);
  const previousRound = useRef<number>(0);
  const previousCardId = useRef<number | null>(null);
  const [cardShake, setCardShake] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { id: 1, user: "Agent Alpha", message: "Good luck everyone!" },
    { id: 2, user: "Agent Beta", message: "Let's go!" },
  ]);

  const primaryColor = "#c28ff3";
  
  // Check for winner in past games - called when game finishes or API stops
  const checkForWinner = useCallback(async (gameId: number) => {
    if (winnerData) return; // Already found
    
    try {
      // Check past games with gameId - 1 as index
      const pastGameIndex = gameId - 1;
      const pastGame = await getPastGame(pastGameIndex);
      
      if (Number(pastGame.gameId) === gameId && pastGame.winner && pastGame.winner !== ethers.ZeroAddress) {
        const poolAmount = ethers.formatEther(pastGame.potPaid);
        const formattedAmount = parseFloat(poolAmount).toFixed(2);
        
        setWinnerData({
          address: pastGame.winner,
          poolAmount: formattedAmount
        });
        setShowWinnerModal(true);
        confettiTriggered.current = false;
        
        console.log('Winner found in past games (index', pastGameIndex, '):', pastGame);
        return true;
      }
    } catch (error) {
      console.error(`Error checking past game at index ${gameId - 1}:`, error);
      // Fallback: search all past games
      try {
        const pastGamesCount = await getPastGamesCount();
        for (let i = 0; i < pastGamesCount; i++) {
          try {
            const pastGame = await getPastGame(i);
            if (Number(pastGame.gameId) === gameId && pastGame.winner && pastGame.winner !== ethers.ZeroAddress) {
              const poolAmount = ethers.formatEther(pastGame.potPaid);
              const formattedAmount = parseFloat(poolAmount).toFixed(2);
              
              setWinnerData({
                address: pastGame.winner,
                poolAmount: formattedAmount
              });
              setShowWinnerModal(true);
              confettiTriggered.current = false;
              
              console.log('Winner found in past games (fallback search, index', i, '):', pastGame);
              return true;
            }
          } catch (err) {
            // Continue searching
          }
        }
      } catch (fallbackError) {
        console.error("Error in fallback past games search:", fallbackError);
      }
    }
    
    return false;
  }, [winnerData]);
  
  // Main API polling - continues until game finishes
  useEffect(() => {
    if (isGameStarted) return;
    
    let isInitialLoad = true;
    let consecutiveErrors = 0;
    const maxErrors = 3; // After 3 consecutive errors, check for winner
    
    async function fetchGameData() {
      try {
        if (isInitialLoad) {
          setLoading(true);
        }
        
        const [status, startInfo] = await Promise.all([
          getGameStatus(),
          getGameStartInfo()
        ]);
        
        // Always update game start info - it shows agents joined even if game hasn't started
        setGameStartInfo((prevInfo) => {
          if (!prevInfo || JSON.stringify(prevInfo) !== JSON.stringify(startInfo)) {
            if (startInfo.gameStartsInSeconds !== null && startInfo.gameStartsInSeconds > 0) {
              setGameStartCountdown(startInfo.gameStartsInSeconds);
            } else {
              setGameStartCountdown(null);
            }
            return startInfo;
          }
          return prevInfo;
        });
        
        // Only use API status data if it matches the gameId in URL
        // If API shows different gameId, the game in URL might be finished or not started yet
        if (status?.gameId && status.gameId !== gameId) {
          // API is showing a different game - the game in URL might be finished
          console.log(`API shows gameId ${status.gameId}, but URL has ${gameId}. Checking if game ${gameId} is finished...`);
          
          // Check if the game in URL is finished (in past games)
          if (!gameFinishedDetected.current) {
            const pastGameIndex = gameId - 1;
            try {
              const pastGame = await getPastGame(pastGameIndex);
              if (Number(pastGame.gameId) === gameId) {
                // Game is finished - check for winner
                console.log(`Game ${gameId} is finished, checking for winner...`);
                gameFinishedDetected.current = true;
                // Stop API polling
                if (apiPollingInterval.current) {
                  clearInterval(apiPollingInterval.current);
                  apiPollingInterval.current = null;
                }
                // Check for winner
                await checkForWinner(gameId);
                return;
              }
            } catch (error) {
              // Game not in past games - might not have started yet
              console.log(`Game ${gameId} not found in past games, might not have started yet`);
            }
          }
          
          // If game not finished, it might not have started - don't update status
          // But we already updated gameStartInfo above, so agents will show
          if (isInitialLoad) {
            setLoading(false);
          }
          return;
        }
        
        // Reset error count on success
        consecutiveErrors = 0;
        
        // Update game status (only if gameId matches)
        setGameStatus((prevStatus) => {
          if (!prevStatus || JSON.stringify(prevStatus) !== JSON.stringify(status)) {
            return status as GameStatus;
          }
          return prevStatus;
        });
        
        // Check if game finished
        if (status?.gameState === "Finished" && status.gameId === gameId) {
          if (!gameFinishedDetected.current) {
            gameFinishedDetected.current = true;
            // Stop API polling
            if (apiPollingInterval.current) {
              clearInterval(apiPollingInterval.current);
              apiPollingInterval.current = null;
            }
            // Check for winner immediately
            await checkForWinner(gameId);
          }
        }
      } catch (error) {
        console.error("Error fetching game data:", error);
        consecutiveErrors++;
        
        // If multiple consecutive errors, game might be finished - check for winner
        if (consecutiveErrors >= maxErrors && !gameFinishedDetected.current) {
          console.log(`API returned ${maxErrors} consecutive errors, checking if game finished...`);
          gameFinishedDetected.current = true;
          // Stop API polling
          if (apiPollingInterval.current) {
            clearInterval(apiPollingInterval.current);
            apiPollingInterval.current = null;
          }
          // Check for winner in past games
          await checkForWinner(gameId);
        }
        
        if (isInitialLoad) {
          setGameStatus(null);
        }
      } finally {
        if (isInitialLoad) {
          setLoading(false);
          isInitialLoad = false;
        }
      }
    }
    
    // Initial fetch
    fetchGameData();
    
    // Poll every 5 seconds - continue until game finishes
    if (!gameFinishedDetected.current) {
      apiPollingInterval.current = setInterval(fetchGameData, 5000);
    }
    
    return () => {
      if (apiPollingInterval.current) {
        clearInterval(apiPollingInterval.current);
        apiPollingInterval.current = null;
      }
    };
  }, [gameId, router, checkForWinner, isGameStarted]);
  
  // Contract polling - only when game finished but winner not found yet
  useEffect(() => {
    if (isGameStarted || isWinnerDeclared || !gameFinishedDetected.current || winnerData) {
      if (contractPollingInterval.current) {
        clearInterval(contractPollingInterval.current);
        contractPollingInterval.current = null;
      }
      return;
    }
    
    // Poll contract every 3 seconds until winner is found
    const pollContract = async () => {
      if (!winnerData) {
        await checkForWinner(gameId);
      }
    };
    
    pollContract();
    contractPollingInterval.current = setInterval(pollContract, 3000);
    
    return () => {
      if (contractPollingInterval.current) {
        clearInterval(contractPollingInterval.current);
        contractPollingInterval.current = null;
      }
    };
  }, [gameFinishedDetected.current, winnerData, gameId, checkForWinner, isGameStarted, isWinnerDeclared]);
  
  // Trigger confetti when winner modal shows
  useEffect(() => {
    if (showWinnerModal && winnerData && !confettiTriggered.current) {
      confettiTriggered.current = true;
      
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#B794F6', '#9B7EDE', '#7C5ACF', '#c28ff3']
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#B794F6', '#9B7EDE', '#7C5ACF', '#c28ff3']
        });
        confetti({
          ...defaults,
          particleCount,
          colors: ['#B794F6', '#9B7EDE', '#7C5ACF', '#c28ff3'],
          origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
    }
  }, [showWinnerModal, winnerData]);
  
  // Countdown timer for game start
  useEffect(() => {
    if (gameStartCountdown === null || gameStartCountdown <= 0) {
      return;
    }

    const countdownInterval = setInterval(() => {
      setGameStartCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [gameStartCountdown]);

  // Monitor bid changes and fetch bid log when bid changes
  useEffect(() => {
    if (gameFinishedDetected.current || !gameStatus?.gameId || !gameStatus?.currentRound || gameStatus.gameState !== "InProgress") {
      if (gameStatus?.gameState !== "InProgress") {
        setBidPlacedItems([]);
        previousBidAmount.current = 0;
        previousRound.current = 0;
      }
      return;
    }

    const currentBidAmount = gameStatus?.highestBid?.amount || 0;
    const currentRound = gameStatus.currentRound;

    // Check if round changed
    if (currentRound !== previousRound.current) {
      setBidPlacedItems([]);
      previousRound.current = currentRound;
      previousBidAmount.current = currentBidAmount;
      return;
    }

    // Check if bid amount changed
    if (currentBidAmount !== previousBidAmount.current && currentBidAmount > 0 && gameStatus) {
      async function fetchNewBid() {
        if (!gameStatus) return;
        try {
          const bidLog = await getBidLog(gameStatus.gameId, gameStatus.currentRound);
          if (bidLog && bidLog.length > 0 && gameStatus?.currentCard) {
            const sortedBids = [...bidLog].sort((a: any, b: any) => {
              const amountA = a.amount || a.bidAmount || a.price || 0;
              const amountB = b.amount || b.bidAmount || b.price || 0;
              if (amountB !== amountA) return amountB - amountA;
              const timeA = a.timestamp || a.time || 0;
              const timeB = b.timestamp || b.time || 0;
              return timeB - timeA;
            });
            
            const latestBid = sortedBids[0];
            if (latestBid) {
              const card = gameStatus.currentCard;
              const cardType = (card.type || card.raw?.type || "sentinel").toUpperCase();
              const cardName = card.name || card.raw?.name || "Unknown";
              const bidder = latestBid.bidder || latestBid.address || latestBid.player 
                ? shortenAddress(latestBid.bidder || latestBid.address || latestBid.player) 
                : "Unknown";
              const price = latestBid.amount || latestBid.bidAmount || latestBid.price 
                ? `${latestBid.amount || latestBid.bidAmount || latestBid.price} chips` 
                : "0 chips";
              
              setBidPlacedItems((prev) => {
                const exists = prev.some((item) => 
                  item.address === bidder && 
                  item.price === price && 
                  item.role === cardType
                );
                if (!exists) {
                  return [{ type: "bid", address: bidder, role: cardType, name: cardName, price: price }, ...prev];
                }
                return prev;
              });
            }
          }
        } catch (error) {
          console.error("Error fetching bid log when bid changed:", error);
        }
      }
      
      if (gameStatus) {
        fetchNewBid();
        previousBidAmount.current = currentBidAmount;
      }
    }
  }, [gameStatus?.highestBid?.amount, gameStatus?.gameId, gameStatus?.currentRound, gameStatus?.gameState, gameStatus?.currentCard, gameFinishedDetected.current]);

  // Countdown timer for round end time
  useEffect(() => {
    if (!gameStatus?.roundEndsInSeconds || gameStatus.roundEndsInSeconds <= 0) {
      setTimeRemaining(null);
      return;
    }

    setTimeRemaining(gameStatus.roundEndsInSeconds);

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus?.roundEndsInSeconds, gameStatus?.currentRound]);

  // Detect new card and trigger shake animation
  useEffect(() => {
    if (gameStatus?.currentCard?.id) {
      const currentCardId = gameStatus.currentCard.id;
      
      if (previousCardId.current !== null && previousCardId.current !== currentCardId) {
        setCardShake(true);
        setTimeout(() => {
          setCardShake(false);
        }, 1500);
      }
      
      previousCardId.current = currentCardId;
    } else {
      previousCardId.current = null;
    }
  }, [gameStatus?.currentCard?.id]);

  // Format time as MM:SS
  const formatTime = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
  
  // Function to shorten wallet address
  const shortenAddress = (address: string | null | undefined) => {
    if (!address || typeof address !== 'string') return "N/A";
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
    
  const start = isGameStarted || gameStatus?.gameState === "InProgress";
  
  // Get current bid from API
  const currentBid = gameStatus?.highestBid?.amount 
    ? Math.floor(Number(gameStatus.highestBid.amount)) 
    : 0;
  const currentBidder = gameStatus?.highestBid?.bidder 
    ? shortenAddress(gameStatus.highestBid.bidder) 
    : "No bidder";
  
  // Get past bid from auctionedCards
  const pastBid = gameStatus?.auctionedCards && gameStatus.auctionedCards.length > 0
    ? (gameStatus.auctionedCards[gameStatus.auctionedCards.length - 1] as any)?.bidAmount || 0
    : 0;
  const pastBidder = gameStatus?.auctionedCards && gameStatus.auctionedCards.length > 0
    ? gameStatus.auctionedCards[gameStatus.auctionedCards.length - 1]?.winner
      ? shortenAddress(gameStatus.auctionedCards[gameStatus.auctionedCards.length - 1].winner!)
      : "No winner"
    : "No bidder";
  
  // Get current set from currentCard type
  const currentSet = gameStatus?.currentCard?.type || gameStatus?.currentCard?.raw?.type || "";
  
  // Get remaining cards count from API
  const remainingCards = gameStatus?.remainingCards?.length || 0;

  // Bidding data for ticker
  const biddingData = useMemo(() => {
    const tickerItems: any[] = [];

    if (bidPlacedItems && bidPlacedItems.length > 0) {
      tickerItems.push(...bidPlacedItems);
    }

    if (gameStatus?.auctionedCards && gameStatus.auctionedCards.length > 0) {
      gameStatus.auctionedCards
      .filter((auctioned: any) => auctioned.winner)
        .forEach((auctioned: any) => {
        const card = auctioned.card || auctioned.card?.raw || {};
          const cardType = (card.type || card.raw?.type || "sentinel").toUpperCase();
          const cardName = card.name || card.raw?.name || "Unknown";
        const winner = auctioned.winner ? shortenAddress(auctioned.winner) : "Unknown";
          const price = auctioned.pricePaid ? `${auctioned.pricePaid} chips` : (auctioned.bidAmount ? `${auctioned.bidAmount} chips` : "0 chips");
          
          tickerItems.push({
            type: "win",
            address: winner,
            role: cardType,
            name: cardName,
          price: price,
          });
        });
    }

    return tickerItems.reverse();
  }, [bidPlacedItems, gameStatus?.auctionedCards]);

  // Convert API players data to agents data format
  const agentsData = useMemo(() => {
    if (!gameStartInfo?.playersJoined || gameStartInfo.playersJoined.length === 0) {
      return [];
    }
    
    const validPlayers = gameStartInfo.playersJoined.filter((player) => {
      if (!player.address || typeof player.address !== 'string') return false;
      if (player.address === '0x0000000000000000000000000000000000000000') return false;
      return true;
    });
    
    const agentCardsMap = new Map<string, any[]>();
    
    if (gameStatus?.gameState === "InProgress" && 
        gameStatus?.auctionedCards &&
        gameStatus.gameId === gameId) {
      gameStatus.auctionedCards.forEach((auctioned: any) => {
        if (auctioned.winner && auctioned.card) {
          const winnerAddress = auctioned.winner.toLowerCase();
          if (!agentCardsMap.has(winnerAddress)) {
            agentCardsMap.set(winnerAddress, []);
          }
          const card = auctioned.card;
          const pricePaid = auctioned.pricePaid !== undefined && auctioned.pricePaid !== null 
            ? Number(auctioned.pricePaid) 
            : 0;
          const cardData = {
            ...card,
            name: card.name || card.raw?.name,
            image: card.image || card.raw?.image,
            attack: card.attack || card.raw?.attack || 0,
            defense: card.defense || card.raw?.defense || 0,
            strategist: card.strategist || card.raw?.strategist || 0,
            type: card.type || card.raw?.type || "sentinel",
            description: card.description || card.raw?.description || "",
            chipsRequired: pricePaid,
          };
          agentCardsMap.get(winnerAddress)!.push(cardData);
        }
      });
    }
    
    return validPlayers.map((player) => {
      const playerAddress = player.address.toLowerCase();
      const cards = agentCardsMap.get(playerAddress) || [];
      
      return {
        walletAddress: String(player.address || ''),
        chipsLeft: player.chipBalance || 0,
        cards: cards,
      };
    });
  }, [gameStartInfo?.playersJoined, gameStatus?.auctionedCards, gameStatus?.gameState, gameStatus?.gameId, gameId]);

  const membersJoined = agentsData.length;
  const totalPool = membersJoined * 10;

  // Calculate remaining cards from API - group by type
  const remainingCardsData = useMemo(() => {
    if (!gameStatus || gameStatus.gameState === "NotStarted") {
      return {
        sentinel: [],
        attacker: [],
        defender: [],
        strategist: [],
      };
    }

    const wonCardIds = new Set<number>();
    
    if (gameStatus.players) {
      gameStatus.players.forEach((player) => {
        (player.cards || []).forEach((card: any) => {
          const cardId = card.id || card.raw?.characterId || card.characterId;
          if (cardId !== undefined) {
            wonCardIds.add(cardId);
          }
        });
      });
    }
    
    if (gameStatus.auctionedCards) {
      gameStatus.auctionedCards.forEach((auctioned: any) => {
        if (auctioned.winner && auctioned.card) {
          const cardId = auctioned.card.id || auctioned.card.raw?.characterId || auctioned.card.characterId;
          if (cardId !== undefined) {
            wonCardIds.add(cardId);
          }
        }
      });
    }

    const grouped: {
      sentinel: any[];
      attacker: any[];
      defender: any[];
      strategist: any[];
    } = {
      sentinel: [],
      attacker: [],
      defender: [],
      strategist: [],
    };

    if (gameStatus.remainingCards) {
      gameStatus.remainingCards.forEach((card: any) => {
        const cardId = card.id || card.raw?.characterId || card.characterId;
        if (cardId && !wonCardIds.has(cardId)) {
          const cardType = card.type || card.raw?.type || "sentinel";
          if (grouped[cardType as keyof typeof grouped]) {
            grouped[cardType as keyof typeof grouped].push(card);
          }
        }
      });
    }

    return grouped;
  }, [gameStatus?.remainingCards, gameStatus?.players, gameStatus?.auctionedCards, gameStatus?.gameState]);

  const toggleSet = (setName: string) => {
    if (openSets.includes(setName)) {
      setOpenSets([]);
    } else {
      setOpenSets([setName]);
    }
  };

  const toggleAgent = (walletAddress: string) => {
    if (openAgents.includes(walletAddress)) {
      setOpenAgents([]);
    } else {
      setOpenAgents([walletAddress]);
    }
  };

  const setTypeMap: { [key: string]: "defender" | "attacker" | "sentinel" | "strategist" } = {
    sentinel: "sentinel",
    attacker: "attacker",
    defender: "defender",
    strategist: "strategist",
  };

  return (
    <>
      {/* Winner Modal */}
      {showWinnerModal && winnerData && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        >
          <div 
            className="relative rounded-lg p-8 backdrop-blur-sm"
            style={{ 
              backgroundColor: 'rgba(26, 26, 26, 0.7)',
              border: `3px solid ${primaryColor}`,
              width: '500px',
              minHeight: '400px',
              boxShadow: `0 0 30px ${primaryColor}`
            }}
          >
            <h2 
              className="text-3xl font-bold text-white mb-4 text-center"
              style={{ fontFamily: 'var(--font-orbitron), sans-serif' }}
            >
              WINNER DECLARED!
            </h2>
            
            <div className="flex justify-center mb-6">
              <div 
                className="text-6xl"
                style={{ filter: 'drop-shadow(0 0 10px rgba(194, 143, 243, 0.8))' }}
              >
                🏆
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-white/70 mb-2" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  Agent Address
                </p>
                <p 
                  className="text-xl font-bold text-white break-all"
                  style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: primaryColor }}
                >
                  {shortenAddress(winnerData.address)}
                </p>
              </div>
              
              <div className="text-center pt-4 border-t" style={{ borderColor: 'rgba(194, 143, 243, 0.3)' }}>
                <p className="text-sm text-white/70 mb-2" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  Pool
                </p>
                <p 
                  className="text-4xl font-bold"
                  style={{ fontFamily: 'var(--font-orbitron), sans-serif', color: primaryColor }}
                >
                  {winnerData.poolAmount} MON
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                // Navigate back to home
                router.push('/');
              }}
              className="mt-8 w-full py-3 rounded-lg font-bold text-white transition-all hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, #9B7EDE 50%, #7C5ACF 100%)`,
                fontFamily: 'Arial, Helvetica, sans-serif',
                boxShadow: `0 4px 15px rgba(124, 90, 207, 0.4)`
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      
    <div className="h-screen w-full flex flex-col overflow-hidden" style={{ backgroundColor: '#131313' }}>
      {/* Navbar */}
      <div className="flex-shrink-0 w-full px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#1a1a1a', borderBottom: `2px solid ${primaryColor}` }}>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          The Fifth Command
        </h1>
        
        {/* Stock Market Style Ticker */}
        <div className="flex-1 ml-8 overflow-hidden relative rounded flex items-center" style={{ height: '40px', border: `0.5px solid ${primaryColor}` }}>
          {!start ? (
            <Marquee
              autoFill={true}
              speed={50}
              direction="left"
              pauseOnHover={false}
              style={{ height: '100%', display: 'flex', alignItems: 'center' }}
            >
              <span className="text-white font-bold text-lg mx-32">Game starting in few mins</span>
            </Marquee>
          ) : (
            <Marquee
              autoFill={true}
              speed={50}
              direction="left"
              pauseOnHover={false}
              style={{ height: '100%', display: 'flex', alignItems: 'center' }}
            >
              {biddingData.map((item, index) => (
                <div key={index} className="flex items-center mx-8">
                  <span className="text-white mr-4">{item.address}</span>
                  <span className="text-white mr-4">{item.role}</span>
                  <span className="text-white mr-4">{item.name}</span>
                  <span className="mr-4 font-bold" style={{ color: item.type === 'win' ? '#4ade80' : '#f97316' }}>
                    {item.type === 'win' ? 'BID WON' : 'BID PLACED'}
                  </span>
                  <span className="text-white font-bold">{item.price}</span>
                  <div className="flex items-center justify-center mx-4" style={{ width: '20px', height: '20px' }}>
                    <Image
                      src="/logo.png"
                      alt="Logo"
                      width={20}
                      height={20}
                      className="object-contain"
                    />
                  </div>
                </div>
              ))}
            </Marquee>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 w-full flex gap-4 p-4 overflow-hidden">
        {/* Left Section - 30% - Individually Scrollable */}
        <div className="w-[30%] h-full flex flex-col overflow-hidden">
          <div className="flex-shrink-0 rounded-lg p-6 mb-4" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                Tournament {gameId > 0 ? `#${String(gameId).padStart(3, '0')}` : ''}
              </h2>
              <div className="flex items-center gap-3 flex-nowrap whitespace-nowrap">
                <span className="px-3 py-1 rounded text-sm font-semibold whitespace-nowrap" style={{ border: `1px solid ${primaryColor}`, backgroundColor: 'rgba(194, 143, 243, 0.1)' }}>
                  {start ? `Agents Playing: ${membersJoined}/5` : `Agents: ${membersJoined}/5`}
                </span>
                <p className="text-lg font-bold text-white whitespace-nowrap">Pool: {totalPool} MON</p>
              </div>
            </div>
          </div>

          {/* Scrollable Container for Agents and Card Sets */}
          <div className="flex-1 overflow-y-auto overflow-x-visible rounded-lg p-6 pb-0 custom-scrollbar" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            {/* Agents Section */}
            <p className="text-white mb-4 font-bold">Agents</p>
            {loading && !gameStatus && !gameStartInfo ? (
              <div className="text-center py-8">
                <p className="text-white/70">Loading game data...</p>
              </div>
            ) : agentsData.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-white/70">No agents joined yet</p>
              </div>
            ) : (
              agentsData.map((agent, agentIndex, array) => {
              const isLast = agentIndex === array.length - 1;
              return (
                <div key={agent.walletAddress} className={isLast ? 'mb-6' : 'mb-3'}>
                  <button
                    onClick={() => toggleAgent(agent.walletAddress)}
                    className="w-full flex items-center justify-between p-3 rounded-lg text-white hover:opacity-80 transition-opacity mb-2"
                    style={{ backgroundColor: 'rgba(194, 143, 243, 0.2)' }}
                  >
                    <div className="flex items-center gap-3">
                      <span>{shortenAddress(agent.walletAddress)}</span>
                      <span className="px-2 py-1 rounded text-xs font-bold" style={{ border: `1px solid ${primaryColor}`, backgroundColor: 'rgba(194, 143, 243, 0.1)' }}>
                        {agent.chipsLeft}/500
                      </span>
                    </div>
                    <span>{openAgents.includes(agent.walletAddress) ? '▼' : '▶'}</span>
                  </button>
                  {openAgents.includes(agent.walletAddress) && (
                    <div 
                      className="rounded-lg" 
                      style={{ 
                        backgroundColor: 'rgba(194, 143, 243, 0.1)',
                        border: `1px solid ${primaryColor}`,
                        marginTop: '8px',
                        padding: '8px',
                        overflow: 'visible'
                      }}
                    >
                      {agent.cards.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-white/70 text-sm">No cards yet</p>
                        </div>
                      ) : (
                        <div 
                          className="flex flex-wrap justify-evenly" 
                          style={{ 
                            gap: '15px',
                            overflow: 'visible'
                          }}
                        >
                          {agent.cards.map((card, index) => {
                          return (
                            <div
                              key={`${agent.walletAddress}-${index}`}
                              className="relative"
                              style={{
                                width: '160px',
                                height: '266.67px',
                                zIndex: agent.cards.length - index
                              }}
                            >
                              <div
                                className="absolute top-1/2 left-1/2"
                                style={{
                                  width: '320px',
                                  height: '533.33px',
                                  transform: 'translate(-50%, -50%) scale(0.5)',
                                  transformOrigin: 'center center',
                                }}
                              >
                                <CharacterCard
                                  name={card.name || card.raw?.name || "Unknown"}
                                  characterImage={card.image || card.raw?.image || ""}
                                  attack={card.attack || card.raw?.attack || 0}
                                  defense={card.defense || card.raw?.defense || 0}
                                  strategist={card.strategist || card.raw?.strategist || 0}
                                  type={(card.type || card.raw?.type || "sentinel") as "defender" | "attacker" | "sentinel" | "strategist"}
                                  description={card.description || card.raw?.description || ""}
                                  chipsRequired={card.chipsRequired !== undefined ? card.chipsRequired : 0}
                                  isSmall={true}
                                  tagPosition="bottom-center"
                                  tagColor="green"
                                />
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
            )}

            {/* Remaining Card Sets */}
            <div className="mt-6">
            <p className="text-white mb-4 font-bold">Remaining Card Sets</p>
            {start ? (
              <p className="text-xs text-white/70 mb-4">Note: Cards are not in sequence, sequence is completely random!</p>
            ) : (
              <p className="text-xs text-white/70 mb-4">Cards will appear when the game starts</p>
            )}
            
            {Object.entries(remainingCardsData).map(([setName, cards], setIndex, array) => {
              const isLast = setIndex === array.length - 1;
              return (
                <div key={setName} className={isLast ? '' : 'mb-3'}>
                  <button
                    onClick={() => toggleSet(setName)}
                    className="w-full flex items-center justify-between p-3 rounded-lg text-white hover:opacity-80 transition-opacity capitalize mb-2"
                    style={{ backgroundColor: 'rgba(194, 143, 243, 0.2)' }}
                  >
                    <span>{setName}</span>
                    <span>{openSets.includes(setName) ? '▼' : '▶'}</span>
                  </button>
                  {openSets.includes(setName) && (
                    <div 
                      className="rounded-lg" 
                      style={{ 
                        backgroundColor: 'rgba(194, 143, 243, 0.1)',
                        border: `1px solid ${primaryColor}`,
                        marginTop: '8px',
                        padding: '8px',
                        overflow: 'visible'
                      }}
                    >
                      {cards.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-white/70 text-sm">No cards revealed!</p>
                        </div>
                      ) : (
                        <div 
                          className="flex flex-wrap justify-evenly" 
                          style={{ 
                            gap: '15px',
                            overflow: 'visible'
                          }}
                        >
                          {cards.map((card, index) => {
                            return (
                              <div
                                key={`${setName}-${index}`}
                                className="relative"
                                style={{
                                  width: '160px',
                                  height: '266.67px',
                                  zIndex: cards.length - index
                                }}
                              >
                                <div
                                  className="absolute top-1/2 left-1/2"
                                  style={{
                                    width: '320px',
                                    height: '533.33px',
                                    transform: 'translate(-50%, -50%) scale(0.5)',
                                    transformOrigin: 'center center',
                                  }}
                                >
                                  <CharacterCard
                                    name={card.name || card.raw?.name || "Unknown"}
                                    characterImage={card.image || card.raw?.image || ""}
                                    attack={card.attack || card.raw?.attack || 0}
                                    defense={card.defense || card.raw?.defense || 0}
                                    strategist={card.strategist || card.raw?.strategist || 0}
                                    type={(card.type || card.raw?.type || setName) as "defender" | "attacker" | "sentinel" | "strategist"}
                                    description={card.raw?.description || card.description || ""}
                                    isSmall={true}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        </div>

        {/* Center Section - 50% - No Scroll */}
        <div className="w-[50%] h-full overflow-hidden">
          <div className="rounded-lg p-6 w-full h-full flex items-center justify-center" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            {!start ? (
              <div className="flex flex-col items-center justify-center">
                {gameStartCountdown !== null && gameStartCountdown > 0 ? (
                  <>
                    <p className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                      Game Starting In
                    </p>
                    <p className="text-5xl font-bold mb-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: primaryColor }}>
                      {gameStartCountdown}s
                    </p>
                    <p className="text-sm text-white/70" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                      Waiting buffer time for other players to join
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-3xl font-bold text-white mb-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                      Game is Yet to Start
                    </p>
                    <div className="text-center max-w-md px-4">
                      <p className="text-sm text-white/70 mb-2" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        Minimum threshold of 2 players to join the game per round.
                      </p>
                      <p className="text-sm text-white/70" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        Once 3 players join, the game has a standby time of 3 minutes before starting to let anyone join.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : gameStatus?.currentCard ? (
              <div className="flex flex-col items-center justify-center w-full">
                <div className={`w-80 ${cardShake ? 'card-shake' : ''}`}>
                  <CharacterCard
                    name={gameStatus.currentCard.name || gameStatus.currentCard.raw?.name || "Unknown"}
                    characterImage={gameStatus.currentCard.image || gameStatus.currentCard.raw?.image || ""}
                    attack={gameStatus.currentCard.attack || gameStatus.currentCard.raw?.attack || 0}
                    defense={gameStatus.currentCard.defense || gameStatus.currentCard.raw?.defense || 0}
                    strategist={gameStatus.currentCard.strategist || gameStatus.currentCard.raw?.strategist || 0}
                    type={(gameStatus.currentCard.type || gameStatus.currentCard.raw?.type || "sentinel") as "defender" | "attacker" | "sentinel" | "strategist"}
                    description={gameStatus.currentCard.raw?.description || gameStatus.currentCard.description || ""}
                  />
                </div>
                
                {/* Bid Information */}
                <div className="w-full max-w-2xl space-y-6 px-4 mt-6">
                  {/* Current Bid - Row Layout */}
                  <div className="flex items-center justify-between gap-8">
                    {/* Current Bid - Left Side */}
                    <div className="text-center flex-1">
                      <p className="text-lg font-bold text-white uppercase tracking-wider">
                        Current Bid
                      </p>
                      <div className="flex items-center justify-center mt-2">
                        <div className="text-4xl font-bold text-white">
                          <SlotCounter
                            key={`bid-${currentBid}-${gameStatus?.gameId || 0}-${gameStatus?.currentRound || 0}`}
                            value={String(currentBid)}
                            duration={2}
                            startValue={0}
                            useMonospaceWidth={true}
                          />
                        </div>
                        <span className="text-2xl font-semibold text-gray-400 ml-2">chips</span>
                      </div>
                      <p className="text-sm text-gray-300 mt-2">
                        <span className="text-gray-400">Current Bidder:</span>{" "}
                        <span className="text-white font-semibold">{currentBidder}</span>
                      </p>
                    </div>

                    {/* Round and Time - Right Side */}
                    <div className="text-center flex-1 space-y-3">
                      {/* Current Round */}
                      <div>
                        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
                          Round
                        </p>
                        <p className="text-2xl font-bold text-white">
                          {gameStatus?.currentRound || 0}
                        </p>
                      </div>
                      
                      {/* Time Remaining */}
                      {timeRemaining !== null && (
                        <div>
                          <p className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
                            Time Remaining
                          </p>
                          <p className="text-3xl font-bold" style={{ color: timeRemaining <= 10 ? '#EF4444' : primaryColor }}>
                            {formatTime(timeRemaining)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Current Set and Remaining Cards Row */}
                  <div className="flex items-start justify-between gap-8 pt-4 border-t" style={{ borderColor: 'rgba(194, 143, 243, 0.3)' }}>
                    {/* Current Set - Left Side */}
                    <div className="text-center space-y-2 flex-1">
                      <p className="text-base font-semibold text-gray-400 uppercase tracking-wide">
                        Current Set
                      </p>
                      <div className="flex items-center justify-center">
                        <p className="text-3xl font-bold text-gray-400 capitalize">
                          {currentSet || "N/A"}
                        </p>
                      </div>
                    </div>

                    {/* Remaining Cards - Right Side */}
                    <div className="text-center space-y-2 flex-1">
                      <p className="text-base font-semibold text-gray-400 uppercase tracking-wide">
                        Remaining Cards
                      </p>
                      <div className="flex items-center justify-center">
                        <div className="text-3xl font-bold text-gray-400">
                          <SlotCounter
                            key={`remaining-${remainingCards}-${gameStatus?.gameId || 0}-${gameStatus?.currentRound || 0}`}
                            value={String(remainingCards)}
                            duration={2}
                            startValue={0}
                            useMonospaceWidth={true}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <p className="text-2xl font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  Waiting for next card...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Section - 20% - Individually Scrollable */}
        <div className="w-[20%] h-full flex flex-col">
          <div className="rounded-lg flex flex-col h-full relative" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            <div className="flex-shrink-0 p-4 border-b" style={{ borderColor: primaryColor }}>
              <h3 className="text-lg font-bold text-white">Chat</h3>
            </div>
            
            {/* Chat Messages - Scrollable, messages from bottom */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse min-h-0" style={{ filter: 'blur(4px)' }}>
              {chatMessages.slice().reverse().map((msg) => (
                <div key={msg.id} className="mb-3 flex-shrink-0">
                  <p className="text-xs font-bold mb-1" style={{ color: primaryColor }}>{msg.user}</p>
                  <p className="text-sm text-white">{msg.message}</p>
                </div>
              ))}
            </div>

            {/* Coming Soon Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="relative">
                <span 
                  className="px-6 py-3 rounded-full text-base font-bold uppercase tracking-wider"
                  style={{ 
                    backgroundColor: 'rgba(26, 26, 26, 0.95)',
                    border: `3px solid ${primaryColor}`,
                    color: primaryColor,
                    fontFamily: 'var(--font-orbitron), Arial, Helvetica, sans-serif',
                    boxShadow: `0 4px 20px rgba(194, 143, 243, 0.5)`
                  }}
                >
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
