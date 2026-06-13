import { useEffect, useRef } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { applyLiveBoardPatch, applyRemoteBoardUpdate, createBoardLivePatch, type BoardLivePatch } from "@/lib/board-remote-sync";
import { apiFetch } from "@/lib/utils";
import { cursorColorForUser, type RemotePresence } from "@/lib/board-socket";
import { createPresenceConnection } from "@/lib/presence-ws";
import type { BoardCanvasData, Layer } from "@/lib/types";

const CURSOR_EMIT_INTERVAL_MS = 16;
const CANVAS_EMIT_INTERVAL_MS = 32;
const PEER_TIMEOUT_MS = 30_000;
const CURSOR_LERP = 0.82;
const REMOTE_LAYER_ANIMATION_MS = 96;

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

type LayerGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type RemoteLayerAnimation = {
  startedAt: number;
  duration: number;
  from: LayerGeometry;
  to: LayerGeometry;
  target: Layer;
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

function canvasDataFromStore(): BoardCanvasData {
  const state = useCanvasStore.getState();
  return {
    layers: state.layers,
    layerIds: state.layerIds,
    connections: state.connections,
    versions: state.versions,
    auditLog: state.auditLog,
    chatMessages: state.chatMessages,
    layerComments: state.layerComments,
    reactions: state.reactions,
    trash: state.trash,
    brandColors: state.brandColors,
  };
}

function layerGeometry(layer: Layer): LayerGeometry {
  return {
    x: Number(layer.x) || 0,
    y: Number(layer.y) || 0,
    width: Number(layer.width) || 0,
    height: Number(layer.height) || 0,
    rotation: Number(layer.rotation) || 0,
  };
}

function withLayerGeometry(layer: Layer, geometry: LayerGeometry): Layer {
  return {
    ...layer,
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    rotation: geometry.rotation,
  };
}

function shouldAnimateLayer(from: Layer | undefined, to: Layer) {
  if (!from || from.type !== to.type) return false;
  const a = layerGeometry(from);
  const b = layerGeometry(to);
  return (
    Math.abs(a.x - b.x) > 0.5 ||
    Math.abs(a.y - b.y) > 0.5 ||
    Math.abs(a.width - b.width) > 0.5 ||
    Math.abs(a.height - b.height) > 0.5 ||
    Math.abs(a.rotation - b.rotation) > 0.5
  );
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
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
  const applyingRemoteCanvasRef = useRef(false);
  const publishedCanvasRef = useRef<BoardCanvasData | null>(null);
  const queuedCanvasDataRef = useRef<BoardCanvasData | null>(null);
  const queuedPatchRef = useRef<BoardLivePatch | null>(null);
  const canvasRevisionRef = useRef(0);
  const remoteRevisionRef = useRef(new Map<string, number>());
  const remoteLayerAnimationsRef = useRef(new Map<string, RemoteLayerAnimation>());
  const remoteLayerAnimationFrameRef = useRef(0);
  const lastCanvasEmitAtRef = useRef(0);
  const canvasEmitTimerRef = useRef(0);

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

    const flushQueuedCanvas = () => {
      window.clearTimeout(canvasEmitTimerRef.current);
      canvasEmitTimerRef.current = 0;
      const patch = queuedPatchRef.current;
      const canvasData = queuedCanvasDataRef.current;
      if (!patch || !canvasData || readOnly) return;
      const sent = presenceRef.current?.sendCanvasPatch(patch) ?? false;
      if (!sent) return;
      queuedPatchRef.current = null;
      queuedCanvasDataRef.current = null;
      publishedCanvasRef.current = canvasData;
      lastCanvasEmitAtRef.current = performance.now();
    };

    const queueCanvas = (canvasData: BoardCanvasData) => {
      if (readOnly) return;
      const previous = publishedCanvasRef.current;
      if (!previous) {
        publishedCanvasRef.current = canvasData;
        return;
      }
      const patch = createBoardLivePatch(previous, canvasData, ++canvasRevisionRef.current);
      if (!patch) return;
      queuedPatchRef.current = patch;
      queuedCanvasDataRef.current = canvasData;
      const now = performance.now();
      const elapsed = now - lastCanvasEmitAtRef.current;
      if (elapsed >= CANVAS_EMIT_INTERVAL_MS) {
        flushQueuedCanvas();
        return;
      }
      if (!canvasEmitTimerRef.current) {
        canvasEmitTimerRef.current = window.setTimeout(flushQueuedCanvas, CANVAS_EMIT_INTERVAL_MS - elapsed);
      }
    };

    const animateRemoteLayers = () => {
      if (remoteLayerAnimationFrameRef.current) return;

      const step = () => {
        remoteLayerAnimationFrameRef.current = 0;
        if (cancelled || remoteLayerAnimationsRef.current.size === 0) return;

        const now = performance.now();
        const layerUpdates: Record<string, Layer> = {};

        for (const [id, animation] of remoteLayerAnimationsRef.current) {
          const progress = Math.min(1, Math.max(0, (now - animation.startedAt) / animation.duration));
          const amount = easeOutCubic(progress);
          layerUpdates[id] = withLayerGeometry(animation.target, {
            x: lerp(animation.from.x, animation.to.x, amount),
            y: lerp(animation.from.y, animation.to.y, amount),
            width: lerp(animation.from.width, animation.to.width, amount),
            height: lerp(animation.from.height, animation.to.height, amount),
            rotation: lerp(animation.from.rotation, animation.to.rotation, amount),
          });
          if (progress >= 1) remoteLayerAnimationsRef.current.delete(id);
        }

        if (Object.keys(layerUpdates).length > 0) {
          applyingRemoteCanvasRef.current = true;
          useCanvasStore.setState((state) => ({
            layers: {
              ...state.layers,
              ...layerUpdates,
            },
          }));
          if (!queuedPatchRef.current) publishedCanvasRef.current = canvasDataFromStore();
          applyingRemoteCanvasRef.current = false;
        }

        if (remoteLayerAnimationsRef.current.size > 0) {
          remoteLayerAnimationFrameRef.current = requestAnimationFrame(step);
        }
      };

      remoteLayerAnimationFrameRef.current = requestAnimationFrame(step);
    };

    presenceRef.current = createPresenceConnection(boardId, {
      onOpen: () => {
        presenceLiveRef.current = true;
        flushQueuedCanvas();
      },
      onClose: () => {
        presenceLiveRef.current = false;
      },
      onState: onPresenceState,
      onJoin: onPresenceJoin,
      onCursor: onPresenceCursor,
      onLeave: removePeer,
      onCanvas: async (update) => {
        if (cancelled) return;
        const incomingRevision = update.patch?.revision ?? 0;
        if (incomingRevision) {
          const previousRevision = remoteRevisionRef.current.get(update.connectionId) ?? 0;
          if (incomingRevision <= previousRevision) return;
          remoteRevisionRef.current.set(update.connectionId, incomingRevision);
        }

        const state = useCanvasStore.getState();
        const activeElement = document.activeElement;
        const isEditingText = activeElement instanceof HTMLElement && activeElement.isContentEditable;
        const protectSelection = isEditingText || (state.canvasState.mode !== "none" && state.canvasState.mode !== "panning");
        const protectedLayerIds = protectSelection ? state.selection : [];
        const protectedLayerSet = new Set(protectedLayerIds);
        applyingRemoteCanvasRef.current = true;
        try {
          if (update.patch) {
            let patch = update.patch;
            if (patch.deletedLayerIds?.length) {
              for (const id of patch.deletedLayerIds) remoteLayerAnimationsRef.current.delete(id);
            }
            if (patch.layers) {
              const animatedLayers: Record<string, Layer> = {};
              let hasAnimatedLayer = false;

              for (const [id, targetLayer] of Object.entries(patch.layers)) {
                const currentLayer = state.layers[id];
                if (protectedLayerSet.has(id) || !shouldAnimateLayer(currentLayer, targetLayer)) {
                  animatedLayers[id] = targetLayer;
                  continue;
                }

                const from = layerGeometry(currentLayer);
                const to = layerGeometry(targetLayer);
                remoteLayerAnimationsRef.current.set(id, {
                  startedAt: performance.now(),
                  duration: REMOTE_LAYER_ANIMATION_MS,
                  from,
                  to,
                  target: targetLayer,
                });
                animatedLayers[id] = withLayerGeometry(targetLayer, from);
                hasAnimatedLayer = true;
              }

              if (hasAnimatedLayer) {
                patch = { ...patch, layers: animatedLayers };
                animateRemoteLayers();
              }
            }

            applyLiveBoardPatch(patch, {
              userId: update.userId,
              userName: update.userName,
              notify: false,
              preserveSelection: true,
              protectedLayerIds,
            });
          } else if (update.canvasData) {
            await applyRemoteBoardUpdate(
              { canvasData: update.canvasData, updatedAt: update.updatedAt },
              { userId: update.userId, userName: update.userName, notify: false, preserveSelection: true }
            );
          }
          if (!queuedPatchRef.current) publishedCanvasRef.current = canvasDataFromStore();
        } finally {
          applyingRemoteCanvasRef.current = false;
        }
      },
    });

    publishedCanvasRef.current = canvasDataFromStore();
    const unsubscribeCanvas = useCanvasStore.subscribe((state) => {
      if (cancelled || readOnly || applyingRemoteCanvasRef.current) return;
      const canvasData: BoardCanvasData = {
        layers: state.layers,
        layerIds: state.layerIds,
        connections: state.connections,
        versions: state.versions,
        auditLog: state.auditLog,
        chatMessages: state.chatMessages,
        layerComments: state.layerComments,
        reactions: state.reactions,
        trash: state.trash,
        brandColors: state.brandColors,
      };
      queueCanvas(canvasData);
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
      window.clearTimeout(canvasEmitTimerRef.current);
      cancelAnimationFrame(remoteLayerAnimationFrameRef.current);
      remoteLayerAnimationFrameRef.current = 0;
      remoteLayerAnimationsRef.current.clear();
      unsubscribeCanvas();
      presenceRef.current?.close();
      presenceRef.current = null;
      for (const peer of peersRef.current.values()) peer.el?.remove();
      peersRef.current.clear();
    };
  }, [boardId, readOnly]);

  useEffect(() => {
    if (readOnly) return;

    const onPointerMove = (event: Event) => {
      const e = event as PointerEvent;
      const cam = useCanvasStore.getState().camera;
      pointerRef.current = {
        x: (e.clientX - cam.x) / cam.zoom,
        y: (e.clientY - cam.y) / cam.zoom,
      };
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerrawupdate", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerrawupdate", onPointerMove);
    };
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
        const frameScale = Math.min(2.4, Math.max(0.18, (now - lastFrameAt) / 16.7));
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
