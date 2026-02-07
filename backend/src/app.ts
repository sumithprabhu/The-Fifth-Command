import http from "http";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server as SocketIOServer } from "socket.io";
import swaggerUi from "swagger-ui-express";

import { config } from "./config";
import { logger, httpLogger } from "./logger";
import { getContract } from "./contract";
import * as game from "./game";
import { createRoutes } from "./routes";
import { openApiSpec } from "./docs";

function createApp() {
  const app = express();

  app.use(httpLogger);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 120
  });
  app.use(limiter);

  app.use("/api/v1", createRoutes());

  // Swagger UI & raw JSON
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get("/docs-json", (req: Request, res: Response) => {
    res.json(openApiSpec);
  });

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found" });
  });

  app.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: any, req: Request, res: Response, _next: NextFunction) => {
      logger.error({ err }, "Unhandled error");
      if (res.headersSent) return;
      res.status(500).json({ error: "Internal server error" });
    }
  );

  return app;
}

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: config.corsOrigin === "*" ? true : config.corsOrigin,
      methods: ["GET", "POST"]
    }
  });

  const { contract } = getContract();
  await game.init({ contract, io });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on(
      "submitBid",
      async (
        payload: { message?: any; signature?: string },
        cb?: (resp: any) => void
      ) => {
        const { message, signature } = payload || {};
        if (!message || !signature) {
          cb?.({ ok: false, error: "Missing message or signature" });
          return;
        }
        try {
          const bid = await game.handleBid(message, signature);
          io.emit("highestBidUpdate", game.getCurrentHighestBidPublic());
          cb?.({ ok: true, bid });
        } catch (e: any) {
          logger.warn({ err: e }, "Socket submitBid failed");
          cb?.({ ok: false, error: e.message });
        }
      }
    );

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });

  setInterval(() => {
    game
      .maybeStartGameIfReady(3, 15)
      .catch((e) =>
        logger.error({ err: e }, "maybeStartGameIfReady interval failed")
      );
  }, config.gameStartCheckIntervalMs);

  server.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.nodeEnv },
      "Auction backend listening"
    );
  });
}

bootstrap().catch((e) => {
  logger.fatal({ err: e }, "Fatal error during bootstrap");
  process.exit(1);
});


