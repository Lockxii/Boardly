import { create } from 'zustand';
import { LayerType } from '@/liveblocks.config';

export type CanvasMode = 
  | { mode: "none" }
  | { mode: "selectionNet", origin: { x: number, y: number }, current?: { x: number, y: number } }
  | { mode: "translating", current: { x: number, y: number } }
  | { mode: "inserting", layerType: LayerType, origin?: { x: number, y: number }, current?: { x: number, y: number } }
  | { mode: "resizing", initialBounds: { x: number, y: number, width: number, height: number }, initialStart: { x: number, y: number }, corner: "bottom-right" }
  | { mode: "rotating", initialAngle: number, centerX: number, centerY: number }
  | { mode: "pencil" }

interface CanvasState {
  camera: { x: number, y: number, zoom: number };
  setCamera: (camera: { x: number, y: number, zoom: number }) => void;
  canvasState: CanvasMode;
  setCanvasState: (state: CanvasMode) => void;
  lastUsedColor: string;
  setLastUsedColor: (color: string) => void;
  pencilThickness: number;
  setPencilThickness: (thickness: number) => void;
  pencilTool: "draw" | "erase";
  setPencilTool: (tool: "draw" | "erase") => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  camera: { x: 0, y: 0, zoom: 1 },
  setCamera: (camera) => set({ camera }),
  canvasState: { mode: "none" },
  setCanvasState: (canvasState) => set({ canvasState }),
  lastUsedColor: "#000000", 
  setLastUsedColor: (lastUsedColor) => set({ lastUsedColor }),
  pencilThickness: 5,
  setPencilThickness: (pencilThickness) => set({ pencilThickness }),
  pencilTool: "draw",
  setPencilTool: (pencilTool) => set({ pencilTool }),
}));