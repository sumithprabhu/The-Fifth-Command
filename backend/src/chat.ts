import { Server as SocketIOServer, Socket } from "socket.io";
import { logger } from "./logger";

export interface ChatMessage {
  id: string;
  gameId: number;
  sender: string; // address
  displayName?: string;
  text: string;
  timestamp: number; // ms
}

const HISTORY_LIMIT = 1000;
const messagesByGame = new Map<number, ChatMessage[]>();

function getHistory(gameId: number): ChatMessage[] {
  return messagesByGame.get(gameId) || [];
}

function addMessage(msg: ChatMessage) {
  const arr = messagesByGame.get(msg.gameId) || [];
  arr.push(msg);
  if (arr.length > HISTORY_LIMIT) {
    arr.splice(0, arr.length - HISTORY_LIMIT);
  }
  messagesByGame.set(msg.gameId, arr);
}

function sanitize(text: string): string {
  if (typeof text !== "string") return "";
  let t = text.replace(/[\u0000-\u001F\u007F]/g, ""); // strip control chars
  t = t.trim();
  if (t.length > 500) t = t.slice(0, 500);
  return t;
}

// simple per-socket rate limiter
const rate: Record<string, { windowStart: number; count: number }> = {};
const WINDOW_MS = 5000; // 5s
const MAX_MSGS_PER_WINDOW = 20;

function checkRate(socketId: string): boolean {
  const now = Date.now();
  const r = rate[socketId] || { windowStart: now, count: 0 };
  if (now - r.windowStart > WINDOW_MS) {
    r.windowStart = now;
    r.count = 0;
  }
  r.count += 1;
  rate[socketId] = r;
  return r.count <= MAX_MSGS_PER_WINDOW;
}

export function registerChatHandlers(io: SocketIOServer, socket: Socket) {
  socket.on(
    "chat:join",
    (payload: { gameId?: number; }, cb?: (resp: any) => void) => {
    const gameId = Number(payload?.gameId);
    if (!Number.isFinite(gameId) || gameId <= 0) {
      cb?.({ ok: false, error: "Invalid gameId" });
      return;
    }
    const room = `game:${gameId}`;
    socket.join(room);
    const history = getHistory(gameId);
    cb?.({ ok: true, history });
    logger.info({ socketId: socket.id, room }, "Joined chat room");
    }
  );

  socket.on(
    "chat:leave",
    (payload: { gameId?: number }, cb?: (resp: any) => void) => {
    const gameId = Number(payload?.gameId);
    const room = `game:${gameId}`;
    socket.leave(room);
    cb?.({ ok: true });
    logger.info({ socketId: socket.id, room }, "Left chat room");
    }
  );

  socket.on(
    "chat:send",
    (payload: { gameId?: number; sender?: string; displayName?: string; text?: string; }, cb?: (resp: any) => void) => {
    try {
      if (!checkRate(socket.id)) {
        cb?.({ ok: false, error: "Rate limited" });
        return;
      }
      const gameId = Number(payload?.gameId);
      if (!Number.isFinite(gameId) || gameId <= 0) {
        cb?.({ ok: false, error: "Invalid gameId" });
        return;
      }
      const text = sanitize(payload?.text || "");
      if (!text) {
        cb?.({ ok: false, error: "Empty message" });
        return;
      }
      const msg: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        gameId,
        sender: (payload?.sender || "anonymous").toLowerCase(),
        displayName: payload?.displayName?.slice(0, 64) || payload?.sender?.slice(0,8),
        text,
        timestamp: Date.now()
      };
      addMessage(msg);
      const room = `game:${gameId}`;
      io.to(room).emit("chat:message", msg);
      cb?.({ ok: true, message: msg });
    } catch (e: any) {
      logger.warn({ err: e }, "chat:send failed");
      cb?.({ ok: false, error: e.message });
    }
    }
  );

  socket.on("disconnect", () => {
    delete rate[socket.id];
  });
}

export function clearChat(io: SocketIOServer | null, gameId: number) {
  messagesByGame.delete(gameId);
  if (io) {
    const room = `game:${gameId}`;
    io.to(room).emit("chat:cleared", { gameId });
  }
}
