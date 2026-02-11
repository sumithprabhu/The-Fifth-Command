export const BASE_URL = "https://the-fifth-command.onrender.com";

export interface GameStatus {
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
}

/**
 * Get current game status from API
 */
export async function getGameStatus(): Promise<GameStatus> {
  const response = await fetch(`${BASE_URL}/api/v1/game/status`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch game status: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Submit a bid
 */
export async function submitBid(message: any, signature: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/api/v1/bid`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, signature }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to submit bid: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get bid log for a specific game and round
 */
export async function getBidLog(gameId: number, round: number): Promise<any[]> {
  const response = await fetch(`${BASE_URL}/api/v1/bid/log/${gameId}/${round}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch bid log: ${response.statusText}`);
  }

  return await response.json();
}

export interface GameStartInfo {
  status: "ready" | "waiting" | "starting" | "started";
  playersJoined: Array<{
    address: string;
    chipBalance: number;
    cardsOwned: number;
    cards: any[];
  }>;
  minPlayersRequired: number;
  gameStartsInSeconds: number | null;
}

/**
 * Get game start info - always linked with current game id
 */
export async function getGameStartInfo(): Promise<GameStartInfo> {
  const response = await fetch(`${BASE_URL}/api/v1/game/start-info`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch game start info: ${response.statusText}`);
  }

  return await response.json();
}
