"use client";

import Image from "next/image";
import { useState, useMemo, useEffect, useRef } from "react";
import CharacterCard from "@/components/CharacterCard";
import charMeta from "@/char_meta.json";
import Marquee from "react-fast-marquee";
// @ts-ignore - Package may need installation
import SlotCounter from "react-slot-counter";
import confetti from "canvas-confetti";
import { ethers } from "ethers";
import { getGameStatus, getGameStartInfo, GameStartInfo, getBidLog } from "@/lib/api";
import { getCurrentGameId, getPlayersFromEvents, getGameFinalizedEvent, getPastGamesCount, getPastGame, getAllPastGames } from "@/lib/contract";
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

export default function TournamentPage() {
  // Toggle flags for testing with dummy data
  const isGameStarted = false; // Set to true to show dummy game started data
  const isWinnerDeclared = false; // Set to true to show dummy winner declared data
  
  const router = useRouter();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [currentGameId, setCurrentGameId] = useState<number>(0);
  const [playersFromEvents, setPlayersFromEvents] = useState<string[]>([]);
  const [gameStartInfo, setGameStartInfo] = useState<GameStartInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSets, setOpenSets] = useState<string[]>([]);
  const [openAgents, setOpenAgents] = useState<string[]>([]);
  // winnerDeclared stores the gameId once winner is declared - NEVER resets to allow showing winner modal
  const [winnerDeclared, setWinnerDeclared] = useState<{ declared: boolean; gameId: number | null }>({ declared: false, gameId: null });
  const [winnerData, setWinnerData] = useState<{ address: string; poolAmount: string } | null>(null);
  const confettiTriggered = useRef(false);
  const winnerPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [currentRoundBids, setCurrentRoundBids] = useState<any[]>([]);
  const [bidPlacedItems, setBidPlacedItems] = useState<any[]>([]); // Store bid placed items for ticker
  const previousBidAmount = useRef<number>(0);
  const previousRound = useRef<number>(0);
  // Store finished game state to prevent reset until contract confirms
  const [finishedGameState, setFinishedGameState] = useState<{ gameStatus: GameStatus; gameId: number } | null>(null);
  const [waitingForContractConfirmation, setWaitingForContractConfirmation] = useState(false);
  const shouldStopPolling = useRef(false); // Ref to track if we should stop polling
  const [chatMessages, setChatMessages] = useState([
    { id: 1, user: "Agent Alpha", message: "Good luck everyone!" },
    { id: 2, user: "Agent Beta", message: "Let's go!" },
  ]);

  const primaryColor = "#c28ff3";
  
  // MAIN POLLING: Fetch game status from API and currentGameId from contract
  // This ONLY runs when NOT waiting for winner confirmation
  useEffect(() => {
    // Skip API fetch if isGameStarted toggle is true (using dummy data)
    if (isGameStarted) {
      shouldStopPolling.current = false;
      return;
    }
    
    // COMPLETELY STOP if we're waiting for winner confirmation
    if (waitingForContractConfirmation) {
      shouldStopPolling.current = true;
      return;
    }
    
    // Reset stop flag
    shouldStopPolling.current = false;
    
    let isInitialLoad = true;
    let intervalId: NodeJS.Timeout | null = null;
    
    async function fetchData() {
      // Check ref - if stop flag was set, stop immediately
      if (shouldStopPolling.current || waitingForContractConfirmation) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }
      
      try {
        if (isInitialLoad) {
          setLoading(true);
        }
        
        // Fetch API status, contract gameId, and game start info in parallel
        const [status, gameId, startInfo] = await Promise.all([
          getGameStatus(),
          getCurrentGameId(),
          getGameStartInfo()
        ]);
        const gameIdNum = Number(gameId);
        
        // Check if game just finished - store it and STOP all other polling
        // BUT: If winner is already declared for this gameId, don't do anything - UI is locked
        if (status?.gameState === "Finished" && status.gameId) {
          // If winner already declared for this game, don't reset anything
          if (winnerDeclared.declared && winnerDeclared.gameId === status.gameId) {
            if (isInitialLoad) {
              setLoading(false);
            }
            return; // UI is locked, don't change anything
          }
          
          // Set stop flag immediately
          shouldStopPolling.current = true;
          
          // Store the finished game state - NEVER clear this once winner is declared
          setFinishedGameState({ gameStatus: status as GameStatus, gameId: status.gameId });
          setWaitingForContractConfirmation(true);
          setCurrentGameId(status.gameId);
          
          // Stop the interval immediately
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          
          // Immediately check past games and GameFinalized event
          checkForWinnerConfirmation(status.gameId).catch(err => console.error("Error checking winner:", err));
          
          // STOP - don't update anything else
          if (isInitialLoad) {
            setLoading(false);
          }
          return;
        }
        
        // If winner is declared, don't update gameStatus - keep showing finished state
        if (winnerDeclared.declared && winnerDeclared.gameId && finishedGameState && finishedGameState.gameId === winnerDeclared.gameId) {
          // UI is locked to finished state - don't update
          if (isInitialLoad) {
            setLoading(false);
          }
          return;
        }
        
        // Check stop flag again after async operations
        if (shouldStopPolling.current || waitingForContractConfirmation) {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          if (isInitialLoad) {
            setLoading(false);
          }
          return;
        }
        
        // Update currentGameId first
        setCurrentGameId((prevId) => {
          if (prevId !== gameIdNum) {
            // If gameId changed, clear stale game status and start info to prevent showing players from previous games
            if (prevId > 0 && gameIdNum !== prevId) {
              console.log(`GameId changed from ${prevId} to ${gameIdNum}, clearing stale data`);
              setGameStatus(null);
              setGameStartInfo(null);
            }
            return gameIdNum;
          }
          return prevId;
        });
        
        // Update game start info - only if gameId matches (startInfo is always for current game)
        setGameStartInfo((prevInfo) => {
          if (!prevInfo || JSON.stringify(prevInfo) !== JSON.stringify(startInfo)) {
            return startInfo;
          }
          return prevInfo;
        });
        
        // Always fetch players from events FIRST for current game to cross-reference with API data
        // This ensures we only show players who actually joined the current game
        // CRITICAL: Fetch events BEFORE updating gameStatus to prevent showing stale players
        if (gameIdNum > 0 && (status?.gameState === "NotStarted" || status?.gameState === "InProgress")) {
          try {
            console.log(`[AGENTS DEBUG] Fetching players from events for gameId ${gameIdNum}...`);
            const players = await getPlayersFromEvents(gameIdNum);
            console.log(`[AGENTS DEBUG] Fetched ${players.length} players from events:`, players);
            setPlayersFromEvents((prevPlayers) => {
              // Only update if players list changed
              if (JSON.stringify(prevPlayers) !== JSON.stringify(players)) {
                console.log(`[AGENTS DEBUG] Updated playersFromEvents: ${prevPlayers.length} -> ${players.length}`);
                return players;
              }
              return prevPlayers;
            });
          } catch (error) {
            console.error(`[AGENTS DEBUG] Error fetching players from events for gameId ${gameIdNum}:`, error);
            // Don't clear existing players on error, keep what we have
          }
        } else {
          // Clear players from events if game is finished or no gameId
          setPlayersFromEvents((prevPlayers) => {
            if (prevPlayers.length > 0) {
              console.log(`[AGENTS DEBUG] Clearing playersFromEvents (game finished or no gameId)`);
              return [];
            }
            return prevPlayers;
          });
        }
        
        // Update state if data actually changed AND gameId matches
        // CRITICAL: Only use gameStatus if gameId matches currentGameId to prevent showing players from previous games
        setGameStatus((prevStatus) => {
          // Verify gameId matches before updating
          if (status?.gameId && gameIdNum > 0 && status.gameId !== gameIdNum) {
            console.warn(`[AGENTS DEBUG] Ignoring gameStatus with mismatched gameId: API gameId ${status.gameId} != currentGameId ${gameIdNum}`);
            return prevStatus; // Keep previous status if gameId doesn't match
          }
          
          // Log API players data
          if (status?.players) {
            console.log(`[AGENTS DEBUG] API returned ${status.players.length} players for gameId ${status.gameId}:`, 
              status.players.map(p => ({ address: p.address, chipBalance: p.chipBalance })));
          }
          
          // Compare game status to detect changes
          if (!prevStatus || JSON.stringify(prevStatus) !== JSON.stringify(status)) {
            console.log(`[AGENTS DEBUG] Updating gameStatus: gameId=${status?.gameId}, players=${status?.players?.length || 0}`);
            return status as GameStatus;
          }
          return prevStatus;
        });
      } catch (error) {
        console.error("Error fetching data:", error);
        // Only set to null on initial load error
        if (isInitialLoad) {
          setGameStatus(null);
          setCurrentGameId(0);
          setPlayersFromEvents([]);
        }
      } finally {
        if (isInitialLoad) {
          setLoading(false);
          isInitialLoad = false;
        }
      }
    }

    fetchData();
    // Poll every 5 seconds for updates
    intervalId = setInterval(() => {
      // Check ref and state before each poll
      if (shouldStopPolling.current || waitingForContractConfirmation) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }
      fetchData();
    }, 5000);
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [isGameStarted, waitingForContractConfirmation]);

  // Function to check for winner confirmation from contract
  // Uses both GameFinalized event and past games to find the winner
  const checkForWinnerConfirmation = async (gameId: number) => {
    if (winnerDeclared.declared && winnerDeclared.gameId === gameId) return; // Already declared for this game
    
    try {
      // Method 1: Check GameFinalized event
      const finalizedEvent = await getGameFinalizedEvent(gameId);
      if (finalizedEvent) {
        const poolAmount = ethers.formatEther(finalizedEvent.potPaid);
        const formattedAmount = parseFloat(poolAmount).toFixed(2);
        
        setWinnerData({
          address: finalizedEvent.winner,
          poolAmount: formattedAmount
        });
        
        // Set winner declared with gameId - NEVER clear finishedGameState so UI never resets
        setWinnerDeclared({ declared: true, gameId: gameId });
        confettiTriggered.current = false;
        setWaitingForContractConfirmation(false);
        // DO NOT clear finishedGameState - keep it so UI always shows finished state
        shouldStopPolling.current = false; // Reset stop flag to allow polling to resume
        
        console.log('Winner confirmed from GameFinalized event:', finalizedEvent);
        return;
      }
      
      // Method 2: Check past games - use gameId - 1 as index (gameId is 1-indexed, array is 0-indexed)
      try {
        const pastGameIndex = gameId - 1; // gameId 1 = index 0, gameId 2 = index 1, etc.
        const pastGame = await getPastGame(pastGameIndex);
        if (Number(pastGame.gameId) === gameId && pastGame.winner && pastGame.winner !== ethers.ZeroAddress) {
          // Found the game in past games with a winner!
          const poolAmount = ethers.formatEther(pastGame.potPaid);
          const formattedAmount = parseFloat(poolAmount).toFixed(2);
          
          setWinnerData({
            address: pastGame.winner,
            poolAmount: formattedAmount
          });
          
          // Set winner declared with gameId - NEVER clear finishedGameState so UI never resets
          setWinnerDeclared({ declared: true, gameId: gameId });
          confettiTriggered.current = false;
          setWaitingForContractConfirmation(false);
          // DO NOT clear finishedGameState - keep it so UI always shows finished state
          shouldStopPolling.current = false; // Reset stop flag to allow polling to resume
          
          console.log('Winner confirmed from past games (index', pastGameIndex, '):', pastGame);
          return;
        }
      } catch (error) {
        console.error(`Error checking past game at index ${gameId - 1}:`, error);
        // If direct index fails, try searching all past games as fallback
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
                
                // Set winner declared with gameId - NEVER clear finishedGameState so UI never resets
                setWinnerDeclared({ declared: true, gameId: gameId });
                confettiTriggered.current = false;
                setWaitingForContractConfirmation(false);
                // DO NOT clear finishedGameState - keep it so UI always shows finished state
                shouldStopPolling.current = false; // Reset stop flag to allow polling to resume
                
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
  };

  // Use finishedGameState if waiting for confirmation OR if winner is already declared
  // This prevents UI from resetting when new game starts before contract confirms winner
  // ONCE WINNER IS DECLARED, NEVER RESET - always show finished game state
  const displayGameStatus = (winnerDeclared.declared && winnerDeclared.gameId && finishedGameState && finishedGameState.gameId === winnerDeclared.gameId)
    ? finishedGameState.gameStatus
    : (waitingForContractConfirmation && finishedGameState)
    ? finishedGameState.gameStatus
    : gameStatus;

  // Monitor bid changes and fetch bid log when bid changes
  useEffect(() => {
    // STOP polling if waiting for winner confirmation
    if (waitingForContractConfirmation) {
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

  // Format time as MM:SS
  const formatTime = (seconds: number | null): string => {
    if (seconds === null || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };
    
  const start = isGameStarted || displayGameStatus?.gameState === "InProgress";
  const winnerDeclaredCheck = isWinnerDeclared || winnerDeclared.declared || displayGameStatus?.gameState === "Finished"; // Check if winner is declared (game finished)
  
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
  // Only trigger if isWinnerDeclared toggle is true
  useEffect(() => {
    // Reset winner state when toggle is false (but only if it was set by toggle, not by actual game)
    if (!isWinnerDeclared && winnerDeclared.declared && !finishedGameState) {
      setWinnerDeclared({ declared: false, gameId: null });
      setWinnerData(null);
      confettiTriggered.current = false;
      return;
    }
    
    // Only show if toggle is explicitly true - don't show if false
    if (isWinnerDeclared && !winnerDeclared.declared && !confettiTriggered.current) {
      // Set winner data (using dummy data for now)
      const dummyWinner = {
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        poolAmount: "1250.00"
      };
      setWinnerData(dummyWinner);
      setWinnerDeclared({ declared: true, gameId: currentGameId || null });
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
  }, [isWinnerDeclared, winnerDeclared]);

  // Poll for winner confirmation when waiting
  useEffect(() => {
    // Skip if using dummy data or winner already declared
    if (isGameStarted || isWinnerDeclared || winnerDeclared.declared || !waitingForContractConfirmation || !finishedGameState) {
      // Clear any existing polling interval
      if (winnerPollingInterval.current) {
        clearInterval(winnerPollingInterval.current);
        winnerPollingInterval.current = null;
      }
      return;
    }
    
    // Start polling for winner confirmation every 3 seconds
    const pollForWinner = async () => {
      await checkForWinnerConfirmation(finishedGameState.gameId);
    };
    
    // Poll immediately, then every 3 seconds
    pollForWinner();
    winnerPollingInterval.current = setInterval(pollForWinner, 3000);
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (winnerPollingInterval.current) {
        clearInterval(winnerPollingInterval.current);
        winnerPollingInterval.current = null;
      }
    };
  }, [waitingForContractConfirmation, finishedGameState, isGameStarted, isWinnerDeclared]);

  // Reset winner state when game is no longer Finished (new game started)
  useEffect(() => {
    // Only reset if not using dummy data and winner was declared
    if (isGameStarted || isWinnerDeclared) {
      return;
    }
    
    // If game state is not "Finished" but winner was declared, reset it
    // This happens when a new game starts after a finished game
    if (winnerDeclared.declared && displayGameStatus?.gameState && displayGameStatus.gameState !== "Finished") {
      console.log('Game state changed from Finished, resetting winner state');
      setWinnerDeclared({ declared: false, gameId: null });
      setWinnerData(null);
      setFinishedGameState(null);
      setWaitingForContractConfirmation(false);
      confettiTriggered.current = false;
    }
  }, [displayGameStatus?.gameState, isGameStarted, isWinnerDeclared, winnerDeclared.declared]);
  
  // Function to manually test winner modal with dummy data (for testing)
  const testWinnerModal = () => {
    const dummyWinner = {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      poolAmount: "1250.00"
    };
    setWinnerData(dummyWinner);
    setWinnerDeclared({ declared: true, gameId: currentGameId || null });
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

  // Convert API players data to agents data format - memoized with specific dependencies
  // IMPORTANT: Cross-reference with contract events to ensure we only show players from current game
  const agentsData = useMemo(() => {
    console.log(`[AGENTS DEBUG] agentsData useMemo triggered:`, {
      start,
      gameStatusPlayers: gameStatus?.players?.length || 0,
      gameStatusGameId: gameStatus?.gameId,
      currentGameId,
      playersFromEventsCount: playersFromEvents.length,
      gameStartInfoPlayers: gameStartInfo?.playersJoined?.length || 0
    });
    
    // If game is in progress, use API players from gameStatus
    // CRITICAL: Only use if gameId matches currentGameId AND cross-reference with contract events
    if (start && gameStatus?.players && gameStatus.players.length > 0) {
      // Verify gameId matches before using players
      if (gameStatus.gameId && currentGameId > 0 && gameStatus.gameId !== currentGameId) {
        console.warn(`[AGENTS DEBUG] GameId mismatch: API gameId ${gameStatus.gameId} != currentGameId ${currentGameId}, returning empty agents`);
        return [];
      }
      
      // CRITICAL: Don't show agents until we have contract events to cross-reference
      // This prevents showing stale players from previous games
      if (playersFromEvents.length === 0) {
        console.log(`[AGENTS DEBUG] No contract events available yet for gameId ${currentGameId}, waiting... (API has ${gameStatus.players.length} players)`);
        return []; // Return empty until we have events
      }
      
      // Cross-reference with contract events to get actual players for current game
      // Only show players that are in both API response AND contract events
      const apiPlayerAddresses = new Set(
        gameStatus.players
          .filter((p) => p.address && typeof p.address === 'string' && p.address !== '0x0000000000000000000000000000000000000000')
          .map((p) => p.address.toLowerCase())
      );
      
      const eventPlayerAddresses = new Set(playersFromEvents.map(addr => addr.toLowerCase()));
      const validPlayerAddresses = new Set(
        Array.from(apiPlayerAddresses).filter(addr => eventPlayerAddresses.has(addr))
      );
      
      console.log(`[AGENTS DEBUG] Cross-referencing players:`, {
        apiPlayers: Array.from(apiPlayerAddresses),
        eventPlayers: Array.from(eventPlayerAddresses),
        validPlayers: Array.from(validPlayerAddresses),
        apiCount: apiPlayerAddresses.size,
        eventCount: eventPlayerAddresses.size,
        validCount: validPlayerAddresses.size
      });
      
      // Filter players to only those verified by contract events
      const validPlayers = gameStatus.players.filter((player) => {
        if (!player.address || typeof player.address !== 'string') {
          console.log(`[AGENTS DEBUG] Filtering out player - invalid address:`, player.address);
          return false;
        }
        if (player.address === '0x0000000000000000000000000000000000000000') {
          console.log(`[AGENTS DEBUG] Filtering out player - zero address`);
          return false;
        }
        // Must be in valid player addresses set (in contract events)
        if (!validPlayerAddresses.has(player.address.toLowerCase())) {
          console.warn(`[AGENTS DEBUG] Filtering out player ${player.address} (chipBalance: ${player.chipBalance}) - NOT in contract events for gameId ${currentGameId}`);
          return false;
        }
        // Chip balance should be between 0 and 500 (starting chips)
        const chipBalance = player.chipBalance || 0;
        if (chipBalance < 0 || chipBalance > 500) {
          console.warn(`[AGENTS DEBUG] Filtering out player ${player.address} with invalid chipBalance: ${chipBalance}`);
          return false;
        }
        console.log(`[AGENTS DEBUG] Keeping valid player: ${player.address} (chipBalance: ${chipBalance})`);
        return true;
      });
      
      console.log(`[AGENTS DEBUG] Final filtered players: ${gameStatus.players.length} -> ${validPlayers.length} (gameId: ${gameStatus.gameId}, currentGameId: ${currentGameId})`);
      console.log(`[AGENTS DEBUG] Valid players:`, validPlayers.map(p => ({ address: p.address, chipBalance: p.chipBalance })));
      
      return validPlayers
        .map((player) => ({
        walletAddress: String(player.address || ''), // Ensure it's always a string
        chipsLeft: player.chipBalance || 0,
        cards: (player.cards || []).map((card: any) => {
          // Handle both direct card format and raw format from API
          const cardData = card.raw || card;
          // Extract priceBought from API - this is the price paid in the auction
          const priceBought = card.priceBought || 0;
          return {
            ...cardData,
            name: cardData.name || card.name,
            image: cardData.image || card.image,
            attack: cardData.attack || card.attack || 0,
            defense: cardData.defense || card.defense || 0,
            strategist: cardData.strategist || card.strategist || 0,
            type: card.type || cardData.type || "sentinel",
            description: cardData.description || card.description || "",
            chipsRequired: priceBought, // Use priceBought from API to show price paid
          };
        }),
      }));
    }
    
    // If game is not started, use players from API (gameStartInfo.playersJoined)
    // Cross-reference with contract events to ensure accuracy
    if (!start && gameStartInfo?.playersJoined && gameStartInfo.playersJoined.length > 0) {
      // Only use if we have a valid currentGameId (game exists)
      if (currentGameId > 0) {
        // CRITICAL: Wait for contract events if available, otherwise use API but log warning
        let validAddresses = gameStartInfo.playersJoined;
        if (playersFromEvents.length > 0) {
          const eventAddresses = new Set(playersFromEvents.map(addr => addr.toLowerCase()));
          validAddresses = gameStartInfo.playersJoined.filter(addr => 
            addr && typeof addr === 'string' && 
            addr !== '0x0000000000000000000000000000000000000000' &&
            eventAddresses.has(addr.toLowerCase())
          );
          console.log(`[AGENTS DEBUG] Cross-referenced startInfo players: API=${gameStartInfo.playersJoined.length}, Events=${playersFromEvents.length}, Valid=${validAddresses.length}`);
        } else {
          // Filter out invalid addresses and limit to max 5 players (game limit)
          validAddresses = gameStartInfo.playersJoined
            .filter((address) => {
              if (!address || typeof address !== 'string') return false;
              if (address === '0x0000000000000000000000000000000000000000') return false;
              return true;
            })
            .slice(0, 5); // Limit to 5 players max
          console.warn(`[AGENTS DEBUG] No contract events for gameId ${currentGameId}, using API data (may include stale players)`);
        }
        
        console.log(`[AGENTS DEBUG] gameStartInfo players: ${gameStartInfo.playersJoined.length} -> ${validAddresses.length} (currentGameId: ${currentGameId})`);
        
        return validAddresses
          .map((address) => ({
          walletAddress: String(address || ''), // Ensure it's always a string
          chipsLeft: 500, // Default starting chips
          cards: [],
        }));
      }
    }
    
    // Return empty array if no API data available
    console.log(`[AGENTS DEBUG] No agents data available, returning empty array`);
    return [];
  }, [displayGameStatus?.players, displayGameStatus?.gameState, displayGameStatus?.gameId, gameStartInfo?.playersJoined, start, currentGameId, gameStatus, playersFromEvents]);

  // Get members and pool - use agentsData.length (filtered list) instead of raw API data
  // This ensures we only count valid players from the current game
  const membersJoined = agentsData.length;
  
  // Calculate total pool: always calculate from spent chips (increases as game progresses)
  const totalPool = agentsData.reduce((sum, agent) => {
    const startingChips = 500;
    const spent = startingChips - agent.chipsLeft;
    return sum + spent;
  }, 0);

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
      {/* Winner Modal - Show when winner is declared AND game is currently Finished */}
      {(isWinnerDeclared || (winnerDeclared.declared && displayGameStatus?.gameState === "Finished")) && winnerData && (
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
                setWinnerDeclared({ declared: false, gameId: null });
                setWinnerData(null);
                confettiTriggered.current = false;
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
      {/* Winner Modal - Show when winner is declared AND game is currently Finished */}
      {(isWinnerDeclared || (winnerDeclared.declared && displayGameStatus?.gameState === "Finished")) && winnerData && (
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
                setWinnerDeclared({ declared: false, gameId: null });
                setWinnerData(null);
                confettiTriggered.current = false;
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
                                  chipsRequired={card.chipsRequired}
                                  isSmall={true}
                                  tagPosition="bottom-center"
                                  tagColor="green"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
              <div className="flex items-center justify-center">
                <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                  Game is Yet to Start
                </p>
              </div>
            ) : displayGameStatus?.currentCard ? (
              <div className="flex flex-col items-center justify-center w-full">
                <div className="w-80">
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
