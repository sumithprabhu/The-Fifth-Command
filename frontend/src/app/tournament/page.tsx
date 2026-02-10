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
import { useRouter } from "next/navigation";

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

type GamePhase = 'idle' | 'loading' | 'inProgress' | 'finished' | 'confirming' | 'nextRound';

// Determine phase from game status - API is source of truth
const determinePhase = (status: GameStatus | null, hasWinnerData: boolean, wasWatching: boolean): GamePhase => {
  if (!status) return 'loading';
  
  switch (status.gameState) {
    case 'NotStarted':
      return 'idle';
    case 'InProgress':
      return 'inProgress';
    case 'Finished':
      // If we have winner data and user was watching, ready for next round
      if (hasWinnerData && wasWatching) return 'nextRound';
      // If game finished but no winner data yet, we're confirming from contract
      if (!hasWinnerData) return 'confirming';
      // If we have winner data but user wasn't watching, still go to nextRound (but won't show modal)
      return 'nextRound';
    default:
      return 'idle';
  }
};

export default function TournamentPage() {
  // Toggle flags for testing with dummy data
  const isGameStarted = false; // Set to true to show dummy game started data
  const isWinnerDeclared = false; // Set to true to show dummy winner declared data
  
  const router = useRouter();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [currentGameId, setCurrentGameId] = useState<number>(0);
  const [gameStartInfo, setGameStartInfo] = useState<GameStartInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSets, setOpenSets] = useState<string[]>([]);
  const [openAgents, setOpenAgents] = useState<string[]>([]);
  
  // Single authoritative phase state
  const [phase, setPhase] = useState<GamePhase>('loading');
  
  // Winner data
  const [winnerData, setWinnerData] = useState<{ address: string; poolAmount: string } | null>(null);
  const [finishedGameState, setFinishedGameState] = useState<{ gameStatus: GameStatus; gameId: number } | null>(null);
  
  // Refs for tracking
  const confettiTriggered = useRef(false);
  const winnerPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const wasWatchingWhenFinished = useRef(false);
  const previousGameId = useRef<number>(0);
  
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [gameStartCountdown, setGameStartCountdown] = useState<number | null>(null);
  const [currentRoundBids, setCurrentRoundBids] = useState<any[]>([]);
  const [bidPlacedItems, setBidPlacedItems] = useState<any[]>([]); // Store bid placed items for ticker
  const previousBidAmount = useRef<number>(0);
  const previousRound = useRef<number>(0);
  const previousCardId = useRef<number | null>(null);
  const [cardShake, setCardShake] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false); // Debounced flag for winner modal
  const [chatMessages, setChatMessages] = useState([
    { id: 1, user: "Agent Alpha", message: "Good luck everyone!" },
    { id: 2, user: "Agent Beta", message: "Let's go!" },
  ]);

  const primaryColor = "#c28ff3";
  
  // Reset game state function
  const resetGameState = () => {
    setWinnerData(null);
    setFinishedGameState(null);
    wasWatchingWhenFinished.current = false;
    confettiTriggered.current = false;
    setShowWinnerModal(false);
  };
  
  // Event-driven callback when winner is confirmed
  const handleWinnerConfirmed = useCallback((winner: { address: string; poolAmount: string }, gameId: number) => {
    setWinnerData(winner);
    setPhase('nextRound');
    confettiTriggered.current = false;
  }, []);
  
  // Transition guard: Reset state when gameId changes
  useEffect(() => {
    if (previousGameId.current > 0 && previousGameId.current !== currentGameId && currentGameId > 0) {
      console.log(`GameId changed from ${previousGameId.current} to ${currentGameId}, resetting state`);
      resetGameState();
      setPhase('loading'); // Reset to loading to fetch new game data
    }
    previousGameId.current = currentGameId;
  }, [currentGameId]);
  
  // Update phase based on game status (API is source of truth)
  useEffect(() => {
    const newPhase = determinePhase(gameStatus, !!winnerData, wasWatchingWhenFinished.current);
    setPhase(newPhase);
  }, [gameStatus, winnerData]);

  // Custom hook for game polling - phase-driven
  useEffect(() => {
    if (isGameStarted) return;
    
    let isInitialLoad = true;
    let intervalId: NodeJS.Timeout | null = null;
    
    async function fetchData() {
      try {
        if (isInitialLoad) {
          setLoading(true);
        }
        
        // Fetch API status, contract gameId, and game start info in parallel
        let gameId: bigint | null = null;
        try {
          gameId = await getCurrentGameId();
        } catch (error) {
          console.warn("Failed to fetch gameId from contract, will use API gameId:", error);
        }
        
        const [status, startInfo] = await Promise.all([
          getGameStatus(),
          getGameStartInfo()
        ]);
        
        const gameIdNum = gameId ? Number(gameId) : (status?.gameId || 0);
        setCurrentGameId(gameIdNum);
        
        // Update game start info
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
        
        // Update game status - phase will be derived from this
        setGameStatus((prevStatus) => {
          if (status?.gameId && gameIdNum > 0 && status.gameId !== gameIdNum) {
            console.warn(`Ignoring gameStatus with mismatched gameId: ${status.gameId} != ${gameIdNum}`);
            return prevStatus;
          }
          
          if (!prevStatus || JSON.stringify(prevStatus) !== JSON.stringify(status)) {
            return status as GameStatus;
          }
          return prevStatus;
        });
        
        // Handle finished state transition
        if (status?.gameState === "Finished" && status.gameId) {
          // If initial load and game already finished, user wasn't watching
          if (isInitialLoad) {
            setLoading(false);
            wasWatchingWhenFinished.current = false; // User wasn't watching on page load
            return;
          }
          
          // Store finished state and mark user as watching (game finished while they were on page)
          if (!finishedGameState || finishedGameState.gameId !== status.gameId) {
            setFinishedGameState({ gameStatus: status as GameStatus, gameId: status.gameId });
            wasWatchingWhenFinished.current = true;
          }
          
          // Phase will automatically update to 'confirming' via useEffect
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        if (isInitialLoad) {
          setGameStatus(null);
          setCurrentGameId(0);
        }
      } finally {
        if (isInitialLoad) {
          setLoading(false);
          isInitialLoad = false;
        }
      }
    }
    
    // Phase-driven polling control
    if (phase === 'idle' || phase === 'inProgress' || phase === 'loading' || phase === 'nextRound') {
      fetchData();
      intervalId = setInterval(fetchData, 5000);
    } else if (phase === 'finished' || phase === 'confirming') {
      // Stop API polling, contract polling will handle winner confirmation
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [phase, isGameStarted]);

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

  // Function to check for winner confirmation from contract - event-driven
  const checkForWinnerConfirmation = useCallback(async (gameId: number) => {
    if (winnerData) return; // Already confirmed
    
    try {
      // Method 1: Check GameFinalized event
      const finalizedEvent = await getGameFinalizedEvent(gameId);
      if (finalizedEvent) {
        const poolAmount = ethers.formatEther(finalizedEvent.potPaid);
        const formattedAmount = parseFloat(poolAmount).toFixed(2);
        
        handleWinnerConfirmed({
          address: finalizedEvent.winner,
          poolAmount: formattedAmount
        }, gameId);
        
        console.log('Winner confirmed from GameFinalized event:', finalizedEvent);
        return;
      }
      
      // Method 2: Check past games
      try {
        const pastGameIndex = gameId - 1;
        const pastGame = await getPastGame(pastGameIndex);
        if (Number(pastGame.gameId) === gameId && pastGame.winner && pastGame.winner !== ethers.ZeroAddress) {
          const poolAmount = ethers.formatEther(pastGame.potPaid);
          const formattedAmount = parseFloat(poolAmount).toFixed(2);
          
          handleWinnerConfirmed({
            address: pastGame.winner,
            poolAmount: formattedAmount
          }, gameId);
          
          console.log('Winner confirmed from past games (index', pastGameIndex, '):', pastGame);
          return;
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
                
                handleWinnerConfirmed({
                  address: pastGame.winner,
                  poolAmount: formattedAmount
                }, gameId);
                
                console.log('Winner confirmed from past games (fallback search, index', i, '):', pastGame);
                return;
              }
            } catch (err) {
              // Continue searching
            }
          }
        } catch (fallbackError) {
          console.error("Error in fallback past games search:", fallbackError);
        }
      }
    } catch (error) {
      console.error("Error checking for winner confirmation:", error);
    }
  }, [winnerData, handleWinnerConfirmed]);

  // Display game status - use finished state if in confirming/nextRound phase
  const displayGameStatus = (phase === 'confirming' || phase === 'nextRound') && finishedGameState
    ? finishedGameState.gameStatus
    : gameStatus;

  // Monitor bid changes and fetch bid log when bid changes
  useEffect(() => {
    // STOP polling if in confirming phase
    if (phase === 'confirming' || phase === 'nextRound') {
      setBidPlacedItems([]);
      previousBidAmount.current = 0;
      previousRound.current = 0;
      return;
    }
    
    if (!displayGameStatus?.gameId || !displayGameStatus?.currentRound || displayGameStatus.gameState !== "InProgress") {
      // Reset when game is not in progress
      if (displayGameStatus?.gameState !== "InProgress") {
        setBidPlacedItems([]);
        previousBidAmount.current = 0;
        previousRound.current = 0;
      }
      return;
    }

    const currentBidAmount = displayGameStatus?.highestBid?.amount || 0;
    const currentRound = displayGameStatus.currentRound;

    // Check if round changed - reset bid placed items for new round
    if (currentRound !== previousRound.current) {
      setBidPlacedItems([]);
      previousRound.current = currentRound;
      previousBidAmount.current = currentBidAmount;
      return;
    }

    // Check if bid amount changed
    if (currentBidAmount !== previousBidAmount.current && currentBidAmount > 0 && displayGameStatus) {
      // Bid changed! Fetch bid log to see who placed the bid
      async function fetchNewBid() {
        if (!displayGameStatus) return;
        try {
          const bidLog = await getBidLog(displayGameStatus.gameId, displayGameStatus.currentRound);
          if (bidLog && bidLog.length > 0 && displayGameStatus?.currentCard) {
            // Get the most recent bid (highest amount or latest timestamp)
            const sortedBids = [...bidLog].sort((a: any, b: any) => {
              const amountA = a.amount || a.bidAmount || a.price || 0;
              const amountB = b.amount || b.bidAmount || b.price || 0;
              if (amountB !== amountA) return amountB - amountA; // Higher amount first
              const timeA = a.timestamp || a.time || 0;
              const timeB = b.timestamp || b.time || 0;
              return timeB - timeA; // Most recent first
            });
            
            const latestBid = sortedBids[0];
            if (latestBid) {
              const card = displayGameStatus.currentCard;
              const cardType = (card.type || card.raw?.type || "sentinel").toUpperCase();
              const cardName = card.name || card.raw?.name || "Unknown";
              const bidder = latestBid.bidder || latestBid.address || latestBid.player 
                ? shortenAddress(latestBid.bidder || latestBid.address || latestBid.player) 
                : "Unknown";
              const price = latestBid.amount || latestBid.bidAmount || latestBid.price 
                ? `${latestBid.amount || latestBid.bidAmount || latestBid.price} chips` 
                : "0 chips";
              
              // Add to bid placed items
              setBidPlacedItems((prev) => {
                // Avoid duplicates - check if this bid already exists
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
      
      if (displayGameStatus) {
        fetchNewBid();
        previousBidAmount.current = currentBidAmount;
      }
    }
  }, [displayGameStatus?.highestBid?.amount, displayGameStatus?.gameId, displayGameStatus?.currentRound, displayGameStatus?.gameState, displayGameStatus?.currentCard]);

  // Countdown timer for round end time
  useEffect(() => {
    if (!displayGameStatus?.roundEndsInSeconds || displayGameStatus.roundEndsInSeconds <= 0) {
      setTimeRemaining(null);
      return;
    }

    // Reset timer when roundEndsInSeconds changes from API
    setTimeRemaining(displayGameStatus.roundEndsInSeconds);

    // Update every second
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          return 0; // Keep at 0 instead of null to show 00:00
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [displayGameStatus?.roundEndsInSeconds, displayGameStatus?.currentRound]); // Reset when round changes

  // Detect new card and trigger shake animation
  useEffect(() => {
    if (displayGameStatus?.currentCard?.id) {
      const currentCardId = displayGameStatus.currentCard.id;
      
      // If card ID changed, trigger shake animation
      if (previousCardId.current !== null && previousCardId.current !== currentCardId) {
        setCardShake(true);
        // Reset shake after animation completes
        setTimeout(() => {
          setCardShake(false);
        }, 1500); // Match animation duration (1.5s)
      }
      
      previousCardId.current = currentCardId;
    } else {
      previousCardId.current = null;
    }
  }, [displayGameStatus?.currentCard?.id]);

  // Format time as MM:SS
  const formatTime = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
    
  const start = isGameStarted || displayGameStatus?.gameState === "InProgress";
  const winnerDeclaredCheck = isWinnerDeclared || phase === 'nextRound' || displayGameStatus?.gameState === "Finished"; // Check if winner is declared (game finished)
  
  // Initialize dummy data if isGameStarted toggle is set
  // This should override any API data when toggle is true
  useEffect(() => {
    if (isGameStarted) {
      // Set dummy game started data - always override when toggle is true
      const dummyGameStatus: GameStatus = {
        gameId: 1,
        gameState: "InProgress",
        currentRound: 4,
        totalCards: 11,
        currentCard: {
          id: 1014,
          name: "Crusher",
          image: "/pandas/attacker/attacker_9.png",
          type: "attacker",
          attack: 9,
          defense: 4,
          strategist: 6,
          raw: {
            characterId: 1014,
            name: "Crusher",
            image: "/pandas/attacker/attacker_9.png",
            attack: 9,
            defense: 4,
            strategist: 6,
            description: "Overwhelming strength that shatters defenses with brute force."
          }
        },
        highestBid: {
          amount: 1250,
          bidder: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        },
        revealedCards: [],
        players: [
          {
            address: "0x49403ae592c82fc3f861cd0b9738f7524fb1f38c",
            chipBalance: 400,
            cardsOwned: 0,
            cards: []
          },
          {
            address: "0x778d3206374f8ac265728e18e3fe2ae6b93e4ce4",
            chipBalance: 490,
            cardsOwned: 1,
            cards: [{
              id: 1019,
              name: "Blitz",
              image: "/pandas/attacker/attacker_14.png",
              type: "attacker",
              attack: 8,
              defense: 5,
              strategist: 6,
            }]
          }
        ],
        roundEndsInSeconds: 91,
        gameStartsInSeconds: null,
        auctionedCards: [
          {
            card: {
              id: 1002,
              name: "Zenith",
              image: "/pandas/sentinel/sentinel_3.png",
              type: "sentinel",
              attack: 6,
              defense: 5,
              strategist: 6,
            },
            winner: null
          }
        ],
        remainingCards: [
          {
            id: 1017,
            name: "Titan",
            image: "/pandas/attacker/attacker_12.png",
            type: "attacker",
            attack: 8,
            defense: 6,
            strategist: 7,
          },
          {
            id: 1028,
            name: "Rampart",
            image: "/pandas/defender/defender_7.png",
            type: "defender",
            attack: 5,
            defense: 8,
            strategist: 7,
          }
        ]
      };
      setGameStatus(dummyGameStatus);
      setCurrentGameId(0);
      setLoading(false); // Stop loading when using dummy data
    }
  }, [isGameStarted]);
  
  // Check if winner is declared (game finished) - similar to start check
  // Only trigger if isWinnerDeclared toggle is true (for testing)
  useEffect(() => {
    // Reset winner state when toggle is false (but only if it was set by toggle, not by actual game)
    if (!isWinnerDeclared && phase === 'nextRound' && !finishedGameState) {
      resetGameState();
      setPhase('idle');
      return;
    }
    
    // Only show if toggle is explicitly true - don't show if false
    if (isWinnerDeclared && phase !== 'nextRound' && !confettiTriggered.current) {
      // Set winner data (using dummy data for now)
      const dummyWinner = {
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        poolAmount: "1250.00"
      };
      setWinnerData(dummyWinner);
      handleWinnerConfirmed(dummyWinner, currentGameId || 0);
      confettiTriggered.current = true;
      
      // Trigger confetti with violet colors
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }; // Higher than modal (z-50) to appear in front

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Violet color confetti
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
        
        // Use violet colors
        confetti({
          ...defaults,
          particleCount,
          colors: ['#B794F6', '#9B7EDE', '#7C5ACF', '#c28ff3'],
          origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
    }
    
    // If toggle is false but game actually finished, show real winner (only when toggle is false)
    // Commented out - only show when toggle is true for testing
    // Uncomment below if you want modal to show when game actually finishes (even when toggle is false)
    /*
    if (!isWinnerDeclared && gameStatus?.gameState === "Finished" && !winnerDeclared.declared && !confettiTriggered.current) {
      // Set winner data from game status (or dummy if not available)
      const winner = {
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb", // TODO: Get from gameStatus
        poolAmount: "1250.00" // TODO: Get from gameStatus
      };
      setWinnerData(winner);
      setWinnerDeclared(true);
      confettiTriggered.current = true;
      
      // Trigger confetti with violet colors
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }; // Higher than modal (z-50) to appear in front

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
    */
  }, [isWinnerDeclared, phase, handleWinnerConfirmed, currentGameId]);
  
  // Contract polling - phase-driven
  useEffect(() => {
    if (isGameStarted || isWinnerDeclared) return;
    
    // Only poll contract when in 'confirming' phase
    if (phase !== 'confirming' || !finishedGameState || winnerData) {
      if (winnerPollingInterval.current) {
        clearInterval(winnerPollingInterval.current);
        winnerPollingInterval.current = null;
      }
      return;
    }
    
    // Start polling for winner confirmation every 3 seconds
    const pollForWinner = async () => {
      if (!winnerData && finishedGameState) {
        await checkForWinnerConfirmation(finishedGameState.gameId);
      }
    };
    
    pollForWinner();
    winnerPollingInterval.current = setInterval(pollForWinner, 3000);
    
    return () => {
      if (winnerPollingInterval.current) {
        clearInterval(winnerPollingInterval.current);
        winnerPollingInterval.current = null;
      }
    };
  }, [phase, finishedGameState, winnerData, checkForWinnerConfirmation, isGameStarted, isWinnerDeclared]);

  // Debounce winner modal - show when in nextRound phase and user was watching
  useEffect(() => {
    if (phase === 'nextRound' && winnerData && wasWatchingWhenFinished.current) {
      const timer = setTimeout(() => {
        setShowWinnerModal(true);
      }, 500); // 500ms debounce
      
      return () => clearTimeout(timer);
    } else {
      setShowWinnerModal(false);
    }
  }, [phase, winnerData]);

  // Phase transitions are handled by determinePhase and gameId change guard
  // No need for manual reset logic here
  
  // Function to manually test winner modal with dummy data (for testing)
  const testWinnerModal = () => {
    const dummyWinner = {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      poolAmount: "1250.00"
    };
    handleWinnerConfirmed(dummyWinner, currentGameId || 0);
    confettiTriggered.current = true;
    
    // Trigger confetti
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }; // Higher than modal (z-50) to appear in front

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
  };

  // Function to shorten wallet address
  const shortenAddress = (address: string | null | undefined) => {
    if (!address || typeof address !== 'string') return "N/A";
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get current bid from API - use displayGameStatus to show finished game if waiting
  // Ensure it's a proper integer to prevent display issues with SlotCounter
  const currentBid = displayGameStatus?.highestBid?.amount 
    ? Math.floor(Number(displayGameStatus.highestBid.amount)) 
    : 0;
  const currentBidder = displayGameStatus?.highestBid?.bidder 
    ? shortenAddress(displayGameStatus.highestBid.bidder) 
    : "No bidder";
  
  // Debug log to track bid value changes
  useEffect(() => {
    if (displayGameStatus?.highestBid?.amount !== undefined) {
      console.log(`[BID DEBUG] Raw amount: ${displayGameStatus.highestBid.amount}, Type: ${typeof displayGameStatus.highestBid.amount}, Converted: ${currentBid}`);
    }
  }, [displayGameStatus?.highestBid?.amount, currentBid]);
  
  // Get past bid from auctionedCards (last auctioned card)
  const pastBid = displayGameStatus?.auctionedCards && displayGameStatus.auctionedCards.length > 0
    ? (displayGameStatus.auctionedCards[displayGameStatus.auctionedCards.length - 1] as any)?.bidAmount || 0
    : 0;
  const pastBidder = displayGameStatus?.auctionedCards && displayGameStatus.auctionedCards.length > 0
    ? displayGameStatus.auctionedCards[displayGameStatus.auctionedCards.length - 1]?.winner
      ? shortenAddress(displayGameStatus.auctionedCards[displayGameStatus.auctionedCards.length - 1].winner!)
      : "No winner"
    : "No bidder";
  
  // Get current set from currentCard type
  const currentSet = displayGameStatus?.currentCard?.type || displayGameStatus?.currentCard?.raw?.type || "";
  
  // Get remaining cards count from API
  const remainingCards = displayGameStatus?.remainingCards?.length || 0;

  // Bidding data for ticker - combines bid placed items and previous round wins
  const biddingData = useMemo(() => {
    const tickerItems: any[] = [];

    // 1. Add bid placed items (from when bids changed)
    if (bidPlacedItems && bidPlacedItems.length > 0) {
      tickerItems.push(...bidPlacedItems);
    }

    // 2. Add previous round wins (from auctionedCards)
    if (displayGameStatus?.auctionedCards && displayGameStatus.auctionedCards.length > 0) {
      displayGameStatus.auctionedCards
      .filter((auctioned: any) => auctioned.winner) // Only show cards with winners
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

    // Reverse to show most recent first
    return tickerItems.reverse();
  }, [bidPlacedItems, displayGameStatus?.auctionedCards]);

  // Convert API players data to agents data format
  // CRITICAL: ONLY use gameStartInfo.playersJoined (from start-info API) for agent list
  // Map cards from auctionedCards (from status API) to those agents
  // NEVER use gameStatus.players - only use start-info API
  const agentsData = useMemo(() => {
    // ONLY use gameStartInfo.playersJoined from start-info API
    if (!gameStartInfo?.playersJoined || gameStartInfo.playersJoined.length === 0) {
      return [];
    }
    
    // Filter out invalid addresses
    const validPlayers = gameStartInfo.playersJoined.filter((player) => {
      if (!player.address || typeof player.address !== 'string') return false;
      if (player.address === '0x0000000000000000000000000000000000000000') return false;
      return true;
    });
    
    // Create a map of agent addresses to their cards from auctionedCards (only if game is in progress)
    const agentCardsMap = new Map<string, any[]>();
    
    // Only map cards if game is in progress and we have auctionedCards
    if (displayGameStatus?.gameState === "InProgress" && 
        displayGameStatus?.auctionedCards &&
        displayGameStatus.gameId === currentGameId) {
      displayGameStatus.auctionedCards.forEach((auctioned: any) => {
        if (auctioned.winner && auctioned.card) {
          const winnerAddress = auctioned.winner.toLowerCase();
          if (!agentCardsMap.has(winnerAddress)) {
            agentCardsMap.set(winnerAddress, []);
          }
          const card = auctioned.card;
          // Use pricePaid from auctionedCards (not bidAmount)
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
            chipsRequired: pricePaid, // Use pricePaid from auctionedCards
          };
          agentCardsMap.get(winnerAddress)!.push(cardData);
        }
      });
    }
    
    // Map agents from start-info API and attach cards from auctionedCards
    return validPlayers.map((player) => {
      const playerAddress = player.address.toLowerCase();
      const cards = agentCardsMap.get(playerAddress) || [];
      
      return {
        walletAddress: String(player.address || ''),
        chipsLeft: player.chipBalance || 0,
        cards: cards,
      };
    });
  }, [gameStartInfo?.playersJoined, displayGameStatus?.auctionedCards, displayGameStatus?.gameState, displayGameStatus?.gameId, currentGameId]);

  // Get members and pool - use agentsData.length (filtered list) instead of raw API data
  // This ensures we only count valid players from the current game
  const membersJoined = agentsData.length;
  
  // Calculate total pool: static calculation (agents joined x 10 MON entry fee)
  const totalPool = membersJoined * 10;

  // Calculate remaining cards from API - group by type - memoized with specific dependencies
  const remainingCardsData = useMemo(() => {
    if (!displayGameStatus || displayGameStatus.gameState === "NotStarted") {
      // Return empty sets when game hasn't started
      return {
        sentinel: [],
        attacker: [],
        defender: [],
        strategist: [],
      };
    }

    // Get all cards that have been won (from players' cards and auctionedCards)
    const wonCardIds = new Set<number>();
    
    // Add cards from players
    if (displayGameStatus.players) {
      displayGameStatus.players.forEach((player) => {
        (player.cards || []).forEach((card: any) => {
          const cardId = card.id || card.raw?.characterId || card.characterId;
          if (cardId !== undefined) {
            wonCardIds.add(cardId);
          }
        });
      });
    }
    
    // Add cards from auctionedCards that have winners
    if (displayGameStatus.auctionedCards) {
      displayGameStatus.auctionedCards.forEach((auctioned: any) => {
        if (auctioned.winner && auctioned.card) {
          const cardId = auctioned.card.id || auctioned.card.raw?.characterId || auctioned.card.characterId;
          if (cardId !== undefined) {
            wonCardIds.add(cardId);
          }
        }
      });
    }

    // Group remainingCards from API by type
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

    if (displayGameStatus.remainingCards) {
      displayGameStatus.remainingCards.forEach((card: any) => {
        const cardId = card.id || card.raw?.characterId || card.characterId;
        // Only include if not won
        if (cardId && !wonCardIds.has(cardId)) {
          const cardType = card.type || card.raw?.type || "sentinel";
          if (grouped[cardType as keyof typeof grouped]) {
            grouped[cardType as keyof typeof grouped].push(card);
          }
        }
      });
    }

    return grouped;
  }, [displayGameStatus?.remainingCards, displayGameStatus?.players, displayGameStatus?.auctionedCards, displayGameStatus?.gameState]);

  const toggleSet = (setName: string) => {
    if (openSets.includes(setName)) {
      setOpenSets([]);
    } else {
      // Only one toggle open at a time
      setOpenSets([setName]);
    }
  };

  const toggleAgent = (walletAddress: string) => {
    if (openAgents.includes(walletAddress)) {
      setOpenAgents([]);
    } else {
      // Only one toggle open at a time
      setOpenAgents([walletAddress]);
    }
  };



  // Map set names to types for CharacterCard
  const setTypeMap: { [key: string]: "defender" | "attacker" | "sentinel" | "strategist" } = {
    sentinel: "sentinel",
    attacker: "attacker",
    defender: "defender",
    strategist: "strategist",
  };

  return (
    <>
      {/* Winner Modal - Show ONLY if user was actively watching when game finished */}
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
            
            {/* Trophy Icon */}
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
                // Reset state and transition to idle
                resetGameState();
                setPhase('idle');
                // Navigate to home
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
      {/* Winner Modal - Show ONLY if user was actively watching when game finished */}
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
            
            {/* Trophy Icon */}
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
                // Reset state and transition to idle
                resetGameState();
                setPhase('idle');
                // Navigate to home
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
                Tournament {currentGameId > 0 ? `#${String(currentGameId).padStart(3, '0')}` : ''}
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
                  <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                    Game is Yet to Start
                  </p>
                )}
              </div>
            ) : displayGameStatus?.currentCard ? (
              <div className="flex flex-col items-center justify-center w-full">
                <div className={`w-80 ${cardShake ? 'card-shake' : ''}`}>
                  <CharacterCard
                    name={displayGameStatus.currentCard.name || displayGameStatus.currentCard.raw?.name || "Unknown"}
                    characterImage={displayGameStatus.currentCard.image || displayGameStatus.currentCard.raw?.image || ""}
                    attack={displayGameStatus.currentCard.attack || displayGameStatus.currentCard.raw?.attack || 0}
                    defense={displayGameStatus.currentCard.defense || displayGameStatus.currentCard.raw?.defense || 0}
                    strategist={displayGameStatus.currentCard.strategist || displayGameStatus.currentCard.raw?.strategist || 0}
                    type={(displayGameStatus.currentCard.type || displayGameStatus.currentCard.raw?.type || "sentinel") as "defender" | "attacker" | "sentinel" | "strategist"}
                    description={displayGameStatus.currentCard.raw?.description || displayGameStatus.currentCard.description || ""}
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
                            key={`bid-${currentBid}-${displayGameStatus?.gameId || 0}-${displayGameStatus?.currentRound || 0}`}
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
                          {displayGameStatus?.currentRound || 0}
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
                            key={`remaining-${remainingCards}-${displayGameStatus?.gameId || 0}-${displayGameStatus?.currentRound || 0}`}
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
