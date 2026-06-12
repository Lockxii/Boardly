import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Layer, LayerType, AuditEntry, ChatMessage, BoardCanvasData, BoardConnection, CanvasVersion, LayerComment, LayerReaction, TrashEntry, LinkPreview } from "@/lib/types";
import { getLinkLayerDimensions, getLinkLayerHeightFromLayer } from "@/lib/brand-icons";
import { DEFAULT_CONNECTION_STYLE, type ConnectionStyle } from "@/lib/connection-utils";
import { apiFetch } from "@/lib/utils";
import { generateBoardThumbnail } from "@/lib/board-thumbnail";
import {
  computeAlignedPositions,
  computeDistributedPositions,
  type AlignKind,
  type DistributeKind,
} from "@/lib/canvas-utils";

export interface HistorySnapshot {
  layers: Record<string, Layer>;
  layerIds: string[];
  selection: string[];
}

interface CanvasStore {
  // Data
  layers: Record<string, Layer>;
  layerIds: string[];
  connections: BoardConnection[];
  versions: CanvasVersion[];
  auditLog: AuditEntry[];
  chatMessages: ChatMessage[];
  layerComments: Record<string, LayerComment[]>;
  reactions: Record<string, LayerReaction[]>;
  trash: TrashEntry[];
  brandColors: string[];

  readOnly: boolean;
  setReadOnly: (readOnly: boolean) => void;
  showSearch: boolean;
  setShowSearch: (show: boolean) => void;

  highlightedLayerIds: string[];
  flashRevision: number;
  connectHoverId: string | null;
  dropTargetColumnId: string | null;
  flashLayers: (ids: string[]) => void;
  setConnectHoverId: (id: string | null) => void;
  setDropTargetColumnId: (id: string | null) => void;

  commentsPanelOpen: boolean;
  commentsLayerId: string | null;
  openCommentsPanel: (layerId: string) => void;
  closeCommentsPanel: () => void;
  toggleCommentsPanel: (layerId: string) => void;

  // Save state
  saveStatus: "idle" | "saving" | "saved" | "error";
  lastSavedAt: number | null;
  setSaveStatus: (status: "idle" | "saving" | "saved" | "error", at?: number) => void;

  // Connector tool
  connectFromId: string | null;
  setConnectFromId: (id: string | null) => void;
  selectedConnectionId: string | null;
  setSelectedConnectionId: (id: string | null) => void;
  connectionDefaults: ConnectionStyle;
  setConnectionDefaults: (style: Partial<ConnectionStyle>) => void;
  addConnection: (fromId: string, toId: string) => void;
  updateConnection: (id: string, updates: Partial<BoardConnection>) => void;
  removeConnection: (id: string) => void;

  // Layout
  alignSelection: (align: AlignKind) => void;
  distributeSelection: (axis: DistributeKind) => void;

  // Versions
  createVersion: (label?: string) => void;
  restoreVersion: (versionId: string) => void;

  // Presence
  selection: string[];
  cursor: { x: number; y: number } | null;

  // Camera
  camera: { x: number; y: number; zoom: number };
  setCamera: (camera: { x: number; y: number; zoom: number }) => void;

  // Mode
  canvasState: CanvasMode;
  setCanvasState: (state: CanvasMode) => void;

  // Pencil
  lastUsedColor: string;
  setLastUsedColor: (color: string) => void;
  pencilThickness: number;
  setPencilThickness: (thickness: number) => void;
  pencilTool: "draw" | "erase";
  setPencilTool: (tool: "draw" | "erase") => void;

  // UI
  showGrid: boolean;
  toggleGrid: () => void;
  showMinimap: boolean;
  toggleMinimap: () => void;
  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;
  showPresentation: boolean;
  setShowPresentation: (show: boolean) => void;
  snapToGrid: boolean;
  toggleSnapToGrid: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Selection
  setSelection: (ids: string[]) => void;
  setCursor: (cursor: { x: number; y: number } | null) => void;

  // History (post-action snapshots)
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Layer mutations
  insertLayer: (type: LayerType, x: number, y: number, width?: number, height?: number) => string | null;
  insertLinkLayer: (preview: LinkPreview, x: number, y: number) => string | null;
  insertLinkLayersBatch: (items: { preview: LinkPreview; x: number; y: number }[]) => string[];
  insertImageLayersBatch: (items: { src: string; x: number; y: number; width: number; height: number }[]) => string[];
  fitLinkLayerToImage: (id: string, naturalWidth: number, naturalHeight: number) => void;
  deleteLayers: (ids?: string[]) => void;
  restoreTrashEntry: (entryId: string) => void;
  purgeTrash: () => void;
  duplicateLayers: (ids?: string[]) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  addLayerComment: (layerId: string, text: string) => void;
  deleteLayerComment: (layerId: string, commentId: string) => void;
  toggleChecklistItem: (layerId: string, itemId: string) => void;
  addChecklistItem: (layerId: string, text?: string) => void;
  toggleReaction: (layerId: string, emoji: string) => void;
  setBrandColors: (colors: string[]) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  updateLayerText: (id: string, value: string) => void;
  reorderLayers: (newOrder: string[]) => void;
  nudgeLayers: (dx: number, dy: number) => void;
  getSelectedLayers: () => Layer[];

  // Audit
  addAuditEntry: (action: string, layerType: string) => void;

  // Chat
  sendMessage: (text: string, attachment?: ChatMessage["attachment"], linkedLayerIds?: string[]) => void;

  // Init
  loadBoard: (boardId: string) => Promise<void>;
  saveBoard: (boardId: string) => Promise<void>;
  resetBoard: () => void;
}

export type CanvasMode =
  | { mode: "none" }
  | { mode: "selectionNet"; origin: { x: number; y: number }; current?: { x: number; y: number } }
  | { mode: "translating"; current: { x: number; y: number } }
  | { mode: "inserting"; layerType: LayerType; origin?: { x: number; y: number }; current?: { x: number; y: number } }
  | { mode: "resizing"; initialBounds: { x: number; y: number; width: number; height: number }; initialStart: { x: number; y: number }; corner: "bottom-right" }
  | { mode: "rotating"; initialAngle: number; centerX: number; centerY: number }
  | { mode: "pencil" }
  | { mode: "panning"; start?: { x: number; y: number }; camStart?: { x: number; y: number } };

function takeSnapshot(state: { layers: Record<string, Layer>; layerIds: string[]; selection: string[] }): HistorySnapshot {
  return {
    layers: JSON.parse(JSON.stringify(state.layers)),
    layerIds: [...state.layerIds],
    selection: [...state.selection],
  };
}

function restoreSnapshot(snapshot: HistorySnapshot): { layers: Record<string, Layer>; layerIds: string[]; selection: string[] } {
  return {
    layers: JSON.parse(JSON.stringify(snapshot.layers)),
    layerIds: [...snapshot.layerIds],
    selection: [...snapshot.selection],
  };
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  // Data
  layers: {},
  layerIds: [],
  connections: [],
  versions: [],
  auditLog: [],
  chatMessages: [],
  layerComments: {},
  reactions: {},
  trash: [],
  brandColors: ["#2563EB", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"],

  readOnly: false,
  setReadOnly: (readOnly) => set({ readOnly }),
  showSearch: false,
  setShowSearch: (showSearch) => set({ showSearch }),

  highlightedLayerIds: [],
  flashRevision: 0,
  connectHoverId: null,
  dropTargetColumnId: null,
  flashLayers: (ids) => {
    const token = get().flashRevision + 1;
    set({ highlightedLayerIds: ids, flashRevision: token });
    window.setTimeout(() => {
      if (get().flashRevision === token) set({ highlightedLayerIds: [] });
    }, 900);
  },
  setConnectHoverId: (connectHoverId) => set({ connectHoverId }),
  setDropTargetColumnId: (dropTargetColumnId) => set({ dropTargetColumnId }),

  commentsPanelOpen: false,
  commentsLayerId: null,
  openCommentsPanel: (layerId) => set({ commentsPanelOpen: true, commentsLayerId: layerId }),
  closeCommentsPanel: () => set({ commentsPanelOpen: false, commentsLayerId: null }),
  toggleCommentsPanel: (layerId) =>
    set((s) =>
      s.commentsPanelOpen && s.commentsLayerId === layerId
        ? { commentsPanelOpen: false, commentsLayerId: null }
        : { commentsPanelOpen: true, commentsLayerId: layerId }
    ),

  saveStatus: "idle",
  lastSavedAt: null,
  setSaveStatus: (saveStatus, at) =>
    set({
      saveStatus,
      lastSavedAt: at ?? (saveStatus === "saved" ? Date.now() : get().lastSavedAt),
    }),

  connectFromId: null,
  setConnectFromId: (connectFromId) => set({ connectFromId, selectedConnectionId: connectFromId ? null : get().selectedConnectionId }),
  selectedConnectionId: null,
  setSelectedConnectionId: (selectedConnectionId) => set({ selectedConnectionId, selection: selectedConnectionId ? [] : get().selection }),
  connectionDefaults: { ...DEFAULT_CONNECTION_STYLE },
  setConnectionDefaults: (style) => set((s) => ({ connectionDefaults: { ...s.connectionDefaults, ...style } })),

  // Presence
  selection: [],
  cursor: null,

  // Camera
  camera: { x: 0, y: 0, zoom: 1 },
  setCamera: (camera) => set({ camera }),

  // Mode
  canvasState: { mode: "none" },
  setCanvasState: (canvasState) => set({ canvasState }),

  // Pencil
  lastUsedColor: "#000000",
  setLastUsedColor: (lastUsedColor) => set({ lastUsedColor }),
  pencilThickness: 5,
  setPencilThickness: (pencilThickness) => set({ pencilThickness }),
  pencilTool: "draw",
  setPencilTool: (pencilTool) => set({ pencilTool }),

  // UI
  showGrid: true,
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  showMinimap: true,
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
  showCommandPalette: false,
  setShowCommandPalette: (showCommandPalette) => set({ showCommandPalette }),
  showPresentation: false,
  setShowPresentation: (showPresentation) => set({ showPresentation }),
  snapToGrid: false,
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
  darkMode: typeof window !== "undefined" && document.documentElement.classList.contains("dark"),
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("boardly-dark", String(next));
    return { darkMode: next };
  }),

  // Selection & cursor
  setSelection: (ids) => set({ selection: ids, selectedConnectionId: ids.length > 0 ? null : get().selectedConnectionId }),
  setCursor: (cursor) => set({ cursor }),

  // History — dual-stack undo/redo. pushHistory() saves the PRE-mutation state.
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  pushHistory: () => {
    // Save current state (pre-mutation) to undo stack, clear redo stack
    const state = get();
    const snapshot = takeSnapshot(state);
    const newUndoStack = [...state.undoStack, snapshot];
    if (newUndoStack.length > 100) newUndoStack.shift();
    set({
      undoStack: newUndoStack,
      redoStack: [],
      canUndo: true,
      canRedo: false,
    });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;
    // Save current state to redo stack
    const currentSnapshot = takeSnapshot(state);
    // Pop the pre-mutation snapshot from undo stack and restore it
    const newUndoStack = [...state.undoStack];
    const snapshot = newUndoStack.pop()!;
    const restored = restoreSnapshot(snapshot);
    set({
      ...restored,
      undoStack: newUndoStack,
      redoStack: [...state.redoStack, currentSnapshot],
      canUndo: newUndoStack.length > 0,
      canRedo: true,
    });
    get().flashLayers(restored.selection);
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;
    // Save current state to undo stack
    const currentSnapshot = takeSnapshot(state);
    // Pop the snapshot from redo stack and restore it
    const newRedoStack = [...state.redoStack];
    const snapshot = newRedoStack.pop()!;
    const restored = restoreSnapshot(snapshot);
    set({
      ...restored,
      undoStack: [...state.undoStack, currentSnapshot],
      redoStack: newRedoStack,
      canUndo: true,
      canRedo: newRedoStack.length > 0,
    });
    get().flashLayers(restored.selection);
  },

  // Layer mutations
  insertLayer: (type, x, y, width = 100, height = 100) => {
    const state = get();
    if (Object.keys(state.layers).length >= 200) return null;
    const id = nanoid();
    const layer: Layer = {
      type,
      x,
      y,
      width,
      height,
      fill:
        type === "Note"
          ? "#FEF3C7"
          : type === "Frame" || type === "Column"
            ? "transparent"
            : state.lastUsedColor,
      stroke: type === "Column" ? "#93C5FD" : type === "Frame" ? "#94A3B8" : undefined,
      strokeWidth: type === "Frame" || type === "Column" ? 2 : undefined,
      cornerRadius: type === "Frame" || type === "Column" ? 12 : type === "Note" ? 8 : undefined,
      value: type === "Frame" ? "Section" : type === "Column" ? "Colonne" : undefined,
    };
    // Save pre-mutation state BEFORE the insert
    get().pushHistory();
    set((s) => ({
      layers: { ...s.layers, [id]: layer },
      layerIds: type === "Frame" || type === "Column" ? [id, ...s.layerIds] : [...s.layerIds, id],
      selection: [id],
      canvasState: { mode: "none" },
    }));
    state.addAuditEntry("created", type);
    return id;
  },

  deleteLayers: (ids) => {
    const state = get();
    const toDelete = ids || state.selection;
    if (toDelete.length === 0) return;
    get().pushHistory();
    for (const id of toDelete) {
      const layer = state.layers[id];
      if (layer) state.addAuditEntry("deleted", layer.type);
    }
    set((s) => {
      const trashedLayers: Record<string, Layer> = {};
      for (const id of toDelete) {
        if (s.layers[id]) trashedLayers[id] = s.layers[id];
      }
      const newLayers = { ...s.layers };
      for (const id of toDelete) delete newLayers[id];
      const entry: TrashEntry = {
        id: nanoid(),
        deletedAt: Date.now(),
        layerIds: toDelete.filter((id) => trashedLayers[id]),
        layers: trashedLayers,
      };
      const trash = [entry, ...s.trash].slice(0, 50);
      return {
        layers: newLayers,
        layerIds: s.layerIds.filter((id) => !toDelete.includes(id)),
        connections: s.connections.filter((c) => !toDelete.includes(c.fromId) && !toDelete.includes(c.toId)),
        selection: [],
        trash,
      };
    });
  },

  restoreTrashEntry: (entryId) => {
    const state = get();
    const entry = state.trash.find((t) => t.id === entryId);
    if (!entry) return;
    get().pushHistory();
    set((s) => ({
      layers: { ...s.layers, ...entry.layers },
      layerIds: [...s.layerIds, ...entry.layerIds.filter((id) => !s.layerIds.includes(id))],
      trash: s.trash.filter((t) => t.id !== entryId),
      selection: entry.layerIds,
    }));
  },

  purgeTrash: () => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    set((s) => ({ trash: s.trash.filter((t) => t.deletedAt > cutoff) }));
  },

  insertLinkLayer: (preview, x, y) => {
    const id = nanoid();
    get().pushHistory();
    const { width, height } = getLinkLayerDimensions(preview);
    const layer: Layer = {
      type: "Link",
      x,
      y,
      width,
      height,
      fill: "#ffffff",
      url: preview.url,
      linkTitle: preview.title,
      linkDescription: preview.description,
      linkImage: preview.image,
      linkProvider: preview.provider || "generic",
      linkAuthor: preview.author,
      linkImageWidth: preview.imageWidth,
      linkImageHeight: preview.imageHeight,
      linkVideoId: preview.videoId,
      cornerRadius: 10,
      stroke: "#E2E8F0",
      strokeWidth: 1,
    };
    set((s) => ({
      layers: { ...s.layers, [id]: layer },
      layerIds: [...s.layerIds, id],
      selection: [id],
      canvasState: { mode: "none" },
    }));
    get().addAuditEntry("created", "Link");
    return id;
  },

  insertLinkLayersBatch: (items) => {
    if (items.length === 0) return [];
    get().pushHistory();
    const newIds: string[] = [];
    let nextLayers = get().layers;
    let nextLayerIds = get().layerIds;

    for (const { preview, x, y } of items) {
      const id = nanoid();
      const { width, height } = getLinkLayerDimensions(preview);
      nextLayers = {
        ...nextLayers,
        [id]: {
          type: "Link",
          x,
          y,
          width,
          height,
          fill: "#ffffff",
          url: preview.url,
          linkTitle: preview.title,
          linkDescription: preview.description,
          linkImage: preview.image,
          linkProvider: preview.provider || "generic",
          linkAuthor: preview.author,
          linkImageWidth: preview.imageWidth,
          linkImageHeight: preview.imageHeight,
          linkVideoId: preview.videoId,
          cornerRadius: 10,
          stroke: "#E2E8F0",
          strokeWidth: 1,
        },
      };
      nextLayerIds = [...nextLayerIds, id];
      newIds.push(id);
    }

    set({
      layers: nextLayers,
      layerIds: nextLayerIds,
      selection: newIds,
      canvasState: { mode: "none" },
    });
    get().addAuditEntry("created", newIds.length === 1 ? "Link" : `Link x${newIds.length}`);
    return newIds;
  },

  insertImageLayersBatch: (items) => {
    if (items.length === 0) return [];
    get().pushHistory();
    const newIds: string[] = [];
    let nextLayers = get().layers;
    let nextLayerIds = get().layerIds;

    for (const { src, x, y, width, height } of items) {
      const id = nanoid();
      nextLayers = {
        ...nextLayers,
        [id]: {
          type: "Image",
          x,
          y,
          width,
          height,
          fill: "",
          src,
        },
      };
      nextLayerIds = [...nextLayerIds, id];
      newIds.push(id);
    }

    set({
      layers: nextLayers,
      layerIds: nextLayerIds,
      selection: newIds,
      canvasState: { mode: "none" },
    });
    get().addAuditEntry("created", newIds.length === 1 ? "Image" : `Image x${newIds.length}`);
    return newIds;
  },

  fitLinkLayerToImage: (id, naturalWidth, naturalHeight) => {
    const layer = get().layers[id];
    if (!layer || layer.type !== "Link" || !naturalWidth || !naturalHeight) return;
    const nextHeight = getLinkLayerHeightFromLayer({
      ...layer,
      linkImageWidth: naturalWidth,
      linkImageHeight: naturalHeight,
    });
    const sameSize = layer.linkImageWidth === naturalWidth && layer.linkImageHeight === naturalHeight;
    if (sameSize && Math.abs(layer.height - nextHeight) <= 2) return;
    set((s) => ({
      layers: {
        ...s.layers,
        [id]: {
          ...s.layers[id],
          linkImageWidth: naturalWidth,
          linkImageHeight: naturalHeight,
          height: nextHeight,
        },
      },
    }));
  },

  groupSelection: () => {
    const state = get();
    if (state.selection.length < 2) return;
    const groupId = nanoid();
    get().pushHistory();
    set((s) => {
      const newLayers = { ...s.layers };
      for (const id of s.selection) {
        if (newLayers[id]) newLayers[id] = { ...newLayers[id], groupId };
      }
      return { layers: newLayers };
    });
    get().addAuditEntry("modified", "Groupe");
  },

  ungroupSelection: () => {
    const state = get();
    if (state.selection.length === 0) return;
    get().pushHistory();
    const groupIds = new Set(state.selection.map((id) => state.layers[id]?.groupId).filter(Boolean));
    set((s) => {
      const newLayers = { ...s.layers };
      for (const [id, layer] of Object.entries(newLayers)) {
        if (layer.groupId && groupIds.has(layer.groupId)) {
          newLayers[id] = { ...layer, groupId: undefined };
        }
      }
      return { layers: newLayers };
    });
  },

  addLayerComment: (layerId, text) => {
    if (!text.trim()) return;
    const comment: LayerComment = {
      id: nanoid(),
      userId: "local",
      userName: "Vous",
      text: text.trim(),
      createdAt: Date.now(),
    };
    set((s) => ({
      layerComments: {
        ...s.layerComments,
        [layerId]: [...(s.layerComments[layerId] || []), comment],
      },
    }));
  },

  deleteLayerComment: (layerId, commentId) => {
    set((s) => ({
      layerComments: {
        ...s.layerComments,
        [layerId]: (s.layerComments[layerId] || []).filter((c) => c.id !== commentId),
      },
    }));
  },

  toggleChecklistItem: (layerId, itemId) => {
    set((s) => {
      const layer = s.layers[layerId];
      if (!layer?.checklist) return s;
      return {
        layers: {
          ...s.layers,
          [layerId]: {
            ...layer,
            checklist: layer.checklist.map((item) =>
              item.id === itemId ? { ...item, done: !item.done } : item
            ),
          },
        },
      };
    });
  },

  addChecklistItem: (layerId, text = "Nouvelle tâche") => {
    get().pushHistory();
    set((s) => {
      const layer = s.layers[layerId];
      if (!layer) return s;
      const checklist = [...(layer.checklist || []), { id: nanoid(), text, done: false }];
      return { layers: { ...s.layers, [layerId]: { ...layer, checklist } } };
    });
  },

  toggleReaction: (layerId, emoji) => {
    set((s) => {
      const list = [...(s.reactions[layerId] || [])];
      const idx = list.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        const users = list[idx].userIds.includes("local")
          ? list[idx].userIds.filter((u) => u !== "local")
          : [...list[idx].userIds, "local"];
        if (users.length === 0) list.splice(idx, 1);
        else list[idx] = { emoji, userIds: users };
      } else {
        list.push({ emoji, userIds: ["local"] });
      }
      return { reactions: { ...s.reactions, [layerId]: list } };
    });
  },

  setBrandColors: (brandColors) => set({ brandColors }),

  duplicateLayers: (ids) => {
    const state = get();
    const toDuplicate = ids || state.selection;
    if (toDuplicate.length === 0) return;
    const newSelection: string[] = [];
    // Save pre-mutation state BEFORE the duplicate
    get().pushHistory();
    set((s) => {
      const newLayers = { ...s.layers };
      const newLayerIds = [...s.layerIds];
      for (const id of toDuplicate) {
        const layer = s.layers[id];
        if (!layer) continue;
        const newId = nanoid();
        newLayers[newId] = { ...layer, x: layer.x + 20, y: layer.y + 20, locked: false };
        newLayerIds.push(newId);
        newSelection.push(newId);
      }
      return { layers: newLayers, layerIds: newLayerIds, selection: newSelection };
    });
    state.addAuditEntry("created", "Copie");
  },

  updateLayer: (id, updates) => {
    set((s) => {
      if (!s.layers[id]) return s;
      return {
        layers: {
          ...s.layers,
          [id]: { ...s.layers[id], ...updates },
        },
      };
    });
  },

  updateLayerText: (id, value) => {
    set((s) => {
      if (!s.layers[id]) return s;
      return {
        layers: {
          ...s.layers,
          [id]: { ...s.layers[id], value },
        },
      };
    });
  },

  reorderLayers: (newOrder) => {
    set({ layerIds: newOrder });
  },

  nudgeLayers: (dx, dy) => {
    const state = get();
    set((s) => {
      const newLayers = { ...s.layers };
      for (const id of s.selection) {
        const layer = newLayers[id];
        if (layer && !layer.locked) {
          newLayers[id] = { ...layer, x: layer.x + dx, y: layer.y + dy };
        }
      }
      return { layers: newLayers };
    });
  },

  getSelectedLayers: () => {
    const state = get();
    return state.selection.map((id) => state.layers[id]).filter(Boolean);
  },

  addConnection: (fromId, toId) => {
    if (fromId === toId) return;
    const state = get();
    if (state.connections.some((c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId))) {
      return;
    }
    get().pushHistory();
    const defaults = get().connectionDefaults;
    set((s) => ({
      connections: [
        ...s.connections,
        {
          id: nanoid(),
          fromId,
          toId,
          stroke: defaults.stroke,
          strokeWidth: defaults.strokeWidth,
          lineStyle: defaults.lineStyle,
          arrowStart: defaults.arrowStart,
          arrowEnd: defaults.arrowEnd,
          routing: defaults.routing,
        },
      ],
      connectFromId: null,
      selectedConnectionId: null,
      canvasState: { mode: "none" },
    }));
    get().addAuditEntry("created", "Connecteur");
  },

  updateConnection: (id, updates) => {
    set((s) => {
      const connection = s.connections.find((c) => c.id === id);
      if (!connection) return s;
      return {
        connections: s.connections.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      };
    });
  },

  removeConnection: (id) => {
    get().pushHistory();
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
      selectedConnectionId: s.selectedConnectionId === id ? null : s.selectedConnectionId,
    }));
  },

  alignSelection: (align) => {
    const state = get();
    if (state.selection.length < 2) return;
    const updates = computeAlignedPositions(state.layers, state.selection, align);
    if (Object.keys(updates).length === 0) return;
    get().pushHistory();
    set((s) => {
      const newLayers = { ...s.layers };
      for (const [id, patch] of Object.entries(updates)) {
        newLayers[id] = { ...newLayers[id], ...patch };
      }
      return { layers: newLayers };
    });
    get().addAuditEntry("modified", "Alignement");
  },

  distributeSelection: (axis) => {
    const state = get();
    if (state.selection.length < 3) return;
    const updates = computeDistributedPositions(state.layers, state.selection, axis);
    if (Object.keys(updates).length === 0) return;
    get().pushHistory();
    set((s) => {
      const newLayers = { ...s.layers };
      for (const [id, patch] of Object.entries(updates)) {
        newLayers[id] = { ...newLayers[id], ...patch };
      }
      return { layers: newLayers };
    });
    get().addAuditEntry("modified", "Distribution");
  },

  createVersion: (label) => {
    const state = get();
    const version: CanvasVersion = {
      id: nanoid(),
      label: label || `Version ${new Date().toLocaleString("fr-FR")}`,
      createdAt: Date.now(),
      layers: JSON.parse(JSON.stringify(state.layers)),
      layerIds: [...state.layerIds],
      connections: JSON.parse(JSON.stringify(state.connections)),
    };
    set((s) => ({
      versions: [version, ...s.versions].slice(0, 20),
    }));
  },

  restoreVersion: (versionId) => {
    const state = get();
    const version = state.versions.find((v) => v.id === versionId);
    if (!version) return;
    get().pushHistory();
    set({
      layers: JSON.parse(JSON.stringify(version.layers)),
      layerIds: [...version.layerIds],
      connections: JSON.parse(JSON.stringify(version.connections)),
      selection: [],
      canvasState: { mode: "none" },
    });
    get().addAuditEntry("modified", "Restauration");
  },

  // Audit
  addAuditEntry: (action, layerType) => {
    set((s) => {
      const entry: AuditEntry = {
        id: nanoid(),
        userId: "local",
        userName: "Vous",
        action,
        layerType,
        timestamp: Date.now(),
      };
      const newLog = [...s.auditLog, entry];
      if (newLog.length > 50) newLog.shift();
      return { auditLog: newLog };
    });
  },

  // Chat
  sendMessage: (text, attachment, linkedLayerIds) => {
    if (!text.trim() && !attachment && (!linkedLayerIds || linkedLayerIds.length === 0)) return;
    set((s) => ({
      chatMessages: [
        ...s.chatMessages,
        {
          id: nanoid(),
          userId: "local",
          userName: "Vous",
          text: text.trim(),
          timestamp: Date.now(),
          attachment,
          linkedLayerIds,
        },
      ],
    }));
  },

  // Persistence
  resetBoard: () =>
    set({
      layers: {},
      layerIds: [],
      connections: [],
      versions: [],
      auditLog: [],
      chatMessages: [],
      layerComments: {},
      reactions: {},
      trash: [],
      brandColors: ["#2563EB", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"],
      readOnly: false,
      showSearch: false,
      highlightedLayerIds: [],
      flashRevision: 0,
      connectHoverId: null,
      dropTargetColumnId: null,
      commentsPanelOpen: false,
      commentsLayerId: null,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      selection: [],
      connectFromId: null,
      selectedConnectionId: null,
      saveStatus: "idle",
      lastSavedAt: null,
    }),

  loadBoard: async (boardId) => {
    const applyCanvasData = (data: Partial<BoardCanvasData>) => {
      set({
        layers: data.layers || {},
        layerIds: data.layerIds || [],
        connections: data.connections || [],
        versions: data.versions || [],
        auditLog: data.auditLog || [],
        chatMessages: data.chatMessages || [],
        layerComments: data.layerComments || {},
        reactions: data.reactions || {},
        trash: data.trash || [],
        brandColors: data.brandColors || ["#2563EB", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6"],
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
        selection: [],
        connectFromId: null,
        selectedConnectionId: null,
      });
    };

    const readLocalCanvas = (): BoardCanvasData | null => {
      try {
        const saved = localStorage.getItem(`boardly-${boardId}`);
        if (!saved) return null;
        return JSON.parse(saved) as BoardCanvasData;
      } catch {
        return null;
      }
    };

    const writeLocalCanvas = (data: BoardCanvasData) => {
      try {
        localStorage.setItem(`boardly-${boardId}`, JSON.stringify(data));
      } catch {}
    };

    const uploadCanvas = async (data: BoardCanvasData) => {
      const thumbnail = await generateBoardThumbnail(data.layers, data.layerIds);
      await apiFetch(`/api/boards/${boardId}/content`, {
        method: "PUT",
        body: JSON.stringify({ canvasData: data, thumbnail }),
      });
    };

    try {
      const remote = await apiFetch<{ canvasData: BoardCanvasData | null }>(`/api/boards/${boardId}/content`);
      if (remote.canvasData?.layerIds?.length) {
        applyCanvasData(remote.canvasData);
        writeLocalCanvas(remote.canvasData);
        return;
      }
    } catch {}

    const local = readLocalCanvas();
    if (local?.layerIds?.length) {
      applyCanvasData(local);
      try {
        await uploadCanvas(local);
      } catch {}
      return;
    }

    if (local) {
      applyCanvasData(local);
      return;
    }

    get().resetBoard();
  },

  saveBoard: async (boardId) => {
    const state = get();
    get().setSaveStatus("saving");
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

    try {
      localStorage.setItem(`boardly-${boardId}`, JSON.stringify(canvasData));
    } catch {}

    try {
      const thumbnail = await generateBoardThumbnail(canvasData.layers, canvasData.layerIds);
      await apiFetch(`/api/boards/${boardId}/content`, {
        method: "PUT",
        body: JSON.stringify({ canvasData, thumbnail }),
      });
      get().setSaveStatus("saved", Date.now());
    } catch {
      get().setSaveStatus("error");
    }
  },
}));

// Init dark mode from localStorage
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("boardly-dark");
  if (saved === "true" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
    useCanvasStore.setState({ darkMode: true });
  }
}
