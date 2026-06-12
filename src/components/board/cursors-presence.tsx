import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/utils";
import { useCanvasStore } from "@/store/canvas-store";
import { lerpPoint } from "@/lib/motion-utils";

type RemotePresence = {
  userId: string;
  userName: string;
  cursorX: number | null;
  cursorY: number | null;
};

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
  const cursorSyncRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      try {
        await apiFetch(`/api/boards/${boardId}/presence`, {
          method: "POST",
          body: JSON.stringify({
            cursorX: cursor?.x ?? null,
            cursorY: cursor?.y ?? null,
          }),
        });
      } catch {}
    };

    const poll = async () => {
      try {
        const data = await apiFetch<RemotePresence[]>(`/api/boards/${boardId}/presence`);
        if (!cancelled) {
          setOthers(data);
          for (const user of data) {
            if (user.cursorX != null && user.cursorY != null) {
              targetsRef.current[user.userId] = { x: user.cursorX, y: user.cursorY };
            }
          }
        }
      } catch {}
    };

    void ping();
    void poll();
    const pingInterval = setInterval(ping, 3000);
    const pollInterval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(pingInterval);
      clearInterval(pollInterval);
    };
  }, [boardId, cursor?.x, cursor?.y]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setRenderPos((prev) => {
        const next: Record<string, { x: number; y: number }> = { ...prev };
        for (const [userId, target] of Object.entries(targetsRef.current)) {
          const current = prev[userId] || target;
          next[userId] = lerpPoint(current, target, 0.28);
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
        return (
          <div
            key={user.userId}
            className="absolute flex items-start gap-1 remote-cursor"
            style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" className="drop-shadow-sm">
              <path d="M0 0 L0 14 L4 10 L7 16 L9 15 L6 9 L12 9 Z" fill="#2563EB" />
            </svg>
            <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm">
              {user.userName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
