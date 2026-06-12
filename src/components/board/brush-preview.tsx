import { useCanvasStore } from "@/store/canvas-store";
import { useEffect, useState } from "react";

export function BrushPreview() {
  const canvasState = useCanvasStore((s) => s.canvasState);
  const pencilThickness = useCanvasStore((s) => s.pencilThickness);
  const pencilTool = useCanvasStore((s) => s.pencilTool);
  const lastUsedColor = useCanvasStore((s) => s.lastUsedColor);
  const camera = useCanvasStore((s) => s.camera);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (canvasState.mode !== "pencil") {
      setCursorPos(null);
      setIsDrawing(false);
      return;
    }

    let raf = 0;
    const onPointerMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCursorPos({ x: e.clientX, y: e.clientY }));
    };
    const onPointerDown = () => setIsDrawing(true);
    const onPointerUp = () => setIsDrawing(false);
    const onPointerLeave = () => {
      setCursorPos(null);
      setIsDrawing(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(raf);
    };
  }, [canvasState.mode]);

  if (canvasState.mode !== "pencil" || !cursorPos) return null;

  const size = Math.max(8, pencilThickness * camera.zoom);

  return (
    <div
      className="fixed top-0 left-0 pointer-events-none z-[9999] brush-preview-ring"
      style={{ transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)` }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: isDrawing ? "none" : "1.5px solid rgba(37, 99, 235, 0.65)",
          backgroundColor: pencilTool === "erase" ? "rgba(255,255,255,0.92)" : lastUsedColor,
          opacity: pencilTool === "erase" ? 0.85 : 0.75,
          transform: "translate(-50%, -50%)",
          boxShadow: isDrawing
            ? `0 0 0 ${Math.max(1, size * 0.08)}px rgba(255,255,255,0.5)`
            : "0 0 0 1px rgba(255,255,255,0.45), 0 2px 10px rgba(37,99,235,0.2)",
        }}
      />
    </div>
  );
}
