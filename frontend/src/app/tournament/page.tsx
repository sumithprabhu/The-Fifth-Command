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
import { getGameStatus, getGameStartInfo, GameStartInfo } from "@/lib/api";
import { getCurrentGameId, getPlayersFromEvents, getGameFinalizedEvent } from "@/lib/contract";
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
  const [winnerDeclared, setWinnerDeclared] = useState(false);
  const [winnerData, setWinnerData] = useState<{ address: string; poolAmount: string } | null>(null);
  const confettiTriggered = useRef(false);
  const winnerPollingInterval = useRef<NodeJS.Timeout | null>(null);
  const [chatMessages, setChatMessages] = useState([
    { id: 1, user: "Agent Alpha", message: "Good luck everyone!" },
    { id: 2, user: "Agent Beta", message: "Let's go!" },
  ]);

  const primaryColor = "#c28ff3";
  
  // Fetch game status from API and currentGameId from contract
  useEffect(() => {
    // Skip API fetch if isGameStarted toggle is true (using dummy data)
    if (isGameStarted) {
      return;
    }
    
    let isInitialLoad = true;
    
    async function fetchData() {
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
        
        // Update game start info
        setGameStartInfo((prevInfo) => {
          if (!prevInfo || JSON.stringify(prevInfo) !== JSON.stringify(startInfo)) {
            return startInfo;
          }
          return prevInfo;
        });
        
        // Only update state if data actually changed
        setGameStatus((prevStatus) => {
          // Compare game status to detect changes
          if (!prevStatus || JSON.stringify(prevStatus) !== JSON.stringify(status)) {
            return status as GameStatus;
          }
          return prevStatus;
        });
        
        setCurrentGameId((prevId) => {
          if (prevId !== gameIdNum) {
            return gameIdNum;
          }
          return prevId;
        });
        
        // If game is not started, fetch players from events
        if (status?.gameState === "NotStarted" && gameIdNum > 0) {
          const players = await getPlayersFromEvents(gameIdNum);
          setPlayersFromEvents((prevPlayers) => {
            // Only update if players list changed
            if (JSON.stringify(prevPlayers) !== JSON.stringify(players)) {
              return players;
            }
            return prevPlayers;
          });
        } else {
          setPlayersFromEvents((prevPlayers) => {
            if (prevPlayers.length > 0) {
              return [];
            }
            return prevPlayers;
          });
        }
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
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [isGameStarted]);

  const start = isGameStarted || gameStatus?.gameState === "InProgress";
  const winnerDeclaredCheck = isWinnerDeclared || gameStatus?.gameState === "Finished"; // Check if winner is declared (game finished)
  
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
    // Reset winner state when toggle is false
    if (!isWinnerDeclared) {
      setWinnerDeclared(false);
      setWinnerData(null);
      confettiTriggered.current = false;
      return;
    }
    
    // Only show if toggle is explicitly true - don't show if false
    if (isWinnerDeclared && !winnerDeclared && !confettiTriggered.current) {
      // Set winner data (using dummy data for now)
      const dummyWinner = {
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        poolAmount: "1250.00"
      };
      setWinnerData(dummyWinner);
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
    if (!isWinnerDeclared && gameStatus?.gameState === "Finished" && !winnerDeclared && !confettiTriggered.current) {
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
  
  // Poll for GameFinalized event when game state is "Finished"
  useEffect(() => {
    // Skip if using dummy data or winner already declared
    if (isGameStarted || isWinnerDeclared || winnerDeclared) {
      // Clear any existing polling interval
      if (winnerPollingInterval.current) {
        clearInterval(winnerPollingInterval.current);
        winnerPollingInterval.current = null;
      }
      return;
    }
    
    // Only poll if game state is "Finished"
    if (gameStatus?.gameState !== "Finished" || !gameStatus?.gameId) {
      // Clear any existing polling interval
      if (winnerPollingInterval.current) {
        clearInterval(winnerPollingInterval.current);
        winnerPollingInterval.current = null;
      }
      return;
    }
    
    // Start polling for GameFinalized event every 3 seconds
    const pollForWinner = async () => {
      try {
        const finalizedEvent = await getGameFinalizedEvent(gameStatus.gameId);
        
        if (finalizedEvent) {
          // Event found! Stop polling and trigger winner modal
          if (winnerPollingInterval.current) {
            clearInterval(winnerPollingInterval.current);
            winnerPollingInterval.current = null;
          }
          
          // Format potPaid amount in FIF (show potPaid value for Won Pool Amount)
          console.log('GameFinalized event data:', {
            gameId: finalizedEvent.gameId.toString(),
            winner: finalizedEvent.winner,
            potPaid: finalizedEvent.potPaid.toString(),
            potCarriedOver: finalizedEvent.potCarriedOver.toString()
          });
          
          const poolAmount = ethers.formatEther(finalizedEvent.potPaid);
          console.log('Formatted potPaid:', poolAmount);
          
          // Set winner data
          const formattedAmount = parseFloat(poolAmount).toFixed(2);
          console.log('Setting winner data with poolAmount:', formattedAmount);
          
          setWinnerData({
            address: finalizedEvent.winner,
            poolAmount: formattedAmount
          });
          
          setWinnerDeclared(true);
          confettiTriggered.current = false; // Reset to trigger confetti
        }
      } catch (error) {
        console.error("Error polling for GameFinalized event:", error);
      }
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
  }, [gameStatus?.gameState, gameStatus?.gameId, isGameStarted, isWinnerDeclared, winnerDeclared]);
  
  // Function to manually test winner modal with dummy data (for testing)
  const testWinnerModal = () => {
    const dummyWinner = {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      poolAmount: "1250.00"
    };
    setWinnerData(dummyWinner);
    setWinnerDeclared(true);
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
  const shortenAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get current bid from API
  const currentBid = gameStatus?.highestBid?.amount || 0;
  const currentBidder = gameStatus?.highestBid?.bidder 
    ? shortenAddress(gameStatus.highestBid.bidder) 
    : "No bidder";
  
  // Get past bid from auctionedCards (last auctioned card)
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

  // Bidding data for ticker from auctionedCards
  const biddingData = useMemo(() => {
    if (!gameStatus?.auctionedCards || gameStatus.auctionedCards.length === 0) {
      return [];
    }
    
    return gameStatus.auctionedCards
      .filter((auctioned: any) => auctioned.winner) // Only show cards with winners
      .map((auctioned: any) => {
        const card = auctioned.card || auctioned.card?.raw || {};
        const cardType = (card.type || card.raw?.type || "SENTINEL").toUpperCase();
        const winner = auctioned.winner ? shortenAddress(auctioned.winner) : "Unknown";
        const price = auctioned.bidAmount ? `$${(auctioned.bidAmount / 100).toFixed(2)}` : "$0.00";
        
        return {
          card: cardType,
          player: winner,
          action: "BOUGHT",
          price: price,
        };
      })
      .reverse(); // Show most recent first
  }, [gameStatus?.auctionedCards]);

  // Get members and pool from API start-info
  // Use gameStartInfo.playersJoined.length for agents playing
  const membersJoined = gameStartInfo?.playersJoined.length || (start 
    ? (gameStatus?.players.length || 0)
    : playersFromEvents.length);
  
  // Calculate total pool: playersJoined.length * 10 FIF
  const totalPool = gameStartInfo?.playersJoined.length 
    ? gameStartInfo.playersJoined.length * 10 
    : (gameStatus?.players.reduce((sum, p) => {
        const startingChips = 500;
        const spent = startingChips - (p.chipBalance || 0);
        return sum + spent;
      }, 0) || 0);

  // Convert API players data or event players to agents data format - memoized with specific dependencies
  const agentsData = useMemo(() => {
    // If game is in progress, use API players
    if (start && gameStatus?.players) {
      return gameStatus.players.map((player) => ({
        walletAddress: player.address,
        pointsLeft: player.chipBalance || 0,
        cards: (player.cards || []).map((card: any) => {
          // Handle both direct card format and raw format from API
          const cardData = card.raw || card;
          return {
            ...cardData,
            name: cardData.name || card.name,
            image: cardData.image || card.image,
            attack: cardData.attack || card.attack || 0,
            defense: cardData.defense || card.defense || 0,
            strategist: cardData.strategist || card.strategist || 0,
            type: card.type || cardData.type || "sentinel",
            description: cardData.description || card.description || "",
            pointsRequired: 0, // API doesn't provide this, can be calculated if needed
          };
        }),
      }));
    }
    
    // If game is not started, use players from events
    if (!start && playersFromEvents.length > 0) {
      return playersFromEvents.map((address) => ({
        walletAddress: address,
        pointsLeft: 500, // Default starting chips
        cards: [],
      }));
    }
    
    return [];
  }, [gameStatus?.players, gameStatus?.gameState, playersFromEvents, start]);

  // Calculate remaining cards from API - group by type - memoized with specific dependencies
  const remainingCardsData = useMemo(() => {
    if (!gameStatus || gameStatus.gameState === "NotStarted") {
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
    
    // Add cards from auctionedCards that have winners
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

    if (gameStatus.remainingCards) {
      gameStatus.remainingCards.forEach((card: any) => {
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
  }, [gameStatus?.remainingCards, gameStatus?.players, gameStatus?.auctionedCards, gameStatus?.gameState]);

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
      {/* Winner Modal - Only show when isWinnerDeclared is true */}
      {isWinnerDeclared && winnerDeclared && winnerData && (
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
                  {winnerData.poolAmount} FIF
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setWinnerDeclared(false);
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
      {/* Winner Modal - Only show when isWinnerDeclared is true */}
      {isWinnerDeclared && winnerDeclared && winnerData && (
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
                  {winnerData.poolAmount} FIF
                </p>
              </div>
            </div>
            
            <button
              onClick={() => {
                setWinnerDeclared(false);
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
              {biddingData.map((bid, index) => (
                <div key={index} className="flex items-center mx-8">
                  <span className="text-white font-bold mr-4">{bid.card}</span>
                  <span className="text-white mr-4">{bid.player}</span>
                  <span className="mr-4 font-bold" style={{ color: bid.action === 'BOUGHT' ? '#4ade80' : bid.action === 'PLAY' ? '#f97316' : '#ef4444' }}>
                    {bid.action}
                  </span>
                  <span className="text-white font-bold">{bid.price}</span>
                  <span className="text-white mx-4">•</span>
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
                <p className="text-lg font-bold text-white whitespace-nowrap">Pool: {totalPool} FIF</p>
              </div>
            </div>
          </div>

          {/* Scrollable Container for Agents and Card Sets */}
          <div className="flex-1 overflow-y-auto overflow-x-visible rounded-lg p-6 pb-0 custom-scrollbar" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            {/* Agents Section */}
            <p className="text-white mb-4 font-bold">Agents</p>
            {loading && !gameStatus && !playersFromEvents.length ? (
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
                        {agent.pointsLeft}/500
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
                                  pointsRequired={card.pointsRequired || 0}
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
            ) : gameStatus?.currentCard ? (
              <div className="flex flex-col items-center justify-center w-full">
                <div className="w-80">
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
                  {/* Current Bid - Center */}
                  <div className="flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <p className="text-lg font-bold text-white uppercase tracking-wider">
                        Current Bid
                      </p>
                      <div className="flex items-center justify-center">
                        <div className="text-4xl font-bold text-white">
                          <SlotCounter
                            value={currentBid}
                            duration={2}
                            startValue={0}
                            useMonospaceWidth={true}
                          />
                        </div>
                        <span className="text-2xl font-semibold text-gray-400 ml-2">pts</span>
                      </div>
                      <p className="text-sm text-gray-300 mt-2">
                        <span className="text-gray-400">Current Bidder:</span>{" "}
                        <span className="text-white font-semibold">{currentBidder}</span>
                      </p>
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
                            value={remainingCards}
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
          <div className="rounded-lg flex flex-col h-full" style={{ backgroundColor: '#1a1a1a', border: `2px solid ${primaryColor}` }}>
            <div className="flex-shrink-0 p-4 border-b" style={{ borderColor: primaryColor }}>
              <h3 className="text-lg font-bold text-white">Chat</h3>
            </div>
            
            {/* Chat Messages - Scrollable, messages from bottom */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse min-h-0">
              {chatMessages.slice().reverse().map((msg) => (
                <div key={msg.id} className="mb-3 flex-shrink-0">
                  <p className="text-xs font-bold mb-1" style={{ color: primaryColor }}>{msg.user}</p>
                  <p className="text-sm text-white">{msg.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
