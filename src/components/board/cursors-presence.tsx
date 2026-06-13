import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { apiFetch } from "@/lib/utils";
import { cursorColorForUser, type RemotePresence } from "@/lib/board-socket";
import { createPresenceConnection } from "@/lib/presence-ws";

const CURSOR_EMIT_INTERVAL_MS = 50;
const PEER_TIMEOUT_MS = 30_000;
const CURSOR_LERP = 0.32;

type Peer = {
  connectionId: string;
  userId: string;
  userName: string;
  targetX: number;
  targetY: number;
  screenX: number | null;
  screenY: number | null;
  lastSeen: number;
  el: HTMLDivElement | null;
};

function normalizePresence(user: Partial<RemotePresence> & { userId: string }): RemotePresence {
  return {
    connectionId: user.connectionId || `user:${user.userId}`,
    userId: user.userId,
    userName: user.userName || "Collaborateur",
    cursorX: user.cursorX ?? null,
    cursorY: user.cursorY ?? null,
  };
}

function createCursorElement(peer: Peer) {
  const color = cursorColorForUser(peer.userId);
  const root = document.createElement("div");
  root.className = "absolute flex items-start gap-1 remote-cursor";
  root.style.willChange = "transform";

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "20");
  svg.setAttribute("viewBox", "0 0 16 20");
  svg.setAttribute("class", "drop-shadow-sm");

  const path = document.createElementNS(svgNS, "path");
  path.setAttribute("d", "M0 0 L0 14 L4 10 L7 16 L9 15 L6 9 L12 9 Z");
  path.setAttribute("fill", color);
  svg.appendChild(path);

  const label = document.createElement("span");
  label.className = "rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm";
  label.style.backgroundColor = color;
  label.textContent = peer.userName;

  root.appendChild(svg);
  root.appendChild(label);
  return root;
}

export function CursorsPresence({
  boardId,
  readOnly = false,
}: {
  boardId: string;
  camera: { x: number; y: number; zoom: number };
  readOnly?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const peersRef = useRef(new Map<string, Peer>());
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastEmitRef = useRef<{ x: number; y: number } | null>(null);
  const lastEmitAtRef = useRef(0);
  const presenceLiveRef = useRef(false);
  const presenceRef = useRef<ReturnType<typeof createPresenceConnection> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const upsertPeer = (raw: Partial<RemotePresence> & { userId: string }) => {
      const user = normalizePresence(raw);
      if (user.cursorX == null || user.cursorY == null) return;

      let peer = peersRef.current.get(user.connectionId);
      if (!peer) {
        peer = {
          connectionId: user.connectionId,
          userId: user.userId,
          userName: user.userName,
          targetX: user.cursorX,
          targetY: user.cursorY,
          screenX: null,
          screenY: null,
          lastSeen: performance.now(),
          el: null,
        };
        peersRef.current.set(user.connectionId, peer);
      } else {
        peer.userName = user.userName;
        peer.targetX = user.cursorX;
        peer.targetY = user.cursorY;
        peer.lastSeen = performance.now();
      }

      if (!peer.el) {
        peer.el = createCursorElement(peer);
        container.appendChild(peer.el);
      }
    };

    const removePeer = (payload: { connectionId?: string; userId?: string }) => {
      if (payload.connectionId) {
        const peer = peersRef.current.get(payload.connectionId);
        peer?.el?.remove();
        peersRef.current.delete(payload.connectionId);
        return;
      }
      if (!payload.userId) return;
      for (const [connectionId, peer] of peersRef.current) {
        if (peer.userId === payload.userId) {
          peer.el?.remove();
          peersRef.current.delete(connectionId);
        }
      }
    };

    let cancelled = false;

    const onPresenceState = (users: RemotePresence[]) => {
      if (cancelled) return;
      presenceLiveRef.current = true;
      for (const user of users) upsertPeer(user);
    };

    const onPresenceJoin = (user: RemotePresence) => {
      if (cancelled) return;
      if (user.cursorX != null && user.cursorY != null) upsertPeer(user);
    };

    const onPresenceCursor = (user: RemotePresence) => {
      if (cancelled) return;
      presenceLiveRef.current = true;
      upsertPeer(user);
    };

    presenceRef.current = createPresenceConnection(boardId, {
      onOpen: () => {
        presenceLiveRef.current = true;
      },
      onClose: () => {
        presenceLiveRef.current = false;
      },
      onState: onPresenceState,
      onJoin: onPresenceJoin,
      onCursor: onPresenceCursor,
      onLeave: removePeer,
    });

    const syncHttpFallback = async () => {
      if (cancelled || presenceLiveRef.current) return;
      try {
        const latest = pointerRef.current;
        if (!readOnly) {
          await apiFetch(`/api/boards/${boardId}/presence`, {
            method: "POST",
            body: JSON.stringify({
              cursorX: latest?.x ?? null,
              cursorY: latest?.y ?? null,
            }),
          });
        }
        const data = await apiFetch<RemotePresence[]>(`/api/boards/${boardId}/presence`);
        if (cancelled || presenceLiveRef.current) return;
        for (const user of data) upsertPeer(normalizePresence(user));
      } catch {
        /* offline */
      }
    };

    const httpInterval = setInterval(syncHttpFallback, 2000);

    return () => {
      cancelled = true;
      clearInterval(httpInterval);
      presenceRef.current?.close();
      presenceRef.current = null;
      for (const peer of peersRef.current.values()) peer.el?.remove();
      peersRef.current.clear();
    };
  }, [boardId, readOnly]);

  useEffect(() => {
    if (readOnly) return;

    const onPointerMove = (e: PointerEvent) => {
      const cam = useCanvasStore.getState().camera;
      pointerRef.current = {
        x: (e.clientX - cam.x) / cam.zoom,
        y: (e.clientY - cam.y) / cam.zoom,
      };
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [readOnly]);

  useEffect(() => {
    if (readOnly) return;

    let raf = 0;
    let lastFrameAt = performance.now();
    const tick = () => {
      const now = performance.now();
      const cam = useCanvasStore.getState().camera;
      const pointer = pointerRef.current;

      if (pointer && now - lastEmitAtRef.current >= CURSOR_EMIT_INTERVAL_MS) {
        const last = lastEmitRef.current;
        if (
          !last ||
          Math.abs(last.x - pointer.x) > 0.25 ||
          Math.abs(last.y - pointer.y) > 0.25
        ) {
          lastEmitAtRef.current = now;
          lastEmitRef.current = { x: pointer.x, y: pointer.y };
          presenceRef.current?.sendCursor(pointer.x, pointer.y);
        }
      }

      for (const peer of peersRef.current.values()) {
        if (!peer.el) continue;
        if (now - peer.lastSeen > PEER_TIMEOUT_MS) {
          peer.el.remove();
          peersRef.current.delete(peer.connectionId);
          continue;
        }
        const targetSx = peer.targetX * cam.zoom + cam.x;
        const targetSy = peer.targetY * cam.zoom + cam.y;
        const frameScale = Math.min(1, Math.max(0.18, (now - lastFrameAt) / 16.7));
        const amount = Math.min(1, CURSOR_LERP * frameScale);
        const sx = peer.screenX == null ? targetSx : peer.screenX + (targetSx - peer.screenX) * amount;
        const sy = peer.screenY == null ? targetSy : peer.screenY + (targetSy - peer.screenY) * amount;
        peer.screenX = sx;
        peer.screenY = sy;
        peer.el.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
      }

      lastFrameAt = now;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [boardId, readOnly]);

  return <div ref={containerRef} className="pointer-events-none fixed inset-0 z-[45] overflow-hidden" />;
}
