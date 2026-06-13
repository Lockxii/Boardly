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
  const lastEmitRef = useRef(0);
  const socketLiveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const socket = getBoardSocket();
    if (!socket) return;

    joinBoardRoom(boardId);

    const upsertOther = (user: RemotePresence) => {
      setOthers((prev) => {
        const idx = prev.findIndex((p) => p.userId === user.userId);
        if (idx === -1) return [...prev, user];
        const next = [...prev];
        next[idx] = { ...next[idx], ...user };
        return next;
      });
      if (user.cursorX != null && user.cursorY != null) {
        targetsRef.current[user.userId] = { x: user.cursorX, y: user.cursorY };
      }
    };

    const removeOther = (userId: string) => {
      setOthers((prev) => prev.filter((p) => p.userId !== userId));
      delete targetsRef.current[userId];
    };

    const onPresenceState = (users: RemotePresence[]) => {
      if (cancelled) return;
      setOthers(users);
      for (const user of users) {
        if (user.cursorX != null && user.cursorY != null) {
          targetsRef.current[user.userId] = { x: user.cursorX, y: user.cursorY };
        }
      }
    };

    const onPresenceJoin = (user: RemotePresence) => {
      if (cancelled) return;
      upsertOther(user);
    };

    const onPresenceCursor = (user: RemotePresence) => {
      if (cancelled) return;
      upsertOther(user);
    };

    const onPresenceLeave = ({ userId }: { userId: string }) => {
      if (cancelled) return;
      removeOther(userId);
    };

    const onConnect = () => {
      socketLiveRef.current = true;
      socket.emit("board:join", { boardId });
    };
    const onDisconnect = () => {
      socketLiveRef.current = false;
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("presence:state", onPresenceState);
    socket.on("presence:join", onPresenceJoin);
    socket.on("presence:cursor", onPresenceCursor);
    socket.on("presence:leave", onPresenceLeave);
    if (socket.connected) onConnect();

    const httpFallback = async () => {
      if (socketLiveRef.current) return;
      try {
        await apiFetch(`/api/boards/${boardId}/presence`, {
          method: "POST",
          body: JSON.stringify({
            cursorX: cursor?.x ?? null,
            cursorY: cursor?.y ?? null,
          }),
        });
        const data = await apiFetch<RemotePresence[]>(`/api/boards/${boardId}/presence`);
        if (!cancelled) {
          setOthers(data);
          for (const user of data) {
            if (user.cursorX != null && user.cursorY != null) {
              targetsRef.current[user.userId] = { x: user.cursorX, y: user.cursorY };
            }
          }
        }
      } catch {
        /* auth or offline */
      }
    };

    void httpFallback();
    const fallbackInterval = setInterval(httpFallback, 4000);

    return () => {
      cancelled = true;
      clearInterval(fallbackInterval);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("presence:state", onPresenceState);
      socket.off("presence:join", onPresenceJoin);
      socket.off("presence:cursor", onPresenceCursor);
      socket.off("presence:leave", onPresenceLeave);
    };
  }, [boardId]);

  useEffect(() => {
    const socket = getBoardSocket();
    if (!socket?.connected) return;

    const now = Date.now();
    if (now - lastEmitRef.current < 33) return;
    lastEmitRef.current = now;

    socket.emit("presence:cursor", {
      boardId,
      cursorX: cursor?.x ?? null,
      cursorY: cursor?.y ?? null,
    });
  }, [boardId, cursor?.x, cursor?.y]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setRenderPos((prev) => {
        const next: Record<string, { x: number; y: number }> = { ...prev };
        for (const [userId, target] of Object.entries(targetsRef.current)) {
          const current = prev[userId] || target;
          next[userId] = lerpPoint(current, target, 0.35);
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (others.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {others.map((user) => {
        const pos = renderPos[user.userId];
        if (!pos) return null;
        const x = pos.x * camera.zoom + camera.x;
        const y = pos.y * camera.zoom + camera.y;
        const color = cursorColorForUser(user.userId);
        return (
          <div
            key={user.userId}
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
