import { useCanvasStore } from "@/store/canvas-store";
import { useEffect, useState } from "react";
import { Cloud, CloudOff, Layers, Loader2, MousePointer2, ZoomIn } from "lucide-react";

export function StatusBar() {
  const camera = useCanvasStore((s) => s.camera);
  const canvasState = useCanvasStore((s) => s.canvasState);
  const layerIds = useCanvasStore((s) => s.layerIds);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const saveStatus = useCanvasStore((s) => s.saveStatus);
  const lastSavedAt = useCanvasStore((s) => s.lastSavedAt);
  const connectFromId = useCanvasStore((s) => s.connectFromId);
  const selectedConnectionId = useCanvasStore((s) => s.selectedConnectionId);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const { camera } = useCanvasStore.getState();
        setMousePos({
          x: Math.round((e.clientX - camera.x) / camera.zoom),
          y: Math.round((e.clientY - camera.y) / camera.zoom),
        });
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  const modeLabel = (() => {
    if (connectFromId) return "Relier — clique sur l'arrivée · Échap / ✕ / V pour quitter";
    if (selectedConnectionId) return "Connecteur · Échap / ✕ / recliquer la flèche pour quitter";
    switch (canvasState.mode) {
      case "none": return "Sélection";
      case "translating": return "Déplacement";
      case "resizing": return "Redimensionnement";
      case "rotating": return "Rotation";
      case "inserting": return `Insertion ${canvasState.layerType}`;
      case "pencil": return "Dessin";
      case "panning": return "Main";
      case "selectionNet": return "Sélection multiple";
      default: return "";
    }
  })();

  const saveLabel = (() => {
    switch (saveStatus) {
      case "saving": return "Sauvegarde…";
      case "saved":
        return lastSavedAt
          ? `Sauvegardé ${new Date(lastSavedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
          : "Sauvegardé";
      case "error": return "Erreur de sauvegarde";
      default: return "Local";
    }
  })();

  const SaveIcon =
    saveStatus === "saving" ? Loader2 :
    saveStatus === "error" ? CloudOff :
    Cloud;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-7 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border-t border-neutral-200/50 dark:border-neutral-700/50 flex items-center px-3 gap-4 text-[10px] font-mono text-neutral-500 dark:text-neutral-400 pointer-events-none z-30 select-none">
      <div className="flex items-center gap-1.5">
        <MousePointer2 className="h-3 w-3" />
        <span>{modeLabel}</span>
      </div>
      <div className="w-[1px] h-3 bg-neutral-200 dark:bg-neutral-700" />
      <div className={`flex items-center gap-1.5 ${saveStatus === "error" ? "text-red-500" : saveStatus === "saved" ? "text-emerald-600" : ""}`}>
        <SaveIcon className={`h-3 w-3 ${saveStatus === "saving" ? "animate-spin" : ""}`} />
        <span>{saveLabel}</span>
      </div>
      <div className="w-[1px] h-3 bg-neutral-200 dark:bg-neutral-700" />
      <div className="flex items-center gap-1.5">
        <ZoomIn className="h-3 w-3" />
        <span>{Math.round(camera.zoom * 100)}%</span>
      </div>
      <div className="w-[1px] h-3 bg-neutral-200 dark:bg-neutral-700" />
      <div className="flex items-center gap-1.5">
        <Layers className="h-3 w-3" />
        <span>{layerIds.length} calque{layerIds.length > 1 ? "s" : ""}</span>
      </div>
      {snapToGrid && (
        <>
          <div className="w-[1px] h-3 bg-neutral-200 dark:bg-neutral-700" />
          <span className="text-blue-500">Snap</span>
        </>
      )}
      {mousePos && (
        <>
          <div className="w-[1px] h-3 bg-neutral-200 dark:bg-neutral-700" />
          <span>x: {mousePos.x} y: {mousePos.y}</span>
        </>
      )}
    </div>
  );
}
