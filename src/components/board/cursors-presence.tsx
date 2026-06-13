import { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { lerpPoint } from "@/lib/motion-utils";
import { apiFetch } from "@/lib/utils";
import {
  cursorColorForUser,
  getBoardSocket,
  getActiveBoardId,
  joinBoardRoom,
  type RemotePresence,
} from "@/lib/board-socket";

function normalizePresence(user: Partial<RemotePresence> & { userId: string }): RemotePresence {
  return {
    connectionId: user.connectionId || `user:${user.userId}`,
    userId: user.userId,
    userName: user.userName || "Collaborateur",
    cursorX: user.cursorX ?? null,
    cursorY: user.cursorY ?? null,
  };
}

function mergePresence(existing: RemotePresence[], incoming: RemotePresence[]) {
  const map = new Map(existing.map((user) => [user.connectionId, user]));
  for (const user of incoming) {
    map.set(user.connectionId, { ...map.get(user.connectionId), ...user });
  }
  return [...map.values()];
}

export function CursorsPresence({
  boardId,
  camera,
  readOnly = false,
}: {
  boardId: string;
  camera: { x: number; y: number; zoom: number };
  readOnly?: boolean;
}) {
  const [others, setOthers] = useState<RemotePresence[]>([]);
  const [renderPos, setRenderPos] = useState<Record<string, { x: number; y: number }>>({});
  const targetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const cursorRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (readOnly) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { camera: cam } = useCanvasStore.getState();
        cursorRef.current = {
          x: Math.round((e.clientX - cam.x) / cam.zoom),
          y: Math.round((e.clientY - cam.y) / cam.zoom),
        };
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [readOnly]);

  useEffect(() => {
    let cancelled = false;

    const socket = getBoardSocket();
    if (socket) joinBoardRoom(boardId);

    const setTarget = (connectionId: string, x: number, y: number, snap = false) => {
      const pos = { x, y };
      targetsRef.current[connectionId] = pos;
      if (snap) {
        setRenderPos((prev) => ({ ...prev, [connectionId]: pos }));
      }
    };

    const upsertOther = (raw: Partial<RemotePresence> & { userId: string }, snap = false) => {
      const user = normalizePresence(raw);
      setOthers((prev) => mergePresence(prev, [user]));
      if (user.cursorX != null && user.cursorY != null) {
        setTarget(user.connectionId, user.cursorX, user.cursorY, snap);
      }
    };

    const removeOther = (payload: { connectionId?: string; userId?: string }) => {
      if (payload.connectionId) {
        setOthers((prev) => prev.filter((p) => p.connectionId !== payload.connectionId));
        delete targetsRef.current[payload.connectionId];
        setRenderPos((prev) => {
          if (!prev[payload.connectionId!]) return prev;
          const next = { ...prev };
          delete next[payload.connectionId!];
          return next;
        });
        return;
      }
      if (payload.userId) {
        setOthers((prev) => {
          for (const user of prev) {
            if (user.userId === payload.userId) {
              delete targetsRef.current[user.connectionId];
            }
          }
          return prev.filter((p) => p.userId !== payload.userId);
        });
        setRenderPos((prev) => {
          const next = { ...prev };
          for (const connectionId of Object.keys(next)) {
            if (connectionId.startsWith(`user:${payload.userId}`) || connectionId === `http:${payload.userId}`) {
              delete next[connectionId];
            }
          }
          return next;
        });
      }
    };

    const onPresenceState = (users: RemotePresence[]) => {
      if (cancelled) return;
      const normalized = users.map((user) => normalizePresence(user));
      setOthers(normalized);
      for (const user of normalized) {
        if (user.cursorX != null && user.cursorY != null) {
          setTarget(user.connectionId, user.cursorX, user.cursorY, true);
        }
      }
    };

    const onPresenceJoin = (user: RemotePresence) => {
      if (cancelled) return;
      upsertOther(user);
    };

    const onPresenceCursor = (user: RemotePresence) => {
      if (cancelled) return;
      upsertOther(user, true);
    };

    const onPresenceLeave = (payload: { connectionId?: string; userId?: string }) => {
      if (cancelled) return;
      removeOther(payload);
    };

    const onConnect = () => {
      joinBoardRoom(boardId);
    };

    if (socket) {
      socket.on("connect", onConnect);
      socket.on("presence:state", onPresenceState);
      socket.on("presence:join", onPresenceJoin);
      socket.on("presence:cursor", onPresenceCursor);
      socket.on("presence:leave", onPresenceLeave);
      if (socket.connected) onConnect();
    }

    const syncHttpPresence = async () => {
      try {
        const latestCursor = cursorRef.current;
        if (!readOnly) {
          await apiFetch(`/api/boards/${boardId}/presence`, {
            method: "POST",
            body: JSON.stringify({
              cursorX: latestCursor?.x ?? null,
              cursorY: latestCursor?.y ?? null,
            }),
          });
        }

        const data = await apiFetch<RemotePresence[]>(`/api/boards/${boardId}/presence`);
        if (cancelled) return;

        const normalized = data.map((user) => normalizePresence(user));
        setOthers((prev) => mergePresence(prev, normalized));
        for (const user of normalized) {
          if (user.cursorX != null && user.cursorY != null) {
            setTarget(user.connectionId, user.cursorX, user.cursorY, true);
          }
        }
      } catch {
        /* auth or offline */
      }
    };

    void syncHttpPresence();
    const httpInterval = setInterval(syncHttpPresence, 800);

    return () => {
      cancelled = true;
      clearInterval(httpInterval);
      socket?.off("connect", onConnect);
      socket?.off("presence:state", onPresenceState);
      socket?.off("presence:join", onPresenceJoin);
      socket?.off("presence:cursor", onPresenceCursor);
      socket?.off("presence:leave", onPresenceLeave);
    };
  }, [boardId, readOnly]);

  useEffect(() => {
    if (readOnly) return;

    const emit = () => {
      const latest = cursorRef.current;
      const socket = getBoardSocket();
      if (socket?.connected && getActiveBoardId() === boardId) {
        socket.emit("presence:cursor", {
          boardId,
          cursorX: latest?.x ?? null,
          cursorY: latest?.y ?? null,
        });
      }
    };

    emit();
    const interval = setInterval(emit, 50);
    return () => clearInterval(interval);
  }, [boardId, readOnly]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setRenderPos((prev) => {
        const next: Record<string, { x: number; y: number }> = { ...prev };
        let changed = false;
        for (const [connectionId, target] of Object.entries(targetsRef.current)) {
          const current = prev[connectionId] || target;
          const lerped = lerpPoint(current, target, 0.45);
          if (current.x !== lerped.x || current.y !== lerped.y) changed = true;
          next[connectionId] = lerped;
        }
        return changed ? next : prev;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const visibleOthers = others.filter(
    (user) => renderPos[user.connectionId] && user.cursorX != null && user.cursorY != null
  );
  if (visibleOthers.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[45] overflow-hidden">
      {visibleOthers.map((user) => {
        const pos = renderPos[user.connectionId];
        if (!pos) return null;
        const x = pos.x * camera.zoom + camera.x;
        const y = pos.y * camera.zoom + camera.y;
        const color = cursorColorForUser(user.userId);
        return (
          <div
            key={user.connectionId}
            className="absolute flex items-start gap-1 remote-cursor"
            style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" className="drop-shadow-sm">
              <path d="M0 0 L0 14 L4 10 L7 16 L9 15 L6 9 L12 9 Z" fill={color} />
            </svg>
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {user.userName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
