import pino from "pino";
import pinoHttp from "pino-http";

const level = process.env.LOG_LEVEL || "info";

export const logger = pino({
  level,
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard"
          }
        }
      : undefined
});

// Use default pino-http instance for compatibility with current typings.
// It still produces structured logs; if you want to plug in the shared logger,
// we can align pino/pino-http versions and adjust types.
export const httpLogger = pinoHttp();



