import { io, type Socket } from "socket.io-client";

export type RemotePresence = {
  connectionId: string;
  userId: string;
  userName: string;
  cursorX: number | null;
  cursorY: number | null;
};

export type BoardUpdatedEvent = {
  boardId: string;
  updatedAt: string;
  userId: string;
  userName: string;
};

type JoinAck = { ok: boolean; error?: string };

let socket: Socket | null = null;
let refCount = 0;
let activeBoardId: string | null = null;
let joinedBoardId: string | null = null;
let tokenCache: { token: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string | null> | null = null;

function getSocketUrl() {
  const configuredUrl = (import.meta.env.VITE_SOCKET_URL || "").trim();
  if (configuredUrl) return configuredUrl;
  return window.location.origin;
}

async function getRealtimeToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  if (tokenRequest) return tokenRequest;

  tokenRequest = fetch("/api/realtime/token", { credentials: "include" })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json()) as { token?: string; expiresAt?: number };
      if (!data.token || !data.expiresAt) return null;
      tokenCache = { token: data.token, expiresAt: data.expiresAt };
      return data.token;
    })
    .catch(() => null)
    .finally(() => {
      tokenRequest = null;
    });

  return tokenRequest;
}

function createSocket() {
  const url = getSocketUrl();
  if (!url) return null;
  const usesExternalSocket = Boolean((import.meta.env.VITE_SOCKET_URL || "").trim());
  const client = io(url, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    upgrade: true,
    rememberUpgrade: true,
    withCredentials: true,
    auth: usesExternalSocket
      ? async (callback) => {
          callback({ token: await getRealtimeToken() });
        }
      : undefined,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
    reconnectionAttempts: Infinity,
    timeout: 10_000,
  });

  client.on("connect_error", () => {
    tokenCache = null;
  });

  return client;
}

export function acquireBoardSocket() {
  refCount += 1;
  if (!socket) {
    socket = createSocket();
    if (!socket) return null;
  } else if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function releaseBoardSocket() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && socket) {
    if (activeBoardId) {
      socket.emit("board:leave", { boardId: activeBoardId });
      activeBoardId = null;
      joinedBoardId = null;
    }
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function joinBoardRoom(boardId: string) {
  if (!socket) return null;
  if (activeBoardId === boardId && joinedBoardId === boardId) return socket;
  if (activeBoardId && activeBoardId !== boardId) {
    socket.emit("board:leave", { boardId: activeBoardId });
    joinedBoardId = null;
  }
  activeBoardId = boardId;
  joinedBoardId = boardId;

  const join = () => {
    socket?.emit("board:join", { boardId }, (ack?: JoinAck) => {
      if (ack?.ok === false) joinedBoardId = null;
    });
  };

  if (socket.connected) join();
  else socket.once("connect", join);

  return socket;
}

export function getBoardSocket() {
  return socket;
}

export function getActiveBoardId() {
  return activeBoardId;
}

export function isBoardSocketConnected() {
  return !!socket?.connected;
}

export function isBoardRoomJoined(boardId: string) {
  return joinedBoardId === boardId && !!socket?.connected;
}

export function emitPresenceCursor(boardId: string, cursorX: number, cursorY: number) {
  if (!socket?.connected || activeBoardId !== boardId) return;
  socket.volatile.emit("presence:cursor", { boardId, cursorX, cursorY });
}

const CURSOR_COLORS = ["#2563EB", "#DC2626", "#16A34A", "#D97706", "#9333EA", "#0891B2", "#DB2777"];

export function cursorColorForUser(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}
