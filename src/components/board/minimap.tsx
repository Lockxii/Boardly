import { useCanvasStore } from "@/store/canvas-store";
import { useMemo, useCallback, useRef } from "react";

const MINIMAP_W = 180;
const MINIMAP_H = 120;
const PADDING = 20;

export function Minimap() {
  const camera = useCanvasStore((s) => s.camera);
  const setCamera = useCanvasStore((s) => s.setCamera);
  const layerIds = useCanvasStore((s) => s.layerIds);
  const layers = useCanvasStore((s) => s.layers);
  const selection = useCanvasStore((s) => s.selection);
  const containerRef = useRef<HTMLDivElement>(null);

  const bounds = useMemo(() => {
    if (layerIds.length === 0) {
      return { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of layerIds) {
      const layer = layers[id];
      if (layer) {
        minX = Math.min(minX, layer.x);
        minY = Math.min(minY, layer.y);
        maxX = Math.max(maxX, layer.x + layer.width);
        maxY = Math.max(maxY, layer.y + layer.height);
      }
    }
    minX -= PADDING; minY -= PADDING; maxX += PADDING; maxY += PADDING;
    return { minX, minY, maxX, maxY };
  }, [layerIds, layers]);

  const scale = useMemo(() => {
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;
    return Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);
  }, [bounds]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const worldX = bounds.minX + clickX / scale;
    const worldY = bounds.minY + clickY / scale;
    setCamera({
      x: window.innerWidth / 2 - worldX * camera.zoom,
      y: window.innerHeight / 2 - worldY * camera.zoom,
      zoom: camera.zoom,
    });
  }, [bounds, scale, camera.zoom, setCamera]);

  const viewportRect = useMemo(() => {
    const vx = (-camera.x / camera.zoom - bounds.minX) * scale;
    const vy = (-camera.y / camera.zoom - bounds.minY) * scale;
    const vw = (window.innerWidth / camera.zoom) * scale;
    const vh = (window.innerHeight / camera.zoom) * scale;
    return { x: vx, y: vy, w: vw, h: vh };
  }, [camera, bounds, scale]);

  const worldW = (bounds.maxX - bounds.minX) * scale;
  const worldH = (bounds.maxY - bounds.minY) * scale;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-4 right-4 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 pointer-events-auto cursor-crosshair overflow-hidden z-40"
      style={{ width: Math.max(worldW, 100), height: Math.max(worldH, 60) }}
      onClick={handleClick}
      title="Cliquez pour naviguer (M pour masquer)"
    >
      <svg width="100%" height="100%" className="block">
        {layerIds.map((id: string) => {
          const layer = layers[id];
          if (!layer) return null;
          const x = (layer.x - bounds.minX) * scale;
          const y = (layer.y - bounds.minY) * scale;
          const w = Math.max(layer.width * scale, 2);
          const h = Math.max(layer.height * scale, 2);
          const isSelected = selection.includes(id);
          return (
            <rect
              key={id}
              x={x} y={y} width={w} height={h}
              fill={isSelected ? "#3b82f6" : layer.fill || "#94a3b8"}
              opacity={0.6}
              rx={1}
            />
          );
        })}
        <rect
          className="minimap-viewport"
          x={viewportRect.x}
          y={viewportRect.y}
          width={viewportRect.w}
          height={viewportRect.h}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="#3b82f6"
          strokeWidth={1.5}
          rx={2}
        />
      </svg>
    </div>
  );
}
