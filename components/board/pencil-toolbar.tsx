"use client";

import { useCanvasStore } from "@/store/use-canvas-store";
import { Button } from "@/components/ui/button";
import { Eraser, Pencil } from "lucide-react";
import { useSelf, useMutation } from "@/liveblocks.config";

export function PencilToolbar() {
    const { 
        canvasState, 
        lastUsedColor, 
        setLastUsedColor, 
        pencilThickness, 
        setPencilThickness,
        pencilTool,
        setPencilTool
    } = useCanvasStore();

    if (canvasState.mode !== "pencil") return null;

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white dark:bg-neutral-800 p-3 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 pointer-events-auto">
            
            {/* Tool Switcher */}
            <div className="flex bg-neutral-100 dark:bg-neutral-900 rounded-md p-1">
                <Button 
                    variant={pencilTool === "draw" ? "secondary" : "ghost"} 
                    size="icon" 
                    onClick={() => setPencilTool("draw")}
                    className={pencilTool === "draw" ? "bg-white shadow-sm" : ""}
                    title="Dessiner"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button 
                    variant={pencilTool === "erase" ? "secondary" : "ghost"} 
                    size="icon" 
                    onClick={() => setPencilTool("erase")}
                    className={pencilTool === "erase" ? "bg-white shadow-sm" : ""}
                    title="Gomme"
                >
                    <Eraser className="h-4 w-4" />
                </Button>
            </div>

            <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700" />

            {/* Thickness Slider */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-500">Épaisseur</span>
                <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    value={pencilThickness} 
                    onChange={(e) => setPencilThickness(parseInt(e.target.value))}
                    className="w-24 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700"
                />
                <span className="text-xs text-neutral-500 w-4">{pencilThickness}</span>
            </div>

            {/* Only show Color Picker if Drawing */}
            {pencilTool === "draw" && (
                <>
                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700" />
                    <div className="flex items-center gap-2">
                         <div className="relative overflow-hidden rounded-full border border-neutral-300 w-6 h-6 shadow-sm hover:scale-110 transition" style={{ backgroundColor: lastUsedColor }}>
                            <input 
                                type="color" 
                                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                                value={lastUsedColor}
                                onChange={(e) => setLastUsedColor(e.target.value)}
                                title="Couleur"
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
