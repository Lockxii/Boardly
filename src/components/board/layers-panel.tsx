import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Reorder, useDragControls } from "framer-motion";
import {
  Square, Circle, Type, StickyNote, Image as ImageIcon, Triangle, MoveRight,
  Diamond, Star, Pencil, GripVertical, Trash2, Link2, Frame, Minus, Columns3,
} from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";
import { useDraggable } from "@/lib/use-draggable";
import type { Layer } from "@/lib/types";

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
  const drag = useDraggable<HTMLDivElement>({ storageKey: "layers-panel" });
  const storeDisplayIds = useMemo(() => [...layerIds].reverse(), [layerIds]);
  const [displayIds, setDisplayIds] = useState(storeDisplayIds);
  const displayIdsRef = useRef(storeDisplayIds);
  const [sorting, setSorting] = useState(false);
  const suppressFocusRef = useRef(false);

  useEffect(() => {
    if (sorting) return;
    displayIdsRef.current = storeDisplayIds;
    setDisplayIds(storeDisplayIds);
  }, [sorting, storeDisplayIds]);

  const commitDisplayOrder = useCallback(
    (ids: string[]) => {
      const nextOrder = [...ids].reverse();
      if (nextOrder.length !== layerIds.length || nextOrder.some((id, index) => id !== layerIds[index])) {
        reorderLayers(nextOrder);
      }
    },
    [layerIds, reorderLayers],
  );

  const handleReorder = useCallback((newDisplayIds: string[]) => {
    displayIdsRef.current = newDisplayIds;
    setDisplayIds(newDisplayIds);
  }, []);

  const handleSortStart = useCallback(() => {
    suppressFocusRef.current = true;
    setSorting(true);
  }, []);

  const handleSortEnd = useCallback(() => {
    setSorting(false);
    commitDisplayOrder(displayIdsRef.current);
    window.setTimeout(() => {
      suppressFocusRef.current = false;
    }, 0);
  }, [commitDisplayOrder]);

  const focusLayer = (id: string) => {
    if (suppressFocusRef.current) return;
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

  if (layerIds.length === 0) {
    const emptyPanel = (
      <div ref={drag.ref} style={drag.style} className="fixed left-28 top-1/2 z-50 w-64 -translate-y-1/2 rounded-lg border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-500 shadow-xl pointer-events-auto dark:border-neutral-700 dark:bg-neutral-800">
        Aucun calque sur le tableau
      </div>
    );
    return typeof document === "undefined" ? emptyPanel : createPortal(emptyPanel, document.body);
  }

  const visibleDisplayIds = displayIds.filter((id) => layers[id]);
  const canReorder = !readOnly && !drag.dragging;
  const panel = (
    <div ref={drag.ref} style={drag.style} className="fixed left-28 top-1/2 z-50 flex max-h-[70vh] w-64 -translate-y-1/2 flex-col rounded-lg border border-neutral-200 bg-white p-2 shadow-xl pointer-events-auto dark:border-neutral-700 dark:bg-neutral-800">
      <div {...drag.handleProps} className="flex items-center gap-1.5 px-2 py-1 border-b border-neutral-100 dark:border-neutral-700 mb-2" title="Déplacer le panneau">
        <GripVertical className="h-3.5 w-3.5 text-neutral-300 dark:text-neutral-600" />
        <span className="text-xs font-bold uppercase text-neutral-500">Calques</span>
      </div>
      {canReorder ? (
        <Reorder.Group axis="y" values={visibleDisplayIds} onReorder={handleReorder} className="overflow-y-auto pr-1 flex flex-col gap-1">
          {visibleDisplayIds.map((id) => {
            const layer = layers[id];
            if (!layer) return null;
            const Icon = ICON_MAP[layer.type] || Square;
            return (
              <SortableLayerRow
                key={id}
                id={id}
                layer={layer}
                Icon={Icon}
                label={layerLabel(layer)}
                onFocus={focusLayer}
                onDelete={(layerId) => deleteLayers([layerId])}
                onSortStart={handleSortStart}
                onSortEnd={handleSortEnd}
              />
            );
          })}
        </Reorder.Group>
      ) : (
        <div className="overflow-y-auto pr-1 flex flex-col gap-1">
          {visibleDisplayIds.map((id) => {
            const layer = layers[id];
            if (!layer) return null;
            const Icon = ICON_MAP[layer.type] || Square;
            return (
              <LayerRow
                key={id}
                id={id}
                layer={layer}
                Icon={Icon}
                label={layerLabel(layer)}
                onFocus={focusLayer}
                onDelete={(layerId) => deleteLayers([layerId])}
                readOnly={readOnly}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  return typeof document === "undefined" ? panel : createPortal(panel, document.body);
}

type LayerRowProps = {
  id: string;
  layer: Layer;
  Icon: typeof Square;
  label: string;
  readOnly?: boolean;
  onFocus: (id: string) => void;
  onDelete: (id: string) => void;
};

function LayerRow({ id, layer, Icon, label, readOnly = false, onFocus, onDelete }: LayerRowProps) {
  return (
    <div
      onClick={() => onFocus(id)}
      className="group flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700"
    >
      <GripVertical className="h-4 w-4 shrink-0 text-neutral-400 group-hover:text-neutral-600" />
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-neutral-200 dark:border-neutral-600" style={{ backgroundColor: layer.fill || "#fff" }}>
        <Icon className="h-3 w-3 text-neutral-600 mix-blend-difference invert" />
      </div>
      <span className="flex-1 truncate text-sm dark:text-neutral-200">{label}</span>
      {!readOnly && (
        <button
          type="button"
          title="Supprimer le calque"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(id);
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-0 transition-all duration-150 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

type SortableLayerRowProps = Omit<LayerRowProps, "readOnly"> & {
  onSortStart: () => void;
  onSortEnd: () => void;
};

function SortableLayerRow({
  id,
  layer,
  Icon,
  label,
  onFocus,
  onDelete,
  onSortStart,
  onSortEnd,
}: SortableLayerRowProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onSortStart}
      onDragEnd={onSortEnd}
      onClick={() => onFocus(id)}
      transition={{ type: "spring", stiffness: 900, damping: 55, mass: 0.25 }}
      className="group flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700"
    >
      <GripVertical
        onPointerDown={(e) => {
          e.stopPropagation();
          controls.start(e);
        }}
        className="h-4 w-4 shrink-0 cursor-grab text-neutral-400 group-hover:text-neutral-600 active:cursor-grabbing"
      />
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-neutral-200 dark:border-neutral-600" style={{ backgroundColor: layer.fill || "#fff" }}>
        <Icon className="h-3 w-3 text-neutral-600 mix-blend-difference invert" />
      </div>
      <span className="flex-1 truncate text-sm dark:text-neutral-200">{label}</span>
      <button
        type="button"
        title="Supprimer le calque"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(id);
        }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-0 transition-all duration-150 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </Reorder.Item>
  );
}
