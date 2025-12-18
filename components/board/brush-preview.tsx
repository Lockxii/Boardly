"use client";

import { useCanvasStore } from "@/store/use-canvas-store";
import { useEffect, useState } from "react";
import { pointerEventToCanvasPoint } from "@/lib/utils";

export function BrushPreview() {
    const { canvasState, pencilThickness, pencilTool, lastUsedColor, camera } = useCanvasStore();
    const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);

    useEffect(() => {
        const onPointerMove = (e: PointerEvent) => {
            setCursorPos({ x: e.clientX, y: e.clientY });
        };
        
        const onPointerLeave = () => {
            setCursorPos(null);
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerleave", onPointerLeave);
        
        return () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerleave", onPointerLeave);
        };
    }, []);

    if (canvasState.mode !== "pencil" || !cursorPos) return null;

    // Use a fixed Z-index overlay for the brush cursor
    // The cursor is in screen coordinates (fixed overlay)
    
    const size = pencilThickness * camera.zoom; 
    
    return (
        <div 
            className="fixed top-0 left-0 pointer-events-none z-[9999]"
            style={{ 
                transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)`,
            }}
        >
            <div 
                style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    border: '1px solid rgba(0,0,0,0.5)',
                    backgroundColor: pencilTool === 'erase' ? 'rgba(255,255,255,0.8)' : lastUsedColor,
                    opacity: 0.5,
                    transform: 'translate(-50%, -50%)', // Center on cursor
                    boxShadow: '0 0 2px rgba(0,0,0,0.3)'
                }}
            />
        </div>
    );
}