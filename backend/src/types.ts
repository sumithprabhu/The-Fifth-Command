import { BigNumber, Contract } from "ethers";
import type { Server as SocketIOServer } from "socket.io";

export type GameState = "NotStarted" | "InProgress" | "Finished";

export interface RawCard {
  name: string;
  image: string;
  attack: number;
  defense: number;
  strategist?: number;
  description: string;
}

export type CardType = "sentinel" | "attacker" | "defender" | "strategist";

export interface Card {
  id: number;
  name: string;
  image: string;
  type: CardType;
  attack: number;
  defense: number;
  strategist: number;
  raw: RawCard;
}

export interface BidMessage {
  bidder: string;
  gameId: number;
  round: number;
  cardId: number;
  amount: number;
  timestamp: number;
  nonce: number;
}

export interface BidEntry {
  bidder: string;
  amount: number;
  timestamp: number;
  nonce: string;
  cardId: number;
  gameId: number;
  round: number;
}

export interface PlayerInfo {
  address: string;
  chipBalance: number;
  cardsOwned: number;
  cards: Card[];
}

export interface GameStatus {
  gameId: number;
  gameState: GameState;
  currentRound: number;
  totalCards: number;
  currentCard: Card | null;
  highestBid: HighestBidPublic;
  revealedCards: Card[];
  players: PlayerInfo[];
  roundEndsInSeconds: number | null; // Seconds until round ends, null if no timeout set
}

export interface HighestBidPublic {
  amount: number;
  bidder: string | null;
}

export interface GameEngineDeps {
  contract: Contract;
  io: SocketIOServer;
}

export interface PowerComputation {
  power: number;
  valid: boolean;
  breakdown: {
    attackScore: number;
    defenseScore: number;
    strategyScore: number;
  };
}

export interface ChipBalanceResult {
  raw: BigNumber;
  asNumber: number;
}


