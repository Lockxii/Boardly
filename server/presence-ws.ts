import type { IncomingMessage, Server as HttpServer } from "http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { getBoardAccess } from "./board-access.js";
import { verifyRealtimeToken, type RealtimeTokenUser } from "./realtime-auth.js";

type PresenceUser = RealtimeTokenUser;

type PresenceClient = {
  connectionId: string;
  boardId: string;
  user: PresenceUser;
  ws: WebSocket;
  cursorX: number | null;
  cursorY: number | null;
  lastSeen: number;
};

type PresencePayload = {
  connectionId: string;
  userId: string;
  userName: string;
  cursorX: number | null;
  cursorY: number | null;
};

const rooms = new Map<string, Map<string, PresenceClient>>();

function presencePath(pathname: string) {
  const match = pathname.match(/^\/api\/presence\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function presencePayload(client: PresenceClient): PresencePayload {
  return {
    connectionId: client.connectionId,
    userId: client.user.id,
    userName: client.user.name,
    cursorX: client.cursorX,
    cursorY: client.cursorY,
  };
}

function send(ws: WebSocket, type: string, payload: unknown) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type, payload }));
}

function broadcast(boardId: string, type: string, payload: unknown, exceptConnectionId?: string) {
  const room = rooms.get(boardId);
  if (!room) return;
  for (const client of room.values()) {
    if (client.connectionId === exceptConnectionId) continue;
    send(client.ws, type, payload);
  }
}

function removeClient(client: PresenceClient) {
  const room = rooms.get(client.boardId);
  if (!room) return;
  if (room.get(client.connectionId) !== client) return;
  room.delete(client.connectionId);
  if (room.size === 0) rooms.delete(client.boardId);
  broadcast(client.boardId, "presence:leave", {
    connectionId: client.connectionId,
    userId: client.user.id,
  });
}

function stateFor(boardId: string, excludeConnectionId: string) {
  const room = rooms.get(boardId);
  if (!room) return [];
  return [...room.values()]
    .filter((client) => client.connectionId !== excludeConnectionId)
    .map(presencePayload);
}

function rejectUpgrade(req: IncomingMessage, status: number, message: string) {
  req.socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  req.socket.destroy();
}

export function initPresenceWebSocketServer(httpServer: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", async (req, socket, head) => {
    let url: URL;
    try {
      url = new URL(req.url || "", "http://localhost");
    } catch {
      return;
    }

    const boardId = presencePath(url.pathname);
    if (!boardId) return;

    const token = url.searchParams.get("token");
    const user = verifyRealtimeToken(token);
    const connectionId = url.searchParams.get("connectionId") || "";
    if (!user || !connectionId) {
      rejectUpgrade(req, 401, "Unauthorized");
      return;
    }

    const access = await getBoardAccess(boardId, user);
    if (!access) {
      rejectUpgrade(req, 403, "Forbidden");
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, { boardId, user, connectionId });
    });
  });

  wss.on(
    "connection",
    (
      ws: WebSocket,
      _req: IncomingMessage,
      context: {
        boardId: string;
        user: PresenceUser;
        connectionId: string;
      }
    ) => {
      const client: PresenceClient = {
        boardId: context.boardId,
        user: context.user,
        connectionId: context.connectionId,
        ws,
        cursorX: null,
        cursorY: null,
        lastSeen: Date.now(),
      };

      if (!rooms.has(client.boardId)) rooms.set(client.boardId, new Map());
      const room = rooms.get(client.boardId)!;
      const previous = room.get(client.connectionId);
      previous?.ws.close();
      room.set(client.connectionId, client);

      send(ws, "presence:state", stateFor(client.boardId, client.connectionId));
      broadcast(client.boardId, "presence:join", presencePayload(client), client.connectionId);

      ws.on("message", (raw: RawData) => {
        let message: { type?: string; cursorX?: unknown; cursorY?: unknown };
        try {
          message = JSON.parse(String(raw));
        } catch {
          return;
        }

        if (message.type === "ping") {
          client.lastSeen = Date.now();
          send(ws, "pong", { t: client.lastSeen });
          return;
        }

        if (message.type !== "cursor") return;
        client.lastSeen = Date.now();
        client.cursorX = typeof message.cursorX === "number" && Number.isFinite(message.cursorX) ? message.cursorX : null;
        client.cursorY = typeof message.cursorY === "number" && Number.isFinite(message.cursorY) ? message.cursorY : null;
        broadcast(client.boardId, "presence:cursor", presencePayload(client), client.connectionId);
      });

      ws.on("close", () => removeClient(client));
      ws.on("error", () => removeClient(client));
    }
  );

  const cleanupInterval = setInterval(() => {
    const cutoff = Date.now() - 45_000;
    for (const room of rooms.values()) {
      for (const client of room.values()) {
        if (client.lastSeen < cutoff || client.ws.readyState === WebSocket.CLOSED) removeClient(client);
      }
    }
  }, 15_000);
  cleanupInterval.unref?.();

  console.log("🟢 Presence WebSocket ready on /api/presence/:boardId");
  return wss;
}
