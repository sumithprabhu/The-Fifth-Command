import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as game from "./game";
import { logger } from "./logger";
import { BidMessage } from "./types";

const bidMessageSchema = z.object({
  bidder: z.string().min(1),
  gameId: z.number().int().nonnegative(),
  round: z.number().int().positive(),
  cardId: z.number().int().positive(),
  amount: z.number().int().positive(),
  timestamp: z.number().int().positive(),
  nonce: z.number().int().nonnegative()
});

const bidSubmitBodySchema = z.object({
  message: bidMessageSchema,
  signature: z.string().min(1)
});

export function createRoutes() {
  const router = express.Router();

  router.get(
    "/health",
    (req: Request, res: Response): void => {
      res.json({ status: "ok", uptime: process.uptime() });
    }
  );

  router.get(
    "/game/status",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const status = await game.getStatus();
        res.json(status);
      } catch (e) {
        logger.error({ err: e }, "GET /game/status failed");
        next(e);
      }
    }
  );

  router.get(
    "/game/start-info",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const info = await game.getGameStartInfo();
        res.json(info);
      } catch (e) {
        logger.error({ err: e }, "GET /game/start-info failed");
        next(e);
      }
    }
  );

  router.post(
    "/bid/submit",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const parsed = bidSubmitBodySchema.parse(req.body);
        const message = parsed.message as BidMessage;
        const { signature } = parsed;
        const bid = await game.handleBid(message, signature);
        res.json({ ok: true, bid });
      } catch (e: any) {
        if (e instanceof z.ZodError) {
          res.status(400).json({ ok: false, error: "Invalid payload", issues: e.issues });
          return;
        }
        logger.warn({ err: e }, "POST /bid/submit failed");
        res.status(400).json({ ok: false, error: e.message });
      }
    }
  );

  router.get(
    "/bid/log/:gameId/:round",
    (req: Request, res: Response, next: NextFunction): void => {
      const { gameId, round } = req.params;
      try {
        const gameIdNum = Number(gameId);
        const roundNum = Number(round);
        if (!Number.isFinite(gameIdNum) || !Number.isFinite(roundNum)) {
          res.status(400).json({ error: "gameId and round must be numbers" });
          return;
        }
        const bids = game.getBidLog(gameIdNum, roundNum);
        res.json({ gameId: gameIdNum, round: roundNum, bids });
      } catch (e) {
        logger.error({ err: e }, "GET /bid/log failed");
        next(e);
      }
    }
  );

  return router;
}


