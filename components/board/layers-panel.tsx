"use client";

import { useStorage, useMutation } from "@/liveblocks.config";
import { Reorder } from "framer-motion";
import { Square, Circle, Type, StickyNote, Image as ImageIcon, Triangle, MoveRight, Diamond, Star, Pencil, GripVertical } from "lucide-react";
import { useCanvasStore } from "@/store/use-canvas-store";

const ICON_MAP = {
    Rectangle: Square,
    Ellipse: Circle,
    Text: Type,
    Note: StickyNote,
    Image: ImageIcon,
    Path: Pencil,
    Triangle: Triangle,
    Arrow: MoveRight,
    Diamond: Diamond,
    Star: Star,
};

export function LayersPanel() {
    const layerIds = useStorage((root) => root.layerIds);
    const layers = useStorage((root) => root.layers);
    
    const updateOrder = useMutation(({ storage }, newIds: string[]) => {
        const liveLayerIds = storage.get("layerIds");
        // Clear and refill to ensure exact order
        // Note: Better way is to find differences, but for small lists this is fine
        for (let i = 0; i < newIds.length; i++) {
            liveLayerIds.move(liveLayerIds.indexOf(newIds[i]), i);
        }
    }, []);

    if (!layerIds || !layers || layerIds.length === 0) {
        return (
            <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 p-4 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 w-64 text-center text-sm text-neutral-500">
                Aucun calque sur le tableau
            </div>
        );
    }

    // Liveblocks LayerIds are bottom-to-top (index 0 is back)
    // For the UI, we want top-to-bottom (index 0 is front)
    const displayIds = [...layerIds].reverse();

    const handleReorder = (newDisplayIds: string[]) => {
        // Reverse back to storage order (bottom-to-top)
        const newStorageIds = [...newDisplayIds].reverse();
        updateOrder(newStorageIds);
    };

    return (
        <div className="absolute left-16 top-1/2 -translate-y-1/2 bg-white dark:bg-neutral-800 p-2 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-700 w-64 max-h-[70vh] flex flex-col pointer-events-auto">
            <div className="px-2 py-1 border-b border-neutral-100 dark:border-neutral-700 mb-2">
                <span className="text-xs font-bold uppercase text-neutral-500">Calques</span>
            </div>
            
            <Reorder.Group 
                axis="y" 
                values={displayIds} 
                onReorder={handleReorder}
                className="overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-1"
            >
                {displayIds.map((id) => {
                    const layer = layers.get(id);
                    if (!layer) return null;
                    
                    const Icon = ICON_MAP[layer.type as keyof typeof ICON_MAP] || Square;
                    
                    return (
                        <Reorder.Item 
                            key={id} 
                            value={id}
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 group cursor-pointer"
                        >
                            <GripVertical className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600 shrink-0" />
                            <div 
                                className="h-6 w-6 rounded border border-neutral-200 dark:border-neutral-600 flex items-center justify-center shrink-0"
                                style={{ backgroundColor: layer.fill || "#fff" }}
                            >
                                <Icon className="h-3 w-3 text-neutral-600 mix-blend-difference invert" />
                            </div>
                            <span className="text-sm truncate flex-1 dark:text-neutral-200">
                                {layer.type} {layer.value ? `- ${layer.value.replace(/<[^>]*>/g, '')}` : ""}
                            </span>
                        </Reorder.Item>
                    );
                })}
            </Reorder.Group>
        </div>
    );
}
