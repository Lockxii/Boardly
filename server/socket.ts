import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { fromNodeHeaders } from "better-auth/node";
import { auth, getAuthBaseURL, getTrustedOrigins } from "./auth.js";
import { getBoardAccess } from "./board-access.js";
import { verifyRealtimeToken } from "./realtime-auth.js";

export type BoardUpdatedEvent = {
  boardId: string;
  updatedAt: string;
  userId: string;
  userName: string;
};

export type RemotePresencePayload = {
  userId: string;
  userName: string;
  cursorX: number | null;
  cursorY: number | null;
};

type SocketUser = { id: string; name: string; email: string };

type RoomMember = RemotePresencePayload & { socketId: string };

const roomMembers = new Map<string, Map<string, RoomMember>>();

let io: Server | null = null;

function roomKey(boardId: string) {
  return `board:${boardId}`;
}

function getOthers(boardId: string, excludeUserId: string): RemotePresencePayload[] {
  const room = roomMembers.get(boardId);
  if (!room) return [];
  return [...room.values()]
    .filter((member) => member.userId !== excludeUserId)
    .map(({ userId, userName, cursorX, cursorY }) => ({ userId, userName, cursorX, cursorY }));
}

function removeMember(boardId: string, userId: string) {
  roomMembers.get(boardId)?.delete(userId);
  if (roomMembers.get(boardId)?.size === 0) roomMembers.delete(boardId);
}

function upsertMember(
  boardId: string,
  user: SocketUser,
  socketId: string,
  cursorX: number | null = null,
  cursorY: number | null = null
) {
  if (!roomMembers.has(boardId)) roomMembers.set(boardId, new Map());
  roomMembers.get(boardId)!.set(user.id, {
    userId: user.id,
    userName: user.name,
    cursorX,
    cursorY,
    socketId,
  });
}

export function initSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = new Set(getTrustedOrigins());
        const base = getAuthBaseURL();
        if (base) allowed.add(base);
        callback(null, allowed.has(origin.replace(/\/$/, "")));
      },
      credentials: true,
    },
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });

  io.use(async (socket, next) => {
    try {
      const tokenUser = verifyRealtimeToken(socket.handshake.auth?.token);
      if (tokenUser) {
        socket.data.user = tokenUser satisfies SocketUser;
        socket.data.boardIds = new Set<string>();
        next();
        return;
      }

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(socket.request.headers),
      });
      if (!session?.user?.email) return next(new Error("Unauthorized"));
      socket.data.user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      } satisfies SocketUser;
      socket.data.boardIds = new Set<string>();
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;

    socket.on("board:join", async ({ boardId }: { boardId?: string }) => {
      if (!boardId || typeof boardId !== "string") return;

      const access = await getBoardAccess(boardId, user);
      if (!access) return;

      for (const joinedId of socket.data.boardIds as Set<string>) {
        socket.leave(roomKey(joinedId));
        removeMember(joinedId, user.id);
        socket.to(roomKey(joinedId)).emit("presence:leave", { userId: user.id });
      }
      (socket.data.boardIds as Set<string>).clear();

      socket.join(roomKey(boardId));
      (socket.data.boardIds as Set<string>).add(boardId);
      upsertMember(boardId, user, socket.id);

      socket.emit("presence:state", getOthers(boardId, user.id));
      socket.to(roomKey(boardId)).emit("presence:join", {
        userId: user.id,
        userName: user.name,
        cursorX: null,
        cursorY: null,
      });
    });

    socket.on("board:leave", ({ boardId }: { boardId?: string }) => {
      if (!boardId || !(socket.data.boardIds as Set<string>).has(boardId)) return;
      socket.leave(roomKey(boardId));
      (socket.data.boardIds as Set<string>).delete(boardId);
      removeMember(boardId, user.id);
      socket.to(roomKey(boardId)).emit("presence:leave", { userId: user.id });
    });

    socket.on(
      "presence:cursor",
      ({ boardId, cursorX, cursorY }: { boardId?: string; cursorX?: number | null; cursorY?: number | null }) => {
        if (!boardId || !(socket.data.boardIds as Set<string>).has(boardId)) return;

        const room = roomMembers.get(boardId);
        const member = room?.get(user.id);
        if (member) {
          member.cursorX = typeof cursorX === "number" ? cursorX : null;
          member.cursorY = typeof cursorY === "number" ? cursorY : null;
        }

        socket.to(roomKey(boardId)).emit("presence:cursor", {
          userId: user.id,
          userName: user.name,
          cursorX: typeof cursorX === "number" ? cursorX : null,
          cursorY: typeof cursorY === "number" ? cursorY : null,
        });
      }
    );

    socket.on("disconnect", () => {
      for (const boardId of socket.data.boardIds as Set<string>) {
        removeMember(boardId, user.id);
        io?.to(roomKey(boardId)).emit("presence:leave", { userId: user.id });
      }
    });
  });

  console.log("🔌 Socket.io ready on /socket.io");
  return io;
}

export function emitBoardUpdated(event: BoardUpdatedEvent) {
  io?.to(roomKey(event.boardId)).emit("board:updated", event);
}

export function isSocketServerReady() {
  return io !== null;
}
