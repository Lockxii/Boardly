import { memo, useMemo } from "react";
import { useCanvasStore } from "@/store/canvas-store";
import { getViewportCanvasBounds, isLayerInViewport } from "@/lib/motion-utils";
import { isHtmlLayerType } from "@/lib/html-layer-types";
import { LayerPreview } from "./layer-preview";
import type { Layer } from "@/lib/types";

type CanvasLayersProps = {
  camera: { x: number; y: number; zoom: number };
  onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
  onLayerResizePointerDown: (
    e: React.PointerEvent,
    initialBounds: { x: number; y: number; width: number; height: number }
  ) => void;
  onLayerRotatePointerDown: (e: React.PointerEvent, layerId: string) => void;
  onChange: (id: string, val: string) => void;
};

export const CanvasLayers = memo(function CanvasLayers({
  camera,
  onLayerPointerDown,
  onLayerResizePointerDown,
  onLayerRotatePointerDown,
  onChange,
}: CanvasLayersProps) {
  const layerIds = useCanvasStore((s) => s.layerIds);
  const layers = useCanvasStore((s) => s.layers);
  const selection = useCanvasStore((s) => s.selection);
  const highlightedLayerIds = useCanvasStore((s) => s.highlightedLayerIds);
  const dropTargetColumnId = useCanvasStore((s) => s.dropTargetColumnId);

  const viewport = useMemo(() => getViewportCanvasBounds(camera), [camera.x, camera.y, camera.zoom]);

  const visibleIds = useMemo(() => {
    return layerIds.filter((id) => {
      const layer = layers[id];
      return layer && !isHtmlLayerType(layer.type) && isLayerInViewport(layer, viewport);
    });
  }, [layerIds, layers, viewport]);

  return (
    <>
      {dropTargetColumnId && layers[dropTargetColumnId] && (
        <rect
          x={layers[dropTargetColumnId].x - 4}
          y={layers[dropTargetColumnId].y - 4}
          width={layers[dropTargetColumnId].width + 8}
          height={layers[dropTargetColumnId].height + 8}
          rx={14}
          className="fill-blue-400/10 stroke-blue-500 stroke-2 pointer-events-none layer-drop-glow"
        />
      )}
      {visibleIds.map((id) => (
        <LayerPreview
          key={id}
          id={id}
          layer={layers[id]}
          onLayerPointerDown={onLayerPointerDown}
          onLayerResizePointerDown={onLayerResizePointerDown}
          onLayerRotatePointerDown={onLayerRotatePointerDown}
          onChange={(val) => onChange(id, val)}
          selectionColor={selection.includes(id) ? "#3b82f6" : undefined}
          highlighted={highlightedLayerIds.includes(id)}
        />
      ))}
    </>
  );
});
