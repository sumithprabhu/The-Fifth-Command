import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.string().default("4000"),
  RPC_URL: z.string().min(1, "RPC_URL is required"),
  CONTRACT_ADDRESS: z.string().min(1, "CONTRACT_ADDRESS is required"),
  RELAYER_PRIVATE_KEY: z.string().min(1, "RELAYER_PRIVATE_KEY is required"),
  CHAIN_ID: z.string().default("1"),
  CORS_ORIGIN: z.string().default("*"),
  GAME_START_CHECK_INTERVAL_MS: z.string().default("10000"),
  LOG_LEVEL: z.string().default("info")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  nodeEnv: parsed.data.NODE_ENV,
  port: parseInt(parsed.data.PORT, 10),
  rpcUrl: parsed.data.RPC_URL,
  contractAddress: parsed.data.CONTRACT_ADDRESS,
  relayerPrivateKey: parsed.data.RELAYER_PRIVATE_KEY,
  chainId: parseInt(parsed.data.CHAIN_ID, 10),
  corsOrigin: parsed.data.CORS_ORIGIN,
  gameStartCheckIntervalMs: parseInt(parsed.data.GAME_START_CHECK_INTERVAL_MS, 10),
  logLevel: parsed.data.LOG_LEVEL
};


