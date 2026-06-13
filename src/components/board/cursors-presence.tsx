import { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { lerpPoint } from "@/lib/motion-utils";
import { apiFetch } from "@/lib/utils";
import {
  cursorColorForUser,
  getBoardSocket,
  joinBoardRoom,
  type RemotePresence,
} from "@/lib/board-socket";

export function CursorsPresence({
  boardId,
  camera,
}: {
  boardId: string;
  camera: { x: number; y: number; zoom: number };
}) {
  const [others, setOthers] = useState<RemotePresence[]>([]);
  const [renderPos, setRenderPos] = useState<Record<string, { x: number; y: number }>>({});
  const cursor = useCanvasStore((s) => s.cursor);
  const targetsRef = useRef<Record<string, { x: number; y: number }>>({});
  const socketLiveRef = useRef(false);
  const cursorRef = useRef(cursor);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    let cancelled = false;

    const socket = getBoardSocket();
    if (socket) joinBoardRoom(boardId);

    const setTarget = (userId: string, x: number, y: number, snap = false) => {
      const pos = { x, y };
      targetsRef.current[userId] = pos;
      if (snap) {
        setRenderPos((prev) => ({ ...prev, [userId]: pos }));
      }
    };

    const upsertOther = (user: RemotePresence, snap = false) => {
      setOthers((prev) => {
        const idx = prev.findIndex((p) => p.userId === user.userId);
        if (idx === -1) return [...prev, user];
        const next = [...prev];
        next[idx] = { ...next[idx], ...user };
        return next;
      });
      if (user.cursorX != null && user.cursorY != null) {
        setTarget(user.userId, user.cursorX, user.cursorY, snap);
      }
    };

    const removeOther = (userId: string) => {
      setOthers((prev) => prev.filter((p) => p.userId !== userId));
      delete targetsRef.current[userId];
      setRenderPos((prev) => {
        if (!prev[userId]) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };

    const onPresenceState = (users: RemotePresence[]) => {
      if (cancelled) return;
      setOthers(users);
      for (const user of users) {
        if (user.cursorX != null && user.cursorY != null) {
          setTarget(user.userId, user.cursorX, user.cursorY, true);
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

    const onPresenceLeave = ({ userId }: { userId: string }) => {
      if (cancelled) return;
      removeOther(userId);
    };

    const onConnect = () => {
      socketLiveRef.current = true;
      socket?.emit("board:join", { boardId });
    };
    const onDisconnect = () => {
      socketLiveRef.current = false;
    };

    if (socket) {
      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("presence:state", onPresenceState);
      socket.on("presence:join", onPresenceJoin);
      socket.on("presence:cursor", onPresenceCursor);
      socket.on("presence:leave", onPresenceLeave);
      if (socket.connected) onConnect();
    }

    const httpFallback = async () => {
      if (socketLiveRef.current) return;
      try {
        const latestCursor = cursorRef.current;
        await apiFetch(`/api/boards/${boardId}/presence`, {
          method: "POST",
          body: JSON.stringify({
            cursorX: latestCursor?.x ?? null,
            cursorY: latestCursor?.y ?? null,
          }),
        });
        const data = await apiFetch<RemotePresence[]>(`/api/boards/${boardId}/presence`);
        if (!cancelled) {
          setOthers(data);
          for (const user of data) {
            if (user.cursorX != null && user.cursorY != null) {
              setTarget(user.userId, user.cursorX, user.cursorY, true);
            }
          }
        }
      } catch {
        /* auth or offline */
      }
    };

    void httpFallback();
    const fallbackInterval = setInterval(httpFallback, 1500);

    return () => {
      cancelled = true;
      clearInterval(fallbackInterval);
      socket?.off("connect", onConnect);
      socket?.off("disconnect", onDisconnect);
      socket?.off("presence:state", onPresenceState);
      socket?.off("presence:join", onPresenceJoin);
      socket?.off("presence:cursor", onPresenceCursor);
      socket?.off("presence:leave", onPresenceLeave);
    };
  }, [boardId]);

  useEffect(() => {
    const emit = () => {
      const socket = getBoardSocket();
      if (!socket?.connected) return;
      const latest = cursorRef.current;
      socket.emit("presence:cursor", {
        boardId,
        cursorX: latest?.x ?? null,
        cursorY: latest?.y ?? null,
      });
    };

    emit();
    const interval = setInterval(emit, 50);
    return () => clearInterval(interval);
  }, [boardId]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setRenderPos((prev) => {
        const next: Record<string, { x: number; y: number }> = { ...prev };
        let changed = false;
        for (const [userId, target] of Object.entries(targetsRef.current)) {
          const current = prev[userId] || target;
          const lerped = lerpPoint(current, target, 0.45);
          if (current.x !== lerped.x || current.y !== lerped.y) changed = true;
          next[userId] = lerped;
        }
        return changed ? next : prev;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (others.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[30] overflow-hidden">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          willChange: "transform",
        }}
      >
        {others.map((user) => {
          const pos = renderPos[user.userId];
          if (!pos) return null;
          const color = cursorColorForUser(user.userId);
          return (
            <div
              key={user.userId}
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
