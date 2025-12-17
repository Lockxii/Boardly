import { create } from 'zustand';
import { LayerType } from '@/liveblocks.config';

export type CanvasMode = 
  | { mode: "none" }
  | { mode: "selectionNet", origin: { x: number, y: number }, current?: { x: number, y: number } }
  | { mode: "translating", current: { x: number, y: number } }
  | { mode: "inserting", layerType: LayerType }
  | { mode: "resizing", initialBounds: { x: number, y: number, width: number, height: number }, initialStart: { x: number, y: number }, corner: "bottom-right" } // Added initialStart
  | { mode: "pencil" }

interface CanvasState {
  camera: { x: number, y: number, zoom: number };
  setCamera: (camera: { x: number, y: number, zoom: number }) => void;
  canvasState: CanvasMode;
  setCanvasState: (state: CanvasMode) => void;
  lastUsedColor: string;
  setLastUsedColor: (color: string) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  camera: { x: 0, y: 0, zoom: 1 },
  setCamera: (camera) => set({ camera }),
  canvasState: { mode: "none" },
  setCanvasState: (canvasState) => set({ canvasState }),
  lastUsedColor: "#FF5733", 
  setLastUsedColor: (lastUsedColor) => set({ lastUsedColor }),
}));