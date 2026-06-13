import { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { lerpPoint } from "@/lib/motion-utils";
import { apiFetch } from "@/lib/utils";
import {
  cursorColorForUser,
  getBoardSocket,
  isBoardRoomJoined,
  joinBoardRoom,
  type RemotePresence,
} from "@/lib/board-socket";

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
  const cursor = useCanvasStore((s) => s.cursor);
  const targetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const cursorRef = useRef(cursor);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

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

    const upsertOther = (user: RemotePresence, snap = false) => {
      setOthers((prev) => mergePresence(prev, [user]));
      if (user.cursorX != null && user.cursorY != null) {
        setTarget(user.connectionId, user.cursorX, user.cursorY, snap);
      }
    };

    const removeOther = (connectionId: string) => {
      setOthers((prev) => prev.filter((p) => p.connectionId !== connectionId));
      delete targetsRef.current[connectionId];
      setRenderPos((prev) => {
        if (!prev[connectionId]) return prev;
        const next = { ...prev };
        delete next[connectionId];
        return next;
      });
    };

    const onPresenceState = (users: RemotePresence[]) => {
      if (cancelled) return;
      setOthers(users);
      for (const user of users) {
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

    const onPresenceLeave = ({ connectionId }: { connectionId: string }) => {
      if (cancelled) return;
      removeOther(connectionId);
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

        const normalized = data.map((user) => ({
          ...user,
          connectionId: user.connectionId || `http:${user.userId}`,
        }));

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
    const httpInterval = setInterval(syncHttpPresence, 1000);

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
      if (socket?.connected && isBoardRoomJoined(boardId)) {
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

  const visibleOthers = others.filter((user) => renderPos[user.connectionId]);
  if (visibleOthers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[30] overflow-hidden">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          willChange: "transform",
        }}
      >
        {visibleOthers.map((user) => {
          const pos = renderPos[user.connectionId];
          if (!pos) return null;
          const color = cursorColorForUser(user.userId);
          return (
            <div
              key={user.connectionId}
              className="absolute flex items-start gap-1 remote-cursor"
              style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
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
    </div>
  );
}
