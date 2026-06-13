import { io, type Socket } from "socket.io-client";

export type RemotePresence = {
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

let socket: Socket | null = null;
let refCount = 0;
let activeBoardId: string | null = null;

function createSocket() {
  const url = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  return io(url, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 800,
    reconnectionDelayMax: 4000,
    reconnectionAttempts: Infinity,
    timeout: 10_000,
  });
}

export function acquireBoardSocket() {
  refCount += 1;
  if (!socket) {
    socket = createSocket();
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
    }
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function joinBoardRoom(boardId: string) {
  if (!socket) return null;
  if (activeBoardId === boardId) return socket;
  if (activeBoardId) socket.emit("board:leave", { boardId: activeBoardId });
  activeBoardId = boardId;

  const join = () => socket?.emit("board:join", { boardId });
  if (socket.connected) join();
  else socket.once("connect", join);

  return socket;
}

export function getBoardSocket() {
  return socket;
}

export function isBoardSocketConnected() {
  return !!socket?.connected;
}

const CURSOR_COLORS = ["#2563EB", "#DC2626", "#16A34A", "#D97706", "#9333EA", "#0891B2", "#DB2777"];

export function cursorColorForUser(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}
