import fs from "fs";
import path from "path";
import { BigNumber, ethers } from "ethers";
import { Server as SocketIOServer } from "socket.io";
import { logger } from "./logger";
import {
  BidEntry,
  BidMessage,
  Card,
  GameEngineDeps,
  GameState,
  GameStatus,
  HighestBidPublic,
  PowerComputation
} from "./types";

const MIN_INCREMENT = 10; // chips
const ROUND_TIMEOUT_MS = 30_000; // 30 seconds
const BID_MESSAGE_MAX_AGE_MS = 5 * 60_000; // 5 minutes

// EIP-712 typed data
const BID_DOMAIN_NAME = "TheFifthCommandAuction";
const BID_DOMAIN_VERSION = "1";

let ioInstance: SocketIOServer | null = null;
let contractInstance: ethers.Contract | null = null;
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
  roundTimeoutHandle: NodeJS.Timeout | null;
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
  roundTimeoutHandle: null
};

let allCards: Card[] = [];

function loadCards(): Card[] {
  if (allCards.length > 0) return allCards;

  const filePath = path.join(__dirname, "..", "cards.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as {
    allRound: any[];
    attacker: any[];
    defender: any[];
    strategist: any[];
  };

  let idCounter = 1;
  const flattenType = (arr: any[] | undefined, type: Card["type"]): Card[] =>
    (arr || []).map((c) => ({
      id: idCounter++,
      name: c.name,
      image: c.image,
      type,
      attack: Number(c.attack) || 0,
      defense: Number(c.defense) || 0,
      heal: Number(c.strategist) || 0,
      raw: c
    }));

  allCards = [
    ...flattenType(data.allRound, "allRound"),
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
  }
  if (state.gameState !== "InProgress") return;

  state.roundTimeoutHandle = setTimeout(() => {
    endRound().catch((err) => {
      logger.error({ err }, "endRound failed from timeout");
    });
  }, ROUND_TIMEOUT_MS);
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

  const now = Date.now();
  const msgTs = Number(message.timestamp);
  if (Number.isNaN(msgTs)) {
    throw new Error("Invalid timestamp");
  }
  if (Math.abs(now - msgTs) > BID_MESSAGE_MAX_AGE_MS) {
    throw new Error("Bid message too old");
  }

  const domain = await getBidDomain();
  const types = getBidTypes();

  let recovered: string;
  try {
    recovered = ethers.utils.verifyTypedData(
      domain,
      types as any,
      message,
      signature
    );
  } catch (e: any) {
    logger.error({ err: e }, "verifyTypedData failed");
    throw new Error("Invalid signature");
  }

  if (recovered.toLowerCase() !== String(message.bidder || "").toLowerCase()) {
    throw new Error("Signature does not match bidder");
  }

  if (state.gameState !== "InProgress") {
    throw new Error("Game is not in progress");
  }
  if (Number(message.gameId) !== state.gameId) {
    throw new Error("Invalid gameId for current game");
  }
  if (Number(message.round) !== state.currentRound) {
    throw new Error("Invalid round");
  }

  const currentCard = getCurrentCard();
  if (!currentCard || Number(message.cardId) !== currentCard.id) {
    throw new Error("Invalid cardId for this round");
  }

  const bidder = recovered.toLowerCase();
  const nonce = String(message.nonce);
  if (!state.usedNonces[bidder]) {
    state.usedNonces[bidder] = new Set();
  }
  if (state.usedNonces[bidder].has(nonce)) {
    throw new Error("Nonce already used");
  }

  const amount = Number(message.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid bid amount");
  }

  if (amount < state.highestBid.amount + MIN_INCREMENT) {
    throw new Error(
      `Bid must be at least ${MIN_INCREMENT} chips higher than current highest`
    );
  }

  let chipBalance: BigNumber;
  try {
    chipBalance = await contractInstance.currentChipBalance(bidder);
  } catch (e: any) {
    logger.error({ err: e }, "currentChipBalance call failed");
    throw new Error("Unable to verify chip balance");
  }

  if (chipBalance.lt(ethers.BigNumber.from(amount))) {
    throw new Error("Insufficient chips for this bid");
  }

  state.usedNonces[bidder].add(nonce);

  return {
    bidder,
    amount
  };
}

export async function handleBid(
  message: BidMessage,
  signature: string
): Promise<BidEntry> {
  const { bidder, amount } = await validateBid(message, signature);

  const bidEntry: BidEntry = {
    bidder,
    amount,
    timestamp: Number(message.timestamp),
    nonce: String(message.nonce),
    cardId: Number(message.cardId),
    gameId: state.gameId,
    round: state.currentRound
  };

  const logArr = ensureBidLog(state.gameId, state.currentRound);
  logArr.push(bidEntry);

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

  if (!winner || finalPrice <= 0) {
    logger.info(
      {
        gameId: state.gameId,
        round: state.currentRound
      },
      "Round ended without valid bids"
    );
  } else {
    if (!state.wonCards[winner]) state.wonCards[winner] = [];
    state.wonCards[winner].push(currentCard);

    try {
      const tx = await contractInstance.settleCard(
        currentCard.id,
        winner,
        ethers.BigNumber.from(finalPrice)
      );
      logger.info(
        {
          hash: tx.hash,
          gameId: state.gameId,
          round: state.currentRound,
          winner,
          finalPrice
        },
        "settleCard tx sent"
      );
      await tx.wait();
      logger.info({ hash: tx.hash }, "settleCard tx confirmed");
    } catch (e: any) {
      logger.error({ err: e }, "settleCard failed");
    }
  }

  state.currentRound += 1;
  state.currentCardIndex += 1;
  state.highestBid = { amount: 0, bidder: null };

  if (state.currentRound > state.totalCards) {
    state.gameState = "Finished";
    if (state.roundTimeoutHandle) {
      clearTimeout(state.roundTimeoutHandle);
      state.roundTimeoutHandle = null;
    }
    if (ioInstance) {
      ioInstance.emit("gameFinished", { gameId: state.gameId });
    }
    await endGame();
  } else {
    if (ioInstance) {
      ioInstance.emit("roundStarted", {
        gameId: state.gameId,
        round: state.currentRound,
        card: getCurrentCard()
      });
    }
    resetRoundTimeout();
  }
}

export function computePower(playerCards: Card[]): PowerComputation {
  if (!playerCards || playerCards.length === 0) {
    return { power: 0, valid: false, breakdown: { attack: 0, defense: 0, heal: 0 } };
  }

  let attackers = 0;
  let defenders = 0;
  let healers = 0;

  let attack = 0;
  let defense = 0;
  let heal = 0;

  for (const c of playerCards) {
    attack += c.attack || 0;
    defense += c.defense || 0;
    heal += c.heal || 0;

    if (c.type === "attacker") attackers += 1;
    if (c.type === "defender") defenders += 1;
    if (c.type === "strategist" || c.type === "allRound") healers += 1;
  }

  const valid =
    attackers >= 1 && defenders >= 1 && healers >= 1 && playerCards.length >= 3;

  const power = attack + defense + heal * 2;

  return { power, valid, breakdown: { attack, defense, heal } };
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

  if (scores.length === 0) {
    logger.info({ gameId: state.gameId }, "No valid decks to finalize game");
    return;
  }

  scores.sort((a, b) => b.power - a.power);
  const winner = scores[0].bidder;

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
}

async function startNewGame(totalCards: number): Promise<void> {
  const all = loadCards();
  const shuffled = shuffle(all);
  const slice = shuffled.slice(0, totalCards);

  state.gameId += 1;
  state.gameState = "InProgress";
  state.totalCards = totalCards;
  state.currentRound = 1;
  state.currentCardIndex = 0;
  state.revealedCards = slice;
  state.highestBid = { amount: 0, bidder: null };
  state.bidLogs[state.gameId] = {};
  state.wonCards = {};
  state.usedNonces = {};

  if (ioInstance) {
    ioInstance.emit("gameStarted", {
      gameId: state.gameId,
      totalCards,
      firstCard: getCurrentCard()
    });
  }

  resetRoundTimeout();
}

export async function maybeStartGameIfReady(
  minPlayers = 1,
  totalCards = 10
): Promise<void> {
  if (!contractInstance) return;

  try {
    const gameStateOnchain = await contractInstance.currentGameState();
    // const gameStateOnchain = await contractInstance.currentGameState();
console.log("gameStateOnchain:", gameStateOnchain);
console.log("typeof gameStateOnchain:", typeof gameStateOnchain);
console.log("gameStateOnchain value:", gameStateOnchain);
    console.log(gameStateOnchain);
    if (gameStateOnchain !== 0) return;

    const playerCount = await contractInstance.getCurrentPlayerCount();
    console.log(playerCount)
    console.log(playerCount.toNumber())
    if (playerCount.toNumber() < minPlayers) return;
    console.log("HLO");
    const tx = await contractInstance.startGame(totalCards);
    logger.info(
      {
        hash: tx.hash,
        totalCards
      },
      "startGame tx sent"
    );
    await tx.wait();
    logger.info({ hash: tx.hash }, "startGame tx confirmed");

    await startNewGame(totalCards);
  } catch (e: any) {
    logger.error({ err: e }, "maybeStartGameIfReady failed");
  }
}

export function getStatus(): GameStatus {
  return {
    gameId: state.gameId,
    gameState: state.gameState,
    currentRound: state.currentRound,
    totalCards: state.totalCards,
    currentCard: getCurrentCard(),
    highestBid: getCurrentHighestBidPublic(),
    revealedCards: state.revealedCards
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

export function init({ contract, io }: GameEngineDeps): void {
  contractInstance = contract;
  ioInstance = io;
  loadCards();
  wireContractEvents();
}


