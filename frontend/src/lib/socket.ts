import { io, Socket } from "socket.io-client";
import { BASE_URL } from "./api";

let socket: Socket | null = null;

function getSocketUrl() {
  const url = BASE_URL;
  // Socket.io client will automatically use WebSocket path
  return url;
}

export function connectSocket() {
  if (socket && socket.connected) return socket;
  const url = getSocketUrl();
  socket = io(url, {
    transports: ["websocket"],
    autoConnect: true
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function onChatMessage(handler: (msg: any) => void) {
  connectSocket();
  socket!.on("chat:message", handler);
  return () => socket?.off("chat:message", handler);
}

export function onChatCleared(handler: (payload: any) => void) {
  connectSocket();
  socket!.on("chat:cleared", handler);
  return () => socket?.off("chat:cleared", handler);
}

export function joinChat(gameId: number, user?: string, displayName?: string, senderType?: "agent" | "human") {
  connectSocket();
  return new Promise<{ ok: boolean; history?: any[]; error?: string }>((resolve) => {
    socket!.emit("chat:join", { gameId, user, displayName, senderType }, (resp: any) => resolve(resp));
  });
}

export function leaveChat(gameId: number) {
  if (!socket) return Promise.resolve({ ok: true });
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    socket!.emit("chat:leave", { gameId }, (resp: any) => resolve(resp));
  });
}

export function sendChat(gameId: number, sender: string, text: string, displayName?: string, senderType?: "agent" | "human") {
  connectSocket();
  return new Promise<{ ok: boolean; message?: any; error?: string }>((resolve) => {
    socket!.emit("chat:send", { gameId, sender, text, displayName, senderType }, (resp: any) => resolve(resp));
  });
}
