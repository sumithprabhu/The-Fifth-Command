import { ethers, Contract, Wallet } from "ethers";
import EventEmitter from "events";
import { config } from "./config";

export const CONTRACT_ABI = [
  {
    name: "PlayerJoined",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true }
    ]
  },
  {
    name: "PlayerLeft",
    type: "event",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true }
    ]
  },
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

type BaseProv = ethers.providers.BaseProvider;

function createProvider(url: string): BaseProv {
  const chainId = config.chainId;
  if (url.startsWith("ws")) {
    return new ethers.providers.WebSocketProvider(url, chainId);
  }
  const http = new ethers.providers.JsonRpcProvider(url, chainId);
  try {
    (http as any).pollingInterval = 15000; // 15s; gentler polling if HTTP
  } catch {}
  return http;
}

function createWallet(provider: BaseProv): Wallet {
  return new ethers.Wallet(config.relayerPrivateKey, provider);
}

function createContract(wallet: Wallet): Contract {
  return new ethers.Contract(config.contractAddress, CONTRACT_ABI, wallet);
}

class ProviderPool extends EventEmitter {
  private urls: string[];
  private idx = 0;
  provider: BaseProv;
  wallet: Wallet;
  contract: Contract;

  constructor(urls: string[]) {
    super();
    if (!urls || urls.length === 0) throw new Error("No RPC URLs configured");
    this.urls = urls;
    const prov = createProvider(urls[0]);
    const wal = createWallet(prov);
    const con = createContract(wal);
    this.provider = prov;
    this.wallet = wal;
    this.contract = con;
    this.attachMonitors();
  }

  private currentUrl(): string {
    return this.urls[this.idx % this.urls.length];
  }

  private nextIndex(): number {
    this.idx = (this.idx + 1) % this.urls.length;
    return this.idx;
  }

  private attachMonitors() {
    // If WebSocket, listen for close/error and rotate
    const ws = this.provider as any;
    const maybeWs = ws?._websocket || ws?.websocket;
    if (maybeWs) {
      try {
        maybeWs.on("close", () => this.rotate("ws-close"));
        maybeWs.on("error", () => this.rotate("ws-error"));
      } catch {}
    }
  }

  async healthCheck(): Promise<void> {
    // Cheap check for HTTP providers; avoid frequent polling
    try {
      await this.provider.getBlockNumber();
    } catch (e) {
      this.rotate("healthcheck-fail");
    }
  }

  rotate(reason: string) {
    const oldProvider = this.provider as any;
    // Cleanup old WS if present
    try {
      const maybeWs = oldProvider?._websocket || oldProvider?.websocket;
      if (maybeWs && typeof maybeWs.terminate === "function") {
        maybeWs.terminate();
      } else if (typeof oldProvider?.destroy === "function") {
        oldProvider.destroy();
      }
    } catch {}

    this.nextIndex();
    const url = this.currentUrl();
    const prov = createProvider(url);
    const wal = createWallet(prov);
    const con = createContract(wal);
    this.provider = prov;
    this.wallet = wal;
    this.contract = con;
    this.attachMonitors();
    this.emit("updated", { reason, provider: prov, wallet: wal, contract: con });
  }
}

let pool: ProviderPool | null = null;
const getPool = (): ProviderPool => {
  if (!pool) {
    pool = new ProviderPool(config.rpcUrls && config.rpcUrls.length ? config.rpcUrls : [config.rpcUrl]);
  }
  return pool;
};

export function getProvider(): BaseProv {
  return getPool().provider;
}

export function getWallet(provider?: BaseProv): Wallet {
  const p = getPool();
  return provider ? createWallet(provider) : p.wallet;
}

export function getContract(): {
  provider: BaseProv;
  wallet: Wallet;
  contract: Contract;
} {
  const p = getPool();
  return { provider: p.provider, wallet: p.wallet, contract: p.contract };
}

export function onContractUpdated(
  cb: (args: { reason: string; provider: BaseProv; wallet: Wallet; contract: Contract }) => void
): void {
  getPool().on("updated", cb);
}

// Start a gentle health-check loop for HTTP providers only
const startHealthCheck = () => {
  const p = getPool();
  const provAny = p.provider as any;
  const isWs = !!(provAny?._websocket || provAny?.websocket);
  if (isWs) return; // no polling for websockets
  const intervalMs = 60_000; // 60s
  setInterval(() => {
    // If provider changed to WS meanwhile, skip
    const provAnyInner = getPool().provider as any;
    const nowWs = !!(provAnyInner?._websocket || provAnyInner?.websocket);
    if (nowWs) return;
    getPool().healthCheck().catch(() => {
      // healthCheck internally rotates on failure
    });
  }, intervalMs);
};

// Kick off health check at module load
startHealthCheck();


