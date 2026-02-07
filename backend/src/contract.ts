import { ethers, Contract, Wallet } from "ethers";
import { config } from "./config";

export const CONTRACT_ABI = [
  {
    name: "joinGame",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: []
  },
  {
    name: "startGame",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "totalCards", type: "uint256" }],
    outputs: []
  },
  {
    name: "settleCard",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cardId", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "finalPrice", type: "uint256" }
    ],
    outputs: []
  },
  {
    name: "finalizeGame",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "winner", type: "address" }],
    outputs: []
  },
  {
    name: "currentGameState",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }]
  },
  {
    name: "currentChipBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "getCurrentPlayerCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "currentPlayers",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "address" }]
  },
  {
    name: "currentGameId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "currentRound",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "currentTotalCards",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    name: "GameStarted",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "totalCards", type: "uint256", indexed: false }
    ]
  },
  {
    name: "CardSettled",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "round", type: "uint256", indexed: false },
      { name: "cardId", type: "uint256", indexed: false },
      { name: "winner", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false }
    ]
  },
  {
    name: "GameFinalized",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: true },
      { name: "pot", type: "uint256", indexed: false }
    ]
  }
] as const;

export function getProvider(): ethers.providers.JsonRpcProvider {
  return new ethers.providers.JsonRpcProvider(config.rpcUrl, config.chainId);
}

export function getWallet(provider: ethers.providers.JsonRpcProvider): Wallet {
  return new ethers.Wallet(config.relayerPrivateKey, provider);
}

export function getContract(): {
  provider: ethers.providers.JsonRpcProvider;
  wallet: Wallet;
  contract: Contract;
} {
  const provider = getProvider();
  const wallet = getWallet(provider);
  const contract = new ethers.Contract(
    config.contractAddress,
    CONTRACT_ABI,
    wallet
  );
  return { provider, wallet, contract };
}


