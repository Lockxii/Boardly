import { createClient, type Client, type JsonObject, type Room, type User } from "@liveblocks/client";
import type { BoardLivePatch } from "@/lib/board-remote-sync";
import type { RemotePresence } from "@/lib/board-socket";
import type { BoardCanvasData } from "@/lib/types";

export type LiveCanvasUpdate = {
  connectionId: string;
  userId: string;
  userName: string;
  updatedAt: string;
  canvasData?: BoardCanvasData;
  patch?: BoardLivePatch;
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

type LiveblocksPresence = {
  cursor: { x: number; y: number } | null;
};

type LiveblocksStorage = Record<string, never>;

type LiveblocksUserMeta = {
  id: string;
  info: {
    name?: string;
    email?: string;
    role?: string;
  };
};

type LiveblocksRoomEvent = JsonObject;

type BoardLiveblocksRoom = Room<LiveblocksPresence, LiveblocksStorage, LiveblocksUserMeta, LiveblocksRoomEvent>;
type BoardLiveblocksUser = User<LiveblocksPresence, LiveblocksUserMeta>;

let client: Client<LiveblocksUserMeta> | null = null;

function getClient() {
  if (!client) {
    client = createClient<LiveblocksUserMeta>({
      throttle: 33,
      lostConnectionTimeout: 2000,
      badgeLocation: "top-right",
      authEndpoint: async (room) => {
        const response = await fetch("/api/liveblocks-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ room }),
        });
        return await response.json();
      },
    });
  }
  return client;
}

function roomIdForBoard(boardId: string) {
  return `board:${boardId}`;
}

function userName(user: BoardLiveblocksUser | null) {
  return user?.info?.name || "Collaborateur";
}

function toRemotePresence(user: BoardLiveblocksUser): RemotePresence {
  const cursor = user.presence.cursor;
  return {
    connectionId: String(user.connectionId),
    userId: user.id || String(user.connectionId),
    userName: userName(user),
    cursorX: cursor?.x ?? null,
    cursorY: cursor?.y ?? null,
  };
}

export function createPresenceConnection(boardId: string, handlers: PresenceHandlers) {
  const localConnectionId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  const { room, leave } = getClient().enterRoom<LiveblocksPresence, LiveblocksStorage, LiveblocksRoomEvent>(
    roomIdForBoard(boardId),
    {
      initialPresence: { cursor: null },
    }
  );
  const boardRoom = room;
  const unsubscribers: Array<() => void> = [];
  let connected = boardRoom.getStatus() === "connected";

  const emitState = () => {
    handlers.onState?.(boardRoom.getOthers().map(toRemotePresence));
  };

  unsubscribers.push(
    boardRoom.subscribe("status", (status) => {
      const nextConnected = status === "connected";
      if (nextConnected === connected) return;
      connected = nextConnected;
      if (nextConnected) {
        handlers.onOpen?.();
        emitState();
      } else {
        handlers.onClose?.();
      }
    })
  );

  unsubscribers.push(
    boardRoom.subscribe("others", (others, event) => {
      handlers.onState?.(others.map(toRemotePresence));

      if (event.type === "enter") {
        const user = toRemotePresence(event.user);
        handlers.onJoin?.(user);
        if (user.cursorX != null && user.cursorY != null) handlers.onCursor?.(user);
        return;
      }

      if (event.type === "leave") {
        handlers.onLeave?.({
          connectionId: String(event.user.connectionId),
          userId: event.user.id,
        });
        return;
      }

      if (event.type === "update") {
        handlers.onCursor?.(toRemotePresence(event.user));
        return;
      }

      handlers.onState?.(others.map(toRemotePresence));
    })
  );

  unsubscribers.push(
    boardRoom.subscribe("event", ({ event, user, connectionId }) => {
      if (event.type === "canvas:patch" && typeof event.updatedAt === "string" && event.patch) {
        handlers.onCanvas?.({
          connectionId: String(connectionId),
          userId: user?.id || String(connectionId),
          userName: userName(user),
          updatedAt: event.updatedAt,
          patch: event.patch as BoardLivePatch,
        });
        return;
      }

      if (event.type === "canvas:live" && typeof event.updatedAt === "string" && event.canvasData) {
        handlers.onCanvas?.({
          connectionId: String(connectionId),
          userId: user?.id || String(connectionId),
          userName: userName(user),
          updatedAt: event.updatedAt,
          canvasData: event.canvasData as BoardCanvasData,
        });
      }
    })
  );

  if (connected) {
    queueMicrotask(() => {
      handlers.onOpen?.();
      emitState();
    });
  }

  return {
    connectionId: localConnectionId,
    isOpen: () => boardRoom.getStatus() === "connected",
    sendCursor: (cursorX: number, cursorY: number) => {
      if (boardRoom.getStatus() === "disconnected") return false;
      boardRoom.updatePresence({ cursor: { x: cursorX, y: cursorY } });
      return true;
    },
    sendCanvas: (canvasData: BoardCanvasData, updatedAt = new Date().toISOString()) => {
      if (boardRoom.getStatus() === "disconnected") return false;
      boardRoom.broadcastEvent({ type: "canvas:live", canvasData, updatedAt } as unknown as LiveblocksRoomEvent);
      return true;
    },
    sendCanvasPatch: (patch: BoardLivePatch) => {
      if (boardRoom.getStatus() === "disconnected") return false;
      boardRoom.broadcastEvent({ type: "canvas:patch", patch, updatedAt: patch.updatedAt } as unknown as LiveblocksRoomEvent);
      return true;
    },
    close: () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      leave();
    },
  };
}
