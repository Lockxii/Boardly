import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Layer, LayerType, AuditEntry, ChatMessage } from "@/lib/types";

export interface HistorySnapshot {
  layers: Record<string, Layer>;
  layerIds: string[];
  selection: string[];
}

interface CanvasStore {
  // Data
  layers: Record<string, Layer>;
  layerIds: string[];
  auditLog: AuditEntry[];
  chatMessages: ChatMessage[];

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
  deleteLayers: (ids?: string[]) => void;
  duplicateLayers: (ids?: string[]) => void;
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
  loadBoard: (boardId: string) => void;
  saveBoard: (boardId: string) => void;
}

export type CanvasMode =
  | { mode: "none" }
  | { mode: "selectionNet"; origin: { x: number; y: number }; current?: { x: number; y: number } }
  | { mode: "translating"; current: { x: number; y: number } }
  | { mode: "inserting"; layerType: LayerType; origin?: { x: number; y: number }; current?: { x: number; y: number } }
  | { mode: "resizing"; initialBounds: { x: number; y: number; width: number; height: number }; initialStart: { x: number; y: number }; corner: "bottom-right" }
  | { mode: "rotating"; initialAngle: number; centerX: number; centerY: number }
  | { mode: "pencil" };

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
  auditLog: [],
  chatMessages: [],

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
  setSelection: (ids) => set({ selection: ids }),
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
      fill: state.lastUsedColor,
    };
    // Save pre-mutation state BEFORE the insert
    get().pushHistory();
    set((s) => ({
      layers: { ...s.layers, [id]: layer },
      layerIds: [...s.layerIds, id],
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
    // Save pre-mutation state BEFORE the delete
    get().pushHistory();
    for (const id of toDelete) {
      const layer = state.layers[id];
      if (layer) state.addAuditEntry("deleted", layer.type);
    }
    set((s) => {
      const newLayers = { ...s.layers };
      for (const id of toDelete) delete newLayers[id];
      return {
        layers: newLayers,
        layerIds: s.layerIds.filter((id) => !toDelete.includes(id)),
        selection: [],
      };
    });
  },

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
  loadBoard: (boardId) => {
    try {
      const saved = localStorage.getItem(`boardly-${boardId}`);
      if (saved) {
        const data = JSON.parse(saved);
        set({
          layers: data.layers || {},
          layerIds: data.layerIds || [],
          auditLog: data.auditLog || [],
          chatMessages: data.chatMessages || [],
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
          selection: [],
        });
      }
    } catch {}
  },

  saveBoard: (boardId) => {
    const state = get();
    try {
      localStorage.setItem(
        `boardly-${boardId}`,
        JSON.stringify({
          layers: state.layers,
          layerIds: state.layerIds,
          auditLog: state.auditLog,
          chatMessages: state.chatMessages,
        })
      );
    } catch {}
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
