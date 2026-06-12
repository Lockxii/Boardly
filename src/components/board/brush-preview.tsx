import { useCanvasStore } from "@/store/canvas-store";
import { useEffect, useRef, useState } from "react";

export function BrushPreview() {
  const canvasState = useCanvasStore((s) => s.canvasState);
  const pencilThickness = useCanvasStore((s) => s.pencilThickness);
  const pencilTool = useCanvasStore((s) => s.pencilTool);
  const lastUsedColor = useCanvasStore((s) => s.lastUsedColor);
  const camera = useCanvasStore((s) => s.camera);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    if (canvasState.mode !== "pencil") {
      trailRef.current = [];
      setCursorPos(null);
      return;
    }

    let raf = 0;
    const onPointerMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = { x: e.clientX, y: e.clientY };
        setCursorPos(next);
        trailRef.current = [...trailRef.current.slice(-6), next];
      });
    };
    const onPointerLeave = () => {
      setCursorPos(null);
      trailRef.current = [];
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(raf);
    };
  }, [canvasState.mode]);

  if (canvasState.mode !== "pencil" || !cursorPos) return null;

  const size = pencilThickness * camera.zoom;

  return (
    <>
      {trailRef.current.map((point, i) => (
        <div
          key={`${point.x}-${point.y}-${i}`}
          className="fixed top-0 left-0 pointer-events-none z-[9998]"
          style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
        >
          <div
            style={{
              width: size * (0.35 + i * 0.1),
              height: size * (0.35 + i * 0.1),
              borderRadius: "50%",
              backgroundColor: pencilTool === "erase" ? "rgba(255,255,255,0.35)" : lastUsedColor,
              opacity: 0.08 + i * 0.04,
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
      ))}
      <div
        className="fixed top-0 left-0 pointer-events-none z-[9999] brush-preview-ring"
        style={{ transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)` }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            border: "1.5px solid rgba(37, 99, 235, 0.55)",
            backgroundColor: pencilTool === "erase" ? "rgba(255,255,255,0.85)" : lastUsedColor,
            opacity: 0.55,
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.35), 0 4px 14px rgba(37,99,235,0.18)",
          }}
        />
      </div>
    </>
  );
}
