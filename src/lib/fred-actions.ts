import { nanoid } from "nanoid";
import { toast } from "sonner";
import { useCanvasStore } from "@/store/canvas-store";
import type { FredAction, FredActionTarget, FredNoteItem } from "@/lib/fred-ai";
import type { Layer } from "@/lib/types";

const NOTE_COLORS = ["#FEF3C7", "#FECACA", "#BBF7D0", "#BFDBFE", "#E9D5FF", "#FDE68A"];

function getViewportAnchor() {
  const { camera } = useCanvasStore.getState();
  return {
    x: Math.round((window.innerWidth / 2 - camera.x) / camera.zoom - 100),
    y: Math.round((window.innerHeight / 2 - camera.y) / camera.zoom - 80),
  };
}

function noteText(item: FredNoteItem) {
  return typeof item === "string" ? item : item.text;
}

function noteColor(item: FredNoteItem, index: number) {
  if (typeof item === "object" && item.color) return item.color;
  return NOTE_COLORS[index % NOTE_COLORS.length];
}

function targetLayerIds(target: FredActionTarget | undefined, linkedIds: string[]) {
  const state = useCanvasStore.getState();
  if (target === "all") return state.layerIds.filter((id) => state.layers[id]);
  if (target === "selection") return state.selection.filter((id) => state.layers[id]);
  return (linkedIds.length ? linkedIds : state.selection).filter((id) => state.layers[id]);
}

function sortedLayers(ids: string[], layers: Record<string, Layer>) {
  return ids
    .filter((id) => layers[id])
    .sort((a, b) => layers[a].y - layers[b].y || layers[a].x - layers[b].x);
}

function organizeLayers(ids: string[], layout: "grid" | "row" | "column" | "stack", spacing = 32) {
  const state = useCanvasStore.getState();
  const ordered = sortedLayers(ids, state.layers);
  if (ordered.length < 2) return 0;

  state.pushHistory();

  const first = state.layers[ordered[0]];
  const maxWidth = Math.max(...ordered.map((id) => state.layers[id].width));
  const maxHeight = Math.max(...ordered.map((id) => state.layers[id].height));
  const columns = layout === "grid" ? Math.ceil(Math.sqrt(ordered.length)) : ordered.length;
  const nextLayers = { ...state.layers };

  ordered.forEach((id, index) => {
    const layer = nextLayers[id];
    let x = first.x;
    let y = first.y;

    if (layout === "row") {
      x = first.x + index * (maxWidth + spacing);
    } else if (layout === "column") {
      y = first.y + index * (maxHeight + spacing);
    } else if (layout === "stack") {
      x = first.x + index * 18;
      y = first.y + index * 18;
    } else {
      const col = index % columns;
      const row = Math.floor(index / columns);
      x = first.x + col * (maxWidth + spacing);
      y = first.y + row * (maxHeight + spacing);
    }

    nextLayers[id] = { ...layer, x, y };
  });

  useCanvasStore.setState({
    layers: nextLayers,
    selection: ordered,
    canvasState: { mode: "none" },
  });

  return ordered.length;
}

function addFredComment(layerId: string, text: string) {
  useCanvasStore.setState((s) => ({
    layerComments: {
      ...s.layerComments,
      [layerId]: [
        ...(s.layerComments[layerId] || []),
        {
          id: nanoid(),
          userId: "fred",
          userName: "Fred",
          text,
          createdAt: Date.now(),
        },
      ],
    },
  }));
}

export function applyFredActions(actions: FredAction[], options: { linkedIds?: string[] } = {}) {
  if (!actions.length) return 0;

  const state = useCanvasStore.getState();

  const anchor = getViewportAnchor();
  const newLayers = { ...state.layers };
  const newLayerIds = [...state.layerIds];
  const createdIds: string[] = [];
  const linkedIds = options.linkedIds ?? [];
  let changedCanvas = false;
  let commentCount = 0;
  let organizedCount = 0;
  let offset = 0;

  for (const action of actions) {
    if (action.type === "add_notes") {
      changedCanvas = true;
      action.items.forEach((item, i) => {
        const id = nanoid();
        const col = i % 3;
        const row = Math.floor(i / 3);
        newLayers[id] = {
          type: "Note",
          x: anchor.x + col * 220 + offset * 12,
          y: anchor.y + row * 140 + offset * 12,
          width: 200,
          height: 120,
          fill: noteColor(item, i),
          cornerRadius: 8,
          value: noteText(item),
        };
        newLayerIds.push(id);
        createdIds.push(id);
      });
      offset += 1;
    }

    if (action.type === "add_text") {
      changedCanvas = true;
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

    if (action.type === "add_frames") {
      changedCanvas = true;
      action.items.forEach((frame, frameIndex) => {
        const frameId = nanoid();
        const frameX = anchor.x + frameIndex * 340 + offset * 20;
        const frameY = anchor.y + offset * 20;
        newLayers[frameId] = {
          type: "Frame",
          x: frameX,
          y: frameY,
          width: 300,
          height: 220 + (frame.notes?.length ?? 0) * 130,
          fill: "transparent",
          stroke: "#94A3B8",
          strokeWidth: 2,
          cornerRadius: 12,
          value: frame.title,
        };
        newLayerIds.unshift(frameId);
        createdIds.push(frameId);

        frame.notes?.forEach((note, i) => {
          const noteId = nanoid();
          newLayers[noteId] = {
            type: "Note",
            x: frameX + 20,
            y: frameY + 40 + i * 130,
            width: 260,
            height: 110,
            fill: noteColor(note, i),
            cornerRadius: 8,
            value: note,
            groupId: frameId,
          };
          newLayerIds.push(noteId);
          createdIds.push(noteId);
        });
      });
      offset += 1;
    }

    if (action.type === "add_links") {
      changedCanvas = true;
      action.items.forEach((item, i) => {
        const id = nanoid();
        newLayers[id] = {
          type: "Link",
          x: anchor.x + (i % 2) * 340 + offset * 18,
          y: anchor.y + Math.floor(i / 2) * 180 + offset * 18,
          width: 320,
          height: 150,
          fill: "#ffffff",
          url: item.url,
          linkTitle: item.title || item.url,
          linkDescription: item.description,
          linkProvider: "generic",
          cornerRadius: 10,
          stroke: "#E2E8F0",
          strokeWidth: 1,
        };
        newLayerIds.push(id);
        createdIds.push(id);
      });
      offset += 1;
    }

    if (action.type === "add_comments") {
      const fallbackIds = targetLayerIds(action.target, linkedIds);
      action.items.forEach((item, index) => {
        const layerId =
          item.layerId && state.layers[item.layerId]
            ? item.layerId
            : typeof item.targetIndex === "number"
              ? fallbackIds[item.targetIndex - 1]
              : fallbackIds[index] ?? fallbackIds[0];
        if (!layerId) return;
        addFredComment(layerId, item.text);
        commentCount += 1;
      });
    }

    if (action.type === "organize_layers") {
      organizedCount += organizeLayers(targetLayerIds(action.target, linkedIds), action.layout, action.spacing);
    }

    if (action.type === "set_brand_colors") {
      state.setBrandColors(action.colors);
    }

    if (action.type === "create_version") {
      state.createVersion(action.label || "Version Fred");
    }

    if (action.type === "open_presentation") {
      state.setShowPresentation(true);
    }
  }

  if (!createdIds.length) {
    if (commentCount) toast.success(`${commentCount} annotation${commentCount > 1 ? "s" : ""} ajoutée${commentCount > 1 ? "s" : ""}`);
    if (organizedCount) toast.success(`${organizedCount} élément${organizedCount > 1 ? "s" : ""} rangé${organizedCount > 1 ? "s" : ""} par Fred`);
    return commentCount + organizedCount;
  }

  if (changedCanvas) state.pushHistory();

  useCanvasStore.setState({
    layers: newLayers,
    layerIds: newLayerIds,
    selection: createdIds,
    canvasState: { mode: "none" },
  });

  toast.success(`${createdIds.length} élément${createdIds.length > 1 ? "s" : ""} ajouté${createdIds.length > 1 ? "s" : ""} par Fred`);
  return createdIds.length;
}
