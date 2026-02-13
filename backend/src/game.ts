import fs from "fs";
import path from "path";
import { BigNumber, ethers } from "ethers";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./logger";
import { onContractUpdated } from "./contract";
import { clearChat } from "./chat";
import {
  BidEntry,
  BidMessage,
  Card,
  GameEngineDeps,
  GameState,
  GameStatus,
  HighestBidPublic,
  PlayerInfo,
  PowerComputation
} from "./types";

const MIN_INCREMENT = 10; // chips
const ROUND_TIMEOUT_MS = 120_000; // 2 minutes
const GAME_START_COUNTDOWN_MS = 3 * 60_000; // 3 minutes
const BID_MESSAGE_MAX_AGE_MS = 5 * 60_000; // 5 minutes

// EIP-712 typed data
const BID_DOMAIN_NAME = "TheFifthCommandAuction";
const BID_DOMAIN_VERSION = "1";

let ioInstance: SocketIOServer | null = null;
let contractInstance: ethers.Contract | null = null;
let lastContractInstance: ethers.Contract | null = null;
let chainIdCached: number | null = null;

interface InternalState {
  gameId: number;
  gameState: GameState;
  players: Set<string>;
  currentRound: number;
  totalCards: number;
  revealedCards: Card[];
  currentCardIndex: number;
  highestBid: {
    amount: number;
    bidder: string | null;
  };
  bidLogs: Record<number, Record<number, BidEntry[]>>;
  usedNonces: Record<string, Set<string>>;
  wonCards: Record<string, Card[]>;
  cardPrices: Record<number, number>; // cardId -> chips paid
  roundTimeoutHandle: NodeJS.Timeout | null;
  roundTimeoutEndsAt: number | null; // Timestamp when round timeout will trigger
  gameStartTimeoutHandle: NodeJS.Timeout | null;
  gameStartTimeoutEndsAt: number | null; // Timestamp when game will start after countdown
  minPlayersRequired: number; // Tracks the min players requirement
  waitingPlayers: string[]; // Players who joined while waiting for game start
}

const state: InternalState = {
  gameId: 0,
  gameState: "NotStarted",
  players: new Set(),
  currentRound: 0,
  totalCards: 0,
  revealedCards: [],
  currentCardIndex: -1,
  highestBid: {
    amount: 0,
    bidder: null
  },
  bidLogs: {},
  usedNonces: {},
  wonCards: {},
  cardPrices: {},
  roundTimeoutHandle: null,
  roundTimeoutEndsAt: null,
  gameStartTimeoutHandle: null,
  gameStartTimeoutEndsAt: null,
  minPlayersRequired: 1,
  waitingPlayers: []
};

let allCards: Card[] = [];

function loadCards(): Card[] {
  if (allCards.length > 0) return allCards;

  const filePath = path.join(__dirname, "..", "cards.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as {
    sentinel: any[];
    attacker: any[];
    defender: any[];
    strategist: any[];
  };

  const flattenType = (arr: any[] | undefined, type: Card["type"]): Card[] =>
    (arr || []).map((c) => ({
      id: c.characterId,
      name: c.name,
      image: c.image,
      type,
      attack: Number(c.attack) || 0,
      defense: Number(c.defense) || 0,
      strategist: Number(c.strategist) || 0,
      raw: c
    }));

  allCards = [
    ...flattenType(data.sentinel, "sentinel"),
    ...flattenType(data.attacker, "attacker"),
    ...flattenType(data.defender, "defender"),
    ...flattenType(data.strategist, "strategist")
  ];

  return allCards;
}

function shuffle<T>(array: T[]): T[] {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function calculateTotalCardsNeeded(playerCount: number): number {
  // Formula: x = number of teams (players)
  // Sentinels = x / 2
  // Attackers = x × 2
  // Defenders = x × 2
  // Strategists = x
  // Total = (x/2) + (x*2) + (x*2) + x = x/2 + 5x = 5.5x
  // Round up sentinels: ceil(x/2)
  const sentinels = Math.ceil(playerCount / 2);
  const attackers = playerCount * 2;
  const defenders = playerCount * 2;
  const strategists = playerCount;
  return sentinels + attackers + defenders + strategists;
}

function selectCardsByType(totalNeeded: number): Card[] {
  const all = loadCards();
  
  // Calculate how many of each type we need
  const playerCount = Math.ceil(totalNeeded / 5.5);
  const sentinelsNeeded = Math.ceil(playerCount / 2); // Approximate distribution
  const attackersNeeded = playerCount * 2;
  const defendersNeeded = playerCount * 2;
  const strategistsNeeded = playerCount;
  
  // Group cards by type
  const byType: Record<string, Card[]> = {
    sentinel: [],
    attacker: [],
    defender: [],
    strategist: []
  };
  
  for (const card of all) {
    if (byType[card.type]) {
      byType[card.type].push(card);
    }
  }
  
  // Select and shuffle from each type in order
  const result: Card[] = [];
  
  // Add sentinels
  if (byType.sentinel.length > 0) {
    const sentinels = shuffle(byType.sentinel).slice(0, sentinelsNeeded);
    result.push(...sentinels);
  }
  
  // Add attackers
  if (byType.attacker.length > 0) {
    const attackers = shuffle(byType.attacker).slice(0, attackersNeeded);
    result.push(...attackers);
  }
  
  // Add defenders
  if (byType.defender.length > 0) {
    const defenders = shuffle(byType.defender).slice(0, defendersNeeded);
    result.push(...defenders);
  }
  
  // Add strategists
  if (byType.strategist.length > 0) {
    const strategists = shuffle(byType.strategist).slice(0, strategistsNeeded);
    result.push(...strategists);
  }
  
  return result; // Return in sequence: sentinels, attackers, defenders, strategists
}

async function getChainId(): Promise<number> {
  if (!contractInstance) {
    throw new Error("Contract not initialized");
  }
  if (chainIdCached) return chainIdCached;
  const network = await contractInstance.provider.getNetwork();
  const value = (network.chainId as any)?.toNumber
    ? (network.chainId as any).toNumber()
    : Number(network.chainId);
  chainIdCached = value;
  return value;
}

async function getBidDomain() {
  const chainId = await getChainId();
  if (!contractInstance) {
    throw new Error("Contract not initialized");
  }
  return {
    name: BID_DOMAIN_NAME,
    version: BID_DOMAIN_VERSION,
    chainId,
    verifyingContract: contractInstance.address
  };
}

function getBidTypes() {
  return {
    Bid: [
      { name: "bidder", type: "address" },
      { name: "gameId", type: "uint256" },
      { name: "round", type: "uint256" },
      { name: "cardId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "timestamp", type: "uint256" },
      { name: "nonce", type: "uint256" }
    ]
  } as const;
}

function ensureBidLog(gameId: number, round: number): BidEntry[] {
  if (!state.bidLogs[gameId]) state.bidLogs[gameId] = {};
  if (!state.bidLogs[gameId][round]) state.bidLogs[gameId][round] = [];
  return state.bidLogs[gameId][round];
}

function resetRoundTimeout() {
  if (state.roundTimeoutHandle) {
    clearTimeout(state.roundTimeoutHandle);
    state.roundTimeoutHandle = null;
  }
  
  if (state.gameState !== "InProgress") return;

  // Determine timeout duration: 2 minutes if this is the initial setup, 30 seconds if extending due to a bid
  let timeoutDuration = ROUND_TIMEOUT_MS; // 2 minutes for new round
  
  if (state.roundTimeoutEndsAt !== null) {
    // There was already a timeout running, extend by 30 seconds instead
    timeoutDuration = 30_000; // 30 seconds
  }

  const timeoutEndsAt = Date.now() + timeoutDuration;
  state.roundTimeoutEndsAt = timeoutEndsAt;

  state.roundTimeoutHandle = setTimeout(() => {
    state.roundTimeoutEndsAt = null;
    endRound().catch((err) => {
      logger.error({ err }, "endRound failed from timeout");
    });
  }, timeoutDuration);
}

function resetGameStartTimeout(): void {
  if (state.gameStartTimeoutHandle) {
    clearTimeout(state.gameStartTimeoutHandle);
    state.gameStartTimeoutHandle = null;
  }
  state.gameStartTimeoutEndsAt = null;
}

function getCurrentCard(): Card | null {
  if (
    state.currentCardIndex < 0 ||
    state.currentCardIndex >= state.revealedCards.length
  ) {
    return null;
  }
  return state.revealedCards[state.currentCardIndex];
}

async function validateBid(
  message: BidMessage,
  signature: string
): Promise<{ bidder: string; amount: number }> {
  if (!contractInstance) {
    throw new Error("Contract not initialized");
  }

  const {
    gameId: msgGameId,
    round: msgRound,
    cardId: msgCardId,
    bidder,
    amount: msgAmount
  } = message;

  // Basic type & range checks
  const gameIdNum = Number(msgGameId);
  const roundNum = Number(msgRound);
  const cardIdNum = Number(msgCardId);
  const amountNum = Number(msgAmount);

  if (!Number.isFinite(gameIdNum) || !Number.isFinite(roundNum) ||
      !Number.isFinite(cardIdNum) || !Number.isFinite(amountNum) ||
      amountNum <= 0) {
    throw new Error("Invalid bid parameters");
  }

  // Must be for current game / round / card
  if (gameIdNum !== state.gameId) {
    throw new Error("Wrong gameId");
  }
  if (roundNum !== state.currentRound) {
    throw new Error("Wrong round");
  }

  const currentCard = getCurrentCard();
  if (!currentCard || cardIdNum !== currentCard.id) {
    throw new Error("Wrong cardId");
  }

  // Amount must be higher
  if (amountNum <= state.highestBid.amount) {
    throw new Error("Bid must be higher than current highest");
  }

  // Check chips on-chain
  const chipBalance = await contractInstance.currentChipBalance(bidder);
  if (chipBalance.lt(ethers.BigNumber.from(amountNum))) {
    throw new Error("Insufficient chips");
  }

  // Verify plain ECDSA signature
  const messageHash = ethers.utils.keccak256(
    ethers.utils.solidityPack(
      ["uint256", "uint256", "uint256", "address", "uint256"],
      [gameIdNum, roundNum, cardIdNum, bidder, amountNum]
    )
  );

  let recovered: string;
  try {
    recovered = ethers.utils.recoverAddress(messageHash, signature);
  } catch (e) {
    logger.error({ err: e }, "Signature recovery failed");
    throw new Error("Invalid signature");
  }

  if (recovered.toLowerCase() !== bidder.toLowerCase()) {
    throw new Error("Signature does not match bidder");
  }

  // All checks passed
  return {
    bidder: bidder.toLowerCase(),
    amount: amountNum
  };
}

export async function handleBid(
  message: BidMessage,
  signature: string
): Promise<BidEntry> {
  const { bidder, amount } = await validateBid(message, signature);

  // const bidder = message.bidder;
  // const amount = message.amount;

  const bidEntry: BidEntry = {
    bidder,
    amount,
    cardId: Number(message.cardId),
    gameId: state.gameId,
    round: state.currentRound
  };

  const logArr = ensureBidLog(state.gameId, state.currentRound);
  logArr.push(bidEntry);

  // Track player
  state.players.add(bidder);

  state.highestBid = {
    amount,
    bidder
  };

  if (ioInstance) {
    ioInstance.emit("highestBidUpdate", getCurrentHighestBidPublic());
  }

  resetRoundTimeout();

  logger.info(
    {
      gameId: state.gameId,
      round: state.currentRound,
      bidder,
      amount
    },
    "Bid accepted"
  );

  return bidEntry;
}

export async function endRound(): Promise<void> {
  if (state.gameState !== "InProgress" || !contractInstance) return;

  const currentCard = getCurrentCard();
  if (!currentCard) return;

  const winner = state.highestBid.bidder;
  const finalPrice = state.highestBid.amount;
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const settleWinner = winner || zeroAddress;
  const settlePrice = finalPrice > 0 ? finalPrice : 0;

  // Track card if there's a valid winner
  if (winner && finalPrice > 0) {
    if (!state.wonCards[winner]) state.wonCards[winner] = [];
    state.wonCards[winner].push(currentCard);
    state.cardPrices[currentCard.id] = finalPrice;
  } else if (!winner || finalPrice === 0) {
    // Card not sold, price is 0
    state.cardPrices[currentCard.id] = 0;
  }

  try {
    const tx = await contractInstance.settleCard(
      currentCard.id,
      settleWinner,
      ethers.BigNumber.from(settlePrice)
    );
    logger.info(
      {
        hash: tx.hash,
        gameId: state.gameId,
        round: state.currentRound,
        winner: settleWinner,
        finalPrice: settlePrice
      },
      "settleCard tx sent"
    );
    await tx.wait();
    logger.info({ hash: tx.hash }, "settleCard tx confirmed");
  } catch (e: any) {
    logger.error({ err: e }, "settleCard failed");
  }

  state.currentRound += 1;
  state.currentCardIndex += 1;
  state.highestBid = { amount: 0, bidder: null };

  // Clear timeout tracking
  state.roundTimeoutEndsAt = null;

  if (state.currentRound > state.totalCards) {
    state.gameState = "Finished";
    if (state.roundTimeoutHandle) {
      clearTimeout(state.roundTimeoutHandle);
      state.roundTimeoutHandle = null;
    }
    if (ioInstance) {
      ioInstance.emit("gameFinished", { gameId: state.gameId });
    }
    
    // Fetch contract game state to ensure it's actually finished before calling finalizeGame
    try {
      const gameStateOnChain = await contractInstance.currentGameState();
      if (gameStateOnChain === 2) {
        // Game is finished on contract (2 = Finished)
        await endGame();
      } else {
        logger.warn(
          { contractGameState: gameStateOnChain, localRound: state.currentRound, totalCards: state.totalCards },
          "Game should be finished locally but contract state doesn't reflect it yet"
        );
        // Retry after a short delay
        setTimeout(() => {
          endGame().catch((err) => {
            logger.error({ err }, "endGame retry failed");
          });
        }, 1000);
      }
    } catch (e: any) {
      logger.error({ err: e }, "Failed to fetch game state before endGame");
      // Try to end game anyway
      await endGame().catch((err) => {
        logger.error({ err }, "endGame failed");
      });
    }
  } else {
    if (ioInstance) {
      ioInstance.emit("roundStarted", {
        gameId: state.gameId,
        round: state.currentRound,
        card: getCurrentCard()
      });
    }
    // Start 2-minute timer for new round
    resetRoundTimeout();
  }
}

export function computePower(playerCards: Card[]): PowerComputation {
  // Assume Card = { attack: number, defense: number, strategist: number }
  
  if (playerCards.length < 5) {
    return { 
      power: 0, 
      valid: false, 
      breakdown: { attackScore: 0, defenseScore: 0, strategyScore: 0 } 
    };
  }

  // Step 1: Select top 2 attackers by attack value
  const attackers = [...playerCards]
    .sort((a, b) => (b.attack || 0) - (a.attack || 0))
    .slice(0, 2);
  const attackSum = attackers.reduce((sum, card) => sum + (card.attack || 0), 0);
  const attackScore = (attackSum / 20) * 100;

  // Step 2: From remaining 3 cards, select top 2 defenders by defense value
  const remainingCards = playerCards.filter(
    (_, index) => !attackers.some(attacker => attacker === playerCards[index])
  );
  const defenders = [...remainingCards]
    .sort((a, b) => (b.defense || 0) - (a.defense || 0))
    .slice(0, 2);
  const defenseSum = defenders.reduce((sum, card) => sum + (card.defense || 0), 0);
  const defenseScore = (defenseSum / 20) * 100;

  // Step 3: Last remaining card as strategist
  const strategistCard = remainingCards.find(
    card => !defenders.some(defender => defender === card)
  ) || { strategist: 0 };
  const strategyScore = ((strategistCard.strategist || 0) / 10) * 100;

  // Step 4: Final weighted score
  const power = (attackScore * 0.35) + (defenseScore * 0.35) + (strategyScore * 0.30);

  return {
    power: Math.round(power * 100) / 100, // Round to 2 decimals
    valid: true,
    breakdown: {
      attackScore: Math.round(attackScore * 100) / 100,
      defenseScore: Math.round(defenseScore * 100) / 100,
      strategyScore: Math.round(strategyScore * 100) / 100,
    }
  };
}

async function endGame(): Promise<void> {
  if (!contractInstance) return;

  const scores: { bidder: string; power: number }[] = [];
  for (const bidder of Object.keys(state.wonCards)) {
    const cards = state.wonCards[bidder];
    const { power, valid } = computePower(cards);
    if (!valid) continue;
    scores.push({ bidder, power });
  }

  const zeroAddress = "0x0000000000000000000000000000000000000000";
  let winner = zeroAddress; // Default to zero address if no valid decks

  if (scores.length > 0) {
    scores.sort((a, b) => b.power - a.power);
    winner = scores[0].bidder;
  } else {
    logger.info({ gameId: state.gameId }, "No valid decks found, finalizing with zero address");
  }

  try {
    const tx = await contractInstance.finalizeGame(winner);
    logger.info(
      {
        hash: tx.hash,
        gameId: state.gameId,
        winner
      },
      "finalizeGame tx sent"
    );
    await tx.wait();
    logger.info({ hash: tx.hash }, "finalizeGame tx confirmed");
  } catch (e: any) {
    logger.error({ err: e }, "finalizeGame failed");
  }

  // Clear chat for the finished game (single active game lifecycle)
  try {
    if (ioInstance) clearChat(ioInstance, state.gameId);
  } catch (e) {
    logger.warn({ err: e }, "Failed to clear chat for finished game");
  }
}

async function startNewGame(gameIdFromContract: number, totalCards: number): Promise<void> {
  // Select cards by type order: sentinel, attacker, defender, strategist
  const selectedCards = selectCardsByType(totalCards);
  const slice = selectedCards.slice(0, totalCards);

  state.gameId = gameIdFromContract;
  state.gameState = "InProgress";
  state.totalCards = totalCards;
  state.currentRound = 1;
  state.currentCardIndex = 0;
  state.revealedCards = slice;
  state.highestBid = { amount: 0, bidder: null };
  state.bidLogs[state.gameId] = {};
  state.wonCards = {};
  state.usedNonces = {};
  state.cardPrices = {};

  if (ioInstance) {
    ioInstance.emit("gameStarted", {
      gameId: state.gameId,
      totalCards,
      firstCard: getCurrentCard()
    });
  }

  // Start 2-minute timer for first round
  resetRoundTimeout();
}

export async function maybeStartGameIfReady(
  minPlayers = 1
): Promise<void> {
  if (!contractInstance) return;

  try {
    const gameStateOnchain = await contractInstance.currentGameState();
    if (gameStateOnchain !== 0) return;

    const playerCountBN = await contractInstance.getCurrentPlayerCount();
    const playerCount = playerCountBN.toNumber();
    
    state.minPlayersRequired = minPlayers;

    // If min players not met yet, don't start countdown
    if (playerCount < minPlayers) {
      resetGameStartTimeout();
      return;
    }

    // Min players met, start 3-minute countdown if not already started
    if (!state.gameStartTimeoutHandle) {
      const timeoutEndsAt = Date.now() + GAME_START_COUNTDOWN_MS;
      state.gameStartTimeoutEndsAt = timeoutEndsAt;

      logger.info(
        { playerCount, minPlayers },
        "Min players reached, starting 3-minute countdown before game start"
      );

      state.gameStartTimeoutHandle = setTimeout(() => {
        executeGameStart().catch((err) => {
          logger.error({ err }, "executeGameStart failed from timeout");
        });
      }, GAME_START_COUNTDOWN_MS);
    }
  } catch (e: any) {
    logger.error({ err: e }, "maybeStartGameIfReady failed");
  }
}

async function executeGameStart(): Promise<void> {
  if (!contractInstance) return;

  resetGameStartTimeout();

  try {
    const playerCountBN = await contractInstance.getCurrentPlayerCount();
    const playerCount = playerCountBN.toNumber();
    const totalCards = calculateTotalCardsNeeded(playerCount);

    const tx = await contractInstance.startGame(totalCards);
    logger.info(
      {
        hash: tx.hash,
        totalCards,
        playerCount
      },
      "startGame tx sent"
    );
    await tx.wait();
    logger.info({ hash: tx.hash }, "startGame tx confirmed");

    // Fetch the gameId from contract after game starts
    const gameIdBN = await contractInstance.currentGameId();
    const gameId = gameIdBN.toNumber();

    await startNewGame(gameId, totalCards);
  } catch (e: any) {
    logger.error({ err: e }, "executeGameStart failed");
  }
}

async function getAllPlayers(): Promise<string[]> {
  if (!contractInstance) return [];
  
  try {
    const playerCount = await contractInstance.getCurrentPlayerCount();
    const count = playerCount.toNumber();
    const players: string[] = [];
    
    for (let i = 0; i < count; i++) {
      try {
        const player = await contractInstance.currentPlayers(i);
        players.push(player.toLowerCase());
      } catch (e) {
        logger.warn({ err: e, index: i }, "Failed to fetch player at index");
      }
    }
    
    return players;
  } catch (e) {
    logger.warn({ err: e }, "Failed to fetch players from contract");
    // Fallback: return players we've seen in bids
    return Array.from(state.players);
  }
}

export async function getGameStartInfo(): Promise<any> {
  const playerAddresses = await getAllPlayers();
  const playerInfoList: PlayerInfo[] = [];
  
  for (const address of playerAddresses) {
    try {
      const chipBalanceBN = await contractInstance!.currentChipBalance(address);
      const chipBalance = chipBalanceBN.toNumber();
      
      playerInfoList.push({
        address,
        chipBalance,
        cardsOwned: 0,
        cards: []
      });
    } catch (e) {
      logger.warn({ err: e, address }, "Failed to fetch player chip balance");
    }
  }

  let gameStartsInSeconds: number | null = null;
  if (state.gameStartTimeoutEndsAt && state.gameState === "NotStarted") {
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((state.gameStartTimeoutEndsAt - now) / 1000));
    gameStartsInSeconds = remaining > 0 ? remaining : null;
  }

  // Derive status more robustly
  let status: "ready" | "waiting" | "started" = "waiting";
  if (state.gameState === "InProgress") {
    status = "started";
    gameStartsInSeconds = null;
  } else if (state.gameStartTimeoutHandle) {
    status = "ready";
  } else {
    status = "waiting";
  }

  return {
    status,
    playersJoined: playerInfoList,
    minPlayersRequired: state.minPlayersRequired,
    gameStartsInSeconds
  };
}

export async function getStatus(): Promise<GameStatus> {
  const players: PlayerInfo[] = [];
  
  if (contractInstance && state.gameState === "InProgress") {
    try {
      const playerAddresses = await getAllPlayers();
      
      // Also include any players we've seen in bids (in case they're not in contract list yet)
      const allPlayerAddresses = new Set([
        ...playerAddresses,
        ...Array.from(state.players),
        ...Object.keys(state.wonCards)
      ]);
      
      for (const address of allPlayerAddresses) {
        try {
          const chipBalanceBN = await contractInstance.currentChipBalance(address);
          const chipBalance = chipBalanceBN.toNumber();
          const cards = state.wonCards[address] || [];
          
          // Add price information to each card
          const cardsWithPrice = cards.map(c => ({
            ...c,
            priceBought: state.cardPrices[c.id] || 0
          }));
          
          players.push({
            address,
            chipBalance,
            cardsOwned: cards.length,
            cards: cardsWithPrice
          });
        } catch (e) {
          logger.warn({ err: e, address }, "Failed to fetch player details");
        }
      }
    } catch (e) {
      logger.error({ err: e }, "Failed to fetch player status");
    }
  }
  
  // Calculate countdown until round ends
  let roundEndsInSeconds: number | null = null;
  if (state.roundTimeoutEndsAt && state.gameState === "InProgress") {
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((state.roundTimeoutEndsAt - now) / 1000));
    roundEndsInSeconds = remaining > 0 ? remaining : null;
  }

  // Calculate countdown until game starts
  let gameStartsInSeconds: number | null = null;
  if (state.gameStartTimeoutEndsAt && state.gameState === "NotStarted") {
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((state.gameStartTimeoutEndsAt - now) / 1000));
    gameStartsInSeconds = remaining > 0 ? remaining : null;
  }

  // Build mapping of cardId -> winner for quick lookup
  const winnerByCardId: Record<number, string> = {};
  for (const w of Object.keys(state.wonCards)) {
    const cards = state.wonCards[w] || [];
    for (const c of cards) {
      winnerByCardId[c.id] = w;
    }
  }

  const currentIndex = Math.max(0, state.currentCardIndex);
  const auctionedCards = state.revealedCards
    .slice(0, currentIndex)
    .map((c) => ({ 
      card: c, 
      winner: winnerByCardId[c.id] || null,
      pricePaid: state.cardPrices[c.id] || 0
    }));

  const remainingCards = state.revealedCards.slice(currentIndex);

  return {
    gameId: state.gameId,
    gameState: state.gameState,
    currentRound: state.currentRound,
    totalCards: state.totalCards,
    currentCard: getCurrentCard(),
    highestBid: getCurrentHighestBidPublic(),
    revealedCards: state.revealedCards,
    players,
    roundEndsInSeconds,
    gameStartsInSeconds,
    auctionedCards,
    remainingCards
  }; 
}

export function getCurrentHighestBidPublic(): HighestBidPublic {
  return {
    amount: state.highestBid.amount,
    bidder: state.highestBid.bidder
  };
}

export function getBidLog(gameId: number, round: number): BidEntry[] {
  const gid = Number(gameId);
  const r = Number(round);
  if (!state.bidLogs[gid] || !state.bidLogs[gid][r]) return [];
  return state.bidLogs[gid][r];
}

function wireContractEvents() {
  if (!contractInstance || !contractInstance.provider) return;
    // Ensure previous listeners are cleared to avoid duplicates
    try {
      contractInstance.removeAllListeners?.();
    } catch {}
    contractInstance.on(
      "PlayerJoined",
      async (gameId: BigNumber, player: string) => {
        try {
          logger.info({ gameId: gameId.toString(), player }, "PlayerJoined event");
          await maybeStartGameIfReady(state.minPlayersRequired);
        } catch (e) {
          logger.warn({ err: e }, "maybeStartGameIfReady failed on PlayerJoined");
        }
      }
    );

    contractInstance.on(
      "PlayerLeft",
      async (gameId: BigNumber, player: string) => {
        try {
          logger.info({ gameId: gameId.toString(), player }, "PlayerLeft event");
          await maybeStartGameIfReady(state.minPlayersRequired);
        } catch (e) {
          logger.warn({ err: e }, "maybeStartGameIfReady failed on PlayerLeft");
        }
      }
    );
  

  contractInstance.on(
    "GameStarted",
    (gameId: BigNumber, totalCards: BigNumber) => {
      logger.info(
        {
          gameId: gameId.toString(),
          totalCards: totalCards.toString()
        },
        "GameStarted event"
      );
    }
  );

  contractInstance.on(
    "CardSettled",
    (
      gameId: BigNumber,
      round: BigNumber,
      cardId: BigNumber,
      winner: string,
      price: BigNumber
    ) => {
      logger.info(
        {
          gameId: gameId.toString(),
          round: round.toString(),
          cardId: cardId.toString(),
          winner,
          price: price.toString()
        },
        "CardSettled event"
      );
    }
  );

  contractInstance.on(
    "GameFinalized",
    (gameId: BigNumber, winner: string, pot: BigNumber) => {
      logger.info(
        {
          gameId: gameId.toString(),
          winner,
          pot: pot.toString()
        },
        "GameFinalized event"
      );
    }
  );
}

async function syncStateFromContract(): Promise<void> {
  if (!contractInstance) {
    logger.warn("Contract not initialized, skipping state sync");
    return;
  }

  try {
    const gameStateOnChain = await contractInstance.currentGameState();
    const gameStateNum = gameStateOnChain;

    // 0 = NotStarted, 1 = InProgress, 2 = Finished
    if (gameStateNum !== 1) {
      logger.info({ gameState: gameStateNum }, "No active game on contract, state is clean");
      return;
    }

    logger.info("Active game detected on contract, syncing state...");

    // Read game state from contract
    const gameIdBN = await contractInstance.currentGameId();
    const roundBN = await contractInstance.currentRound();
    const totalCardsBN = await contractInstance.currentTotalCards();
    const playerCountBN = await contractInstance.getCurrentPlayerCount();

    const gameId = gameIdBN.toNumber();
    const currentRound = roundBN.toNumber();
    const totalCards = totalCardsBN.toNumber();
    const playerCount = playerCountBN.toNumber();

    logger.info(
      {
        gameId,
        currentRound,
        totalCards,
        playerCount
      },
      "Syncing game state from contract"
    );

    // Restore basic game state
    state.gameId = gameId;
    state.gameState = "InProgress";
    state.currentRound = currentRound;
    state.totalCards = totalCards;
    state.currentCardIndex = currentRound - 1; // Round 1 = index 0

    // Get all players
    const allCards = loadCards();
    const cardMap = new Map<number, Card>();
    for (const card of allCards) {
      cardMap.set(card.id, card);
    }

    state.wonCards = {};
    state.players = new Set();

    // Get all players from contract
    for (let i = 0; i < playerCount; i++) {
      try {
        const playerAddress = await contractInstance.currentPlayers(i);
        const playerAddr = playerAddress.toLowerCase();
        state.players.add(playerAddr);
        state.wonCards[playerAddr] = []; // Initialize empty
      } catch (e) {
        logger.warn({ err: e, playerIndex: i }, "Failed to get player address");
      }
    }

    // Query CardSettled events to reconstruct won cards
    // Filter by current gameId
    try {
      const filter = contractInstance.filters.CardSettled(gameIdBN, null, null, null, null);
      const events = await contractInstance.queryFilter(filter);
      
      for (const event of events) {
        if (!event.args) continue;
        
        const winner = (event.args[3] as string).toLowerCase();
        const cardIdBN = event.args[2] as BigNumber;
        const cardId = cardIdBN.toNumber();
        
        const card = cardMap.get(cardId);
        if (card && state.wonCards[winner]) {
          state.wonCards[winner].push(card);
        }

        // Event reconstructed for internal state; no console output in production
      }
      
      logger.info(
        { eventsFound: events.length },
        "Reconstructed won cards from CardSettled events"
      );
    } catch (e) {
      logger.warn({ err: e }, "Failed to query CardSettled events, won cards may be incomplete");
    }

    // For revealedCards, try to select by type order (sentinel, attacker, defender, strategist)
    // This preserves the requested sequence even after reconstruction.
    const selected = selectCardsByType(totalCards);
    state.revealedCards = selected.slice(0, totalCards);

    // Reset bid state (can't recover from contract)
    state.highestBid = { amount: 0, bidder: null };
    state.bidLogs[gameId] = state.bidLogs[gameId] || {};
    state.usedNonces = {};

    logger.info(
      {
        gameId,
        currentRound,
        totalCards,
        playersSynced: state.players.size,
        cardsWon: Object.keys(state.wonCards).reduce((sum, addr) => sum + state.wonCards[addr].length, 0)
      },
      "Game state synced from contract"
    );

    // Emit round started event if we're in the middle of a round
    if (ioInstance && currentRound <= totalCards) {
      ioInstance.emit("roundStarted", {
        gameId,
        round: currentRound,
        card: getCurrentCard()
      });
      // Start 2-minute timer for reconstructed round
      resetRoundTimeout();
    }
  } catch (e: any) {
    logger.error({ err: e }, "Failed to sync state from contract");
    // Don't throw - allow backend to start even if sync fails
  }
}

export async function init({ contract, io }: GameEngineDeps): Promise<void> {
  lastContractInstance = contractInstance;
  contractInstance = contract;
  ioInstance = io;
  loadCards();
  wireContractEvents();
  
  // Sync state from contract on startup
  await syncStateFromContract();

  // Rewire on provider/contract rotation
  onContractUpdated(async ({ contract: newContract }) => {
    try {
      logger.warn("RPC provider rotated, re-wiring contract events and syncing state");
      // Clear listeners on old instance
      try {
        lastContractInstance?.removeAllListeners?.();
      } catch {}
      lastContractInstance = contractInstance;
      contractInstance = newContract;
      chainIdCached = null;
      wireContractEvents();
      await syncStateFromContract();
    } catch (e) {
      logger.error({ err: e }, "Failed to rewire after provider rotation");
    }
  });
}


