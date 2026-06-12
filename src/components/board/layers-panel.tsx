import { useState } from "react";
import { Reorder } from "framer-motion";
import {
  Square, Circle, Type, StickyNote, Image as ImageIcon, Triangle, MoveRight,
  Diamond, Star, Pencil, GripVertical, Trash2, Link2, Frame, Minus, Columns3,
} from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";

const ICON_MAP: Record<string, typeof Square> = {
  Rectangle: Square,
  Ellipse: Circle,
  Text: Type,
  Note: StickyNote,
  Image: ImageIcon,
  Path: Pencil,
  Triangle: Triangle,
  Arrow: MoveRight,
  Diamond: Diamond,
  Star: Star,
  Line: Minus,
  Frame: Frame,
  Link: Link2,
  Column: Columns3,
};

export function LayersPanel() {
  const layerIds = useCanvasStore((s) => s.layerIds);
  const layers = useCanvasStore((s) => s.layers);
  const readOnly = useCanvasStore((s) => s.readOnly);
  const reorderLayers = useCanvasStore((s) => s.reorderLayers);
  const deleteLayers = useCanvasStore((s) => s.deleteLayers);
  const setSelection = useCanvasStore((s) => s.setSelection);
  const setCamera = useCanvasStore((s) => s.setCamera);
  const camera = useCanvasStore((s) => s.camera);
  const [hoverId, setHoverId] = useState<string | null>(null);

  if (layerIds.length === 0) {
    return (
      <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 p-4 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 w-64 text-center text-sm text-neutral-500">
        Aucun calque sur le tableau
      </div>
    );
  }

  const displayIds = [...layerIds].reverse();
  const handleReorder = (newDisplayIds: string[]) => {
    reorderLayers([...newDisplayIds].reverse());
  };

  const focusLayer = (id: string) => {
    const layer = layers[id];
    if (!layer) return;
    setSelection([id]);
    setCamera({
      x: window.innerWidth / 2 - (layer.x + layer.width / 2) * camera.zoom,
      y: window.innerHeight / 2 - (layer.y + layer.height / 2) * camera.zoom,
      zoom: camera.zoom,
    });
  };

  const layerLabel = (layer: (typeof layers)[string]) => {
    const text = layer.value?.replace(/<[^>]*>/g, "").trim();
    if (text) return `${layer.type} · ${text.slice(0, 28)}`;
    if (layer.linkTitle) return `${layer.type} · ${layer.linkTitle.slice(0, 28)}`;
    return layer.type;
  };

  return (
    <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 p-2 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 w-64 max-h-[70vh] flex flex-col pointer-events-auto">
      <div className="px-2 py-1 border-b border-neutral-100 dark:border-neutral-700 mb-2">
        <span className="text-xs font-bold uppercase text-neutral-500">Calques</span>
      </div>
      {hoverId && layers[hoverId] && (
        <div className="mx-2 mb-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 p-2 layer-hover-preview">
          <div
            className="h-12 rounded-md border border-neutral-200/70 dark:border-neutral-700"
            style={{ backgroundColor: layers[hoverId].fill || "#fff" }}
          />
          <p className="mt-1 text-[10px] text-neutral-500 truncate">
            {layerLabel(layers[hoverId])}
          </p>
        </div>
      )}
      <Reorder.Group axis="y" values={displayIds} onReorder={handleReorder} className="overflow-y-auto pr-1 flex flex-col gap-1">
        {displayIds.map((id) => {
          const layer = layers[id];
          if (!layer) return null;
          const Icon = ICON_MAP[layer.type] || Square;
          return (
            <Reorder.Item
              key={id}
              value={id}
              onMouseEnter={() => setHoverId(id)}
              onMouseLeave={() => setHoverId((prev) => (prev === id ? null : prev))}
              onClick={() => focusLayer(id)}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 group cursor-pointer"
            >
              <GripVertical className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600 shrink-0 cursor-grab active:cursor-grabbing" />
              <div className="h-6 w-6 rounded border border-neutral-200 dark:border-neutral-600 flex items-center justify-center shrink-0" style={{ backgroundColor: layer.fill || "#fff" }}>
                <Icon className="h-3 w-3 text-neutral-600 mix-blend-difference invert" />
              </div>
              <span className="text-sm truncate flex-1 dark:text-neutral-200">{layerLabel(layer)}</span>
              {!readOnly && (
                <button
                  type="button"
                  title="Supprimer le calque"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLayers([id]);
                  }}
                  className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-neutral-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all duration-150"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </div>
  );
}
