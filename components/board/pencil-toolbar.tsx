"use client";

import { useCanvasStore } from "@/store/use-canvas-store";
import { Button } from "@/components/ui/button";
import { Eraser, Pencil } from "lucide-react";

export function PencilToolbar() {
    const { 
        canvasState, 
        lastUsedColor, 
        setLastUsedColor, 
        pencilThickness, 
        setPencilThickness,
        pencilTool,
    } = useCanvasStore();

    if (canvasState.mode !== "pencil") return null;

    return (
        <div className="absolute top-20 right-4 md:right-auto md:left-1/2 md:-translate-x-1/2 flex flex-row items-center gap-2 p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 pointer-events-auto">
            
            {/* Tool Indicator */}
            <div className="flex items-center gap-2 px-2">
                {pencilTool === "draw" ? (
                    <Pencil className="h-4 w-4 text-neutral-500" />
                ) : (
                    <Eraser className="h-4 w-4 text-neutral-500" />
                )}
                <span className="text-[10px] uppercase font-bold text-neutral-500">
                    {pencilTool === "draw" ? "Dessin" : "Gomme"}
                </span>
            </div>

            <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-2" />

            {/* Thickness Control */}
            <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-neutral-500">Épaisseur</span>
                <input 
                    type="range" 
                    min="2" 
                    max="50" 
                    value={pencilThickness} 
                    onChange={(e) => setPencilThickness(parseInt(e.target.value))}
                    className="w-24 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer dark:bg-neutral-700"
                />
                {/* Visual Preview Circle */}
                <div className="w-8 h-8 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-900">
                    <div 
                        style={{ 
                            width: Math.min(pencilThickness, 20),
                            height: Math.min(pencilThickness, 20), 
                            borderRadius: '50%',
                            backgroundColor: pencilTool === "draw" ? lastUsedColor : "#fff",
                            border: pencilTool === "erase" ? "1px solid #000" : "none",
                            boxShadow: pencilTool === "erase" ? "inset 0 0 2px rgba(0,0,0,0.2)" : "none"
                        }}
                    />
                </div>
            </div>

            {/* Color Picker (Draw Mode Only) */}
            {pencilTool === "draw" && (
                <>
                    <div className="w-[1px] h-6 bg-neutral-200 dark:bg-neutral-700 mx-2" />
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-neutral-500">Couleur</span>
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
