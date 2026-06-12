import { useCanvasStore } from "@/store/use-canvas-store";
import { Button } from "@/components/ui/button";
import { Minus, Plus, RotateCcw } from "lucide-react";

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
    <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-white dark:bg-neutral-800 p-1 rounded-lg shadow-md border border-neutral-200 dark:border-neutral-700 pointer-events-auto">
      <Button variant="ghost" size="icon" onClick={() => handleZoom(-0.1)} title="Zoom arrière (Ctrl+-)">
        <Minus className="h-4 w-4" />
      </Button>
      <button onClick={handleReset} className="w-12 text-xs font-mono font-medium text-center hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded py-1" title="Réinitialiser (Ctrl+0)">
        {Math.round(camera.zoom * 100)}%
      </button>
      <Button variant="ghost" size="icon" onClick={() => handleZoom(0.1)} title="Zoom avant (Ctrl+=)">
        <Plus className="h-4 w-4" />
      </Button>
      <div className="w-[1px] h-5 bg-neutral-200 dark:bg-neutral-700" />
      <Button variant="ghost" size="icon" onClick={handleFitAll} className="h-8 w-8" title="Recentrer (Ctrl+0)">
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
