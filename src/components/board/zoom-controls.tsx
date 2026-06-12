import { useCanvasStore } from "@/store/use-canvas-store";
import { Button } from "@/components/ui/button";
import { Minus, Plus, RotateCcw, ZoomIn } from "lucide-react";
import { FloatingDock, useFloatingDock } from "./floating-dock";

export function ZoomControls() {
  const { camera, setCamera } = useCanvasStore();

  const handleZoom = (delta: number) => {
    setCamera({ ...camera, zoom: Math.min(Math.max(camera.zoom + delta, 0.1), 5) });
  };

  const handleReset = () => {
    setCamera({ ...camera, zoom: 1 });
  };

  const handleFitAll = () => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  };

  return (
    <FloatingDock
      id="zoom"
      defaultAnchor="bottom-left"
      zIndex={35}
      collapsedContent={
        <>
          <ZoomIn className="h-3.5 w-3.5 text-neutral-500" />
          <span className="font-mono tabular-nums">{Math.round(camera.zoom * 100)}%</span>
        </>
      }
    >
      <ZoomControlsContent
        zoom={camera.zoom}
        onZoomOut={() => handleZoom(-0.1)}
        onZoomIn={() => handleZoom(0.1)}
        onReset={handleReset}
        onFitAll={handleFitAll}
      />
    </FloatingDock>
  );
}

function ZoomControlsContent({
  zoom,
  onZoomOut,
  onZoomIn,
  onReset,
  onFitAll,
}: {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
  onFitAll: () => void;
}) {
  const { vertical } = useFloatingDock();

  return (
    <div className={`flex items-center gap-0.5 ${vertical ? "flex-col py-0.5" : "flex-row"}`}>
      <Button variant="ghost" size="icon" onClick={onZoomOut} className="h-8 w-8" title="Zoom arrière (Ctrl+-)">
        <Minus className="h-4 w-4" />
      </Button>
      <button
        onClick={onReset}
        className="min-w-12 rounded px-1 py-1 text-center font-mono text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700"
        title="Réinitialiser (Ctrl+0)"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button variant="ghost" size="icon" onClick={onZoomIn} className="h-8 w-8" title="Zoom avant (Ctrl+=)">
        <Plus className="h-4 w-4" />
      </Button>
      <div className={`bg-neutral-200 dark:bg-neutral-700 ${vertical ? "h-px w-5" : "h-5 w-px"}`} />
      <Button variant="ghost" size="icon" onClick={onFitAll} className="h-8 w-8" title="Recentrer (Ctrl+0)">
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
