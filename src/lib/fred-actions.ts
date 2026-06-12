import { nanoid } from "nanoid";
import { toast } from "sonner";
import { useCanvasStore } from "@/store/canvas-store";
import type { FredAction } from "@/lib/fred-ai";

function getViewportAnchor() {
  const { camera } = useCanvasStore.getState();
  return {
    x: Math.round((window.innerWidth / 2 - camera.x) / camera.zoom - 100),
    y: Math.round((window.innerHeight / 2 - camera.y) / camera.zoom - 80),
  };
}

export function applyFredActions(actions: FredAction[]) {
  if (!actions.length) return 0;

  const state = useCanvasStore.getState();
  state.pushHistory();

  const anchor = getViewportAnchor();
  const newLayers = { ...state.layers };
  const newLayerIds = [...state.layerIds];
  const createdIds: string[] = [];
  let offset = 0;

  for (const action of actions) {
    if (action.type === "add_notes") {
      action.items.forEach((text, i) => {
        const id = nanoid();
        const col = i % 3;
        const row = Math.floor(i / 3);
        newLayers[id] = {
          type: "Note",
          x: anchor.x + col * 220 + offset * 12,
          y: anchor.y + row * 140 + offset * 12,
          width: 200,
          height: 120,
          fill: "#FEF3C7",
          cornerRadius: 8,
          value: text,
        };
        newLayerIds.push(id);
        createdIds.push(id);
      });
      offset += 1;
    }

    if (action.type === "add_text") {
      action.items.forEach((text, i) => {
        const id = nanoid();
        newLayers[id] = {
          type: "Text",
          x: anchor.x + offset * 16,
          y: anchor.y - 60 + i * 48,
          width: Math.min(420, Math.max(160, text.length * 9)),
          height: 40,
          fill: "transparent",
          value: text,
          fontSize: 22,
          fontWeight: "600",
        };
        newLayerIds.push(id);
        createdIds.push(id);
      });
      offset += 1;
    }
  }

  if (!createdIds.length) return 0;

  useCanvasStore.setState({
    layers: newLayers,
    layerIds: newLayerIds,
    selection: createdIds,
    canvasState: { mode: "none" },
  });

  toast.success(`${createdIds.length} élément${createdIds.length > 1 ? "s" : ""} ajouté${createdIds.length > 1 ? "s" : ""} par Fred`);
  return createdIds.length;
}
