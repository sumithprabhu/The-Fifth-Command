import { ethers, Contract } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, RPC_URL } from "./contractConfig";

// Singleton provider instance to avoid too many requests
let providerInstance: ethers.JsonRpcProvider | null = null;
let contractInstance: Contract | null = null;

// Get a provider instance (singleton to avoid rate limiting)
export function getProvider() {
  if (!providerInstance) {
    providerInstance = new ethers.JsonRpcProvider(RPC_URL);
  }
  return providerInstance;
}

// Get a contract instance (read-only, singleton to avoid rate limiting)
export function getContract(): Contract {
  if (!contractInstance) {
    const provider = getProvider();
    contractInstance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }
  return contractInstance;
}

// Get a contract instance with signer (for write operations)
export async function getContractWithSigner() {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("MetaMask is not installed");
  }
  
  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

// Contract function types
export interface GameResult {
  gameId: bigint;
  winner: string;
  potPaid: bigint;
  potCarriedOver: bigint;
  totalPlayers: bigint;
  timestamp: bigint;
}

export interface PlayerInfo {
  address: string;
  chipBalance: bigint;
  cardsOwned: number;
  cards: any[];
}

// Contract Functions

/**
 * Get the current game ID
 */
export async function getCurrentGameId(): Promise<bigint> {
  const contract = getContract();
  return await contract.currentGameId();
}

/**
 * Get the current game state (0 = NotStarted, 1 = InProgress, 2 = Finished)
 */
export async function getCurrentGameState(): Promise<number> {
  const contract = getContract();
  const state = await contract.currentGameState();
  return Number(state);
}

/**
 * Get the current round number
 */
export async function getCurrentRound(): Promise<bigint> {
  const contract = getContract();
  return await contract.currentRound();
}

/**
 * Get the total cards in current game
 */
export async function getCurrentTotalCards(): Promise<bigint> {
  const contract = getContract();
  return await contract.currentTotalCards();
}

/**
 * Get the current total pot
 */
export async function getCurrentTotalPot(): Promise<bigint> {
  const contract = getContract();
  return await contract.currentTotalPot();
}

/**
 * Get the current player count
 */
export async function getCurrentPlayerCount(): Promise<number> {
  const contract = getContract();
  const count = await contract.getCurrentPlayerCount();
  return Number(count);
}

/**
 * Get a player address by index
 */
export async function getCurrentPlayer(index: number): Promise<string> {
  const contract = getContract();
  return await contract.currentPlayers(index);
}

/**
 * Get chip balance for an address
 */
export async function getCurrentChipBalance(address: string): Promise<bigint> {
  const contract = getContract();
  return await contract.currentChipBalance(address);
}

/**
 * Check if an address is a current player
 */
export async function isCurrentPlayer(address: string): Promise<boolean> {
  const contract = getContract();
  return await contract.isCurrentPlayer(address);
}

/**
 * Get past games count
 */
export async function getPastGamesCount(): Promise<number> {
  const contract = getContract();
  const count = await contract.getPastGamesCount();
  return Number(count);
}

/**
 * Get a past game by index
 */
export async function getPastGame(index: number): Promise<GameResult> {
  const contract = getContract();
  const game = await contract.getPastGame(index);
  
  // The contract returns an array-like object with indices:
  // 0: gameId
  // 1: winner
  // 2: potPaid
  // 3: potCarriedOver
  // 4: totalPlayers
  // (No timestamp field - only 5 fields)
  
  // Access by index since it's an array-like object
  const gameId = game[0];
  const winner = game[1];
  const potPaid = game[2];
  const potCarriedOver = game[3];
  const totalPlayers = game[4];
  const timestamp = BigInt(0); // Timestamp not available in contract response
  
  return {
    gameId,
    winner,
    potPaid,
    potCarriedOver,
    totalPlayers,
    timestamp,
  };
}

/**
 * Get all past games
 */
export async function getAllPastGames(): Promise<GameResult[]> {
  const count = await getPastGamesCount();
  const games: GameResult[] = [];
  
  for (let i = 0; i < count; i++) {
    try {
      const game = await getPastGame(i);
      games.push(game);
    } catch (error) {
      console.error(`Error fetching past game ${i}:`, error);
    }
  }
  
  return games;
}

/**
 * Get entry fee
 */
export async function getEntryFee(): Promise<bigint> {
  const contract = getContract();
  return await contract.entryFee();
}

/**
 * Get starting chips
 */
export async function getStartingChips(): Promise<bigint> {
  const contract = getContract();
  return await contract.startingChips();
}

/**
 * Get game currency token address
 */
export async function getGameCurrencyToken(): Promise<string> {
  const contract = getContract();
  return await contract.gameCurrencyToken();
}

/**
 * Get min/max entry fee and starting chips
 */
export async function getGameLimits() {
  const contract = getContract();
  const [minEntryFee, maxEntryFee, minStartingChips, maxStartingChips] = await Promise.all([
    contract.MIN_ENTRY_FEE(),
    contract.MAX_ENTRY_FEE(),
    contract.MIN_STARTING_CHIPS(),
    contract.MAX_STARTING_CHIPS(),
  ]);
  
  return {
    minEntryFee: Number(minEntryFee),
    maxEntryFee: Number(maxEntryFee),
    minStartingChips: Number(minStartingChips),
    maxStartingChips: Number(maxStartingChips),
  };
}

// Write Functions (require signer)

/**
 * Join the game (requires signer)
 */
export async function joinGame(): Promise<any> {
  const contract = await getContractWithSigner();
  return await contract.joinGame();
}

/**
 * Start a new game (requires signer - owner only)
 */
export async function startGame(totalCards: number): Promise<any> {
  const contract = await getContractWithSigner();
  return await contract.startGame(totalCards);
}

/**
 * Settle a card (requires signer - backend only)
 */
export async function settleCard(cardId: number, winner: string, finalPrice: bigint): Promise<any> {
  const contract = await getContractWithSigner();
  return await contract.settleCard(cardId, winner, finalPrice);
}

/**
 * Finalize the game (requires signer - backend only)
 */
export async function finalizeGame(winner: string): Promise<any> {
  const contract = await getContractWithSigner();
  return await contract.finalizeGame(winner);
}

/**
 * Get players who joined a specific game from PlayerJoined events
 */
export async function getPlayersFromEvents(gameId: number): Promise<string[]> {
  const contract = getContract();
  try {
    // Query PlayerJoined events for the specific gameId
    // PlayerJoined event: (uint256 indexed gameId, address indexed player)
    const filter = contract.filters.PlayerJoined(gameId, null);
    const events = await contract.queryFilter(filter);
    
    // Extract unique player addresses
    const players = new Set<string>();
    events.forEach((event) => {
      // Check if event is EventLog (has args property)
      if ('args' in event && event.args && event.args.length >= 2) {
        // event.args[0] is gameId, event.args[1] is player address
        const player = event.args[1] as string;
        if (player && player !== ethers.ZeroAddress) {
          players.add(player.toLowerCase());
        }
      }
    });
    
    return Array.from(players);
  } catch (error) {
    console.error("Error fetching players from events:", error);
    return [];
  }
}

export interface GameFinalizedEvent {
  gameId: bigint;
  winner: string;
  potPaid: bigint;
  potCarriedOver: bigint;
}

/**
 * Get GameFinalized event for a specific gameId
 * GameFinalized event: (uint256 indexed gameId, address indexed winner, uint256 potPaid, uint256 potCarriedOver)
 */
export async function getGameFinalizedEvent(gameId: number): Promise<GameFinalizedEvent | null> {
  const contract = getContract();
  try {
    // Query GameFinalized events for the specific gameId
    const filter = contract.filters.GameFinalized(gameId, null);
    const events = await contract.queryFilter(filter);
    
    if (events.length > 0) {
      // Get the most recent event (last one)
      const event = events[events.length - 1];
      // Check if event is EventLog (has args property)
      if ('args' in event && event.args && event.args.length >= 4) {
        // event.args[0] is gameId, event.args[1] is winner, event.args[2] is potPaid, event.args[3] is potCarriedOver
        return {
          gameId: event.args[0] as bigint,
          winner: event.args[1] as string,
          potPaid: event.args[2] as bigint,
          potCarriedOver: event.args[3] as bigint,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching GameFinalized event:", error);
    return null;
  }
}
