import { useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { applyLiveBoardPatch, applyRemoteBoardUpdate, createBoardLivePatch, type BoardLivePatch } from "@/lib/board-remote-sync";
import { cursorColorForUser, type PresenceCamera, type RemotePresence } from "@/lib/board-socket";
import { createPresenceConnection } from "@/lib/presence-ws";
import { SlashMenu } from "./slash-menu";
import type { BoardCanvasData, Layer } from "@/lib/types";

const CURSOR_EMIT_INTERVAL_MS = 33;
const CANVAS_EMIT_ACTIVE_INTERVAL_MS = 33;
const CANVAS_EMIT_IDLE_INTERVAL_MS = 120;
const PEER_TIMEOUT_MS = 30_000;
const CURSOR_LERP = 0.82;
const REMOTE_LAYER_ANIMATION_MS = 64;
const SOLO_IDLE_DISCONNECT_MS = 45_000;
const COLLAB_IDLE_DISCONNECT_MS = 5 * 60_000;
const HIDDEN_DISCONNECT_MS = 5_000;
const ACTIVITY_THROTTLE_MS = 3_000;

type Peer = {
  connectionId: string;
  userId: string;
  userName: string;
  targetX: number;
  targetY: number;
  screenX: number | null;
  screenY: number | null;
  lastSeen: number;
  chat: string | null;
  laser: boolean;
  camera: PresenceCamera | null;
  el: HTMLDivElement | null;
  arrowEl: SVGSVGElement | null;
  dotEl: HTMLDivElement | null;
  labelEl: HTMLSpanElement | null;
  chatEl: HTMLSpanElement | null;
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
    chat: user.chat ?? null,
    laser: user.laser ?? false,
    camera: user.camera ?? null,
  };
}

function createCursorElement(peer: Peer) {
  const color = cursorColorForUser(peer.userId);
  const root = document.createElement("div");
  root.className = "absolute flex flex-col items-start gap-1 remote-cursor";
  root.style.willChange = "transform";

  const topRow = document.createElement("div");
  topRow.className = "flex items-start gap-1";

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

  // Laser dot (hidden unless the peer toggles laser mode).
  const dot = document.createElement("div");
  dot.style.display = "none";
  dot.style.width = "14px";
  dot.style.height = "14px";
  dot.style.borderRadius = "9999px";
  dot.style.background = "#EF4444";
  dot.style.boxShadow = "0 0 12px 4px rgba(239,68,68,0.7)";

  const label = document.createElement("span");
  label.className = "rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm whitespace-nowrap";
  label.style.backgroundColor = color;
  label.textContent = peer.userName;

  topRow.appendChild(svg);
  topRow.appendChild(dot);
  topRow.appendChild(label);

  // Cursor chat bubble (hidden unless the peer is typing).
  const chat = document.createElement("span");
  chat.className = "ml-4 max-w-[220px] rounded-xl rounded-tl-sm bg-neutral-900 px-2 py-1 text-[11px] text-white shadow-md dark:bg-neutral-100 dark:text-neutral-900";
  chat.style.display = "none";

  root.appendChild(topRow);
  root.appendChild(chat);

  peer.arrowEl = svg;
  peer.dotEl = dot;
  peer.labelEl = label;
  peer.chatEl = chat;
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

function isHighFrequencyCanvasUpdate(state: ReturnType<typeof useCanvasStore.getState>) {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && activeElement.isContentEditable) return true;
  return (
    state.canvasState.mode === "translating" ||
    state.canvasState.mode === "resizing" ||
    state.canvasState.mode === "rotating" ||
    state.canvasState.mode === "pencil" ||
    state.canvasState.mode === "inserting" ||
    state.canvasState.mode === "selectionNet"
  );
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
  const lastActivityAtRef = useRef(0);
  const markRealtimeActivityRef = useRef<() => void>(() => {});
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
  const lastCameraSentAtRef = useRef(0);
  const lastSentCameraRef = useRef<PresenceCamera | null>(null);
  const slashOpenRef = useRef(false);
  const slashScreenRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const slashPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const slashHasPeersRef = useRef(false);
  const chatClearTimerRef = useRef(0);
  const [slashOpen, setSlashOpen] = useState(false);
  slashOpenRef.current = slashOpen;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (readOnly) {
      return;
    }

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
          chat: user.chat ?? null,
          laser: user.laser ?? false,
          camera: user.camera ?? null,
          el: null,
          arrowEl: null,
          dotEl: null,
          labelEl: null,
          chatEl: null,
        };
        peersRef.current.set(user.connectionId, peer);
      } else {
        peer.userName = user.userName;
        peer.targetX = user.cursorX;
        peer.targetY = user.cursorY;
        peer.lastSeen = performance.now();
        peer.chat = user.chat ?? null;
        peer.laser = user.laser ?? false;
        peer.camera = user.camera ?? null;
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
    let idleTimer = 0;
    let hiddenTimer = 0;

    const clearPeers = () => {
      for (const peer of peersRef.current.values()) peer.el?.remove();
      peersRef.current.clear();
    };

    const closePresence = () => {
      window.clearTimeout(idleTimer);
      idleTimer = 0;
      window.clearTimeout(hiddenTimer);
      hiddenTimer = 0;
      presenceRef.current?.close();
      presenceRef.current = null;
      clearPeers();
    };

    const scheduleIdleDisconnect = () => {
      window.clearTimeout(idleTimer);
      if (document.hidden || !presenceRef.current) return;
      const delay = peersRef.current.size > 0 ? COLLAB_IDLE_DISCONNECT_MS : SOLO_IDLE_DISCONNECT_MS;
      idleTimer = window.setTimeout(closePresence, delay);
    };

    const syncLivePeers = (users: RemotePresence[]) => {
      const next = users.map((u) => ({ userId: u.userId, userName: u.userName, connectionId: u.connectionId }));
      const prev = useCanvasStore.getState().livePeers;
      const same =
        prev.length === next.length &&
        next.every((p, i) => prev[i]?.connectionId === p.connectionId && prev[i]?.userName === p.userName);
      if (!same) useCanvasStore.getState().setLivePeers(next);
    };

    const onPresenceState = (users: RemotePresence[]) => {
      if (cancelled) return;
      const activeConnectionIds = new Set(users.map((user) => user.connectionId));
      for (const [connectionId, peer] of peersRef.current) {
        if (activeConnectionIds.has(connectionId)) continue;
        peer.el?.remove();
        peersRef.current.delete(connectionId);
      }
      for (const user of users) upsertPeer(user);
      syncLivePeers(users);
      scheduleIdleDisconnect();
    };

    const onPresenceJoin = (user: RemotePresence) => {
      if (cancelled) return;
      if (user.cursorX != null && user.cursorY != null) upsertPeer(user);
      scheduleIdleDisconnect();
    };

    const onPresenceCursor = (user: RemotePresence) => {
      if (cancelled) return;
      upsertPeer(user);
      scheduleIdleDisconnect();
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

    const queueCanvas = (canvasData: BoardCanvasData, highFrequency: boolean) => {
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
      markRealtimeActivityRef.current();
      const now = performance.now();
      const interval = highFrequency ? CANVAS_EMIT_ACTIVE_INTERVAL_MS : CANVAS_EMIT_IDLE_INTERVAL_MS;
      const elapsed = now - lastCanvasEmitAtRef.current;
      if (elapsed >= interval) {
        flushQueuedCanvas();
        return;
      }
      window.clearTimeout(canvasEmitTimerRef.current);
      canvasEmitTimerRef.current = window.setTimeout(flushQueuedCanvas, interval - elapsed);
    };

    const currentPointerOrViewportCenter = () => {
      const pointer = pointerRef.current;
      if (pointer) return pointer;
      const cam = useCanvasStore.getState().camera;
      return {
        x: (window.innerWidth / 2 - cam.x) / cam.zoom,
        y: (window.innerHeight / 2 - cam.y) / cam.zoom,
      };
    };

    const publishCurrentCursor = () => {
      if (readOnly) return;
      const cursor = currentPointerOrViewportCenter();
      pointerRef.current = cursor;
      lastEmitAtRef.current = performance.now();
      lastEmitRef.current = { x: cursor.x, y: cursor.y };
      presenceRef.current?.sendCursor(cursor.x, cursor.y);
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

    const openPresence = () => {
      if (cancelled || document.hidden || presenceRef.current) return;
      presenceRef.current = createPresenceConnection(boardId, {
        onOpen: () => {
          publishCurrentCursor();
          flushQueuedCanvas();
          scheduleIdleDisconnect();
        },
        onTimer: (timer) => {
          if (cancelled) return;
          useCanvasStore.getState().setLiveTimer(timer.endsAt === null && !timer.paused ? null : timer);
          scheduleIdleDisconnect();
        },
        onClose: () => {},
        onState: onPresenceState,
        onJoin: onPresenceJoin,
        onCursor: onPresenceCursor,
        onLeave: (payload) => {
          removePeer(payload);
          scheduleIdleDisconnect();
        },
        onCanvas: async (update) => {
          if (cancelled) return;
          scheduleIdleDisconnect();
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
    };

    const markRealtimeActivity = () => {
      if (cancelled || document.hidden) return;
      const now = performance.now();
      if (presenceRef.current && now - lastActivityAtRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityAtRef.current = now;
      openPresence();
      scheduleIdleDisconnect();
    };

    markRealtimeActivityRef.current = markRealtimeActivity;

    useCanvasStore.getState().setLiveActions({
      setLaser: (on) => {
        markRealtimeActivity();
        presenceRef.current?.patchPresence({ laser: on });
      },
      sendTimer: (timer) => {
        markRealtimeActivity();
        useCanvasStore.getState().setLiveTimer(timer.endsAt === null && !timer.paused ? null : timer);
        presenceRef.current?.sendTimer(timer);
      },
      sendChat: (text) => {
        markRealtimeActivity();
        presenceRef.current?.patchPresence({ chat: text });
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
      queueCanvas(canvasData, isHighFrequencyCanvasUpdate(state));
    });

    const onVisibilityChange = () => {
      window.clearTimeout(hiddenTimer);
      if (document.hidden) {
        hiddenTimer = window.setTimeout(closePresence, HIDDEN_DISCONNECT_MS);
        return;
      }
      markRealtimeActivity();
    };

    const onLocalActivity = () => {
      markRealtimeActivity();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onLocalActivity, { passive: true });
    window.addEventListener("pointerdown", onLocalActivity, { passive: true });
    window.addEventListener("keydown", onLocalActivity);
    window.addEventListener("wheel", onLocalActivity, { passive: true });
    window.addEventListener("touchstart", onLocalActivity, { passive: true });
    markRealtimeActivity();

    return () => {
      cancelled = true;
      markRealtimeActivityRef.current = () => {};
      const store = useCanvasStore.getState();
      store.setLiveActions(null);
      store.setLivePeers([]);
      store.setLiveTimer(null);
      store.setFollowingUserId(null);
      window.clearTimeout(chatClearTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onLocalActivity);
      window.removeEventListener("pointerdown", onLocalActivity);
      window.removeEventListener("keydown", onLocalActivity);
      window.removeEventListener("wheel", onLocalActivity);
      window.removeEventListener("touchstart", onLocalActivity);
      window.clearTimeout(idleTimer);
      window.clearTimeout(hiddenTimer);
      window.clearTimeout(canvasEmitTimerRef.current);
      cancelAnimationFrame(remoteLayerAnimationFrameRef.current);
      remoteLayerAnimationFrameRef.current = 0;
      remoteLayerAnimationsRef.current.clear();
      unsubscribeCanvas();
      closePresence();
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
      markRealtimeActivityRef.current();
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

      // Follow a collaborator: lock our camera onto theirs.
      const followingId = useCanvasStore.getState().followingUserId;
      if (followingId) {
        let followed: Peer | undefined;
        for (const p of peersRef.current.values()) {
          if (p.userId === followingId) {
            followed = p;
            break;
          }
        }
        const fc = followed?.camera;
        if (fc && (Math.abs(fc.x - cam.x) > 0.5 || Math.abs(fc.y - cam.y) > 0.5 || Math.abs(fc.zoom - cam.zoom) > 0.001)) {
          useCanvasStore.getState().setCamera(fc);
        }
      }

      // Broadcast our camera (throttled) so others can follow us.
      if (presenceRef.current && now - lastCameraSentAtRef.current > 150) {
        const last = lastSentCameraRef.current;
        if (!last || Math.abs(last.x - cam.x) > 0.5 || Math.abs(last.y - cam.y) > 0.5 || Math.abs(last.zoom - cam.zoom) > 0.001) {
          presenceRef.current.patchPresence({ camera: { x: cam.x, y: cam.y, zoom: cam.zoom } });
          lastSentCameraRef.current = { x: cam.x, y: cam.y, zoom: cam.zoom };
          lastCameraSentAtRef.current = now;
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

        if (peer.chatEl) {
          if (peer.chat) {
            if (peer.chatEl.textContent !== peer.chat) peer.chatEl.textContent = peer.chat;
            if (peer.chatEl.style.display === "none") peer.chatEl.style.display = "";
          } else if (peer.chatEl.style.display !== "none") {
            peer.chatEl.style.display = "none";
          }
        }
        if (peer.dotEl && peer.arrowEl && peer.labelEl) {
          const laserDisplay = peer.laser ? "" : "none";
          const cursorDisplay = peer.laser ? "none" : "";
          if (peer.dotEl.style.display !== laserDisplay) peer.dotEl.style.display = laserDisplay;
          if (peer.arrowEl.style.display !== cursorDisplay) peer.arrowEl.style.display = cursorDisplay;
          if (peer.labelEl.style.display !== cursorDisplay) peer.labelEl.style.display = cursorDisplay;
        }
      }

      lastFrameAt = now;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [boardId, readOnly]);

  // Slash menu: press "/" to insert an element at the cursor — or, when
  // collaborating, send a cursor-chat message ("Dire …").
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const ae = document.activeElement as HTMLElement | null;
      const inField = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
      if (inField || slashOpenRef.current) return;
      e.preventDefault();
      const cam = useCanvasStore.getState().camera;
      const p = pointerRef.current ?? {
        x: (window.innerWidth / 2 - cam.x) / cam.zoom,
        y: (window.innerHeight / 2 - cam.y) / cam.zoom,
      };
      slashPointRef.current = p;
      slashScreenRef.current = { x: p.x * cam.zoom + cam.x, y: p.y * cam.zoom + cam.y };
      slashHasPeersRef.current = peersRef.current.size > 0;
      setSlashOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly]);

  const sendCursorChat = (text: string) => {
    const trimmed = text.slice(0, 120);
    useCanvasStore.getState().liveActions?.sendChat(trimmed);
    window.clearTimeout(chatClearTimerRef.current);
    chatClearTimerRef.current = window.setTimeout(
      () => useCanvasStore.getState().liveActions?.sendChat(null),
      5000,
    );
  };

  return (
    <>
      <div ref={containerRef} className="pointer-events-none fixed inset-0 z-[45] overflow-hidden" />
      {!readOnly && slashOpen && (
        <SlashMenu
          screen={slashScreenRef.current}
          canHandleChat={slashHasPeersRef.current}
          onInsert={(type, w, h) => {
            const pt = slashPointRef.current;
            useCanvasStore.getState().insertLayer(type, Math.round(pt.x), Math.round(pt.y), w, h);
          }}
          onTool={(tool) => useCanvasStore.getState().setRequestTool(tool)}
          onPencil={() => {
            const store = useCanvasStore.getState();
            store.setCanvasState({ mode: "pencil" });
            store.setPencilTool("draw");
          }}
          onChat={sendCursorChat}
          onClose={() => setSlashOpen(false)}
        />
      )}
    </>
  );
}
