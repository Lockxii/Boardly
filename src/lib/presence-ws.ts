import { getRealtimeToken, type RemotePresence } from "@/lib/board-socket";
import type { BoardCanvasData } from "@/lib/types";

export type LiveCanvasUpdate = {
  connectionId: string;
  userId: string;
  userName: string;
  updatedAt: string;
  canvasData: BoardCanvasData;
};

type PresenceHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onState?: (users: RemotePresence[]) => void;
  onJoin?: (user: RemotePresence) => void;
  onCursor?: (user: RemotePresence) => void;
  onLeave?: (payload: { connectionId?: string; userId?: string }) => void;
  onCanvas?: (update: LiveCanvasUpdate) => void;
};

function getPresenceBaseUrl() {
  return (import.meta.env.VITE_SOCKET_URL || "").trim() || window.location.origin;
}

function buildPresenceUrl(boardId: string, connectionId: string, token: string) {
  const url = new URL(`/api/presence/${encodeURIComponent(boardId)}`, getPresenceBaseUrl());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("connectionId", connectionId);
  url.searchParams.set("token", token);
  return url.toString();
}

export function createPresenceConnection(boardId: string, handlers: PresenceHandlers) {
  const connectionId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  let socket: WebSocket | null = null;
  let reconnectTimer = 0;
  let heartbeatTimer = 0;
  let closed = false;
  let retry = 0;

  const cleanupSocket = () => {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = 0;
    if (!socket) return;
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.close();
    socket = null;
  };

  const scheduleReconnect = () => {
    if (closed) return;
    window.clearTimeout(reconnectTimer);
    const delay = Math.min(4000, 250 * 2 ** retry);
    retry += 1;
    reconnectTimer = window.setTimeout(connect, delay);
  };

  const handleMessage = (event: MessageEvent) => {
    let message: { type?: string; payload?: unknown };
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }

    switch (message.type) {
      case "presence:state":
        handlers.onState?.((Array.isArray(message.payload) ? message.payload : []) as RemotePresence[]);
        break;
      case "presence:join":
        handlers.onJoin?.(message.payload as RemotePresence);
        break;
      case "presence:cursor":
        handlers.onCursor?.(message.payload as RemotePresence);
        break;
      case "presence:leave":
        handlers.onLeave?.(message.payload as { connectionId?: string; userId?: string });
        break;
      case "canvas:live":
        handlers.onCanvas?.(message.payload as LiveCanvasUpdate);
        break;
    }
  };

  async function connect() {
    if (closed) return;
    cleanupSocket();
    const token = await getRealtimeToken();
    if (!token || closed) {
      scheduleReconnect();
      return;
    }

    const nextSocket = new WebSocket(buildPresenceUrl(boardId, connectionId, token));
    socket = nextSocket;

    nextSocket.onopen = () => {
      retry = 0;
      handlers.onOpen?.();
      heartbeatTimer = window.setInterval(() => {
        if (nextSocket.readyState === WebSocket.OPEN) {
          nextSocket.send(JSON.stringify({ type: "ping" }));
        }
      }, 20_000);
    };
    nextSocket.onmessage = handleMessage;
    nextSocket.onerror = () => {
      nextSocket.close();
    };
    nextSocket.onclose = () => {
      if (socket === nextSocket) socket = null;
      handlers.onClose?.();
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = 0;
      scheduleReconnect();
    };
  }

  void connect();

  return {
    connectionId,
    isOpen: () => socket?.readyState === WebSocket.OPEN,
    sendCursor: (cursorX: number, cursorY: number) => {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({ type: "cursor", cursorX, cursorY }));
      return true;
    },
    sendCanvas: (canvasData: BoardCanvasData, updatedAt = new Date().toISOString()) => {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({ type: "canvas", canvasData, updatedAt }));
      return true;
    },
    close: () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      cleanupSocket();
    },
  };
}
