import { useCanvasStore } from "@/store/use-canvas-store";
import { Eraser, Pencil } from "lucide-react";
import { ColorPresets } from "./color-presets";
import { FloatingDock } from "./floating-dock";

export function PencilToolbar() {
  const {
    canvasState,
    lastUsedColor,
    setLastUsedColor,
    pencilThickness,
    setPencilThickness,
    pencilTool,
    setPencilTool,
  } = useCanvasStore();

  if (canvasState.mode !== "pencil") return null;

  return (
    <FloatingDock id="pencil" defaultAnchor="top-center" zIndex={45} toggleMode="collapse" collapsedContent={
      <>
        <Pencil className="h-3.5 w-3.5 text-neutral-500" />
        <span className="text-xs font-medium">Dessin</span>
      </>
    }>
      <div className="flex max-w-[min(96vw,720px)] flex-nowrap items-center gap-1.5 px-0.5">
        <button
          type="button"
          title="Crayon"
          onClick={() => setPencilTool("draw")}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${pencilTool === "draw" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Gomme"
          onClick={() => setPencilTool("erase")}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${pencilTool === "erase" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
        >
          <Eraser className="h-3.5 w-3.5" />
        </button>

        <div className="mx-0.5 h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />

        <input
          type="range"
          min="2"
          max="50"
          value={pencilThickness}
          onChange={(e) => setPencilThickness(parseInt(e.target.value))}
          className="h-1.5 w-20 shrink-0 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-blue-600 dark:bg-neutral-700"
          title="Épaisseur"
        />
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
          <div
            style={{
              width: Math.min(pencilThickness, 16),
              height: Math.min(pencilThickness, 16),
              borderRadius: "50%",
              backgroundColor: pencilTool === "draw" ? lastUsedColor : "#fff",
              border: pencilTool === "erase" ? "1px solid #000" : "none",
            }}
          />
        </div>

        {pencilTool === "draw" && (
          <>
            <div className="mx-0.5 h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
            <ColorPresets compact onSelect={(c) => setLastUsedColor(c)} />
          </>
        )}
      </div>
    </FloatingDock>
  );
}
